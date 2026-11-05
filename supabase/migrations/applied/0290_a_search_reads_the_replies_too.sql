begin;

-- A search reads the replies too, and a board knows how long it is
-- -----------------------------------------------------------------------
--
-- Two things 0288 left undone and said so.
--
-- **The replies.** 0288 read titles and first posts only, which on this
-- forum is about a tenth of the words written. The answer to "how do I open
-- a door on touch" is almost never in the title of the thread that holds
-- it; it is four replies down, written by somebody who knew. A search that
-- cannot see that is a search that sends people to ask the question again.
--
-- **The count.** The pager says Newer and Older and nothing else, because
-- nothing counted how many topics a board has. It is one `count(*)` over an
-- indexed column and it was never written. So it is written here, and the
-- page can say "Page 3 of 9" instead of guessing.
--
-- And one thing neither of them: `forum_topics_list` never filtered hidden
-- boards. `forum_search` did from the day it was written, which is the
-- worse half of the pair - a hidden board's topic could not be found by
-- searching for it and was sitting in the Latest feed on the front page.
-- Fixed here, so the two agree.

set search_path = public, extensions;

-- ------------------------------------------------------ the replies, too

/*
 * A reply, as a document.
 *
 * Unweighted, unlike a topic's: a reply has no title, and `setweight` with
 * nothing to contrast it against is a cast that does nothing. The ranking
 * that matters is topic-over-reply, and that is decided below rather than
 * inside the vector.
 */
create index if not exists forum_posts_text on public.forum_posts
  using gin (to_tsvector('english', coalesce(body, '')));

/**
 * Topics matching some words, best first, now reading the replies.
 *
 * A topic comes back when its own title or body matches, **or** when any
 * reply still standing in it does. One row per topic either way - the
 * reply is a route to the thread, not a result of its own, and a thread
 * that answers somebody three times should not take three rows away from
 * everything else.
 *
 * What it costs: the reply half is an `exists`, so Postgres stops at the
 * first match in a thread rather than ranking every reply in it. That is
 * deliberate. Ranking by the best reply would mean reading them all, on
 * every topic, on every search, to decide an order that differs from this
 * one about one time in twenty.
 *
 * The order: a hit in the title first, then in the body, then a thread
 * whose answer is in a reply, then the most recently spoken-in. A thread
 * *called* "my door will not open" is the answer to "door will not open",
 * and the one where somebody mentioned a door in a reply is not.
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
       (
         setweight(to_tsvector('english', coalesce(t.title, '')), 'A') ||
         setweight(to_tsvector('english', coalesce(t.body, '')), 'B')
       ) @@ asked.q
       or exists (
         select 1 from public.forum_posts r
          where r.topic_id = t.id
            and not r.is_removed
            and to_tsvector('english', coalesce(r.body, '')) @@ asked.q
       )
     )
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

-- --------------------------------------------------------- how many there are

/**
 * How many topics a search finds.
 *
 * The same `where` as above and none of the join, because a count does not
 * need the author or whether you liked it. Kept as a second function
 * rather than a column on the first: a count returned on every row is the
 * same number copied twenty-five times, and a window function to produce
 * it makes Postgres read the whole match set to return a page of it.
 */
create or replace function public.forum_search_count(
  in_terms text, in_category text default null
)
returns integer
language sql stable security definer
set search_path = public, extensions as $$
  with asked as (
    select websearch_to_tsquery('english', coalesce(in_terms, '')) as q
  )
  select count(*)::integer
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
    cross join asked
   where not t.is_removed
     and not c.is_hidden
     and asked.q is not null
     and numnode(asked.q) > 0
     and (in_category is null or t.category = in_category)
     and (
       (
         setweight(to_tsvector('english', coalesce(t.title, '')), 'A') ||
         setweight(to_tsvector('english', coalesce(t.body, '')), 'B')
       ) @@ asked.q
       or exists (
         select 1 from public.forum_posts r
          where r.topic_id = t.id
            and not r.is_removed
            and to_tsvector('english', coalesce(r.body, '')) @@ asked.q
       )
     );
$$;

grant execute on function public.forum_search_count to anon, authenticated;

/** How many topics a board holds, under the same filter the list uses. */
create or replace function public.forum_topics_count(
  in_category text default null,
  in_unanswered boolean default false
)
returns integer
language sql stable security definer
set search_path = public, extensions as $$
  select count(*)::integer
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
   where not t.is_removed
     and not c.is_hidden
     and (in_category is null or t.category = in_category)
     and (not in_unanswered or t.reply_count = 0);
$$;

grant execute on function public.forum_topics_count to anon, authenticated;

-- ----------------------------------------- the list agrees with the search

/*
 * The same body as 0276's, with `not c.is_hidden` added and nothing else
 * touched. Written out whole because a function body cannot be edited in
 * place; the only difference is the one line, and it is marked.
 */
create or replace function public.forum_topics_list(
  in_category text default null,
  in_sort text default 'active',
  in_limit integer default 20,
  in_offset integer default 0,
  in_unanswered boolean default false
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
  select t.id, t.category, c.name,
         t.title, t.body, t.images,
         t.status, t.is_pinned, t.is_locked, t.is_removed,
         t.view_count, t.reply_count, t.like_count,
         t.answer_id, t.last_post_at, t.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
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
   where not t.is_removed
     and not c.is_hidden            -- the one line this migration adds
     and (in_category is null or t.category = in_category)
     and (not in_unanswered or t.reply_count = 0)
   order by
     (in_category is not null and t.is_pinned) desc,
     case when in_sort = 'new' then t.created_at end desc nulls last,
     case when in_sort = 'helpful' then t.like_count end desc nulls last,
     case when in_sort = 'viewed' then t.view_count end desc nulls last,
     case when in_sort = 'interesting'
          then (t.like_count * 3 + t.reply_count * 2 + t.view_count)
          end desc nulls last,
     t.last_post_at desc
   limit greatest(1, least(coalesce(in_limit, 20), 50))
  offset greatest(0, coalesce(in_offset, 0));
$$;

grant execute on function public.forum_topics_list to anon, authenticated;

commit;
