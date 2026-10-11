begin;

-- Kobby answers a support ticket, and an appeal against its own decision
-- -----------------------------------------------------------------------
--
-- Staw: "make that the machine can give Answers to Support tickets &
-- appeals."
--
-- Two functions, both worker-or-admin only, both deliberately narrower than
-- what the sentence allows. What they will not do is the part worth reading:
--
--   * A ticket whose opener ticked **"I want a person"** is never answered
--     by the machine. That box is the one promise this form makes, and a
--     machine answering it would make the box a lie. It comes back
--     `for_a_person` and stays at the top of the queue.
--
--   * The machine **never closes a ticket.** Answered is as far as it goes.
--     Closing is the opener's word, or a moderator's.
--
--   * An appeal against a decision a **person** made is never decided by the
--     machine. `violations.moderator_id` is null exactly when Kobby decided
--     it; anything else is a colleague's judgement and not the machine's to
--     reverse or to rubber-stamp.
--
--   * The machine may **overturn** any decision of its own, at any weight -
--     an overturn is always in the account's favour and the worst case is a
--     sanction lifted too readily. It may **uphold** only a warning or a
--     chat suspension. An upheld suspension is somebody telling a person
--     "you stay suspended", and that is a human sentence.
--
-- Nothing here can delete an account, which remains Staw's standing rule and
-- is held in three places now: `take_report`, `admin_delete_account` and
-- `what_kobby_may_do`.

-- -------------------------------------------- the words a review may use

-- `ai_reviews.decision` is a closed set, and every word below is new. The
-- ledger refusing a row is how a machine pass ends up having happened with
-- no record of it, so the constraint is widened here rather than discovered
-- by a failing insert.
alter table public.ai_reviews drop constraint if exists ai_reviews_decision_check;
alter table public.ai_reviews add constraint ai_reviews_decision_check
  check (decision in
    ('approved','rejected','warned','quieted','quieted_voice','suspended',
     'nothing','unsure','answered','escalated','for_a_person',
     'overturned','upheld'));

-- ------------------------------------------------------------ the answer

/**
 * Write Kobblon's reply to a support ticket, as Kobblon.
 *
 * `sender_id` is left null on purpose: the thread draws a staff message as
 * Kobblon rather than as whoever wrote it, and a null sender is the honest
 * version of that for a machine reply. `from_staff` is what the page reads.
 *
 * Returns what it did, in one word, so a worker log says something:
 * `answered`, `for_a_person`, `already_answered`, `gone`.
 */
create or replace function public.answer_ticket(
  ticket bigint, reply text, confident boolean, model text default null
) returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare one public.support_tickets;
begin
  if not (public.is_the_worker() or public.is_admin()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into one from public.support_tickets where id = ticket;
  if one.id is null then return 'gone'; end if;

  -- Settled already, by a person or by an earlier pass. Not touched again:
  -- a second machine reply on a thread somebody has answered reads as the
  -- platform talking over itself.
  if one.status in ('answered', 'closed') then
    return 'already_answered';
  end if;

  if one.wants_human then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model)
    values ('ticket', ticket::text, 'for_a_person',
            'They asked for a person, so this was left alone.', model);
    return 'for_a_person';
  end if;

  -- Not sure, or nothing to say. Passed up rather than answered with
  -- something vague, and said so on the ticket's own row so the queue shows
  -- it rather than it looking untouched.
  if not confident or coalesce(btrim(reply), '') = '' then
    update public.support_tickets
       set status = 'escalated', updated_at = now()
     where id = ticket;
    insert into public.ai_reviews (subject, subject_id, decision, reason, model)
    values ('ticket', ticket::text, 'escalated',
            'Not confident enough to answer, so a person has it.', model);
    return 'escalated';
  end if;

  insert into public.support_messages (ticket_id, sender_id, from_staff, body)
  values (ticket, null, true, left(btrim(reply), 4000));

  update public.support_tickets
     set status = 'answered', updated_at = now()
   where id = ticket;

  insert into public.ai_reviews (subject, subject_id, decision, reason, model)
  values ('ticket', ticket::text, 'answered', left(btrim(reply), 500), model);

  perform public.send_mail(
    one.user_id, 'support', 'Kobblon replied to your ticket',
    left(btrim(reply), 500), '/support/' || ticket::text
  );

  return 'answered';
end $$;

revoke all on function public.answer_ticket(bigint, text, boolean, text) from public;
grant execute on function public.answer_ticket(bigint, text, boolean, text)
  to authenticated, service_role;

-- ------------------------------------------------------------ the appeal

/**
 * Decide an appeal, where the decision being appealed was the machine's own.
 *
 * Deliberately not `decide_appeal`. That one is a moderator's function: it
 * stamps `decided_by = auth.uid()`, and the worker has no `auth.uid()`, so
 * an appeal answered through it would read as decided by nobody. This writes
 * the same columns and leaves `decided_by` null, which `appeal_queue`
 * already renders as Kobby.
 *
 * Returns `overturned`, `upheld`, `for_a_person` or `gone`.
 */
create or replace function public.judge_appeal(
  appeal bigint, overturn boolean, why text, model text default null
) returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  one public.appeals;
  hit public.violations;
  words text := left(coalesce(nullif(btrim(why), ''), 'Looked at again.'), 1000);
begin
  if not (public.is_the_worker() or public.is_admin()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into one from public.appeals where id = appeal;
  if one.id is null then return 'gone'; end if;
  if one.status <> 'open' then return 'gone'; end if;

  select * into hit from public.violations where id = one.violation_id;
  if hit.id is null then return 'gone'; end if;

  -- A person decided this. The machine does not reverse a colleague and does
  -- not back one up either: both are a human saying something to the account.
  if hit.moderator_id is not null then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model)
    values ('appeal', appeal::text, 'for_a_person',
            'A person made the decision being appealed.', model);
    return 'for_a_person';
  end if;

  -- Upholding a suspension is telling somebody they stay suspended. That is
  -- a sentence a person passes.
  if not overturn and hit.action not in ('warning', 'chat_suspension') then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model)
    values ('appeal', appeal::text, 'for_a_person',
            'Upholding a ' || hit.action || ' is a person''s call.', model);
    return 'for_a_person';
  end if;

  update public.appeals
     set status = case when overturn then 'upheld' else 'declined' end,
         decision_note = words, decided_by = null, decided_at = now()
   where id = appeal;

  if overturn then
    update public.violations
       set is_void = true, void_reason = words
     where id = one.violation_id;

    -- Only lift the account if nothing else is still holding it down. The
    -- question is asked of the ledger rather than remembered from before the
    -- void, because another sanction may have landed in between.
    if not exists (
      select 1 from public.violations v
       where v.user_id = one.user_id and not v.is_void
         and v.action in ('suspension', 'termination')
         and (v.expires_at is null or v.expires_at > now())
    ) then
      update public.profiles set is_suspended = false, suspended_until = null
       where id = one.user_id;
    end if;

    -- A chat suspension that was wrong should stop being served too, or the
    -- appeal is upheld and the person still cannot talk.
    if hit.action = 'chat_suspension' then
      -- `chat_timeouts` names the account `who`, not `user_id`. A plpgsql
      -- body is not checked until it runs, so the wrong column name here
      -- would have been an appeal upheld and a person still unable to talk.
      update public.chat_timeouts
         set until = now()
       where who = one.user_id and until > now();
    end if;
  end if;

  insert into public.ai_reviews (subject, subject_id, decision, reason, model)
  values ('appeal', appeal::text,
          case when overturn then 'overturned' else 'upheld' end, words, model);

  perform public.send_mail(
    one.user_id, 'moderation',
    case when overturn then 'Your appeal was upheld' else 'Your appeal was declined' end,
    words, '/standing'
  );

  return case when overturn then 'overturned' else 'upheld' end;
end $$;

revoke all on function public.judge_appeal(bigint, boolean, text, text) from public;
grant execute on function public.judge_appeal(bigint, boolean, text, text)
  to authenticated, service_role;

-- ------------------------------------------------- what the worker is handed

/**
 * What is waiting, now including tickets and appeals.
 *
 * `words` is what there is to read in each case - the opener's message for a
 * ticket, the appeal's own words for an appeal - and `name` is the subject
 * line or the action being appealed, so the worker has the gist before it
 * reads anything else.
 *
 * Tickets that asked for a person are not handed over at all. The machine
 * would only hand them back, and a queue that includes work nobody may do is
 * a queue that lies about how much is waiting.
 */
create or replace function public.ai_work(how_many integer default 20)
returns table (
  subject text, subject_id text, kind text, name text, words text,
  picture text, waiting_minutes integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  rules record;
  waiting integer;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    return;
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then return; end if;

  select
    (select count(*) from public.avatar_items where status = 'pending')
    + (select count(*) from public.assets where status = 'pending')
    + (select count(*) from public.reports where status = 'open')
    + (select count(*) from public.support_tickets
        where status = 'open' and not wants_human)
    + (select count(*) from public.appeals where status = 'open')
   into waiting;

  if rules.mode = 'busy' and waiting <= rules.when_over then return; end if;

  return query
    select 'avatar_item', i.id::text, i.kind, i.name,
           coalesce(i.description, ''),
           i.image_path,
           (extract(epoch from now() - i.created_at) / 60)::integer
      from public.avatar_items i
     where i.status = 'pending'
       and (rules.mode <> 'slow' or i.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'asset', a.id::text, a.kind::text, a.name,
           coalesce(a.description, ''),
           a.preview_path,
           (extract(epoch from now() - a.created_at) / 60)::integer
      from public.assets a
     where a.status = 'pending'
       and (rules.mode <> 'slow' or a.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'report', r.id::text, r.reason,
           coalesce(s.label, r.target_type),
           coalesce(r.details, ''),
           null::text,
           (extract(epoch from now() - r.created_at) / 60)::integer
      from public.reports r
      cross join lateral public.report_subject(r.target_type, r.target_id) s
     where r.status = 'open'
       and (rules.mode <> 'slow' or r.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'ticket', t.id::text, t.topic, t.subject,
           coalesce((select m.body from public.support_messages m
                      where m.ticket_id = t.id and not m.from_staff
                      order by m.created_at limit 1), ''),
           null::text,
           (extract(epoch from now() - t.created_at) / 60)::integer
      from public.support_tickets t
     where t.status = 'open' and not t.wants_human
       and (rules.mode <> 'slow' or t.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'appeal', ap.id::text, v.action, coalesce(v.reason, v.rule),
           ap.body,
           null::text,
           (extract(epoch from now() - ap.created_at) / 60)::integer
      from public.appeals ap
      join public.violations v on v.id = ap.violation_id
     where ap.status = 'open' and v.moderator_id is null
       and (rules.mode <> 'slow' or ap.created_at < now() - make_interval(mins => rules.after_minutes))
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end $$;

/**
 * The same two added to the count the console shows.
 *
 * The count and the queue have to agree or the console says "nothing is
 * waiting" over a worker that is busy, which is how the last one of these
 * went unnoticed.
 */
-- The shape changes (two new columns), and `create or replace` refuses a
-- return-type change - the same 42P13 that stopped 0210 on the live
-- database. Dropped first, in the same transaction.
drop function if exists public.ai_work_waiting();

create or replace function public.ai_work_waiting()
returns table (
  is_on boolean, mode text, items integer, assets integer,
  reports integer, tickets integer, appeals integer,
  total integer, oldest_minutes integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare rules record;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;
  select * into rules from public.ai_settings where id;
  return query
  select coalesce(rules.is_on, false), rules.mode,
         (select count(*)::integer from public.avatar_items where status = 'pending'),
         (select count(*)::integer from public.assets where status = 'pending'),
         (select count(*)::integer from public.reports where status = 'open'),
         (select count(*)::integer from public.support_tickets
           where status = 'open' and not wants_human),
         (select count(*)::integer from public.appeals ap
            join public.violations v on v.id = ap.violation_id
           where ap.status = 'open' and v.moderator_id is null),
         (select count(*)::integer from public.avatar_items where status = 'pending')
         + (select count(*)::integer from public.assets where status = 'pending')
         + (select count(*)::integer from public.reports where status = 'open')
         + (select count(*)::integer from public.support_tickets
             where status = 'open' and not wants_human)
         + (select count(*)::integer from public.appeals ap
              join public.violations v on v.id = ap.violation_id
             where ap.status = 'open' and v.moderator_id is null),
         (select (extract(epoch from now() - min(oldest)) / 60)::integer from (
            select min(created_at) as oldest from public.avatar_items where status = 'pending'
             union all
            select min(created_at) from public.assets where status = 'pending'
             union all
            select min(created_at) from public.reports where status = 'open'
             union all
            select min(created_at) from public.support_tickets
             where status = 'open' and not wants_human
             union all
            select min(ap.created_at) from public.appeals ap
              join public.violations v on v.id = ap.violation_id
             where ap.status = 'open' and v.moderator_id is null
          ) ages);
end $$;

grant execute on function public.ai_work_waiting to authenticated;

commit;
