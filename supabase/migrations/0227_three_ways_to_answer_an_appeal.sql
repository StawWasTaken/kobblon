begin;

/*
 * Answering an appeal: upheld, declined, or worsened.
 *
 * `decide_appeal` took a boolean. Staw has asked twice for the third
 * answer - "we can decide, once again, to revert, lighten or worsen the
 * sanctions (which has an impact on the standing bar)" - and the pages
 * have been saying so since 0223 with nothing behind it. This is the
 * behind-it.
 *
 * What each one does, exactly:
 *
 *   upheld    The decision is void, or the timeout is lifted. Whatever it
 *             switched off comes back, and the bar stops counting it.
 *   declined  Nothing moves. It is said, and it is on the record.
 *   worsened  One rung up. A timeout's remaining time doubles, to a day at
 *             most. A violation gets a second row one action higher, which
 *             is what presses on the bar - the old one is left standing,
 *             because an appeal that found worse does not erase what was
 *             already found.
 *
 * A suspension does not escalate here. The only thing above it is closing
 * the account, and that is a superadmin pressing a button with a typed
 * confirmation, not a side effect of answering an appeal.
 *
 * The signature changed rather than gaining a fourth argument, and the old
 * one is dropped. A boolean with three outcomes to express is how a caller
 * ends up passing `false` for "worsened" and quietly declining it.
 */

drop function if exists public.decide_appeal(bigint, boolean, text);

create or replace function public.decide_appeal(appeal bigint, outcome text, note text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  row_appeal public.appeals;
  row_v public.violations;
  row_t public.chat_timeouts;
  harder text;
  left_mins integer;
begin
  if not public.is_moderator() then
    raise exception 'Only a moderator can do that.';
  end if;

  if outcome not in ('upheld', 'declined', 'worsened') then
    raise exception 'An appeal is upheld, declined or worsened.';
  end if;

  if btrim(coalesce(note, '')) = '' then
    raise exception 'Say why. An answer with no reason is not an answer.';
  end if;

  select * into row_appeal from public.appeals where id = appeal;
  if row_appeal.id is null then
    raise exception 'There is no appeal with that number.';
  end if;

  if row_appeal.status <> 'open' then
    raise exception 'That appeal has already been answered.';
  end if;

  -- --------------------------------------------------------- a violation
  if row_appeal.violation_id is not null then
    select * into row_v from public.violations where id = row_appeal.violation_id;

    if outcome = 'upheld' then
      update public.violations
         set is_void = true, void_reason = note
       where id = row_appeal.violation_id;

      if not exists (
        select 1 from public.violations v
         where v.user_id = row_appeal.user_id and not v.is_void
           and v.action in ('suspension', 'termination')
           and (v.expires_at is null or v.expires_at > now())
      ) then
        update public.profiles set is_suspended = false where id = row_appeal.user_id;
      end if;
    end if;

    if outcome = 'worsened' then
      harder := case row_v.action
        when 'warning' then 'feature_block'
        when 'content_removed' then 'feature_block'
        when 'feature_block' then 'chat_suspension'
        when 'chat_suspension' then 'voice_suspension'
        when 'voice_suspension' then 'suspension'
        else null
      end;

      if harder is null then
        raise exception 'There is no rung above that one that an appeal may reach.';
      end if;

      insert into public.violations
        (user_id, rule, action, reason, moderator_id, target_type, target_id, evidence)
      values (row_appeal.user_id, row_v.rule, harder,
              'After looking again: ' || note,
              auth.uid(), row_v.target_type, row_v.target_id, row_v.evidence);

      if harder in ('chat_suspension', 'voice_suspension') then
        perform public.mute_chat(
          row_appeal.user_id, 'After looking again: ' || note, 'staff',
          row_v.evidence, row_v.rule, null,
          case when harder = 'voice_suspension'
               then array['chat', 'voice'] else array['chat'] end);
      end if;

      if harder = 'suspension' then
        update public.profiles set is_suspended = true where id = row_appeal.user_id;
      end if;
    end if;
  end if;

  -- ----------------------------------------------------------- a timeout
  if row_appeal.timeout_id is not null then
    select * into row_t from public.chat_timeouts where id = row_appeal.timeout_id;

    if outcome = 'upheld' then
      update public.chat_timeouts
         set lifted_at = now(), lift_reason = note, until = now()
       where id = row_appeal.timeout_id;
    end if;

    if outcome = 'worsened' then
      left_mins := greatest(1, ceil(extract(epoch from (row_t.until - now())) / 60)::integer);
      update public.chat_timeouts
         set until = now() + make_interval(mins => least(left_mins * 2, 1440)),
             minutes = row_t.minutes + least(left_mins, 1440),
             reason = 'After looking again: ' || left(note, 260),
             -- Shown again, because what they were told has changed.
             seen_at = null
       where id = row_appeal.timeout_id;
    end if;
  end if;

  update public.appeals
     set status = outcome, decision_note = note,
         decided_by = auth.uid(), decided_at = now()
   where id = appeal;

  perform public.send_mail(
    row_appeal.user_id, 'moderation',
    case outcome
      when 'upheld' then 'Your appeal was upheld'
      when 'worsened' then 'We looked again, and it went the other way'
      else 'Your appeal was declined'
    end,
    note, '/standing'
  );
end $$;

revoke all on function public.decide_appeal(bigint, text, text) from public;
grant execute on function public.decide_appeal(bigint, text, text) to authenticated;

-- ------------------------------------------------- the queue has two shapes

/*
 * `appeal_queue` inner-joined `violations`, so every appeal against a
 * timeout would have been invisible in the staff console - open for ever,
 * counted nowhere, and nobody's fault. Left join, and the timeout's own
 * facts filled in beside it.
 *
 * `subject` is new and says which kind it is, because the card that
 * answers one needs to know whether "take it back" means voiding a row or
 * lifting a clock.
 */
drop function if exists public.appeal_queue(text, integer);

create or replace function public.appeal_queue(
  which text default 'open', how_many integer default 200
)
returns table (
  id bigint, status text, body text, created_at timestamptz,
  decision_note text, decided_at timestamptz, decided_rank text,
  user_id uuid, username text, display_name text, avatar_url text,
  score integer, band text,
  subject text, attempt integer,
  violation_id bigint, timeout_id uuid,
  action text, rule text, rule_ord integer,
  rule_title text, gravity integer, reason text, evidence text,
  target_type text, target_id text, blocks text[],
  is_void boolean, expires_at timestamptz, decided_on timestamptz,
  by_rank text, waiting_hours integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select a.id, a.status, a.body, a.created_at,
         a.decision_note, a.decided_at,
         case when a.decided_by is null then null
              else coalesce(public.staff_rank(a.decided_by), 'staff') end,
         a.user_id, p.username, p.display_name, p.avatar_url,
         public.behaviour_score(a.user_id),
         public.behaviour_band(public.behaviour_score(a.user_id)),
         case when a.timeout_id is null then 'violation' else 'timeout' end,
         a.attempt::integer,
         v.id, t.id,
         coalesce(v.action,
                  case when 'voice' = any (t.channels)
                       then 'voice_suspension' else 'chat_timeout' end),
         coalesce(v.rule, t.rule),
         coalesce(r.ord, tr.ord),
         coalesce(r.title, tr.title),
         coalesce(r.gravity, t.gravity),
         coalesce(v.reason, t.reason),
         coalesce(v.evidence, t.evidence),
         coalesce(v.target_type, case when 'voice' = any (t.channels) then 'voice' else 'message' end),
         v.target_id,
         coalesce(v.blocks, t.channels),
         coalesce(v.is_void, t.lifted_at is not null),
         coalesce(v.expires_at, t.until),
         coalesce(v.created_at, t.started_at),
         case
           when v.id is not null then
             case when v.moderator_id is null then 'kobby'
                  else coalesce(public.staff_rank(v.moderator_id), 'staff') end
           when t.source = 'machine' then 'kobby'
           else 'staff'
         end,
         (extract(epoch from now() - a.created_at) / 3600)::integer
    from public.appeals a
    left join public.violations v on v.id = a.violation_id
    left join public.chat_timeouts t on t.id = a.timeout_id
    left join public.profiles p on p.id = a.user_id
    left join public.moderation_rules r on r.code = v.rule
    left join public.moderation_rules tr on tr.code = t.rule
   where public.is_moderator()
     and case which
           when 'all' then true
           when 'answered' then a.status <> 'open'
           else a.status = 'open'
         end
   order by (a.status = 'open') desc, a.created_at
   limit least(greatest(coalesce(how_many, 200), 1), 500)
$$;

grant execute on function public.appeal_queue(text, integer) to authenticated;

/* The counts gained the third word, which is a return-type change, which
   `create or replace` refuses with 42P13. Dropped in the same transaction. */
drop function if exists public.appeal_counts();

create or replace function public.appeal_counts()
returns table (
  waiting integer, oldest_hours integer,
  upheld_30d integer, declined_30d integer, worsened_30d integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    count(*) filter (where a.status = 'open')::integer,
    coalesce(max(extract(epoch from now() - a.created_at) / 3600)
             filter (where a.status = 'open'), 0)::integer,
    count(*) filter (where a.status = 'upheld' and a.decided_at > now() - interval '30 days')::integer,
    count(*) filter (where a.status = 'declined' and a.decided_at > now() - interval '30 days')::integer,
    count(*) filter (where a.status = 'worsened' and a.decided_at > now() - interval '30 days')::integer
    from public.appeals a
   where public.is_moderator()
$$;

grant execute on function public.appeal_counts() to authenticated;

commit;
