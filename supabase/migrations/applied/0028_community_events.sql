-- Events: a Community says something is happening, people say they are
-- coming. Every event carries a number like everything else here.

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities on delete cascade,
  content_id bigint default nextval('public.content_id_seq'),
  title text not null check (char_length(title) between 3 and 80),
  subtitle text check (char_length(subtitle) <= 120),
  description text check (char_length(description) <= 2000),
  cover_url text,
  space_id uuid references public.spaces on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references public.profiles on delete set null,
  is_cancelled boolean not null default false,
  attending_count integer not null default 0,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create unique index if not exists community_events_content_id_idx
  on public.community_events (content_id);
create index if not exists community_events_when_idx
  on public.community_events (community_id, starts_at desc);

alter table public.community_events enable row level security;

-- An event is as public as the Community it belongs to.
drop policy if exists community_events_read on public.community_events;
create policy community_events_read on public.community_events for select
  using (
    exists (select 1 from public.communities c
             where c.id = community_id and c.is_public and not c.is_removed)
    or public.community_can(community_id, 'can_manage_community')
  );

drop policy if exists community_events_write on public.community_events;
create policy community_events_write on public.community_events for insert
  with check (public.community_can(community_id, 'can_manage_community'));

drop policy if exists community_events_change on public.community_events;
create policy community_events_change on public.community_events for update
  using (public.community_can(community_id, 'can_manage_community'))
  with check (public.community_can(community_id, 'can_manage_community'));

drop policy if exists community_events_remove on public.community_events;
create policy community_events_remove on public.community_events for delete
  using (public.community_can(community_id, 'can_manage_community'));

create table if not exists public.event_attendance (
  event_id uuid not null references public.community_events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_attendance_user_idx on public.event_attendance (user_id);

alter table public.event_attendance enable row level security;

drop policy if exists event_attendance_read on public.event_attendance;
create policy event_attendance_read on public.event_attendance for select using (true);

-- You say you are coming for yourself, and only for yourself.
drop policy if exists event_attendance_join on public.event_attendance;
create policy event_attendance_join on public.event_attendance for insert
  with check (user_id = auth.uid() and not public.is_guest());

drop policy if exists event_attendance_leave on public.event_attendance;
create policy event_attendance_leave on public.event_attendance for delete
  using (user_id = auth.uid());

-- The count on the event keeps itself right rather than being told.
create or replace function public.on_event_attendance_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.community_events
       set attending_count = attending_count + 1 where id = new.event_id;
  else
    update public.community_events
       set attending_count = greatest(attending_count - 1, 0) where id = old.event_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_event_attendance_change on public.event_attendance;
create trigger on_event_attendance_change
  after insert or delete on public.event_attendance
  for each row execute function public.on_event_attendance_change();

-- Titles and descriptions are written by people, so they are screened.
create or replace function public.screen_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare verdict public.screen_decision;
begin
  verdict := (public.screen_text(
    coalesce(new.title, '') || ' ' || coalesce(new.subtitle, '') || ' '
    || coalesce(new.description, ''))).decision;
  if verdict = 'block' then
    raise exception 'That is not allowed here.';
  end if;
  return new;
end;
$$;

drop trigger if exists screen_event on public.community_events;
create trigger screen_event before insert or update on public.community_events
  for each row execute function public.screen_event();

/*
 * What is on, with whether the person looking is going. Past events stay
 * listed: an event that happened is part of what a Community has done.
 */
drop function if exists public.community_events_list(uuid, boolean);
create function public.community_events_list(target uuid, upcoming_only boolean default false)
returns table (
  id uuid,
  content_id bigint,
  title text,
  subtitle text,
  description text,
  cover_url text,
  space_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_cancelled boolean,
  attending_count integer,
  i_am_going boolean,
  community_slug text,
  community_name text,
  community_icon text
)
language sql stable security definer set search_path = public as $$
  select e.id, e.content_id, e.title, e.subtitle, e.description, e.cover_url, e.space_id,
         e.starts_at, e.ends_at, e.is_cancelled, e.attending_count,
         exists (select 1 from public.event_attendance a
                  where a.event_id = e.id and a.user_id = auth.uid()),
         c.slug, c.name, c.icon_url
    from public.community_events e
    join public.communities c on c.id = e.community_id
   where e.community_id = target
     and (not upcoming_only or coalesce(e.ends_at, e.starts_at) > now())
   order by e.starts_at desc;
$$;

grant execute on function public.community_events_list to anon, authenticated;

-- One event by its number, for its own page.
drop function if exists public.event_by_id(bigint);
create function public.event_by_id(target bigint)
returns table (
  id uuid,
  community_id uuid,
  content_id bigint,
  title text,
  subtitle text,
  description text,
  cover_url text,
  space_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_cancelled boolean,
  attending_count integer,
  i_am_going boolean,
  i_can_manage boolean,
  community_slug text,
  community_name text,
  community_icon text,
  community_content_id bigint
)
language sql stable security definer set search_path = public as $$
  select e.id, e.community_id, e.content_id, e.title, e.subtitle, e.description, e.cover_url,
         e.space_id, e.starts_at, e.ends_at, e.is_cancelled, e.attending_count,
         exists (select 1 from public.event_attendance a
                  where a.event_id = e.id and a.user_id = auth.uid()),
         public.community_can(e.community_id, 'can_manage_community'),
         c.slug, c.name, c.icon_url, c.content_id
    from public.community_events e
    join public.communities c on c.id = e.community_id
   where e.content_id = target;
$$;

grant execute on function public.event_by_id to anon, authenticated;

-- Who is coming, for the row of faces on an event.
drop function if exists public.event_attendees(uuid, integer);
create function public.event_attendees(target uuid, limit_count integer default 12)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_guest boolean,
  content_id bigint
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.is_guest, p.content_id
    from public.event_attendance a
    join public.profiles p on p.id = a.user_id and not p.is_suspended
   where a.event_id = target
   order by a.created_at desc
   limit least(greatest(limit_count, 1), 60);
$$;

grant execute on function public.event_attendees to anon, authenticated;

-- Saying you are coming, and changing your mind.
create or replace function public.set_event_attendance(target uuid, going boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot join events.'; end if;

  if going then
    insert into public.event_attendance (event_id, user_id)
    values (target, auth.uid())
    on conflict do nothing;
  else
    delete from public.event_attendance where event_id = target and user_id = auth.uid();
  end if;
end;
$$;

grant execute on function public.set_event_attendance to authenticated;
