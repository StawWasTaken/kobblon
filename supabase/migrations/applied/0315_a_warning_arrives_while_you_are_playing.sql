begin;

-- A warning arrives while you are playing
-- -----------------------------------------------------------------------
--
-- From the Launcher, round 56: "A warning is not a `chat_timeout`, and nor
-- is an account suspension or a ban ... without it the card can only appear
-- when somebody happens to alt-tab, which for a ban is far too late."
--
-- That is right, and it is the same hole 0194 closed for a chat suspension.
-- `chat_timeouts` is in the realtime publication, so being quieted is heard
-- at once. Every other rung of the ladder writes a `violations` row - a
-- warning, a voice quieting, a suspension, a termination - and that table
-- is not published, so nothing says a word about any of them until the
-- next time something happens to ask.
--
-- So `violations` joins the publication, on exactly 0194's terms. Nothing
-- about who may read what changes: `violations_read` from 0072 already
-- says `user_id = auth.uid() or is_moderator()`, and realtime applies the
-- same policy to a subscriber. A person hears about their own record and
-- about nobody else's.
--
-- And, as with the suspension: the row is the knock, not the answer. The
-- card is still built by asking `my_account_standing()`, which weighs the
-- rows, the clock and the appeal together. A window that drew a card out
-- of the row it was handed would be a second opinion about somebody's
-- standing, and this platform has one.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public' and tablename = 'violations'
     )
  then
    alter publication supabase_realtime add table public.violations;
  end if;
end $$;

/*
 * `replica identity full`, which the publication alone does not give.
 *
 * Without it an update sends only the key columns in its old row, and the
 * one update that matters here is an appeal being upheld - `is_void` going
 * true, which is somebody's warning being taken off them. A subscriber
 * filtering on `user_id` would never see it, because `user_id` would not
 * be in what was sent. An insert is unaffected either way; this is for the
 * half that lifts, which is the half 0194 learned to care about.
 */
alter table public.violations replica identity full;

commit;
