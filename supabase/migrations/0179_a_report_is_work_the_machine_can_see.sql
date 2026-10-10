begin;

-- A report is work, and something has to ask whether there is any
-- -----------------------------------------------------------------------
--
-- Two gaps, both of which read to Staw as "the AI only works when I press
-- the button".
--
-- **The machine could not see a report.** `ai_work` returns pending uploads
-- and nothing else, so a report ticket was invisible to it however many
-- piled up. It can act on one now - `take_report` is its door and its
-- ceiling - but it had no way to know one was there.
--
-- **Nothing could ask cheaply whether there was work.** A schedule that
-- wakes up every minute should cost one count, not a queue read it throws
-- away. `ai_work_waiting` is that question, and it is the thing a cron or a
-- console asks before doing anything.
--
-- What this does NOT do, said plainly rather than implied: it does not
-- schedule anything. Nothing in a migration can, and the key a schedule
-- needs is a secret that must not be in this repository. `docs/deploying.md`
-- has the one dashboard step, and `moderate` has accepted a service-role
-- call since it was written, so the schedule is the only missing piece.

/**
 * What is waiting, by kind, with no queue read behind it.
 *
 * Answers even when the machine is off, and says so, because "is it on" and
 * "is there anything to do" are different questions and a caller that
 * conflates them cannot tell a quiet platform from a disabled one.
 */
create or replace function public.ai_work_waiting()
returns table (
  is_on boolean, mode text, items integer, assets integer,
  reports integer, total integer, oldest_minutes integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare rules record;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into rules from public.ai_settings where id;

  return query
  select coalesce(rules.is_on, false), rules.mode,
         (select count(*)::integer from public.avatar_items where status = 'pending'),
         (select count(*)::integer from public.assets where status = 'pending'),
         (select count(*)::integer from public.reports where status = 'open'),
         (select count(*)::integer from public.avatar_items where status = 'pending')
         + (select count(*)::integer from public.assets where status = 'pending')
         + (select count(*)::integer from public.reports where status = 'open'),
         (select (extract(epoch from now() - min(oldest)) / 60)::integer from (
            select min(created_at) as oldest from public.avatar_items where status = 'pending'
             union all
            select min(created_at) from public.assets where status = 'pending'
             union all
            select min(created_at) from public.reports where status = 'open'
          ) ages);
end $$;

grant execute on function public.ai_work_waiting to authenticated;

/**
 * What is waiting, and whether the machine should be looking at it yet.
 *
 * The three modes are answered here rather than in the worker, so turning it
 * down is a row in a table and not a deploy. Empty when it is off, which is
 * the whole of "off".
 *
 * Reports are included now, as `subject = 'report'`. `words` is what the
 * reporter said, because that is what there is to read: the thing itself is
 * named in `name` and the worker reads it through `report_ticket` if it needs
 * more. A report is counted towards `busy` mode too - a queue of complaints
 * is exactly the backlog that mode exists for, and leaving it out meant a
 * platform could be drowning in reports and the machine would still call it
 * quiet.
 */
create or replace function public.ai_work(how_many integer default 20)
returns table (
  subject text, subject_id text, kind text, name text, words text,
  picture text, waiting_minutes integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
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
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end;
$$;

commit;
