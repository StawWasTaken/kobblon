-- Kobbleston Create, the parts a creator needs after the upload finishes:
-- a page per item, control over whether it is listed, honest numbers, and
-- people you let work on a Space with you.

-- ------------------------------------------------------------ visibility

alter table public.assets add column if not exists is_public boolean not null default true;
alter table public.assets add column if not exists updated_at timestamptz not null default now();

create index if not exists assets_listed_idx on public.assets (created_at desc)
  where status = 'approved' and is_public;

-- Renaming an approved upload is allowed, so the old "only while pending"
-- rule goes. What a creator must not do is move their own upload through
-- review, which the trigger below enforces.
drop policy if exists assets_update_own_metadata on public.assets;
create policy assets_update_own_metadata on public.assets for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

/*
 * Everything except the writable fields is pinned back to its old value, so
 * a crafted request cannot approve an upload, re-point it at another file or
 * hand it to someone else. A new name or description goes back through the
 * same screening the upload went through.
 */
create or replace function public.guard_asset_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare verdict public.screen_decision;
begin
  -- record_asset_event runs as the definer and sets this for the statement it
  -- is about to make; nothing a browser can call sets it.
  if public.is_moderator()
     or current_setting('kobbleston.counting', true) = 'on' then
    new.updated_at := now();
    return new;
  end if;

  new.creator_id     := old.creator_id;
  new.kind           := old.kind;
  new.file_path      := old.file_path;
  new.thumbnail_path := old.thumbnail_path;
  new.byte_size      := old.byte_size;
  new.content_id     := old.content_id;
  new.download_count := old.download_count;
  new.created_at     := old.created_at;
  new.status         := old.status;
  new.review_note    := old.review_note;
  new.reviewed_at    := old.reviewed_at;

  if new.name is distinct from old.name
     or new.description is distinct from old.description then
    verdict := (public.screen_text(
      coalesce(new.name, '') || ' ' || coalesce(new.description, ''))).decision;
    if verdict = 'block' then
      raise exception 'That name or description is not allowed here.';
    elsif verdict = 'review' then
      new.status := 'pending';
      new.review_note := null;
      new.reviewed_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_asset_update on public.assets;
create trigger guard_asset_update before update on public.assets
  for each row execute function public.guard_asset_update();

-- -------------------------------------------------------------- analytics

/*
 * One row per view or download. There is no viewer id here on purpose: the
 * creator needs counts, not a log of who looked at their work. These are raw
 * hits, not unique people, and the interface says so rather than dressing
 * them up as something more precise.
 */
create table if not exists public.asset_events (
  id bigserial primary key,
  asset_id uuid not null references public.assets on delete cascade,
  kind text not null check (kind in ('view', 'download')),
  created_at timestamptz not null default now()
);

create index if not exists asset_events_idx on public.asset_events (asset_id, created_at desc);

alter table public.asset_events enable row level security;

-- Only the creator and moderators read them; nobody reads them through the
-- table on behalf of someone else.
drop policy if exists asset_events_read_own on public.asset_events;
create policy asset_events_read_own on public.asset_events for select
  using (
    public.is_moderator()
    or exists (select 1 from public.assets a
                where a.id = asset_id and a.creator_id = auth.uid())
  );

create or replace function public.record_asset_event(target uuid, event_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if event_kind not in ('view', 'download') then
    raise exception 'Unknown event.';
  end if;
  if not exists (select 1 from public.assets a
                  where a.id = target and a.status = 'approved' and a.is_public) then
    return;
  end if;

  insert into public.asset_events (asset_id, kind) values (target, event_kind);

  if event_kind = 'download' then
    perform set_config('kobbleston.counting', 'on', true);
    update public.assets set download_count = download_count + 1 where id = target;
    perform set_config('kobbleston.counting', 'off', true);
  end if;
end;
$$;

grant execute on function public.record_asset_event to anon, authenticated;

-- Totals plus a day by day series for the last 30 days, zero-filled so the
-- chart has no gaps in it.
drop function if exists public.asset_analytics(uuid);
create function public.asset_analytics(target uuid)
returns table (day date, views bigint, downloads bigint)
language sql stable security definer set search_path = public as $$
  with allowed as (
    select 1 from public.assets a
     where a.id = target and (a.creator_id = auth.uid() or public.is_moderator())
  ),
  days as (
    select generate_series(current_date - 29, current_date, interval '1 day')::date as day
  )
  select d.day,
         count(*) filter (where e.kind = 'view') as views,
         count(*) filter (where e.kind = 'download') as downloads
    from days d
    left join public.asset_events e
      on e.asset_id = target and e.created_at::date = d.day
   where exists (select 1 from allowed)
   group by d.day
   order by d.day;
$$;

grant execute on function public.asset_analytics to authenticated;

-- One line per upload: what it is, where it stands, and how it has done.
drop function if exists public.creator_analytics(uuid);
create function public.creator_analytics(target uuid)
returns table (
  asset_id uuid,
  name text,
  kind public.asset_kind,
  content_id bigint,
  status public.moderation_status,
  is_public boolean,
  views bigint,
  downloads bigint,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.kind, a.content_id, a.status, a.is_public,
         count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind = 'download'),
         a.created_at
    from public.assets a
    left join public.asset_events e on e.asset_id = a.id
   where a.creator_id = target
     and (target = auth.uid() or public.is_moderator())
   group by a.id
   order by a.created_at desc;
$$;

grant execute on function public.creator_analytics to authenticated;

-- ------------------------------------------------------------- item page

-- One upload with its creator, by content id. Anyone may read a listed one;
-- the creator and moderators also see their own unlisted or in-review work.
drop function if exists public.get_asset(bigint);
create function public.get_asset(target_content_id bigint)
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  description text,
  file_path text,
  thumbnail_path text,
  byte_size bigint,
  download_count integer,
  content_id bigint,
  status public.moderation_status,
  is_public boolean,
  review_note text,
  created_at timestamptz,
  updated_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  creator_is_admin boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.byte_size, a.download_count, a.content_id, a.status, a.is_public,
         case when a.creator_id = auth.uid() or public.is_moderator()
              then a.review_note end,
         a.created_at, a.updated_at,
         p.id, p.username, p.display_name, p.avatar_url, p.is_admin
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.content_id = target_content_id
     and (
       (a.status = 'approved' and a.is_public and not p.is_suspended)
       or a.creator_id = auth.uid()
       or public.is_moderator()
     );
$$;

grant execute on function public.get_asset to anon, authenticated;

-- Unlisted uploads drop out of the marketplace listing.
drop function if exists public.list_assets(text, text, integer);
create function public.list_assets(
  kind_filter text default null,
  search text default null,
  limit_count int default 24
)
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  description text,
  file_path text,
  thumbnail_path text,
  download_count integer,
  content_id bigint,
  created_at timestamptz,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  creator_is_admin boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.download_count, a.content_id, a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin
    from public.assets a
    join public.profiles p on p.id = a.creator_id and not p.is_suspended
   where a.status = 'approved'
     and a.is_public
     and (kind_filter is null or a.kind::text = kind_filter)
     and (search is null or a.name ilike '%' || search || '%')
   order by p.is_admin desc, a.created_at desc
   limit least(greatest(limit_count, 1), 60);
$$;

grant execute on function public.list_assets to anon, authenticated;

-- --------------------------------------------------------- collaborators

/*
 * Someone the owner lets work on a Space. The owner is not listed here: they
 * are the owner, and nobody can take that away by editing a row.
 */
create table if not exists public.space_collaborators (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  added_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists space_collaborators_user_idx on public.space_collaborators (user_id);

alter table public.space_collaborators enable row level security;

/*
 * These two answer "is this my Space" and "may I edit it" without the policy
 * on one table having to read the other through its own policy, which
 * Postgres refuses as recursion.
 */
create or replace function public.owns_space(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.spaces s
                  where s.id = target and s.owner_id = auth.uid());
$$;

create or replace function public.can_edit_space(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.owns_space(target)
      or exists (select 1 from public.space_collaborators c
                  where c.space_id = target and c.user_id = auth.uid());
$$;

grant execute on function public.owns_space, public.can_edit_space to authenticated;


drop policy if exists space_collaborators_read on public.space_collaborators;
create policy space_collaborators_read on public.space_collaborators for select
  using (user_id = auth.uid() or public.owns_space(space_id) or public.is_moderator());

-- Only the owner adds or removes people.
drop policy if exists space_collaborators_write on public.space_collaborators;
create policy space_collaborators_write on public.space_collaborators for insert
  with check (public.owns_space(space_id) and user_id <> auth.uid() and not public.is_guest());

drop policy if exists space_collaborators_delete on public.space_collaborators;
create policy space_collaborators_delete on public.space_collaborators for delete
  using (user_id = auth.uid() or public.owns_space(space_id));

-- A collaborator may edit the Space itself, but not delete it and not hand it
-- to somebody else, so only the update policy widens.
drop policy if exists spaces_update_collaborator on public.spaces;
create policy spaces_update_collaborator on public.spaces for update
  using (public.can_edit_space(id))
  with check (public.can_edit_space(id));

-- A draft is invisible to everyone but its owner, so somebody invited to work
-- on one has to be able to read it as well as write it.
drop policy if exists spaces_read_collaborator on public.spaces;
create policy spaces_read_collaborator on public.spaces for select
  using (public.can_edit_space(id));

-- Ownership is not something an update can move, whoever sends it. A policy
-- cannot compare the old row against the new one, so a trigger does it.
create or replace function public.guard_space_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id and not public.is_moderator() then
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_space_owner on public.spaces;
create trigger guard_space_owner before update on public.spaces
  for each row execute function public.guard_space_owner();

drop function if exists public.space_collaborators_list(uuid);
create function public.space_collaborators_list(target uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, c.created_at
    from public.space_collaborators c
    join public.profiles p on p.id = c.user_id
   where c.space_id = target
     and (public.can_edit_space(target) or public.is_moderator())
   order by c.created_at;
$$;

grant execute on function public.space_collaborators_list to authenticated;

-- Spaces you can edit but do not own, so they can be listed beside your own.
drop function if exists public.spaces_shared_with_me();
create function public.spaces_shared_with_me()
returns setof public.spaces
language sql stable security definer set search_path = public as $$
  select s.* from public.spaces s
    join public.space_collaborators c on c.space_id = s.id
   where c.user_id = auth.uid() and not s.is_removed
   order by s.updated_at desc;
$$;

grant execute on function public.spaces_shared_with_me to authenticated;
