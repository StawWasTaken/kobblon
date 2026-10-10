begin;

-- The AI has never read a single message
-- -----------------------------------------------------------------------
--
-- Staw: "im starting to feel like our moderation doesnt even use our AI".
-- He is right, and it is worse than not working well - it has never been
-- connected at all.
--
-- `ai_work` has returned pending Catalog items, pending Create uploads and
-- (since 0179) report tickets. Never a message. `apply_ai_verdict` has no
-- 'message' subject to act on. Everything that has ever been decided about
-- something somebody said was decided by the regular expressions in
-- `moderation_terms` and by nothing else. The AI settings page, the models,
-- the "looked at 12" counter - all of that has been about uploads.
--
-- So: a queue. Every line said anywhere lands in it, and the machine reads
-- it after the fact.
--
-- **After the fact, and that is deliberate.** Sending every message to a
-- model before it is delivered would put a network round trip in front of
-- every keystroke-to-screen, and a model being slow or down would stop
-- Kobblon's chat entirely. The patterns stay in front - they are instant
-- and they are what makes "censored, not refused" possible - and the model
-- reads what got through, which is the half the patterns were never going
-- to catch: the sentence that is cruel without containing a word on any
-- list.
--
-- What the machine may do about it is unchanged and is checked in
-- `apply_ai_verdict`: warn, suspend. Never delete. That rule has not
-- moved and this does not move it.

create table if not exists public.chat_to_read (
  id bigserial primary key,
  /** Which table it came from, so a verdict can point back at the line. */
  kind text not null check (kind in ('message', 'space_message', 'community_post')),
  ref text not null,
  who uuid references public.profiles on delete cascade,
  /** As it was stored - which is to say already censored by the patterns. */
  body text not null,
  /** Whether the patterns had already objected, so the model knows. */
  was_masked boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_to_read_waiting_idx
  on public.chat_to_read (created_at) where read_at is null;
create index if not exists chat_to_read_who_idx
  on public.chat_to_read (who, created_at desc);

-- The grants, in the same file as the table. A policy decides which rows a
-- role may see and a grant decides whether it may touch the table at all,
-- and a new table has none - which is the fourth trap in CLAUDE.md and has
-- already cost this project a fortnight twice.
alter table public.chat_to_read enable row level security;
grant select on public.chat_to_read to authenticated;
grant usage, select on sequence public.chat_to_read_id_seq to authenticated;

drop policy if exists chat_to_read_staff on public.chat_to_read;
create policy chat_to_read_staff on public.chat_to_read
  for select using (public.is_moderator());

/**
 * Putting a line in front of the machine.
 *
 * An `after insert` trigger rather than part of the censoring one, because
 * the censoring runs `before` and the row has no id yet - and a queue entry
 * that cannot point at what it is about is a queue entry nobody can act on.
 */
create or replace function public.queue_for_the_machine()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  author uuid;
  kind text;
begin
  kind := case tg_table_name
    when 'messages' then 'message'
    when 'space_messages' then 'space_message'
    when 'community_posts' then 'community_post'
  end;
  if kind is null then return null; end if;

  author := case tg_table_name
    when 'community_posts' then new.author_id
    else new.sender_id
  end;

  insert into public.chat_to_read (kind, ref, who, body, was_masked)
  values (kind, new.id::text, author, new.body, new.body like '%••••%');

  return null;
end $$;

drop trigger if exists messages_go_to_the_machine on public.messages;
create trigger messages_go_to_the_machine
  after insert on public.messages
  for each row execute function public.queue_for_the_machine();

drop trigger if exists space_messages_go_to_the_machine on public.space_messages;
create trigger space_messages_go_to_the_machine
  after insert on public.space_messages
  for each row execute function public.queue_for_the_machine();

drop trigger if exists community_posts_go_to_the_machine on public.community_posts;
create trigger community_posts_go_to_the_machine
  after insert on public.community_posts
  for each row execute function public.queue_for_the_machine();

/**
 * Throwing away what has been read.
 *
 * Every line anybody says lands in this table, so without this it is the
 * biggest table on the platform within a month. A week of read lines is
 * enough to answer "what did the machine decide about this" and then it
 * goes.
 */
create or replace function public.forget_read_chat()
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare gone integer;
begin
  delete from public.chat_to_read
   where read_at is not null and read_at < now() - interval '7 days';
  get diagnostics gone = row_count;
  return gone;
end $$;

grant execute on function public.forget_read_chat to authenticated;

commit;
