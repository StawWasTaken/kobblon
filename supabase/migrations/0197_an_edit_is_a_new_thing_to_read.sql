begin;

-- The hole an edit walks through
-- -----------------------------------------------------------------------
--
-- `words_are_censored` fires on insert **or update of body**, so the word
-- list has always read edits. The queue that feeds the machine did not:
-- all three `_go_to_the_machine` triggers were `after insert`, full stop.
--
-- So: send "hi", edit it into whatever you meant to say. The list sees it
-- and shrugs, because the list only knows words; the machine, which is the
-- part that reads what was meant, never hears about it at all. Every
-- careful thing built into the judgement side was one edit away from being
-- skipped, on private messages, world chat and community posts alike.
--
-- An edit is a new thing somebody said. It goes in the queue like one.
--
-- The guard against re-reading: only when the body actually changed. An
-- edit that renames nothing - a pin, a stamp, any other column being
-- written - must not cost a reading, or every unrelated update to a row
-- becomes work for the machine.

create or replace function public.queue_for_the_machine()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  author uuid;
  kind text;
begin
  -- Nothing new was said.
  if tg_op = 'UPDATE' and new.body is not distinct from old.body then
    return null;
  end if;

  if tg_table_name = 'community_posts' then
    kind := 'community_post';
    author := new.author_id;
  elsif tg_table_name = 'space_messages' then
    kind := 'space_message';
    author := new.sender_id;
  elsif tg_table_name = 'messages' then
    kind := 'message';
    author := new.sender_id;
  else
    return null;
  end if;

  insert into public.chat_to_read (kind, ref, who, body, was_masked)
  values (kind, new.id::text, author, new.body, new.body like '%••••%');

  return null;
end $$;

drop trigger if exists messages_go_to_the_machine on public.messages;
create trigger messages_go_to_the_machine
  after insert or update of body on public.messages
  for each row execute function public.queue_for_the_machine();

drop trigger if exists space_messages_go_to_the_machine on public.space_messages;
create trigger space_messages_go_to_the_machine
  after insert or update of body on public.space_messages
  for each row execute function public.queue_for_the_machine();

drop trigger if exists community_posts_go_to_the_machine on public.community_posts;
create trigger community_posts_go_to_the_machine
  after insert or update of body on public.community_posts
  for each row execute function public.queue_for_the_machine();

commit;
