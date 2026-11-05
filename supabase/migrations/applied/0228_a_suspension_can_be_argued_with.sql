begin;

/*
 * The standing page learns that a chat or voice suspension can be argued
 * with, and the machine's count stops counting work it cannot take.
 *
 * Two things, both of them consequences of 0226 rather than new ideas.
 *
 * **The history row for a timeout** carried five null appeal columns and
 * `appealable false`, which was true until 0226 and is now a page telling
 * somebody they cannot do a thing they can. It also had no way to name
 * which timeout it was, so a card could not file an appeal about it even
 * if it wanted to - hence `timeout_id`. A lifted timeout now reads as
 * taken back and stops pressing on the bar, which is the whole point of
 * lifting one.
 *
 * **`ai_work`'s own gate** counted every open appeal when working out
 * whether the queue is long enough for 'busy' mode, while the list it
 * hands back only ever includes appeals against a violation a person did
 * not decide. An appeal about a transcript is never handed to the machine
 * - it is a claim about the machine's own evidence, and asking it to mark
 * its own homework is not review - so counting those as work it could
 * take made a 'busy' threshold go off over work that was not there.
 * `ai_work_waiting`, which is what the console shows, had the join right
 * all along; this is the gate agreeing with it.
 */

drop function if exists public.my_moderation_history();

create or replace function public.my_moderation_history()
returns table (
  key text,
  violation_id bigint,
  timeout_id uuid,
  kind text,
  action text,
  rule text,
  rule_ord integer,
  rule_title text,
  rule_body text,
  gravity integer,
  evidence text,
  reason text,
  target_type text,
  target_id text,
  blocks text[],
  channels text[],
  by_rank text,
  at timestamptz,
  until timestamptz,
  is_void boolean,
  void_reason text,
  counts boolean,
  weight numeric,
  appeal_status text,
  appeal_body text,
  appeal_note text,
  appeal_at timestamptz,
  appeal_decided_at timestamptz,
  appealable boolean,
  appeals_used integer,
  appeal_closes_at timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (select auth.uid() as id),
  cleared as (
    select coalesce(
      (select max(r.created_at) from public.behaviour_resets r, me where r.who = me.id),
      '-infinity'::timestamptz
    ) as at
  )
  select
    'violation:' || v.id,
    v.id,
    null::uuid,
    'decision',
    v.action,
    v.rule,
    rr.ord,
    rr.title,
    rr.body,
    rr.gravity,
    v.evidence,
    v.reason,
    v.target_type,
    v.target_id,
    v.blocks,
    array[]::text[],
    case
      when v.moderator_id is null then 'kobby'
      else coalesce(public.staff_rank(v.moderator_id), 'staff')
    end,
    v.created_at,
    v.expires_at,
    v.is_void,
    v.void_reason,
    not v.is_void and v.created_at > c.at,
    case when v.is_void or v.created_at <= c.at then 0::numeric
         else public.violation_weight(v.action, v.created_at) end,
    a.status,
    a.body,
    a.decision_note,
    a.created_at,
    a.decided_at,
    not v.is_void
      and n.used < 2
      and coalesce(a.status, 'declined') = 'declined'
      and now() <= v.created_at + public.appeal_window(v.action, v.user_id),
    n.used,
    v.created_at + public.appeal_window(v.action, v.user_id)
    from public.violations v
    cross join cleared c
    cross join me
    left join public.moderation_rules rr on rr.code = v.rule
    cross join lateral (
      select count(*)::integer as used
        from public.appeals x where x.violation_id = v.id
    ) n
    left join lateral (
      select * from public.appeals x
       where x.violation_id = v.id
       order by x.attempt desc
       limit 1
    ) a on true
   where v.user_id = me.id

  union all

  select
    'timeout:' || t.id::text,
    null::bigint,
    t.id,
    'chat',
    'chat_timeout',
    coalesce(t.rule, 'other'),
    tr.ord,
    tr.title,
    tr.body,
    t.gravity,
    t.evidence,
    t.reason,
    'message',
    null::text,
    array[]::text[],
    t.channels,
    case when t.source = 'machine' then 'kobby' else 'staff' end,
    t.started_at,
    t.until,
    t.lifted_at is not null,
    t.lift_reason,
    t.lifted_at is null and t.started_at > c.at,
    case when t.lifted_at is not null or t.started_at <= c.at then 0::numeric
         else greatest(0::numeric,
                (4 + least(t.minutes, 1440)::numeric / 240)
                * (1 - least(1::numeric,
                    (extract(epoch from (now() - t.started_at)) / 86400)::numeric / 21))) end,
    ta.status,
    ta.body,
    ta.decision_note,
    ta.created_at,
    ta.decided_at,
    t.lifted_at is null
      and tn.used < 2
      and coalesce(ta.status, 'declined') = 'declined'
      and now() <= t.started_at + interval '15 days',
    tn.used,
    t.started_at + interval '15 days'
    from public.chat_timeouts t
    cross join cleared c
    cross join me
    left join public.moderation_rules tr on tr.code = t.rule
    cross join lateral (
      select count(*)::integer as used
        from public.appeals x where x.timeout_id = t.id
    ) tn
    left join lateral (
      select * from public.appeals x
       where x.timeout_id = t.id
       order by x.attempt desc
       limit 1
    ) ta on true
   where t.who = me.id

   -- The ordinal, not the name: a union's select list has no column names
   -- to order by, whatever the function's RETURNS TABLE calls them.
   order by 18 desc
$$;

grant execute on function public.my_moderation_history() to authenticated;

/*
 * One question, asked in one place.
 *
 * Both the console's count and the gate inside `ai_work` need "how many
 * appeals could the machine actually take", and they were two copies of
 * the same join that came apart. This is that join, once.
 */
create or replace function public.appeals_the_machine_may_take()
returns integer
language sql stable security definer
set search_path = public, extensions as $$
  select count(*)::integer
    from public.appeals ap
    join public.violations v on v.id = ap.violation_id
   where ap.status = 'open' and v.moderator_id is null
$$;

grant execute on function public.appeals_the_machine_may_take() to authenticated, service_role;

/* The gate, with the count that matches what is handed back. */
create or replace function public.ai_work(how_many integer DEFAULT 20)
 RETURNS TABLE(subject text, subject_id text, kind text, name text, words text, picture text, waiting_minutes integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    + public.appeals_the_machine_may_take()
    + (select count(*) from public.chat_to_read where read_at is null)
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
     union all
    /*
     * What people actually said: chat, Space chat and Community posts, all
     * three queued into `chat_to_read` by their own triggers since 0189.
     *
     * `was_masked` is handed over with the line because a line that
     * arrived with bullets in it is a different thing to read than one
     * that did not.
     */
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
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end $function$;

revoke all on function public.ai_work(integer) from public;
grant execute on function public.ai_work(integer) to authenticated, service_role;

/* The knock's own 'busy' threshold had the same copy of the join. */
create or replace function public.poke_the_worker()
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  door public.ai_poke;
  waiting integer;
  post regprocedure;
begin
  select * into rules from public.ai_settings where id;
  if not found or not rules.is_on then return false; end if;

  -- 'slow' is the setting that says wait, so it is not woken.
  if rules.mode = 'slow' then return false; end if;

  select * into door from public.ai_poke where id;
  if door.url is null or door.key is null then return false; end if;

  if door.last_at is not null and door.last_at > now() - interval '20 seconds' then
    return false;
  end if;

  if rules.mode = 'busy' then
    select
      (select count(*) from public.avatar_items where status = 'pending')
      + (select count(*) from public.assets where status = 'pending')
      + (select count(*) from public.reports where status = 'open')
      + (select count(*) from public.support_tickets
          where status = 'open' and not wants_human)
      + public.appeals_the_machine_may_take()
      + (select count(*) from public.chat_to_read where read_at is null)
     into waiting;
    if waiting <= rules.when_over then return false; end if;
  end if;

  -- Looked up now, not when this file was applied: the extension can be
  -- turned on after this, and a plain Postgres has never heard of it.
  post := to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)');
  if post is null then return false; end if;

  update public.ai_poke set last_at = now() where id;

  execute format(
    'select %s($1, $2, $3, $4, $5)', post::regproc::text
  ) using
    door.url,
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || door.key
    ),
    5000;

  return true;
end $$;

revoke all on function public.poke_the_worker() from public;
grant execute on function public.poke_the_worker() to authenticated, service_role;

commit;
