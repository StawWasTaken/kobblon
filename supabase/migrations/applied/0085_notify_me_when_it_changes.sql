-- Telling people a World changed.
--
-- Somebody who liked a World wants to know when it gets bigger. That is one
-- table of who asked, one column so a notification can point at a World
-- rather than a Space, and one function that the owner calls when they have
-- something to say.
--
-- Deliberately not automatic. Every save would be a notification, and a
-- platform that tells you eleven times a day that somebody moved a wall is a
-- platform whose notifications get switched off. An update is a thing the
-- creator decides to announce.

create table if not exists public.world_watchers (
  world_id uuid not null references public.worlds on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);

create index if not exists world_watchers_user_idx
  on public.world_watchers (user_id, created_at desc);

alter table public.world_watchers enable row level security;

drop policy if exists world_watchers_read on public.world_watchers;
create policy world_watchers_read on public.world_watchers for select using (true);

/* Only you decide what you are told about, and only about a World that is out. */
drop policy if exists world_watchers_mine on public.world_watchers;
create policy world_watchers_mine on public.world_watchers for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.worlds w
       where w.id = world_watchers.world_id and w.is_published and not w.is_removed
    )
  );

drop policy if exists world_watchers_drop_mine on public.world_watchers;
create policy world_watchers_drop_mine on public.world_watchers for delete to authenticated
  using (user_id = auth.uid());

grant select on public.world_watchers to anon, authenticated;
grant insert, delete on public.world_watchers to authenticated;

-- ------------------------------------------- a notification about a World

/*
 * The table has carried space_id since the first migration. A World is not a
 * Space, so it gets its own column rather than borrowing that one: reusing
 * it would mean every reader having to know which of the two a row meant.
 */
alter table public.notifications
  add column if not exists world_id uuid references public.worlds on delete cascade;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'space_like', 'space_visit',
                  'message', 'system', 'event_started', 'world_updated'));

/**
 * What somebody has asked to be told about, for drawing the button.
 */
create or replace function public.do_i_watch_world(which uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.world_watchers w
     where w.world_id = which and w.user_id = auth.uid()
  )
$$;

grant execute on function public.do_i_watch_world(uuid) to anon, authenticated;

/**
 * The owner announcing that their World changed.
 *
 * Writes one notification per watcher, in one statement, and stamps the
 * World as updated. Capped at a few an hour: a notification everybody has
 * agreed to receive is still a notification that can be abused.
 */
create or replace function public.announce_world_update(which uuid, note text default null)
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  mine public.worlds;
  recent integer;
  told integer;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  select * into mine from public.worlds where id = which and not is_removed;
  if mine.id is null then
    raise exception 'There is no World with that number.';
  end if;

  if mine.owner_id <> me and not public.is_moderator() then
    raise exception 'That is not your World.';
  end if;

  if not mine.is_published then
    raise exception 'Publish it before telling people about it.';
  end if;

  select count(*) into recent
    from public.notifications
   where world_id = which
     and kind = 'world_updated'
     and created_at > now() - interval '6 hours';

  if recent > 0 then
    raise exception 'That World was announced in the last six hours. Give people a rest.';
  end if;

  insert into public.notifications (user_id, kind, actor_id, world_id, body)
  select w.user_id, 'world_updated', me, which,
         left(coalesce(nullif(btrim(note), ''), mine.name || ' was updated.'), 300)
    from public.world_watchers w
   where w.user_id <> me;

  get diagnostics told = row_count;

  update public.worlds set updated_at = now() where id = which;
  return told;
end $$;

revoke all on function public.announce_world_update(uuid, text) from public, anon;
grant execute on function public.announce_world_update(uuid, text) to authenticated;
