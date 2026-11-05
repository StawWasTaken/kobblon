-- Friends, and the two ways of being left alone.
--
-- Blocking is the hard one: you are not friends any more, neither of you
-- follows the other, neither can write to the other, ask the other anything
-- or be told anything about the other. Ignoring is the quiet one: you stay
-- friends, their chat stays where it was, and nothing they do reaches you as
-- a notification. What they say is still there to read when you want to.
--
-- Both are one sided and neither is announced. The other person is never told
-- that they have been blocked or ignored.

-- --------------------------------------------------------------- ignoring

create table if not exists public.ignores (
  ignorer_id uuid not null references public.profiles on delete cascade,
  ignored_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ignorer_id, ignored_id),
  check (ignorer_id <> ignored_id)
);

alter table public.ignores enable row level security;

drop policy if exists ignores_read_own on public.ignores;
create policy ignores_read_own on public.ignores for select
  using (ignorer_id = auth.uid());

drop policy if exists ignores_write_own on public.ignores;
create policy ignores_write_own on public.ignores for insert
  with check (ignorer_id = auth.uid());

drop policy if exists ignores_delete_own on public.ignores;
create policy ignores_delete_own on public.ignores for delete
  using (ignorer_id = auth.uid());

create index if not exists ignores_ignored_idx on public.ignores (ignored_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------- reading

/*
 * A block is one sided but it works both ways: neither of you can reach the
 * other. Only the pair itself is ever exposed, never who blocked whom, so a
 * block cannot be used to tell somebody anything.
 */
create or replace function public.blocked_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks b
     where (b.blocker_id = auth.uid() and b.blocked_id = other)
        or (b.blocker_id = other and b.blocked_id = auth.uid())
  );
$$;

create or replace function public.blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks x
     where (x.blocker_id = a and x.blocked_id = b)
        or (x.blocker_id = b and x.blocked_id = a)
  );
$$;

create or replace function public.friends_with(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = a and f.addressee_id = b)
         or (f.requester_id = b and f.addressee_id = a))
  );
$$;

grant execute on function public.blocked_with, public.blocked_between,
  public.friends_with to authenticated;

-- ----------------------------------------------------------------- doing it

/*
 * Blocking somebody undoes everything that tied you together in one go: the
 * friendship, any request either way, and both follows. What is left is the
 * block itself, which the guards below read.
 */
create or replace function public.block_person(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or me = target then raise exception 'You cannot block that.'; end if;
  if not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'There is nobody to block there.';
  end if;

  insert into public.blocks (blocker_id, blocked_id) values (me, target)
  on conflict do nothing;

  delete from public.friendships
   where (requester_id = me and addressee_id = target)
      or (requester_id = target and addressee_id = me);

  delete from public.follows
   where (follower_id = me and following_id = target)
      or (follower_id = target and following_id = me);

  -- Ignoring somebody you have just blocked means nothing any more.
  delete from public.ignores
   where ignorer_id = me and ignored_id = target;

  -- Nothing they did before is worth telling you about now.
  delete from public.notifications
   where user_id = me and actor_id = target;
end;
$$;

create or replace function public.unblock_person(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Log in first.'; end if;
  delete from public.blocks where blocker_id = me and blocked_id = target;
end;
$$;

/*
 * Ignoring changes nothing about who you are to each other. It stops their
 * notifications reaching you and tells the chat to keep their messages
 * covered until you choose to look.
 */
create or replace function public.ignore_person(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or me = target then raise exception 'You cannot ignore that.'; end if;
  if public.blocked_with(target) then
    raise exception 'You have blocked this person already.';
  end if;

  insert into public.ignores (ignorer_id, ignored_id) values (me, target)
  on conflict do nothing;

  delete from public.notifications where user_id = me and actor_id = target;
end;
$$;

create or replace function public.unignore_person(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Log in first.'; end if;
  delete from public.ignores where ignorer_id = me and ignored_id = target;
end;
$$;

grant execute on function public.block_person, public.unblock_person,
  public.ignore_person, public.unignore_person to authenticated;

-- ------------------------------------------------------------- the guards

/*
 * Nothing that ties two people together may be made across a block. These sit
 * on the tables themselves, so it holds however the row is written.
 */
create or replace function public.guard_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.blocked_between(new.requester_id, new.addressee_id) then
    raise exception 'You cannot be friends with this person.';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_guard on public.friendships;
create trigger friendships_guard before insert or update on public.friendships
  for each row execute function public.guard_friendship();

create or replace function public.guard_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.blocked_between(new.follower_id, new.following_id) then
    raise exception 'You cannot follow this person.';
  end if;
  return new;
end;
$$;

drop trigger if exists follows_guard on public.follows;
create trigger follows_guard before insert on public.follows
  for each row execute function public.guard_follow();

/*
 * One place decides whether somebody hears about somebody else. A
 * notification from a person you have blocked or are ignoring is dropped
 * where it is made rather than filtered out of forty different lists.
 */
create or replace function public.guard_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.actor_id is null or new.actor_id = new.user_id then return new; end if;

  if exists (
    select 1 from public.ignores i
     where i.ignorer_id = new.user_id and i.ignored_id = new.actor_id
  ) or public.blocked_between(new.user_id, new.actor_id) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before insert on public.notifications
  for each row execute function public.guard_notification();

-- --------------------------------------------------------------- the lists

/*
 * Where you stand with one person, in one answer, so a profile does not have
 * to ask five questions and guess at the gaps.
 */
drop function if exists public.standing_with(uuid);
create or replace function public.standing_with(target uuid)
returns table (
  are_friends boolean,
  request_sent boolean,
  request_received boolean,
  request_id uuid,
  friendship_id uuid,
  i_follow boolean,
  follows_me boolean,
  i_blocked boolean,
  they_blocked boolean,
  i_ignore boolean
)
language sql stable security definer set search_path = public as $$
  select
    public.friends_with(auth.uid(), target),
    exists (select 1 from public.friendships f
             where f.requester_id = auth.uid() and f.addressee_id = target
               and f.status = 'pending'),
    exists (select 1 from public.friendships f
             where f.requester_id = target and f.addressee_id = auth.uid()
               and f.status = 'pending'),
    (select f.id from public.friendships f
      where f.status = 'pending'
        and ((f.requester_id = auth.uid() and f.addressee_id = target)
          or (f.requester_id = target and f.addressee_id = auth.uid()))
      limit 1),
    (select f.id from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = target)
          or (f.requester_id = target and f.addressee_id = auth.uid()))
      limit 1),
    exists (select 1 from public.follows x
             where x.follower_id = auth.uid() and x.following_id = target),
    exists (select 1 from public.follows x
             where x.follower_id = target and x.following_id = auth.uid()),
    exists (select 1 from public.blocks b
             where b.blocker_id = auth.uid() and b.blocked_id = target),
    exists (select 1 from public.blocks b
             where b.blocker_id = target and b.blocked_id = auth.uid()),
    exists (select 1 from public.ignores i
             where i.ignorer_id = auth.uid() and i.ignored_id = target);
$$;

/*
 * Friends, requests, and the people you have shut out, as rows a page can
 * draw without asking after each one. Blocked people are left out of
 * everything except the list of people you have blocked.
 */
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
         p.is_verified or p.is_admin, p.is_admin, p.content_id,
         chosen.since, chosen.link_id,
         exists (select 1 from public.ignores i
                  where i.ignorer_id = (select id from me) and i.ignored_id = p.id)
    from chosen
    join public.profiles p on p.id = chosen.person
   where not p.is_suspended
     and (which in ('blocked', 'ignored') or not public.blocked_between((select id from me), p.id))
   order by chosen.since desc;
$$;

grant execute on function public.standing_with, public.people_list to authenticated;

-- ----------------------------------------------------------------- the chat

/*
 * A chat is a friendship with words in it. Somebody who was a friend once is
 * not in your list any more, which is the whole complaint: you cannot be
 * writing to somebody who left. Groups stay, because a group is its own
 * thing rather than a pair.
 *
 * A chat with somebody you are ignoring stays exactly where it is and says
 * so, which is what lets the page keep their messages covered.
 */
drop function if exists public.my_conversations();
create or replace function public.my_conversations()
returns table (
  id uuid,
  title text,
  is_group boolean,
  last_message_at timestamptz,
  last_message text,
  unread_count bigint,
  members jsonb,
  ignored boolean
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.title,
    c.is_group,
    c.last_message_at,
    (select m.body from public.messages m
      where m.conversation_id = c.id and not m.is_removed
      order by m.created_at desc limit 1),
    (select count(*) from public.messages m
      where m.conversation_id = c.id and not m.is_removed
        and m.sender_id <> auth.uid() and m.created_at > mine.last_read_at),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id,
              'username', p.username,
              'display_name', p.display_name,
              'avatar_url', p.avatar_url,
              'is_online', p.is_online,
              'in_space_id', p.in_space_id
            )), '[]'::jsonb)
       from public.conversation_members om
       join public.profiles p on p.id = om.user_id
      where om.conversation_id = c.id and om.user_id <> auth.uid()),
    exists (
      select 1 from public.conversation_members om
       join public.ignores i on i.ignored_id = om.user_id
      where om.conversation_id = c.id and om.user_id <> auth.uid()
        and i.ignorer_id = auth.uid()
    )
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
 where c.is_group
    or exists (
      select 1 from public.conversation_members om
       where om.conversation_id = c.id and om.user_id <> auth.uid()
         and public.friends_with(auth.uid(), om.user_id)
         and not public.blocked_between(auth.uid(), om.user_id)
    )
  order by c.last_message_at desc
  limit 40;
$$;

grant execute on function public.my_conversations to authenticated;

/*
 * Opening a chat with somebody needs the same thing as seeing one: you are
 * friends now. A group is made elsewhere and is not touched by this.
 */
create or replace function public.start_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing uuid;
  made uuid;
begin
  if me is null or me = other then raise exception 'There is nobody to write to.'; end if;
  if public.blocked_with(other) then
    raise exception 'You cannot write to this person.';
  end if;
  if not public.friends_with(me, other) then
    raise exception 'You can only write to your friends.';
  end if;

  select c.id into existing
    from public.conversations c
    join public.conversation_members a on a.conversation_id = c.id and a.user_id = me
    join public.conversation_members b on b.conversation_id = c.id and b.user_id = other
   where not c.is_group
   limit 1;

  if existing is not null then return existing; end if;

  insert into public.conversations (is_group) values (false) returning id into made;
  insert into public.conversation_members (conversation_id, user_id)
  values (made, me), (made, other);

  return made;
end;
$$;

grant execute on function public.start_conversation to authenticated;

/*
 * Losing a friend closes the chat to both of you rather than leaving it
 * hanging open on one side. The words are kept: becoming friends again picks
 * the conversation back up where it stopped.
 */
create or replace function public.screen_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
  other uuid;
  group_chat boolean;
begin
  select c.is_group into group_chat
    from public.conversations c where c.id = new.conversation_id;

  if not coalesce(group_chat, false) then
    select m.user_id into other
      from public.conversation_members m
     where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
     limit 1;

    if other is not null then
      if public.blocked_between(new.sender_id, other) then
        raise exception 'You cannot message this person.';
      end if;
      if not public.friends_with(new.sender_id, other) then
        raise exception 'You can only write to your friends.';
      end if;
    end if;
  else
    if exists (
      select 1 from public.blocks b
      join public.conversation_members m
        on m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
     where (b.blocker_id = new.sender_id and b.blocked_id = m.user_id)
        or (b.blocker_id = m.user_id and b.blocked_id = new.sender_id)
    ) then
      raise exception 'You cannot message this group.';
    end if;
  end if;

  select * into verdict from public.screen_text(new.body);
  if verdict.decision = 'block' then
    raise exception 'That message was not sent: %', verdict.reason;
  end if;

  return new;
end;
$$;
