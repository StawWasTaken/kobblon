begin;

/*
 * Taking an outfit down, the way everything else on the Catalog can be.
 *
 * Staw, on making the asset pages the same as each other: "and to take
 * down stuff". An item has `remove_avatar_item` and a moderator has had
 * that button since 0129. An outfit had only `removeOutfit`, which is the
 * owner updating their own row through the policy - so a listed outfit
 * with a name nobody should read could be reported, and then nothing could
 * be done about it from the page the report came from.
 *
 * Why this is not just the owner's update with a wider policy: an owner
 * deleting their own look and a moderator taking one down are two different
 * events. One is housekeeping. The other has a reason, goes in the log,
 * and tells the person it happened - and a policy cannot do any of those
 * three.
 *
 * Nothing is refunded, and that is deliberate rather than an omission. An
 * outfit is an arrangement of items somebody already owns; buying one buys
 * the pieces, and the pieces are still theirs. There is nothing here to
 * give back, which is exactly why this is shorter than
 * `remove_avatar_item`.
 */
create or replace function public.take_down_outfit(target uuid, note text default null)
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  one public.outfits;
  me uuid := auth.uid();
begin
  if not public.is_moderator() then
    raise exception 'That is not yours to take down.';
  end if;

  select * into one from public.outfits where id = target;
  if one.id is null then
    raise exception 'There is no outfit with that number.';
  end if;
  if one.is_removed then
    return false;
  end if;

  update public.outfits
     set is_removed = true, is_public = false, updated_at = now()
   where id = target;

  perform public.write_admin_log(
    'outfit_takedown', one.owner_id,
    jsonb_build_object(
      'outfit', one.content_id, 'name', one.name,
      'why', nullif(btrim(coalesce(note, '')), '')));

  /*
   * Told, and told why. A thing that disappears without a word is the
   * version of this that makes somebody write to support asking whether
   * the site is broken.
   */
  insert into public.notifications (user_id, kind, body)
  values (one.owner_id, 'system',
          left('Your outfit "' || one.name || '" has been taken down.'
               || coalesce(' ' || nullif(btrim(coalesce(note, '')), ''), ''), 300));

  return true;
end $$;

revoke all on function public.take_down_outfit(uuid, text) from public;
grant execute on function public.take_down_outfit(uuid, text) to authenticated;

commit;
