-- An item on Create can be rated and reviewed, the same way a Space can be
-- liked. Ratings are a plain thumb either way; reviews are text, so they go
-- through the same screening everything else written here goes through.

create table if not exists public.asset_ratings (
  asset_id uuid not null references public.assets on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  up boolean not null,
  created_at timestamptz not null default now(),
  primary key (asset_id, user_id)
);

create index if not exists asset_ratings_asset_idx on public.asset_ratings (asset_id);

alter table public.asset_ratings enable row level security;

drop policy if exists asset_ratings_read on public.asset_ratings;
create policy asset_ratings_read on public.asset_ratings for select using (true);

-- You rate for yourself, and not on your own work: a creator voting for
-- their own upload is not a rating, it is noise.
drop policy if exists asset_ratings_write on public.asset_ratings;
create policy asset_ratings_write on public.asset_ratings for insert
  with check (
    user_id = auth.uid()
    and not public.is_guest()
    and not exists (select 1 from public.assets a
                     where a.id = asset_id and a.creator_id = auth.uid())
  );

drop policy if exists asset_ratings_change on public.asset_ratings;
create policy asset_ratings_change on public.asset_ratings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists asset_ratings_remove on public.asset_ratings;
create policy asset_ratings_remove on public.asset_ratings for delete
  using (user_id = auth.uid());

create table if not exists public.asset_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now(),
  unique (asset_id, user_id)
);

create index if not exists asset_reviews_asset_idx on public.asset_reviews (asset_id, created_at desc);

alter table public.asset_reviews enable row level security;

drop policy if exists asset_reviews_read on public.asset_reviews;
create policy asset_reviews_read on public.asset_reviews for select using (true);

drop policy if exists asset_reviews_write on public.asset_reviews;
create policy asset_reviews_write on public.asset_reviews for insert
  with check (user_id = auth.uid() and not public.is_guest());

drop policy if exists asset_reviews_change on public.asset_reviews;
create policy asset_reviews_change on public.asset_reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Your own review, or the creator clearing something off their item.
drop policy if exists asset_reviews_remove on public.asset_reviews;
create policy asset_reviews_remove on public.asset_reviews for delete
  using (user_id = auth.uid() or public.owns_asset(asset_id) or public.is_moderator());

create or replace function public.screen_asset_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare verdict public.screen_decision;
begin
  verdict := (public.screen_text(new.body)).decision;
  if verdict = 'block' then
    raise exception 'That review is not allowed here.';
  end if;
  return new;
end;
$$;

drop trigger if exists screen_asset_review on public.asset_reviews;
create trigger screen_asset_review before insert or update on public.asset_reviews
  for each row execute function public.screen_asset_review();

-- Reviews with the person who wrote them, newest first.
drop function if exists public.asset_reviews_of(uuid);
create function public.asset_reviews_of(target uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_guest boolean,
  up boolean
)
language sql stable security definer set search_path = public as $$
  select r.id, r.body, r.created_at, p.id, p.username, p.display_name, p.avatar_url, p.is_guest,
         (select g.up from public.asset_ratings g
           where g.asset_id = r.asset_id and g.user_id = r.user_id)
    from public.asset_reviews r
    join public.profiles p on p.id = r.user_id and not p.is_suspended
   where r.asset_id = target
   order by r.created_at desc
   limit 50;
$$;

grant execute on function public.asset_reviews_of to anon, authenticated;

-- The item page carries the score, the number of votes, the number of
-- reviews and where the person looking at it stands.
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
  creator_is_admin boolean,
  i_can_use boolean,
  i_asked boolean,
  votes bigint,
  score integer,
  review_count bigint,
  my_vote boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.byte_size, a.download_count, a.content_id, a.status, a.is_public,
         case when a.creator_id = auth.uid() or public.is_moderator()
              then a.review_note end,
         a.created_at, a.updated_at,
         p.id, p.username, p.display_name, p.avatar_url, p.is_admin,
         public.can_use_asset(a.id),
         exists (select 1 from public.asset_grants g
                  where g.asset_id = a.id and g.user_id = auth.uid()),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_reviews v where v.asset_id = a.id),
         (select r.up from public.asset_ratings r
           where r.asset_id = a.id and r.user_id = auth.uid())
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

-- Other work by the same person, for the row at the bottom of an item.
drop function if exists public.assets_by_creator(uuid, uuid, integer);
create function public.assets_by_creator(
  target uuid, except_id uuid default null, limit_count integer default 12
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
   where a.creator_id = target
     and a.status = 'approved'
     and a.is_public
     and (except_id is null or a.id <> except_id)
   order by a.created_at desc
   limit least(greatest(limit_count, 1), 24);
$$;

grant execute on function public.assets_by_creator to anon, authenticated;
