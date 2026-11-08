begin;

/*
 * Playing is something an account may be refused.
 *
 * Staw described the Launcher's side of a ban: you lose connection, with no
 * explanation; Rejoin gives you the same message again; Leave shows you the
 * card. That flow only means anything if the server is the thing saying no.
 * `join_world_server` was not: it asked whether you were signed in, whether
 * the server was running and whether it was full, and then let a suspended
 * account straight back in. Every comment on the website says "whether this
 * account may be in that room is decided by `join_world_server` over HTTPS",
 * and for standing that was not true.
 *
 * This is the fourth trap in its usual coat. The careful part had been
 * written - a ladder, a ban, cards, appeals, a whole console - and the one
 * door a player actually walks through had no lock on it. A client refusing
 * on its own is not a lock: it is a client-side permission check, and a
 * modified one simply does not refuse.
 *
 * Two doors, because there are two:
 *
 *   * `join_world_server`, which is asked once when you arrive. It refuses.
 *   * `still_in_world`, the heartbeat, which until now returned nothing and
 *     so could never tell a player who was suspended mid-game to leave.
 *     Somebody banned while playing stayed playing until they chose to
 *     stop. It returns a boolean now, and false means go.
 *
 * Guarding only the first would be the same mistake one layer in: the join
 * is locked and the session that is already open runs for ever.
 *
 * What it does not do is explain itself. The message is the same four words
 * whether you are suspended, banned, or the server went away, because the
 * player is told what happened by the card on Leave and by the website,
 * where there is room to say it properly and an appeal to press. A
 * disconnect reason is not the place to litigate somebody's account.
 */

-- ------------------------------------------- is this account allowed to play

/**
 * Whether an account may be in a World at all.
 *
 * `is_suspended` is the one question every reader asks - 0215 is explicit
 * about that, and `suspended_until` is for display. But nothing here is a
 * scheduler, so a suspension whose time is up stays set until something
 * clears it, and "something" must not be a staff page nobody has opened.
 * So this heals the one row it is about before reading it: a lapsed
 * suspension lets you play again at the moment it lapses, rather than at
 * the moment a moderator next signs in.
 *
 * Its own function because two doors ask it and they must not drift. A ban
 * is permanent and is checked first, since a banned account can also be
 * carrying a suspension and the answer is the same either way.
 */
create or replace function public.may_play(who uuid)
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  banned boolean;
  held boolean;
begin
  if who is null then return false; end if;

  update public.profiles
     set is_suspended = false, suspended_until = null
   where id = who
     and is_suspended
     and suspended_until is not null
     and suspended_until <= now();

  select coalesce(is_banned, false), coalesce(is_suspended, false)
    into banned, held
    from public.profiles where id = who;

  if not found then return false; end if;
  return not banned and not held;
end $$;

/*
 * No client may call this, and that is the whole grant list.
 *
 * It takes an account rather than reading `auth.uid()`, because the two
 * doors have already established who is asking and a function that asks
 * again is a function that can disagree with them. But a `security definer`
 * function taking somebody else's id, handed to `authenticated`, is a way
 * to ask the database whether a stranger is suspended - one call per name,
 * for anybody with a token. Nothing needs it: both callers are
 * `security definer` themselves and so reach it as the owner.
 */
revoke all on function public.may_play(uuid) from public;
revoke all on function public.may_play(uuid) from authenticated;

-- --------------------------------------------------------- the arrival door

create or replace function public.join_world_server(server uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  room record;
  how_many integer;
begin
  if me is null then
    raise exception 'Sign in to play.';
  end if;

  /*
   * Before the server is even looked at. Asked of the account rather than
   * of anything the caller passed in, so there is nothing to tamper with:
   * the only account this can admit is the one holding the token.
   */
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

  insert into public.world_players (server_id, user_id, last_seen)
  values (server, me, clock_timestamp())
  on conflict (server_id, user_id) do update set last_seen = clock_timestamp();

  delete from public.world_players
   where user_id = me and server_id <> server;

  insert into public.world_visits (world_id, user_id)
  values (room.world_id, me)
  on conflict do nothing;
end;
$$;

-- ------------------------------------------------------- the staying door

/*
 * The return type changes, and Postgres will not replace a function with a
 * different one, so it goes first. Nothing on the website calls it; the
 * applications are the only caller and round 81 tells them.
 */
drop function if exists public.still_in_world(uuid);

/**
 * Said every so often while playing. False means stop playing.
 *
 * The heartbeat is the right place for this and not a new call: it already
 * runs, it already proves the player is there, and a sanction landing
 * mid-session has to reach somebody who is not asking any other question.
 * A client that ignores the false keeps its row warm and gets nothing for
 * it - every other door is guarded separately, and a row in
 * `world_players` is not permission to do anything.
 *
 * It clears the row on the way out, so a suspended player stops being
 * counted in the server and stops being shown to their friends rather than
 * lingering until the stale sweep gets to them.
 */
create or replace function public.still_in_world(server uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then return false; end if;

  if not public.may_play(me) then
    delete from public.world_players where user_id = me;
    return false;
  end if;

  update public.world_players
     set last_seen = clock_timestamp()
   where server_id = server and user_id = me;

  return true;
end $$;

revoke all on function public.still_in_world(uuid) from public;
grant execute on function public.still_in_world(uuid) to authenticated;

commit;
