-- Guests, and the reads the profile and Space pages need.

-- A guest is a real but throwaway account, created by Supabase anonymous
-- sign-in. They can look around and enter Spaces; they get no Pixels, and
-- the name makes clear what they are.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  guest boolean := coalesce(new.is_anonymous, false);
  base text;
  candidate text;
  n int := 0;
begin
  if guest then
    candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
      candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    end loop;

    insert into public.profiles (id, username, display_name, avatar_url, is_guest)
    values (new.id, candidate, candidate, nullif(meta->>'avatar_url', ''), true);
    return new;
  end if;

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

-- Guests are passing through, so they stay out of the public counts.
create or replace function public.platform_stats()
returns table (
  total_visits bigint,
  published_spaces bigint,
  total_updates bigint,
  total_accounts bigint,
  people_online bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(visit_count) from public.spaces where is_published and not is_removed), 0),
    (select count(*) from public.spaces where is_published and not is_removed),
    (select count(*) from public.space_updates),
    (select count(*) from public.profiles where not is_suspended and not is_guest),
    (select count(*) from public.profiles
      where is_online and not is_guest and last_seen_at > now() - interval '5 minutes');
$$;

create or replace function public.recent_activity(limit_count int default 12)
returns table (
  id bigint,
  kind text,
  created_at timestamptz,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text,
  space_id uuid,
  space_name text,
  space_slug text
)
language sql stable security definer set search_path = public as $$
  select e.id, e.kind, e.created_at,
         p.username, p.display_name, p.avatar_url,
         s.id, s.name, s.slug
    from public.activity_events e
    join public.profiles p on p.id = e.actor_id and not p.is_suspended and not p.is_guest
    left join public.spaces s on s.id = e.space_id
   where (e.space_id is null or (s.is_published and not s.is_removed))
   order by e.created_at desc
   limit least(greatest(limit_count, 1), 50);
$$;

-- ------------------------------------------------------------ page reads

-- Everything the profile page shows that is not a plain table read.
create or replace function public.profile_overview(target uuid)
returns table (
  follower_count bigint,
  following_count bigint,
  friend_count bigint,
  badge_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.follows where following_id = target),
    (select count(*) from public.follows where follower_id = target),
    (select count(*) from public.friendships
      where status = 'accepted' and (requester_id = target or addressee_id = target)),
    (select count(*) from public.badge_awards where user_id = target);
$$;

-- Badges someone has earned, with the Space each came from.
create or replace function public.earned_badges(target uuid, limit_count int default 24)
returns table (
  id uuid,
  name text,
  description text,
  icon_url text,
  awarded_at timestamptz,
  space_name text,
  space_slug text,
  space_owner text
)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, b.description, b.icon_url, a.awarded_at,
         s.name, s.slug, o.username
    from public.badge_awards a
    join public.space_badges b on b.id = a.badge_id
    join public.spaces s on s.id = b.space_id
    join public.profiles o on o.id = s.owner_id
   where a.user_id = target and s.is_published and not s.is_removed
   order by a.awarded_at desc
   limit least(greatest(limit_count, 1), 60);
$$;

-- Communities someone belongs to.
create or replace function public.member_communities(target uuid)
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  member_count integer,
  role public.community_role
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.icon_url, c.member_count, m.role
    from public.community_members m
    join public.communities c on c.id = m.community_id
   where m.user_id = target and c.is_public and not c.is_removed
   order by c.member_count desc;
$$;

grant execute on function public.profile_overview, public.earned_badges,
  public.member_communities to anon, authenticated;
