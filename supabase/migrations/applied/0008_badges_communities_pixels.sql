-- Badges earned inside Spaces, Communities, follows and favourites, and
-- Pixels: the currency the platform runs on.

-- --------------------------------------------------------------- accounts

alter table public.profiles
  add column is_guest boolean not null default false,
  add column pixels integer not null default 0 check (pixels >= 0);

-- ----------------------------------------------------------------- follows

create table public.follows (
  follower_id uuid not null references public.profiles on delete cascade,
  following_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;
create policy follows_read on public.follows for select using (true);
create policy follows_insert_self on public.follows for insert with check (follower_id = auth.uid());
create policy follows_delete_self on public.follows for delete using (follower_id = auth.uid());

-- -------------------------------------------------------------- favourites

create table public.space_favorites (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index space_favorites_user_idx on public.space_favorites (user_id, created_at desc);

alter table public.spaces add column favorite_count integer not null default 0;
alter table public.space_favorites enable row level security;

create policy space_favorites_read on public.space_favorites for select using (true);
create policy space_favorites_insert_self on public.space_favorites for insert with check (user_id = auth.uid());
create policy space_favorites_delete_self on public.space_favorites for delete using (user_id = auth.uid());

create or replace function public.on_space_favorite_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.spaces set favorite_count = favorite_count + 1 where id = new.space_id;
    return new;
  end if;
  update public.spaces set favorite_count = greatest(favorite_count - 1, 0) where id = old.space_id;
  return old;
end;
$$;

create trigger space_favorites_change
  after insert or delete on public.space_favorites
  for each row execute function public.on_space_favorite_change();

-- ------------------------------------------------------------------ badges

create table public.space_badges (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 200),
  icon_url text,
  is_enabled boolean not null default true,
  awarded_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index space_badges_space_idx on public.space_badges (space_id, created_at);

create table public.badge_awards (
  badge_id uuid not null references public.space_badges on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (badge_id, user_id)
);

create index badge_awards_user_idx on public.badge_awards (user_id, awarded_at desc);

alter table public.space_badges enable row level security;
alter table public.badge_awards enable row level security;

-- Badges are part of a Space's public face, so anyone can see what is on
-- offer. Only the owner of the Space can add or change them.
create policy space_badges_read on public.space_badges for select
  using (exists (select 1 from public.spaces s where s.id = space_id
                 and ((s.is_published and not s.is_removed) or s.owner_id = auth.uid())));

create policy space_badges_write_owner on public.space_badges for all
  using (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()));

create policy badge_awards_read on public.badge_awards for select using (true);

-- Nobody writes an award directly, not even the Space owner: award_badge()
-- is the only way in, so the awarded count and the award cannot disagree.
create or replace function public.award_badge(badge uuid, recipient uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  fresh boolean;
begin
  select s.owner_id into owner
    from public.space_badges b
    join public.spaces s on s.id = b.space_id
   where b.id = badge and b.is_enabled;

  if owner is null then raise exception 'no such badge'; end if;
  if owner <> auth.uid() then raise exception 'only the Space owner can award this'; end if;

  insert into public.badge_awards (badge_id, user_id)
  values (badge, recipient)
  on conflict do nothing;

  get diagnostics fresh = row_count;
  if fresh then
    update public.space_badges set awarded_count = awarded_count + 1 where id = badge;
    insert into public.notifications (user_id, kind, actor_id, body)
    select recipient, 'system', owner, 'You earned a badge: ' || b.name
      from public.space_badges b where b.id = badge;
  end if;

  return fresh;
end;
$$;

grant execute on function public.award_badge to authenticated;

-- ------------------------------------------------------------- communities

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 1 and 48),
  description text check (char_length(description) <= 400),
  icon_url text,
  is_public boolean not null default true,
  is_removed boolean not null default false,
  member_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index communities_public_idx on public.communities (member_count desc)
  where is_public and not is_removed;

create type public.community_role as enum ('owner', 'admin', 'member');

create table public.community_members (
  community_id uuid not null references public.communities on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role public.community_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index community_members_user_idx on public.community_members (user_id);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

create policy communities_read on public.communities for select
  using ((is_public and not is_removed) or owner_id = auth.uid() or public.is_moderator());
create policy communities_insert_own on public.communities for insert with check (owner_id = auth.uid());
create policy communities_update_own on public.communities for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy community_members_read on public.community_members for select using (true);
create policy community_members_join on public.community_members for insert
  with check (user_id = auth.uid() and role = 'member');
create policy community_members_leave on public.community_members for delete
  using (user_id = auth.uid());

create or replace function public.on_community_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger communities_after_insert
  after insert on public.communities
  for each row execute function public.on_community_created();

create or replace function public.on_community_membership_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
    return new;
  end if;
  update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  return old;
end;
$$;

create trigger community_members_change
  after insert or delete on public.community_members
  for each row execute function public.on_community_membership_change();

-- ------------------------------------------------------------------ pixels
--
-- The balance on a profile is never written from the browser. Every movement
-- goes through spend_pixels() or grant_pixels() and leaves a row behind, so
-- the ledger and the balance always agree.

create table public.pixel_transactions (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index pixel_transactions_user_idx on public.pixel_transactions (user_id, created_at desc);

alter table public.pixel_transactions enable row level security;
create policy pixel_transactions_read_self on public.pixel_transactions for select
  using (user_id = auth.uid());

create or replace function public.move_pixels(
  target uuid, delta integer, movement text, memo text default null
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  balance integer;
begin
  update public.profiles
     set pixels = pixels + delta
   where id = target
  returning pixels into balance;

  if balance is null then raise exception 'no such account'; end if;

  insert into public.pixel_transactions (user_id, amount, kind, note)
  values (target, delta, movement, memo);

  return balance;
end;
$$;

revoke execute on function public.move_pixels from anon, authenticated;

-- Everyone starts with a handful so the currency is not dead on arrival.
create or replace function public.grant_signup_pixels()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_guest then
    perform public.move_pixels(new.id, 100, 'signup_grant', 'Welcome to Kobbleston');
  end if;
  return new;
end;
$$;

create trigger profiles_after_insert_pixels
  after insert on public.profiles
  for each row execute function public.grant_signup_pixels();
