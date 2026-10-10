begin;

/*
 * The behaviour bar.
 *
 * Staw: "the account status has a bar with how your behaviour was and the
 * better your behaviour was the less moderated & punished you will be, and if
 * you are low on this bar, it gets back up slowly in days or weeks sometimes
 * months (unless a superadmin clears that bar and you instantly get good
 * again)".
 *
 * Three decisions here, each one made the way the rest of this schema makes
 * them:
 *
 *   The score is not stored. It is read out of the decisions that are
 *   already on record, exactly as `my_standing` reads the level, because a
 *   stored number is a value captured before the thing that decides it can
 *   change - voiding a decision on an upheld appeal would have to remember to
 *   put points back, and the day it forgets, a bar says somebody is in
 *   trouble for something that officially never happened. Computed, an upheld
 *   appeal lifts the weight by itself.
 *
 *   Recovery is not a job that runs. Each decision's weight simply fades
 *   across its own window, so a bar climbs by being read on a later day.
 *   Nothing has to be ticked over nightly, and nothing drifts if it is not.
 *
 *   A superadmin's clear is a row, not an update. `behaviour_resets` says
 *   "nothing before this moment counts", so the clear is instant, auditable,
 *   and does not erase the history the account is still allowed to read. The
 *   decisions stay on the status page; they just stop pressing on the bar.
 *
 * And the part that stops this being decoration: the score actually changes
 * what happens to you. `next_timeout_minutes` - the chat suspension ladder -
 * shifts by the band, so a clean account gets the gentlest step and an
 * account that has been here many times starts further up. A bar that
 * promised leniency and bought none would be exactly the fake control
 * `docs/neoclassic.md` forbids.
 */

-- ------------------------------------------------------- a superadmin's clear

create table if not exists public.behaviour_resets (
  id bigserial primary key,
  who uuid not null references public.profiles(id) on delete cascade,
  /** Null once a staff account is gone; the row itself is the record. */
  by_whom uuid references public.profiles(id) on delete set null,
  note text check (note is null or char_length(note) <= 400),
  created_at timestamptz not null default now()
);

create index if not exists behaviour_resets_who_idx
  on public.behaviour_resets (who, created_at desc);

/*
 * The grants in the same file as the table, because a policy without one is
 * a door nobody can reach. Reading is your own row or a moderator's; writing
 * is `clear_behaviour` below and nothing else, so no policy grants an insert.
 */
alter table public.behaviour_resets enable row level security;

drop policy if exists behaviour_resets_read on public.behaviour_resets;
create policy behaviour_resets_read on public.behaviour_resets for select
  using (who = auth.uid() or public.is_moderator());

grant select on public.behaviour_resets to authenticated;

-- ------------------------------------------------------------- the reading

/**
 * What one decision still weighs, out of a hundred.
 *
 * The weight is how serious it was; the window is how long it takes to stop
 * mattering. Both are flat tables rather than a formula so that somebody
 * arguing about a number can be shown the number.
 *
 *   warning           10 over  30 days
 *   content removed   14 over  60 days
 *   something off     28 over 150 days
 *   suspension        45 over 300 days
 *   account closed   100, which does not fade
 */
create or replace function public.violation_weight(
  action text, since timestamptz
) returns numeric
language sql stable as $$
  select case action
    when 'termination' then 100::numeric
    else greatest(
      0::numeric,
      case action
        when 'warning'         then 10::numeric
        when 'content_removed' then 14::numeric
        when 'feature_block'   then 28::numeric
        when 'suspension'      then 45::numeric
        else 10::numeric
      end
      * (1 - least(
          1::numeric,
          (extract(epoch from (now() - since)) / 86400)::numeric
          / case action
              when 'warning'         then 30::numeric
              when 'content_removed' then 60::numeric
              when 'feature_block'   then 150::numeric
              when 'suspension'      then 300::numeric
              else 30::numeric
            end
        ))
    )
  end
$$;

/**
 * Where an account sits on the bar, nought to a hundred, a hundred being
 * nothing on record.
 *
 * Chat suspensions count as well as account decisions, lightly: four points
 * plus a point for every four hours of it, fading over three weeks. They are
 * the most common thing that happens to anybody here, and a bar that ignored
 * the one measure of behaviour the platform actually takes every day would be
 * measuring the wrong thing.
 */
create or replace function public.behaviour_score(target uuid)
returns integer
language sql stable security definer
set search_path = public, extensions as $$
  with cleared as (
    select coalesce(
      (select max(r.created_at) from public.behaviour_resets r where r.who = target),
      '-infinity'::timestamptz
    ) as at
  ),
  weighed as (
    select public.violation_weight(v.action, v.created_at) as w
      from public.violations v, cleared c
     where v.user_id = target
       and not v.is_void
       and v.created_at > c.at
    union all
    select greatest(
             0::numeric,
             (4 + least(t.minutes, 1440)::numeric / 240)
             * (1 - least(1::numeric,
                 (extract(epoch from (now() - t.started_at)) / 86400)::numeric / 21))
           )
      from public.chat_timeouts t, cleared c
     where t.who = target
       and t.started_at > c.at
  )
  select greatest(0, least(100,
    100 - round(coalesce((select sum(w) from weighed), 0))::integer
  ))
$$;

/**
 * The band, which is what the bar is actually coloured by and what the rest
 * of the platform asks when it wants to know how to treat somebody.
 */
create or replace function public.behaviour_band(score integer)
returns text
language sql immutable as $$
  select case
    when score is null then 'good'
    when score >= 90 then 'exemplary'
    when score >= 70 then 'good'
    when score >= 45 then 'mixed'
    when score >= 20 then 'poor'
    else 'critical'
  end
$$;

/**
 * My own bar, with the two things somebody low on it wants: when it is next
 * worth more, and when it is full again.
 *
 * `next_at` is the soonest any weight finishes fading, so a page can say "it
 * moves again on Tuesday" rather than "slowly". `full_at` is the last one, so
 * it can say how long the whole climb is - the days, weeks or months Staw
 * asked for, as a date instead of a vague promise.
 */
create or replace function public.my_behaviour()
returns table (
  score integer,
  band text,
  cleared_at timestamptz,
  cleared_note text,
  next_at timestamptz,
  full_at timestamptz,
  permanent boolean,
  timeout_minutes integer
)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  mine integer;
  reset_row public.behaviour_resets;
  since timestamptz;
begin
  if me is null then return; end if;

  mine := public.behaviour_score(me);

  select * into reset_row from public.behaviour_resets r
   where r.who = me order by r.created_at desc limit 1;

  since := coalesce(reset_row.created_at, '-infinity'::timestamptz);

  return query
  with ends as (
    select v.created_at + make_interval(days => case v.action
             when 'warning' then 30 when 'content_removed' then 60
             when 'feature_block' then 150 when 'suspension' then 300
             else 30 end) as at,
           v.action = 'termination' as forever
      from public.violations v
     where v.user_id = me and not v.is_void and v.created_at > since
    union all
    select t.started_at + interval '21 days', false
      from public.chat_timeouts t
     where t.who = me and t.started_at > since
  ),
  live as (select * from ends where forever or at > now())
  select mine,
         public.behaviour_band(mine),
         reset_row.created_at,
         reset_row.note,
         (select min(at) from live where not forever),
         (select max(at) from live where not forever),
         coalesce((select bool_or(forever) from live), false),
         public.next_timeout_minutes(me);
end $$;

grant execute on function public.behaviour_score(uuid) to authenticated;
grant execute on function public.behaviour_band(integer) to authenticated;
grant execute on function public.violation_weight(text, timestamptz) to authenticated;
grant execute on function public.my_behaviour() to authenticated;

-- ----------------------------------------------------------------- clearing

/**
 * A superadmin puts somebody back to a hundred, and that is the whole of it:
 * instant, and nobody below the top rank can do it. `require_superadmin`
 * rather than `require_admin`, for the same reason deleting an account is -
 * a power that undoes every record at once is not an everyday one.
 *
 * The decisions themselves are untouched. They stay readable on the status
 * page, marked as no longer counting, because clearing the bar is mercy and
 * not a rewrite of what happened.
 */
create or replace function public.clear_behaviour(target uuid, note text default null)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare after integer;
begin
  perform public.require_superadmin();

  if target is null or not exists (select 1 from public.profiles p where p.id = target) then
    raise exception 'There is nobody with that id.';
  end if;

  insert into public.behaviour_resets (who, by_whom, note)
  values (target, auth.uid(), clear_behaviour.note);

  perform public.write_admin_log('clear_behaviour', target,
    jsonb_build_object('note', clear_behaviour.note));

  perform public.send_mail(
    target, 'moderation',
    'Your behaviour record has been cleared',
    coalesce(
      clear_behaviour.note,
      'Somebody at Kobblon has cleared your behaviour record. Everything '
      'before today stops counting against you, and your account is treated '
      'as a clean one from now on.'
    ),
    '/standing'
  );

  after := public.behaviour_score(target);
  return after;
end $$;

grant execute on function public.clear_behaviour(uuid, text) to authenticated;

/** What a staff panel sees about somebody else's bar. */
create or replace function public.behaviour_of(target uuid)
returns table (score integer, band text, cleared_at timestamptz, timeout_minutes integer)
language sql stable security definer
set search_path = public, extensions as $$
  select public.behaviour_score(target),
         public.behaviour_band(public.behaviour_score(target)),
         (select max(r.created_at) from public.behaviour_resets r where r.who = target),
         public.next_timeout_minutes(target)
   where public.is_moderator()
$$;

grant execute on function public.behaviour_of(uuid) to authenticated;

-- ------------------------------------- what the bar actually buys you

/**
 * The chat suspension ladder, shifted by the band.
 *
 * It was five minutes, then six, then up, counted over a month. That stays:
 * the position on the ladder is still how many times this has happened
 * recently. What the band does is move the starting rung - a step down for an
 * account with nothing on it, a step or two up for one that has been here
 * often enough to have worn its bar down.
 *
 * A superadmin's clear forgives the rung as well as the bar. Staw's words
 * were "you instantly get good again", and an account told it is clean that
 * still gets the two-hour step for its next slip was not told the truth.
 *
 * So "the better your behaviour, the less punished you will be" is a number
 * somebody can be shown, and `my_behaviour` hands the page the minutes their
 * next one would last.
 */
create or replace function public.next_timeout_minutes(target uuid)
returns integer
language sql stable security definer set search_path = public, extensions as $$
  select (array[5, 6, 10, 20, 45, 120, 360, 1440])[
    greatest(1, least(
      (select count(*) from public.chat_timeouts t
        where t.who = target
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

commit;
