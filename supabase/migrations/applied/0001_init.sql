-- Kobbleston core schema.
-- Run against the project with the Supabase SQL editor or `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique
    check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 32),
  bio text check (char_length(bio) <= 300),
  avatar_url text,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  in_space_id uuid,
  is_moderator boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (lower(username));
create index profiles_online_idx on public.profiles (is_online) where is_online;

-- ------------------------------------------------------------------ spaces

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 1 and 48),
  description text check (char_length(description) <= 400),
  category text not null default 'personal'
    check (category in ('personal','community','interactive','experiment','story','fan')),
  cover_url text,
  is_published boolean not null default false,
  is_removed boolean not null default false,
  visit_count bigint not null default 0,
  like_count integer not null default 0,
  update_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index spaces_published_idx on public.spaces (published_at desc)
  where is_published and not is_removed;
create index spaces_trending_idx on public.spaces (visit_count desc)
  where is_published and not is_removed;

alter table public.profiles
  add constraint profiles_in_space_fk
  foreign key (in_space_id) references public.spaces on delete set null;

-- --------------------------------------------------------- space activity

create table public.space_visits (
  id bigserial primary key,
  space_id uuid not null references public.spaces on delete cascade,
  visitor_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create index space_visits_space_idx on public.space_visits (space_id, created_at desc);

create table public.space_updates (
  id bigserial primary key,
  space_id uuid not null references public.spaces on delete cascade,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index space_updates_space_idx on public.space_updates (space_id, created_at desc);

create table public.space_likes (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- ----------------------------------------------------------------- social

create type public.friendship_status as enum ('pending','accepted','blocked');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles on delete cascade,
  addressee_id uuid not null references public.profiles on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id bigserial primary key,
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_removed boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create table public.notifications (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in
    ('friend_request','friend_accepted','space_like','space_visit','message','system')),
  actor_id uuid references public.profiles on delete set null,
  space_id uuid references public.spaces on delete cascade,
  body text check (char_length(body) <= 300),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ------------------------------------------------------------- moderation

create table public.reports (
  id bigserial primary key,
  reporter_id uuid not null references public.profiles on delete cascade,
  target_type text not null check (target_type in ('profile','space','message')),
  target_id text not null,
  reason text not null check (reason in
    ('harassment','spam','sexual','violence','impersonation','illegal','other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);

create table public.moderation_actions (
  id bigserial primary key,
  moderator_id uuid references public.profiles on delete set null,
  report_id bigint references public.reports on delete set null,
  action text not null check (action in ('remove_space','remove_message','suspend_user','warn','none')),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

-- --------------------------------------------------- public activity feed

create table public.activity_events (
  id bigserial primary key,
  kind text not null check (kind in ('space_published','space_updated','space_entered','user_joined')),
  actor_id uuid references public.profiles on delete cascade,
  space_id uuid references public.spaces on delete cascade,
  created_at timestamptz not null default now()
);

create index activity_events_recent_idx on public.activity_events (created_at desc);
