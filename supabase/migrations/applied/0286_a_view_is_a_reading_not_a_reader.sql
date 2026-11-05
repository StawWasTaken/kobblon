begin;

-- A view is a reading, not a reader
-- -----------------------------------------------------------------------
--
-- Staw: "i also do want to make getting views on the forum easier".
--
-- Two topics with real readers were showing "2 views", and both reasons
-- were decisions made in 0275 that were right about accuracy and wrong
-- about what the number is for:
--
--  1. A signed-in account counted once, **ever**. Come back tomorrow,
--     read the whole thread again, and the counter has already had you.
--     That is a count of *readers*, and the word on the page is views.
--  2. A signed-out reader counted nothing at all. On a forum built to be
--     readable by anybody without an account, that is most of the traffic
--     being thrown away.
--
-- So: once per account per day, and signed-out readings count.
--
-- **What this gives up, said plainly.** A signed-out reading cannot be
-- deduplicated here. There is no account to key on, and the things that
-- would serve instead - an address, a fingerprint - are exactly what 0275
-- refused to keep, and it was right to. The website keeps a random token in
-- the browser and asks once a day per topic, which stops an honest refresh
-- counting twice and does not stop anybody who wants to sit on the call.
-- That is a client-side rule, which this project's own line says is not a
-- rule. It is accepted here and nowhere else, because the thing being
-- guarded is a vanity counter on a public page rather than anything
-- anybody owns, spends or is judged by. Nothing is ranked by it that a
-- person cannot already see for themselves.
--
-- If a view ever decides something - payouts, a staff queue, "most read"
-- deciding what gets built - this stops being good enough and the
-- signed-out half has to go back out.

set search_path = public, extensions;

-- -------------------------------------------------- once a day, not once

/*
 * The key grows a day.
 *
 * Done in pieces rather than by recreating the table. Nothing reads these
 * rows back today - they are the counter's memory and nothing else - but
 * dropping them would let every account that has already been counted be
 * counted again, which is a one-off jump in every number on the forum for
 * no reason at all.
 *
 * `current_date` is the server's day in UTC. A reading at ten to midnight
 * and one at ten past are two days apart to this and ten minutes apart to
 * the person; that is wrong by a reading a day at most, and the alternative
 * is keeping everybody's timezone to count a number on a card.
 */
alter table public.forum_topic_views
  add column if not exists seen_on date not null default current_date;

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.forum_topic_views'::regclass
       and contype = 'p'
       and array_length(conkey, 1) = 2
  ) then
    alter table public.forum_topic_views
      drop constraint forum_topic_views_pkey;
    alter table public.forum_topic_views
      add constraint forum_topic_views_pkey primary key (topic_id, user_id, seen_on);
  end if;
end $$;

/*
 * Reading `seen_at` to find out whether you have been here is now a read of
 * the newest of several rows rather than of the only one, so anything
 * asking needs an index that makes "the newest of mine" cheap.
 */
create index if not exists forum_topic_views_recent
  on public.forum_topic_views (user_id, topic_id, seen_on desc);

-- --------------------------------------------------------- counting one

/**
 * Having read it.
 *
 * Signed in: once per account per day. The insert is still the counter -
 * the key refuses the second reading of the same day and `row_count` is how
 * we know - so nothing is counted twice by a page that mounts twice.
 *
 * Signed out: counted, and not written down. There is no row because there
 * is nobody to write a row about, which means this cannot refuse a second
 * call; the website asks once per topic per day per browser and that is the
 * whole of the protection. See the note at the top of this file for why
 * that is accepted here.
 *
 * What is still true from 0275: a guest *account* - somebody playing
 * without signing up - is signed in as far as this is concerned and counts
 * like anybody else. The dedup is by account, and they have one.
 */
create or replace function public.forum_seen(in_topic bigint)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare written integer := 0;
begin
  if auth.uid() is null then
    /* Nobody to key on. Count the reading and keep nothing about who. */
    update public.forum_topics set view_count = view_count + 1 where id = in_topic;
    return;
  end if;

  insert into public.forum_topic_views (topic_id, user_id, seen_on)
  values (in_topic, auth.uid(), current_date)
  on conflict do nothing;

  /* `row_count` is an integer. A boolean here is a type error at run time,
     which on a counter nobody watches is a page that breaks on its view. */
  get diagnostics written = row_count;
  if written > 0 then
    update public.forum_topics set view_count = view_count + 1 where id = in_topic;
  end if;
end $$;

grant execute on function public.forum_seen to anon, authenticated;

commit;
