-- Guests are for looking around. Everything that leaves a mark on the
-- platform needs a real account, and that is enforced here rather than by
-- hiding buttons.

create or replace function public.is_guest()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_guest from public.profiles where id = auth.uid()), false);
$$;

-- Making things
drop policy if exists spaces_insert_own on public.spaces;
create policy spaces_insert_own on public.spaces for insert
  with check (owner_id = auth.uid() and not public.is_guest());

drop policy if exists assets_insert_own on public.assets;
create policy assets_insert_own on public.assets for insert
  with check (creator_id = auth.uid() and status = 'pending' and not public.is_guest());

drop policy if exists communities_insert_own on public.communities;
create policy communities_insert_own on public.communities for insert
  with check (owner_id = auth.uid() and not public.is_guest());

-- Reacting to things
drop policy if exists space_likes_write_self on public.space_likes;
create policy space_likes_write_self on public.space_likes for insert
  with check (user_id = auth.uid() and not public.is_guest());

drop policy if exists space_favorites_insert_self on public.space_favorites;
create policy space_favorites_insert_self on public.space_favorites for insert
  with check (user_id = auth.uid() and not public.is_guest());

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows for insert
  with check (follower_id = auth.uid() and not public.is_guest());

-- Talking to people
drop policy if exists friendships_request on public.friendships;
create policy friendships_request on public.friendships for insert
  with check (requester_id = auth.uid() and status = 'pending' and not public.is_guest());

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.in_conversation(conversation_id, auth.uid())
    and not public.is_guest()
  );

drop policy if exists space_messages_send on public.space_messages;
create policy space_messages_send on public.space_messages for insert
  with check (
    sender_id = auth.uid()
    and not public.is_guest()
    and exists (
      select 1 from public.spaces s
       where s.id = space_id and s.is_published and not s.is_removed and s.chat_enabled
    )
  );

drop policy if exists community_members_join on public.community_members;
create policy community_members_join on public.community_members for insert
  with check (user_id = auth.uid() and role = 'member' and not public.is_guest());

-- A guest cannot rename itself into something that looks like a real account.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (not public.is_guest() or username = (select username from public.profiles where id = auth.uid()))
  );

-- ------------------------------------------------------- stopping the churn
--
-- Guests are free to make, so the two ways to abuse them are making a pile of
-- them and leaving them lying around. Both are capped here.

create table public.guest_signups (
  id bigserial primary key,
  fingerprint text not null,
  created_at timestamptz not null default now()
);

create index guest_signups_recent_idx on public.guest_signups (fingerprint, created_at desc);

alter table public.guest_signups enable row level security;

create or replace function public.register_guest()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- Anonymous sign-ins carry no email, so the closest thing to a source we
  -- have is the day plus the account itself; the count below is what does
  -- the work.
  recent int;
begin
  select count(*) into recent
    from public.profiles
   where is_guest and created_at > now() - interval '1 hour';

  if recent >= 200 then
    raise exception 'Too many guests have joined recently. Try again later, or make an account.';
  end if;

  return new;
end;
$$;

create trigger profiles_guest_rate
  before insert on public.profiles
  for each row when (new.is_guest) execute function public.register_guest();

-- Guests that have not been seen for a day are cleared out. Point a scheduled
-- job at this, or run it by hand now and then.
create or replace function public.sweep_guests()
returns integer language plpgsql security definer set search_path = public as $$
declare
  removed int;
begin
  with gone as (
    delete from auth.users u
     using public.profiles p
     where p.id = u.id
       and p.is_guest
       and p.last_seen_at < now() - interval '1 day'
    returning u.id
  )
  select count(*) into removed from gone;
  return removed;
end;
$$;

revoke execute on function public.sweep_guests from anon, authenticated;
