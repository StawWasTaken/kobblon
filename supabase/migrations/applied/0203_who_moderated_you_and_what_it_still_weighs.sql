begin;

/*
 * Your moderation history, as one list, with who did it.
 *
 * Staw: "i want that all the previous moderation action be displayed here,
 * like theres multiple stuff (bars) with basic infos and when you click on
 * them it opens a popup card with all the infos, who moderated you (Mod,
 * Admin, Superadmin, or an Automated System (that we call Kobby)), at what
 * time, against ur accounts for how long for what, why, send an appeal, etc".
 *
 * The status page had two problems answering that. It only knew about
 * `violations`, so the chat suspensions - the thing that actually happens to
 * people here - were invisible on the page about what has happened to you.
 * And it had no way to say who decided: `moderator_id` is a profile id, and
 * handing a browser the id of the moderator who suspended somebody is how a
 * moderator gets harassed. So this returns the **rank** and never the id.
 *
 * Kobby is the automated one. A decision with no moderator behind it was the
 * machine's: the filter that stars a word out and counts to three, or the
 * model reading what it sent on. `chat_timeouts.source = 'machine'` says the
 * same thing in its own table. Both land as 'kobby', because an account told
 * "a moderator suspended you" when no person ever read the line has been
 * told something untrue.
 *
 * `weight` is what the row still presses on the behaviour bar, so the list
 * can be bars rather than text: a fresh suspension is a long one, a warning
 * from five weeks ago is nothing, and the difference is visible without
 * reading a word.
 */
create or replace function public.my_moderation_history()
returns table (
  key text,
  violation_id bigint,
  kind text,
  action text,
  rule text,
  reason text,
  target_type text,
  target_id text,
  blocks text[],
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
  appealable boolean
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
    v.reason,
    v.target_type,
    v.target_id,
    v.blocks,
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
    a.id is null and not v.is_void
    from public.violations v
    cross join cleared c
    cross join me
    left join public.appeals a on a.violation_id = v.id
   where v.user_id = me.id

  union all

  select
    'timeout:' || t.id::text,
    null::bigint,
    'chat',
    'chat_timeout',
    'other',
    t.reason,
    'message',
    null::text,
    array['chat']::text[],
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
    false
    from public.chat_timeouts t
    cross join cleared c
    cross join me
   where t.who = me.id

   -- The ordinal, not the name: a union's select list has no column names to
   -- order by, whatever the function's RETURNS TABLE calls them.
   order by 11 desc
$$;

grant execute on function public.my_moderation_history() to authenticated;

/**
 * The same list about somebody else, for a staff panel. The rank is still
 * what comes back rather than the moderator's id: a panel that wanted the
 * name has `admin_log`, which is an admin's to read and is audited.
 */
create or replace function public.moderation_history_of(target uuid)
returns table (
  key text, kind text, action text, rule text, reason text,
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
  select 'violation:' || v.id, 'decision', v.action, v.rule, v.reason,
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
    left join public.appeals a on a.violation_id = v.id
   where v.user_id = target and g.may

  union all

  select 'timeout:' || t.id::text, 'chat', 'chat_timeout', 'other', t.reason,
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
   where t.who = target and g.may

   order by 7 desc
$$;

grant execute on function public.moderation_history_of(uuid) to authenticated;

commit;
