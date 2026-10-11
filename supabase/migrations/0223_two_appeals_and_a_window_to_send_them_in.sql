begin;

/*
 * An appeal can be sent twice, and only for a while.
 *
 * What was here: one unique index, `appeals_one_per_violation`, and a
 * `file_appeal` that refused the second one with "That decision has already
 * been appealed." No window at all - a warning from a year ago was as
 * appealable as one from this morning.
 *
 * What Staw asked for, and what this is:
 *
 *   * **Two goes.** You send one; we answer it. If we declined it you may
 *     send a second, and that is the end of it. Upheld means there is
 *     nothing left to appeal, and an appeal still open is not a reason to
 *     write another one.
 *   * **Fifteen days** from the decision for everything we do short of
 *     closing an account.
 *   * **A closed account** is different, because it is the one decision
 *     somebody cannot work around by waiting: a month everywhere, and six
 *     months for somebody in the EU.
 *
 * On how the EU part decides: the only thing this platform knows about where
 * anybody is, is the time zone their browser reported, kept on `account_sessions` by
 * `set_session_country`. That is a setting on somebody's machine and a hint,
 * nothing more - so it is used **only to lengthen** the window, never to
 * shorten one. Somebody who sets their machine to Dublin gets six months
 * instead of one; nobody loses a day over a zone we read wrong. That is the
 * right way round for a deadline that decides whether a person can argue
 * about losing their account.
 */

-- ------------------------------------------------------- the second attempt

alter table public.appeals
  add column if not exists attempt smallint not null default 1
    check (attempt in (1, 2));

/* The old index said one per decision, full stop. Two per decision now, and
   still never two with the same number. */
drop index if exists public.appeals_one_per_violation;

create unique index if not exists appeals_one_per_violation_attempt
  on public.appeals (violation_id, attempt);

-- ------------------------------------------------------------- the window

/**
 * How long somebody has to appeal a decision, by what the decision was.
 *
 * `who` is read for the EU case only, and only ever to make the window
 * longer - see the note at the top of this file.
 */
create or replace function public.appeal_window(what text, who uuid)
returns interval
language sql stable security definer
set search_path = public, extensions as $$
  select case
    when what <> 'termination' then interval '15 days'
    when exists (
      select 1 from public.account_sessions s
       where s.user_id = who
         and s.country in (
           'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR',
           'HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'
         )
    ) then interval '6 months'
    else interval '1 month'
  end
$$;

grant execute on function public.appeal_window(text, uuid) to authenticated, service_role;

-- --------------------------------------------------------- sending one

/**
 * Sending an appeal, first or second.
 *
 * Every refusal says which of the four walls was hit, because "that did not
 * send" is the kind of message somebody writes a support ticket about.
 */
create or replace function public.file_appeal(violation bigint, body text)
returns bigint
language plpgsql security definer
set search_path = public, extensions as $$
declare
  row_v public.violations;
  used integer;
  last_one public.appeals;
  made bigint;
  closes timestamptz;
begin
  select * into row_v from public.violations v
   where v.id = violation and v.user_id = auth.uid();

  if row_v.id is null then
    raise exception 'There is no decision of yours with that number.';
  end if;

  if row_v.is_void then
    raise exception 'That decision has already been taken back, so there is nothing to appeal.';
  end if;

  closes := row_v.created_at + public.appeal_window(row_v.action, row_v.user_id);
  if now() > closes then
    raise exception 'The time to appeal that decision ran out on %.',
      to_char(closes, 'FMDD FMMonth YYYY');
  end if;

  select count(*)::integer into used
    from public.appeals a where a.violation_id = violation;

  if used >= 2 then
    raise exception 'You have had both goes at that decision.';
  end if;

  if used = 1 then
    select * into last_one from public.appeals a where a.violation_id = violation;

    if last_one.status = 'open' then
      raise exception 'Your appeal against that decision has not been answered yet.';
    end if;

    if last_one.status = 'upheld' then
      raise exception 'That appeal was upheld, so there is nothing left to appeal.';
    end if;
  end if;

  insert into public.appeals (violation_id, user_id, body, attempt)
  values (violation, auth.uid(), body, used + 1)
  returning id into made;

  return made;
end $$;

grant execute on function public.file_appeal(bigint, text) to authenticated;

-- ------------------------------------------- what the standing page is told

/*
 * Three columns more: how many goes have been used, when the window shuts,
 * and `appealable` now meaning all four walls rather than "no appeal yet".
 *
 * The appeal joined is the **latest attempt**, because that is the one
 * somebody came back to read. A `left join` on violation_id alone returns
 * two rows per decision the moment a second appeal exists, which would have
 * doubled every row on the page.
 */
drop function if exists public.my_moderation_history();

create or replace function public.my_moderation_history()
returns table (
  key text,
  violation_id bigint,
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
    false,
    null::text,
    t.started_at > c.at,
    case when t.started_at <= c.at then 0::numeric
         else greatest(0::numeric,
                (4 + least(t.minutes, 1440)::numeric / 240)
                * (1 - least(1::numeric,
                    (extract(epoch from (now() - t.started_at)) / 86400)::numeric / 21))) end,
    null::text, null::text, null::text, null::timestamptz, null::timestamptz,
    false,
    0,
    null::timestamptz
    from public.chat_timeouts t
    cross join cleared c
    cross join me
    left join public.moderation_rules tr on tr.code = t.rule
   where t.who = me.id

   -- The ordinal, not the name: a union's select list has no column names
   -- to order by, whatever the function's RETURNS TABLE calls them.
   order by 17 desc
$$;

grant execute on function public.my_moderation_history() to authenticated;

/*
 * The staff version had the same double-row problem waiting in it, and only
 * ever wanted one word out of the appeal.
 */
create or replace function public.moderation_history_of(target uuid)
returns table (
  key text, kind text, action text, rule text, rule_ord integer,
  gravity integer, evidence text, reason text, channels text[],
  by_rank text, at timestamptz, until timestamptz,
  is_void boolean, counts boolean, weight numeric, appeal_status text
)
language sql stable security definer
set search_path = public, extensions as $$
  with guard as (select public.is_moderator() as may),
  cleared as (
    select coalesce(
      (select max(r.created_at) from public.behaviour_resets r where r.who = target),
      '-infinity'::timestamptz
    ) as at
  )
  select 'violation:' || v.id, 'decision', v.action, v.rule, rr.ord,
         rr.gravity, v.evidence, v.reason, array[]::text[],
         case when v.moderator_id is null then 'kobby'
              else coalesce(public.staff_rank(v.moderator_id), 'staff') end,
         v.created_at, v.expires_at, v.is_void,
         not v.is_void and v.created_at > c.at,
         case when v.is_void or v.created_at <= c.at then 0::numeric
              else public.violation_weight(v.action, v.created_at) end,
         a.status
    from public.violations v
    cross join cleared c
    cross join guard g
    left join public.moderation_rules rr on rr.code = v.rule
    left join lateral (
      select x.status from public.appeals x
       where x.violation_id = v.id
       order by x.attempt desc
       limit 1
    ) a on true
   where v.user_id = target and g.may

  union all

  select 'timeout:' || t.id::text, 'chat', 'chat_timeout',
         coalesce(t.rule, 'other'), tr.ord, t.gravity, t.evidence, t.reason,
         t.channels,
         case when t.source = 'machine' then 'kobby' else 'staff' end,
         t.started_at, t.until, false,
         t.started_at > c.at,
         case when t.started_at <= c.at then 0::numeric
              else greatest(0::numeric,
                     (4 + least(t.minutes, 1440)::numeric / 240)
                     * (1 - least(1::numeric,
                         (extract(epoch from (now() - t.started_at)) / 86400)::numeric / 21))) end,
         null::text
    from public.chat_timeouts t
    cross join cleared c
    cross join guard g
    left join public.moderation_rules tr on tr.code = t.rule
   where t.who = target and g.may

   order by 11 desc
$$;

grant execute on function public.moderation_history_of(uuid) to authenticated;

/**
 * Where a decision of yours stands on appeals, for the page that shows one
 * decision on its own.
 *
 * The standing page gets these three out of `my_moderation_history`. This is
 * the same arithmetic for one row, so the two pages cannot drift into
 * disagreeing about whether somebody may write.
 */
create or replace function public.my_appeal_state(violation bigint)
returns table (used integer, closes_at timestamptz, may boolean)
language sql stable security definer
set search_path = public, extensions as $$
  select
    n.used,
    v.created_at + public.appeal_window(v.action, v.user_id),
    not v.is_void
      and n.used < 2
      and coalesce(a.status, 'declined') = 'declined'
      and now() <= v.created_at + public.appeal_window(v.action, v.user_id)
    from public.violations v
    cross join lateral (
      select count(*)::integer as used
        from public.appeals x where x.violation_id = v.id
    ) n
    left join lateral (
      select x.status from public.appeals x
       where x.violation_id = v.id
       order by x.attempt desc
       limit 1
    ) a on true
   where v.id = violation and v.user_id = auth.uid()
$$;

grant execute on function public.my_appeal_state(bigint) to authenticated;

commit;
