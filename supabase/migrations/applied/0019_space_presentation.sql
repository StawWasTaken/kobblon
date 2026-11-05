-- How a Space presents itself, and the numbers under it.

alter table public.spaces
  add column if not exists emblem_url text,
  add column if not exists thumbnail_urls text[] not null default '{}',
  add column if not exists genre text not null default 'other'
    check (genre in ('other','personal','community','game','art','music','story','tools','fan')),
  add column if not exists dislike_count integer not null default 0;

create table if not exists public.space_dislikes (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

alter table public.space_dislikes enable row level security;
drop policy if exists space_dislikes_read on public.space_dislikes;
create policy space_dislikes_read on public.space_dislikes for select using (true);
drop policy if exists space_dislikes_write on public.space_dislikes;
create policy space_dislikes_write on public.space_dislikes for insert
  with check (user_id = auth.uid() and not public.is_guest());
drop policy if exists space_dislikes_delete on public.space_dislikes;
create policy space_dislikes_delete on public.space_dislikes for delete using (user_id = auth.uid());

create or replace function public.on_space_dislike_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.spaces set dislike_count = dislike_count + 1 where id = new.space_id;
    -- A dislike and a like are exclusive.
    delete from public.space_likes where space_id = new.space_id and user_id = new.user_id;
    return new;
  end if;
  update public.spaces set dislike_count = greatest(dislike_count - 1, 0) where id = old.space_id;
  return old;
end;
$$;

drop trigger if exists space_dislikes_change on public.space_dislikes;
create trigger space_dislikes_change
  after insert or delete on public.space_dislikes
  for each row execute function public.on_space_dislike_change();

create or replace function public.on_space_like_exclusive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.space_dislikes where space_id = new.space_id and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists space_likes_exclusive on public.space_likes;
create trigger space_likes_exclusive
  after insert on public.space_likes
  for each row execute function public.on_space_like_exclusive();

-- ----------------------------------------------------------------- notify

create table if not exists public.space_watchers (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

alter table public.space_watchers enable row level security;
drop policy if exists space_watchers_read_own on public.space_watchers;
create policy space_watchers_read_own on public.space_watchers for select
  using (user_id = auth.uid());
drop policy if exists space_watchers_write_own on public.space_watchers;
create policy space_watchers_write_own on public.space_watchers for insert
  with check (user_id = auth.uid() and not public.is_guest());
drop policy if exists space_watchers_delete_own on public.space_watchers;
create policy space_watchers_delete_own on public.space_watchers for delete
  using (user_id = auth.uid());

-- An update tells everyone watching.
create or replace function public.notify_watchers()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, actor_id, space_id, body)
  select w.user_id, 'system', s.owner_id, s.id, s.name || ' was updated'
    from public.space_watchers w
    join public.spaces s on s.id = w.space_id
   where w.space_id = new.space_id and w.user_id <> s.owner_id;
  return new;
end;
$$;

drop trigger if exists space_updates_notify on public.space_updates;
create trigger space_updates_notify
  after insert on public.space_updates
  for each row execute function public.notify_watchers();

-- --------------------------------------------------------------- the stats

/** Everything under the Enter button, counted at the moment it is asked for. */
create or replace function public.space_stats(target uuid)
returns table (
  active_now bigint,
  visits bigint,
  favorites integer,
  likes integer,
  dislikes integer,
  updates integer,
  created_at timestamptz,
  updated_at timestamptz,
  genre text,
  i_like boolean,
  i_dislike boolean,
  i_favorite boolean,
  i_watch boolean
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.profiles p
      where p.in_space_id = s.id and p.is_online and p.last_seen_at > now() - interval '5 minutes'),
    s.visit_count, s.favorite_count, s.like_count, s.dislike_count, s.update_count,
    s.created_at, s.updated_at, s.genre,
    exists (select 1 from public.space_likes l where l.space_id = s.id and l.user_id = auth.uid()),
    exists (select 1 from public.space_dislikes d where d.space_id = s.id and d.user_id = auth.uid()),
    exists (select 1 from public.space_favorites f where f.space_id = s.id and f.user_id = auth.uid()),
    exists (select 1 from public.space_watchers w where w.space_id = s.id and w.user_id = auth.uid())
  from public.spaces s
  where s.id = target;
$$;

grant execute on function public.space_stats to anon, authenticated;
