-- Closing a Community, and handing one on. Both belong to the owner alone,
-- and both leave a line in the audit log.

/*
 * Closing hides a Community from everywhere without destroying what people
 * wrote in it. The owner can open it again, which is why this is a flag
 * rather than a delete.
 */
create or replace function public.close_community(target uuid, closed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.communities c
                  where c.id = target and c.owner_id = auth.uid()) then
    raise exception 'Only the owner can do that.';
  end if;

  update public.communities set is_removed = closed where id = target;
  perform public.log_community(target, case when closed then 'closed' else 'reopened' end, null);
end;
$$;

grant execute on function public.close_community to authenticated;

/*
 * Handing a Community to somebody else. They must already be a member, they
 * take rank 254, and the old owner keeps their place rather than being
 * dropped out of their own Community.
 */
create or replace function public.transfer_community(target uuid, to_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare top_rank uuid;
begin
  if not exists (select 1 from public.communities c
                  where c.id = target and c.owner_id = auth.uid()) then
    raise exception 'Only the owner can do that.';
  end if;

  if to_user = auth.uid() then raise exception 'It is already yours.'; end if;

  if not exists (select 1 from public.community_members m
                  where m.community_id = target and m.user_id = to_user) then
    raise exception 'They have to be a member first.';
  end if;

  select id into top_rank from public.community_ranks
   where community_id = target order by rank desc limit 1;

  update public.communities set owner_id = to_user where id = target;
  update public.community_members set rank_id = top_rank
   where community_id = target and user_id = to_user;

  perform public.log_community(target, 'transferred', to_user::text);
end;
$$;

grant execute on function public.transfer_community to authenticated;
