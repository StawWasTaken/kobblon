-- Communities, properly: branding, ranks with real permissions, join
-- approval, member moderation, a wall, announcements, linked Spaces and an
-- audit trail.

alter table public.communities
  add column banner_url text,
  add column join_policy text not null default 'open'
    check (join_policy in ('open', 'approval')),
  add column is_verified boolean not null default false,
  add column funds integer not null default 0 check (funds >= 0);

alter table public.communities
  drop constraint if exists communities_description_check;
alter table public.communities
  add constraint communities_description_check check (char_length(description) <= 1000);

-- ------------------------------------------------------------------- ranks
--
-- Roblox style: a number from 1 to 254 with a name, and permissions attached
-- to the rank rather than to the person.

create table public.community_ranks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities on delete cascade,
  rank smallint not null check (rank between 1 and 254),
  name text not null check (char_length(name) between 1 and 32),
  can_post_wall boolean not null default true,
  can_moderate_wall boolean not null default false,
  can_manage_members boolean not null default false,
  can_manage_ranks boolean not null default false,
  can_manage_community boolean not null default false,
  can_manage_spaces boolean not null default false,
  created_at timestamptz not null default now(),
  unique (community_id, rank)
);

create index community_ranks_community_idx on public.community_ranks (community_id, rank desc);

alter table public.community_members
  add column rank_id uuid references public.community_ranks on delete set null;

-- --------------------------------------------------- requests, bans, walls

create table public.community_join_requests (
  community_id uuid not null references public.communities on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.community_bans (
  community_id uuid not null references public.communities on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  reason text check (char_length(reason) <= 200),
  banned_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.community_posts (
  id bigserial primary key,
  community_id uuid not null references public.communities on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_announcement boolean not null default false,
  is_removed boolean not null default false,
  created_at timestamptz not null default now()
);

create index community_posts_recent_idx on public.community_posts (community_id, created_at desc);

create table public.community_spaces (
  community_id uuid not null references public.communities on delete cascade,
  space_id uuid not null references public.spaces on delete cascade,
  added_at timestamptz not null default now(),
  primary key (community_id, space_id)
);

create table public.community_audit (
  id bigserial primary key,
  community_id uuid not null references public.communities on delete cascade,
  actor_id uuid references public.profiles on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index community_audit_recent_idx on public.community_audit (community_id, created_at desc);

-- -------------------------------------------------------------- permission

/** Whether someone holds a named permission in a community. */
create or replace function public.community_can(community uuid, permission text, who uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  allowed boolean;
begin
  if who is null then return false; end if;

  -- The owner always can, whatever the ranks say.
  if exists (select 1 from public.communities c where c.id = community and c.owner_id = who) then
    return true;
  end if;

  execute format(
    'select coalesce(r.%I, false)
       from public.community_members m
       join public.community_ranks r on r.id = m.rank_id
      where m.community_id = $1 and m.user_id = $2',
    permission
  ) into allowed using community, who;

  return coalesce(allowed, false);
end;
$$;

grant execute on function public.community_can to authenticated;

create or replace function public.log_community(community uuid, action text, detail text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.community_audit (community_id, actor_id, action, detail)
  values (community, auth.uid(), action, detail);
$$;

-- ------------------------------------------------------------------ making
--
-- Creating a community costs Pixels, which is what stops the name space
-- filling with throwaways.

create or replace function public.create_community(
  name text,
  slug text,
  description text default null,
  icon_url text default null,
  banner_url text default null,
  join_policy text default 'open'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cost constant integer := 100;
  balance integer;
  community uuid;
  owner_rank uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_guest() then raise exception 'Guests cannot make a Community.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < cost then
    raise exception 'Making a Community costs % Pixels. You have %.', cost, balance;
  end if;

  insert into public.communities (owner_id, slug, name, description, icon_url, banner_url, join_policy)
  values (me, slug, name, nullif(trim(description), ''), icon_url, banner_url, join_policy)
  returning id into community;

  -- Two ranks to begin with: the one that runs it and the one everyone else
  -- lands on.
  insert into public.community_ranks
    (community_id, rank, name, can_post_wall, can_moderate_wall,
     can_manage_members, can_manage_ranks, can_manage_community, can_manage_spaces)
  values (community, 254, 'Owner', true, true, true, true, true, true)
  returning id into owner_rank;

  insert into public.community_ranks (community_id, rank, name)
  values (community, 1, 'Member');

  update public.community_members
     set role = 'owner', rank_id = owner_rank
   where community_id = community and user_id = me;

  perform public.move_pixels(me, -cost, 'purchase', 'Created the Community ' || name);
  perform public.log_community(community, 'created', name);

  return community;
end;
$$;

grant execute on function public.create_community to authenticated;

-- ------------------------------------------------------------- joining etc

create or replace function public.join_community(community uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  policy text;
  member_rank uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_guest() then raise exception 'Guests cannot join a Community.'; end if;

  if exists (select 1 from public.community_bans where community_id = community and user_id = me) then
    raise exception 'You are banned from this Community.';
  end if;

  select join_policy into policy from public.communities
   where id = community and is_public and not is_removed;
  if policy is null then raise exception 'no such Community'; end if;

  if policy = 'approval' then
    insert into public.community_join_requests (community_id, user_id)
    values (community, me) on conflict do nothing;
    return 'requested';
  end if;

  select id into member_rank from public.community_ranks
   where community_id = community order by rank limit 1;

  insert into public.community_members (community_id, user_id, rank_id)
  values (community, me, member_rank) on conflict do nothing;

  return 'joined';
end;
$$;

create or replace function public.answer_join_request(community uuid, applicant uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  member_rank uuid;
begin
  if not public.community_can(community, 'can_manage_members') then
    raise exception 'You cannot manage members here.';
  end if;

  delete from public.community_join_requests
   where community_id = community and user_id = applicant;

  if accept then
    select id into member_rank from public.community_ranks
     where community_id = community order by rank limit 1;

    insert into public.community_members (community_id, user_id, rank_id)
    values (community, applicant, member_rank) on conflict do nothing;

    perform public.log_community(community, 'accepted', applicant::text);
  else
    perform public.log_community(community, 'declined', applicant::text);
  end if;
end;
$$;

create or replace function public.set_member_rank(community uuid, target uuid, new_rank uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  if not public.community_can(community, 'can_manage_ranks') then
    raise exception 'You cannot manage ranks here.';
  end if;

  select owner_id into owner from public.communities where id = community;
  if target = owner then raise exception 'The owner keeps their rank.'; end if;

  if not exists (select 1 from public.community_ranks where id = new_rank and community_id = community) then
    raise exception 'That rank is not in this Community.';
  end if;

  update public.community_members set rank_id = new_rank
   where community_id = community and user_id = target;

  perform public.log_community(community, 'ranked', target::text);
end;
$$;

create or replace function public.remove_member(community uuid, target uuid, ban boolean default false, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  if not public.community_can(community, 'can_manage_members') then
    raise exception 'You cannot manage members here.';
  end if;

  select owner_id into owner from public.communities where id = community;
  if target = owner then raise exception 'The owner cannot be removed.'; end if;

  delete from public.community_members where community_id = community and user_id = target;

  if ban then
    insert into public.community_bans (community_id, user_id, reason)
    values (community, target, nullif(trim(reason), ''))
    on conflict (community_id, user_id) do update set reason = excluded.reason;
  end if;

  perform public.log_community(community, case when ban then 'banned' else 'removed' end, target::text);
end;
$$;

grant execute on function public.join_community, public.answer_join_request,
  public.set_member_rank, public.remove_member to authenticated;
