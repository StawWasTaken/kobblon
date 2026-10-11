begin;

/*
 * Appealing a chat or voice suspension, in one tap, and three ways to
 * answer one.
 *
 * Staw, on the card the Launcher shows when somebody is quieted for
 * something they said out loud: "we also have a text that we can click on
 * ... the moment the user clicks it, it'll close the card and in the
 * account standing page it'll automatically send an appeal (the user
 * doesnt have to do anything) and we'll review what was said and we can
 * decide, once again, to revert, lighten or worsen the sanctions".
 *
 * Three things had to change for that, and the first one is the reason
 * none of this worked before:
 *
 *   * **An appeal could only be about a `violations` row.** A chat
 *     suspension is a `chat_timeouts` row and has never had a violation
 *     behind it, so the one sanction the machine hands out most often was
 *     the one thing on the standing page with no way to argue with it.
 *     `appeals` now points at one or the other, never both.
 *   * **A timeout could not be undone.** `chat_timeouts` had no way to say
 *     "this was lifted"; the only thing that ended one was time. It has
 *     `lifted_at` now, and everything that asks whether somebody may speak,
 *     or how long the next one should be, honours it.
 *   * **An appeal had two answers.** Upheld or declined. Looking again at
 *     what somebody was sanctioned for can honestly go the other way, and
 *     Staw has asked for that twice, so `decide_appeal` takes a word rather
 *     than a boolean and 'worsened' is one of the three.
 *
 * What the machine may do with any of this: nothing. `judge_appeal` is
 * unchanged and still only ever sees appeals against a violation a person
 * did not decide. An appeal that says "I did not say that" is a claim
 * about a transcript, and a transcript is the machine's own evidence -
 * asking it to mark its own homework is not review. Those go to a person,
 * and `ai_work_waiting` no longer counts them as work the machine can
 * take, because a count that disagrees with the queue is how the last
 * three of these went unnoticed.
 */

-- ------------------------------------------- an appeal about either thing

alter table public.appeals alter column violation_id drop not null;

alter table public.appeals
  add column if not exists timeout_id uuid references public.chat_timeouts(id) on delete cascade;

alter table public.appeals drop constraint if exists appeals_one_subject;
alter table public.appeals add constraint appeals_one_subject
  check ((violation_id is not null) <> (timeout_id is not null));

create unique index if not exists appeals_one_per_timeout_attempt
  on public.appeals (timeout_id, attempt);

alter table public.appeals drop constraint if exists appeals_status_check;
alter table public.appeals add constraint appeals_status_check
  check (status in ('open', 'upheld', 'declined', 'worsened'));

-- ------------------------------------------------ a timeout that was lifted

alter table public.chat_timeouts
  add column if not exists lifted_at timestamptz,
  add column if not exists lift_reason text;

/*
 * Everything that reads a live timeout now ignores a lifted one.
 *
 * Three places, and all three had to move together: whether somebody may
 * speak, whether a new sanction widens the one they already have, and how
 * long the next one is. A lifted timeout left in the ladder means an
 * upheld appeal still costs somebody the next step up, which is the
 * sanction surviving its own reversal.
 */
create or replace function public.may_i_speak()
returns table (chat boolean, voice boolean, until timestamptz, why text)
language sql stable security definer
set search_path = public, extensions as $$
  select
    not coalesce(bool_or('chat' = any (t.channels)), false),
    not coalesce(bool_or('voice' = any (t.channels)), false),
    max(t.until),
    max(t.reason)
    from public.chat_timeouts t
   where t.who = auth.uid() and t.until > now() and t.lifted_at is null
$$;

grant execute on function public.may_i_speak() to authenticated;

create or replace function public.next_timeout_minutes(target uuid)
returns integer
language sql stable security definer
set search_path = public, extensions as $$
  select (array[5, 6, 10, 20, 45, 120, 360, 1440])[
    greatest(1, least(
      (select count(*) from public.chat_timeouts t
        where t.who = target
          and t.lifted_at is null
          and t.started_at > now() - interval '30 days'
          and t.started_at > coalesce(
                (select max(r.created_at) from public.behaviour_resets r where r.who = target),
                '-infinity'::timestamptz))
      + 1
      + case public.behaviour_band(public.behaviour_score(target))
          when 'exemplary' then -1
          when 'good' then 0
          when 'mixed' then 0
          when 'poor' then 1
          else 2
        end,
      8
    ))
  ]
$$;

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
language plpgsql security definer
set search_path = public, extensions as $$
declare
  how_long integer;
  ends timestamptz;
  live public.chat_timeouts;
  wanted text[] := coalesce(nullif(channels, '{}'), array['chat']);
begin
  if by_whom = 'staff' and not public.is_moderator() then
    raise exception 'Only a moderator does that.';
  end if;

  select * into live from public.chat_timeouts t
   where t.who = target and t.until > now() and t.lifted_at is null
   order by t.until desc limit 1;

  if live.id is not null then
    if not (wanted <@ live.channels) then
      update public.chat_timeouts
         set channels = (
               select array_agg(distinct c order by c)
                 from unnest(live.channels || wanted) as c
             ),
             -- Re-shown, because the card they were given said chat and
             -- the truth now says more than that.
             seen_at = null
       where id = live.id;
    end if;
    return live.until;
  end if;

  how_long := public.next_timeout_minutes(target);
  ends := now() + make_interval(mins => how_long);

  insert into public.chat_timeouts
    (who, until, minutes, reason, source, evidence, rule, gravity, channels)
  values
    (target, ends, how_long, left(coalesce(why, ''), 300), by_whom,
     left(evidence, 500), rule, gravity, wanted);

  return ends;
end $$;

-- ----------------------------------------------------- sending one about it

/**
 * The same four walls as `file_appeal`, about a timeout instead.
 *
 * Fifteen days, because a timeout is never a closed account; two goes; the
 * last one has to have been answered and declined; and a lifted timeout
 * has nothing left to argue about.
 */
create or replace function public.file_appeal_for_timeout(timeout uuid, body text)
returns bigint
language plpgsql security definer
set search_path = public, extensions as $$
declare
  row_t public.chat_timeouts;
  used integer;
  last_one public.appeals;
  made bigint;
  closes timestamptz;
begin
  select * into row_t from public.chat_timeouts t
   where t.id = timeout and t.who = auth.uid();

  if row_t.id is null then
    raise exception 'There is no suspension of yours with that number.';
  end if;

  if row_t.lifted_at is not null then
    raise exception 'That suspension has already been lifted, so there is nothing to appeal.';
  end if;

  closes := row_t.started_at + interval '15 days';
  if now() > closes then
    raise exception 'The time to appeal that suspension ran out on %.',
      to_char(closes, 'FMDD FMMonth YYYY');
  end if;

  select count(*)::integer into used
    from public.appeals a where a.timeout_id = timeout;

  if used >= 2 then
    raise exception 'You have had both goes at that suspension.';
  end if;

  if used = 1 then
    select * into last_one from public.appeals a where a.timeout_id = timeout;
    if last_one.status = 'open' then
      raise exception 'Your appeal against that suspension has not been answered yet.';
    end if;
    if last_one.status = 'upheld' then
      raise exception 'That appeal was upheld, so there is nothing left to appeal.';
    end if;
  end if;

  insert into public.appeals (timeout_id, user_id, body, attempt)
  values (timeout, auth.uid(), body, used + 1)
  returning id into made;

  return made;
end $$;

grant execute on function public.file_appeal_for_timeout(uuid, text) to authenticated;

/**
 * The one tap on the card: "I did not say that."
 *
 * It writes the appeal itself, because asking somebody to compose a
 * paragraph is how a person with a fair complaint gives up. The words are
 * fixed and they say exactly what the tap means, so nothing is put in
 * anybody's mouth: the claim is about the transcript, not about the rule.
 *
 * Returns the appeal's number so the card can say it went.
 */
create or replace function public.i_did_not_say_that(timeout uuid)
returns bigint
language sql security definer
set search_path = public, extensions as $$
  select public.file_appeal_for_timeout(
    timeout,
    'I do not think I said this. What was heard was not what I said, so '
    || 'please have somebody read the transcript against the rule again.'
  )
$$;

grant execute on function public.i_did_not_say_that(uuid) to authenticated;

/** Where a timeout of yours stands on appeals, for the card and the page. */
create or replace function public.my_timeout_appeal_state(timeout uuid)
returns table (used integer, closes_at timestamptz, may boolean)
language sql stable security definer
set search_path = public, extensions as $$
  select
    n.used,
    t.started_at + interval '15 days',
    t.lifted_at is null
      and n.used < 2
      and coalesce(a.status, 'declined') = 'declined'
      and now() <= t.started_at + interval '15 days'
    from public.chat_timeouts t
    cross join lateral (
      select count(*)::integer as used
        from public.appeals x where x.timeout_id = t.id
    ) n
    left join lateral (
      select x.status from public.appeals x
       where x.timeout_id = t.id
       order by x.attempt desc
       limit 1
    ) a on true
   where t.id = timeout and t.who = auth.uid()
$$;

grant execute on function public.my_timeout_appeal_state(uuid) to authenticated;

commit;
