begin;

/*
 * Two things about a support ticket that were right for staff and wrong for
 * everybody, including staff.
 *
 * Staw, with the Support page open on his own account: "WHY CAN I SEE
 * TICKETS MADE BY OTHER PEOPLE AND WHEN I REPLY TO A TICKET I REPLY AS
 * KOBBLON WHAT".
 *
 * Both of those are moderator rights working exactly as written. `tickets_read`
 * lets a moderator read every ticket, which is what the Support panel in the
 * console stands on, and `reply_ticket` writes `from_staff = is_moderator()`,
 * which is what makes a staff answer look like one. Neither is wrong. What is
 * wrong is that `/support` - the page a person goes to when they need help -
 * asked those same two questions and got the staff answer, so a moderator
 * visiting their own help page saw the whole queue and could only speak for
 * the house.
 *
 * The list is fixed where it is asked, in the page: `/support` asks for its
 * own tickets now rather than everything the policy would allow. The policy
 * does not change - the console needs it, and a page narrowing what it asks
 * for is not a security boundary and is not being used as one.
 *
 * This file is the other half. `reply_ticket` grows a third argument saying
 * which hat the writer has on:
 *
 *   null   - whichever they hold. What every caller did before this, so the
 *            console keeps answering as the house without being changed.
 *   false  - as themselves. `/support` passes this, and it is refused unless
 *            the ticket is actually theirs; a moderator cannot use it to
 *            write on a stranger's ticket under their own name.
 *   true   - as the house. Refused unless they are staff.
 *
 * The old two-argument form is dropped rather than left beside it: Postgres
 * would have taken `reply_ticket(1, 'hello')` as either, and "which overload
 * did that call reach" is not a question worth having in a file about who
 * somebody is speaking as.
 */

drop function if exists public.reply_ticket(bigint, text);
drop function if exists public.reply_ticket(bigint, text, boolean);

create or replace function public.reply_ticket(
  ticket bigint,
  body text,
  as_staff boolean default null
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  made bigint;
  owner_id uuid;
  staff boolean := public.is_moderator();
  mine boolean;
  speaking boolean;
begin
  if auth.uid() is null then
    raise exception 'Only a signed in account can write on a ticket.';
  end if;

  select t.user_id into owner_id from public.support_tickets t where t.id = ticket;
  if owner_id is null then
    raise exception 'There is no ticket with that number.';
  end if;

  mine := owner_id = auth.uid();
  if not mine and not staff then
    raise exception 'That is not your ticket.';
  end if;

  speaking := coalesce(as_staff, staff);

  if speaking and not staff then
    raise exception 'Only staff may answer for Kobblon.';
  end if;
  if not speaking and not mine then
    raise exception 'That is not your ticket.';
  end if;

  insert into public.support_messages (ticket_id, sender_id, from_staff, body)
  values (ticket, auth.uid(), speaking, body)
  returning id into made;

  update public.support_tickets
     set updated_at = now(),
         status = case when speaking then 'answered' else 'open' end
   where id = ticket;

  /* The person is told when the house answered, and not when they wrote
     to themselves. */
  if speaking then
    perform public.send_mail(
      owner_id, 'support', 'We replied to your ticket', body, '/support/' || ticket::text
    );
  end if;

  return made;
end $$;

grant execute on function public.reply_ticket(bigint, text, boolean) to authenticated;

commit;
