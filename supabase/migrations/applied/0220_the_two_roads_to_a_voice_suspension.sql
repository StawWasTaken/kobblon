begin;

/*
 * The two roads to a voice suspension, which both stopped short.
 *
 * `what_kobby_may_do` has returned `quieted_voice` as its fourth rung
 * since 0209, and `apply_ai_verdict` refused the word - so the one thing
 * the ladder said to do for that rung could not be done, and the worker
 * fell back to the rung below without anybody being told. `take_report`
 * had no voice action at all, so a moderator acting on a voice report
 * reached for a chat suspension and left the microphone live.
 *
 * Both now quiet chat and voice together, never voice alone: somebody who
 * cannot be trusted with a microphone can type the same thing in a second.
 *
 * Only the branches below changed. The rest of both functions is as 0211
 * and 0215 left it, repeated here because a plpgsql body is replaced
 * whole.
 */

CREATE OR REPLACE FUNCTION public.take_report(ticket bigint, action text, why text, rule text DEFAULT 'other'::text, days integer DEFAULT NULL::integer, note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
                    'voice_suspension','suspension','termination') then
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

  -- Chat and voice together, never voice on its own. Somebody who cannot
  -- be trusted with a microphone for an hour can type the same thing in a
  -- second, and a sanction with an open door beside it is not one.
  elsif action = 'voice_suspension' then
    ends := public.mute_chat(
      subject.owner_id, said, case when machine then 'machine' else 'staff' end,
      null, null, null, array['chat','voice']);

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
      when 'voice_suspension' then 'Chat and voice have been suspended on your account'
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
end $function$;

CREATE OR REPLACE FUNCTION public.apply_ai_verdict(subject text, subject_id text, decision text, reason text DEFAULT NULL::text, model text DEFAULT NULL::text, looked_at text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  rules record;
  who uuid;
  they record;
  line record;
begin
  if not (public.is_the_worker() or coalesce((select is_admin from public.profiles where id = auth.uid()), false)) then
    raise exception 'Only the moderation worker may do that.';
  end if;

  if decision not in ('approved', 'rejected', 'warned', 'quieted',
                      'quieted_voice', 'suspended', 'nothing', 'unsure') then
    raise exception 'That is not a verdict this takes.';
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then
    raise exception 'AI moderation is off.';
  end if;

  insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
  values (subject, subject_id, decision, left(coalesce(reason, ''), 500), model, left(coalesce(looked_at, ''), 2000));

  -- Screening something.
  if subject = 'avatar_item' and decision in ('approved', 'rejected') then
    update public.avatar_items
       set status = (case when decision = 'approved' then 'approved' else 'rejected' end)::public.moderation_status
     where id = subject_id::uuid and status = 'pending';
    return;
  end if;

  if subject = 'asset' and decision in ('approved', 'rejected') then
    update public.assets
       set status = (case when decision = 'approved' then 'approved' else 'rejected' end)::public.moderation_status
     where id = subject_id::uuid and status = 'pending';
    return;
  end if;

  /*
   * A line somebody said.
   *
   * Marked read whatever the answer was - including 'nothing', which is
   * most of them. A queue that only clears when the machine objects is a
   * queue that never clears.
   */
  if subject = 'message' then
    select * into line from public.chat_to_read where id = subject_id::bigint;
    update public.chat_to_read set read_at = now() where id = subject_id::bigint;
    if line.who is null then return; end if;

    select is_admin, is_moderator, is_superadmin into they
      from public.profiles where id = line.who;
    if they is null then return; end if;
    if coalesce(they.is_admin, false) or coalesce(they.is_moderator, false)
       or coalesce(they.is_superadmin, false) then
      return;  -- staff are not the machine's to judge, and this is not an error
    end if;

    if decision = 'warned' then
      if not rules.may_warn then return; end if;
      insert into public.notifications (user_id, kind, body)
      values (line.who, 'system',
              left(coalesce(reason, 'Please keep to the Kobblon guidelines.'), 300));
      return;
    end if;

    if decision in ('quieted', 'quieted_voice') then
      if not rules.may_warn then return; end if;
      perform public.mute_chat(
        line.who,
        left(coalesce(reason, 'Language that goes against the Kobblon guidelines.'), 300),
        'machine', null, null, null,
        case when decision = 'quieted_voice'
             then array['chat','voice'] else array['chat'] end);
      return;
    end if;

    if decision = 'suspended' then
      if not rules.may_suspend then return; end if;
      perform public.flag_account(
        line.who, 'The machine judged this serious enough to suspend.', line.body);
      update public.profiles set is_suspended = true where id = line.who;
      insert into public.notifications (user_id, kind, body)
      values (line.who, 'system',
              left(coalesce(reason, 'Your account has been suspended.'), 300));
      return;
    end if;

    return;
  end if;

  -- Acting on a person: warnings and suspensions, and nothing else, ever.
  if subject in ('profile', 'voice')
     and decision in ('warned', 'quieted', 'quieted_voice', 'suspended') then
    who := subject_id::uuid;
    select is_admin, is_moderator, is_suspended into they
      from public.profiles where id = who;
    if they is null then return; end if;

    -- Staff are not the machine's to judge.
    if coalesce(they.is_admin, false) or coalesce(they.is_moderator, false) then
      raise exception 'Staff are not screened by the machine.';
    end if;

    if decision = 'warned' then
      if not rules.may_warn then raise exception 'It may not warn anybody.'; end if;
      insert into public.notifications (user_id, kind, body)
      values (who, 'system', left(coalesce(reason, 'A warning from Kobblon.'), 300));
      return;
    end if;

    if decision in ('quieted', 'quieted_voice') then
      if not rules.may_warn then raise exception 'It may not warn anybody.'; end if;
      perform public.mute_chat(
        who, left(coalesce(reason, 'The guidelines.'), 300), 'machine',
        null, null, null,
        case when decision = 'quieted_voice'
             then array['chat','voice'] else array['chat'] end);
      return;
    end if;

    if not rules.may_suspend then raise exception 'It may not suspend anybody.'; end if;
    update public.profiles set is_suspended = true where id = who;
    insert into public.notifications (user_id, kind, body)
    values (who, 'system', left(coalesce(reason, 'Your account has been suspended.'), 300));
    return;
  end if;

  -- 'nothing' and 'unsure' are recorded and do nothing, which is the point
  -- of having them: a machine that cannot say "I do not know" says something
  -- else instead.
end;
$function$;

revoke all on function public.take_report(bigint, text, text, text, integer, text) from public;
grant execute on function public.take_report(bigint, text, text, text, integer, text)
  to authenticated, service_role;

commit;
