begin;

/*
 * Kobby takes a report ticket
 * -----------------------------------------------------------------------
 *
 * Staw: "and second off Kobby cannot either, fix that".
 *
 * He is right, and it is not the missing-functions fault from 0210. It is
 * a gap that has been there since 0179: `ai_work` has returned open
 * reports to the worker for the machine to read, and `apply_ai_verdict`
 * has no `report` branch at all. The machine reads the ticket, answers
 * `approved` or `rejected` - the vocabulary of screening an upload - and
 * the answer falls through every branch and does nothing. The report stays
 * open. It has been handing the machine work it had no way to finish.
 *
 * `take_report` is already the one door for acting on a report and it has
 * known about the worker since 0178, including the ceiling: the machine
 * may not terminate an account, said as its own refusal. So this does not
 * build a second way in. It works out *what* to do and then goes through
 * that same door.
 *
 * And it works it out the way 0209 does for a line of chat, deliberately:
 * the model says whether the report is founded and which numbered rule it
 * is about, and the rule's gravity and the reported person's behaviour bar
 * decide the rest. One ladder for both, in one function, so "Kobby warned
 * me for this and suspended them for that" has an answer that is the same
 * answer in both places.
 */

/**
 * One report, judged.
 *
 * `founded` false settles the ticket as dismissed, which is a decision and
 * is recorded as one - a queue where dismissals leave no trace is a queue
 * where the same report arrives for ever, and `take_report` has said so
 * since it was written.
 *
 * Returns what it did, or `unsure` when it would not act, in which case
 * the report is left open exactly as it was for a person to read.
 */
create or replace function public.judge_report(
  ticket bigint,
  founded boolean,
  rule_code text default null,
  why text default null,
  model text default null
)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  r public.reports%rowtype;
  subject record;
  rule record;
  band text;
  rung text;
  said text;
  took text;
begin
  if not (public.is_the_worker()
          or coalesce((select is_admin from public.profiles where id = auth.uid()), false)) then
    raise exception 'Only the moderation worker may do that.';
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then raise exception 'AI moderation is off.'; end if;

  select * into r from public.reports where id = ticket;
  if r.id is null then return 'gone'; end if;
  if r.status <> 'open' then return 'settled'; end if;

  said := left(coalesce(nullif(btrim(coalesce(why, '')), ''), 'Kobby read this report.'), 500);

  -- Nothing in it. Recorded, settled, and the reporter is not told they
  -- were wrong by a machine that read three lines - `take_report` handles
  -- the wording.
  if not coalesce(founded, false) then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('report', ticket::text, 'nothing', said, model, left(coalesce(r.details, ''), 2000));
    perform public.take_report(ticket, 'nothing', said, 'other', null,
                               'Dismissed by Kobby. ' || said);
    return 'nothing';
  end if;

  select * into rule from public.moderation_rules where code = rule_code and is_on;
  if rule is null then
    -- A rule the model invented is not a rule, and a report is somebody
    -- waiting for an answer, so this one is left open rather than guessed
    -- at.
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('report', ticket::text, 'unsure',
            left('Named a rule that does not exist: ' || coalesce(rule_code, 'none'), 500),
            model, left(coalesce(r.details, ''), 2000));
    return 'unsure';
  end if;

  select * into subject from public.report_subject(r.target_type, r.target_id) limit 1;
  if subject.owner_id is null then
    -- The thing is gone, or it belongs to nobody. Either way there is
    -- nobody to act against and `take_report` would refuse, so it is left
    -- for a person to close.
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('report', ticket::text, 'unsure',
            'There is nobody to act against.', model, left(coalesce(r.details, ''), 2000));
    return 'unsure';
  end if;

  band := public.behaviour_band(public.behaviour_score(subject.owner_id));
  rung := public.what_kobby_may_do(rule.gravity, band);

  insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
  values ('report', ticket::text,
          case rung
            when 'quieted_voice' then 'quieted'
            when 'nothing' then 'nothing'
            else rung end,
          left('Rule ' || rule.ord || ' (' || rule.code || '), ' || band || ': ' || said, 500),
          model, left(coalesce(r.details, ''), 2000));

  /*
   * Founded, and the ladder says the rung does not reach them. Settled
   * rather than left open: a report that was read and found true but too
   * small to act on is finished work, and saying so in the note is what
   * makes the next one about the same person land differently.
   */
  if rung = 'nothing' then
    perform public.take_report(
      ticket, 'nothing', said, rule.code, null,
      'Kobby found this report fair but too minor to act on, given their record. '
      || 'Rule ' || rule.ord || ': ' || rule.title || '. ' || said);
    return 'nothing';
  end if;

  if rung = 'warned' then
    if not rules.may_warn then return 'blocked'; end if;
    took := 'warning';
  elsif rung in ('quieted', 'quieted_voice') then
    if not rules.may_warn then return 'blocked'; end if;
    -- `take_report` has one chat action and no voice one yet. The heavier
    -- rung is recorded as what it is and lands as a chat suspension, which
    -- is the honest shortfall rather than a silent one.
    took := 'chat_suspension';
  else
    if not rules.may_suspend then return 'blocked'; end if;
    took := 'suspension';
  end if;

  perform public.take_report(
    ticket, took,
    'Rule ' || rule.ord || ': ' || rule.title || '. ' || said,
    rule.code,
    -- A hard limit is held until a person looks at it; everything else has
    -- a week on it.
    case when took = 'suspension' and rule.gravity < 4 then 7 end,
    'Decided by Kobby. Rule ' || rule.ord || ', behaviour bar: ' || band || '.');

  return rung;
end $$;

grant execute on function public.judge_report(bigint, boolean, text, text, text)
  to authenticated;

commit;
