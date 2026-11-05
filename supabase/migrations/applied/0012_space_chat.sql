-- Every Space gets a chat. The owner decides whether it is on, what it says
-- when you walk in, and how fast people can talk. Messages are screened by
-- the same filter as everything else.

alter table public.spaces
  add column chat_enabled boolean not null default true,
  add column chat_greeting text check (char_length(chat_greeting) <= 200),
  add column chat_slowmode_seconds smallint not null default 0
    check (chat_slowmode_seconds between 0 and 300);

create table public.space_messages (
  id bigserial primary key,
  space_id uuid not null references public.spaces on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  is_removed boolean not null default false,
  created_at timestamptz not null default now()
);

create index space_messages_recent_idx on public.space_messages (space_id, created_at desc);

alter table public.space_messages enable row level security;

-- Anyone who can see the Space can read its chat.
create policy space_messages_read on public.space_messages for select
  using (
    not is_removed
    and exists (
      select 1 from public.spaces s
       where s.id = space_id and s.is_published and not s.is_removed
    )
  );

-- Sending needs an account, a Space with chat left on, and the sender to be
-- themselves. Slow mode and screening are enforced by the trigger below.
create policy space_messages_send on public.space_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.spaces s
       where s.id = space_id and s.is_published and not s.is_removed and s.chat_enabled
    )
  );

-- The owner of a Space can clear anything said in it.
create policy space_messages_remove on public.space_messages for update
  using (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()));

create or replace function public.screen_space_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
  wait smallint;
  last_sent timestamptz;
begin
  select chat_slowmode_seconds into wait from public.spaces where id = new.space_id;

  if wait > 0 then
    select max(created_at) into last_sent
      from public.space_messages
     where space_id = new.space_id and sender_id = new.sender_id;

    if last_sent is not null and last_sent > now() - make_interval(secs => wait) then
      raise exception 'Slow mode is on here. Wait a moment before sending again.';
    end if;
  end if;

  select * into verdict from public.screen_text(new.body);
  if verdict.decision = 'block' then
    raise exception 'That message was not sent: %', verdict.reason;
  end if;

  return new;
end;
$$;

create trigger space_messages_screen
  before insert on public.space_messages
  for each row execute function public.screen_space_message();

alter publication supabase_realtime add table public.space_messages;
