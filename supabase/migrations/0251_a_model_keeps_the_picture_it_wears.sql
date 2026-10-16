begin;

-- The texture a model already wears, which this function forgot again.
--
-- Staw: "for some reason the textures of the hairs dont appear". Nothing to
-- do with hair. Uploading a model and a picture together makes one Decal and
-- attaches it to the **mesh row**, and the page then creates the item with
-- no texture named, because the mesh already wears one. 0130 added the
-- fallback that reads it back: no texture named and a model given, take the
-- model's.
--
-- 0247 rewrote this function to carry a body part's shape and copied every
-- line of it except that one. So since 0247 every accessory and every
-- haircut made the ordinary way - upload the model, upload its picture -
-- has been stored with `texture_id` null and has rendered grey. The model
-- was textured the whole time; the item simply never looked.
--
-- The lesson, and it is one this project keeps paying for: a function
-- rewritten to add a column is a function rewritten, and the thing to check
-- is not that the new column works. It is that every old one still does.
--
-- Below: the fallback, and a backfill for everything made without it.

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
  -- The texture it ends up with: the one named, or the one its model wears.
  wears uuid := texture;
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

  /*
   * The fallback, after the check above has established the model is theirs
   * - so this cannot be used to point at somebody else's Decal through a
   * mesh they do not own.
   *
   * It is 0130's and it was lost in 0247, which rewrote this function to
   * carry a body part's shape and copied every line but this one.
   */
  if wears is null and model is not null then
    select a.texture_id into wears from public.assets a where a.id = model;
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
    coalesce(cost, 0), picture, model, wears,
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
  text, text, text, text, integer, text, uuid, uuid, uuid, text
) to authenticated;

/*
 * And the ones already made grey.
 *
 * Only where the item names no texture at all and its own model wears one,
 * so nothing anybody chose on purpose is overwritten - including a maker who
 * deliberately left a model bare, who does not have a mesh with a Decal on
 * it either.
 */
update public.avatar_items i
   set texture_id = a.texture_id, updated_at = now()
  from public.assets a
 where a.id = i.mesh_id
   and i.texture_id is null
   and a.texture_id is not null;

commit;
