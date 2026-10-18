begin;

/*
 * Communities, in the staff console.
 *
 * Staw, spelling out the Communities half of the ranks: a moderator may
 * flag one for review and sanction its owner for what they do with it; an
 * admin may verify one and close one; a superadmin may hand one to somebody
 * else and delete one for real. None of it needs the owner's consent -
 * "we can just do that if we have to" - and what makes that safe is that
 * every one of these writes who did it and why, into the Community's own
 * audit and into the admin log.
 *
 * **Closing is not deleting, and this is the part worth reading.** The
 * roadmap's specification is the one a person's account is meant to get:
 * the row is marked closed, the page still exists and says so rather than
 * disappearing, everything in it is held, and the real data goes two months
 * later. Until then it is revertable by the same ranks.
 *
 * The account path does not do that yet - `admin_delete_account` deletes
 * immediately. So "reuse the account path" could not be followed literally,
 * and rather than writing a second idea of what deleted means and leaving
 * two of them, the wait is built here as something general: `closed_at`,
 * `closed_by`, `closed_reason` and `erase_after`, with `erase_after` set
 * from one function, `held_for()`, so when accounts get the same treatment
 * they take the same two months from the same place.
 *
 * `is_removed` is still set alongside, because every page, policy and feed
 * on this platform already reads that column to decide whether a Community
 * is there. A close that did not set it would be a Community that reads as
 * closed in the console and as open everywhere else.
 */

/** How long a closed thing is held before the data really goes. */
create or replace function public.held_for()
returns interval language sql immutable as $$ select interval '2 months' $$;

grant execute on function public.held_for to authenticated;

alter table public.communities add column if not exists closed_at timestamptz;
alter table public.communities add column if not exists closed_by uuid
  references public.profiles on delete set null;
alter table public.communities add column if not exists closed_reason text;
alter table public.communities add column if not exists erase_after timestamptz;

comment on column public.communities.erase_after is
  'When the real data goes. Null on anything not closed. Set from '
  'held_for() so the wait is one number rather than one per caller.';

create index if not exists communities_closed_idx
  on public.communities (erase_after)
  where closed_at is not null;

/* A page asking for a closed Community still gets the row, so it can say
 * so. Nothing else about who may read a Community changes. */

-- -------------------------------------------------- what the console sees

/**
 * The list the Communities panel is drawn from.
 *
 * `security definer` because it reads across everybody's Communities and
 * joins the owner onto each - and it checks the rank itself first, because
 * a definer function without that check is the console's data handed to
 * anybody who can guess the name.
 *
 * `which` is the tab: 'all', 'flagged' (waiting on somebody), 'closed',
 * 'verified'.
 */
create or replace function public.staff_communities(
  look text default null, which text default 'all', how_many integer default 50
)
returns table (
  id uuid, content_id bigint, slug text, name text,
  icon_url text, member_count integer, funds integer,
  is_public boolean, is_verified boolean, is_removed boolean,
  closed_at timestamptz, erase_after timestamptz, closed_reason text,
  created_at timestamptz,
  owner_id uuid, owner_username text, owner_name text, owner_avatar text,
  owner_suspended boolean, open_reports integer
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  return query
    select c.id, c.content_id, c.slug, c.name,
           c.icon_url, c.member_count, c.funds,
           c.is_public, c.is_verified, c.is_removed,
           c.closed_at, c.erase_after, c.closed_reason,
           c.created_at,
           p.id, p.username, p.display_name, p.avatar_url,
           coalesce(p.is_suspended, false),
           (select count(*)::integer from public.reports r
             where r.target_type = 'community' and r.target_id = c.id::text
               and r.status = 'open')
      from public.communities c
      left join public.profiles p on p.id = c.owner_id
     where (look is null or btrim(look) = ''
            or c.name ilike '%' || btrim(look) || '%'
            or c.slug ilike '%' || btrim(look) || '%'
            or p.username ilike '%' || btrim(look) || '%')
       and case which
             when 'closed' then c.closed_at is not null
             when 'verified' then c.is_verified
             when 'flagged' then exists (
               select 1 from public.reports r
                where r.target_type = 'community' and r.target_id = c.id::text
                  and r.status = 'open')
             else true
           end
     order by (c.closed_at is not null), c.member_count desc, c.created_at desc
     limit least(greatest(coalesce(how_many, 50), 1), 200);
end $$;

-- ------------------------------------------------------ a moderator's two

/**
 * Flagging one for somebody to look at.
 *
 * It opens a report rather than a second kind of mark, because the report
 * console is where "something needs looking at" already lives and a flag
 * that only the Communities panel can see is a flag nobody reads. A
 * moderator may do it; the audit says it was staff rather than a member.
 */
create or replace function public.flag_community(community uuid, why text)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  it public.communities%rowtype;
  made bigint;
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into it from public.communities where id = community;
  if it.id is null then raise exception 'No such community.'; end if;

  if nullif(btrim(coalesce(why, '')), '') is null then
    raise exception 'Say what is wrong with it.';
  end if;

  /* `reason` is a closed list of the words a member picks when they report
   * something, and there is no word in it for "staff looked at this". It
   * goes in as 'other' with the staff note in `details`, prefixed, rather
   * than widening a list that describes what members can say. */
  insert into public.reports (reporter_id, target_type, target_id, reason, details, status)
  values (auth.uid(), 'community', community::text, 'other',
          left('Flagged by staff: ' || btrim(why), 1000), 'open')
  returning id into made;

  insert into public.community_audit (community_id, actor_id, action, detail)
  values (community, auth.uid(), 'flagged_for_review', left(btrim(why), 500));

  perform public.write_admin_log('community_flagged', it.owner_id,
    jsonb_build_object('community', community, 'slug', it.slug, 'why', left(btrim(why), 300)));

  return made;
end $$;

-- ------------------------------------------------------- an admin's three

/** The tick, by hand, the way a person gets one. */
create or replace function public.verify_community(
  community uuid, yes boolean, why text default null
)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare it public.communities%rowtype;
begin
  perform public.require_admin();

  select * into it from public.communities where id = community;
  if it.id is null then raise exception 'No such community.'; end if;
  if it.is_verified = coalesce(yes, false) then return it.is_verified; end if;

  update public.communities set is_verified = coalesce(yes, false) where id = community;

  insert into public.community_audit (community_id, actor_id, action, detail)
  values (community, auth.uid(),
          case when yes then 'verified' else 'unverified' end,
          left(coalesce(btrim(why), ''), 500));

  perform public.write_admin_log(
    case when yes then 'community_verified' else 'community_unverified' end,
    it.owner_id,
    jsonb_build_object('community', community, 'slug', it.slug, 'why', why));

  return coalesce(yes, false);
end $$;

/**
 * Closing one.
 *
 * `staff_` on the front for the same reason the transfer has it: 0034
 * already has a `close_community(target, closed)`, which is the owner
 * shutting their own Community and does not hold anything for two months.
 * Two functions with one name, meaning different things, is the collision
 * this file has already had once.
 *
 * Marked closed and held. Nothing is deleted here and nothing can be: the
 * only thing that removes the data is `erase_community`, and it refuses to
 * run early for anybody but a superadmin.
 */
create or replace function public.staff_close_community(community uuid, why text)
returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare
  it public.communities%rowtype;
  goes timestamptz;
begin
  perform public.require_admin();

  select * into it from public.communities where id = community;
  if it.id is null then raise exception 'No such community.'; end if;
  if it.closed_at is not null then return it.erase_after; end if;

  if nullif(btrim(coalesce(why, '')), '') is null then
    raise exception 'Say why it is being closed.';
  end if;

  goes := now() + public.held_for();

  update public.communities
     set closed_at = now(),
         closed_by = auth.uid(),
         closed_reason = left(btrim(why), 500),
         erase_after = goes,
         is_removed = true
   where id = community;

  insert into public.community_audit (community_id, actor_id, action, detail)
  values (community, auth.uid(), 'closed', left(btrim(why), 500));

  perform public.write_admin_log('community_closed', it.owner_id,
    jsonb_build_object('community', community, 'slug', it.slug,
                       'why', left(btrim(why), 300), 'erase_after', goes));

  /* The owner is told. A Community going quiet with no word is the one
   * thing that makes this look arbitrary rather than decided. */
  insert into public.notifications (user_id, kind, body)
  values (it.owner_id, 'system',
          left('Your community "' || it.name || '" has been closed: '
               || btrim(why) || ' It is held for two months.', 300));

  return goes;
end $$;

/** Putting it back, by the same ranks, while there is anything to put back. */
create or replace function public.staff_reopen_community(community uuid, why text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare it public.communities%rowtype;
begin
  perform public.require_admin();

  select * into it from public.communities where id = community;
  if it.id is null then raise exception 'No such community.'; end if;
  if it.closed_at is null then return; end if;

  update public.communities
     set closed_at = null, closed_by = null, closed_reason = null,
         erase_after = null, is_removed = false
   where id = community;

  insert into public.community_audit (community_id, actor_id, action, detail)
  values (community, auth.uid(), 'reopened', left(coalesce(btrim(why), ''), 500));

  perform public.write_admin_log('community_reopened', it.owner_id,
    jsonb_build_object('community', community, 'slug', it.slug));

  insert into public.notifications (user_id, kind, body)
  values (it.owner_id, 'system',
          left('Your community "' || it.name || '" is open again.', 300));
end $$;

-- -------------------------------------------------- a superadmin's two

/**
 * Handing it to somebody else.
 *
 * Named apart from `transfer_community`, which 0034 already has and which
 * is the owner handing their own Community on. Same word would have been
 * an overload with the same first two arguments - every three argument
 * call ambiguous, and the console quietly calling the owner's one. This is
 * the house taking the decision instead.
 *
 * Without the owner's consent, which is the point of it being a
 * superadmin's. It refuses to hand one to an account that is suspended or
 * a guest, because an owner who cannot sign in is a Community with nobody
 * running it - which is the thing this is meant to fix.
 */
create or replace function public.staff_transfer_community(
  community uuid, to_whom uuid, why text default null
)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  it public.communities%rowtype;
  them public.profiles%rowtype;
begin
  perform public.require_superadmin();

  select * into it from public.communities where id = community;
  if it.id is null then raise exception 'No such community.'; end if;

  select * into them from public.profiles where id = to_whom;
  if them.id is null then raise exception 'No such account.'; end if;
  if them.id = it.owner_id then return; end if;
  if coalesce(them.is_suspended, false) then
    raise exception 'That account is suspended.';
  end if;
  if coalesce(them.is_guest, false) then
    raise exception 'A guest account cannot own a community.';
  end if;

  update public.communities set owner_id = them.id where id = community;

  /* The new owner has to actually be in it, and at the top of it. The
   * ranks table is what every page reads to decide who may do what, so an
   * owner who is not in it is an owner who cannot open their own settings. */
  insert into public.community_members (community_id, user_id, role)
  values (community, them.id, 'owner')
  on conflict (community_id, user_id) do update set role = 'owner';

  update public.community_members set role = 'admin'
   where community_id = community and user_id = it.owner_id and role = 'owner';

  insert into public.community_audit (community_id, actor_id, action, detail)
  values (community, auth.uid(), 'transferred',
          left('to @' || them.username || coalesce(': ' || btrim(why), ''), 500));

  perform public.write_admin_log('community_transferred', them.id,
    jsonb_build_object('community', community, 'slug', it.slug,
                       'from', it.owner_id, 'why', why));

  insert into public.notifications (user_id, kind, body)
  values (them.id, 'system',
          left('You are now the owner of the community "' || it.name || '".', 300));
end $$;

/**
 * The real deletion.
 *
 * A superadmin's, and the only thing on this platform that removes a
 * Community's data. It refuses one that was never closed: the two months
 * are what makes a mistake recoverable, and a door that skips them is a
 * door that makes them optional.
 *
 * A superadmin may still go early on one that *is* closed, because that is
 * the rank that answers for it - but never on one nobody has closed.
 */
create or replace function public.erase_community(community uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare it public.communities%rowtype;
begin
  perform public.require_superadmin();

  select * into it from public.communities where id = community;
  if it.id is null then raise exception 'No such community.'; end if;
  if it.closed_at is null then
    raise exception 'Close it first. The two months are what makes this undoable.';
  end if;

  perform public.write_admin_log('community_erased', it.owner_id,
    jsonb_build_object('community', community, 'slug', it.slug, 'name', it.name,
                       'closed_at', it.closed_at, 'members', it.member_count));

  delete from public.communities where id = community;
end $$;

/**
 * The two months coming up.
 *
 * Written as a sweep so it can be scheduled once `pg_cron` is enabled, and
 * so a superadmin can run the same thing by hand in the meantime rather
 * than the wait quietly never ending. It returns how many went.
 *
 * It does not use `erase_community`, because that one asks who is calling
 * and a schedule is nobody. The guard it keeps instead is the one that
 * matters here: only rows that were closed, and only past their date.
 */
create or replace function public.sweep_closed_communities()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  gone integer := 0;
  one public.communities%rowtype;
begin
  for one in
    select * from public.communities
     where closed_at is not null and erase_after is not null and erase_after <= now()
  loop
    insert into public.admin_log (admin_id, action, subject_id, subject_label, detail)
    values (null, 'community_erased_on_time', one.owner_id,
            (select username from public.profiles where id = one.owner_id),
            jsonb_build_object('community', one.id, 'slug', one.slug,
                               'name', one.name, 'closed_at', one.closed_at));
    delete from public.communities where id = one.id;
    gone := gone + 1;
  end loop;
  return gone;
end $$;

grant execute on function public.staff_communities(text, text, integer) to authenticated;
grant execute on function public.flag_community(uuid, text) to authenticated;
grant execute on function public.verify_community(uuid, boolean, text) to authenticated;
grant execute on function public.staff_close_community(uuid, text) to authenticated;
grant execute on function public.staff_reopen_community(uuid, text) to authenticated;
grant execute on function public.staff_transfer_community(uuid, uuid, text) to authenticated;
grant execute on function public.erase_community(uuid) to authenticated;
revoke execute on function public.sweep_closed_communities() from anon, authenticated;

commit;
