/*
 * Where a server is.
 *
 * The other half of what Staw asked Discover for: a device filter and a
 * location filter. The device is a property of the World and lives on it
 * (0341). Where you would be playing is not a property of the World at all
 * - it is a property of the machine holding the server - so it lives here,
 * on `world_servers`, and the Launcher is what knows it.
 *
 * Regions rather than countries, and eight of them. A country list is two
 * hundred rows of which one hundred and ninety-odd can never have a server
 * in them, and a filter whose options mostly return nothing is a filter
 * that lies. These are the places a server can actually be.
 *
 * Null means a server that has not said. Every server open today is null,
 * and that is why the website only offers the regions that are actually
 * being reported rather than the eight in the check: until the Launcher
 * sends one, the control has nothing to offer and says so, which is true.
 * The day it starts sending, the control fills itself.
 */
begin;

alter table public.world_servers
  add column if not exists region text;

alter table public.world_servers drop constraint if exists world_servers_region_known;
alter table public.world_servers add constraint world_servers_region_known check (
  region is null or region in (
    'eu-west', 'eu-central', 'na-east', 'na-west',
    'south-america', 'asia', 'oceania', 'africa'
  )
);

create index if not exists world_servers_region_idx
  on public.world_servers (region)
  where closed_at is null and region is not null;

/*
 * `open_world_server` gains the region, and the old three-argument version
 * is dropped rather than left beside it: a default on the new parameter
 * would make a three-argument call ambiguous between the two, which is an
 * error at the call site and not at deploy time.
 *
 * The body is 0165's, unchanged but for the column. The region is a claim
 * by whoever opened the server, like the name is - it decides nothing about
 * permission, it only says where to expect the ping to land.
 */
drop function if exists public.open_world_server(uuid, integer, boolean);

create or replace function public.open_world_server(
  wanted uuid,
  room_for integer default 50,
  private boolean default false,
  where_from text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  fresh integer;
  made uuid;
begin
  if me is null then
    raise exception 'Sign in to play.';
  end if;

  if not exists (
    select 1 from public.worlds
     where id = wanted and is_published and not is_removed and archived_at is null
  ) then
    raise exception 'That world is not open.';
  end if;

  select count(*) into fresh
    from public.world_servers s
   where s.closed_at is null
     and s.opened_at > now() - interval '1 hour'
     and not exists (
       select 1 from public.world_players p
        where p.server_id = s.id
          and p.last_seen > now() - public.stale_after()
     )
     and s.id in (
       select id from public.world_servers where owner_id is not distinct from me
     );

  if fresh >= 3 then
    raise exception 'Too many empty servers are already open.';
  end if;

  insert into public.world_servers (world_id, capacity, owner_id, region)
  values (
    wanted,
    greatest(1, least(room_for, 200)),
    case when private then me end,
    where_from
  )
  returning id into made;

  return made;
end;
$$;

grant execute on function public.open_world_server(uuid, integer, boolean, text) to authenticated;

/**
 * The regions that actually have somebody in them, for the filter to offer.
 *
 * Live servers only, and only ones that have said where they are. A region
 * with nothing open does not appear, so the control never offers a place
 * that would come back empty.
 */
create or replace function public.live_world_regions()
returns table (region text, servers integer, worlds integer)
language sql stable security definer set search_path = public, extensions as $$
  select s.region,
         count(*)::integer as servers,
         count(distinct s.world_id)::integer as worlds
    from public.world_servers s
    join public.worlds w on w.id = s.world_id
   where s.closed_at is null
     and s.region is not null
     and w.is_published
     and not w.is_removed
   group by s.region
   order by count(*) desc;
$$;

grant execute on function public.live_world_regions() to anon, authenticated;

commit;
