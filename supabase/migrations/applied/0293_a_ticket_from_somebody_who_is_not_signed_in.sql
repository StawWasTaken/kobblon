begin;

/*
 * Writing to Kobblon without an account, and writing to Kobblon as a company
 * -----------------------------------------------------------------------
 *
 * Staw: "even ppl who arent logged in can make tickets and theres two
 * categories like for the players users etc and 'business' like in the
 * sliding thing theres two boxes and for business its for other companies
 * (not individuals, excepted investors ...) if u wanna invest in kobblon or
 * make a partnership, or if u have issues with some of our content on the
 * platform".
 *
 * Two changes to the same table, and they lean on each other: a company
 * writing about a partnership has no Kobblon account and should not be asked
 * to make one, and somebody locked out of their account cannot sign in to say
 * so - which is the oldest hole in this page. `open_ticket` has raised
 * "Sign in first." since 0072.
 *
 * What that costs, and what pays for it:
 *
 *   `user_id` becomes nullable.  A ticket with no account behind it is a
 *       ticket nobody can be written back to on the site, so an email is
 *       required for one - it is the only channel it has. The address is a
 *       claim and not proof, exactly as 0204 says, and nothing on the
 *       platform is unlocked by what is in that column.
 *
 *   The row is invisible to the browser.  `tickets_read` is
 *       `user_id = auth.uid() or is_moderator()`, and `null = anything` is
 *       null rather than true, so an account-less ticket can be read by
 *       staff and by nobody else - including the next anonymous person, who
 *       is the one case worth being careful about. No grant to `anon` is
 *       added here and none is wanted: the form posts through this function
 *       and reads nothing back.
 *
 *   Rate limiting loses its subject.  The signed-in limit is three open
 *       tickets an hour per account. Without an account there is no id to
 *       count, so it counts the address given instead, and holds a ceiling
 *       over all account-less tickets together so a thousand made-up
 *       addresses is still bounded. Neither is a wall; both are a cost.
 *
 * `kind` is the second half. A business enquiry is not a support ticket with
 * a different subject line: different topics, no device, a company name and
 * a job title, and an email that is not optional. One column keeps them in
 * one queue - staff answer both - while letting each ask for what it needs.
 */

alter table public.support_tickets
  alter column user_id drop not null;

comment on column public.support_tickets.user_id is
  'Null for a ticket written by somebody who was not signed in. Such a row '
  'is readable by staff only - `user_id = auth.uid()` is null, not true - '
  'and its only way back is the address in contact_email.';

alter table public.support_tickets
  add column if not exists kind text not null default 'player'
    check (kind in ('player', 'business')),
  add column if not exists org text
    check (org is null or char_length(org) between 1 and 120),
  /*
   * `org_role` rather than `role`: `role` is a column name Postgres accepts
   * and a word every other tool in the chain has an opinion about, and a
   * `set role` typo inside a function that has one is not a mistake worth
   * leaving available.
   */
  add column if not exists org_role text
    check (org_role is null or char_length(org_role) between 1 and 120);

comment on column public.support_tickets.kind is
  'player: somebody who uses Kobblon. business: a company writing about '
  'investment, a partnership, or our content. Same queue, different form.';

/*
 * Four topics only a business ticket uses, beside the seven a player's does.
 * A text check rather than an enum, as 0212 had it, so this is one ordinary
 * alter instead of the two-migration dance an enum addition needs.
 */
alter table public.support_tickets drop constraint if exists support_tickets_topic_check;
alter table public.support_tickets add constraint support_tickets_topic_check
  check (topic in (
    'account', 'money', 'safety', 'bug', 'creator', 'privacy', 'other',
    'invest', 'partner', 'content', 'press'));

create index if not exists support_tickets_business_idx
  on public.support_tickets (kind, updated_at desc) where status <> 'closed';

/*
 * The seven-argument form goes rather than sitting beside a ten-argument
 * one, for the reason 0204 and 0206 both give: two overloads that differ
 * only by defaulted arguments is a call somebody eventually makes
 * ambiguously, and the website is the only caller.
 */
drop function if exists public.open_ticket(text, text, text, text, text, text, boolean);

create or replace function public.open_ticket(
  topic text,
  subject text,
  body text,
  contact_email text default null,
  first_name text default null,
  device text default null,
  wants_human boolean default false,
  kind text default 'player',
  org text default null,
  org_role text default null
) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  made bigint;
  guest boolean;
  me uuid := auth.uid();
  mail text := nullif(btrim(open_ticket.contact_email), '');
  want text := coalesce(nullif(btrim(open_ticket.kind), ''), 'player');
begin
  if want not in ('player', 'business') then
    raise exception 'That is not a kind of ticket.';
  end if;

  /*
   * Which topics each form may use. Checked here and not only by the
   * constraint, so a player ticket cannot arrive filed as an investment
   * enquiry and jump the queue staff sort by kind.
   */
  if want = 'business' then
    if open_ticket.topic not in ('invest', 'partner', 'content', 'press', 'other') then
      raise exception 'That is not something this form is for.';
    end if;
  elsif open_ticket.topic not in
    ('account', 'money', 'safety', 'bug', 'creator', 'privacy', 'other') then
    raise exception 'That is not something this form is for.';
  end if;

  /*
   * The address is the whole channel for anything with no account behind it,
   * and for a company it is the only sensible one even when somebody happens
   * to be signed in. The shape is checked loosely - the column's own check
   * does the same - and neither is proof of anything.
   */
  if (me is null or want = 'business') and mail is null then
    raise exception 'We need an email address to answer this one.';
  end if;

  /* Said here rather than left to the column's own check, whose refusal
     reads as a constraint name to whoever typed the address. */
  if mail is not null and mail not like '%_@_%._%' then
    raise exception 'That does not look like an email address.';
  end if;

  if me is null then
    if exists (
      select 1 from public.support_tickets t
       where t.user_id is null
         and lower(t.contact_email) = lower(mail)
         and t.created_at > now() - interval '1 hour'
      having count(*) >= 3
    ) then
      raise exception 'That is enough for one hour. We have the ones you sent.';
    end if;

    /*
     * And a ceiling over all of them together, because the line above
     * counts an address anybody can invent. It is deliberately high enough
     * that it is never met by people writing in and low enough that a
     * script is not free.
     */
    if exists (
      select 1 from public.support_tickets t
       where t.user_id is null and t.created_at > now() - interval '1 hour'
      having count(*) >= 60
    ) then
      raise exception 'Support is taking more than it can read right now. Try again shortly.';
    end if;
  else
    select coalesce(p.is_guest, false) into guest from public.profiles p where p.id = me;
    /*
     * A guest used to be refused outright, "so we can write back". With an
     * address there is a way back, so the refusal is now about the thing it
     * was always about: being reachable.
     */
    if guest and mail is null then
      raise exception 'Give us an email address, or turn this guest account into a proper one, so we can write back.';
    end if;

    if exists (
      select 1 from public.support_tickets t
       where t.user_id = me and t.status = 'open'
         and t.created_at > now() - interval '1 hour'
      having count(*) >= 3
    ) then
      raise exception 'That is enough tickets for one hour. We will get to the ones you have sent.';
    end if;
  end if;

  insert into public.support_tickets
    (user_id, kind, topic, subject, contact_email, first_name, device,
     wants_human, org, org_role)
  values
    (me, want, open_ticket.topic, open_ticket.subject, mail,
     nullif(btrim(open_ticket.first_name), ''),
     /* A company was not on a console. The column stays null rather than
        carrying whatever the form last had in it. */
     case when want = 'business' then null
          else nullif(btrim(open_ticket.device), '') end,
     coalesce(open_ticket.wants_human, false),
     case when want = 'business' then nullif(btrim(open_ticket.org), '') end,
     case when want = 'business' then nullif(btrim(open_ticket.org_role), '') end)
  returning id into made;

  insert into public.support_messages (ticket_id, sender_id, body)
  values (made, me, body);

  return made;
end $$;

grant execute on function public.open_ticket(
  text, text, text, text, text, text, boolean, text, text, text)
  to anon, authenticated;

/*
 * The queue grows three columns, so it is dropped and recreated rather than
 * replaced: `create or replace function` cannot change a return table.
 * Everything else about it is 0212's, down to the ordering.
 */
drop function if exists public.ticket_queue(text, integer);

create or replace function public.ticket_queue(
  which text default 'open', how_many integer default 200
)
returns table (
  id bigint, topic text, subject text, status text,
  first_name text, contact_email text, device text, wants_human boolean,
  kind text, org text, org_role text,
  username text, user_id uuid, opener text,
  replies integer, waiting_on_us boolean,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select t.id, t.topic, t.subject, t.status,
         t.first_name, t.contact_email, t.device, t.wants_human,
         t.kind, t.org, t.org_role,
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
           when 'business' then t.kind = 'business' and t.status <> 'closed'
           else t.status <> 'closed'
         end
   order by (t.wants_human and t.status <> 'closed') desc, t.updated_at desc
   limit least(greatest(coalesce(how_many, 200), 1), 500)
$$;

grant execute on function public.ticket_queue(text, integer) to authenticated;

commit;
