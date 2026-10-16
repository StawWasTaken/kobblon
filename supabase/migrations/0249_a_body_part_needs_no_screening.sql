begin;

/*
 * A body part can actually be worn, and it is a Girl Torso.
 *
 * Staw, on the one made in Create: "you cant wear body parts for some
 * reason". It was screening. Every kind lands `pending` and
 * `wear_avatar_item` refuses anything pending - correctly, because walking
 * around in something nobody has looked at is the thing that rule exists
 * for. A body part is the one kind where there is nothing to look at: no
 * file, no texture, no model, and a shape that is Kobblon's own code. So it
 * is approved on the way in, and nothing else is.
 *
 * The seeded one was already approved, which is why it looked like the
 * database was fine and the page was broken.
 *
 * And the name. "Waisted Torso" was me naming the shape; Staw: "we really
 * want to call this a girl torso". It is his platform and his word for it.
 */

drop function if exists public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid, text);

create function public.create_avatar_item(
  item_kind text,
  item_slot text,
  item_name text,
  about text,
  cost integer default null,
  picture text default null,
  model uuid default null,
  texture uuid default null,
  maker uuid default null,
  form text default null
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

  if maker is not null and not public.community_can(maker, 'can_manage_community') then
    raise exception 'You cannot make things for that Community.';
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
  elsif item_kind = 'bodypart' then
    -- A part goes where that part of the body is, and nowhere else.
    if item_slot not in ('torso') then
      raise exception 'There is no part of the body there yet.';
    end if;
    if coalesce(btrim(coalesce(form, '')), '') = '' then
      raise exception 'A body part is a shape, and no shape was given.';
    end if;
  elsif item_slot is distinct from item_kind then
    raise exception 'A % is always worn as a %.', item_kind, item_kind;
  end if;

  if cost is not null and cost < rule.least_price then
    raise exception 'A % sells for at least % Brix.', item_kind, rule.least_price;
  end if;

  select * into verdict from public.screen_text(
    coalesce(item_name, '') || ' ' || coalesce(about, ''));
  if verdict.decision = 'block' then
    raise exception 'That name or description is not allowed here.';
  end if;

  if model is not null and not exists (
    select 1 from public.assets a
     where a.id = model
       and (a.creator_id = me
            or (maker is not null and a.community_id = maker))
  ) then
    raise exception 'That model is not yours to use.';
  end if;

  if rule.upload_cost > 0 then
    if maker is null then
      select pixels into balance from public.profiles where id = me;
      if balance < rule.upload_cost then
        raise exception 'Making a % costs % Brix and you have %.',
          item_kind, rule.upload_cost, balance;
      end if;
      perform public.move_pixels(me, -rule.upload_cost, 'listing_fee',
        'Made a ' || item_kind);
    else
      select funds into balance from public.communities where id = maker for update;
      if coalesce(balance, 0) < rule.upload_cost then
        raise exception 'Making a % costs % Brix and this Community has %.',
          item_kind, rule.upload_cost, coalesce(balance, 0);
      end if;
      update public.communities set funds = funds - rule.upload_cost where id = maker;
      perform public.log_community(maker, 'made', item_name);
    end if;

    if house is not null and house <> me then
      perform public.move_pixels(house, rule.upload_cost, 'platform_fee',
        'Upload fee for a ' || item_kind);
    end if;
  end if;

  insert into public.avatar_items (
    creator_id, community_id, kind, slot, name, description, price,
    image_path, mesh_id, texture_id, shape, status, is_public
  ) values (
    me, maker, item_kind, item_slot, btrim(item_name), nullif(btrim(coalesce(about, '')), ''),
    coalesce(cost, 0), picture, model, texture,
    case when item_kind = 'bodypart' then btrim(form) else null end,
    /*
     * A body part skips screening, and only a body part.
     *
     * Screening looks at what somebody uploaded, and a body part uploads
     * nothing: the geometry is the engine's, already in the build, and the
     * name and the description have been through `screen_text` ten lines
     * up. So the one thing left to look at is a shape Kobblon wrote - and
     * meanwhile the item sat pending, which `wear_avatar_item` refuses, so
     * the house could make a body part and not put it on. Staw: "you cant
     * wear body parts for some reason".
     *
     * Still not on sale on the way in. Listing it is a separate press for
     * every kind and that is not what was in the way.
     */
    case when item_kind = 'bodypart' then 'approved' else 'pending' end::public.moderation_status,
    false
  ) returning id into made;

  insert into public.avatar_owned (item_id, user_id) values (made, me)
  on conflict do nothing;

  return made;
end;
$$;

revoke all on function public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid, text) from public;
grant execute on function public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid, text) to authenticated;

/*
 * The name, on the one 0248 seeded and on any body part already made and
 * stuck pending. The first is a rename; the second is the fix above reaching
 * backwards, because a row that was made yesterday is as unwearable as one
 * made tomorrow and nobody is going to go and screen it.
 */
update public.avatar_items
   set name = 'Girl Torso', updated_at = now()
 where shape = 'torso-girl'
   and name = 'Waisted Torso';

update public.avatar_items
   set status = 'approved', updated_at = now()
 where kind = 'bodypart' and status = 'pending';

commit;
