begin;

/*
 * Voice, moderated by reading what was said.
 *
 * Staw: "first off we transcript what the player says in VC then we use
 * Kobby our moderation on what was said then we take action".
 *
 * So there is no new machinery for it, on purpose. A transcript is a line
 * somebody said, and this platform already has a queue for lines somebody
 * said, a prompt that weighs one against the numbered rules, and a ladder
 * that decides what happens by the rule's gravity and the person's bar.
 * Voice joins that queue as a third kind and walks the same path. The two
 * differences are the two that matter:
 *
 *   * **It arrives by hand.** Chat lines are queued by a trigger on the
 *     table they land in. A spoken line has no table: the Launcher
 *     transcribes it and calls `heard_in_voice`. That is the only new door
 *     here, and it is the narrowest one that works.
 *   * **Being quieted for it takes voice too.** A spoken line that breaks a
 *     rule and would have quieted somebody's chat quiets their chat and
 *     their voice. Voice is still never taken on its own - somebody who may
 *     not speak may not type the same thing instead.
 *
 * What a transcript is worth, said plainly because a console that implies
 * more than it knows is worse than no console: speech to text is a guess,
 * and it is a worse guess for a child, an accent, or a room with noise in
 * it. Nothing here treats it as a recording. It is why the card the
 * Launcher shows has one tap that says "I did not say that", and why that
 * tap opens an appeal a person reads.
 */

-- ------------------------------------------------------------ a third kind

alter table public.chat_to_read drop constraint if exists chat_to_read_kind_check;
alter table public.chat_to_read add constraint chat_to_read_kind_check
  check (kind in ('message', 'space_message', 'community_post', 'voice'));

/**
 * A line the Launcher heard, handed over to be read.
 *
 * `where_at` is whatever the application calls the place it was said - a
 * World id, a party id - and it is kept only so a moderator looking at the
 * decision afterwards can tell where it happened. Nothing is looked up
 * from it.
 *
 * Censored on the way in by the same patterns chat goes through, because
 * evidence is what somebody said and not a chance to print it back at them
 * uncensored. `was_masked` says whether anything was caught, which the
 * prompt is told, because a line that arrived with bullets in it is a
 * different thing to read than one that did not.
 *
 * Rate limited to sixty lines a minute per person. A transcriber that
 * breaks and floods is a bill, and the person it is transcribing has not
 * done anything wrong.
 */
create or replace function public.heard_in_voice(said text, where_at text default null)
returns bigint
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  clean text;
  made bigint;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  said := btrim(coalesce(said, ''));
  if said = '' then return null; end if;
  if char_length(said) > 2000 then
    said := left(said, 2000);
  end if;

  if (select count(*) from public.chat_to_read c
       where c.who = me and c.kind = 'voice'
         and c.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'That is more than anybody says in a minute.';
  end if;

  clean := public.censor_text(said, 'chat');

  insert into public.chat_to_read (kind, ref, who, body, was_masked)
  values ('voice', left(coalesce(where_at, 'voice'), 200), me, clean, clean <> said)
  returning id into made;

  return made;
end $$;

grant execute on function public.heard_in_voice(text, text) to authenticated;

-- -------------------------------------------- a spoken line takes voice too

/*
 * The same ladder, with one line added.
 *
 * `what_kobby_may_do` returns 'quieted' or 'quieted_voice' by gravity and
 * band, and it is right about chat. For something said out loud, the rung
 * that quiets chat has to quiet voice as well, or the answer to "you may
 * not say that" is to say it again into a microphone.
 *
 * Done here rather than in `what_kobby_may_do` deliberately: that function
 * decides how hard, from the rule and the person. Which channels a spoken
 * line costs is a fact about the line, and it belongs where the line is.
 */
create or replace function public.judge_chat_line(
  line_id bigint, breaks boolean, rule_code text default null,
  quote text default null, reason text default null, model text default null
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

  -- Said out loud: the rung that quiets chat quiets voice with it.
  if line.kind = 'voice' and rung = 'quieted' then
    rung := 'quieted_voice';
  end if;

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
end $$;

revoke all on function public.judge_chat_line(bigint, boolean, text, text, text, text) from public;
grant execute on function public.judge_chat_line(bigint, boolean, text, text, text, text)
  to authenticated, service_role;

commit;
