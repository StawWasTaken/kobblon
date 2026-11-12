begin;

/*
 * The heartbeat can be started after the fact.
 *
 * 0253 scheduled the every-minute sweep in a `do` block, which runs once,
 * when the file is applied. It looks up `cron.schedule` by name rather than
 * assuming it - that part is right, and it is why the file applies against a
 * plain Postgres with no `pg_cron` in it.
 *
 * But what happens when `pg_cron` is turned on afterwards is nothing. The
 * `do` block is gone; nothing in the database ever looks again. The console
 * reads `cron.job` live and correctly reports "nothing is scheduled to run
 * it", and its own advice was "apply migration 0253 again" - which means
 * re-pasting a two hundred line file into the SQL editor to run fifteen
 * lines of it.
 *
 * That is trap one, in a migration, which is where it is hardest to see: a
 * value read once at install time, when the thing that decides it arrives
 * later. `poke_the_worker` gets this right about `pg_net` - it calls
 * `to_regprocedure` at the moment of use, every time - and the schedule two
 * hundred lines below it gets it wrong about `pg_cron`.
 *
 * So the scheduling is a function now, callable whenever somebody asks. It
 * is applied at the end of this file, which covers the case where `pg_cron`
 * was already on, and the console has a button for the case where it is
 * turned on later.
 */

/**
 * Schedule the every-minute sweep, and say what happened.
 *
 * `cron.schedule(text, text, text)` replaces a job of the same name rather
 * than adding a second one, so calling this twice leaves one minute hand.
 * Returns false when there is no `pg_cron` to schedule with, which is a
 * thing the console must be able to say rather than a thing to raise about.
 */
create or replace function public.start_the_heartbeat()
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare sched regprocedure;
begin
  /*
   * Staff only, and said here rather than left to a grant. `security
   * definer` changes this function's rights and not who it reports as, so
   * `auth.uid()` inside `is_moderator()` is still the caller - which is the
   * whole point. A signed-in stranger with execute on this could otherwise
   * schedule a job on the house's database.
   */
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  sched := to_regprocedure('cron.schedule(text,text,text)');
  if sched is null then return false; end if;

  execute format('select %s($1, $2, $3)', sched::regproc::text)
    using 'kobblon-machine', '* * * * *', 'select public.keep_the_worker_awake()';

  return true;
end $$;

revoke all on function public.start_the_heartbeat() from public;
grant execute on function public.start_the_heartbeat() to authenticated, service_role;

/*
 * And once now, for a project where `pg_cron` is already on - including the
 * one this is about to be applied to, where it went on after 0253 did.
 *
 * Not a call to the function above: that one asks who is asking, and the
 * SQL editor applying a migration is the owner rather than a moderator, so
 * it would refuse. Same three lines, no identity test, because at this point
 * the identity is "whoever may apply migrations".
 */
do $$
declare sched regprocedure;
begin
  sched := to_regprocedure('cron.schedule(text,text,text)');
  if sched is null then
    raise notice 'pg_cron is not installed here. The console can start the heartbeat once it is.';
    return;
  end if;
  execute format('select %s($1, $2, $3)', sched::regproc::text)
    using 'kobblon-machine', '* * * * *', 'select public.keep_the_worker_awake()';
  raise notice 'The heartbeat is scheduled: kobblon-machine, every minute.';
end $$;

commit;
