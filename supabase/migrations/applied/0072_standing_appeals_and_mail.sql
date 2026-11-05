-- Where somebody stands, and how they answer back.
--
-- Moderation could only remove things. There was nothing that said what had
-- happened to an account, nothing an account could be told with any certainty
-- it would still be there tomorrow, and nowhere to argue. Four things here:
--
--   violations   what was decided about an account, one row per decision
--   appeals      asking for one of those to be looked at again
--   tickets      writing to Kobblon, and being written back to
--   mail         the official inbox, which is not the notification bell
--
-- Mail is separate from notifications on purpose. A moderation decision, a
-- security notice or a reply from support cannot be allowed to scroll past
-- behind six people liking a Space, so it has its own table, its own count
-- and its own address, and nothing writes to it from a browser.

-- ------------------------------------------------------------- violations

create table if not exists public.violations (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  /** Which house rule, so support can point at the rule rather than the page. */
  rule text not null check (rule in
    ('harassment','spam','sexual','violence','impersonation','illegal',
     'hate','cheating','copyright','age','other')),
  action text not null check (action in
    ('warning','content_removed','feature_block','suspension','termination')),
  /** What was done about it, in words the account is allowed to read. */
  reason text not null check (char_length(reason) between 1 and 1000),
  /** What it was about: a Space, a message, an upload. Kept loose on purpose. */
  target_type text check (target_type in ('profile','space','message','asset','style_item','comment')),
  target_id text,
  /** What a feature block stops, where the action is a feature block. */
  blocks text[] not null default '{}',
  moderator_id uuid references public.profiles on delete set null,
  report_id bigint references public.reports on delete set null,
  /** Null on a warning, and on anything meant to last. */
  expires_at timestamptz,
  /** An upheld appeal voids the row rather than deleting it. */
  is_void boolean not null default false,
  void_reason text check (char_length(void_reason) <= 400),
  created_at timestamptz not null default now()
);

create index if not exists violations_user_idx on public.violations (user_id, created_at desc);

-- ---------------------------------------------------------------- appeals

create table if not exists public.appeals (
  id bigserial primary key,
  violation_id bigint not null references public.violations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 20 and 2000),
  status text not null default 'open' check (status in ('open','upheld','declined')),
  decision_note text check (char_length(decision_note) <= 1000),
  decided_by uuid references public.profiles on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

/** One open appeal per decision, and one go at it once it has been answered. */
create unique index if not exists appeals_one_per_violation
  on public.appeals (violation_id);

-- ---------------------------------------------------------------- tickets

create table if not exists public.support_tickets (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  topic text not null check (topic in
    ('account','money','safety','bug','creator','privacy','other')),
  subject text not null check (char_length(subject) between 3 and 140),
  status text not null default 'open' check (status in ('open','answered','closed')),
  /** Moved when either side writes, so the queue sorts by who is waiting. */
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx
  on public.support_tickets (user_id, updated_at desc);

create table if not exists public.support_messages (
  id bigserial primary key,
  ticket_id bigint not null references public.support_tickets on delete cascade,
  sender_id uuid references public.profiles on delete set null,
  from_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);

-- ------------------------------------------------------------------- mail

create table if not exists public.mail (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in
    ('moderation','security','support','policy','announcement','money')),
  subject text not null check (char_length(subject) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  /** Where the letter goes when you act on it, inside the site only. */
  link text check (link is null or link like '/%'),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mail_user_idx on public.mail (user_id, created_at desc);
create index if not exists mail_unread_idx on public.mail (user_id) where not is_read;

alter table public.violations enable row level security;
alter table public.appeals enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.mail enable row level security;

/*
 * You can read what was decided about you, and nothing about anybody else.
 * Writing is a moderator's job and happens through the functions below, so
 * no policy grants an insert to a browser.
 */
drop policy if exists violations_read on public.violations;
create policy violations_read on public.violations for select
  using (user_id = auth.uid() or public.is_moderator());

drop policy if exists appeals_read on public.appeals;
create policy appeals_read on public.appeals for select
  using (user_id = auth.uid() or public.is_moderator());

drop policy if exists tickets_read on public.support_tickets;
create policy tickets_read on public.support_tickets for select
  using (user_id = auth.uid() or public.is_moderator());

drop policy if exists ticket_messages_read on public.support_messages;
create policy ticket_messages_read on public.support_messages for select
  using (
    public.is_moderator()
    or exists (
      select 1 from public.support_tickets t
       where t.id = support_messages.ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists mail_read on public.mail;
create policy mail_read on public.mail for select
  using (user_id = auth.uid() or public.is_moderator());

grant select on public.violations, public.appeals, public.support_tickets,
                public.support_messages, public.mail to authenticated;

-- ----------------------------------------------------------- writing mail

/**
 * The only way a letter is written. Nothing in a browser can reach it: it is
 * called by the moderation and support functions below, which are the things
 * allowed to speak for Kobblon.
 */
create or replace function public.send_mail(
  who uuid, kind text, subject text, body text, link text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare made bigint;
begin
  insert into public.mail (user_id, kind, subject, body, link)
  values (who, kind, subject, body, link)
  returning id into made;
  return made;
end $$;

revoke all on function public.send_mail(uuid, text, text, text, text) from public, anon, authenticated;

/** What is waiting, for the dot beside the inbox. */
create or replace function public.unread_mail()
returns integer
language sql security definer set search_path = public as $$
  select count(*)::integer from public.mail
   where user_id = auth.uid() and not is_read
$$;

create or replace function public.read_mail(letter bigint)
returns void
language sql security definer set search_path = public as $$
  update public.mail set is_read = true
   where id = letter and user_id = auth.uid()
$$;

create or replace function public.read_all_mail()
returns void
language sql security definer set search_path = public as $$
  update public.mail set is_read = true
   where user_id = auth.uid() and not is_read
$$;

grant execute on function public.unread_mail() to authenticated;
grant execute on function public.read_mail(bigint) to authenticated;
grant execute on function public.read_all_mail() to authenticated;

-- --------------------------------------------------------------- standing

/**
 * Where an account stands, said plainly and without a word of what a
 * moderator wrote in private. Four levels, worked out from the decisions that
 * are still standing rather than stored anywhere, so voiding a decision puts
 * an account back where it was with nothing to keep in step.
 */
create or replace function public.my_standing()
returns table (
  level text,
  headline text,
  live_count integer,
  warning_count integer,
  blocks text[],
  until timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  suspended boolean;
  gone boolean;
  live record;
begin
  if me is null then return; end if;

  select coalesce(p.is_suspended, false) into suspended from public.profiles p where p.id = me;

  select
    count(*) filter (where v.action <> 'warning')::integer as heavy,
    count(*) filter (where v.action = 'warning')::integer as warned,
    coalesce((
      select array_agg(distinct b) from public.violations v2, unnest(v2.blocks) b
       where v2.user_id = me and not v2.is_void
         and v2.action = 'feature_block'
         and (v2.expires_at is null or v2.expires_at > now())
    ), '{}'::text[]) as stopped,
    max(v.expires_at) filter (
      where v.action in ('feature_block','suspension')
        and (v.expires_at is null or v.expires_at > now())
    ) as ends,
    bool_or(v.action = 'termination') as ended
    into live
    from public.violations v
   where v.user_id = me and not v.is_void
     and (v.expires_at is null or v.expires_at > now());

  gone := coalesce(live.ended, false);

  return query select
    case
      when gone then 'terminated'
      when suspended then 'suspended'
      when coalesce(array_length(live.stopped, 1), 0) > 0 then 'limited'
      when coalesce(live.warned, 0) > 0 or coalesce(live.heavy, 0) > 0 then 'warned'
      else 'clear'
    end,
    case
      when gone then 'This account has been closed.'
      when suspended then 'This account is suspended.'
      when coalesce(array_length(live.stopped, 1), 0) > 0
        then 'Some things are switched off on this account.'
      when coalesce(live.warned, 0) > 0 or coalesce(live.heavy, 0) > 0
        then 'There is something on record against this account.'
      else 'Nothing on record. Carry on.'
    end,
    coalesce(live.heavy, 0),
    coalesce(live.warned, 0),
    coalesce(live.stopped, '{}'::text[]),
    live.ends;
end $$;

grant execute on function public.my_standing() to authenticated;

/**
 * Whether a particular thing is switched off for the person asking. The place
 * that stops somebody posting is the server, not a hidden button, so anything
 * that can be blocked asks this rather than reading the standing page.
 */
create or replace function public.is_blocked_from(what text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.violations v
     where v.user_id = auth.uid() and not v.is_void
       and v.action in ('feature_block','suspension','termination')
       and (v.expires_at is null or v.expires_at > now())
       and (v.action <> 'feature_block' or what = any (v.blocks))
  )
$$;

grant execute on function public.is_blocked_from(text) to authenticated;

-- ------------------------------------------------------------ moderating

/**
 * Deciding something about an account. Writes the record and the letter in
 * one go, so an account is never restricted without being told why.
 */
create or replace function public.record_violation(
  who uuid,
  rule text,
  action text,
  reason text,
  blocks text[] default '{}',
  lasts_days integer default null,
  target_type text default null,
  target_id text default null,
  report_id bigint default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare made bigint;
begin
  if not public.is_moderator() then
    raise exception 'Only a moderator can do that.';
  end if;

  insert into public.violations
    (user_id, rule, action, reason, blocks, expires_at,
     target_type, target_id, moderator_id, report_id)
  values
    (who, rule, action, reason, coalesce(blocks, '{}'),
     case when lasts_days is null then null else now() + make_interval(days => lasts_days) end,
     record_violation.target_type, record_violation.target_id, auth.uid(), record_violation.report_id)
  returning id into made;

  if action = 'suspension' then
    update public.profiles set is_suspended = true where id = who;
  end if;

  perform public.send_mail(
    who, 'moderation',
    case action
      when 'warning' then 'A warning about your account'
      when 'content_removed' then 'Something of yours was taken down'
      when 'feature_block' then 'Something has been switched off on your account'
      when 'suspension' then 'Your account has been suspended'
      else 'Your account has been closed'
    end,
    reason,
    '/standing'
  );

  return made;
end $$;

grant execute on function public.record_violation(uuid, text, text, text, text[], integer, text, text, bigint)
  to authenticated;

/** Asking for a decision to be looked at again. */
create or replace function public.file_appeal(violation bigint, body text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare made bigint; mine boolean;
begin
  select exists (
    select 1 from public.violations v where v.id = violation and v.user_id = auth.uid()
  ) into mine;

  if not mine then
    raise exception 'There is no decision of yours with that number.';
  end if;

  if exists (select 1 from public.appeals a where a.violation_id = violation) then
    raise exception 'That decision has already been appealed.';
  end if;

  insert into public.appeals (violation_id, user_id, body)
  values (violation, auth.uid(), body)
  returning id into made;

  return made;
end $$;

grant execute on function public.file_appeal(bigint, text) to authenticated;

/** Answering one. Upholding it voids the decision and lifts what it stopped. */
create or replace function public.decide_appeal(appeal bigint, upheld boolean, note text)
returns void
language plpgsql security definer set search_path = public as $$
declare row_appeal public.appeals;
begin
  if not public.is_moderator() then
    raise exception 'Only a moderator can do that.';
  end if;

  select * into row_appeal from public.appeals where id = appeal;
  if row_appeal.id is null then
    raise exception 'There is no appeal with that number.';
  end if;

  update public.appeals
     set status = case when upheld then 'upheld' else 'declined' end,
         decision_note = note, decided_by = auth.uid(), decided_at = now()
   where id = appeal;

  if upheld then
    update public.violations
       set is_void = true, void_reason = note
     where id = row_appeal.violation_id;

    if not exists (
      select 1 from public.violations v
       where v.user_id = row_appeal.user_id and not v.is_void
         and v.action in ('suspension','termination')
         and (v.expires_at is null or v.expires_at > now())
    ) then
      update public.profiles set is_suspended = false where id = row_appeal.user_id;
    end if;
  end if;

  perform public.send_mail(
    row_appeal.user_id, 'moderation',
    case when upheld then 'Your appeal was upheld' else 'Your appeal was declined' end,
    note, '/standing'
  );
end $$;

grant execute on function public.decide_appeal(bigint, boolean, text) to authenticated;

-- ------------------------------------------------------- writing to us

create or replace function public.open_ticket(topic text, subject text, body text)
returns bigint
language plpgsql security definer set search_path = public as $$
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

  insert into public.support_tickets (user_id, topic, subject)
  values (auth.uid(), topic, subject)
  returning id into made;

  insert into public.support_messages (ticket_id, sender_id, body)
  values (made, auth.uid(), body);

  return made;
end $$;

grant execute on function public.open_ticket(text, text, text) to authenticated;

/** Writing again on a ticket, from either side. */
create or replace function public.reply_ticket(ticket bigint, body text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare made bigint; owner_id uuid; staff boolean := public.is_moderator();
begin
  select t.user_id into owner_id from public.support_tickets t where t.id = ticket;
  if owner_id is null then
    raise exception 'There is no ticket with that number.';
  end if;
  if owner_id <> auth.uid() and not staff then
    raise exception 'That is not your ticket.';
  end if;

  insert into public.support_messages (ticket_id, sender_id, from_staff, body)
  values (ticket, auth.uid(), staff, body)
  returning id into made;

  update public.support_tickets
     set updated_at = now(),
         status = case when staff then 'answered' else 'open' end
   where id = ticket;

  if staff then
    perform public.send_mail(
      owner_id, 'support', 'We replied to your ticket', body, '/support/' || ticket::text
    );
  end if;

  return made;
end $$;

grant execute on function public.reply_ticket(bigint, text) to authenticated;

create or replace function public.close_ticket(ticket bigint)
returns void
language sql security definer set search_path = public as $$
  update public.support_tickets set status = 'closed', updated_at = now()
   where id = ticket and (user_id = auth.uid() or public.is_moderator())
$$;

grant execute on function public.close_ticket(bigint) to authenticated;
