-- Row level security for everything a Community holds, plus the reads its
-- pages need.

alter table public.community_ranks         enable row level security;
alter table public.community_join_requests enable row level security;
alter table public.community_bans          enable row level security;
alter table public.community_posts         enable row level security;
alter table public.community_spaces        enable row level security;
alter table public.community_audit         enable row level security;

-- Ranks are part of a Community's public face, so anyone can see the ladder.
create policy community_ranks_read on public.community_ranks for select using (true);
create policy community_ranks_write on public.community_ranks for all
  using (public.community_can(community_id, 'can_manage_ranks'))
  with check (public.community_can(community_id, 'can_manage_ranks'));

-- Someone always sees their own request; managers see the queue.
create policy community_requests_read on public.community_join_requests for select
  using (user_id = auth.uid() or public.community_can(community_id, 'can_manage_members'));
create policy community_requests_cancel on public.community_join_requests for delete
  using (user_id = auth.uid() or public.community_can(community_id, 'can_manage_members'));

create policy community_bans_read on public.community_bans for select
  using (user_id = auth.uid() or public.community_can(community_id, 'can_manage_members'));
create policy community_bans_lift on public.community_bans for delete
  using (public.community_can(community_id, 'can_manage_members'));

-- The wall is readable by anyone who can see the Community.
create policy community_posts_read on public.community_posts for select
  using (
    not is_removed
    and exists (select 1 from public.communities c
                 where c.id = community_id and c.is_public and not c.is_removed)
  );

create policy community_posts_write on public.community_posts for insert
  with check (
    author_id = auth.uid()
    and not public.is_guest()
    and public.community_can(community_id, 'can_post_wall')
    and (not is_announcement or public.community_can(community_id, 'can_manage_community'))
  );

-- Your own post, or anyone's if you moderate the wall.
create policy community_posts_remove on public.community_posts for update
  using (author_id = auth.uid() or public.community_can(community_id, 'can_moderate_wall'))
  with check (author_id = auth.uid() or public.community_can(community_id, 'can_moderate_wall'));

create policy community_spaces_read on public.community_spaces for select using (true);
create policy community_spaces_write on public.community_spaces for all
  using (public.community_can(community_id, 'can_manage_spaces'))
  with check (
    public.community_can(community_id, 'can_manage_spaces')
    -- and only a Space you actually own
    and exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid())
  );

create policy community_audit_read on public.community_audit for select
  using (public.community_can(community_id, 'can_manage_members'));

-- Editing the Community itself follows the permission, not just ownership.
drop policy if exists communities_update_own on public.communities;
create policy communities_update_own on public.communities for update
  using (public.community_can(id, 'can_manage_community'))
  with check (public.community_can(id, 'can_manage_community'));

-- Leaving stays self service; everything else about membership goes through
-- the functions, which check the permission first.
drop policy if exists community_members_join on public.community_members;
create policy community_members_leave_only on public.community_members for delete
  using (user_id = auth.uid());

-- Wall posts are screened like everything else people write.
create or replace function public.screen_community_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
begin
  select * into verdict from public.screen_text(new.body);
  if verdict.decision = 'block' then
    raise exception 'That post was not sent: %', verdict.reason;
  end if;
  return new;
end;
$$;

create trigger community_posts_screen
  before insert on public.community_posts
  for each row execute function public.screen_community_post();

create or replace function public.screen_community()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
begin
  select * into verdict from public.screen_text(new.name);
  if verdict.decision = 'block' then
    raise exception 'That Community name is not allowed: %', verdict.reason;
  end if;

  select * into verdict from public.screen_text(new.description);
  if verdict.decision = 'block' then
    raise exception 'That description is not allowed: %', verdict.reason;
  end if;

  return new;
end;
$$;

create trigger communities_screen
  before insert or update of name, description on public.communities
  for each row execute function public.screen_community();

-- ---------------------------------------------------------------- the page

/** Everything the Community page shows about the viewer's standing. */
create or replace function public.community_overview(community uuid)
returns table (
  member_count integer,
  request_count bigint,
  space_count bigint,
  my_rank_name text,
  my_rank_id uuid,
  can_manage_members boolean,
  can_manage_ranks boolean,
  can_manage_community boolean,
  can_manage_spaces boolean,
  can_post_wall boolean,
  can_moderate_wall boolean,
  has_requested boolean,
  is_banned boolean
)
language sql stable security definer set search_path = public as $$
  select
    c.member_count,
    (select count(*) from public.community_join_requests r where r.community_id = c.id),
    (select count(*) from public.community_spaces s where s.community_id = c.id),
    (select k.name from public.community_members m
       join public.community_ranks k on k.id = m.rank_id
      where m.community_id = c.id and m.user_id = auth.uid()),
    (select m.rank_id from public.community_members m
      where m.community_id = c.id and m.user_id = auth.uid()),
    public.community_can(c.id, 'can_manage_members'),
    public.community_can(c.id, 'can_manage_ranks'),
    public.community_can(c.id, 'can_manage_community'),
    public.community_can(c.id, 'can_manage_spaces'),
    public.community_can(c.id, 'can_post_wall'),
    public.community_can(c.id, 'can_moderate_wall'),
    exists (select 1 from public.community_join_requests r
             where r.community_id = c.id and r.user_id = auth.uid()),
    exists (select 1 from public.community_bans b
             where b.community_id = c.id and b.user_id = auth.uid())
  from public.communities c
  where c.id = community;
$$;

/** Members with their rank, highest first. */
create or replace function public.community_roster(community uuid, limit_count int default 60)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_online boolean,
  in_space_id uuid,
  rank_id uuid,
  rank_name text,
  rank_number smallint,
  joined_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.is_online, p.in_space_id,
         k.id, k.name, k.rank, m.joined_at
    from public.community_members m
    join public.profiles p on p.id = m.user_id
    left join public.community_ranks k on k.id = m.rank_id
   where m.community_id = community and not p.is_suspended
   order by coalesce(k.rank, 0) desc, m.joined_at
   limit least(greatest(limit_count, 1), 200);
$$;

/** People waiting to be let in. */
create or replace function public.community_requests(community uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, r.created_at
    from public.community_join_requests r
    join public.profiles p on p.id = r.user_id
   where r.community_id = community
     and public.community_can(community, 'can_manage_members')
   order by r.created_at;
$$;

grant execute on function public.community_overview, public.community_roster,
  public.community_requests to anon, authenticated;
