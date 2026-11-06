begin;

/*
 * Where somebody is, right now.
 *
 * Staw asked for three things off three Roblox screenshots: an activity
 * line on a profile that says which World you are in, a friend hover card
 * that names it and offers Join, and a Servers tab on a World listing each
 * running copy with how many are in it and who.
 *
 * Two of those three already exist. `0165` built the roster - `world_servers`
 * and `world_players`, written only through functions, read by anybody,
 * with presence as a claim that expires rather than a join and a leave that
 * nobody can be relied on to send. `servers_of` is the Servers tab and
 * `playing_now` is the count. **There is no second table to design here**,
 * and designing one would be the same mistake as two names for one mesh.
 *
 * What is missing is the other direction. Everything in 0165 reads
 * "who is in this World"; a profile and a hover card ask "where is this
 * person", and answering that by listing every server of every World and
 * looking for a face is a page that reads the whole roster to draw one line.
 *
 * So: one function, taking the people a screen is already drawing and
 * giving back the one row each that says where they are.
 *
 * It takes an array rather than one id because every caller has a list -
 * a friends list, a hover card lit from a list, a profile which is a list
 * of one. One round trip for the screen, not one per face.
 */

/*
 * Private servers are left out, exactly as `servers_of` leaves them out.
 *
 * This is the part worth saying out loud, because it is the one that would
 * leak something. A private server is somebody's own room, and the fact
 * that an account is in one is not a thing strangers are owed - so a person
 * in a private server reads here as not playing. That is a deliberate lie
 * of omission and it is the right one: the alternative is a hover card that
 * tells you a stranger is in a room you cannot see, which is worse than
 * silence.
 *
 * Unpublished and removed Worlds are left out for the same reason - the
 * name of a World nobody may open is not public.
 */
create or replace function public.where_they_are(who uuid[])
returns table (
  user_id uuid,
  world_id uuid,
  world_name text,
  world_content_id bigint,
  server_id uuid,
  how_many integer,
  capacity integer,
  since timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  with fresh as (
    select p.user_id, p.server_id, p.joined_at
      from public.world_players p
     where p.user_id = any(who)
       and p.last_seen > now() - public.stale_after()
  )
  select f.user_id,
         w.id,
         w.name,
         w.content_id,
         s.id,
         (select count(*)::integer
            from public.world_players q
           where q.server_id = s.id
             and q.last_seen > now() - public.stale_after()),
         s.capacity,
         f.joined_at
    from fresh f
    join public.world_servers s on s.id = f.server_id
    join public.worlds w on w.id = s.world_id
   where s.closed_at is null
     and s.owner_id is null
     and w.is_published
     and not w.is_removed;
$$;

/*
 * Readable by anybody, like the rest of 0165. Who is in a public World is
 * public the same way a profile is, and the function has already dropped
 * everything that is not.
 */
grant execute on function public.where_they_are(uuid[]) to anon, authenticated;

/*
 * The index the lookup wants.
 *
 * `world_players` is keyed on (server_id, user_id), so a query that starts
 * from the person rather than the room has no index to stand on and scans
 * the table - which is fine with eleven players in it and is not fine
 * later. `last_seen` rides along so the freshness test is answered out of
 * the index rather than by going to the row.
 */
create index if not exists world_players_by_person
  on public.world_players (user_id, last_seen desc);

commit;
