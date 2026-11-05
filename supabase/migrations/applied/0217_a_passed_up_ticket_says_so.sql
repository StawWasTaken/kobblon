begin;

/*
 * A ticket Kobby passes up should not look ignored.
 *
 * 0216 set the status to `escalated` and wrote an `ai_reviews` row, both of
 * which a moderator can see and the person who wrote in cannot. From their
 * side the ticket sat there with nothing in it, which is the one thing
 * support must never do: the first test ticket on the platform read as
 * unanswered because it was passed up silently.
 *
 * So the pass-up writes a line on the thread as well, and so does a ticket
 * that asked for a person. `ai_work` only hands out tickets that are still
 * `open`, so neither line can be written twice.
 */

create or replace function public.answer_ticket(
  ticket bigint, reply text, confident boolean, model text default null
) returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare one public.support_tickets;
begin
  if not (public.is_the_worker() or public.is_admin()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into one from public.support_tickets where id = ticket;
  if one.id is null then return 'gone'; end if;

  if one.status in ('answered', 'closed') then
    return 'already_answered';
  end if;

  if one.wants_human then
    insert into public.support_messages (ticket_id, sender_id, from_staff, body)
    values (ticket, null, true,
            'You asked for a person, so this one is waiting for one of us. '
            || 'We will write back here.');

    update public.support_tickets set updated_at = now() where id = ticket;

    insert into public.ai_reviews (subject, subject_id, decision, reason, model)
    values ('ticket', ticket::text, 'for_a_person',
            'They asked for a person, so this was left alone.', model);
    return 'for_a_person';
  end if;

  if not confident or coalesce(btrim(reply), '') = '' then
    insert into public.support_messages (ticket_id, sender_id, from_staff, body)
    values (ticket, null, true,
            'This one needs a person. It is at the front of the queue and the '
            || 'reply lands here.');

    update public.support_tickets
       set status = 'escalated', updated_at = now()
     where id = ticket;

    insert into public.ai_reviews (subject, subject_id, decision, reason, model)
    values ('ticket', ticket::text, 'escalated',
            'Not confident enough to answer, so a person has it.', model);

    perform public.send_mail(
      one.user_id, 'support', 'Your ticket is with a person',
      'Nothing automatic could answer it, so somebody here is reading it.',
      '/support/' || ticket::text
    );
    return 'escalated';
  end if;

  insert into public.support_messages (ticket_id, sender_id, from_staff, body)
  values (ticket, null, true, left(btrim(reply), 4000));

  update public.support_tickets
     set status = 'answered', updated_at = now()
   where id = ticket;

  insert into public.ai_reviews (subject, subject_id, decision, reason, model)
  values ('ticket', ticket::text, 'answered', left(btrim(reply), 500), model);

  perform public.send_mail(
    one.user_id, 'support', 'Kobblon replied to your ticket',
    left(btrim(reply), 500), '/support/' || ticket::text
  );

  return 'answered';
end $$;

revoke all on function public.answer_ticket(bigint, text, boolean, text) from public;
grant execute on function public.answer_ticket(bigint, text, boolean, text)
  to authenticated, service_role;

commit;
