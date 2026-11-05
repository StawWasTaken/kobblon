-- Two things a community needed.
--
-- An announcement could be liked and nothing else. Saying no to one had to go
-- through the wall, or through nobody at all, so a dislike exists now. One
-- person, one opinion: liking after disliking swaps it rather than counting
-- twice.
--
-- And an event that has started should say so. There is nothing here to run a
-- timer, so the saying is done by the first person to look: whoever opens a
-- community page sweeps any event that has just begun and tells the people
-- who said they were going. It happens once per event, because the event
-- itself records that it has been announced.
--
-- Safe to run again.

-- ------------------------------------------------------------- dislikes

alter table public.community_posts add column if not exists dislike_count integer not null default 0;

create table if not exists public.post_dislikes (
  post_id bigint not null references public.community_posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_dislikes_user_idx on public.post_dislikes (user_id);

alter table public.post_dislikes enable row level security;

drop policy if exists post_dislikes_read on public.post_dislikes;
create policy post_dislikes_read on public.post_dislikes for select using (true);

revoke insert, update, delete on public.post_dislikes from anon, authenticated;
grant select on public.post_dislikes to anon, authenticated;

create or replace function public.count_post_dislikes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set dislike_count = dislike_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.community_posts
       set dislike_count = greatest(dislike_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists count_post_dislikes on public.post_dislikes;
create trigger count_post_dislikes after insert or delete on public.post_dislikes
  for each row execute function public.count_post_dislikes();

/**
 * One person, one opinion about a post: yes, no, or nothing. Saying the
 * opposite of what you said before swaps it rather than leaving both.
 */
create or replace function public.vote_post(post bigint, up boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot vote on posts. Make an account and you can.';
  end if;

  if up is null then
    delete from public.post_likes where post_id = post and user_id = me;
    delete from public.post_dislikes where post_id = post and user_id = me;
    return;
  end if;

  if up then
    delete from public.post_dislikes where post_id = post and user_id = me;
    insert into public.post_likes (post_id, user_id) values (post, me) on conflict do nothing;
  else
    delete from public.post_likes where post_id = post and user_id = me;
    insert into public.post_dislikes (post_id, user_id) values (post, me) on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.vote_post to authenticated;

-- The wall now carries both numbers and what the person asking said.
drop function if exists public.community_posts_list(uuid, boolean, integer);
create function public.community_posts_list(
  target uuid, announcements boolean default false, limit_count integer default 30
)
returns table (
  id bigint,
  community_id uuid,
  author_id uuid,
  title text,
  body text,
  media_url text,
  media_kind text,
  is_announcement boolean,
  is_pinned boolean,
  like_count integer,
  i_like boolean,
  dislike_count integer,
  i_dislike boolean,
  created_at timestamptz,
  edited_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  author_is_guest boolean,
  author_is_verified boolean,
  author_content_id bigint,
  author_rank text,
  i_can_remove boolean,
  i_can_pin boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.community_id, p.author_id, p.title, p.body, p.media_url, p.media_kind,
         p.is_announcement, p.is_pinned, p.like_count,
         exists (select 1 from public.post_likes l
                  where l.post_id = p.id and l.user_id = auth.uid()),
         p.dislike_count,
         exists (select 1 from public.post_dislikes d
                  where d.post_id = p.id and d.user_id = auth.uid()),
         p.created_at, p.edited_at,
         a.username, a.display_name, a.avatar_url, a.is_guest,
         a.is_verified or a.is_admin, a.content_id,
         r.name,
         p.author_id = auth.uid()
           or public.community_can(p.community_id, 'can_moderate_wall')
           or (p.is_announcement and public.community_can(p.community_id, 'can_manage_community')),
         public.community_can(p.community_id, 'can_moderate_wall')
    from public.community_posts p
    join public.profiles a on a.id = p.author_id
    left join public.community_members m
      on m.community_id = p.community_id and m.user_id = p.author_id
    left join public.community_ranks r on r.id = m.rank_id
   where p.community_id = target
     and not p.is_removed
     and p.is_announcement = announcements
   order by p.is_pinned desc, p.created_at desc, p.id desc
   limit least(greatest(limit_count, 1), 100);
$$;

grant execute on function public.community_posts_list to anon, authenticated;

-- --------------------------------------------------------------- events

alter table public.community_events add column if not exists announced_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'space_like', 'space_visit',
                  'message', 'system', 'event_started'));

/**
 * Telling the people who said they were going that an event has begun.
 *
 * Nothing here runs on a timer, so this is called when somebody opens a
 * community: the first person through the door does the telling. An event is
 * only ever announced once, because announcing it writes the fact down.
 */
create or replace function public.announce_started_events(community uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  row_e record;
  said integer := 0;
begin
  for row_e in
    select e.id, e.title, e.community_id, c.name as community_name
      from public.community_events e
      join public.communities c on c.id = e.community_id
     where e.announced_at is null
       and not e.is_cancelled
       and e.starts_at <= now()
       and e.starts_at > now() - interval '1 day'
       and (community is null or e.community_id = community)
  loop
    insert into public.notifications (user_id, kind, body)
    select a.user_id, 'event_started',
           row_e.title || ' has started in ' || row_e.community_name || '.'
      from public.event_attendance a
     where a.event_id = row_e.id;

    update public.community_events set announced_at = now() where id = row_e.id;
    said := said + 1;
  end loop;

  return said;
end;
$$;

grant execute on function public.announce_started_events to authenticated;

/**
 * The event happening in a community right now, if there is one. An event
 * with no ending is treated as running for three hours, which is long enough
 * for the sort of thing people put on and short enough that a forgotten one
 * does not sit there for ever.
 */
create or replace function public.current_event(community uuid)
returns table (
  id uuid, content_id bigint, title text, subtitle text,
  starts_at timestamptz, ends_at timestamptz, attending_count integer
)
language sql stable security definer set search_path = public as $$
  select e.id, e.content_id, e.title, e.subtitle, e.starts_at, e.ends_at, e.attending_count
    from public.community_events e
   where e.community_id = community
     and not e.is_cancelled
     and e.starts_at <= now()
     and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
   order by e.starts_at desc
   limit 1;
$$;

grant execute on function public.current_event to anon, authenticated;
