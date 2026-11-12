/*
 * Asking a friend to come and play, from inside the World.
 *
 * The Launcher built the card and the friends list behind it, and then could
 * not land the row: `notifications` has no insert policy at all, on purpose -
 * every notification on Kobblon is written by a trigger or by a function
 * that holds the rights. So this is that function, and it is the only way
 * an invite is ever written.
 *
 * What it refuses, and why each one is here rather than in the Launcher:
 *
 *   - not signed in, or signed in as a guest. A guest has no friends list
 *     and an invite from one cannot be answered.
 *   - suspended. Somebody serving a suspension does not get to reach into
 *     other people's bells.
 *   - inviting yourself.
 *   - not friends. This is an invite to a friend, which is what the card
 *     says it is; anything wider is an unsolicited message with a World
 *     attached to it.
 *   - a World that `world_to_play` would not hand back - unpublished,
 *     removed. Inviting somebody to a door they cannot open is a worse
 *     outcome than being told no here.
 *   - the same person, the same World, inside ten minutes.
 *
 * All of them are client-side checks in the Launcher too, and none of them
 * is trusted from there: the card decides what to grey out, this decides
 * what happens.
 *
 * Blocking and ignoring are deliberately **not** checked here. 0062's
 * `notifications_guard` already drops a row from somebody the reader has
 * blocked or ignored, and it drops it quietly. Doing it again here, with a
 * refusal the inviter can read, would tell somebody they have been blocked -
 * which is the one thing a block must never announce. So the invite is
 * accepted, the trigger eats it, and the inviter is told it was sent. That
 * is the intended behaviour and not an oversight.
 */

begin;

set search_path = public, extensions;

-- The kind has to exist before anything writes it. The constraint is a
-- check and not an enum, so this is safe in the same transaction as the
-- function below; an enum value would have had to be its own migration.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind = any (array[
    'friend_request', 'friend_accepted',
    'best_friend_request', 'best_friend_accepted',
    'space_like', 'space_visit', 'message', 'system',
    'event_started', 'world_updated', 'content_removed',
    'forum_reply', 'forum_staff', 'world_invite'
  ]));

create or replace function public.invite_to_world(world uuid, who uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me uuid := auth.uid();
  world_name text;
begin
  if me is null then
    raise exception 'You have to be signed in to invite somebody.';
  end if;

  if exists (select 1 from public.profiles p where p.id = me and p.is_guest) then
    raise exception 'A guest account cannot invite anybody.';
  end if;

  if exists (select 1 from public.profiles p where p.id = me and p.is_suspended) then
    raise exception 'You cannot invite anybody while your account is suspended.';
  end if;

  if who = me then
    raise exception 'You are already here.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = who) then
    raise exception 'That account does not exist.';
  end if;

  if not public.are_friends(me, who) then
    raise exception 'You can only invite your friends.';
  end if;

  select w.name into world_name
    from public.worlds w
   where w.id = world and w.is_published and not w.is_removed;

  if world_name is null then
    raise exception 'That World is not open to play.';
  end if;

  /*
   * One invite per friend per World per ten minutes.
   *
   * Not a general rate limit on the account, which would stop somebody
   * filling a World with six friends in a minute - that is the feature
   * working. This stops the one thing that is not: the same card pressed
   * at the same person over and over.
   */
  if exists (
    select 1 from public.notifications n
     where n.kind = 'world_invite'
       and n.actor_id = me
       and n.user_id = who
       and n.world_id = world
       and n.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'You have already invited them. Give them a minute.';
  end if;

  insert into public.notifications (user_id, kind, actor_id, world_id, body)
  values (who, 'world_invite', me, world, world_name);
end;
$$;

revoke all on function public.invite_to_world(uuid, uuid) from public;
grant execute on function public.invite_to_world(uuid, uuid) to authenticated;

commit;
