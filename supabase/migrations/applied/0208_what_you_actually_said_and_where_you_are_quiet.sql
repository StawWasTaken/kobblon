begin;

/*
 * The evidence, and which channel is quiet
 * -----------------------------------------------------------------------
 *
 * Staw, about the card an account gets shown: "a bit more infos and i want
 * the evidence of what the user did to justify our action".
 *
 * He is right that it was not there to show. A chat suspension has stored
 * a reason since 0171 - "Language that goes against the Kobblon
 * guidelines." - and that sentence is true of every one of them, which
 * means it tells the person nothing. They are told they said something and
 * never told what. An appeal written against that is somebody guessing at
 * their own case.
 *
 * So the line is kept with the decision: `evidence`, the text that was
 * acted on, stored on the row rather than looked up later. Looked up later
 * does not work - `chat_to_read` is thrown away after seven days by
 * `forget_read_chat`, and a message can be deleted - and a card that says
 * "the message is gone" is the same as no card.
 *
 * **It is kept exactly as it was stored, which is to say already censored
 * by the patterns.** The bullets stay bullets. Showing somebody a slur
 * back, uncensored, because they typed it is not evidence, it is the
 * platform saying it too.
 *
 * `rule` and `gravity` say which numbered rule from 0207 was broken, so
 * the card can point at the rule rather than paraphrase it.
 *
 * And `channels`, which is the other half of what Staw asked for: "it can
 * be a warning, then a chat dock/chat/voice chat suspension". A suspension
 * has always been a row that says somebody may not talk; which *way* of
 * talking was never on it, because there was only one. Voice is coming, so
 * the row says, and every reader - this site, the Launcher, the
 * Workspace - asks the row instead of assuming chat.
 *
 * Defaulting to `{chat}` keeps every existing row and every existing
 * caller meaning exactly what it meant yesterday.
 */

alter table public.chat_timeouts
  add column if not exists evidence text,
  add column if not exists rule text,
  add column if not exists gravity integer,
  add column if not exists channels text[] not null default array['chat'];

alter table public.violations
  add column if not exists evidence text;

/*
 * `mute_chat` grows four arguments, and the three-argument form is dropped
 * rather than left beside it.
 *
 * `create or replace` with new defaulted parameters does not replace
 * anything - it creates a second function - and a three-argument call then
 * matches both and fails as ambiguous. Every existing caller
 * (`words_are_censored`, `apply_ai_verdict`, the staff console) passes
 * three or fewer positionally and keeps working against the new one.
 */
drop function if exists public.mute_chat(uuid, text, text);

create or replace function public.mute_chat(
  target uuid,
  why text default 'Language that goes against the Kobblon guidelines.',
  by_whom text default 'machine',
  evidence text default null,
  rule text default null,
  gravity integer default null,
  channels text[] default array['chat']
)
returns timestamptz
language plpgsql security definer set search_path = public, extensions as $$
declare
  how_long integer;
  ends timestamptz;
begin
  if by_whom = 'staff' and not public.is_moderator() then
    raise exception 'Only a moderator does that.';
  end if;

  -- Already quiet: leave the existing one alone rather than stacking.
  select t.until into ends from public.chat_timeouts t
   where t.who = target and t.until > now()
   order by t.until desc limit 1;
  if ends is not null then return ends; end if;

  how_long := public.next_timeout_minutes(target);
  ends := now() + make_interval(mins => how_long);

  insert into public.chat_timeouts
    (who, until, minutes, reason, source, evidence, rule, gravity, channels)
  values
    (target, ends, how_long, left(coalesce(why, ''), 300), by_whom,
     left(evidence, 500), rule, gravity,
     coalesce(nullif(channels, '{}'), array['chat']));

  return ends;
end $$;

grant execute on function public.mute_chat(uuid, text, text, text, text, integer, text[])
  to authenticated;

/**
 * Whether somebody may talk, what to tell them, and which way of talking.
 *
 * The Launcher and the Workspace read this one. `channels` is the new part
 * and the part they have to honour: a row saying `{chat,voice}` and a
 * client that only greys out the text box is a voice suspension that does
 * not exist.
 */
drop function if exists public.my_chat_standing();

create or replace function public.my_chat_standing()
returns table (
  id uuid, until timestamptz, minutes integer, reason text,
  source text, seen boolean, over boolean,
  evidence text, rule text, rule_ord integer, rule_title text,
  gravity integer, channels text[]
)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.until, t.minutes, t.reason, t.source,
         t.seen_at is not null,
         t.until <= now(),
         t.evidence, t.rule, r.ord, r.title, t.gravity, t.channels
    from public.chat_timeouts t
    left join public.moderation_rules r on r.code = t.rule
   where t.who = auth.uid()
     and (t.until > now() or (t.over_seen_at is null and t.until > now() - interval '7 days'))
   order by t.until desc
   limit 1
$$;

grant execute on function public.my_chat_standing() to authenticated;

/*
 * The history, with the evidence on it.
 *
 * Dropped rather than replaced: the shape of what comes back is changing,
 * and `create or replace` cannot change a RETURNS TABLE.
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
    a.id is null and not v.is_void
    from public.violations v
    cross join cleared c
    cross join me
    left join public.moderation_rules rr on rr.code = v.rule
    left join public.appeals a on a.violation_id = v.id
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
    false
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

/** The same, about somebody else, for the staff panel. */
drop function if exists public.moderation_history_of(uuid);

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
    left join public.appeals a on a.violation_id = v.id
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

commit;
