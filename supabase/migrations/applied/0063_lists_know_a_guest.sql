-- A guest wears the guest face wherever they turn up.
--
-- The lists on the friends page were handing back everything the page draws
-- except this, so somebody passing through showed whatever picture they had
-- set rather than the face that says what they are.

drop function if exists public.people_list(uuid, text);
create or replace function public.people_list(target uuid, which text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_online boolean,
  in_space_id uuid,
  activity text,
  last_seen_at timestamptz,
  is_verified boolean,
  is_guest boolean,
  is_admin boolean,
  content_id bigint,
  since timestamptz,
  link_id uuid,
  i_ignore boolean
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  chosen as (
    -- Friends of whoever is being looked at.
    select f.id as link_id,
           case when f.requester_id = target then f.addressee_id else f.requester_id end as person,
           coalesce(f.responded_at, f.created_at) as since
      from public.friendships f
     where which = 'friends' and f.status = 'accepted'
       and (f.requester_id = target or f.addressee_id = target)

    union all

    -- Requests waiting on you, which only ever means your own.
    select f.id, f.requester_id, f.created_at
      from public.friendships f
     where which = 'requests' and f.status = 'pending'
       and f.addressee_id = target and target = (select id from me)

    union all

    -- Requests you sent and nobody has answered.
    select f.id, f.addressee_id, f.created_at
      from public.friendships f
     where which = 'sent' and f.status = 'pending'
       and f.requester_id = target and target = (select id from me)

    union all

    select null::uuid, x.follower_id, x.created_at
      from public.follows x
     where which = 'followers' and x.following_id = target

    union all

    select null::uuid, x.following_id, x.created_at
      from public.follows x
     where which = 'following' and x.follower_id = target

    union all

    select null::uuid, b.blocked_id, b.created_at
      from public.blocks b
     where which = 'blocked' and b.blocker_id = target and target = (select id from me)

    union all

    select null::uuid, i.ignored_id, i.created_at
      from public.ignores i
     where which = 'ignored' and i.ignorer_id = target and target = (select id from me)
  )
  select p.id, p.username, p.display_name, p.avatar_url, p.bio,
         p.is_online, p.in_space_id, p.activity::text, p.last_seen_at,
         p.is_verified or p.is_admin, p.is_guest, p.is_admin, p.content_id,
         chosen.since, chosen.link_id,
         exists (select 1 from public.ignores i
                  where i.ignorer_id = (select id from me) and i.ignored_id = p.id)
    from chosen
    join public.profiles p on p.id = chosen.person
   where not p.is_suspended
     and (which in ('blocked', 'ignored') or not public.blocked_between((select id from me), p.id))
   order by chosen.since desc;
$$;

grant execute on function public.people_list to authenticated;
