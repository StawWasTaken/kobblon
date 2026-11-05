begin;

/*
 * Support, as a ticket card.
 *
 * Staw showed me Roblox's Contact Us form and said "that is just a ticket
 * card thing": a username, a first name, an email typed twice, what you are
 * on, what it is about, and then what happened. Ours asked for a topic and a
 * subject line and nothing else, which is the shape of a forum post rather
 * than a support request - and the two fields that actually matter when
 * somebody cannot get into their account were both missing.
 *
 * Three columns, all optional, because every one of them is already known for
 * a signed-in person and the form should not make them type it again:
 *
 *   contact_email  where to write back if the account itself is the problem.
 *   first_name     what to call them, which Roblox asks for and is kind.
 *   device         what they were on, which halves the questions a bug
 *                  ticket needs before anybody can begin.
 *
 * The email is stored, never verified here, and support must treat it as a
 * claim rather than proof: anybody can type anybody's address into a box.
 * Nothing on the platform is unlocked by what is in this column.
 */

alter table public.support_tickets
  add column if not exists contact_email text
    check (contact_email is null or
           (char_length(contact_email) between 5 and 160 and contact_email like '%_@_%._%')),
  add column if not exists first_name text
    check (first_name is null or char_length(first_name) between 1 and 60),
  add column if not exists device text
    check (device is null or device in
      ('computer','phone','tablet','console','launcher','other'));

comment on column public.support_tickets.contact_email is
  'What they typed into the form. A claim, not proof - support writes to it, '
  'and nothing is ever unlocked because of what is in here.';

/*
 * The old three-argument form goes, rather than sitting beside the new one:
 * two overloads that differ only by defaulted arguments is a call somebody
 * eventually makes ambiguously, and the website is the only caller.
 */
drop function if exists public.open_ticket(text, text, text);

create or replace function public.open_ticket(
  topic text,
  subject text,
  body text,
  contact_email text default null,
  first_name text default null,
  device text default null
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
    (user_id, topic, subject, contact_email, first_name, device)
  values
    (auth.uid(), topic, subject,
     nullif(btrim(open_ticket.contact_email), ''),
     nullif(btrim(open_ticket.first_name), ''),
     nullif(btrim(open_ticket.device), ''))
  returning id into made;

  insert into public.support_messages (ticket_id, sender_id, body)
  values (made, auth.uid(), body);

  return made;
end $$;

grant execute on function public.open_ticket(text, text, text, text, text, text) to authenticated;

commit;
