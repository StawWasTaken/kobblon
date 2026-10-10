begin;

-- The report console's functions, which the live database never got
-- -----------------------------------------------------------------------
--
-- Staw: "i cant take report tickets", with the page's own words under it -
-- `Could not find the function public.report_ticket(ticket) in the schema
-- cache`.
--
-- The same fault as 0205 and the same shape. 0176, 0177 and 0178 were
-- written, checked and committed here, and never applied over there. What
-- is missing is not a detail: `report_ticket` is the triage sheet,
-- `report_queue` is the list it opens from, `take_report` is every action
-- on the end of it, and `suspend_account` and `take_down` are what those
-- actions actually do. The console has had a Reports panel that cannot
-- open a report.
--
-- So this re-asserts all five, exactly as their own migrations leave them -
-- 0176's three, and 0178's two, which are the latest versions of each.
-- Copied rather than rewritten: a re-assertion that improves something
-- while it is at it is how two databases end up with two different
-- functions of the same name.
--
-- Every statement is a `create or replace`, so if those migrations did land
-- on your side this file changes nothing at all.
--
-- The lesson, again, and it is the one worth writing down: **a function
-- that is missing and a function that refuses look identical from a page.**
-- Both of these read to Staw as "the console is broken". The only thing
-- that tells them apart is reading the error, which is why the console says
-- what the database said rather than "something went wrong".

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

create or replace function public.suspend_account(
  target uuid, until_when timestamptz, said text
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare they public.profiles%rowtype;
begin
  if not (public.is_the_worker() or public.is_moderator()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into they from public.profiles where id = target;
  if they.id is null then raise exception 'No such account.'; end if;

  -- Nobody suspends sideways or upwards, and the machine suspends neither.
  if they.is_superadmin then
    raise exception 'A superadmin cannot be suspended.';
  end if;
  if (they.is_admin or they.is_moderator)
     and not public.is_superadmin() then
    raise exception 'Only a superadmin suspends staff.';
  end if;

  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set is_suspended = true, suspended_until = until_when
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.write_admin_log('suspend', target, jsonb_build_object(
    'until', until_when, 'why', said,
    'by', case when public.is_the_worker() then 'machine' else 'staff' end));
end $$;

grant execute on function public.suspend_account(uuid, timestamptz, text) to authenticated;

create or replace function public.take_report(
  ticket bigint,
  action text,
  why text,
  rule text default 'other',
  days integer default null,
  note text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  machine boolean := public.is_the_worker();
  me uuid := auth.uid();
  r public.reports%rowtype;
  subject record;
  said text := btrim(coalesce(why, ''));
  ends timestamptz;
  made bigint;
begin
  if not (machine or public.is_moderator()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  if action not in ('nothing','content_removed','warning','chat_suspension',
                    'suspension','termination') then
    raise exception 'That is not an action a report takes.';
  end if;

  -- The machine's ceiling. Said as its own refusal rather than falling
  -- through to the superadmin check: a worker can never become a superadmin,
  -- so a message implying it could is a message inviting somebody to try.
  if machine and action = 'termination' then
    raise exception
      'The AI cannot delete an account. A termination is a superadmin''s, by hand.'
      using errcode = '42501';
  end if;
  if action = 'termination' then
    perform public.require_superadmin();
  end if;

  if action <> 'nothing' and char_length(said) < 3 then
    raise exception 'Say why. A sanction with no reason cannot be appealed.';
  end if;

  select * into r from public.reports where id = ticket;
  if r.id is null then raise exception 'No such report.'; end if;
  if r.status <> 'open' then
    raise exception 'That report has already been settled.';
  end if;

  select * into subject
    from public.report_subject(r.target_type, r.target_id) limit 1;

  -- Deciding there is nothing in it is a decision, and it is recorded. A
  -- queue where dismissals leave no trace is a queue where the same report
  -- arrives for ever.
  if action = 'nothing' then
    update public.reports
       set status = 'dismissed', outcome = 'none', handled_by = me,
           handled_at = now(), handled_note = left(coalesce(note, said), 1000)
     where id = ticket;
    perform public.write_admin_log('report-dismissed', subject.owner_id,
      jsonb_build_object('report', ticket, 'why', said, 'by',
                         case when machine then 'machine' else 'staff' end));
    return jsonb_build_object('action', 'nothing', 'report', ticket);
  end if;

  if subject.owner_id is null and action <> 'content_removed' then
    raise exception
      'There is nobody to act against - the thing this is about has gone.';
  end if;

  -- A termination takes the account and everything pointing at it, the
  -- violations included, so the ticket is settled first and nothing is
  -- written about the person afterwards. `admin_delete_account` writes its
  -- own log line while the username still exists, which is the only moment
  -- anything can say who this was.
  if action = 'termination' then
    update public.reports
       set status = 'actioned', outcome = action, handled_by = me,
           handled_at = now(), handled_note = left(coalesce(note, said), 1000)
     where id = ticket;
    perform public.admin_delete_account(subject.owner_id, said);
    return jsonb_build_object('action', action, 'report', ticket,
                              'about', subject.owner_id);
  end if;

  -- The content first, so a takedown that fails has not already left a
  -- sanction on somebody's record for a thing nobody removed.
  if action = 'content_removed' then
    if r.target_type = 'profile' then
      raise exception 'A profile is not a thing that can be taken down.';
    end if;
    if r.target_type = 'message' then
      -- A message has no `take_down` branch and should not get one: the text
      -- is already censored on the way in, and deleting one is how a report
      -- about harassment loses its own evidence.
      raise exception
        'A message is not taken down. Act on the person, or dismiss it.';
    end if;
    perform public.take_down(r.target_type, r.target_id::uuid, said);
  end if;

  if action = 'chat_suspension' then
    ends := public.mute_chat(
      subject.owner_id, said, case when machine then 'machine' else 'staff' end);

  elsif action = 'suspension' then
    ends := case when days is not null then now() + make_interval(days => days) end;
    perform public.suspend_account(subject.owner_id, ends, said);
  end if;

  insert into public.violations
    (user_id, rule, action, reason, target_type, target_id,
     moderator_id, report_id, expires_at)
  values
    (subject.owner_id,
     case when rule in ('harassment','spam','sexual','violence','impersonation',
                        'illegal','hate','cheating','copyright','age','other')
          then rule else 'other' end,
     action, left(said, 1000),
     case when r.target_type = 'style' then 'style_item' else r.target_type end,
     r.target_id, me, ticket, ends)
  returning id into made;

  perform public.send_mail(
    subject.owner_id, 'moderation',
    case action
      when 'warning' then 'A warning about your account'
      when 'chat_suspension' then 'Chat has been suspended on your account'
      when 'suspension' then 'Your account has been suspended'
      else 'A decision about your account'
    end,
    said || E'\n\nYou can see where your account stands, and appeal this, '
         || 'from your account standing.',
    '/standing');

  update public.reports
     set status = 'actioned', outcome = action, handled_by = me,
         handled_at = now(), handled_note = left(coalesce(note, said), 1000)
   where id = ticket;

  perform public.write_admin_log('report-' || action, subject.owner_id,
    jsonb_build_object('report', ticket, 'why', said, 'until', ends,
                       'violation', made,
                       'by', case when machine then 'machine' else 'staff' end));

  return jsonb_build_object(
    'action', action, 'report', ticket, 'violation', made,
    'until', ends, 'about', subject.owner_id);
end $$;

grant execute on function public.take_report(bigint, text, text, text, integer, text) to authenticated;

commit;
