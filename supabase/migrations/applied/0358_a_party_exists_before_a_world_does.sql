/*
 * A party.
 *
 * We could already invite a friend into a World and walk in after them.
 * What we could not do is the thing a console does: three people in a group
 * who are together *before* anybody has picked a World, who stay together
 * when one ends, and who all land in the same copy when somebody presses
 * play. That is the difference between "I played a World" and "we hung
 * out", and it is the first of the five in `docs/where-kobblon-goes-next.md`.
 *
 * What is here is the part that has to be true for everybody: who is in a
 * party, who may join one, and where it is going. The Launcher reads the
 * destination and pulls its members in; the website shows the party and
 * lets you fill it.
 *
 * Rules, all of them enforced here rather than in whatever is drawing:
 *
 *   * you are in one party at a time, which is a unique index and not a
 *     hope;
 *   * eight people at most;
 *   * you may only be asked by somebody you are friends with;
 *   * only the leader may set where it is going or take somebody out of it;
 *   * when the last person leaves, the party goes.
 *
 * Nothing writes to these tables directly. The grants below give
 * `authenticated` reading only, and every change goes through a function
 * that checks who is asking.
 */
begin;

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.profiles(id) on delete cascade,
  /**
   * Where the party is going, set by the leader when they press play. The
   * Launcher reads it and takes everybody to the same copy.
   *
   * It is a hint in exactly the way `room` is: `join_world_server` over
   * HTTPS still decides whether a given account may be in that room.
   */
  world_id uuid references public.worlds(id) on delete set null,
  server_id uuid references public.world_servers(id) on delete set null,
  going_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.party_members (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

/* One at a time. The rule lives in the key rather than in the function. */
create unique index if not exists party_members_one_each
  on public.party_members (user_id);

create table if not exists public.party_invites (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  asked_by uuid not null references public.profiles(id) on delete cascade,
  asked_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create index if not exists party_invites_for_me on public.party_invites (user_id, asked_at desc);

/*
 * The grants, in the same file as the tables. A policy without them is a
 * table nobody can reach, which this project has built twice.
 */
grant select on public.parties, public.party_members, public.party_invites
  to authenticated;

/** How many fit. */
create or replace function public.party_cap()
returns integer language sql immutable as $$ select 8 $$;

grant execute on function public.party_cap() to authenticated;

/*
 * Asked by the policies. `security definer` so a policy on
 * `party_members` does not have to read `party_members` as the caller,
 * which is how a policy ends up asking itself.
 */
create or replace function public.in_party(party uuid, who uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (
    select 1 from public.party_members m
     where m.party_id = party and m.user_id = who
  );
$$;

grant execute on function public.in_party(uuid, uuid) to authenticated;

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_invites enable row level security;

drop policy if exists parties_read on public.parties;
create policy parties_read on public.parties for select using (
  public.in_party(id, auth.uid())
  or exists (
    select 1 from public.party_invites i
     where i.party_id = parties.id and i.user_id = auth.uid()
  )
);

drop policy if exists party_members_read on public.party_members;
create policy party_members_read on public.party_members for select using (
  public.in_party(party_id, auth.uid())
  or exists (
    select 1 from public.party_invites i
     where i.party_id = party_members.party_id and i.user_id = auth.uid()
  )
);

drop policy if exists party_invites_read on public.party_invites;
create policy party_invites_read on public.party_invites for select using (
  user_id = auth.uid() or public.in_party(party_id, auth.uid())
);

-- -------------------------------------------------------------- the doors

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind = any (array[
    'friend_request', 'friend_accepted',
    'best_friend_request', 'best_friend_accepted',
    'space_like', 'space_visit', 'message', 'system',
    'event_started', 'world_updated', 'content_removed',
    'forum_reply', 'forum_staff', 'world_invite', 'party_invite'
  ]));

/** Somebody who may be in a party at all. */
create or replace function public.may_party(who uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (
    select 1 from public.profiles p
     where p.id = who
       and not coalesce(p.is_guest, false)
       and not coalesce(p.is_suspended, false)
       and not coalesce(p.is_banned, false)
       and p.closed_at is null
  );
$$;

grant execute on function public.may_party(uuid) to authenticated;

/** Start one, with yourself in it. */
create or replace function public.make_party()
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not public.may_party(me) then
    raise exception 'This account cannot start a party.';
  end if;

  select party_id into made from public.party_members where user_id = me;
  if made is not null then return made; end if;

  insert into public.parties (leader_id) values (me) returning id into made;
  insert into public.party_members (party_id, user_id) values (made, me);
  return made;
end $$;

grant execute on function public.make_party() to authenticated;

/**
 * Ask somebody in. A friend, who is not already in a party, into one with
 * room in it - and the asking is done by somebody who is in it themselves.
 */
create or replace function public.invite_to_party(who uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  party uuid;
  how_many integer;
  my_name text;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if who = me then raise exception 'You are already in it.'; end if;

  select party_id into party from public.party_members where user_id = me;
  if party is null then party := public.make_party(); end if;

  if not public.are_friends(me, who) then
    raise exception 'You can only ask a friend into a party.';
  end if;

  if not public.may_party(who) then
    raise exception 'That account cannot join a party.';
  end if;

  if exists (select 1 from public.party_members where user_id = who) then
    raise exception 'They are already in a party.';
  end if;

  select count(*) into how_many from public.party_members where party_id = party;
  if how_many >= public.party_cap() then
    raise exception 'A party holds % people.', public.party_cap();
  end if;

  insert into public.party_invites (party_id, user_id, asked_by)
  values (party, who, me)
  on conflict (party_id, user_id) do update set asked_by = excluded.asked_by, asked_at = now();

  select coalesce(display_name, username) into my_name from public.profiles where id = me;

  insert into public.notifications (user_id, kind, body, actor_id)
  values (who, 'party_invite', left(my_name || ' asked you into their party.', 300), me);
end $$;

grant execute on function public.invite_to_party(uuid) to authenticated;

/** Take one up. */
create or replace function public.accept_party_invite(party uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  how_many integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if not exists (
    select 1 from public.party_invites i where i.party_id = party and i.user_id = me
  ) then
    raise exception 'That party did not ask you.';
  end if;

  if not public.may_party(me) then
    raise exception 'This account cannot join a party.';
  end if;

  select count(*) into how_many from public.party_members where party_id = party;
  if how_many >= public.party_cap() then
    raise exception 'That party is full.';
  end if;

  /* Whatever you were in, you are not in any more. */
  perform public.leave_party();

  insert into public.party_members (party_id, user_id) values (party, me)
  on conflict do nothing;

  delete from public.party_invites where user_id = me;
end $$;

grant execute on function public.accept_party_invite(uuid) to authenticated;

create or replace function public.decline_party_invite(party uuid)
returns void language sql security definer
set search_path = public, extensions as $$
  delete from public.party_invites where party_id = party and user_id = auth.uid();
$$;

grant execute on function public.decline_party_invite(uuid) to authenticated;

/**
 * Step out.
 *
 * The leader leaving hands it to whoever has been in it longest; the last
 * person leaving takes the party with them.
 */
create or replace function public.leave_party()
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  party uuid;
  boss uuid;
  next_up uuid;
begin
  if me is null then return; end if;

  select party_id into party from public.party_members where user_id = me;
  if party is null then return; end if;

  delete from public.party_members where party_id = party and user_id = me;

  select leader_id into boss from public.parties where id = party;

  select user_id into next_up from public.party_members
   where party_id = party order by joined_at limit 1;

  if next_up is null then
    delete from public.parties where id = party;
  elsif boss = me then
    update public.parties set leader_id = next_up where id = party;
  end if;
end $$;

grant execute on function public.leave_party() to authenticated;

/** The leader, taking somebody out. */
create or replace function public.remove_from_party(who uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  party uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select id into party from public.parties
   where leader_id = me and public.in_party(id, who);

  if party is null then raise exception 'That is not yours to do.'; end if;
  if who = me then raise exception 'Leave it instead.'; end if;

  delete from public.party_members where party_id = party and user_id = who;
end $$;

grant execute on function public.remove_from_party(uuid) to authenticated;

/**
 * Where the party is going, which is the one thing the Launcher reads.
 *
 * The leader's to set. A room id here is a hint, the same as `room` in a
 * link: `join_world_server` decides whether a given account may be in it.
 */
create or replace function public.party_is_going_to(world uuid, room uuid default null)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  party uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select id into party from public.parties where leader_id = me;
  if party is null then raise exception 'Only the leader picks where to go.'; end if;

  update public.parties
     set world_id = world, server_id = room, going_at = now()
   where id = party;
end $$;

grant execute on function public.party_is_going_to(uuid, uuid) to authenticated;

/** Your party, in one ask: who is in it, and where it is going. */
create or replace function public.my_party()
returns table (
  party_id uuid,
  leader_id uuid,
  world_id uuid,
  world_name text,
  world_content_id bigint,
  server_id uuid,
  going_at timestamptz,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_changed_at timestamptz,
  is_guest boolean,
  joined_at timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select p.id, p.leader_id, p.world_id, w.name, w.content_id, p.server_id, p.going_at,
         m.user_id, pr.username, pr.display_name, pr.avatar_url, pr.avatar_changed_at,
         pr.is_guest, m.joined_at
    from public.party_members mine
    join public.parties p on p.id = mine.party_id
    join public.party_members m on m.party_id = p.id
    join public.profiles pr on pr.id = m.user_id
    left join public.worlds w on w.id = p.world_id
   where mine.user_id = auth.uid()
   order by m.joined_at;
$$;

grant execute on function public.my_party() to authenticated;

/** The parties that have asked for you, with who did the asking. */
create or replace function public.party_invites_for_me()
returns table (
  party_id uuid,
  asked_at timestamptz,
  asked_by uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_changed_at timestamptz,
  how_many integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.party_id, i.asked_at, i.asked_by, pr.username, pr.display_name,
         pr.avatar_url, pr.avatar_changed_at,
         (select count(*)::integer from public.party_members m where m.party_id = i.party_id)
    from public.party_invites i
    join public.profiles pr on pr.id = i.asked_by
   where i.user_id = auth.uid()
   order by i.asked_at desc;
$$;

grant execute on function public.party_invites_for_me() to authenticated;

/* The panel keeps itself up to date rather than asking on a timer. */
alter table public.parties replica identity full;
alter table public.party_members replica identity full;
alter table public.party_invites replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = 'party_members') then
    alter publication supabase_realtime add table public.party_members;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = 'parties') then
    alter publication supabase_realtime add table public.parties;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = 'party_invites') then
    alter publication supabase_realtime add table public.party_invites;
  end if;
end $$;

commit;
