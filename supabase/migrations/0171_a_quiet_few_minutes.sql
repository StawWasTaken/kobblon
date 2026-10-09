begin;

/*
 * Chat suspensions: five minutes, then six, then longer.
 *
 * Staw asked for Roblox's one, and named the part that makes it real:
 * "even if u leave & rejoin it stays until the sanction is gone". So it is
 * a row with a time on it, not a flag in a window — closing the Launcher,
 * clearing the browser, or signing in somewhere else changes nothing.
 *
 * It is chat only. Nothing here touches anybody's account, and nothing
 * here can: "ONLY WARNINGS AND SUSPENSIONS, AI CANNOT DELETE AN ACCOUNT"
 * is still the rule, and a few quiet minutes is the gentlest thing on that
 * list rather than a new power.
 *
 * What gives one out is the filter itself. Somebody whose words get
 * starred out once has typed something; somebody whose words get starred
 * out three times in ten minutes is trying, and that is the "too often"
 * Staw described. No model is asked, which matters: this has to answer in
 * the same millisecond the message does, and a judgement that costs a
 * network call cannot be made on every line anybody types.
 */

create table if not exists public.chat_strikes (
  id bigserial primary key,
  who uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now()
);

create index if not exists chat_strikes_who_idx on public.chat_strikes (who, at desc);

create table if not exists public.chat_timeouts (
  id uuid primary key default gen_random_uuid(),
  who uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  until timestamptz not null,
  minutes integer not null,
  reason text not null default 'Language that goes against the Kobblon guidelines.',
  /* 'machine' is the filter. 'staff' is a person, for when that exists. */
  source text not null default 'machine' check (source in ('machine', 'staff')),
  /* When they were shown the card, and when they were shown it ending. */
  seen_at timestamptz,
  over_seen_at timestamptz
);

create index if not exists chat_timeouts_who_idx on public.chat_timeouts (who, until desc);

/*
 * The grants, in the same file as the tables, because a policy without
 * one is a table that looks carefully protected and is simply unreachable.
 * Everything here is read through the functions below, but a page reading
 * its own row directly is a thing somebody will write, and it should work.
 */
alter table public.chat_strikes enable row level security;
alter table public.chat_timeouts enable row level security;

drop policy if exists chat_strikes_read on public.chat_strikes;
create policy chat_strikes_read on public.chat_strikes for select
  using (who = auth.uid() or public.is_moderator());
drop policy if exists chat_timeouts_read on public.chat_timeouts;
create policy chat_timeouts_read on public.chat_timeouts for select
  using (who = auth.uid() or public.is_moderator());

grant select on public.chat_strikes to authenticated;
grant select on public.chat_timeouts to authenticated;

/**
 * How long the next one lasts.
 *
 * Five minutes, then six, then up. Staw's first two numbers exactly, and
 * the rest climbing the way a warning should: the point of the second one
 * is that it is barely longer than the first, so somebody who meant it
 * once is not punished like somebody who means it every day.
 *
 * Counted over a month, so a bad afternoon a year ago does not make
 * today's slip a six-hour one.
 */
create or replace function public.next_timeout_minutes(target uuid)
returns integer
language sql stable security definer set search_path = public, extensions as $$
  select (array[5, 6, 10, 20, 45, 120, 360, 1440])[
    least(
      (select count(*) from public.chat_timeouts t
        where t.who = target and t.started_at > now() - interval '30 days') + 1,
      8
    )
  ]
$$;

/**
 * Whether somebody may talk, and what to tell them if not.
 *
 * `over` is the part that makes the second card possible: a suspension
 * that has run out but has not been seen to run out. Staw asked for the
 * card to come back when it is done — "it'll appear again once its gone" —
 * and without a row saying that, a window has no way to tell the
 * difference between "finished a second ago" and "finished last week".
 */
create or replace function public.my_chat_standing()
returns table (
  id uuid, until timestamptz, minutes integer, reason text,
  source text, seen boolean, over boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.until, t.minutes, t.reason, t.source,
         t.seen_at is not null,
         t.until <= now()
    from public.chat_timeouts t
   where t.who = auth.uid()
     and (t.until > now() or (t.over_seen_at is null and t.until > now() - interval '7 days'))
   order by t.until desc
   limit 1
$$;

grant execute on function public.my_chat_standing() to authenticated;

/** Say the card has been read, so it is not shown twice. */
create or replace function public.chat_card_seen(which uuid, ended boolean default false)
returns void
language sql security definer set search_path = public, extensions as $$
  update public.chat_timeouts
     set seen_at = case when ended then seen_at else coalesce(seen_at, now()) end,
         over_seen_at = case when ended then coalesce(over_seen_at, now()) else over_seen_at end
   where id = which and who = auth.uid()
$$;

grant execute on function public.chat_card_seen(uuid, boolean) to authenticated;

/**
 * Give somebody a few quiet minutes.
 *
 * Only the filter, a moderator, or the worker. Not the person themselves,
 * and not anybody's client: this is called from a trigger that has already
 * decided, and from the staff console.
 */
create or replace function public.mute_chat(
  target uuid,
  why text default 'Language that goes against the Kobblon guidelines.',
  by_whom text default 'machine'
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

  insert into public.chat_timeouts (who, until, minutes, reason, source)
  values (target, ends, how_long, left(coalesce(why, ''), 300), by_whom);

  return ends;
end $$;

grant execute on function public.mute_chat(uuid, text, text) to authenticated;

/*
 * The filter keeps count, and the count is what gives one out.
 *
 * Three in ten minutes. Written as a trigger on the same tables the
 * censoring happens on, so there is no path that censors without
 * counting — the two have to be the same event or somebody finds the one
 * that is not.
 */
create or replace function public.words_are_censored()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  masked text;
  recent integer;
  quiet timestamptz;
begin
  -- Quiet already? Then nothing lands at all. The window should have
  -- stopped them, and a window is not where this is decided.
  select t.until into quiet from public.chat_timeouts t
   where t.who = auth.uid() and t.until > now()
   order by t.until desc limit 1;
  if quiet is not null then
    raise exception 'Chat is suspended until %.', quiet
      using errcode = 'check_violation';
  end if;

  masked := public.censor_text(new.body, 'say');

  if masked is distinct from new.body and auth.uid() is not null then
    insert into public.chat_strikes (who) values (auth.uid());

    select count(*) into recent from public.chat_strikes s
     where s.who = auth.uid() and s.at > now() - interval '10 minutes';

    if recent >= 3 then
      perform public.mute_chat(auth.uid());
    end if;
  end if;

  new.body := masked;
  return new;
end $$;

commit;
