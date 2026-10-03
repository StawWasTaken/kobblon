begin;

-- Best friends come first, and a profile can see where it stands.
--
-- 0158 made it true; this is every reader that has to say so. Staw: "when
-- you have best friends; the people you have best-friended appear in
-- priority in your friend lists & profile & etc".
--
-- Each definition is taken from the database as it stands with columns
-- added, not retyped. Retyping one of these is how a rewrite silently drops
-- a join - it has happened here before.

drop function if exists public.standing_with(target uuid);

create function public.standing_with(target uuid)
 returns table(
   are_friends boolean, request_sent boolean, request_received boolean,
   request_id uuid, friendship_id uuid, i_follow boolean, follows_me boolean,
   i_blocked boolean, they_blocked boolean, i_ignore boolean,
   are_best boolean, best_asked_by_me boolean, best_asked_of_me boolean
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
             where i.ignorer_id = auth.uid() and i.ignored_id = target),
    -- The three new ones. Asked-by-me and asked-of-me are separate answers
    -- because they are different buttons: one says "waiting", the other
    -- says yes or no.
    exists (select 1 from public.friendships f
             where f.status = 'accepted' and f.best
               and ((f.requester_id = auth.uid() and f.addressee_id = target)
                 or (f.requester_id = target and f.addressee_id = auth.uid()))),
    exists (select 1 from public.friendships f
             where f.status = 'accepted' and f.best_asked_by = auth.uid()
               and ((f.requester_id = auth.uid() and f.addressee_id = target)
                 or (f.requester_id = target and f.addressee_id = auth.uid()))),
    exists (select 1 from public.friendships f
             where f.status = 'accepted' and f.best_asked_by = target
               and ((f.requester_id = auth.uid() and f.addressee_id = target)
                 or (f.requester_id = target and f.addressee_id = auth.uid())));
$function$;

grant execute on function public.standing_with to authenticated;

-- Every friend list, with the best ones first.
--
-- Taken from the database with one column threaded through each branch of
-- the union and the ordering changed. The `false`s are not padding: a union
-- needs the same shape in every arm, and "is this a best friend" is only a
-- question about the friends arm.
drop function if exists public.people_list(target uuid, which text);

create function public.people_list(target uuid, which text)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, bio text, is_online boolean, in_space_id uuid, activity text, last_seen_at timestamp with time zone, is_verified boolean, is_guest boolean, style jsonb, is_admin boolean, content_id bigint, since timestamp with time zone, link_id uuid, best boolean, i_ignore boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as id),
  chosen as (
    -- Friends of whoever is being looked at.
    select f.id as link_id,
           case when f.requester_id = target then f.addressee_id else f.requester_id end as person,
           coalesce(f.responded_at, f.created_at) as since,
           f.best
      from public.friendships f
     where which = 'friends' and f.status = 'accepted'
       and (f.requester_id = target or f.addressee_id = target)

    union all

    -- Requests waiting on you, which only ever means your own.
    select f.id, f.requester_id, f.created_at, false
      from public.friendships f
     where which = 'requests' and f.status = 'pending'
       and f.addressee_id = target and target = (select id from me)

    union all

    -- Requests you sent and nobody has answered.
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
                  where i.ignorer_id = (select id from me) and i.ignored_id = p.id)
    from chosen
    join public.profiles p on p.id = chosen.person
   where not p.is_suspended
     and (which in ('blocked', 'ignored') or not public.blocked_between((select id from me), p.id))
   /*
    * Best friends first, then the newest. Staw's "appear in priority in your
    * friend lists & profile & etc" - and it is ordered here rather than in
    * each page, because four pages sorting the same list four ways is four
    * chances for one of them to forget.
    */
   order by chosen.best desc, chosen.since desc;
$function$

;

grant execute on function public.people_list to anon, authenticated;

commit;
