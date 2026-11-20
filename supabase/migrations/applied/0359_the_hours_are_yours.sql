begin;

/*
 * Hours.
 *
 * Steam's hook is the hours and Xbox's is the score; we had neither, and
 * per-World badges that added up to nothing. This is the first half: how
 * long somebody has actually spent in each World, and a lifetime total.
 *
 * Nothing new has to be sent for it. `still_in_world` already turns the
 * gap between two heartbeats into seconds - it has done since quests - and
 * the cap on that gap is `stale_after()`, so a player who shut the lid for
 * an hour is credited the window rather than the hour, and one who sends a
 * heartbeat every millisecond is credited a millisecond. The total can
 * never run faster than real time. This file sends the same number to one
 * more place.
 */

create table if not exists public.world_playtime (
  user_id uuid not null references public.profiles on delete cascade,
  world_id uuid not null references public.worlds on delete cascade,
  seconds bigint not null default 0 check (seconds >= 0),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, world_id)
);

create index if not exists world_playtime_person_idx
  on public.world_playtime (user_id, seconds desc);
create index if not exists world_playtime_world_idx
  on public.world_playtime (world_id, seconds desc);

/*
 * Grants in the same file as the table. A policy decides which rows a role
 * may see; a grant decides whether it may touch the table at all, and a new
 * table has none. This project has shipped a carefully-protected
 * unreachable table twice.
 *
 * Read by anybody, because hours on a profile are part of a profile.
 * Written by nothing but the heartbeat below, which is `security definer`:
 * no insert, update or delete is granted to anyone, so a hand-written
 * request cannot give itself a thousand hours.
 */
alter table public.world_playtime enable row level security;
grant select on public.world_playtime to anon, authenticated;

drop policy if exists world_playtime_read on public.world_playtime;
create policy world_playtime_read on public.world_playtime
  for select using (true);

-- ------------------------------------------------ where the seconds land

/**
 * The heartbeat, which now credits the World as well as the quest.
 *
 * It returns a boolean and refuses a suspended account, which is 0334's
 * doing and stays: the heartbeat is one of the two doors standing is
 * decided at.
 *
 * It also counts again. 0264 made this the only thing on the platform that
 * turns heartbeats into seconds, and 0334 - replacing it to add the
 * standing check - wrote the counting out. Nothing failed, nothing threw,
 * and every `world_time` quest on the platform has sat at zero since. That
 * is this project's own trap wearing a new coat: a replacement that kept
 * what the file in front of it was about and dropped what the last one
 * was.
 *
 * Same read-before-write as 0264: `last_seen` is read and locked in one
 * statement before anything writes it, because reading it afterwards reads
 * the value this call has just set - a gap of nothing, every time.
 *
 * The gap is capped at `stale_after()`, so a player who shut the lid for an
 * hour is credited the window rather than the hour, and one who sends a
 * heartbeat every millisecond is credited a millisecond. The total can
 * never run faster than real time.
 */
create or replace function public.still_in_world(server uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  world uuid;
  said_so timestamptz;
  gap integer;
begin
  if me is null then return false; end if;

  if not public.may_play(me) then
    delete from public.world_players where user_id = me;
    return false;
  end if;

  select p.last_seen, s.world_id into said_so, world
    from public.world_players p
    join public.world_servers s on s.id = p.server_id
   where p.server_id = server and p.user_id = me
     for no key update of p;

  if not found then return true; end if;

  update public.world_players
     set last_seen = clock_timestamp()
   where server_id = server and user_id = me;

  gap := greatest(0, floor(extract(epoch from
    least(clock_timestamp() - said_so, public.stale_after())))::integer);

  update public.quest_progress pr
     set seconds = least(q.goal, pr.seconds + gap)
    from public.quests q
   where q.id = pr.quest_id
     and pr.user_id = me
     and pr.claimed_at is null
     and q.counted = 'world_time'
     and q.status = 'live'
     and q.world_id = world
     and q.starts_at <= now()
     and (q.ends_at is null or q.ends_at > now());

  if gap > 0 then
    insert into public.world_playtime (user_id, world_id, seconds, last_at)
    values (me, world, gap, now())
    on conflict (user_id, world_id) do update
      set seconds = public.world_playtime.seconds + excluded.seconds,
          last_at = now();
  end if;

  return true;
end;
$$;

/**
 * Leaving, which credits the last stretch on the way out.
 *
 * It used to be a delete. Without this, every session loses whatever
 * happened after its last heartbeat - up to a minute and a half each time,
 * which on a short visit is most of the visit.
 */
create or replace function public.left_world_server(server uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  world uuid;
  said_so timestamptz;
  gap integer;
begin
  if me is null then return; end if;

  select p.last_seen, s.world_id into said_so, world
    from public.world_players p
    join public.world_servers s on s.id = p.server_id
   where p.server_id = server and p.user_id = me
     for no key update of p;

  if not found then return; end if;

  gap := greatest(0, floor(extract(epoch from
    least(clock_timestamp() - said_so, public.stale_after())))::integer);

  if gap > 0 then
    insert into public.world_playtime (user_id, world_id, seconds, last_at)
    values (me, world, gap, now())
    on conflict (user_id, world_id) do update
      set seconds = public.world_playtime.seconds + excluded.seconds,
          last_at = now();
  end if;

  delete from public.world_players
   where server_id = server and user_id = me;
end;
$$;

-- ---------------------------------------------------- reading them back

/**
 * The Worlds somebody has spent the most time in.
 *
 * Only published Worlds that are still there: a profile is not the place to
 * find out that something was taken down. The seconds stay on the row
 * either way, so if it comes back so does the number.
 */
create or replace function public.playtime_of(target uuid, limit_count int default 8)
returns table (
  world_id uuid,
  content_id bigint,
  name text,
  slug text,
  cover_url text,
  creator_username text,
  seconds bigint,
  last_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select w.id, w.content_id, w.name, w.slug, w.cover_url, w.creator_username,
         t.seconds, t.last_at
    from public.world_playtime t
    join public.worlds w on w.id = t.world_id
   where t.user_id = target
     and w.is_published and not w.is_removed
     and t.seconds > 0
   order by t.seconds desc
   limit least(greatest(limit_count, 1), 50);
$$;

/** Everything, including Worlds that are no longer published. */
create or replace function public.playtime_total(target uuid)
returns bigint
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(sum(seconds), 0)::bigint
    from public.world_playtime where user_id = target;
$$;

/** How long one person has spent in one World. Null for nobody. */
create or replace function public.my_playtime_in(wanted uuid)
returns bigint
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select seconds from public.world_playtime
                    where user_id = auth.uid() and world_id = wanted), 0)::bigint;
$$;

grant execute on function public.playtime_of(uuid, int) to anon, authenticated;
grant execute on function public.playtime_total(uuid) to anon, authenticated;
grant execute on function public.my_playtime_in(uuid) to authenticated;

commit;
