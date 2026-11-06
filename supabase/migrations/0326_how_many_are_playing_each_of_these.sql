begin;

/*
 * How many people are in each of several Worlds, in one question.
 *
 * Staw, of the Worlds drawn on Discover, the homepage and everywhere else:
 * "instead of showing the ratio like-dislike and visits, it must be ratio
 * like-dislike And actual players (actual number of people playing actually
 * in all servers)".
 *
 * `playing_now` already answers that for one World, and a shelf of twelve
 * cards asking it twelve times is twelve round trips to draw one row. This
 * is the same count for a list: hand it the Worlds, get back the ones that
 * have anybody in them.
 *
 * **It answers for the Worlds that have somebody in them, and leaves the
 * rest out.** A caller reads a missing World as nobody, which is what a
 * missing row means here and keeps the answer small - on a quiet platform
 * most of the list is zero.
 *
 * The rules are `playing_now`'s, to the letter, because two numbers for the
 * same thing that disagree is worse than one slow number: a player counts
 * when their row is fresher than `stale_after()` and the server they are in
 * has not closed. `security definer` for the same reason it is there -
 * `world_players` is not a table strangers may read row by row, and a count
 * of heads is not the same as a list of who.
 */
create or replace function public.playing_in(wanted uuid[])
returns table (world_id uuid, how_many integer)
language sql stable security definer set search_path = public, extensions as $$
  select s.world_id, count(*)::integer
    from public.world_players p
    join public.world_servers s on s.id = p.server_id
   where s.world_id = any(wanted)
     and s.closed_at is null
     and p.last_seen > now() - public.stale_after()
   group by s.world_id;
$$;

grant execute on function public.playing_in(uuid[]) to anon, authenticated;

commit;
