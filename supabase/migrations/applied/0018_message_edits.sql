-- Messages can be changed and taken back by whoever sent them.

alter table public.messages
  add column if not exists edited_at timestamptz;

-- Editing keeps the row so the conversation does not renumber itself; the
-- body changes and the edit is stamped. Deleting marks it removed.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select
  using (public.in_conversation(conversation_id, auth.uid()));

drop policy if exists messages_edit_own on public.messages;
create policy messages_edit_own on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create or replace function public.screen_message_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
begin
  if new.body is distinct from old.body then
    select * into verdict from public.screen_text(new.body);
    if verdict.decision = 'block' then
      raise exception 'That edit was not saved: %', verdict.reason;
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists messages_screen_edit on public.messages;
create trigger messages_screen_edit
  before update on public.messages
  for each row execute function public.screen_message_edit();

-- ----------------------------------------------------------------- blocking

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists blocks_read_own on public.blocks;
create policy blocks_read_own on public.blocks for select using (blocker_id = auth.uid());
drop policy if exists blocks_write_own on public.blocks;
create policy blocks_write_own on public.blocks for insert with check (blocker_id = auth.uid());
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks for delete using (blocker_id = auth.uid());

/** Blocking also ends the friendship, so the two cannot keep messaging. */
create or replace function public.block_person(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or me = target then raise exception 'cannot block that'; end if;

  insert into public.blocks (blocker_id, blocked_id) values (me, target)
  on conflict do nothing;

  delete from public.friendships
   where (requester_id = me and addressee_id = target)
      or (requester_id = target and addressee_id = me);
end;
$$;

grant execute on function public.block_person to authenticated;

-- A blocked pair cannot send to each other, checked where messages are made.
create or replace function public.screen_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
begin
  if exists (
    select 1 from public.blocks b
    join public.conversation_members m
      on m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
   where (b.blocker_id = new.sender_id and b.blocked_id = m.user_id)
      or (b.blocker_id = m.user_id and b.blocked_id = new.sender_id)
  ) then
    raise exception 'You cannot message this person.';
  end if;

  select * into verdict from public.screen_text(new.body);
  if verdict.decision = 'block' then
    raise exception 'That message was not sent: %', verdict.reason;
  end if;

  return new;
end;
$$;
