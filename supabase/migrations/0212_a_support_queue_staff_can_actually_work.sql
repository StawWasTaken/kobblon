begin;

/*
 * The support queue, as a thing staff can work
 * -----------------------------------------------------------------------
 *
 * Tickets have been writable since 0072 and readable by a moderator the
 * whole time, and there has never been a screen that reads them. They go
 * in and nobody is shown they arrived. 0206 added `wants_human`, which
 * puts a ticket at the front of a queue that does not exist yet.
 *
 * This is the data half of that queue. Three things it needs that reading
 * the table cannot give:
 *
 *   * **who sent it.** `support_tickets.user_id` is an id; a queue needs
 *     the username, and a page that joins `profiles` itself gets whatever
 *     RLS lets it have rather than the same answer every time.
 *   * **what it says.** The first message is in `support_messages`, so a
 *     list of subjects is a list nobody can triage without opening every
 *     one.
 *   * **who is waiting.** A ticket whose last word was the account's is
 *     waiting on us; one whose last word was ours is not. That is the
 *     actual order of work and it is not `updated_at`.
 *
 * Two new statuses, `in_progress` and `escalated`, because the three it
 * had cannot say "somebody is on this" - and without that, two moderators
 * answer the same ticket. It is a text check rather than an enum, so this
 * is one ordinary `alter` and not the two-migration dance an enum needs.
 */

alter table public.support_tickets drop constraint if exists support_tickets_status_check;
alter table public.support_tickets add constraint support_tickets_status_check
  check (status in ('open', 'in_progress', 'answered', 'escalated', 'closed'));

create index if not exists support_tickets_queue_idx
  on public.support_tickets (wants_human desc, updated_at desc)
  where status <> 'closed';

/**
 * The queue.
 *
 * Ordered the way Staw asked for in 0206: anything marked for a person
 * first, then by who has been waiting longest. `waiting_on_us` is the
 * column a queue is actually sorted by in practice, so it is computed
 * here rather than guessed at from `status` in a browser.
 */
create or replace function public.ticket_queue(
  which text default 'open', how_many integer default 200
)
returns table (
  id bigint, topic text, subject text, status text,
  first_name text, contact_email text, device text, wants_human boolean,
  username text, user_id uuid, opener text,
  replies integer, waiting_on_us boolean,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select t.id, t.topic, t.subject, t.status,
         t.first_name, t.contact_email, t.device, t.wants_human,
         p.username, t.user_id,
         (select m.body from public.support_messages m
           where m.ticket_id = t.id order by m.created_at limit 1),
         (select count(*)::integer from public.support_messages m where m.ticket_id = t.id),
         coalesce(
           (select not m.from_staff from public.support_messages m
             where m.ticket_id = t.id order by m.created_at desc limit 1),
           true),
         t.created_at, t.updated_at
    from public.support_tickets t
    left join public.profiles p on p.id = t.user_id
   where public.is_moderator()
     and case which
           when 'all' then true
           when 'urgent' then t.wants_human and t.status <> 'closed'
           when 'closed' then t.status = 'closed'
           else t.status <> 'closed'
         end
   order by (t.wants_human and t.status <> 'closed') desc, t.updated_at desc
   limit least(greatest(coalesce(how_many, 200), 1), 500)
$$;

grant execute on function public.ticket_queue(text, integer) to authenticated;

/** What the header row counts. Asked of the database, not of a page's array. */
create or replace function public.ticket_counts()
returns table (open_now integer, urgent integer, waiting integer, closed_today integer)
language sql stable security definer
set search_path = public, extensions as $$
  select
    count(*) filter (where t.status <> 'closed')::integer,
    count(*) filter (where t.status <> 'closed' and t.wants_human)::integer,
    count(*) filter (
      where t.status in ('open', 'escalated')
        and coalesce((select not m.from_staff from public.support_messages m
                       where m.ticket_id = t.id order by m.created_at desc limit 1), true)
    )::integer,
    count(*) filter (where t.status = 'closed' and t.updated_at > now() - interval '24 hours')::integer
    from public.support_tickets t
   where public.is_moderator()
$$;

grant execute on function public.ticket_counts() to authenticated;

/**
 * Moving a ticket along without writing on it.
 *
 * Staff only, and deliberately not `close_ticket` with a second argument:
 * closing is something the account may do to its own ticket, and picking
 * a status is not.
 */
create or replace function public.set_ticket_status(ticket bigint, status text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;
  if status not in ('open', 'in_progress', 'answered', 'escalated', 'closed') then
    raise exception 'That is not a status a ticket takes.';
  end if;

  update public.support_tickets t
     set status = set_ticket_status.status, updated_at = now()
   where t.id = ticket;

  if not found then raise exception 'There is no ticket with that number.'; end if;

  perform public.write_admin_log('ticket-' || status, null,
    jsonb_build_object('ticket', ticket));
end $$;

grant execute on function public.set_ticket_status(bigint, text) to authenticated;

commit;
