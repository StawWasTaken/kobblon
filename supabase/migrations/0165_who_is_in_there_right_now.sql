begin;

/*
 * Who is in a World right now.
 *
 * The Servers tab has been an empty state since it was written: a drawing of
 * Kobby and the sentence "Nobody is in it at the moment", which was true in
 * the only way it could be, because nothing on this platform has ever
 * recorded that somebody is playing. Staw asked to see the faces of the
 * people in each server and how many are actually playing, and neither can
 * be drawn from `visit_count` - a visit is a thing that happened once, and
 * what he is asking for is a thing that is happening.
 *
 * So: a server is a row, a player in it is a row, and both are written by
 * the Launcher as it goes. They hang off `worlds` - which is what `0073`
 * created as `experiences` and `0074` renamed, so anything still written
 * against that older name refers to a table that is not there.
 *
 * **The honest part.** Nobody can be relied on to say goodbye. An
 * application is closed, a laptop sleeps, a connection drops, and whatever
 * "I am leaving" message we hoped for is never sent. A design that only
 * counted joins and leaves would drift upwards for ever and show fifty
 * people in a World nobody has opened since March. So presence here is a
 * *claim with an expiry*: a player says "still here" every so often, and
 * anybody who has not said it lately is not counted. Leaving properly is an
 * optimisation that makes the number right sooner, never the thing the
 * number depends on.
 *
 * `STALE_AFTER` below is that window. It is deliberately generous - a
 * player on a bad connection should not flicker out of a server - and it is
 * one place rather than a number repeated in four functions.
 */

create table if not exists public.world_servers (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds on delete cascade,
  /** How many may be in it. The Launcher opens another when one fills. */
  capacity integer not null default 50 check (capacity between 1 and 200),
  /**
   * A private server belongs to somebody and is not offered to strangers.
   * Null is an ordinary public one.
   */
  owner_id uuid references public.profiles on delete cascade,
  name text check (char_length(name) between 1 and 48),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists world_servers_live_idx
  on public.world_servers (world_id)
  where closed_at is null;

create table if not exists public.world_players (
  server_id uuid not null references public.world_servers on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  /** The claim. Everything about counting hangs off this column. */
  last_seen timestamptz not null default now(),
  primary key (server_id, user_id)
);

create index if not exists world_players_fresh_idx
  on public.world_players (last_seen desc);

/*
 * Grants in the same file as the tables, because a policy decides which rows
 * a role may see and a grant decides whether it may touch the table at all -
 * and this project has shipped a carefully-protected unreachable table twice
 * already.
 *
 * Reading is open: who is in a public World is public, the same way a
 * profile is. Writing is through the functions below and nowhere else, so
 * nobody is granted insert or update on either table. A client that could
 * write `world_players` directly could put anybody in any server.
 */
alter table public.world_servers enable row level security;
alter table public.world_players enable row level security;

grant select on public.world_servers to anon, authenticated;
grant select on public.world_players to anon, authenticated;

drop policy if exists world_servers_readable on public.world_servers;
create policy world_servers_readable on public.world_servers
  for select using (closed_at is null);

drop policy if exists world_players_readable on public.world_players;
create policy world_players_readable on public.world_players
  for select using (true);

/** How long a claim of "still here" is good for. */
create or replace function public.stale_after()
returns interval language sql immutable as $$ select interval '90 seconds' $$;

/**
 * Open a server for a World.
 *
 * The Launcher does this when somebody plays a World that has no room with
 * space in it. A private one carries an owner and is never offered to
 * strangers.
 *
 * It refuses an unpublished, removed or archived World, because a server for
 * something nobody may open is a server nobody may join, and it refuses to
 * let one person hold a pile of empty rooms: an account already holding
 * three open servers with nobody in them cannot open a fourth. Otherwise
 * the list on a popular World is whatever one bored person made it.
 */
create or replace function public.open_world_server(
  wanted uuid, room_for integer default 50, private boolean default false
)
returns uuid
language plpgsql security definer set search_path = public as $$
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

  insert into public.world_servers (world_id, capacity, owner_id)
  values (wanted, greatest(1, least(room_for, 200)), case when private then me end)
  returning id into made;

  return made;
end;
$$;

/** Closing one. Only whoever opened a private room may close it. */
create or replace function public.close_world_server(server uuid)
returns void
language sql security definer set search_path = public as $$
  update public.world_servers
     set closed_at = clock_timestamp()
   where id = server
     and closed_at is null
     and (owner_id = auth.uid() or public.is_moderator());
$$;

grant execute on function public.open_world_server(uuid, integer, boolean) to authenticated;
grant execute on function public.close_world_server(uuid) to authenticated;

/**
 * Join a server, or say again that you are in it.
 *
 * One function for both because they are the same statement, and because a
 * player whose row was swept away by a long pause should be able to carry on
 * rather than be told they are not where they plainly are.
 *
 * It refuses a full server. The count is of fresh players, so a server
 * holding fifty rows that nobody has touched for an hour is empty and may be
 * joined - which is the whole point of the expiry.
 */
create or replace function public.join_world_server(server uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  room record;
  how_many integer;
begin
  if me is null then
    raise exception 'Sign in to play.';
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

  /*
   * Somebody in two servers at once would be counted twice and shown in
   * both, so joining one is leaving every other.
   */
  delete from public.world_players
   where user_id = me and server_id <> server;

  /* What "people also join" is later built from. Once per person per day. */
  insert into public.world_visits (world_id, user_id)
  values (room.world_id, me)
  on conflict do nothing;
end;
$$;

/** Said every so often while playing. Nothing happens if the row is gone. */
create or replace function public.still_in_world(server uuid)
returns void
language sql security definer set search_path = public as $$
  update public.world_players
     set last_seen = clock_timestamp()
   where server_id = server and user_id = auth.uid();
$$;

/** Said on the way out, when there is a way out to be said on. */
create or replace function public.left_world_server(server uuid)
returns void
language sql security definer set search_path = public as $$
  delete from public.world_players
   where server_id = server and user_id = auth.uid();
$$;

/**
 * How many are playing a World right now.
 *
 * Counts fresh players in servers that are open. This is the number Staw
 * wants on the World page, and it is the same number the server list sums
 * to, because both come from here.
 */
create or replace function public.playing_now(wanted uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.world_players p
    join public.world_servers s on s.id = p.server_id
   where s.world_id = wanted
     and s.closed_at is null
     and p.last_seen > now() - public.stale_after();
$$;

/**
 * The servers of a World, with the faces of the people in them.
 *
 * The faces are the point: Staw asked to see who is actually in each one.
 * They come back as a small array of rows rather than a count plus a second
 * query per server, because the list is drawn in one go and a page that asks
 * once per card is a page that asks twenty times.
 *
 * Private servers are left out. Somebody's own space is not a thing
 * strangers are offered.
 */
create or replace function public.servers_of(wanted uuid, faces integer default 6)
returns table (
  id uuid,
  capacity integer,
  how_many integer,
  people jsonb
)
language sql stable security definer set search_path = public as $$
  with fresh as (
    select p.server_id, p.user_id, p.joined_at
      from public.world_players p
     where p.last_seen > now() - public.stale_after()
  )
  select s.id,
         s.capacity,
         (select count(*)::integer from fresh f where f.server_id = s.id),
         coalesce((
           select jsonb_agg(x order by x.joined_at)
             from (
               select pr.id, pr.username, pr.display_name,
                      pr.avatar_url, pr.avatar_changed_at, f.joined_at
                 from fresh f
                 join public.profiles pr on pr.id = f.user_id
                where f.server_id = s.id
                order by f.joined_at
                limit greatest(1, least(faces, 24))
             ) x
         ), '[]'::jsonb)
    from public.world_servers s
   where s.world_id = wanted
     and s.closed_at is null
     and s.owner_id is null
   order by (select count(*) from fresh f where f.server_id = s.id) desc;
$$;

grant execute on function public.stale_after to anon, authenticated;
grant execute on function public.join_world_server(uuid) to authenticated;
grant execute on function public.still_in_world(uuid) to authenticated;
grant execute on function public.left_world_server(uuid) to authenticated;
grant execute on function public.playing_now(uuid) to anon, authenticated;
grant execute on function public.servers_of(uuid, integer) to anon, authenticated;

/*
 * The emblem.
 *
 * `cover_url` is the wide picture at the top of a World's page. Staw asked
 * for a "People also join" row drawn with emblems rather than those covers,
 * and a wide picture squeezed into a square is a wide picture with its ends
 * cut off. So a World may carry a square mark of its own.
 *
 * It is allowed to be null, and a row that has none falls back to the cover.
 * A World that nobody has given an emblem should look plain, not broken.
 */
alter table public.worlds add column if not exists emblem_url text;

/*
 * What people actually joined.
 *
 * "People also join" needs a record of who joined what, and nothing here
 * kept one - `visit_count` is a number that only goes up and remembers
 * nobody. This is written by `join_world_server` as it goes, so the answer
 * comes from what people did rather than from a guess.
 *
 * One row per person per World per day. Without that, somebody who plays the
 * same World forty times in an evening would drown out everyone else, and
 * the row would recommend whatever the most obsessive player likes.
 */
create table if not exists public.world_visits (
  world_id uuid not null references public.worlds on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  on_day date not null default current_date,
  primary key (world_id, user_id, on_day)
);

create index if not exists world_visits_person_idx on public.world_visits (user_id);

alter table public.world_visits enable row level security;
grant select on public.world_visits to anon, authenticated;

/*
 * Nobody reads this but the recommendation below, and that is
 * `security definer`. A person's play history is not a thing strangers
 * should be able to page through, so the policy allows each person their own
 * rows and nothing else.
 */
drop policy if exists world_visits_mine on public.world_visits;
create policy world_visits_mine on public.world_visits
  for select using (user_id = auth.uid());

/**
 * Worlds joined by the people who joined this one.
 *
 * Ordinary co-visitation: find the people who have been in this World, count
 * what else they have been in, and offer the most common. It refuses to
 * recommend the World you are looking at, and anything unpublished or
 * removed.
 *
 * `security definer` because it reads across everybody's history, and it
 * hands back only Worlds - never who played what. The one thing this must
 * not become is a way to ask "what does that person play".
 */
create or replace function public.also_joined(wanted uuid, how_many integer default 6)
returns table (
  id uuid, content_id bigint, slug text, name text,
  emblem_url text, cover_url text, creator_name text,
  like_count integer, dislike_count integer, playing integer
)
language sql stable security definer set search_path = public as $$
  with theirs as (
    select distinct user_id from public.world_visits where world_id = wanted
  ),
  others as (
    select v.world_id, count(*) as weight
      from public.world_visits v
      join theirs t on t.user_id = v.user_id
     where v.world_id <> wanted
     group by v.world_id
  )
  select w.id, w.content_id, w.slug, w.name,
         w.emblem_url, w.cover_url, w.creator_name,
         w.like_count, w.dislike_count,
         public.playing_now(w.id)
    from others o
    join public.worlds w on w.id = o.world_id
   where w.is_published and not w.is_removed and w.archived_at is null
   order by o.weight desc, w.like_count desc
   limit greatest(1, least(how_many, 24));
$$;

grant execute on function public.also_joined(uuid, integer) to anon, authenticated;

/*
 * First Ground belongs to Kobblon.
 *
 * It was inserted with `creator_name = 'Kobblon'` - a piece of text, not an
 * account - so the page said Kobblon made it while no account owned it, and
 * nobody could open it in the Workspace, rename it, or publish over it.
 * Staw asked for it to be a real World made by the Kobblon account. Giving
 * it an owner is that.
 *
 * Written as an update rather than folded into the original insert so that
 * an installation which already has the row gets it too.
 */
update public.worlds
   set owner_id = public.kobbleston_account()
 where id = 'e0000000-0000-4000-8000-000000000001'
   and owner_id is null
   and public.kobbleston_account() is not null;

commit;
