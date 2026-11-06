begin;

/*
 * The forum tag, beside the name on every post.
 *
 * Staw: "i want the tag that we set in the forum profile to be visible next
 * to your name in posts too". It was only ever on the profile page, which
 * means the one place nobody is standing when they read a thread.
 *
 * Five functions return an author and all five now return the tag with it.
 * They are dropped and recreated rather than replaced because
 * `create or replace function` will not change a return table - the same
 * note 0281 left on `forum_boards`, and the same reason.
 *
 * What is returned is the **label**, not the code: the code is a key and
 * the label is the word, and a page that has to look up seventeen labels to
 * draw twenty names would be asking the database twice for one answer.
 *
 * The automatic `staff` tag is deliberately **not** what this returns. Staff
 * already wear the k beside their name through `name_marks`, everywhere,
 * and a "Staff" chip next to it is the same fact said twice in one line.
 * This is the tag somebody chose.
 */

set search_path = public, extensions;

-- ------------------------------------------------------- the one lookup

/**
 * The word somebody chose for themselves on the forum, or null.
 *
 * One function so the join is written once. `security definer` for the same
 * reason its callers are: a signed-out reader may read a thread, and a
 * thread has authors.
 */
create or replace function public.forum_tag_label(in_user uuid)
returns text
language sql stable security definer
set search_path = public, extensions as $$
  select g.label
    from public.forum_profiles f
    join public.forum_tags g on g.code = f.tag
   where f.user_id = in_user;
$$;

grant execute on function public.forum_tag_label(uuid) to anon, authenticated;

-- ------------------------------------------------------------ the lists

drop function if exists public.forum_topics_list(text, text, integer, integer, boolean);

create function public.forum_topics_list(
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
  author_tag text,
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
         public.forum_tag_label(p.id),
         exists (
           select 1 from public.forum_likes l
            where l.target_type = 'topic' and l.target_id = t.id
              and l.user_id = auth.uid()
         )
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
    join public.profiles p on p.id = t.author_id
   where not t.is_removed
     and not c.is_hidden
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

-- ----------------------------------------------------------- one thread

drop function if exists public.forum_topic(bigint);

create function public.forum_topic(in_id bigint)
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
  author_tag text,
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
         public.forum_tag_label(p.id),
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

-- --------------------------------------------------------- the replies

drop function if exists public.forum_replies(bigint, integer, integer);

create function public.forum_replies(
  in_topic bigint, in_limit integer default 50, in_offset integer default 0
)
returns table (
  id bigint, topic_id bigint, body text, images text[],
  reply_to bigint, reply_to_name text,
  is_removed boolean, like_count integer, created_at timestamptz, edited_at timestamptz,
  is_answer boolean,
  author_id uuid, author_username text, author_name text, author_avatar text,
  author_is_verified boolean, author_is_admin boolean, author_is_moderator boolean,
  author_tag text,
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
         public.forum_tag_label(p.id),
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

-- ---------------------------------------------------------- the search

drop function if exists public.forum_search(text, text, integer, integer);

create function public.forum_search(
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
  author_tag text,
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
         public.forum_tag_label(p.id),
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

-- ------------------------------------------------------- the staff list

drop function if exists public.forum_staff_topics(text, text, integer, integer);

create function public.forum_staff_topics(
  in_which text default 'all',
  in_category text default null,
  in_limit integer default 60,
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
  author_tag text,
  liked boolean
)
language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  return query
  select t.id, t.category, c.name,
         t.title, t.body, t.images,
         t.status, t.is_pinned, t.is_locked, t.is_removed,
         t.view_count, t.reply_count, t.like_count,
         t.answer_id, t.last_post_at, t.created_at,
         p.id, p.username, coalesce(p.display_name, p.username), p.avatar_url,
         coalesce(p.is_verified, false), coalesce(p.is_admin, false),
         coalesce(p.is_moderator, false),
         public.forum_tag_label(p.id),
         false
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
    join public.profiles p on p.id = t.author_id
   where (in_category is null or t.category = in_category)
     and case in_which
           when 'removed' then t.is_removed
           when 'locked' then t.is_locked and not t.is_removed
           when 'pinned' then t.is_pinned and not t.is_removed
           when 'live' then not t.is_removed
           else true
         end
   order by t.created_at desc
   limit least(greatest(coalesce(in_limit, 60), 1), 200)
  offset greatest(coalesce(in_offset, 0), 0);
end $$;

grant execute on function public.forum_staff_topics(text, text, integer, integer)
  to authenticated;

commit;
