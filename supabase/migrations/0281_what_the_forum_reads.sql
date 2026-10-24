begin;

-- What the forum reads, said properly
-- -----------------------------------------------------------------------
--
-- Three things, all on the reading side.
--
-- One: a name with no display name came back empty. `display_name` is
-- nullable and every forum function selected it raw, so an account that
-- never set one appeared on a board as an avatar, a gap, and a time. Staw
-- asked for the marks beside "the displayname (if no displayname then
-- username)" - the fallback is the first half of that sentence and it was
-- not there.
--
-- Two: the latest-post column on the front page has a name and now has the
-- username under it, so the marks beside that name can be asked for. It is
-- the one place on the forum a name is written and no id is in hand.
--
-- Three: related topics, which the topic page has nowhere to get. Scored
-- by the words two titles share rather than by a text-search extension
-- this database does not have - which is a smaller promise, and one that
-- can be read and checked by anybody looking at the function.

set search_path = public, extensions;

/*
 * Dropped rather than replaced: `forum_boards` gains a column and
 * `create or replace function` will not change a return table.
 */
drop function if exists public.forum_boards();

create function public.forum_boards()
returns table (
  slug text, name text, blurb text, kind text, staff_only boolean,
  topic_count integer, post_count integer, last_post_at timestamptz,
  last_title text, last_topic_id bigint,
  last_author text, last_author_avatar text, last_author_username text
)
language sql stable security definer
set search_path = public, extensions as $$
  select c.slug, c.name, c.blurb, c.kind, c.staff_only,
         coalesce(n.topics, 0)::integer,
         coalesce(n.posts, 0)::integer,
         n.last_at, n.last_title, n.last_id,
         n.last_author, n.last_avatar, n.last_username
    from public.forum_categories c
    left join lateral (
      select count(*)::integer as topics,
             (coalesce(sum(t.reply_count), 0) + count(*))::integer as posts,
             max(t.last_post_at) as last_at,
             (array_agg(t.title order by t.last_post_at desc))[1] as last_title,
             (array_agg(t.id order by t.last_post_at desc))[1] as last_id,
             (array_agg(coalesce(p.display_name, p.username) order by t.last_post_at desc))[1] as last_author,
             (array_agg(p.avatar_url order by t.last_post_at desc))[1] as last_avatar,
             (array_agg(p.username order by t.last_post_at desc))[1] as last_username
        from public.forum_topics t
        join public.profiles p on p.id = t.author_id
       where t.category = c.slug and not t.is_removed
    ) n on true
   where not c.is_hidden
   order by c.position, c.name;
$$;

grant execute on function public.forum_boards to anon, authenticated;

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
   where not t.is_removed
     and (in_category is null or t.category = in_category)
     and (not in_unanswered or t.reply_count = 0)
   order by
     /* Pinned first, but only on a board: a pinned topic floating to the
        top of a mixed feed is an announcement nobody asked to see again. */
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

create or replace function public.forum_topic(in_id bigint)
returns table (
  id bigint, category text, category_name text, category_kind text,
  title text, body text, images text[],
  status text, status_at timestamptz, status_by_name text,
  is_pinned boolean, is_locked boolean, is_removed boolean,
  view_count integer, reply_count integer, like_count integer,
  answer_id bigint, last_post_at timestamptz, created_at timestamptz,
  edited_at timestamptz,
  author_id uuid, author_username text, author_name text, author_avatar text,
  author_is_verified boolean, author_is_admin boolean, author_is_moderator boolean,
  liked boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  select t.id, t.category, c.name, c.kind,
         t.title, t.body, t.images,
         t.status, t.status_at, s.display_name,
         t.is_pinned, t.is_locked, t.is_removed,
         t.view_count, t.reply_count, t.like_count,
         t.answer_id, t.last_post_at, t.created_at, t.edited_at,
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
    left join public.profiles s on s.id = t.status_by
   where t.id = in_id
     and (not t.is_removed or t.author_id = auth.uid() or public.is_moderator());
$$;

grant execute on function public.forum_topic to anon, authenticated;

create or replace function public.forum_replies(
  in_topic bigint, in_limit integer default 50, in_offset integer default 0
)
returns table (
  id bigint, topic_id bigint, body text, images text[],
  reply_to bigint, reply_to_name text,
  is_removed boolean, like_count integer, created_at timestamptz, edited_at timestamptz,
  is_answer boolean,
  author_id uuid, author_username text, author_name text, author_avatar text,
  author_is_verified boolean, author_is_admin boolean, author_is_moderator boolean,
  liked boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  select r.id, r.topic_id, r.body, r.images,
         r.reply_to, coalesce(q.display_name, q.username),
         r.is_removed, r.like_count, r.created_at, r.edited_at,
         (t.answer_id = r.id),
         p.id, p.username, coalesce(p.display_name, p.username), p.avatar_url,
         coalesce(p.is_verified, false), coalesce(p.is_admin, false),
         coalesce(p.is_moderator, false),
         exists (
           select 1 from public.forum_likes l
            where l.target_type = 'post' and l.target_id = r.id
              and l.user_id = auth.uid()
         )
    from public.forum_posts r
    join public.forum_topics t on t.id = r.topic_id
    join public.profiles p on p.id = r.author_id
    left join public.forum_posts o on o.id = r.reply_to
    left join public.profiles q on q.id = o.author_id
   where r.topic_id = in_topic
     and (not r.is_removed or r.author_id = auth.uid() or public.is_moderator())
   order by (t.answer_id = r.id) desc, r.created_at
   limit greatest(1, least(coalesce(in_limit, 50), 100))
  offset greatest(0, coalesce(in_offset, 0));
$$;

grant execute on function public.forum_replies to anon, authenticated;

-- ------------------------------------------------------- related topics

/**
 * The words in a title worth matching on.
 *
 * Lowercased, stripped of everything that is not a letter or a number,
 * and short words thrown away. Four characters is the line: it drops "the",
 * "and", "my", "it" and the rest without needing a stopword list to keep
 * up with, and it keeps "door", "mesh", "lift".
 */
create or replace function public.title_words(said text)
returns text[]
language sql immutable
set search_path = public, extensions as $$
  select coalesce(array_agg(distinct w), '{}')
    from unnest(
      regexp_split_to_array(
        lower(regexp_replace(coalesce(said, ''), '[^a-zA-Z0-9]+', ' ', 'g')),
        '\s+'
      )
    ) w
   where length(w) >= 4;
$$;

/**
 * What else to read after this one.
 *
 * Ranked by how many words the titles share, then by whether it is the
 * same board, then by what has been read most. A topic sharing nothing is
 * not related and does not appear at all - which means a thread with an
 * unusual title gets a short list or none, and that is the honest answer
 * rather than six strangers under a heading that says Related.
 */
create or replace function public.forum_related(in_topic bigint, in_limit integer default 5)
returns table (
  id bigint, category text, category_name text, title text,
  reply_count integer, view_count integer, like_count integer,
  last_post_at timestamptz, shared integer
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (
    select t.id, t.category, public.title_words(t.title) as words
      from public.forum_topics t
     where t.id = in_topic
  )
  select t.id, t.category, c.name, t.title,
         t.reply_count, t.view_count, t.like_count, t.last_post_at,
         cardinality(array(
           select unnest(public.title_words(t.title))
           intersect
           select unnest(me.words)
         ))::integer as shared
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
    cross join me
   where t.id <> me.id
     and not t.is_removed
     and not c.is_hidden
     and cardinality(array(
           select unnest(public.title_words(t.title))
           intersect
           select unnest(me.words)
         )) > 0
   order by shared desc, (t.category = me.category) desc, t.view_count desc
   limit greatest(1, least(coalesce(in_limit, 5), 10));
$$;

grant execute on function public.title_words(text) to anon, authenticated;
grant execute on function public.forum_related(bigint, integer) to anon, authenticated;

commit;
