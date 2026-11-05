-- Liking a World, not liking it, and keeping it.
--
-- The World page is about to show all three, and a page that shows a number
-- nothing can change is a drawing of a page. Spaces have had this since the
-- first migration; Worlds get the same shape, because two shapes for the
-- same idea is how a platform ends up with two of everything.
--
-- A like and a dislike are one row with a flag rather than two tables: a
-- person has one opinion, and changing it should be an update rather than a
-- delete and an insert that can both half happen.

create table if not exists public.world_opinions (
  world_id uuid not null references public.worlds on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  /** True for a like, false for a dislike. */
  likes boolean not null,
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);

create index if not exists world_opinions_user_idx
  on public.world_opinions (user_id, created_at desc);

create table if not exists public.world_favourites (
  world_id uuid not null references public.worlds on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (world_id, user_id)
);

create index if not exists world_favourites_user_idx
  on public.world_favourites (user_id, created_at desc);

alter table public.worlds add column if not exists dislike_count integer not null default 0;
alter table public.worlds add column if not exists favourite_count integer not null default 0;

/*
 * The counts are kept on the World so that a list of forty Worlds is forty
 * numbers rather than forty counts over another table.
 */
create or replace function public.on_world_opinion_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.worlds
       set like_count    = greatest(like_count    - (case when old.likes then 1 else 0 end), 0),
           dislike_count = greatest(dislike_count - (case when old.likes then 0 else 1 end), 0)
     where id = old.world_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update public.worlds
       set like_count    = like_count    + (case when new.likes then 1 else 0 end),
           dislike_count = dislike_count + (case when new.likes then 0 else 1 end)
     where id = new.world_id;
    return new;
  end if;

  return old;
end $$;

drop trigger if exists world_opinions_change on public.world_opinions;
create trigger world_opinions_change
  after insert or update or delete on public.world_opinions
  for each row execute function public.on_world_opinion_change();

create or replace function public.on_world_favourite_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    update public.worlds set favourite_count = favourite_count + 1 where id = new.world_id;
    return new;
  end if;
  update public.worlds set favourite_count = greatest(favourite_count - 1, 0) where id = old.world_id;
  return old;
end $$;

drop trigger if exists world_favourites_change on public.world_favourites;
create trigger world_favourites_change
  after insert or delete on public.world_favourites
  for each row execute function public.on_world_favourite_change();

alter table public.world_opinions enable row level security;
alter table public.world_favourites enable row level security;

/*
 * Anybody may see what people think. Only you may say what you think, and
 * only about a World that is actually out: an opinion about something
 * nobody can see is a way to warm up a number before anyone can check it.
 */
drop policy if exists world_opinions_read on public.world_opinions;
create policy world_opinions_read on public.world_opinions for select using (true);

drop policy if exists world_opinions_mine on public.world_opinions;
create policy world_opinions_mine on public.world_opinions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.worlds w
       where w.id = world_opinions.world_id and w.is_published and not w.is_removed
    )
  );

drop policy if exists world_opinions_change_mine on public.world_opinions;
create policy world_opinions_change_mine on public.world_opinions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists world_opinions_drop_mine on public.world_opinions;
create policy world_opinions_drop_mine on public.world_opinions for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists world_favourites_read on public.world_favourites;
create policy world_favourites_read on public.world_favourites for select using (true);

drop policy if exists world_favourites_mine on public.world_favourites;
create policy world_favourites_mine on public.world_favourites for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.worlds w
       where w.id = world_favourites.world_id and w.is_published and not w.is_removed
    )
  );

drop policy if exists world_favourites_drop_mine on public.world_favourites;
create policy world_favourites_drop_mine on public.world_favourites for delete to authenticated
  using (user_id = auth.uid());

grant select on public.world_opinions, public.world_favourites to anon, authenticated;
grant insert, update, delete on public.world_opinions, public.world_favourites to authenticated;

/**
 * What the person reading the page has already said about this World.
 *
 * One call rather than three, because the page asks all of it at once and
 * three round trips to draw one row of buttons is three too many.
 */
create or replace function public.my_world_standing(which uuid)
returns table (opinion boolean, favourited boolean)
language sql stable security definer set search_path = public, extensions as $$
  select (select o.likes from public.world_opinions o
           where o.world_id = which and o.user_id = auth.uid()),
         exists (select 1 from public.world_favourites f
                  where f.world_id = which and f.user_id = auth.uid())
$$;

grant execute on function public.my_world_standing(uuid) to anon, authenticated;

/**
 * Saying what you think, or taking it back.
 *
 * `null` means no opinion, which is a different thing from a dislike and is
 * how somebody undoes a press.
 */
create or replace function public.set_world_opinion(which uuid, think boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  if not exists (select 1 from public.worlds w
                  where w.id = which and w.is_published and not w.is_removed) then
    raise exception 'There is no World with that number.';
  end if;

  if think is null then
    delete from public.world_opinions where world_id = which and user_id = me;
    return;
  end if;

  insert into public.world_opinions (world_id, user_id, likes)
  values (which, me, think)
  on conflict (world_id, user_id) do update set likes = excluded.likes
  where public.world_opinions.likes is distinct from excluded.likes;
end $$;

/*
 * Granting to authenticated does not take it away from anybody else: a new
 * function is executable by public until it is told otherwise, and a guest
 * reaching this would be voting.
 */
revoke all on function public.set_world_opinion(uuid, boolean) from public, anon;
grant execute on function public.set_world_opinion(uuid, boolean) to authenticated;
