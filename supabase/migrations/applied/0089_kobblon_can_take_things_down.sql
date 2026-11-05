-- Taking something down.
--
-- Kobblon can remove any piece of user content, and the person it belonged
-- to is told, with the reason, in their notifications and their mail. Both:
-- a notification is seen, and mail is what is still there in a week when
-- somebody asks what happened.
--
-- One function for every kind of thing rather than one per kind, because a
-- moderator should not have to know which table a report is about, and
-- because the part that matters -- telling the person -- would otherwise be
-- written five times and forgotten once.
--
-- Nothing is deleted. Removed content stops being listed and stops
-- answering, and the row stays so an appeal has something to point at and
-- so the same thing cannot be quietly put back by somebody else.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'space_like', 'space_visit',
                  'message', 'system', 'event_started', 'world_updated',
                  'content_removed'));

/**
 * Removing one thing, and telling whoever made it.
 *
 * `what` is the kind of thing and `which` is its id. The reason is shown to
 * the person: "your thing was removed" with no reason is how a platform
 * teaches people that moderation is arbitrary.
 */
create or replace function public.take_down(what text, which uuid, reason text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  owner uuid;
  title text;
  said text := btrim(coalesce(reason, ''));
begin
  if not (public.is_kobblon() or public.is_moderator()) then
    raise exception 'That is not yours to take down.';
  end if;

  if char_length(said) < 3 then
    raise exception 'Say why. A removal with no reason teaches people that this is arbitrary.';
  end if;

  if what = 'asset' then
    update public.assets set status = 'removed'
     where id = which returning creator_id, name into owner, title;

  elsif what = 'world' then
    update public.worlds set is_removed = true, is_published = false
     where id = which returning owner_id, name into owner, title;

  elsif what = 'space' then
    update public.spaces set is_removed = true, is_published = false
     where id = which returning owner_id, name into owner, title;

  elsif what = 'style' then
    update public.style_items set is_removed = true, is_public = false
     where id = which returning creator_id, name into owner, title;

  elsif what = 'face' then
    /* Kobblon's own, so there is nobody to tell, but it still comes down. */
    update public.faces set is_removed = true, is_public = false
     where id = which returning null::uuid, name into owner, title;

  else
    raise exception 'Kobblon does not know how to take down a %.', what;
  end if;

  if title is null then
    raise exception 'There is no % with that number.', what;
  end if;

  if owner is null or owner = me then
    return; -- nothing to tell, or telling yourself
  end if;

  insert into public.notifications (user_id, kind, actor_id, body)
  values (owner, 'content_removed', me,
          left(title || ' was taken down. ' || said, 300));

  perform public.send_mail(
    owner,
    'moderation',
    title || ' was taken down',
    said || E'\n\nIf you think this is wrong, you can appeal from your account standing.',
    '/standing'
  );
end $$;

revoke all on function public.take_down(text, uuid, text) from public, anon;
grant execute on function public.take_down(text, uuid, text) to authenticated;

/**
 * Putting it back, for when a removal was wrong.
 *
 * An appeal that is upheld has to be able to undo the thing it was about,
 * and a moderator who cannot undo their own mistake makes fewer of them the
 * wrong way.
 */
create or replace function public.put_back(what text, which uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare owner uuid; title text;
begin
  if not (public.is_kobblon() or public.is_moderator()) then
    raise exception 'That is not yours to put back.';
  end if;

  if what = 'asset' then
    update public.assets set status = 'approved'
     where id = which returning creator_id, name into owner, title;
  elsif what = 'world' then
    update public.worlds set is_removed = false
     where id = which returning owner_id, name into owner, title;
  elsif what = 'space' then
    update public.spaces set is_removed = false
     where id = which returning owner_id, name into owner, title;
  elsif what = 'style' then
    update public.style_items set is_removed = false
     where id = which returning creator_id, name into owner, title;
  elsif what = 'face' then
    update public.faces set is_removed = false
     where id = which returning null::uuid, name into owner, title;
  else
    raise exception 'Kobblon does not know how to put back a %.', what;
  end if;

  if title is null then
    raise exception 'There is no % with that number.', what;
  end if;

  /*
   * Deliberately not published again. Coming back should be the owner's
   * decision: a World somebody unpublished themselves while this was going
   * on must not be shoved back in front of people.
   */
  if owner is not null then
    perform public.send_mail(
      owner, 'moderation', title || ' is back',
      'That removal has been undone. If it was published before, publish it again when you are ready.',
      null
    );
  end if;
end $$;

revoke all on function public.put_back(text, uuid) from public, anon;
grant execute on function public.put_back(text, uuid) to authenticated;
