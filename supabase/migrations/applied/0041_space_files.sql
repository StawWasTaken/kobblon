-- The files a Space is made of.
--
-- A Space is a small static site plus what Kobbleston knows about it. This is
-- the site: markup, styles and scripts, kept per Space and per path. Pictures
-- and sounds are not copied in here; they are referenced by the content ID
-- they already have in Create, which is what those IDs are for.
--
-- There are two copies of every file. The draft is what the editor writes to,
-- and only people who can edit the Space can read it. The live copy is what
-- visitors get, and publishing is what moves one to the other. The copy that
-- was live before a publish is kept, so a bad save can be undone.
--
-- Nothing writes to this table directly: every change goes through a function
-- below, which is where the limits live. Safe to run again.

create table if not exists public.space_files (
  space_id uuid not null references public.spaces on delete cascade,
  channel text not null check (channel in ('draft', 'live')),
  path text not null check (path ~ '^[a-z0-9][a-z0-9._/-]{0,59}$' and path !~ '\.\.'),
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (space_id, channel, path),
  check (char_length(content) <= 200000)
);

create index if not exists space_files_space_idx on public.space_files (space_id, channel);

-- What was live before the last publish, so a Space can be put back.
create table if not exists public.space_file_backups (
  space_id uuid not null references public.spaces on delete cascade,
  path text not null,
  content text not null,
  kept_at timestamptz not null default now(),
  primary key (space_id, path)
);

alter table public.spaces add column if not exists site_version integer not null default 0;

alter table public.space_files enable row level security;
alter table public.space_file_backups enable row level security;

-- A visitor reads the live copy of a published Space. A draft is the business
-- of the people building it.
drop policy if exists space_files_read on public.space_files;
create policy space_files_read on public.space_files for select using (
  (channel = 'live' and exists (
    select 1 from public.spaces s
     where s.id = space_id and s.is_published and not s.is_removed
  ))
  or public.can_edit_space(space_id)
  or public.is_moderator()
);

drop policy if exists space_file_backups_read on public.space_file_backups;
create policy space_file_backups_read on public.space_file_backups for select
  using (public.can_edit_space(space_id));

revoke insert, update, delete on public.space_files from anon, authenticated;
revoke insert, update, delete on public.space_file_backups from anon, authenticated;

/** How many files a Space may have, so nobody uses this as a disk. */
create or replace function public.space_file_limit() returns integer
language sql immutable as $$ select 40 $$;

/**
 * Writing one file of a Space. Only somebody who can edit it, only into the
 * draft, and only within the limits: a path that looks like a path, a file
 * that is not enormous, and not more files than a Space is allowed.
 */
create or replace function public.save_space_file(space uuid, file_path text, body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  clean text := lower(trim(both '/' from coalesce(file_path, '')));
  count_now integer;
begin
  if not public.can_edit_space(space) then
    raise exception 'You cannot edit this Space.';
  end if;
  if clean !~ '^[a-z0-9][a-z0-9._/-]{0,59}$' or clean like '%..%' then
    raise exception 'A file name is letters, numbers, dots, dashes and slashes.';
  end if;
  if char_length(coalesce(body, '')) > 200000 then
    raise exception 'That file is too big. 200 KB is the limit.';
  end if;

  select count(*) into count_now
    from public.space_files f
   where f.space_id = space and f.channel = 'draft' and f.path <> clean;

  if count_now >= public.space_file_limit() then
    raise exception 'A Space can have % files.', public.space_file_limit();
  end if;

  insert into public.space_files (space_id, channel, path, content)
  values (space, 'draft', clean, coalesce(body, ''))
  on conflict (space_id, channel, path)
  do update set content = excluded.content, updated_at = now();
end;
$$;

create or replace function public.delete_space_file(space uuid, file_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_space(space) then
    raise exception 'You cannot edit this Space.';
  end if;
  if lower(file_path) = 'index.html' then
    raise exception 'Every Space needs its index.html.';
  end if;
  delete from public.space_files
   where space_id = space and channel = 'draft' and path = lower(file_path);
end;
$$;

/**
 * Publishing: what is in the draft becomes what visitors get. Whatever was
 * live is kept first, so one bad publish can be undone, and the Space's
 * update count and feed are stamped the way they always were.
 */
create or replace function public.publish_space_files(space uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  files integer;
begin
  if not public.can_edit_space(space) then
    raise exception 'You cannot edit this Space.';
  end if;

  if not exists (
    select 1 from public.space_files
     where space_id = space and channel = 'draft' and path = 'index.html'
  ) then
    raise exception 'A Space needs an index.html before it can be published.';
  end if;

  delete from public.space_file_backups where space_id = space;
  insert into public.space_file_backups (space_id, path, content)
  select space_id, path, content from public.space_files
   where space_id = space and channel = 'live';

  delete from public.space_files where space_id = space and channel = 'live';
  insert into public.space_files (space_id, channel, path, content)
  select space_id, 'live', path, content from public.space_files
   where space_id = space and channel = 'draft';

  select count(*) into files from public.space_files
   where space_id = space and channel = 'live';

  update public.spaces
     set site_version = site_version + 1,
         update_count = update_count + 1,
         updated_at = now()
   where id = space;

  insert into public.activity_events (kind, actor_id, space_id)
  select 'space_updated', s.owner_id, s.id from public.spaces s where s.id = space;

  return files;
end;
$$;

/** Putting back what was live before the last publish. */
create or replace function public.revert_space_files(space uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  files integer;
begin
  if not public.can_edit_space(space) then
    raise exception 'You cannot edit this Space.';
  end if;

  if not exists (select 1 from public.space_file_backups where space_id = space) then
    raise exception 'There is nothing to go back to.';
  end if;

  delete from public.space_files where space_id = space and channel = 'live';
  insert into public.space_files (space_id, channel, path, content)
  select space_id, 'live', path, content from public.space_file_backups
   where space_id = space;

  select count(*) into files from public.space_files
   where space_id = space and channel = 'live';

  update public.spaces set updated_at = now() where id = space;
  return files;
end;
$$;

/** Every file of a Space, one channel at a time. */
create or replace function public.space_files_of(space uuid, want text default 'draft')
returns table (path text, content text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.path, f.content, f.updated_at
    from public.space_files f
   where f.space_id = space
     and f.channel = want
     and (
       (want = 'live' and exists (
         select 1 from public.spaces s
          where s.id = space and s.is_published and not s.is_removed
       ))
       or public.can_edit_space(space)
       or public.is_moderator()
     )
   order by (f.path <> 'index.html'), f.path;
$$;

grant execute on function public.space_files_of to anon, authenticated;
grant execute on function public.save_space_file, public.delete_space_file,
  public.publish_space_files, public.revert_space_files to authenticated;
grant execute on function public.space_file_limit to anon, authenticated;
