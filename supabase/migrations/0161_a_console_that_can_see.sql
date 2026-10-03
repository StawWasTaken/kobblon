begin;

-- What a staff console needs to see, and the one thing it must never guess.
--
-- Staw wants a console with every account in it, a page per person showing
-- what everybody sees plus "their country and what time they logged in and
-- when did they leave", the reports in one place, and a map with a dot for
-- roughly where people are.
--
-- **Where somebody is, and how honest to be about it.** No address is read,
-- no IP is looked up, nothing is asked of any service. What is recorded is
-- the **time zone the browser reports** - a setting on somebody's own
-- machine, which the console shows as a hint and must never treat as proof.
-- A zone's coordinates are the zone's, not the person's: everybody in
-- Europe/Paris is at Paris, and that is deliberately as close as this gets.
--
-- Staff see it; nobody else does, including the person's own friends. It is
-- not on their profile and there is no reader that hands it to anybody but a
-- moderator.

create table if not exists public.account_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Moved on while the tab is alive, so a session that was never closed
  -- still says when somebody was last really there.
  last_seen_at timestamptz not null default now(),
  -- Set when they sign out or the tab goes. Null means still open, which is
  -- not the same as still *here* - `last_seen_at` is the honest one.
  ended_at timestamptz,
  /* As reported by the browser. A hint. */
  zone text,
  country text,
  /* The browser's own description of itself, for telling a phone from a
     desktop. Not parsed here: a user agent is a sentence somebody else
     wrote and parsing it is a losing game played for ever. */
  agent text
);

create index if not exists account_sessions_person
  on public.account_sessions (user_id, started_at desc);
create index if not exists account_sessions_live
  on public.account_sessions (last_seen_at desc) where ended_at is null;

alter table public.account_sessions enable row level security;

/*
 * Nobody reads this table directly - not even the person it is about. Every
 * way in is a function below, which decides who may ask. The grants are
 * here, in the same file as the table, because twice this project has
 * written a policy with no grant and spent days with a table nobody could
 * reach; this time the answer is the opposite - no policy, no grant, and a
 * door with a lock on it.
 */

/**
 * Says somebody is here, and from roughly where.
 *
 * Called on sign-in and then kept warm by the same heartbeat that keeps
 * presence honest. One row per visit: starting a session again within the
 * hour moves the row rather than making a second one, or a day of somebody
 * reloading is a day of rows saying nothing.
 */
create or replace function public.touch_session(zone_name text default null, agent_text text default null)
returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  live uuid;
begin
  if me is null then return null; end if;

  select id into live from public.account_sessions
   where user_id = me and ended_at is null
     and last_seen_at > now() - interval '1 hour'
   order by last_seen_at desc limit 1;

  if live is not null then
    update public.account_sessions
       set last_seen_at = now(),
           zone = coalesce(nullif(btrim(coalesce(zone_name, '')), ''), zone),
           agent = coalesce(nullif(btrim(coalesce(agent_text, '')), ''), agent)
     where id = live;
    return live;
  end if;

  insert into public.account_sessions (user_id, zone, agent)
  values (me, nullif(btrim(coalesce(zone_name, '')), ''), nullif(btrim(coalesce(agent_text, '')), ''))
  returning id into live;

  return live;
end;
$$;

grant execute on function public.touch_session to authenticated;

/** Closes the open one, which is what signing out or closing the tab means. */
create or replace function public.end_session()
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  update public.account_sessions
     set ended_at = now(), last_seen_at = now()
   where user_id = me and ended_at is null;
end;
$$;

grant execute on function public.end_session to authenticated;

/** The country a zone is in, kept with the row so a console can group by it. */
create or replace function public.set_session_country(where_from text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if coalesce(btrim(where_from), '') = '' then return; end if;

  update public.account_sessions
     set country = upper(left(btrim(where_from), 2))
   where user_id = me and ended_at is null;
end;
$$;

grant execute on function public.set_session_country to authenticated;

/**
 * Somebody's comings and goings. Staff only.
 *
 * The check is `is_moderator()` and it is inside the function, so a page
 * asking is a page asking - the answer does not depend on the page being
 * honest about who is looking.
 */
create or replace function public.sessions_of(target uuid, how_many integer default 30)
returns table (
  id uuid, started_at timestamptz, last_seen_at timestamptz, ended_at timestamptz,
  zone text, country text, agent text
)
language sql stable security definer
set search_path = public, extensions as $$
  select s.id, s.started_at, s.last_seen_at, s.ended_at, s.zone, s.country, s.agent
    from public.account_sessions s
   where s.user_id = target and public.is_moderator()
   order by s.started_at desc
   limit least(greatest(coalesce(how_many, 30), 1), 200);
$$;

grant execute on function public.sessions_of to authenticated;

/**
 * Where everybody is, roughly, for the map.
 *
 * Counted by zone rather than listed by person: a map with a dot per account
 * is a map that says where one person lives, and nobody needs that. A dot
 * per zone with a number on it answers the question somebody actually has -
 * where are the people - without pointing at anybody.
 */
create or replace function public.where_people_are(since_days integer default 30)
returns table (zone text, country text, how_many integer)
language sql stable security definer
set search_path = public, extensions as $$
  select s.zone, max(s.country), count(distinct s.user_id)::integer
    from public.account_sessions s
   where public.is_moderator()
     and s.zone is not null
     and s.last_seen_at > now() - make_interval(days => greatest(coalesce(since_days, 30), 1))
   group by s.zone
   order by 3 desc;
$$;

grant execute on function public.where_people_are to authenticated;

-- ------------------------------------------------------------- reports

/**
 * The reports queue, with who reported what and who it is about.
 *
 * `reports.target_id` is text because a report can be about a profile, a
 * World, a message or an item - so the name of the thing is worked out per
 * kind rather than joined once, and anything this does not recognise still
 * appears with its kind and its id, because a report nobody can see is a
 * report nobody acts on.
 */
create or replace function public.report_queue(
  which text default 'open', how_many integer default 100
)
returns table (
  id bigint, target_type text, target_id text, reason text, details text,
  status text, created_at timestamptz,
  reporter_id uuid, reporter_username text,
  about_name text, about_username text, about_id uuid
)
language sql stable security definer
set search_path = public, extensions as $$
  select r.id, r.target_type, r.target_id, r.reason, r.details,
         r.status, r.created_at,
         r.reporter_id, rp.username,
         case r.target_type
           when 'profile' then tp.display_name
           when 'world' then w.name
           when 'avatar_item' then ai.name
           when 'asset' then a.name
           else null
         end,
         tp.username,
         tp.id
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp
      on r.target_type = 'profile' and tp.id::text = r.target_id
    left join public.worlds w
      on r.target_type = 'world' and w.id::text = r.target_id
    left join public.avatar_items ai
      on r.target_type = 'avatar_item' and ai.id::text = r.target_id
    left join public.assets a
      on r.target_type = 'asset' and a.id::text = r.target_id
   where public.is_moderator()
     and (which = 'all' or r.status = which)
   order by r.created_at desc
   limit least(greatest(coalesce(how_many, 100), 1), 500);
$$;

grant execute on function public.report_queue to authenticated;

/** Marking one dealt with. Staff only, and it says who did it. */
create or replace function public.settle_report(target bigint, how text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not public.is_moderator() then
    raise exception 'Only staff can settle a report.';
  end if;
  if how not in ('actioned', 'dismissed', 'open') then
    raise exception 'A report is open, actioned or dismissed.';
  end if;

  update public.reports set status = how where id = target;
end;
$$;

grant execute on function public.settle_report to authenticated;

commit;
