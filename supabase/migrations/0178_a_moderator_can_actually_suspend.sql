begin;

-- Three things the checks caught, and one of them is the third trap again
-- -----------------------------------------------------------------------
--
-- 0177 said a moderator and the machine may suspend an account. Neither
-- could, and a superadmin's termination raised instead of terminating. None
-- of this showed until the checks ran under real identities - as the owner
-- every one of them passes.
--
-- **1. A moderator could not suspend.** `take_report` went through
-- `admin_set_standing`, which is `require_admin()`. A moderator got "This is
-- staff only" from inside the action they had just been told they could
-- take, and the machine - which is not an admin either - got the same. So
-- the suspension is written here instead, with the staff ceiling kept
-- explicitly rather than inherited from a function that meant something
-- else.
--
-- **2. Writing it directly is the third trap**, which is exactly why it has
-- its own paragraph. `guard_profile_update` pins `is_suspended` for anybody
-- who is not an admin, and `security definer` changes a function's rights,
-- not who it reports as - so a moderator's suspension would have returned
-- successfully and changed nothing, which is the worst failure this project
-- has. The fix is the pattern 0105 already established for money: a
-- transaction-local flag the function raises and lowers in the same breath,
-- which the guard honours and nothing else.
--
-- **3. A termination raised a foreign key violation.** `write_admin_log`
-- ran after `admin_delete_account`, and its `subject_id` references
-- `profiles` - a row that no longer existed by the time it was written. The
-- log for a deletion is written inside `admin_delete_account`, before the
-- row goes, which is the only moment the username still exists; so
-- `take_report` settles the ticket and gets out of the way rather than
-- logging a second time.

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if auth.uid() is null then return new; end if;

  /*
   * A function Kobblon trusts, in the middle of its own deliberate write.
   * Set with `true`, so it is transaction-local and cannot leak into
   * another request, and each of them turns it off again immediately.
   */
  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  /*
   * The same promise for a sanction. Separate from the money flag so that a
   * function allowed to move Brix is not thereby allowed to suspend
   * somebody: one flag for two unrelated powers is one flag too few.
   */
  if current_setting('kobbleston.standing', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then return new; end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;

  -- The end of a suspension decides when `lift_expired_suspensions` lets go
  -- of it, so it is as much a part of the sanction as the flag is.
  new.suspended_until := old.suspended_until;

  -- Money. It moves through move_pixels, which writes a ledger row beside
  -- every change; a direct write would move the balance and leave no trace.
  new.pixels := old.pixels;

  -- Identity the site assigns rather than the person.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

/**
 * Suspending an account, with the one rule about reaching upwards.
 *
 * The flag is raised and lowered around the write rather than left for the
 * transaction to end: a suspension and an ordinary profile update can happen
 * in one request, and the second must not inherit the first's permission.
 */
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

-- ---------------------------------------------------------- the action again

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

commit;
