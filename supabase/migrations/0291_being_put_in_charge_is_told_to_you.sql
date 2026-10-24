begin;

-- Being put in charge of a board is told to you
-- -----------------------------------------------------------------------
--
-- 0289 hands somebody a board and says nothing to them about it. The only
-- way to find out was to open a topic on that board and notice buttons
-- that were not there yesterday, which is not how anybody learns they have
-- been given a job.
--
-- A notification, the same bell everything else on the platform rings, and
-- one when it is taken away too. The second one matters more than it
-- looks: somebody who is not told they have been taken off a board finds
-- out by pressing a button and being refused, which reads as the site
-- being broken rather than as a decision somebody made.
--
-- `notifications.kind` is a check constraint rather than an enum, so
-- widening it here is safe. An enum could not be added to and used in one
-- transaction, which this project has already been caught by once.

set search_path = public, extensions;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind = any (array[
    'friend_request', 'friend_accepted',
    'best_friend_request', 'best_friend_accepted',
    'space_like', 'space_visit', 'message', 'system',
    'event_started', 'world_updated', 'content_removed',
    'forum_reply', 'forum_staff'
  ]));

/**
 * Putting somebody in charge of a board, or taking them off it, and
 * telling them so.
 *
 * 0289's body with the bell added. The notification is written in the same
 * statement run as the row, so there is no case where somebody is staff on
 * a board and was never told, nor one where they are told and are not.
 *
 * Nothing is sent when nothing changed: appointing somebody who is already
 * in charge is a no-op on the table and must be a no-op on their bell too,
 * or an admin opening the dialog twice has told them twice.
 */
create or replace function public.set_forum_board_staff(
  in_category text, in_user uuid, in_on boolean
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  am_admin boolean;
  board_name text;
  changed integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  select coalesce(is_admin or is_superadmin, false) into am_admin
    from public.profiles where id = auth.uid();
  if not coalesce(am_admin, false) then
    raise exception 'Only a Kobblon admin can put somebody in charge of a board.';
  end if;

  select name into board_name from public.forum_categories where slug = in_category;
  if board_name is null then raise exception 'There is no such category.'; end if;
  if not exists (select 1 from public.profiles where id = in_user) then
    raise exception 'There is no such account.';
  end if;

  if in_on then
    insert into public.forum_category_staff (category, user_id, given_by)
    values (in_category, in_user, auth.uid())
    on conflict (category, user_id) do nothing;
    get diagnostics changed = row_count;

    if changed > 0 then
      insert into public.notifications (user_id, kind, actor_id, body, link)
      values (in_user, 'forum_staff', auth.uid(),
              'put you in charge of ' || board_name
                || ' on the forum. You can pin, close and mark topics there.',
              '/forum/c/' || in_category);
    end if;
  else
    delete from public.forum_category_staff
     where category = in_category and user_id = in_user;
    get diagnostics changed = row_count;

    if changed > 0 then
      insert into public.notifications (user_id, kind, actor_id, body, link)
      values (in_user, 'forum_staff', auth.uid(),
              'took you off ' || board_name || ' on the forum.',
              '/forum/c/' || in_category);
    end if;
  end if;
end $$;

grant execute on function public.set_forum_board_staff to authenticated;

commit;
