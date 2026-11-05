-- Triggers and RPCs. Anything that touches a counter or writes to the public
-- activity feed runs here, so the client never gets to invent its own numbers.

-- new auth user -> profile + "joined" activity event
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'kobbler' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base := substr(base, 1, 16);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := substr(base, 1, 16) || n::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate,
          coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), candidate));

  insert into public.activity_events (kind, actor_id) values ('user_joined', new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- publishing a space stamps published_at and announces it once
create or replace function public.on_space_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := coalesce(new.published_at, now());
    insert into public.activity_events (kind, actor_id, space_id)
    values ('space_published', new.owner_id, new.id);
  end if;
  return new;
end;
$$;

create trigger spaces_before_write
  before insert or update on public.spaces
  for each row execute function public.on_space_write();

create or replace function public.on_space_update_logged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.spaces
     set update_count = update_count + 1, updated_at = now()
   where id = new.space_id;
  insert into public.activity_events (kind, actor_id, space_id)
  select 'space_updated', s.owner_id, s.id from public.spaces s where s.id = new.space_id;
  return new;
end;
$$;

create trigger space_updates_after_insert
  after insert on public.space_updates
  for each row execute function public.on_space_update_logged();

create or replace function public.on_space_like_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.spaces set like_count = like_count + 1 where id = new.space_id;
    insert into public.notifications (user_id, kind, actor_id, space_id)
    select s.owner_id, 'space_like', new.user_id, s.id
      from public.spaces s where s.id = new.space_id and s.owner_id <> new.user_id;
    return new;
  end if;
  update public.spaces set like_count = greatest(like_count - 1, 0) where id = old.space_id;
  return old;
end;
$$;

create trigger space_likes_change
  after insert or delete on public.space_likes
  for each row execute function public.on_space_like_change();

-- entering a space: one recorded visit per person per space per hour, so the
-- public visit total cannot be inflated by refreshing.
create or replace function public.enter_space(target uuid)
returns table (visit_counted boolean, visits bigint)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  counted boolean := false;
begin
  if not exists (select 1 from public.spaces s
                  where s.id = target and s.is_published and not s.is_removed) then
    raise exception 'space not available';
  end if;

  if me is not null and not exists (
    select 1 from public.space_visits v
     where v.space_id = target and v.visitor_id = me
       and v.created_at > now() - interval '1 hour'
  ) then
    insert into public.space_visits (space_id, visitor_id) values (target, me);
    update public.spaces set visit_count = visit_count + 1 where id = target;
    insert into public.activity_events (kind, actor_id, space_id) values ('space_entered', me, target);
    counted := true;
  end if;

  if me is not null then
    update public.profiles set in_space_id = target, is_online = true, last_seen_at = now() where id = me;
  end if;

  return query
    select counted, s.visit_count from public.spaces s where s.id = target;
end;
$$;

create or replace function public.leave_space()
returns void language sql security definer set search_path = public as $$
  update public.profiles set in_space_id = null, last_seen_at = now() where id = auth.uid();
$$;

create or replace function public.touch_presence(online boolean default true)
returns void language sql security definer set search_path = public as $$
  update public.profiles set is_online = online, last_seen_at = now() where id = auth.uid();
$$;

-- platform-wide counters for the logged-out landing page
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
    (select count(*) from public.profiles where not is_suspended),
    (select count(*) from public.profiles where is_online and last_seen_at > now() - interval '5 minutes');
$$;

-- recent public activity, already joined and stripped of anything private
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
    join public.profiles p on p.id = e.actor_id and not p.is_suspended
    left join public.spaces s on s.id = e.space_id
   where (e.space_id is null or (s.is_published and not s.is_removed))
   order by e.created_at desc
   limit least(greatest(limit_count, 1), 50);
$$;

-- open (or reuse) a direct conversation with a friend
create or replace function public.start_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null or me = other then raise exception 'invalid conversation'; end if;
  if not public.are_friends(me, other) then raise exception 'you can only message friends'; end if;

  select m.conversation_id into conv
    from public.conversation_members m
    join public.conversation_members o
      on o.conversation_id = m.conversation_id and o.user_id = other
   where m.user_id = me
   limit 1;

  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, other);
  end if;

  return conv;
end;
$$;

create or replace function public.on_message_sent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  insert into public.notifications (user_id, kind, actor_id)
  select m.user_id, 'message', new.sender_id
    from public.conversation_members m
   where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_sent();

-- friend requests and their answers generate the matching notification
create or replace function public.on_friendship_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, actor_id)
    values (new.addressee_id, 'friend_request', new.requester_id);
  elsif new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.notifications (user_id, kind, actor_id)
    values (new.requester_id, 'friend_accepted', new.addressee_id);
  end if;
  return new;
end;
$$;

create trigger friendships_after_change
  after insert or update on public.friendships
  for each row execute function public.on_friendship_change();

grant execute on function public.platform_stats, public.recent_activity to anon, authenticated;
grant execute on function public.enter_space, public.leave_space, public.touch_presence,
  public.start_conversation, public.are_friends to authenticated;
