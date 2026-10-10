begin;

-- Taking a report, and the ceiling on what that can mean
-- -----------------------------------------------------------------------
--
-- One door for every decision about a report, so there is one place where
-- the question "who is allowed to do this" is answered.
--
--   nothing            looked at it, there is nothing in it
--   content_removed    the thing comes down, the account is untouched
--   warning            said to them, on their standing, no effect
--   chat_suspension    the ladder from 0171: 5 minutes, then 6, then more
--   suspension         the account, with an end date or without one
--   termination        the account is deleted - SUPERADMIN ONLY, NEVER THE AI
--
-- Staw's rule, reaffirmed on 10 October: the machine may warn, chat-suspend
-- and suspend, and may not delete an account. The machine is refused
-- termination by name here, and `admin_delete_account` is a superadmin's
-- since 0172, so there are two locks on it and neither is in a browser.
--
-- Every decision writes a `violations` row, which is what the account's
-- standing page reads, which is what an appeal hangs off. A sanction with no
-- row is a sanction nobody can appeal, and that is the thing that makes a
-- moderation system feel arbitrary even when every decision in it was right.

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
  muted_until timestamptz;
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
    muted_until := public.mute_chat(
      subject.owner_id, said, case when machine then 'machine' else 'staff' end);
    ends := muted_until;

  elsif action = 'suspension' then
    ends := case when days is not null then now() + make_interval(days => days) end;
    -- Through the panel's own door, so the ceiling on suspending staff and
    -- the admin log both apply, then the end date beside it.
    perform public.admin_set_standing(subject.owner_id, suspended => true, why => said);
    update public.profiles set suspended_until = ends where id = subject.owner_id;

  elsif action = 'termination' then
    perform public.admin_delete_account(subject.owner_id, said);
  end if;

  -- The standing row. Written after the effect, so nothing claims a sanction
  -- that was refused - and not written at all for a termination, because the
  -- account and every row referencing it are gone by now.
  if action <> 'termination' then
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
  end if;

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
