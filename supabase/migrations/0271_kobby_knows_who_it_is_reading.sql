begin;

-- Kobby reads a name and now knows whose it is.
--
-- Staw: "our AI.. well it should be aware of the status of the accounts..
-- like @kobblon is the official account, like @stawrer is the CEO & founder
-- of kobblon, and who are admins, staff, and mods cuz its sending warnings
-- to our actual mods and staff and admins cuz they write it in bios".
--
-- Two separate faults, and only one of them is the prompt's.
--
-- **The machine's hands were off some staff and not others.** Both
-- `judge_chat_line` and `judge_profile_text` already stopped at
-- `is_admin or is_moderator or is_superadmin`. Neither knew about
-- `has_staff_badge` - which is exactly the person Staw means by "staff", an
-- account with the badge and none of the keys - and `judge_report` had no
-- such check at all, so a report against a moderator was the machine's to
-- settle. One function answers it for all three now.
--
-- **The model was told nothing about whose words it was reading.** A
-- moderator whose bio says "Kobblon moderator" is stating a fact; the same
-- sentence from anybody else is impersonation, and the model had no way to
-- tell those apart because it was handed a handle and a body of text and
-- nothing else. `ai_work` now carries a line about the account, and the
-- worker puts it in the prompt.
--
-- Note what this does *not* do: it never tells the model to go easier on
-- somebody. The hands-off rule is enforced in the database, where it cannot
-- be talked out of, and the line in the prompt is a fact about the writer
-- so the reading is right - not an instruction to forgive.

-- ------------------------------------------------------------ the founder

/*
 * Staw's account, the same way `kobblon_account` finds Kobblon's: by the
 * handle, because this platform has one founder and a column for it would
 * be a column that is wrong the moment somebody is renamed by mistake.
 */
create or replace function public.founder_account()
returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select p.id from public.profiles p
   where lower(p.username) = 'stawrer'
   limit 1;
$$;

create or replace function public.is_founder(who uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select who is not null and who = public.founder_account();
$$;

-- -------------------------------------------------- who the machine leaves

/*
 * Whether Kobby may act against this account at all.
 *
 * Kobblon itself, the founder, superadmins, admins, moderators and anybody
 * carrying the staff badge. The machine still *reads* their words and still
 * records what it thought - what it does not do is warn, rename, quiet or
 * suspend them. A person can, through the console, which is the whole point
 * of there being a console.
 */
create or replace function public.kobby_hands_off(who uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((
    select p.is_admin or p.is_moderator or p.is_superadmin
           or p.has_staff_badge
           or lower(p.username) in ('kobblon', 'kobbleston', 'stawrer')
      from public.profiles p where p.id = who
  ), false);
$$;

/*
 * One line about whose words these are, for the prompt.
 *
 * Only what changes how a sentence should be read. "I am a Kobblon
 * moderator" is a fact from a moderator and a lie from anybody else, and
 * the model cannot tell without this. Null for an ordinary account, which
 * is almost everybody - and a null means the model is told nothing rather
 * than told "this is nobody".
 */
create or replace function public.who_is(who uuid)
returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
    when p.id is null then null
    when lower(p.username) in ('kobblon', 'kobbleston')
      then 'This is Kobblon''s own official account - the platform itself.'
    when lower(p.username) = 'stawrer'
      then 'This is the founder and chief executive of Kobblon.'
    when p.is_superadmin then 'This account runs Kobblon.'
    when p.is_admin then 'This is an administrator of Kobblon.'
    when p.is_moderator then 'This is a moderator of Kobblon.'
    when p.has_staff_badge then 'This is a member of Kobblon staff.'
    when p.is_verified then 'This is a verified account.'
    else null
  end
  from public.profiles p where p.id = who;
$$;

revoke all on function public.founder_account() from public;
revoke all on function public.is_founder(uuid) from public;
revoke all on function public.kobby_hands_off(uuid) from public;
revoke all on function public.who_is(uuid) from public;

grant execute on function public.founder_account() to authenticated, service_role;
grant execute on function public.is_founder(uuid) to authenticated, service_role;
grant execute on function public.kobby_hands_off(uuid) to authenticated, service_role;
grant execute on function public.who_is(uuid) to authenticated, service_role;

-- -------------------------------------------------- the work carries it

/*
 * `ai_work` gains `about`: the line above, for the two kinds of job where
 * the words belong to somebody. An upload, a ticket and an appeal are
 * judged on what they are rather than on who sent them, and a report
 * carries the reported thing rather than a person, so those stay null.
 *
 * Dropped and recreated rather than replaced: a new column is a new return
 * type, and `create or replace` cannot change one.
 */
drop function if exists public.ai_work(integer);

create function public.ai_work(how_many integer default 20)
returns table (subject text, subject_id text, kind text, name text,
               words text, picture text, waiting_minutes integer, about text)
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

  select w.total into waiting from public.ai_work_waiting() w;

  if rules.mode = 'busy' and waiting <= rules.when_over then return; end if;

  return query
    select 'avatar_item', i.id::text, i.kind, i.name,
           coalesce(i.description, ''),
           i.image_path,
           (extract(epoch from now() - i.created_at) / 60)::integer,
           null::text
      from public.avatar_items i
     where i.status = 'pending'
       and (rules.mode <> 'slow' or i.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'asset', a.id::text, a.kind::text, a.name,
           coalesce(a.description, ''),
           a.preview_path,
           (extract(epoch from now() - a.created_at) / 60)::integer,
           null::text
      from public.assets a
     where a.status = 'pending'
       and (rules.mode <> 'slow' or a.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'report', r.id::text, r.reason,
           coalesce(s.label, r.target_type),
           coalesce(r.details, ''),
           null::text,
           (extract(epoch from now() - r.created_at) / 60)::integer,
           public.who_is(s.owner_id)
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
           (extract(epoch from now() - t.created_at) / 60)::integer,
           public.who_is(t.user_id)
      from public.support_tickets t
     where t.status = 'open' and not t.wants_human
       and (rules.mode <> 'slow' or t.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'appeal', ap.id::text, v.action, coalesce(v.reason, v.rule),
           ap.body,
           null::text,
           (extract(epoch from now() - ap.created_at) / 60)::integer,
           null::text
      from public.appeals ap
      join public.violations v on v.id = ap.violation_id
     where ap.status = 'open' and v.moderator_id is null
       and (rules.mode <> 'slow' or ap.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'message', c.id::text, c.kind,
           coalesce(p.username, 'somebody')
             || case when c.was_masked then ' (already masked)' else '' end,
           coalesce(c.said, c.body),
           null::text,
           (extract(epoch from now() - c.created_at) / 60)::integer,
           public.who_is(c.who)
      from public.chat_to_read c
      left join public.profiles p on p.id = c.who
     where c.read_at is null
       and (rules.mode <> 'slow' or c.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'profile_text', n.id::text, n.kind,
           coalesce(p.username, 'somebody'),
           n.body,
           null::text,
           (extract(epoch from now() - n.created_at) / 60)::integer,
           public.who_is(n.who)
      from public.names_to_read n
      left join public.profiles p on p.id = n.who
     where n.read_at is null
       and (rules.mode <> 'slow' or n.created_at < now() - make_interval(mins => rules.after_minutes))
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end $$;

revoke all on function public.ai_work(integer) from public;
grant execute on function public.ai_work(integer) to authenticated, service_role;


-- ------------------------------------------- the three places it is decided

/*
 * `ai_reviews` has to be able to say "staff".
 *
 * The two functions that already stopped at staff returned without writing
 * anything, so the one case anybody would want to look at afterwards left
 * no trace. A ledger refusing a row is how a pass ends up having happened
 * with no record of it, so the constraint is widened here rather than
 * discovered by a failing insert.
 */
alter table public.ai_reviews drop constraint if exists ai_reviews_decision_check;
alter table public.ai_reviews add constraint ai_reviews_decision_check
  check (decision in
    ('approved','rejected','warned','quieted','quieted_voice','suspended',
     'nothing','unsure','answered','escalated','for_a_person',
     'overturned','upheld','staff'));

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

  /*
   * Staff are not the machine's to judge, and that is not an error. Who
   * counts lives in `kobby_hands_off` now - it was three flags written out
   * here, which left the staff badge out, and the staff badge is exactly
   * the person with a job and none of the keys.
   *
   * Recorded rather than returned silently: what Kobby thought about a
   * moderator's line is worth a person seeing, and a judgement that
   * vanishes is how nobody notices the machine disagreeing with the team.
   */
  if public.kobby_hands_off(line.who) then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('message', line_id::text, 'staff',
            left('Rule ' || rule.ord || ' (' || rule.code || '), but this account is '
                 || 'Kobblon''s own, the founder''s or a member of staff. Left for a person. '
                 || coalesce(reason, ''), 500),
            model, said);
    return 'staff';
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

create or replace function public.judge_profile_text(
  entry bigint,
  breaks boolean,
  rule_code text default null,
  reason text default null,
  model text default null
) returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  item record;
  they record;
  rule record;
  band text;
  rung text;
  why text;
  wrote text;
  field text;
  fresh text;
begin
  if not (public.is_the_worker()
          or coalesce((select is_admin from public.profiles where id = auth.uid()), false)) then
    raise exception 'Only the moderation worker may do that.';
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then raise exception 'AI moderation is off.'; end if;

  select * into item from public.names_to_read where id = entry;
  if item is null then return 'gone'; end if;

  -- Read, before anything below can return early.
  update public.names_to_read set read_at = now() where id = entry;

  wrote := left(coalesce(item.body, ''), 200);
  field := case item.kind
             when 'username' then 'handle'
             when 'display_name' then 'display name'
             else 'bio'
           end;

  if not coalesce(breaks, false) or rule_code is null then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('profile_text', entry::text, 'nothing',
            left(coalesce(reason, 'Nothing against the rules.'), 500), model, wrote);
    return 'nothing';
  end if;

  select * into rule from public.moderation_rules where code = rule_code and is_on;
  if rule is null then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('profile_text', entry::text, 'unsure',
            left('Named a rule that does not exist: ' || rule_code, 500), model, wrote);
    return 'unsure';
  end if;

  select username, content_id, is_admin, is_moderator, is_superadmin into they
    from public.profiles where id = item.who;
  if they is null then return 'nothing'; end if;

  /*
   * The same hands-off rule as chat, and the one Staw was actually hit by:
   * "its sending warnings to our actual mods and staff and admins cuz they
   * write it in bios". A moderator's bio saying they are a moderator is a
   * fact, and the model is told so now - but this check is what makes it a
   * database rule rather than a prompt one. A prompt can be argued with; a
   * renamed moderator cannot be un-renamed by explaining.
   */
  if public.kobby_hands_off(item.who) then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('profile_text', entry::text, 'staff',
            left('Rule ' || rule.ord || ' (' || rule.code || '), their ' || field
                 || ', but this account is Kobblon''s own, the founder''s or a member '
                 || 'of staff. Left for a person. ' || coalesce(reason, ''), 500),
            model, wrote);
    return 'staff';
  end if;

  band := public.behaviour_band(public.behaviour_score(item.who));
  rung := public.what_kobby_may_do(rule.gravity, band);

  -- Chat rungs do not apply to a name; see the note at the top.
  if rung in ('quieted', 'quieted_voice') then rung := 'warned'; end if;

  why := left(coalesce(nullif(reason, ''), rule.title), 300);

  insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
  values ('profile_text', entry::text, rung,
          left('Rule ' || rule.ord || ' (' || rule.code || '), ' || band
               || ', their ' || field || ': ' || why, 500),
          model, wrote);

  if rung = 'nothing' then return 'nothing'; end if;
  if not rules.may_warn then return 'blocked'; end if;

  /*
   * The name goes, at every rung above nothing, and this is the remedy
   * rather than the punishment: leaving a slur on a profile page while a
   * warning sits on the record would be answering the wrong question.
   *
   * `kobbleston.renaming` is raised for the handle because `guard_username`
   * pins a changed handle back otherwise, and `kobbleston.standing` for the
   * suspension because `guard_profile_update` pins `is_suspended` back.
   * Both are transaction-local and both are lowered immediately. This is
   * the trap that cost this platform a week: a `security definer` function
   * is trusted for its rights, not for who it reports as, and the guards
   * ask who.
   */
  if item.kind = 'bio' then
    update public.profiles set bio = null where id = item.who;
  elsif item.kind = 'display_name' then
    update public.profiles set display_name = they.username where id = item.who;
  else
    fresh := 'player' || coalesce(they.content_id, 0)::text;
    -- Taken by somebody already, which the id makes unlikely and not
    -- impossible: a few more digits rather than a failed judgement.
    if exists (select 1 from public.profiles where lower(username) = lower(fresh)) then
      fresh := fresh || floor(random() * 900 + 100)::text;
    end if;
    insert into public.username_history (user_id, username) values (item.who, they.username);
    perform set_config('kobbleston.renaming', 'on', true);
    update public.profiles set username = fresh where id = item.who;
    perform set_config('kobbleston.renaming', 'off', true);
  end if;

  insert into public.violations
    (user_id, rule, action, reason, target_type, target_id, evidence)
  values (item.who, rule.code,
          case when rung = 'suspended' then 'suspension' else 'warning' end,
          'Rule ' || rule.ord || ': ' || rule.title || '. ' || why,
          'profile', item.who::text, wrote);

  if rung = 'suspended' then
    if not rules.may_suspend then
      insert into public.notifications (user_id, kind, body)
      values (item.who, 'system',
              left('Your ' || field || ' was taken down over rule ' || rule.ord
                   || ': ' || rule.title || '. You can set a new one.', 300));
      return 'blocked';
    end if;

    perform set_config('kobbleston.standing', 'on', true);
    update public.profiles set is_suspended = true where id = item.who;
    perform set_config('kobbleston.standing', 'off', true);

    perform public.flag_account(
      item.who,
      'Kobby judged their ' || field || ' serious enough to suspend. Rule '
        || rule.ord || ': ' || rule.title || '.',
      wrote);

    insert into public.notifications (user_id, kind, body)
    values (item.who, 'system',
            left('Your account has been suspended over your ' || field
                 || ', rule ' || rule.ord || ': ' || rule.title
                 || '. A person reads every appeal.', 300));
    return 'suspended';
  end if;

  insert into public.notifications (user_id, kind, body)
  values (item.who, 'system',
          left('Your ' || field || ' was taken down over rule ' || rule.ord
               || ': ' || rule.title || '. You can set a new one.', 300));
  return 'warned';
end $$;

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

  /*
   * A report about Kobblon itself, the founder, an admin, a moderator or
   * anybody wearing the staff badge. `judge_report` had no such check at
   * all - chat and names both did - so the one place the machine could
   * still sanction a moderator was a report somebody filed about them.
   * Read, recorded, and left open for a person.
   */
  if public.kobby_hands_off(subject.owner_id) then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('report', ticket::text, 'staff',
            left('About Kobblon''s own account, the founder or a member of staff. '
                 || 'Left for a person. ' || said, 500),
            model, left(coalesce(r.details, ''), 2000));
    return 'staff';
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

revoke all on function public.judge_chat_line(bigint, boolean, text, text, text, text) from public;
grant execute on function public.judge_chat_line(bigint, boolean, text, text, text, text)
  to authenticated, service_role;

revoke all on function public.judge_profile_text(bigint, boolean, text, text, text) from public;
grant execute on function public.judge_profile_text(bigint, boolean, text, text, text)
  to authenticated, service_role;

revoke all on function public.judge_report(bigint, boolean, text, text, text) from public;
grant execute on function public.judge_report(bigint, boolean, text, text, text)
  to authenticated, service_role;

commit;
