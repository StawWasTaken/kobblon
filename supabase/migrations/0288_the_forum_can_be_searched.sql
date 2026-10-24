begin;

-- The forum can be searched
-- -----------------------------------------------------------------------
--
-- It could not, at all. Four hundred topics, six boards, and the only ways
-- to find a thread were to scroll a board or to already have the link - so
-- every question that had been answered got asked again, which is the one
-- failure mode a forum exists to avoid.
--
-- Postgres's own full-text search, with no extension. `to_tsvector` and
-- `websearch_to_tsquery` are core; `pg_trgm` is not, and is not installed
-- here. That decides the shape of this: it matches **words**, not
-- fragments, so "scrip" finds nothing and "scripting" finds "scripts".
-- Said out loud because it is the first thing somebody will report as a
-- bug, and the fix for it is an extension Staw has to enable rather than
-- anything in this file.
--
-- The title counts for more than the body. `setweight` A over B, which at
-- the sizes this forum will see for a long time is the whole of the
-- ranking that matters: a thread *called* "my door will not open" is the
-- answer to "door will not open", and one that mentions a door in its
-- fourteenth paragraph is not.
--
-- What is deliberately not searched: replies. A board's worth of replies
-- is ten times its topics and the thing somebody wants is the thread, so
-- a hit on a reply would mostly be a second route to a topic already in
-- the list. It is a real limitation and it belongs in the round, not
-- hidden here.

set search_path = public, extensions;

-- ------------------------------------------------------------ the index

/*
 * The document a topic is, as an expression index.
 *
 * An expression rather than a stored column, because a column means a
 * trigger to keep it fresh and a trigger on this table already does two
 * other jobs. The expression is immutable - `to_tsvector` is, *given an
 * explicit configuration*, which is why 'english' is written out rather
 * than left to `default_text_search_config`. Left to the default it is
 * only stable and Postgres refuses to index it.
 */
create index if not exists forum_topics_text on public.forum_topics
  using gin ((
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ));

-- ----------------------------------------------------------- the asking

/**
 * Topics matching some words, best first.
 *
 * Shaped like `forum_topics_list` on purpose - the same columns in the
 * same order - so the page draws a result with the row it already has
 * rather than a second kind of row that drifts from the first.
 *
 * `websearch_to_tsquery` rather than `plainto_tsquery`: it takes what
 * people actually type into a search box, quotes and `or` and a leading
 * minus included, and it does not throw on punctuation. `plainto_` would
 * turn `"door won't open"` into something that finds nothing and
 * `to_tsquery` would raise a syntax error at somebody typing an
 * apostrophe.
 *
 * Nothing hidden comes back: a removed topic, and a board somebody cannot
 * see, are both filtered here rather than left to the page. A search that
 * returns a title from the staff room has leaked the title.
 */
create or replace function public.forum_search(
  in_terms text,
  in_category text default null,
  in_limit integer default 20,
  in_offset integer default 0
)
returns table (
  id bigint, category text, category_name text,
  title text, body text, images text[],
  status text, is_pinned boolean, is_locked boolean, is_removed boolean,
  view_count integer, reply_count integer, like_count integer,
  answer_id bigint, last_post_at timestamptz, created_at timestamptz,
  author_id uuid, author_username text, author_name text, author_avatar text,
  author_is_verified boolean, author_is_admin boolean, author_is_moderator boolean,
  liked boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  with asked as (
    select websearch_to_tsquery('english', coalesce(in_terms, '')) as q
  )
  select t.id, t.category, c.name,
         t.title, t.body, t.images,
         t.status, t.is_pinned, t.is_locked, t.is_removed,
         t.view_count, t.reply_count, t.like_count,
         t.answer_id, t.last_post_at, t.created_at,
         p.id, p.username, coalesce(p.display_name, p.username), p.avatar_url,
         coalesce(p.is_verified, false), coalesce(p.is_admin, false),
         coalesce(p.is_moderator, false),
         exists (
           select 1 from public.forum_likes l
            where l.target_type = 'topic' and l.target_id = t.id
              and l.user_id = auth.uid()
         )
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
    join public.profiles p on p.id = t.author_id
    cross join asked
   where not t.is_removed
     and not c.is_hidden
     and asked.q is not null
     and numnode(asked.q) > 0
     and (in_category is null or t.category = in_category)
     and (
       setweight(to_tsvector('english', coalesce(t.title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(t.body, '')), 'B')
     ) @@ asked.q
   order by
     ts_rank(
       setweight(to_tsvector('english', coalesce(t.title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(t.body, '')), 'B'),
       asked.q
     ) desc,
     t.last_post_at desc
   limit greatest(1, least(coalesce(in_limit, 20), 50))
  offset greatest(0, coalesce(in_offset, 0));
$$;

grant execute on function public.forum_search to anon, authenticated;

commit;
