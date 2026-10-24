begin;

/*
 * A reported forum post can actually be taken down
 * -----------------------------------------------------------------------
 *
 * 0279 let people report a forum topic and a forum reply, and taught
 * `report_subject` to say what they are. So reports arrive, land in the
 * console, and a moderator reads them with a link to the post. Then every
 * one of them hits a wall:
 *
 *   `take_report` does `take_down(r.target_type, r.target_id::uuid, said)`.
 *
 * A forum id is a bigint. `'412'::uuid` raises *invalid input syntax for
 * type uuid*, so **Remove it** on a forum report has never worked - it
 * fails before anything is written, which at least means no sanction was
 * recorded for a takedown that did not happen. Reporting has worked for
 * three weeks; acting on one has not worked once.
 *
 * Two walls, not one, and the second is the kind this project keeps
 * finding one layer deeper than it looked:
 *
 *   `violations.target_type` has a check constraint, and it lists eleven
 *   words. `forum_topic` and `forum_post` are not among them. So even
 *   with the takedown fixed, the violation written straight afterwards
 *   would be refused by a constraint three functions below where anybody
 *   was looking. That is exactly what 0219 found for `voice`, in the same
 *   constraint, and its comment says it was caught by taking a real
 *   report rather than by reading.
 *
 * So: a takedown function for the forum, the constraint widened, and
 * `take_report` replaced with one branch added and nothing else touched.
 */

alter table public.violations drop constraint if exists violations_target_type_check;
alter table public.violations add constraint violations_target_type_check
  check (target_type is null or target_type in
         ('profile','space','message','asset','style_item','comment','world',
          'community','avatar_item','ad','style','voice',
          'forum_topic','forum_post'));

/**
 * Take down a forum topic or a forum reply.
 *
 * `take_down`'s twin for the one part of this platform whose content is
 * numbered rather than uuid'd. Everything else about it is the same shape:
 * the row is marked removed rather than deleted, the author is told and
 * written to, and the letter points at their standing so they can appeal -
 * because a takedown nobody is told about is one nobody can argue with.
 *
 * The forum's own read policies already honour `is_removed`: a removed
 * post is visible to its author and to staff, and to nobody else. So this
 * writes one column and the rest of the forum behaves.
 */
create or replace function public.take_down_forum(
  what text, which bigint, said text
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  owner uuid;
  /*
   * Not `title`. `forum_topics` has a column of that name, and
   * `returning author_id, title into owner, title` is ambiguous - Postgres
   * refuses it outright rather than guessing, which is the good version of
   * this mistake. Caught by running it, not by reading it.
   */
  said_about text;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  if what = 'forum_topic' then
    update public.forum_topics t set is_removed = true
     where t.id = which returning t.author_id, t.title into owner, said_about;
  elsif what = 'forum_post' then
    update public.forum_posts r set is_removed = true
     where r.id = which returning r.author_id, 'A forum reply' into owner, said_about;
  else
    raise exception 'Kobblon does not take down a % this way.', what;
  end if;

  if said_about is null then
    raise exception 'There is no % with that number.', what;
  end if;

  perform public.write_admin_log('forum-removed', owner,
    jsonb_build_object('what', what, 'which', which, 'why', said));

  if owner is null or owner = me then
    return; -- nothing to tell, or telling yourself
  end if;

  insert into public.notifications (user_id, kind, actor_id, body)
  values (owner, 'content_removed', me,
          left(said_about || ' was taken down. ' || said, 300));

  perform public.send_mail(
    owner,
    'moderation',
    said_about || ' was taken down',
    said || E'\n\nIf you think this is wrong, you can appeal from your account standing.',
    '/standing');
end $$;

revoke all on function public.take_down_forum(text, bigint, text) from public, anon;
grant execute on function public.take_down_forum(text, bigint, text) to authenticated, service_role;

/*
 * `take_report`, copied from 0220 as it stands with one branch added and
 * nothing else touched. `create or replace` is the only way to change a
 * body, and retyping a function of this length from memory is how one of
 * its refusals quietly goes missing.
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
    /*
     * The forum goes a different way, and before 0294 it went nowhere: a
     * forum topic's id is a bigint and `take_down` takes a uuid, so
     * `r.target_id::uuid` raised "invalid input syntax for type uuid" and
     * a moderator could not remove a reported post at all. Reporting one
     * has worked since 0279; acting on one has not.
     */
    if r.target_type in ('forum_topic', 'forum_post') then
      perform public.take_down_forum(r.target_type, r.target_id::bigint, said);
    else
      perform public.take_down(r.target_type, r.target_id::uuid, said);
    end if;
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
revoke all on function public.take_report(bigint, text, text, text, integer, text) from public;
grant execute on function public.take_report(bigint, text, text, text, integer, text)
  to authenticated, service_role;

commit;
