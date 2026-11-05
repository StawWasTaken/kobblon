-- Signup details, the Kobbleston admin account, and Kobbleston Create.

-- ------------------------------------------------------------- signup data

alter table public.profiles
  add column birth_date date,
  add column gender text check (gender in ('male', 'female', 'other')),
  add column is_admin boolean not null default false;

-- Everything the signup form collects arrives as auth metadata and is written
-- here by the trigger, so the client never inserts its own profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(coalesce(meta->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'kobbler' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base := substr(base, 1, 16);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := substr(base, 1, 16) || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url, birth_date, gender)
  values (
    new.id,
    candidate,
    coalesce(nullif(meta->>'display_name', ''), candidate),
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'birth_date', '')::date,
    nullif(meta->>'gender', '')
  );

  insert into public.activity_events (kind, actor_id) values ('user_joined', new.id);
  return new;
end;
$$;

-- --------------------------------------------------------- creator uploads

create type public.asset_kind as enum ('image', 'audio', 'video', 'font', 'model');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles on delete cascade,
  kind public.asset_kind not null,
  name text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 400),
  file_path text not null,
  thumbnail_path text,
  byte_size bigint not null check (byte_size > 0),
  status public.moderation_status not null default 'pending',
  review_note text check (char_length(review_note) <= 500),
  reviewed_at timestamptz,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index assets_public_idx on public.assets (created_at desc) where status = 'approved';
create index assets_creator_idx on public.assets (creator_id, created_at desc);
create index assets_queue_idx on public.assets (created_at) where status = 'pending';

alter table public.assets enable row level security;

-- Only approved uploads are public. Creators always see their own, including
-- what is still in review or was rejected and why.
create policy assets_read_approved on public.assets for select
  using (status = 'approved' or creator_id = auth.uid() or public.is_moderator());

-- Uploads always enter the queue as pending: a client cannot publish directly.
create policy assets_insert_own on public.assets for insert
  with check (creator_id = auth.uid() and status = 'pending');

create policy assets_delete_own on public.assets for delete using (creator_id = auth.uid());

-- Status changes belong to the review pipeline, which runs as the service
-- role. Creators may only rename and re-describe their own upload.
create policy assets_update_own_metadata on public.assets for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid() and status = 'pending');

create or replace function public.increment_asset_download(target uuid)
returns void language sql security definer set search_path = public as $$
  update public.assets set download_count = download_count + 1
   where id = target and status = 'approved';
$$;

-- The creator marketplace, joined and already filtered to approved uploads.
create or replace function public.list_assets(
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
  created_at timestamptz,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  creator_is_admin boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.download_count, a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin
    from public.assets a
    join public.profiles p on p.id = a.creator_id and not p.is_suspended
   where a.status = 'approved'
     and (kind_filter is null or a.kind::text = kind_filter)
     and (search is null or a.name ilike '%' || search || '%')
   order by p.is_admin desc, a.created_at desc
   limit least(greatest(limit_count, 1), 60);
$$;

grant execute on function public.list_assets to anon, authenticated;
grant execute on function public.increment_asset_download to authenticated;
