begin;

-- Being told, rather than finding out
-- -----------------------------------------------------------------------
--
-- Staw: the card should appear the moment somebody is chat-suspended, not
-- when they next reload, and the same when it lifts.
--
-- The lifting half already works - the window counts down to the end time
-- it was given and asks again at zero. The suspension half did not, and
-- could not: nothing told the page. The best it managed was noticing on
-- the next refused send, which means the first thing somebody knows about
-- a suspension is a message of theirs failing.
--
-- `chat_timeouts` goes into the realtime publication so a row appearing is
-- something a window can hear. The row-level policy is unchanged and is
-- what decides who hears it: realtime applies the same policy, so a person
-- is told about their own suspension and about nobody else's.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public' and tablename = 'chat_timeouts'
     )
  then
    alter publication supabase_realtime add table public.chat_timeouts;
  end if;
end $$;

/*
 * Realtime sends the row, and a row is not the answer - `my_chat_standing`
 * works out the card from it. So the window hears "something changed" and
 * asks the question it already knows how to ask, rather than being handed
 * a half-answer it has to assemble a second way.
 */

commit;
