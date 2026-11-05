-- Allies and enemies between Communities, and the reads the configure pages
-- need. Safe to run again.

do $$ begin
  create type public.relation_kind as enum ('ally', 'enemy');
exception when duplicate_object then null;
end $$;

create table if not exists public.community_relations (
  community_id uuid not null references public.communities on delete cascade,
  other_id uuid not null references public.communities on delete cascade,
  relation public.relation_kind not null,
  accepted boolean not null default false,
  requested_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  primary key (community_id, other_id),
  check (community_id <> other_id)
);

create index if not exists community_relations_other_idx
  on public.community_relations (other_id) where not accepted;

alter table public.community_relations enable row level security;

-- An accepted relation is part of a Community's public face. A pending one is
-- only the business of the two Communities involved.
drop policy if exists community_relations_read on public.community_relations;
create policy community_relations_read on public.community_relations for select
  using (
    accepted
    or public.community_can(community_id, 'can_manage_community')
    or public.community_can(other_id, 'can_manage_community')
  );

/**
 * Asking another Community to be an ally. It does not count until they say
 * yes, and saying yes writes the matching row the other way, so an alliance
 * is never one sided.
 */
create or replace function public.request_ally(community uuid, other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.community_can(community, 'can_manage_community') then
    raise exception 'You cannot manage this Community.';
  end if;
  if community = other then raise exception 'A Community cannot ally itself.'; end if;
  if not exists (select 1 from public.communities c
                  where c.id = other and c.is_public and not c.is_removed) then
    raise exception 'No such Community.';
  end if;

  -- If they already asked us, this answers it instead of asking back.
  if exists (
    select 1 from public.community_relations r
     where r.community_id = other and r.other_id = community
       and r.relation = 'ally' and not r.accepted
  ) then
    perform public.answer_ally_request(community, other, true);
    return;
  end if;

  insert into public.community_relations (community_id, other_id, relation, requested_by)
  values (community, other, 'ally', auth.uid())
  on conflict (community_id, other_id)
  do update set relation = 'ally', requested_by = auth.uid();

  perform public.log_community(community, 'ally_requested', other::text);
end;
$$;

create or replace function public.answer_ally_request(community uuid, other uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.community_can(community, 'can_manage_community') then
    raise exception 'You cannot manage this Community.';
  end if;

  if not accept then
    delete from public.community_relations
     where community_id = other and other_id = community and relation = 'ally';
    perform public.log_community(community, 'ally_declined', other::text);
    return;
  end if;

  update public.community_relations set accepted = true
   where community_id = other and other_id = community and relation = 'ally';

  insert into public.community_relations (community_id, other_id, relation, accepted, requested_by)
  values (community, other, 'ally', true, auth.uid())
  on conflict (community_id, other_id)
  do update set relation = 'ally', accepted = true;

  perform public.log_community(community, 'ally_accepted', other::text);
end;
$$;

/** Declaring an enemy needs nobody's agreement, which is rather the point. */
create or replace function public.declare_enemy(community uuid, other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.community_can(community, 'can_manage_community') then
    raise exception 'You cannot manage this Community.';
  end if;
  if community = other then raise exception 'A Community cannot be its own enemy.'; end if;

  -- An alliance and a rivalry cannot both stand.
  delete from public.community_relations
   where (community_id = community and other_id = other)
      or (community_id = other and other_id = community);

  insert into public.community_relations (community_id, other_id, relation, accepted, requested_by)
  values (community, other, 'enemy', true, auth.uid());

  perform public.log_community(community, 'enemy_declared', other::text);
end;
$$;

create or replace function public.remove_relation(community uuid, other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.community_can(community, 'can_manage_community') then
    raise exception 'You cannot manage this Community.';
  end if;

  delete from public.community_relations
   where (community_id = community and other_id = other)
      or (community_id = other and other_id = community and relation = 'ally');

  perform public.log_community(community, 'relation_removed', other::text);
end;
$$;

grant execute on function public.request_ally, public.answer_ally_request,
  public.declare_enemy, public.remove_relation to authenticated;

/** Allies or enemies of a Community, as cards. */
create or replace function public.community_relations_list(
  community uuid, want public.relation_kind, only_pending boolean default false
)
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  member_count integer,
  accepted boolean,
  incoming boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.icon_url, c.member_count, r.accepted, false
    from public.community_relations r
    join public.communities c on c.id = r.other_id
   where r.community_id = community and r.relation = want
     and r.accepted = (not only_pending)
     and c.is_public and not c.is_removed
  union all
  -- Requests pointing at us, which are the ones there is something to answer.
  select c.id, c.slug, c.name, c.icon_url, c.member_count, r.accepted, true
    from public.community_relations r
    join public.communities c on c.id = r.community_id
   where only_pending and r.other_id = community and r.relation = want and not r.accepted
     and c.is_public and not c.is_removed
  order by 3;
$$;

/** Who is banned from a Community. */
create or replace function public.community_banned(community uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  reason text,
  banned_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, b.reason, b.banned_at
    from public.community_bans b
    join public.profiles p on p.id = b.user_id
   where b.community_id = community
     and public.community_can(community, 'can_manage_members')
   order by b.banned_at desc;
$$;

create or replace function public.lift_ban(community uuid, target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.community_can(community, 'can_manage_members') then
    raise exception 'You cannot manage members here.';
  end if;
  delete from public.community_bans where community_id = community and user_id = target;
  perform public.log_community(community, 'ban_lifted', target::text);
end;
$$;

/** The audit trail, with who did it resolved. */
create or replace function public.community_audit_log(community uuid, limit_count int default 50)
returns table (
  id bigint,
  action text,
  detail text,
  created_at timestamptz,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.action, a.detail, a.created_at, p.username, p.display_name, p.avatar_url
    from public.community_audit a
    left join public.profiles p on p.id = a.actor_id
   where a.community_id = community
     and public.community_can(community, 'can_manage_members')
   order by a.created_at desc
   limit least(greatest(limit_count, 1), 200);
$$;

grant execute on function public.community_relations_list, public.community_banned,
  public.community_audit_log to anon, authenticated;
grant execute on function public.lift_ban to authenticated;
