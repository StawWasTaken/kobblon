begin;

/*
 * A visit is somebody arriving in a World, not a number anybody can type.
 *
 * `world_started(uuid)` has been there since 0074. It does one thing -
 * `update worlds set visit_count = visit_count + 1` - it is `security
 * definer`, and it was granted to PUBLIC: no account needed, no check that
 * the caller is anywhere near that World, no limit on how often. Anybody
 * who can reach the API could sit in a loop and run any published World's
 * visit count up as far as they liked.
 *
 * That number is not decoration. It orders `trending`, which is what the
 * front of Discover and the top of Home are built from, it is one of the
 * two leaderboards in 0274, and it is half the ranking in 0056. So the one
 * forgeable number on the platform is the one that decides what everybody
 * is shown.
 *
 * Nothing on the website calls it. The door that is actually walked
 * through is `join_world_server`, which already proves who the caller is,
 * that they may play, that the server is real and open, and that there is
 * room - and already records the visit in `world_visits`. The count
 * belongs there, beside the row it is counting.
 *
 * So:
 *
 *   * `join_world_server` moves `visit_count`, once per arrival.
 *   * `world_started` keeps existing and does nothing. The applications
 *     may still be calling it; a function that disappears is a crash in
 *     the Launcher, and a function that quietly stops counting is exactly
 *     what is wanted while they drop the call. Round 344 tells them.
 *
 * `visit_count` as it stands is left alone. Some of it is real arrivals
 * and some of it may not be, and there is no way from here to tell which;
 * rewriting everybody's numbers on a guess would be a worse lie than the
 * one being fixed.
 */

create or replace function public.world_started(wanted uuid)
returns void
language plpgsql
set search_path = public as $$
begin
  /*
   * Deliberately empty. See 0345: this used to be the visit counter and
   * anybody could call it. `join_world_server` counts arrivals now.
   */
  perform wanted;
end $$;

create or replace function public.experience_started(wanted uuid)
returns void
language plpgsql
set search_path = public as $$
begin
  perform wanted;
end $$;

/*
 * Not `security definer` any more either, which is the part that matters
 * if one of them is ever given a body again by somebody reading only the
 * first line of it.
 */
/*
 * Both of them, and `anon` by name.
 *
 * `revoke ... from public` on its own leaves `anon` holding execute,
 * because 0074 granted it to `anon` outright as well as to PUBLIC - and
 * the check for this read `true` until the revoke named it. Two grants,
 * two revokes; the one that is easy to forget is the one that mattered,
 * since `anon` is the role a visitor with no account is.
 */
revoke all on function public.world_started(uuid) from public, anon, authenticated;
revoke all on function public.experience_started(uuid) from public, anon, authenticated;
grant execute on function public.world_started(uuid) to authenticated;
grant execute on function public.experience_started(uuid) to authenticated;

/**
 * The arrival door, counting the arrival.
 *
 * 0334's body, with one thing added at the end. Retyped in full rather
 * than patched, because rewriting one of these from memory is how a check
 * quietly goes missing.
 */
create or replace function public.join_world_server(server uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  room record;
  how_many integer;
  already boolean;
begin
  if me is null then
    raise exception 'Sign in to play.';
  end if;

  if not public.may_play(me) then
    raise exception 'Lost connection.';
  end if;

  select * into room from public.world_servers where id = server and closed_at is null;
  if not found then
    raise exception 'That server is not running.';
  end if;

  select count(*) into how_many
    from public.world_players
   where server_id = server
     and user_id <> me
     and last_seen > now() - public.stale_after();

  if how_many >= room.capacity then
    raise exception 'That server is full.';
  end if;

  /*
   * Asked before the row is written, and of the World rather than of this
   * server: somebody hopping between two rooms of the same World has not
   * arrived twice, and a client that calls this again on a reconnect has
   * not arrived at all. Read first, because the insert under it is what
   * makes the answer false.
   */
  already := exists (
    select 1
      from public.world_players p
      join public.world_servers s on s.id = p.server_id
     where p.user_id = me
       and s.world_id = room.world_id
       and p.last_seen > now() - public.stale_after()
  );

  insert into public.world_players (server_id, user_id, last_seen)
  values (server, me, clock_timestamp())
  on conflict (server_id, user_id) do update set last_seen = clock_timestamp();

  delete from public.world_players
   where user_id = me and server_id <> server;

  insert into public.world_visits (world_id, user_id)
  values (room.world_id, me)
  on conflict do nothing;

  if not already then
    update public.worlds
       set visit_count = visit_count + 1
     where id = room.world_id;
  end if;
end;
$$;

commit;
