/*
 * Two more answers that belong to the person rather than to the page:
 * who may see which World you are in, and who may walk into it after you.
 *
 * Both are friends only to begin with, like the thought. Staw asked for
 * everything on this list to default that way, and a default that opens
 * somebody up is a default nobody chose.
 *
 * Where they are enforced, and why there: `where_they_are` is the one door
 * that hands out a person's whereabouts, and the `server_id` it returns is
 * the thing you need to walk in after them. So the two settings land on the
 * same function - a stranger gets no row at all when the first is closed,
 * and a row without a `server_id` when only the second is. Nothing is left
 * for a page to decide, which is the whole point of putting it here.
 */
begin;

alter table public.profiles add column if not exists where_privacy text not null default 'friends';
alter table public.profiles drop constraint if exists profiles_where_privacy_check;
alter table public.profiles add constraint profiles_where_privacy_check
  check (where_privacy in ('everyone', 'friends'));

alter table public.profiles add column if not exists join_privacy text not null default 'friends';
alter table public.profiles drop constraint if exists profiles_join_privacy_check;
alter table public.profiles add constraint profiles_join_privacy_check
  check (join_privacy in ('everyone', 'friends'));

/* The shape is 0329's, picture and all; only the two tests below are new. */
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
         /*
          * The way in, which only goes to somebody allowed to take it.
          * Yourself always; a friend when it is friends; anybody when it
          * is everyone.
          */
         case when me.may_join then s.id end,
         (select count(*)::integer
            from public.world_players q
           where q.server_id = s.id
             and q.last_seen > now() - public.stale_after()),
         s.capacity,
         f.joined_at
    from fresh f
    join public.world_servers s on s.id = f.server_id
    join public.worlds w on w.id = s.world_id
    cross join lateral (
      select
        pr.where_privacy = 'everyone'
          or f.user_id = auth.uid()
          or public.are_friends(auth.uid(), f.user_id) as may_see,
        pr.join_privacy = 'everyone'
          or f.user_id = auth.uid()
          or public.are_friends(auth.uid(), f.user_id) as may_join
        from public.profiles pr where pr.id = f.user_id
    ) me
   where s.closed_at is null
     and s.owner_id is null
     and w.is_published
     and not w.is_removed
     and me.may_see;
$$;

grant execute on function public.where_they_are(uuid[]) to anon, authenticated;

commit;
