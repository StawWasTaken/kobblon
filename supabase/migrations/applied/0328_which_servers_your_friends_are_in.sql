begin;

/**
 * The servers of a World that your friends are in.
 *
 * Staw asked for "servers friends are in" as its own section above the
 * rest, which is the one question the server list could not answer: a
 * card shows the first six faces who turned up, so a friend who joined
 * seventh is in there and invisible.
 *
 * It answers with the server and the friends in it, not with the whole
 * roster - the ordinary `servers_of` already draws the room, and this only
 * says which rooms are worth putting first and whose face to show on them.
 *
 * `security definer` because `world_players` is not readable directly and
 * `friendships` is readable only by its two people. Both are read here as
 * the owner, so the subject is pinned to `auth.uid()` by hand: every
 * friendship in the query has the caller on one end of it. A caller
 * cannot ask whose friends are where; there is no argument for that.
 *
 * Private servers are left out, the same as everywhere else. Somebody in
 * a room a stranger cannot see reads here as not playing.
 */
create or replace function public.friends_in_servers(wanted uuid)
returns table (server_id uuid, who jsonb)
language sql stable security definer set search_path = public, extensions as $$
  with me as (select auth.uid() as id),
  mates as (
    select case when f.requester_id = (select id from me)
                then f.addressee_id else f.requester_id end as mate_id
      from public.friendships f
     where f.status = 'accepted'
       and (select id from me) is not null
       and (select id from me) in (f.requester_id, f.addressee_id)
  )
  select s.id,
         jsonb_agg(
           jsonb_build_object(
             'id', pr.id,
             'username', pr.username,
             'display_name', pr.display_name,
             'avatar_url', pr.avatar_url,
             'avatar_changed_at', pr.avatar_changed_at
           ) order by pr.username
         )
    from public.world_servers s
    join public.world_players p on p.server_id = s.id
    join mates m on m.mate_id = p.user_id
    join public.profiles pr on pr.id = p.user_id
   where s.world_id = wanted
     and s.closed_at is null
     and s.owner_id is null
     and p.last_seen > now() - public.stale_after()
   group by s.id;
$$;

/* Anonymous has no friends to be anywhere, so it is not offered the
   question. */
revoke all on function public.friends_in_servers(uuid) from public, anon;
grant execute on function public.friends_in_servers(uuid) to authenticated;

commit;
