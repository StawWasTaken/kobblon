begin;

/*
 * Two things, both about who may do what in a Community.
 *
 * **One.** Staw, with a rank carrying every permission there is: "i cant
 * edit one even tho my rank has all the perms in it". He could not,
 * because `rename_community` asked `community_members.role` - the old
 * enum - and every other door in this feature asks `community_can`, which
 * reads the rank. So a Community could hand somebody `can_manage_community`
 * and that permission did nothing for the one thing people actually press.
 *
 * `community_can` already treats the owner as able whatever the ranks say,
 * so this is not a widening of who may rename beyond what the Community
 * itself decided - it is the rename asking the same question as everything
 * else.
 *
 * **Two.** Staw: "even if you have the perms to do that, you cant change
 * your own role." Which is the hole in `set_member_rank`: somebody with
 * `can_manage_ranks` could rank *themselves* up to a rank carrying every
 * other permission, so one permission quietly meant all of them. The owner
 * was guarded and nobody else was.
 */

create or replace function public.rename_community(target uuid, new_name text)
returns text language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  current_name text;
  holder uuid;
  verdict record;
  coming_back boolean;
  landed text;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot rename a community.'; end if;

  new_name := trim(coalesce(new_name, ''));

  select name into current_name from public.communities
   where id = target and not is_removed;
  if not found then raise exception 'That community is not here.'; end if;

  /* The rank decides, as it does everywhere else in this feature. */
  if not public.community_can(target, 'can_manage_community', me) then
    raise exception 'You cannot manage this community.';
  end if;

  if lower(new_name) = lower(current_name) then
    raise exception 'That is already its name.';
  end if;

  if new_name !~ public.community_name_shape() then
    raise exception '%', public.community_name_shape_said();
  end if;

  holder := public.who_holds_community_name(new_name);
  coming_back := holder = target;

  if holder is not null and not coming_back then
    raise exception 'A community already has that name.';
  end if;

  if not coming_back then
    select * into verdict from public.screen_text(new_name, 'identity');
    if verdict.decision <> 'ok' then
      raise exception 'That name is not allowed here.';
    end if;
  end if;

  if coming_back then
    delete from public.community_name_history
     where community_id = target and lower(name) = lower(new_name);
  end if;

  insert into public.community_name_history (community_id, name) values (target, current_name);

  perform set_config('kobbleston.renaming_community', 'on', true);
  update public.communities set name = new_name where id = target;
  perform set_config('kobbleston.renaming_community', 'off', true);

  select name into landed from public.communities where id = target;
  if landed is distinct from new_name then
    raise exception 'The rename did not hold.';
  end if;

  return new_name;
end;
$$;

grant execute on function public.rename_community to authenticated;

/** Nobody ranks themselves, whatever they are allowed to do to others. */
create or replace function public.set_member_rank(community uuid, target uuid, new_rank uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  owner uuid;
begin
  if not public.community_can(community, 'can_manage_ranks') then
    raise exception 'You cannot manage ranks here.';
  end if;

  /*
   * Your own rank is not yours to set.
   *
   * `can_manage_ranks` is one permission; a rank carrying it could be used
   * to move yourself into a rank carrying all the others, which makes that
   * one permission mean every permission. The owner was already held here
   * and everybody else was not.
   *
   * The owner included, deliberately: it costs them nothing - they can do
   * everything regardless - and it keeps the rule one sentence rather than
   * one sentence with an exception in it.
   */
  if target = auth.uid() then
    raise exception 'You cannot change your own rank.';
  end if;

  select owner_id into owner from public.communities where id = community;
  if target = owner then raise exception 'The owner keeps their rank.'; end if;

  if not exists (select 1 from public.community_ranks where id = new_rank and community_id = community) then
    raise exception 'That rank is not in this Community.';
  end if;

  update public.community_members set rank_id = new_rank
   where community_id = community and user_id = target;

  perform public.log_community(community, 'ranked', target::text);
end;
$$;

grant execute on function public.set_member_rank to authenticated;

commit;
