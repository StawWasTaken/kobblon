begin;

/*
 * What Kobby may do, worked out from the rule and the bar
 * -----------------------------------------------------------------------
 *
 * Staw: "if it does then kobby can take action against the user depending
 * on their account standing & the gravity of their actions. it can be a
 * warning, then a chat dock/chat/voice chat suspension".
 *
 * Two numbers decide it and they are both already in the database: the
 * rule's `gravity` from 0207, and the account's `behaviour_band` from
 * 0202. The model supplies neither. It reads a sentence, says which rule
 * it breaks, and quotes the part it is judging - and that is the whole of
 * its authority. **What happens as a result is decided here**, for the
 * same reason the limits have always been here rather than in the worker:
 * that is a program on a server anybody with the keys can redeploy, and
 * this is not.
 *
 * So the bar does what Staw said it would do: "the better your behaviour
 * was the less moderated & punished you will be". The identical sentence
 * from an exemplary account and from a critical one lands two or three
 * rungs apart, and nobody had to write that rule twice.
 *
 * The ladder, and the floors and ceilings on it, are in
 * `what_kobby_may_do` where they can be read in one piece. Gravity 4 - the
 * hard limits, the ones the guidelines already say get no warning first -
 * ignores the bar entirely. A perfect record is not a credit against
 * doxxing somebody.
 *
 * **And the top of this ladder is still a suspension.** There is no branch
 * here that deletes an account, there is no argument the model can make
 * that produces one, and `apply_ai_verdict` has refused the word since it
 * was written. "ONLY WARNINGS AND SUSPENSIONS, AI CANNOT DELETE AN
 * ACCOUNT" has not moved and this does not move it.
 */

/**
 * The ladder: a rule's gravity, an account's band, one rung.
 *
 *   nothing        recorded and no more
 *   warned         a letter, and it goes on the record
 *   quieted        chat suspended, on 0171's climbing ladder
 *   quieted_voice  chat and voice suspended, and a violation on the bar
 *   suspended      the account, which is as far as the machine ever goes
 *
 * Written as a function rather than inline so it can be read, argued with
 * and tested on its own - which is the only way anybody will ever check
 * that an exemplary account and a critical one are treated differently in
 * the direction intended.
 */
create or replace function public.what_kobby_may_do(gravity integer, band text)
returns text
language sql immutable
set search_path = public, extensions as $$
  select (array['nothing', 'warned', 'quieted', 'quieted_voice', 'suspended'])[
    case
      -- The hard limits do not consult anybody's record.
      when gravity >= 4 then 5
      else least(
        greatest(
          gravity + case band
            when 'exemplary' then -1
            when 'good' then 0
            when 'mixed' then 0
            when 'poor' then 1
            else 2
          end,
          -- A floor, so a spotless record is not a free one. Breaking a
          -- rule the platform calls serious is never nothing.
          case when gravity >= 3 then 3 when gravity = 2 then 2 else 1 end
        ),
        -- A ceiling: only a rule Kobblon itself calls serious can reach
        -- the account, however bad the record behind it is.
        case when gravity >= 3 then 5 else 4 end
      )
    end
  ]
$$;

/**
 * One line, judged.
 *
 * The worker calls this once per message in `chat_to_read`, with what the
 * model said: whether it breaks a rule, which numbered rule, and the words
 * it is judging. Everything else - the gravity, the band, the rung, who is
 * exempt, whether the settings even allow it - is read here.
 *
 * It returns what it did, in the same vocabulary as the ladder, so the
 * console's "looked: 12" can become a sentence somebody can act on.
 *
 * The line is marked read whatever the answer is, including the usual one,
 * which is `nothing`. A queue that only clears when the machine objects is
 * a queue that never clears.
 */
create or replace function public.judge_chat_line(
  line_id bigint,
  breaks boolean,
  rule_code text default null,
  quote text default null,
  reason text default null,
  model text default null
)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  line record;
  they record;
  rule record;
  band text;
  rung text;
  said text;
  why text;
begin
  if not (public.is_the_worker()
          or coalesce((select is_admin from public.profiles where id = auth.uid()), false)) then
    raise exception 'Only the moderation worker may do that.';
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then raise exception 'AI moderation is off.'; end if;

  select * into line from public.chat_to_read where id = line_id;
  if line is null then return 'gone'; end if;

  -- Read, whatever happens below, and before anything can return early.
  update public.chat_to_read set read_at = now() where id = line_id;

  -- What it was shown, kept as it was stored: already censored by the
  -- patterns. Evidence is what somebody said, not a chance to print it
  -- back at them uncensored.
  said := left(coalesce(nullif(quote, ''), line.body), 500);

  if not coalesce(breaks, false) or rule_code is null then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('message', line_id::text, 'nothing', left(coalesce(reason, 'Nothing against the rules.'), 500), model, said);
    return 'nothing';
  end if;

  select * into rule from public.moderation_rules where code = rule_code and is_on;
  if rule is null then
    -- A rule the model invented is not a rule. Recorded as unsure so
    -- somebody can see the model is answering off the list it was given.
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('message', line_id::text, 'unsure',
            left('Named a rule that does not exist: ' || rule_code, 500), model, said);
    return 'unsure';
  end if;

  if line.who is null then return 'nothing'; end if;

  select is_admin, is_moderator, is_superadmin into they
    from public.profiles where id = line.who;
  if they is null then return 'nothing'; end if;
  if coalesce(they.is_admin, false) or coalesce(they.is_moderator, false)
     or coalesce(they.is_superadmin, false) then
    return 'staff';  -- staff are not the machine's to judge, and that is not an error
  end if;

  band := public.behaviour_band(public.behaviour_score(line.who));
  rung := public.what_kobby_may_do(rule.gravity, band);

  why := left(coalesce(nullif(reason, ''), rule.title), 300);

  insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
  values ('message', line_id::text,
          case rung when 'quieted_voice' then 'quieted' else rung end,
          left('Rule ' || rule.ord || ' (' || rule.code || '), ' || band || ': ' || why, 500),
          model, said);

  if rung = 'nothing' then return 'nothing'; end if;

  -- A warning is a letter and a row on the record. Not just a letter: a
  -- warning nobody can count is a warning that never escalates.
  if rung = 'warned' then
    if not rules.may_warn then return 'blocked'; end if;
    insert into public.violations
      (user_id, rule, action, reason, target_type, target_id, evidence)
    values (line.who, rule.code, 'warning',
            'Rule ' || rule.ord || ': ' || rule.title || '. ' || why,
            'message', line.ref, said);
    insert into public.notifications (user_id, kind, body)
    values (line.who, 'system',
            left('A warning about rule ' || rule.ord || ': ' || rule.title || '.', 300));
    return 'warned';
  end if;

  if rung in ('quieted', 'quieted_voice') then
    if not rules.may_warn then return 'blocked'; end if;

    perform public.mute_chat(
      line.who, why, 'machine', said, rule.code, rule.gravity,
      case when rung = 'quieted_voice' then array['chat', 'voice'] else array['chat'] end);

    -- The heavier rung also leaves a mark on the bar, which a chat
    -- suspension on its own does only faintly and only for three weeks.
    if rung = 'quieted_voice' then
      insert into public.violations
        (user_id, rule, action, reason, target_type, target_id, blocks, evidence)
      values (line.who, rule.code, 'feature_block',
              'Rule ' || rule.ord || ': ' || rule.title || '. ' || why,
              'message', line.ref, array['chat', 'voice'], said);
    end if;

    return rung;
  end if;

  -- The top of the ladder, and the end of it.
  if not rules.may_suspend then return 'blocked'; end if;

  insert into public.violations
    (user_id, rule, action, reason, target_type, target_id, evidence)
  values (line.who, rule.code, 'suspension',
          'Rule ' || rule.ord || ': ' || rule.title || '. ' || why,
          'message', line.ref, said);

  update public.profiles set is_suspended = true where id = line.who;
  perform public.flag_account(
    line.who, 'Kobby judged this serious enough to suspend. Rule ' || rule.ord
              || ': ' || rule.title || '.', said);
  insert into public.notifications (user_id, kind, body)
  values (line.who, 'system',
          left('Your account has been suspended over rule ' || rule.ord || ': '
               || rule.title || '. A person reads every appeal.', 300));

  return 'suspended';
end $$;

grant execute on function public.judge_chat_line(bigint, boolean, text, text, text, text)
  to authenticated;

commit;
