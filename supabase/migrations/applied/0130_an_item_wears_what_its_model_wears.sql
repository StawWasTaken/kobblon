begin;

-- An accessory with no texture named takes the one its model already wears.
--
-- The model is an ordinary mesh, and a mesh already carries the Decal it
-- wears - that is what `assets.texture_id` is, and it is what the mesh
-- viewer draws everywhere else on the site. Making the Catalog ask for the
-- same picture a second time is how an accessory ended up grey while its own
-- model was textured: two places to say one thing, one of them filled in.
--
-- Only a fallback. A texture named explicitly still wins, because choosing a
-- different picture for the Catalog version is a choice rather than a slip.
--
-- The body below is 0121's, taken from that file rather than retyped, with
-- the fallback and `paid` added. Retyping it is how the first draft of this
-- file quietly dropped the suspended-account check and invented a column on
-- `avatar_rules` that does not exist - it applied cleanly and would have let
-- a suspended account make things.

-- Dropped first because the defaults differ from what may already be there,
-- and Postgres refuses to remove a parameter default in place. Naming the
-- full signature, as always.
drop function if exists public.create_avatar_item(text, text, text, text, integer, text, uuid, uuid);

create function public.create_avatar_item(
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
  wears uuid := texture;
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

  -- The fallback, after the check above has established the model is theirs
  -- - so this cannot be used to point at somebody else's Decal through a
  -- mesh they do not own.
  if wears is null and model is not null then
    select a.texture_id into wears from public.assets a where a.id = model;
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
    coalesce(cost, 0), picture, model, wears
  ) returning id into made;

  insert into public.avatar_owned (item_id, user_id, paid) values (made, me, 0)
  on conflict do nothing;

  return made;
end;
$$;

grant execute on function public.create_avatar_item to authenticated;

commit;
