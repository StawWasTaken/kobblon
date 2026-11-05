begin;

-- A `case` cannot reach across two table shapes
-- -----------------------------------------------------------------------
--
-- 0189's queue trigger did this:
--
--     author := case tg_table_name
--       when 'community_posts' then new.author_id
--       else new.sender_id
--     end;
--
-- One trigger function on three tables, and `community_posts` is the only
-- one with `author_id`. plpgsql resolves the whole expression against the
-- record it actually has, so on `messages` it raises
-- `record "new" has no field "author_id"` - and because the trigger is
-- `after insert`, **that takes the insert down with it.** Every private
-- message on Kobblon would have failed to send.
--
-- It read as obviously correct and it is obviously wrong the moment it
-- runs, which is the whole argument for running it. Separate branches:
-- only the one taken is evaluated.

create or replace function public.queue_for_the_machine()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  author uuid;
  kind text;
begin
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

commit;
