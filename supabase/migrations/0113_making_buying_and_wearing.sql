begin;

-- Making an avatar item, buying one, and putting it on.
--
-- 0112 is the shape; this is everything that may happen to it. The tables
-- have no insert or update policy at all, so these functions are the only
-- way in - which is the point. Every one of them charges, or checks who is
-- asking, or screens what was written, and a table anybody could insert into
-- directly is all three of those made optional.
--
-- The money moves through `move_pixels`, which raises `kobbleston.money`
-- around its own write. That is not decoration: `guard_profile_update` pins
-- `pixels` for everybody who is not an admin, and a trusted function whose
-- write is silently undone by a guard that only knows who asked is the worst
-- bug this platform has had.

-- -------------------------------------------------------------- making one

/**
 * Makes an avatar item, and charges for it.
 *
 * The order matters and is deliberate: who you are, then what you wrote,
 * then the money, then the row. Charging before screening would take Brix
 * for something that is about to be refused; writing the row before charging
 * would leave a thing in the shop that nobody paid for if the charge failed.
 */
create or replace function public.create_avatar_item(
  item_kind text,
  item_slot text,
  item_name text,
  about text,
  cost integer,
  picture text default null,
  model uuid default null,
  texture uuid default null
) returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  rule record;
  verdict record;
  made uuid;
  mine record;
  balance integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot make things. Make an account and you can.';
  end if;

  select * into rule from public.avatar_rules() where kind = item_kind;
  if rule.kind is null then raise exception 'There is no such kind of item.'; end if;

  select is_verified, is_admin, is_suspended into mine
    from public.profiles where id = me;

  if mine.is_suspended then raise exception 'Suspended accounts cannot make things.'; end if;

  if rule.kobblon_only and not coalesce(mine.is_admin, false) then
    raise exception 'Only Kobblon makes those.';
  end if;

  if rule.needs_verified
     and not (coalesce(mine.is_verified, false) or coalesce(mine.is_admin, false)) then
    raise exception 'Only verified accounts can make a %.', item_kind;
  end if;

  /*
   * A slot the kind cannot go in is refused rather than quietly corrected.
   * Only an accessory has a choice of slot; everything else wears its own
   * name, so a shirt asking to be a hat is a caller with a bug in it.
   */
  if item_kind = 'accessory' then
    if item_slot not in ('hat', 'front', 'back', 'neck', 'waist', 'leftHand', 'rightHand') then
      raise exception 'An accessory does not go there.';
    end if;
  elsif item_slot is distinct from item_kind then
    raise exception 'A % is always worn as a %.', item_kind, item_kind;
  end if;

  if cost is null or cost < rule.least_price then
    raise exception 'A % sells for at least % Brix.', item_kind, rule.least_price;
  end if;

  select * into verdict from public.screen_text(
    coalesce(item_name, '') || ' ' || coalesce(about, ''));
  if verdict.decision = 'block' then
    raise exception 'That name or description is not allowed here.';
  end if;

  /*
   * A model has to be one of yours. Without this somebody could point an
   * accessory at anybody's mesh and sell it - the mesh stays where it is,
   * but the thing being sold is made of it.
   */
  if model is not null and not exists (
    select 1 from public.assets a where a.id = model and a.creator_id = me
  ) then
    raise exception 'That model is not yours to use.';
  end if;

  /*
   * The balance is checked here because `move_pixels` does not check it: it
   * moves what it is told to and writes the ledger row. Charging without
   * looking first would take somebody into a negative balance, which this
   * schema has no concept of.
   */
  if rule.upload_cost > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < rule.upload_cost then
      raise exception 'Making a % costs % Brix and you have %.',
        item_kind, rule.upload_cost, balance;
    end if;
    perform public.move_pixels(me, -rule.upload_cost, 'listing_fee',
      'Made a ' || item_kind);
    if house is not null and house <> me then
      perform public.move_pixels(house, rule.upload_cost, 'platform_fee',
        'Upload fee for a ' || item_kind);
    end if;
  end if;

  insert into public.avatar_items (
    creator_id, kind, slot, name, description, price,
    image_path, mesh_id, texture_id
  ) values (
    me, item_kind, item_slot, btrim(item_name), nullif(btrim(coalesce(about, '')), ''),
    cost, picture, model, texture
  ) returning id into made;

  -- Whoever made it has it, without buying it.
  insert into public.avatar_owned (item_id, user_id) values (made, me)
  on conflict do nothing;

  return made;
end;
$$;

-- -------------------------------------------------------- listing it or not

/**
 * Putting it in the shop, or taking it back out. Free, both ways, which is
 * Staw's call and the right one: charging somebody to stop selling a thing
 * is charging them to change their mind.
 */
create or replace function public.list_avatar_item(target uuid, listed boolean)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  update public.avatar_items
     set is_public = listed, updated_at = now()
   where id = target and creator_id = me and not is_removed;
  if not found then raise exception 'That is not yours.'; end if;
end;
$$;

-- --------------------------------------------------------------- buying one

/**
 * Taking an item: free or paid, it lands in your inventory.
 *
 * The creator is paid, less Kobblon's share, and nothing moves at all when
 * it is free - which is a different sentence from paying zero, and is why
 * the whole block is skipped rather than passing 0 along.
 */
create or replace function public.buy_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  keeps integer;
  cut integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot take things. Make an account and you can.';
  end if;

  select i.*, p.is_suspended as maker_suspended into item
    from public.avatar_items i
    join public.profiles p on p.id = i.creator_id
   where i.id = target;

  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed or not item.is_public or item.status <> 'approved'
     or item.maker_suspended then
    raise exception 'That is not for sale.';
  end if;

  if exists (select 1 from public.avatar_owned o
              where o.item_id = target and o.user_id = me) then
    return;  -- Already theirs. Taking it twice is not an error, it is a no-op.
  end if;

  if item.price > 0 then
    if item.creator_id = me then
      raise exception 'That is already yours.';
    end if;

    select pixels into balance from public.profiles where id = me;
    if balance < item.price then
      raise exception 'That costs % Brix and you have %.', item.price, balance;
    end if;

    cut := round(item.price * public.platform_share() / 100.0)::integer;
    keeps := item.price - cut;

    perform public.move_pixels(me, -item.price, 'purchase', 'Bought ' || item.name);
    perform public.move_pixels(item.creator_id, keeps, 'sale', 'Sold ' || item.name);
    if cut > 0 and house is not null and house <> item.creator_id then
      perform public.move_pixels(house, cut, 'platform_fee', 'Share of ' || item.name);
    end if;
  end if;

  insert into public.avatar_owned (item_id, user_id) values (target, me)
  on conflict do nothing;
end;
$$;

-- -------------------------------------------------------------- wearing it

/**
 * Putting something on, which you may only do with something you have.
 *
 * Checked here and not in the page, because a page is a suggestion. Without
 * this anybody could wear anything by asking for it by id, which makes
 * buying an item optional and the shop decorative.
 */
create or replace function public.wear_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into item from public.avatar_items where id = target;
  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if not exists (select 1 from public.avatar_owned o
                  where o.item_id = target and o.user_id = me) then
    raise exception 'You do not have that.';
  end if;

  insert into public.avatar_worn (user_id, slot, item_id)
  values (me, item.slot, target)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;
end;
$$;

/** Taking a slot off. Nothing to check: it is your own avatar. */
create or replace function public.take_off_slot(which text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  delete from public.avatar_worn where user_id = me and slot = which;
end;
$$;

-- ----------------------------------------------------------- body colours

/**
 * The colour of each part.
 *
 * Validated here rather than trusted, because this lands in a jsonb column
 * and jsonb will hold absolutely anything. A part nobody has heard of or a
 * colour that is not a colour would be written happily and then handed to
 * the engine, where it is a body that does not draw.
 */
create or replace function public.set_body_colours(colours jsonb)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  part text;
  value text;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if colours is not null then
    if jsonb_typeof(colours) <> 'object' then
      raise exception 'Colours come as an object.';
    end if;
    for part, value in select * from jsonb_each_text(colours) loop
      if part not in ('Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg') then
        raise exception 'There is no body part called %.', part;
      end if;
      if value !~* '^#[0-9a-f]{6}$' then
        raise exception 'A colour looks like #1b34e8.';
      end if;
    end loop;
  end if;

  update public.profiles set body = colours where id = me;
end;
$$;

grant execute on function public.create_avatar_item to authenticated;
grant execute on function public.list_avatar_item   to authenticated;
grant execute on function public.buy_avatar_item    to authenticated;
grant execute on function public.wear_avatar_item   to authenticated;
grant execute on function public.take_off_slot      to authenticated;
grant execute on function public.set_body_colours   to authenticated;

commit;
