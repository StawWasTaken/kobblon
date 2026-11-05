-- Working as a Community means Create shows that Community's work, not
-- yours: its uploads, its numbers, its Spaces.

/*
 * Everything a Community has uploaded, including what is still in review or
 * has been turned down, for the people who run it. Same shape as a person's
 * own uploads so the interface can show either.
 */
drop function if exists public.community_uploads(uuid);
create function public.community_uploads(target uuid)
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  description text,
  file_path text,
  status public.moderation_status,
  review_note text,
  byte_size bigint,
  download_count integer,
  content_id bigint,
  is_public boolean,
  price integer,
  created_at timestamptz,
  uploaded_by text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.status, a.review_note,
         a.byte_size, a.download_count, a.content_id, a.is_public, a.price, a.created_at,
         p.username
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.community_id = target
     and public.community_can(target, 'can_manage_spaces')
   order by a.created_at desc;
$$;

grant execute on function public.community_uploads to authenticated;

-- The same numbers a person sees for their own work, for a Community's.
drop function if exists public.community_analytics(uuid);
create function public.community_analytics(target uuid)
returns table (
  asset_id uuid,
  name text,
  kind public.asset_kind,
  content_id bigint,
  status public.moderation_status,
  is_public boolean,
  views bigint,
  uses bigint,
  pending_requests bigint,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.kind, a.content_id, a.status, a.is_public,
         count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind in ('use', 'download')),
         0::bigint,
         a.created_at
    from public.assets a
    left join public.asset_events e on e.asset_id = a.id
   where a.community_id = target
     and public.community_can(target, 'can_manage_spaces')
   group by a.id
   order by a.created_at desc;
$$;

grant execute on function public.community_analytics to authenticated;

-- What a Community has made, including drafts, for the people who run it.
drop function if exists public.community_spaces_managed(uuid);
create function public.community_spaces_managed(target uuid)
returns setof public.spaces
language sql stable security definer set search_path = public as $$
  select s.*
    from public.community_spaces cs
    join public.spaces s on s.id = cs.space_id
   where cs.community_id = target
     and not s.is_removed
     and public.community_can(target, 'can_manage_spaces')
   order by s.updated_at desc;
$$;

grant execute on function public.community_spaces_managed to authenticated;

-- Verification is its own thing rather than a side effect of being staff: an
-- account can be vouched for without being able to moderate anything.
alter table public.profiles add column if not exists is_verified boolean not null default false;

-- The Kobbleston account itself is verified, and so is anything it runs.
update public.profiles set is_verified = true where is_admin;

-- The roster carries whether somebody is verified and whether they are a
-- guest, so a member list can show a tick and the guest face.
drop function if exists public.community_roster(uuid, int);
create function public.community_roster(community uuid, limit_count int default 60)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_online boolean,
  is_guest boolean,
  is_verified boolean,
  content_id bigint,
  in_space_id uuid,
  rank_id uuid,
  rank_name text,
  rank_number smallint,
  joined_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.is_online, p.is_guest,
         p.is_verified or p.is_admin, p.content_id, p.in_space_id,
         k.id, k.name, k.rank, m.joined_at
    from public.community_members m
    join public.profiles p on p.id = m.user_id
    left join public.community_ranks k on k.id = m.rank_id
   where m.community_id = community and not p.is_suspended
   order by coalesce(k.rank, 0) desc, m.joined_at
   limit least(greatest(limit_count, 1), 200);
$$;

grant execute on function public.community_roster to anon, authenticated;
