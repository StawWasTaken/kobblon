begin;

/*
 * The machine runs all the time, and the console can see that it does.
 *
 * Staw: "the machine controls need an absolute ground rework, and it needs
 * to be runing all the time".
 *
 * It was not running all the time, and nothing in the console could have
 * told anybody. Every way the worker got woken was an **event**: a trigger
 * on an insert (0224), or somebody pressing Run it now. Three things fall
 * through that, and all three are silent:
 *
 *   * the twenty second debounce drops a knock, and nothing knocks again,
 *     so whatever landed in that window waits until the next insert - which
 *     on a quiet night is the morning;
 *   * the knock goes out and the function is down, restarting, or rate
 *     limited. `pg_net` does not wait for an answer, by design, so nothing
 *     notices the work was not done;
 *   * 'slow' mode never knocks at all. It is meant to wait, not to wait for
 *     ever, and the only thing that ever came back for it was a GitHub
 *     schedule that has landed five hours apart.
 *
 * So the database keeps its own time now. `keep_the_worker_awake` is a
 * sweep: every minute, if the machine is on and something is genuinely
 * waiting under its own mode, it knocks. It is scheduled with `pg_cron`
 * when `pg_cron` is there, and looked up by name at apply time rather than
 * assumed - the same way 0224 handles `pg_net`, and for the same reason:
 * this file is applied against a plain Postgres in the checks and must not
 * care.
 *
 * `machine_pulse` is the other half: one call that says whether it is on,
 * whether the door is wired, whether the heartbeat is actually scheduled,
 * when it last knocked, when it last decided anything, and what is waiting.
 * A panel full of switches that cannot say whether any of it is running is
 * the thing being replaced.
 */

-- ------------------------------------------------------------ the sweep

/**
 * One minute's worth of "is there anything to do, and has nobody done it".
 *
 * Returns true when a knock went out, which is what the schedule's history
 * shows and what the console's last-beat reads from. Quiet about every
 * reason it decided not to: a sweep is housekeeping, and a sweep that
 * raises is a schedule that gets disabled by somebody who is not looking at
 * this file.
 *
 * The debounce in `poke_the_worker` stays honoured. It is twenty seconds
 * and this runs every sixty, so it never collides with itself; what it does
 * stop is this sweep piling onto a knock a trigger has just sent.
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

  /*
   * Counted here rather than read from `ai_work_waiting`, and that is not
   * duplication for its own sake: that function asks `is_moderator() or
   * is_the_worker()` and raises when neither is true. `pg_cron` runs this
   * as the job's owner with no JWT at all, so the sweep would have raised
   * every single minute - a schedule that is on, scheduled, and failing,
   * which is worse than the gap it was written to close. Caught by running
   * it as `service_role` before trusting it.
   */
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
  ) ages;

  /*
   * The modes, honoured here rather than left to the caller.
   *
   * 'always' and 'busy' are `poke_the_worker`'s own rules and it is left to
   * apply them. 'slow' is the one this function exists for: it is the mode
   * that deliberately refuses every knock, so the sweep is the only thing
   * that ever comes back for it, and it comes back once the oldest thing
   * has waited as long as the setting says.
   */
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

-- --------------------------------------------------------- the schedule

/*
 * Scheduled if there is something to schedule with.
 *
 * `cron.schedule(text, text, text)` replaces a job of the same name rather
 * than adding a second one, so applying this file twice leaves one minute
 * hand - which is the thing to check, and the checks do.
 */
do $$
declare sched regprocedure;
begin
  sched := to_regprocedure('cron.schedule(text,text,text)');
  if sched is null then
    raise notice 'pg_cron is not installed here, so the heartbeat is not scheduled. The console will say so.';
    return;
  end if;
  execute format(
    'select %s($1, $2, $3)', sched::regproc::text
  ) using 'kobblon-machine', '* * * * *', 'select public.keep_the_worker_awake()';
end $$;

-- ------------------------------------------------- what the console sees

/**
 * Everything the machine panel needs, in one call.
 *
 * Never the url and never the key - the same rule as `poke_state`. Whether
 * the heartbeat is scheduled is read out of `cron.job` when that table is
 * there, by name, so a project without `pg_cron` answers false rather than
 * failing.
 */
create or replace function public.machine_pulse()
returns table (
  is_on boolean,
  mode text,
  wired boolean,
  net_ready boolean,
  beating boolean,
  every text,
  last_poke_at timestamptz,
  last_decision_at timestamptz,
  decided_today integer,
  waiting integer,
  oldest_minutes integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  rules record;
  door public.ai_poke;
  /*
   * Scalars rather than a record, and the reason is worth keeping: a
   * record variable that a query never assigned to cannot be read at all -
   * `job.active` raises "not yet assigned" instead of coming back null.
   * On a project with no `pg_cron` the select finds nothing, which is
   * exactly the case this function exists to report.
   */
  beat_on boolean;
  beat_every text;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into rules from public.ai_settings where id;
  select * into door from public.ai_poke where id;

  if to_regclass('cron.job') is not null then
    execute 'select active, schedule from cron.job where jobname = $1'
      into beat_on, beat_every using 'kobblon-machine';
  end if;

  return query
  select
    coalesce(rules.is_on, false),
    rules.mode,
    (door.url is not null and door.key is not null),
    to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null,
    coalesce(beat_on, false),
    beat_every,
    door.last_at,
    (select max(created_at) from public.ai_reviews),
    (select count(*)::integer from public.ai_reviews
      where created_at > now() - interval '24 hours'),
    w.total,
    w.oldest_minutes
   from public.ai_work_waiting() w;
end $$;

grant execute on function public.machine_pulse() to authenticated, service_role;

-- -------------------------------------------------------- the dashboard

/**
 * The numbers the console opens on.
 *
 * One call rather than eight, because a dashboard that fires eight requests
 * on every visit is a dashboard that feels slow for no reason. Counts only:
 * nothing here says who, so a moderator reading it learns nothing they
 * could not get by opening the queue it points at.
 */
create or replace function public.staff_overview()
returns table (
  reports_open integer,
  appeals_open integer,
  tickets_open integer,
  tickets_urgent integer,
  screening integer,
  people_total integer,
  people_online integer,
  joined_today integer,
  sanctions_week integer,
  machine_on boolean,
  machine_waiting integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::integer from public.reports where status = 'open'),
    (select count(*)::integer from public.appeals where status = 'open'),
    (select count(*)::integer from public.support_tickets where status = 'open'),
    (select count(*)::integer from public.support_tickets
      where status = 'open' and wants_human),
    (select count(*)::integer from public.avatar_items where status = 'pending')
    + (select count(*)::integer from public.assets where status = 'pending'),
    (select count(*)::integer from public.profiles),
    (select count(*)::integer from public.profiles where is_online),
    (select count(*)::integer from public.profiles
      where created_at > now() - interval '24 hours'),
    (select count(*)::integer from public.violations
      where created_at > now() - interval '7 days'),
    coalesce((select s.is_on from public.ai_settings s where s.id), false),
    coalesce((select w.total from public.ai_work_waiting() w), 0);
end $$;

grant execute on function public.staff_overview() to authenticated;

commit;
