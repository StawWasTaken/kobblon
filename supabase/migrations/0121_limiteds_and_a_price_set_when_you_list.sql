begin;

-- Two changes to how a thing is made and sold.
--
-- **A price belongs to listing, not to making.** Staw: you should not have
-- to set a price to upload something, only to publish it. Which is right -
-- making a thing and deciding what it is worth are different decisions, and
-- the second one happens when somebody is ready to sell. So `price` may be
-- left out when making, and `list_avatar_item` takes one.
--
-- **A limited is a thing with a closing time.** Kobblon's alone. It stays in
-- the Catalog for ever and stops being buyable when the time passes, which
-- is what makes it limited: everybody can see it, only the people who got
-- there in time have it.

alter table public.avatar_items
  add column if not exists sells_until timestamptz;

comment on column public.avatar_items.sells_until is
  'A limited stops being buyable at this moment and stays in the Catalog '
  'for ever. Null for everything that is simply on sale. Only Kobblon sets '
  'one, which `set_limited` enforces.';

create index if not exists avatar_items_limited_idx
  on public.avatar_items (sells_until)
  where sells_until is not null;

/*
 * Making one no longer needs a price.
 *
 * `cost` defaults to null and is only checked against the kind's floor when
 * one was actually given - so a thing can be made now and priced later,
 * and anybody passing a price still has it checked exactly as before.
 */
create or replace function public.create_avatar_item(
  item_kind text,
  item_slot text,
  item_name text,
  about text,
  cost integer default null,
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

  if item_kind = 'accessory' then
    if item_slot not in ('hat', 'front', 'back', 'neck', 'waist', 'leftHand', 'rightHand') then
      raise exception 'An accessory does not go there.';
    end if;
  elsif item_slot is distinct from item_kind then
    raise exception 'A % is always worn as a %.', item_kind, item_kind;
  end if;

  -- Only when one was given. The price is settled at listing.
  if cost is not null and cost < rule.least_price then
    raise exception 'A % sells for at least % Brix.', item_kind, rule.least_price;
  end if;

  select * into verdict from public.screen_text(
    coalesce(item_name, '') || ' ' || coalesce(about, ''));
  if verdict.decision = 'block' then
    raise exception 'That name or description is not allowed here.';
  end if;

  if model is not null and not exists (
    select 1 from public.assets a where a.id = model and a.creator_id = me
  ) then
    raise exception 'That model is not yours to use.';
  end if;

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
    coalesce(cost, 0), picture, model, texture
  ) returning id into made;

  insert into public.avatar_owned (item_id, user_id) values (made, me)
  on conflict do nothing;

  return made;
end;
$$;

/*
 * The old two-argument one goes first.
 *
 * Adding a third argument with a default does not replace a function, it
 * overloads it - and then `list_avatar_item(uuid, boolean)`, which is what
 * every caller on the website sends, matches both and Postgres refuses to
 * choose: "function is not unique". Listing anything would have stopped
 * working the moment this was applied.
 *
 * Same shape as the `avatar_shelf` signature left behind in 0117. A
 * migration that adds a parameter has to say goodbye to the arity it is
 * replacing.
 */
drop function if exists public.list_avatar_item(uuid, boolean);

/**
 * Listing it, and saying what it costs while you do.
 *
 * The price is settled here because this is the moment somebody decides to
 * sell. Leaving it out keeps whatever the thing already had, so taking
 * something down and putting it back does not silently make it free.
 */
create or replace function public.list_avatar_item(
  target uuid, listed boolean, cost integer default null
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  rule record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into item from public.avatar_items
   where id = target and creator_id = me and not is_removed;
  if item.id is null then raise exception 'That is not yours.'; end if;

  select * into rule from public.avatar_rules() where kind = item.kind;

  if listed then
    /*
     * A thing cannot go on sale below its kind's floor, whether the price
     * was given now or left from before. Checking only what was passed
     * would let something made before a floor existed slip under it.
     */
    if coalesce(cost, item.price) < rule.least_price then
      raise exception 'A % sells for at least % Brix.', item.kind, rule.least_price;
    end if;
  end if;

  update public.avatar_items
     set is_public = listed,
         price = coalesce(cost, price),
         updated_at = now()
   where id = target;
end;
$$;

/**
 * Making something limited, which only Kobblon may do.
 *
 * A time rather than a count: Staw's limited is "you can buy it until then",
 * not "there are this many". The item stays in the Catalog afterwards - that
 * is the whole point of it, that everybody can see what they did not get.
 */
create or replace function public.set_limited(target uuid, until timestamptz)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon makes something limited.';
  end if;
  if until is not null and until <= now() then
    raise exception 'A limited closes in the future, not the past.';
  end if;

  update public.avatar_items
     set sells_until = until, updated_at = now()
   where id = target;
  if not found then raise exception 'There is no such item.'; end if;
end;
$$;

/*
 * And buying one is refused once its time has passed.
 *
 * The item is still there, still owned by whoever got it, still on its page
 * and still in the Catalog. Only the taking stops.
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
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if exists (select 1 from public.avatar_owned o
              where o.item_id = target and o.user_id = me) then
    return;
  end if;

  if item.creator_id = me then
    insert into public.avatar_owned (item_id, user_id) values (target, me)
    on conflict do nothing;
    return;
  end if;

  if not item.is_public or item.status <> 'approved' or item.maker_suspended then
    raise exception 'That is not for sale.';
  end if;

  if item.sells_until is not null and item.sells_until <= now() then
    raise exception 'That was limited, and the time to take it has passed.';
  end if;

  if item.price > 0 then
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

grant execute on function public.set_limited to authenticated;

commit;
