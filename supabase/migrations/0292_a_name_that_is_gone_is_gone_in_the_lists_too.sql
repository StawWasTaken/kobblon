begin;

-- A name that is gone is gone in the lists too
-- -----------------------------------------------------------------------
--
-- Staw's rule, from the round that built it: an old friend whose account
-- has gone should read "Account Deleted" with a picture that will not
-- load, not vanish out of the list and leave somebody wondering whether
-- they were blocked.
--
-- The website has done that on a profile and on an avatar since 0268. It
-- has never done it in a friend list or in the chat dock, and the reason
-- is not that those pages forgot: **`people_list` and `my_conversations`
-- never returned `closed_at` or `is_banned`, so the pages drawing them
-- could not have known.** `nameOf()` asks a row whether it is gone, the
-- row had no answer, and the stored name was printed.
--
-- So the two functions hand back the two columns, and the pages read them.
-- Nothing about who may see whom changes here: a closed account was
-- already in these lists and stays in them, which is the whole point.
--
-- `people_list` has to be dropped first. `create or replace` cannot change
-- a function's return table, and this adds two columns to it.

set search_path = public, extensions;

-- ---------------------------------------------------------- friend lists

drop function if exists public.people_list(target uuid, which text);

create function public.people_list(target uuid, which text)
returns table (
  id uuid, username text, display_name text, avatar_url text, bio text,
  is_online boolean, in_space_id uuid, activity text,
  last_seen_at timestamptz, is_verified boolean, is_guest boolean,
  style jsonb, is_admin boolean, content_id bigint,
  since timestamptz, link_id uuid, best boolean, i_ignore boolean,
  /* The two this migration is for. */
  closed_at timestamptz, is_banned boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (select auth.uid() as id),
  chosen as (
    select f.id as link_id,
           case when f.requester_id = target then f.addressee_id else f.requester_id end as person,
           coalesce(f.responded_at, f.created_at) as since,
           f.best
      from public.friendships f
     where which = 'friends' and f.status = 'accepted'
       and (f.requester_id = target or f.addressee_id = target)

    union all

    select f.id, f.requester_id, f.created_at, false
      from public.friendships f
     where which = 'requests' and f.status = 'pending'
       and f.addressee_id = target and target = (select id from me)

    union all

    select f.id, f.addressee_id, f.created_at, false
      from public.friendships f
     where which = 'sent' and f.status = 'pending'
       and f.requester_id = target and target = (select id from me)

    union all

    select null::uuid, x.follower_id, x.created_at, false
      from public.follows x
     where which = 'followers' and x.following_id = target

    union all

    select null::uuid, x.following_id, x.created_at, false
      from public.follows x
     where which = 'following' and x.follower_id = target

    union all

    select null::uuid, b.blocked_id, b.created_at, false
      from public.blocks b
     where which = 'blocked' and b.blocker_id = target and target = (select id from me)

    union all

    select null::uuid, i.ignored_id, i.created_at, false
      from public.ignores i
     where which = 'ignored' and i.ignorer_id = target and target = (select id from me)
  )
  select p.id, p.username, p.display_name, p.avatar_url, p.bio,
         p.is_online, p.in_space_id, p.activity::text, p.last_seen_at,
         p.is_verified or p.is_admin, p.is_guest, p.style, p.is_admin, p.content_id,
         chosen.since, chosen.link_id, chosen.best,
         exists (select 1 from public.ignores i
                  where i.ignorer_id = (select id from me) and i.ignored_id = p.id),
         p.closed_at, coalesce(p.is_banned, false)
    from chosen
    join public.profiles p on p.id = chosen.person
   where not p.is_suspended
     and (which in ('blocked', 'ignored') or not public.blocked_between((select id from me), p.id))
   order by chosen.best desc, chosen.since desc;
$$;

grant execute on function public.people_list to anon, authenticated;

-- -------------------------------------------------------------- the dock

/*
 * The same two columns, inside the member objects.
 *
 * 0062's body otherwise, word for word. `jsonb_build_object` gets two more
 * pairs and nothing else moves - a conversation with somebody whose
 * account has gone is still a conversation and still opens; it is the name
 * on it that was wrong.
 */
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
language sql stable security definer
set search_path = public, extensions as $$
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
              'in_space_id', p.in_space_id,
              'closed_at', p.closed_at,
              'is_banned', coalesce(p.is_banned, false)
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

commit;
