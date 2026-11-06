begin;

/*
 * The World somebody is in, with its picture.
 *
 * Staw asked for the "Playing" line on a profile to be moved under the
 * buttons and made into something worth looking at, and for the friend
 * hover card to say "is playing" the way the screenshots he sent do - and
 * both of those screenshots are a picture of the game with its name beside
 * it. `where_they_are` gives the name and the counts and nothing to look
 * at, so the page could draw a panel with a hole in it or ask for the
 * World row separately, which is a second round trip per face on a list of
 * sixty to fetch a column the first query already had in its hand.
 *
 * So one column more: the cover the World already stores.
 *
 * `create or replace` cannot do this. A function that gains a column is a
 * function with a new return type, and Postgres refuses that outright
 * ("cannot change return type of existing function"), so it is dropped
 * first. Nothing else changes: the same private/closed/unpublished rows
 * are left out, for the same reasons 0317 gives.
 */
drop function if exists public.where_they_are(uuid[]);

create function public.where_they_are(who uuid[])
returns table (
  user_id uuid,
  world_id uuid,
  world_name text,
  world_content_id bigint,
  world_cover text,
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
         w.cover_url,
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

grant execute on function public.where_they_are(uuid[]) to anon, authenticated;

commit;
