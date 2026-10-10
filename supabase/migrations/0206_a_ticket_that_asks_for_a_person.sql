begin;

/*
 * "I want my ticket to be reviewed by a human."
 *
 * Staw asked for a checkmark on the ticket card, "for if its important or
 * wtv". One column, and a real effect rather than a reassuring tick:
 * tickets that ask for it sort to the front of the staff queue and are
 * marked there, so ticking it changes who sees it and when.
 *
 * What it is careful not to claim: **nothing automated answers tickets
 * today.** Kobby reads messages, posts and uploads; it has never written a
 * support reply and there is no model in the loop here. So the box cannot
 * honestly promise "a human instead of a robot" - that is already true of
 * every ticket - and the card says so beside it. What it promises is that
 * this one is marked urgent and read sooner, which is a thing the database
 * can actually do.
 *
 * If Kobby ever does draft support replies, this is the column that must
 * stop it, and it already exists.
 */

alter table public.support_tickets
  add column if not exists wants_human boolean not null default false;

comment on column public.support_tickets.wants_human is
  'They asked for a person to read this one. Sorts to the front of the '
  'staff queue. Nothing automated answers tickets today, so this marks '
  'urgency rather than routing around a machine - and if that ever '
  'changes, this is the column that stops it.';

create index if not exists support_tickets_urgent_idx
  on public.support_tickets (wants_human, updated_at desc) where status <> 'closed';

/*
 * The six-argument form goes rather than sitting beside a seventh, for the
 * same reason the three-argument one did in 0204: two overloads that differ
 * only by defaulted arguments is a call somebody eventually makes
 * ambiguously, and the website is the only caller.
 */
drop function if exists public.open_ticket(text, text, text, text, text, text);

create or replace function public.open_ticket(
  topic text,
  subject text,
  body text,
  contact_email text default null,
  first_name text default null,
  device text default null,
  wants_human boolean default false
) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare made bigint; guest boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  select coalesce(p.is_guest, false) into guest from public.profiles p where p.id = auth.uid();
  if guest then
    raise exception 'Turn your guest account into a proper one first, so we can write back.';
  end if;

  if exists (
    select 1 from public.support_tickets t
     where t.user_id = auth.uid() and t.status = 'open'
       and t.created_at > now() - interval '1 hour'
    having count(*) >= 3
  ) then
    raise exception 'That is enough tickets for one hour. We will get to the ones you have sent.';
  end if;

  insert into public.support_tickets
    (user_id, topic, subject, contact_email, first_name, device, wants_human)
  values
    (auth.uid(), topic, subject,
     nullif(btrim(open_ticket.contact_email), ''),
     nullif(btrim(open_ticket.first_name), ''),
     nullif(btrim(open_ticket.device), ''),
     coalesce(open_ticket.wants_human, false))
  returning id into made;

  insert into public.support_messages (ticket_id, sender_id, body)
  values (made, auth.uid(), body);

  return made;
end $$;

grant execute on function public.open_ticket(text, text, text, text, text, text, boolean)
  to authenticated;

commit;
