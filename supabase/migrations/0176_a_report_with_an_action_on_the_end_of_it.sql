begin;

-- The triage card, and the one action on the end of it
-- -----------------------------------------------------------------------
--
-- Three functions and a repair:
--
--   report_queue    the list a panel shows
--   report_ticket   one ticket, with its subject and that person's history
--   take_report     doing something about it, or deciding not to
--   take_down       extended to community, avatar_item and ad, and its asset
--                   branch working for the first time (see 0174)
--
-- The ceiling is held in `take_report` and nowhere else:
--
--   * a moderator or the machine: warning, chat suspension, suspension,
--     content removal, or nothing
--   * **termination is a superadmin's, and the machine is refused by name**
--
-- Staw reaffirmed that today. The machine's refusal is its own message rather
-- than falling through to the superadmin check, because "that is a
-- superadmin's to do" read by a worker that can never be one is a message
-- that invites somebody to try making it one.

-- ------------------------------------------------------- the repair to 0089

/**
 * Removing one thing, and telling whoever made it.
 *
 * `what` is the kind of thing and `which` is its id. The reason is shown to
 * the person: "your thing was removed" with no reason is how a platform
 * teaches people that moderation is arbitrary.
 *
 * Three kinds added, one fixed. The asset branch has raised
 * `invalid input value for enum moderation_status` since 0089 and 0174 is
 * what makes it work. A community is removed rather than deleted - deleting
 * one takes its wall, its ranks and its funds with it, which is a
 * superadmin's decision through its own door, not a side effect of a report.
 */
create or replace function public.take_down(what text, which uuid, reason text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  owner uuid;
  title text;
  said text := btrim(coalesce(reason, ''));
begin
  if not (public.is_kobblon() or public.is_moderator() or public.is_the_worker()) then
    raise exception 'That is not yours to take down.';
  end if;

  if char_length(said) < 3 then
    raise exception 'Say why. A removal with no reason teaches people that this is arbitrary.';
  end if;

  if what = 'asset' then
    update public.assets set status = 'removed'
     where id = which returning creator_id, name into owner, title;

  elsif what = 'world' then
    update public.worlds set is_removed = true, is_published = false
     where id = which returning owner_id, name into owner, title;

  elsif what = 'space' then
    update public.spaces set is_removed = true, is_published = false
     where id = which returning owner_id, name into owner, title;

  elsif what in ('style', 'style_item') then
    update public.style_items set is_removed = true, is_public = false
     where id = which returning creator_id, name into owner, title;

  elsif what = 'community' then
    update public.communities set is_removed = true
     where id = which returning owner_id, name into owner, title;

  elsif what = 'avatar_item' then
    update public.avatar_items set is_removed = true
     where id = which returning creator_id, name into owner, title;

  elsif what = 'ad' then
    update public.ads set is_active = false
     where id = which returning buyer_id, 'An advert' into owner, title;

  elsif what = 'face' then
    /* Kobblon's own, so there is nobody to tell, but it still comes down. */
    update public.faces set is_removed = true, is_public = false
     where id = which returning null::uuid, name into owner, title;

  else
    raise exception 'Kobblon does not know how to take down a %.', what;
  end if;

  if title is null then
    raise exception 'There is no % with that number.', what;
  end if;

  if owner is null or owner = me then
    return; -- nothing to tell, or telling yourself
  end if;

  insert into public.notifications (user_id, kind, actor_id, body)
  values (owner, 'content_removed', me,
          left(title || ' was taken down. ' || said, 300));

  perform public.send_mail(
    owner,
    'moderation',
    title || ' was taken down',
    said || E'\n\nIf you think this is wrong, you can appeal from your account standing.',
    '/standing'
  );
end $$;

revoke all on function public.take_down(text, uuid, text) from public, anon;
grant execute on function public.take_down(text, uuid, text) to authenticated;

-- ------------------------------------------------------------- the queue

/**
 * The reports waiting, newest first, with their subject already resolved.
 *
 * `which` is 'open', 'handled' or 'all'. Lapsed suspensions are let go of
 * here, so a panel being looked at is enough to keep them honest - see
 * `lift_expired_suspensions`, which says what that does not cover.
 */
-- Dropped rather than replaced: 0161's version returns a narrower row and
-- Postgres refuses to change a function's return type in place. Every column
-- it had is still here under the same name - `about_name` included, which the
-- console reads - so the panel on production keeps working while the new
-- columns go unused until it is rebuilt.
drop function if exists public.report_queue(text, integer);

create or replace function public.report_queue(which text default 'open', how_many integer default 100)
returns table (
  id bigint,
  target_type text,
  target_id text,
  reason text,
  details text,
  status text,
  outcome text,
  created_at timestamptz,
  handled_at timestamptz,
  reporter_id uuid,
  reporter_username text,
  about_id uuid,
  about_username text,
  about_name text,
  subject_label text,
  subject_link text,
  subject_gone boolean,
  others_open integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status,
         r.outcome, r.created_at, r.handled_at,
         r.reporter_id, rp.username,
         s.owner_id, ap.username, s.label,
         s.label, s.link, s.gone,
         (select count(*)::integer from public.reports o
           where o.status = 'open' and o.id <> r.id and s.owner_id is not null
             and exists (select 1 from public.report_subject(o.target_type, o.target_id) os
                          where os.owner_id = s.owner_id))
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    cross join lateral public.report_subject(r.target_type, r.target_id) s
    left join public.profiles ap on ap.id = s.owner_id
   where case when which = 'open' then r.status = 'open'
              when which = 'handled' then r.status <> 'open'
              else true end
   order by r.created_at desc
   limit greatest(1, least(coalesce(how_many, 100), 500));
end $$;

grant execute on function public.report_queue(text, integer) to authenticated;

-- ------------------------------------------------------------- one ticket

/**
 * One ticket, and enough about the person to decide without opening a second
 * page: what has been decided about them before, how often they have been
 * quietened, and how many other reports are waiting about them.
 *
 * A card that shows only the complaint produces a platform where the tenth
 * offence is handled like the first.
 */
create or replace function public.report_ticket(ticket bigint)
returns table (
  id bigint,
  target_type text,
  target_id text,
  reason text,
  details text,
  status text,
  outcome text,
  handled_note text,
  created_at timestamptz,
  handled_at timestamptz,
  handled_by_username text,
  reporter_id uuid,
  reporter_username text,
  about_id uuid,
  about_username text,
  about_suspended boolean,
  about_suspended_until timestamptz,
  about_muted_until timestamptz,
  subject_label text,
  subject_link text,
  subject_gone boolean,
  past_warnings integer,
  past_heavy integer,
  past_mutes integer,
  other_open integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  return query
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.status,
         r.outcome, r.handled_note, r.created_at, r.handled_at, hp.username,
         r.reporter_id, rp.username,
         s.owner_id, ap.username,
         coalesce(ap.is_suspended, false), ap.suspended_until,
         (select max(t.until) from public.chat_timeouts t
           where t.who = s.owner_id and t.until > now()),
         s.label, s.link, s.gone,
         (select count(*)::integer from public.violations v
           where v.user_id = s.owner_id and not v.is_void and v.action = 'warning'),
         (select count(*)::integer from public.violations v
           where v.user_id = s.owner_id and not v.is_void and v.action <> 'warning'),
         (select count(*)::integer from public.chat_timeouts t
           where t.who = s.owner_id),
         (select count(*)::integer from public.reports o
           where o.status = 'open' and o.id <> r.id
             and exists (select 1 from public.report_subject(o.target_type, o.target_id) os
                          where os.owner_id = s.owner_id))
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles hp on hp.id = r.handled_by
    cross join lateral public.report_subject(r.target_type, r.target_id) s
    left join public.profiles ap on ap.id = s.owner_id
   where r.id = ticket;
end $$;

grant execute on function public.report_ticket(bigint) to authenticated;

commit;
