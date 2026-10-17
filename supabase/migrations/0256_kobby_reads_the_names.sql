begin;

/*
 * The queue from 0255 handed to Kobby, and what Kobby may do with what it
 * finds.
 *
 * Three pieces, and the middle one is the point: the model says whether a
 * rule is broken and which one, and **the database decides what happens**.
 * Same shape as `judge_chat_line`: gravity from the rule, band from the
 * person's record, rung from `what_kobby_may_do`, and the two switches in
 * `ai_settings` able to stop either end of it. A model that answers
 * "suspend them" is answering a question nobody asked it.
 *
 * One rung is bent for a name, and only one: `quieted` means nothing here,
 * because muting somebody's chat over their bio is a punishment aimed at
 * the wrong thing. It is read as a warning, and the name itself is taken
 * away either way - which is the actual remedy, and happens at every rung
 * above nothing.
 */

-- ------------------------------------------------- the queue, with names

/*
 * `ai_work_waiting` gains a column, so it is dropped and rebuilt rather
 * than replaced: a `returns table` cannot grow a column in place.
 */
drop function if exists public.ai_work_waiting();

create function public.ai_work_waiting()
returns table (is_on boolean, mode text, items integer, assets integer,
               reports integer, tickets integer, appeals integer, lines integer,
               names integer, total integer, oldest_minutes integer)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare rules record;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;
  select * into rules from public.ai_settings where id;
  return query
  with waiting as (
    select
      (select count(*)::integer from public.avatar_items where status = 'pending') as items,
      (select count(*)::integer from public.assets where status = 'pending') as assets,
      (select count(*)::integer from public.reports where status = 'open') as reports,
      (select count(*)::integer from public.support_tickets
        where status = 'open' and not wants_human) as tickets,
      (select count(*)::integer from public.appeals ap
         join public.violations v on v.id = ap.violation_id
        where ap.status = 'open' and v.moderator_id is null) as appeals,
      (select count(*)::integer from public.chat_to_read where read_at is null) as lines,
      (select count(*)::integer from public.names_to_read where read_at is null) as names
  )
  select coalesce(rules.is_on, false), rules.mode,
         w.items, w.assets, w.reports, w.tickets, w.appeals, w.lines, w.names,
         w.items + w.assets + w.reports + w.tickets + w.appeals + w.lines + w.names,
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
             union all
            select min(created_at) from public.chat_to_read where read_at is null
             union all
            select min(created_at) from public.names_to_read where read_at is null
          ) ages)
    from waiting w;
end $$;

grant execute on function public.ai_work_waiting() to authenticated, service_role;

/*
 * The sweep counts names too. Without this a project in `slow` mode with
 * nothing but a waiting handle never wakes: the count it gates on is zero
 * and the knock never comes.
 */
create or replace function public.keep_the_worker_awake()
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  waiting integer;
  oldest integer;
  door public.ai_poke;
  post regprocedure;
begin
  select * into rules from public.ai_settings where id;
  if not found or not rules.is_on then return false; end if;

  -- Counted inline, not read from `ai_work_waiting`: that one raises for
  -- anybody who is neither staff nor the worker, and `pg_cron` is neither.
  select
    (select count(*) from public.avatar_items where status = 'pending')
    + (select count(*) from public.assets where status = 'pending')
    + (select count(*) from public.reports where status = 'open')
    + (select count(*) from public.support_tickets
        where status = 'open' and not wants_human)
    + (select count(*) from public.appeals ap
         join public.violations v on v.id = ap.violation_id
        where ap.status = 'open' and v.moderator_id is null)
    + (select count(*) from public.chat_to_read where read_at is null)
    + (select count(*) from public.names_to_read where read_at is null)
   into waiting;
  if coalesce(waiting, 0) = 0 then return false; end if;

  select (extract(epoch from now() - min(oldest_one)) / 60)::integer into oldest from (
    select min(created_at) as oldest_one from public.avatar_items where status = 'pending'
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
     union all
    select min(created_at) from public.chat_to_read where read_at is null
     union all
    select min(created_at) from public.names_to_read where read_at is null
  ) ages;

  if rules.mode = 'slow' then
    if coalesce(oldest, 0) < coalesce(rules.after_minutes, 60) then return false; end if;

    select * into door from public.ai_poke where id;
    if door.url is null or door.key is null then return false; end if;
    if door.last_at is not null and door.last_at > now() - interval '20 seconds' then
      return false;
    end if;

    post := to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)');
    if post is null then return false; end if;

    update public.ai_poke set last_at = now() where id;
    execute format('select %s($1, $2, $3, $4, $5)', post::regproc::text)
      using door.url, '{}'::jsonb, '{}'::jsonb,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || door.key
        ),
        5000;
    return true;
  end if;

  return public.poke_the_worker();
end $$;

revoke all on function public.keep_the_worker_awake() from public;
grant execute on function public.keep_the_worker_awake() to service_role;

-- ----------------------------------------------- the work, with names in

/*
 * `ai_work` gains the names queue. The `kind` column carries which field it
 * is - `username`, `display_name` or `bio` - and `name` carries whose, so
 * the worker's prompt can say "their handle" rather than handing the model
 * a bare string with no idea where it appears.
 */
create or replace function public.ai_work(how_many integer default 20)
returns table (subject text, subject_id text, kind text, name text,
               words text, picture text, waiting_minutes integer)
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
     union all
    select 'message', c.id::text, c.kind,
           coalesce(p.username, 'somebody')
             || case when c.was_masked then ' (already masked)' else '' end,
           c.body,
           null::text,
           (extract(epoch from now() - c.created_at) / 60)::integer
      from public.chat_to_read c
      left join public.profiles p on p.id = c.who
     where c.read_at is null
       and (rules.mode <> 'slow' or c.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'profile_text', n.id::text, n.kind,
           coalesce(p.username, 'somebody'),
           n.body,
           null::text,
           (extract(epoch from now() - n.created_at) / 60)::integer
      from public.names_to_read n
      left join public.profiles p on p.id = n.who
     where n.read_at is null
       and (rules.mode <> 'slow' or n.created_at < now() - make_interval(mins => rules.after_minutes))
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end $$;

grant execute on function public.ai_work(integer) to authenticated, service_role;

-- --------------------------------------------------------- the judgement

/**
 * One name, display name or bio judged.
 *
 * Returns what was done, in the same words the other judges use, so the
 * console's recent list reads as one list: `nothing`, `gone`, `unsure`,
 * `staff`, `blocked`, `warned`, `suspended`.
 */
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
  if coalesce(they.is_admin, false) or coalesce(they.is_moderator, false)
     or coalesce(they.is_superadmin, false) then
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

revoke all on function public.judge_profile_text(bigint, boolean, text, text, text) from public;
grant execute on function public.judge_profile_text(bigint, boolean, text, text, text)
  to authenticated, service_role;

commit;
