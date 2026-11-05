begin;

/*
 * Something you said that got you moderated is struck out where you said
 * it, the moment it is judged.
 *
 * Staw: "in the chat whether its in the launcher chat or the friends chat
 * - if you get moderated for something youve said, even days after, then
 * the text you sent gets instantly censored where it was".
 *
 * It was not, and the gap was worse than it sounds. The filter stars out
 * words as they are typed, and that is the only thing that has ever
 * touched a message after the fact. Kobby reading the *meaning* of a
 * sentence is the case the filter cannot catch - "i wanna take you by your
 * holes" has no word in it to star - so the one kind of line the machine
 * exists to find was the one kind that stayed on screen, in full, for
 * everybody in the conversation, for ever.
 *
 * Struck out rather than deleted, and the original kept: the person who
 * was sent it should not have to wonder what vanished, and the row in
 * `chat_to_read` and the evidence on the violation are what a moderator
 * reads when the appeal arrives. Bullets, the same bullets the filter
 * uses, because a second visual language for "we took this out" is a
 * second thing to learn.
 *
 * It reaches the other side at once without anything new: the chat already
 * listens for UPDATE on `messages` (it had to, for edits), so this is an
 * edit as far as the socket is concerned.
 */

/**
 * Strike out a line where it was said.
 *
 * `kind` and `ref` are what `chat_to_read` kept when the line was queued -
 * which table, and which row. A spoken line has no row to strike, and says
 * so by doing nothing.
 *
 * Every word becomes four bullets. Not the whole message as one blob: the
 * shape of the sentence is what tells somebody scrolling past that
 * something was said and taken out, rather than that the app broke.
 */
create or replace function public.hide_what_was_said(kind text, ref text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  struck text;
begin
  if ref is null or ref = '' then return; end if;

  -- All three are bigserial. A `ref` that is not a number is a row from
  -- somewhere this does not know about, and a cast that throws here would
  -- take the whole verdict down with it.
  if ref !~ '^[0-9]+$' then return; end if;

  if kind = 'message' then
    update public.messages m
       set body = regexp_replace(m.body, '\S+', '••••', 'g')
     where m.id = ref::bigint;
  elsif kind = 'space_message' then
    update public.space_messages m
       set body = regexp_replace(m.body, '\S+', '••••', 'g')
     where m.id = ref::bigint;
  elsif kind = 'community_post' then
    update public.community_posts p
       set body = regexp_replace(p.body, '\S+', '••••', 'g')
     where p.id = ref::bigint;
  end if;

  -- 'voice' falls through on purpose: there is nothing on a screen to
  -- strike, and the transcript is evidence rather than something anybody
  -- is reading.
  struck := null;
end $$;

revoke all on function public.hide_what_was_said(text, text) from public;
grant execute on function public.hide_what_was_said(text, text) to service_role;

/* And the one caller: the moment a line is judged to break a rule. */
create or replace function public.judge_chat_line(line_id bigint, breaks boolean, rule_code text DEFAULT NULL::text, quote text DEFAULT NULL::text, reason text DEFAULT NULL::text, model text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  -- Said out loud: the rung that quiets chat quiets voice with it.
  if line.kind = 'voice' and rung = 'quieted' then
    rung := 'quieted_voice';
  end if;

  why := left(coalesce(nullif(reason, ''), rule.title), 300);

  -- Struck out where it was said, before anything else happens.
  perform public.hide_what_was_said(line.kind, line.ref);

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
            case when line.kind = 'voice' then 'voice' else 'message' end,
            line.ref, said);
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
              case when line.kind = 'voice' then 'voice' else 'message' end,
              line.ref, array['chat', 'voice'], said);
    end if;

    return rung;
  end if;

  -- The top of the ladder, and the end of it.
  if not rules.may_suspend then return 'blocked'; end if;

  insert into public.violations
    (user_id, rule, action, reason, target_type, target_id, evidence)
  values (line.who, rule.code, 'suspension',
          'Rule ' || rule.ord || ': ' || rule.title || '. ' || why,
          case when line.kind = 'voice' then 'voice' else 'message' end,
          line.ref, said);

  update public.profiles set is_suspended = true where id = line.who;
  perform public.flag_account(
    line.who, 'Kobby judged this serious enough to suspend. Rule ' || rule.ord
              || ': ' || rule.title || '.', said);
  insert into public.notifications (user_id, kind, body)
  values (line.who, 'system',
          left('Your account has been suspended over rule ' || rule.ord || ': '
               || rule.title || '. A person reads every appeal.', 300));

  return 'suspended';
end $function$;

revoke all on function public.judge_chat_line(bigint, boolean, text, text, text, text) from public;
grant execute on function public.judge_chat_line(bigint, boolean, text, text, text, text)
  to authenticated, service_role;

commit;
