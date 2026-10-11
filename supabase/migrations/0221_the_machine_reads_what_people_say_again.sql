begin;

/*
 * The machine was handed everything except what people say.
 *
 * 0189 queues every line - chat, Space chat and Community posts - into
 * `chat_to_read` by trigger, 0190 handed those lines to `ai_work`, and
 * `apply_ai_verdict` has had a whole branch for judging one ever since.
 * Then 0216 added tickets and appeals by rewriting `ai_work` whole, and
 * **the message branch did not come back with it**. The lines kept being
 * queued, nothing ever asked for them, and the console's own count did
 * not include them, so the panel said "nothing waiting" over a queue that
 * was growing. Staw: "THE AI DOES NOTHING, IT DOESNT READ PLAYER
 * MESSAGES". It did not, since 0216, and this is why.
 *
 * The lesson is the one in CLAUDE.md wearing a new coat: replacing a
 * function whole means its old branches are gone unless they are carried
 * across, and nothing in the schema says a branch is missing. The check
 * that catches it is not "does the function apply"; it is "name every
 * subject it used to hand out and show each one still coming back".
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
    + (select count(*) from public.support_tickets
        where status = 'open' and not wants_human)
    + (select count(*) from public.appeals where status = 'open')
    + (select count(*) from public.chat_to_read where read_at is null)
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
     union all
    select 'ticket', t.id::text, t.topic, t.subject,
           coalesce((select m.body from public.support_messages m
                      where m.ticket_id = t.id and not m.from_staff
                      order by m.created_at limit 1), ''),
           null::text,
           (extract(epoch from now() - t.created_at) / 60)::integer
      from public.support_tickets t
     where t.status = 'open' and not t.wants_human
       and (rules.mode <> 'slow' or t.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'appeal', ap.id::text, v.action, coalesce(v.reason, v.rule),
           ap.body,
           null::text,
           (extract(epoch from now() - ap.created_at) / 60)::integer
      from public.appeals ap
      join public.violations v on v.id = ap.violation_id
     where ap.status = 'open' and v.moderator_id is null
       and (rules.mode <> 'slow' or ap.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    /*
     * What people actually said: chat, Space chat and Community posts, all
     * three queued into `chat_to_read` by their own triggers since 0189.
     *
     * `was_masked` is handed over with the line because a line that
     * arrived with bullets in it is a different thing to read than one
     * that did not.
     */
    select 'message', c.id::text, c.kind,
           coalesce(p.username, 'somebody')
             || case when c.was_masked then ' (already masked)' else '' end,
           c.body,
           null::text,
           (extract(epoch from now() - c.created_at) / 60)::integer
      from public.chat_to_read c
      left join public.profiles p on p.id = c.who
     where c.read_at is null
       and (rules.mode <> 'slow' or c.created_at < now() - make_interval(mins => rules.after_minutes))
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end $$;

drop function if exists public.ai_work_waiting();

create or replace function public.ai_work_waiting()
returns table (
  is_on boolean, mode text, items integer, assets integer,
  reports integer, tickets integer, appeals integer, lines integer,
  total integer, oldest_minutes integer
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
         (select count(*)::integer from public.support_tickets
           where status = 'open' and not wants_human),
         (select count(*)::integer from public.appeals ap
            join public.violations v on v.id = ap.violation_id
           where ap.status = 'open' and v.moderator_id is null),
         (select count(*)::integer from public.chat_to_read where read_at is null),
         (select count(*)::integer from public.avatar_items where status = 'pending')
         + (select count(*)::integer from public.assets where status = 'pending')
         + (select count(*)::integer from public.reports where status = 'open')
         + (select count(*)::integer from public.support_tickets
             where status = 'open' and not wants_human)
         + (select count(*)::integer from public.appeals ap
              join public.violations v on v.id = ap.violation_id
             where ap.status = 'open' and v.moderator_id is null)
         + (select count(*)::integer from public.chat_to_read where read_at is null),
         (select (extract(epoch from now() - min(oldest)) / 60)::integer from (
            select min(created_at) as oldest from public.avatar_items where status = 'pending'
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
          ) ages);
end $$;
grant execute on function public.ai_work_waiting to authenticated;

commit;
