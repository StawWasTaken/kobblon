begin;

/*
 * The forum's verbs, and the screening that runs over everything written
 * into it.
 *
 * Separate from 0275 because that file creates the tables and this one
 * writes over them: a function that mentions a table the same transaction
 * created is fine, but keeping the shape and the behaviour apart is what
 * makes either of them readable six months from now.
 *
 * Every parameter here is named `in_something`. Not a style: `react` cost
 * an afternoon to "column reference target_type is ambiguous", because
 * Postgres cannot tell a parameter from a column of the same name inside a
 * statement that touches both.
 */

-- ------------------------------------------- somewhere for a bell to lead

/*
 * A notification has never had anywhere of its own to go: the panel works
 * out the address from the friend, the World or the Space on the row. A
 * forum reply is none of those, so rather than hanging a `topic_id` on the
 * table for one kind, the row carries the address it leads to.
 *
 * Null for every notification that already exists, and the panel falls
 * back to what it has always done when it is.
 */
alter table public.notifications add column if not exists link text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind = any (array[
    'friend_request', 'friend_accepted',
    'best_friend_request', 'best_friend_accepted',
    'space_like', 'space_visit', 'message', 'system',
    'event_started', 'world_updated', 'content_removed',
    'forum_reply'
  ]));

-- ------------------------------------------------------------- screening

/*
 * The same censor that runs over chat and Community posts runs over a
 * forum topic and a forum reply. Nothing said on Kobblon goes unscreened,
 * and a forum is the one place on the platform where a stranger reads what
 * somebody wrote with no conversation around it to judge it by.
 */
create or replace function public.forum_words_are_censored()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  new.body := public.censor_text(new.body, 'say');
  if tg_table_name = 'forum_topics' then
    new.title := public.censor_text(new.title, 'say');
  end if;
  return new;
end $$;

drop trigger if exists forum_topics_are_censored on public.forum_topics;
create trigger forum_topics_are_censored
  before insert or update of body, title on public.forum_topics
  for each row execute function public.forum_words_are_censored();

drop trigger if exists forum_posts_are_censored on public.forum_posts;
create trigger forum_posts_are_censored
  before insert or update of body on public.forum_posts
  for each row execute function public.forum_words_are_censored();

/*
 * And then the machine reads it, the same queue every other written thing
 * on the platform goes into. Two new kinds on `chat_to_read`, which is a
 * check constraint rather than an enum, so widening it here is safe - an
 * enum value could not be added and used in one transaction.
 */
alter table public.chat_to_read drop constraint if exists chat_to_read_kind_check;
alter table public.chat_to_read add constraint chat_to_read_kind_check
  check (kind in ('message', 'space_message', 'community_post', 'voice',
                  'forum_topic', 'forum_post'));

create or replace function public.queue_for_the_machine()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  author uuid;
  kind text;
  said text;
begin
  /*
   * Separate branches rather than one `case` across the lot - 0191, and
   * the reason it exists: plpgsql evaluates the whole expression against
   * the record it actually has, so a branch naming a column another table
   * does not have takes the insert down with it.
   */
  if tg_table_name = 'community_posts' then
    kind := 'community_post';
    author := new.author_id;
    said := new.body;
  elsif tg_table_name = 'space_messages' then
    kind := 'space_message';
    author := new.sender_id;
    said := new.body;
  elsif tg_table_name = 'messages' then
    kind := 'message';
    author := new.sender_id;
    said := new.body;
  elsif tg_table_name = 'forum_topics' then
    kind := 'forum_topic';
    author := new.author_id;
    /* The title is read with the body: a clean post under a title nobody
       would say out loud is still the title being on a public board. */
    said := new.title || E'\n\n' || new.body;
  elsif tg_table_name = 'forum_posts' then
    kind := 'forum_post';
    author := new.author_id;
    said := new.body;
  else
    return null;
  end if;

  insert into public.chat_to_read (kind, ref, who, body, was_masked)
  values (kind, new.id::text, author, said, said like '%••••%');

  return null;
end $$;

drop trigger if exists forum_topics_go_to_the_machine on public.forum_topics;
create trigger forum_topics_go_to_the_machine
  after insert on public.forum_topics
  for each row execute function public.queue_for_the_machine();

drop trigger if exists forum_posts_go_to_the_machine on public.forum_posts;
create trigger forum_posts_go_to_the_machine
  after insert on public.forum_posts
  for each row execute function public.queue_for_the_machine();

/* And a verdict can strike out what was said, as it can anywhere else. */
create or replace function public.hide_what_was_said(kind text, ref text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
begin
  if ref is null or ref = '' then return; end if;
  if ref !~ '^[0-9]+$' then return; end if;

  if kind = 'message' then
    update public.messages m
       set body = regexp_replace(m.body, '\S+', '••••', 'g')
     where m.id = ref::bigint;
  elsif kind = 'space_message' then
    update public.space_messages m
       set body = regexp_replace(m.body, '\S+', '••••', 'g')
     where m.id = ref::bigint;
  elsif kind = 'community_post' then
    update public.community_posts p
       set body = regexp_replace(p.body, '\S+', '••••', 'g')
     where p.id = ref::bigint;
  elsif kind = 'forum_topic' then
    /*
     * A topic comes off the board rather than standing there starred out.
     * A reply can be struck in place because the thread around it still
     * reads; a topic struck in place is a board entry with a title of
     * dots that everybody still opens.
     */
    update public.forum_topics t
       set is_removed = true,
           body = regexp_replace(t.body, '\S+', '••••', 'g')
     where t.id = ref::bigint;
  elsif kind = 'forum_post' then
    update public.forum_posts p
       set body = regexp_replace(p.body, '\S+', '••••', 'g')
     where p.id = ref::bigint;
  end if;

  -- 'voice' falls through on purpose: nothing on a screen to strike.
end $$;

-- ----------------------------------------------------------- may I write

/*
 * One guard, raised in one place, so the sentence somebody reads is the
 * same whichever of the five writing functions they were in.
 */
create or replace function public.forum_may_write()
returns void language plpgsql stable security definer
set search_path = public, extensions as $$
declare me record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to post on the forum.';
  end if;
  /*
   * `not found`, not `me is null`. A record variable filled by `select
   * into` is never null when no row came back - its fields are, but the
   * record itself tests as a row of nulls, so `if me is null` is a guard
   * that can never fire.
   */
  select is_guest, is_suspended into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Sign in to post on the forum.'; end if;
  if me.is_guest then
    raise exception 'A guest account cannot post on the forum. Make an account first.';
  end if;
  if me.is_suspended then
    raise exception 'Your account is suspended, so you cannot post on the forum.';
  end if;
end $$;

grant execute on function public.forum_may_write to authenticated;

-- ---------------------------------------------------------------- boards

/*
 * The categories, each with what is actually going on in it. Counted here
 * rather than kept on the row: there are six of them and this runs once a
 * page, which is the case where a count is cheaper than a column somebody
 * has to remember to keep right.
 */
create or replace function public.forum_boards()
returns table (
  slug text, name text, blurb text, kind text, staff_only boolean,
  topic_count integer, post_count integer, last_post_at timestamptz,
  last_title text, last_topic_id bigint,
  last_author text, last_author_avatar text
)
language sql stable security definer
set search_path = public, extensions as $$
  select c.slug, c.name, c.blurb, c.kind, c.staff_only,
         coalesce(n.topics, 0)::integer,
         coalesce(n.posts, 0)::integer,
         n.last_at, n.last_title, n.last_id,
         n.last_author, n.last_avatar
    from public.forum_categories c
    left join lateral (
      select count(*)::integer as topics,
             (coalesce(sum(t.reply_count), 0) + count(*))::integer as posts,
             max(t.last_post_at) as last_at,
             (array_agg(t.title order by t.last_post_at desc))[1] as last_title,
             (array_agg(t.id order by t.last_post_at desc))[1] as last_id,
             (array_agg(p.display_name order by t.last_post_at desc))[1] as last_author,
             (array_agg(p.avatar_url order by t.last_post_at desc))[1] as last_avatar
        from public.forum_topics t
        join public.profiles p on p.id = t.author_id
       where t.category = c.slug and not t.is_removed
    ) n on true
   where not c.is_hidden
   order by c.position, c.name;
$$;

grant execute on function public.forum_boards to anon, authenticated;

-- ---------------------------------------------------------------- topics

/*
 * A board, or the whole forum when `in_category` is null.
 *
 * `in_sort` is what the tabs across the top of a board are: what moved
 * last, what was opened last, what people found helpful, and what has been
 * read most. The feed on the front page is this same function - a second
 * query shaped almost like this one is how two lists of "the best posts"
 * end up disagreeing.
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

/** One topic, with everything the page needs to draw its head. */
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
    left join public.profiles s on s.id = t.status_by
   where t.id = in_id
     and (not t.is_removed or t.author_id = auth.uid() or public.is_moderator());
$$;

grant execute on function public.forum_topic to anon, authenticated;

/** The replies, oldest first, which is how a thread is read. */
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
         r.reply_to, q.display_name,
         r.is_removed, r.like_count, r.created_at, r.edited_at,
         (t.answer_id = r.id),
         p.id, p.username, p.display_name, p.avatar_url,
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

-- --------------------------------------------------------------- writing

/**
 * Opening a topic.
 *
 * The category decides whether this person may: `staff_only` is how
 * Announcements is a board everybody reads and nobody else writes to.
 */
create or replace function public.forum_topic_create(
  in_category text, in_title text, in_body text, in_images text[] default '{}'
)
returns bigint language plpgsql security definer
set search_path = public, extensions as $$
declare
  board record;
  made bigint;
  recently integer;
begin
  perform public.forum_may_write();

  select * into board from public.forum_categories
   where slug = in_category and not is_hidden;
  if not found then raise exception 'There is no such category.'; end if;

  if board.staff_only and not public.is_moderator() then
    raise exception 'Only Kobblon staff open topics in %.', board.name;
  end if;

  if coalesce(array_length(in_images, 1), 0) > 4 then
    raise exception 'Four pictures at most.';
  end if;

  /*
   * A hand on the brake rather than a rate limiter: five topics in an hour
   * from one account is not somebody with five questions.
   */
  select count(*)::integer into recently from public.forum_topics
   where author_id = auth.uid() and created_at > now() - interval '1 hour';
  if recently >= 5 and not public.is_moderator() then
    raise exception 'That is five topics in an hour. Give it a little while.';
  end if;

  insert into public.forum_topics (category, author_id, title, body, images)
  values (in_category, auth.uid(), in_title, in_body, coalesce(in_images, '{}'))
  returning id into made;

  return made;
end $$;

grant execute on function public.forum_topic_create to authenticated;

/** Replying. The count and the time on the topic move in the same statement. */
create or replace function public.forum_reply(
  in_topic bigint, in_body text, in_images text[] default '{}',
  in_reply_to bigint default null
)
returns bigint language plpgsql security definer
set search_path = public, extensions as $$
declare
  topic record;
  made bigint;
begin
  perform public.forum_may_write();

  select * into topic from public.forum_topics where id = in_topic;
  if not found or topic.is_removed then
    raise exception 'That topic is not here any more.';
  end if;
  if topic.is_locked and not public.is_moderator() then
    raise exception 'That topic is closed to replies.';
  end if;
  if coalesce(array_length(in_images, 1), 0) > 4 then
    raise exception 'Four pictures at most.';
  end if;

  /* A reply can only answer a reply in the same thread. */
  if in_reply_to is not null and not exists (
    select 1 from public.forum_posts where id = in_reply_to and topic_id = in_topic
  ) then
    in_reply_to := null;
  end if;

  insert into public.forum_posts (topic_id, author_id, body, images, reply_to)
  values (in_topic, auth.uid(), in_body, coalesce(in_images, '{}'), in_reply_to)
  returning id into made;

  update public.forum_topics
     set reply_count = reply_count + 1, last_post_at = now()
   where id = in_topic;

  /* Somebody answered you. Not for your own reply in your own topic. */
  if topic.author_id <> auth.uid() then
    insert into public.notifications (user_id, kind, actor_id, body, link)
    values (topic.author_id, 'forum_reply', auth.uid(),
            'replied to "' || left(topic.title, 60) || '"',
            '/forum/t/' || in_topic::text);
  end if;

  return made;
end $$;

grant execute on function public.forum_reply to authenticated;

/** Editing your own words. Staff may edit nobody's; they take things down. */
create or replace function public.forum_edit(
  in_what text, in_id bigint, in_body text, in_title text default null
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  perform public.forum_may_write();

  if in_what = 'topic' then
    update public.forum_topics
       set body = in_body,
           title = coalesce(in_title, title),
           edited_at = now()
     where id = in_id and author_id = auth.uid() and not is_removed;
    if not found then raise exception 'That is not yours to edit.'; end if;
  elsif in_what = 'post' then
    update public.forum_posts
       set body = in_body, edited_at = now()
     where id = in_id and author_id = auth.uid() and not is_removed;
    if not found then raise exception 'That is not yours to edit.'; end if;
  else
    raise exception 'You can edit a topic or a post.';
  end if;
end $$;

grant execute on function public.forum_edit to authenticated;

/**
 * Taking something down: the author deleting their own, or staff removing
 * it. Both are the same flag, because a thread with a hole in it reads
 * better than a thread that renumbers itself.
 */
create or replace function public.forum_remove(in_what text, in_id bigint)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare owner uuid; topic bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  if in_what = 'topic' then
    select author_id into owner from public.forum_topics where id = in_id;
    if owner is null then raise exception 'There is no such topic.'; end if;
    if owner <> auth.uid() and not public.is_moderator() then
      raise exception 'That is not yours to take down.';
    end if;
    update public.forum_topics set is_removed = true where id = in_id;
  elsif in_what = 'post' then
    select author_id, topic_id into owner, topic from public.forum_posts where id = in_id;
    if owner is null then raise exception 'There is no such post.'; end if;
    if owner <> auth.uid() and not public.is_moderator() then
      raise exception 'That is not yours to take down.';
    end if;
    update public.forum_posts set is_removed = true where id = in_id;
    update public.forum_topics
       set reply_count = greatest(0, reply_count - 1),
           answer_id = case when answer_id = in_id then null else answer_id end
     where id = topic;
  else
    raise exception 'You can take down a topic or a post.';
  end if;
end $$;

grant execute on function public.forum_remove to authenticated;

-- ------------------------------------------------------------- the badge

/**
 * Staff moving a topic along its ladder.
 *
 * Staw: "make that admins+ can make posts from feedback & suggestions
 * solved if theres bugs, for suggestions approved or declined and been
 * looked at". So which words are available is the category's `kind`, and
 * a word the category does not have is refused rather than stored - a
 * "declined" on a thread in Community creations is a decision nobody made.
 */
create or replace function public.forum_set_status(in_topic bigint, in_status text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare board_kind text;
begin
  if not public.is_moderator() then
    raise exception 'Only Kobblon staff can mark a topic.';
  end if;

  select c.kind into board_kind
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
   where t.id = in_topic;
  if board_kind is null then raise exception 'There is no such topic.'; end if;

  if in_status = 'open' then
    null;
  elsif in_status = 'solved' then
    if board_kind not in ('bugs', 'both') then
      raise exception 'Nothing is solved in this category.';
    end if;
  elsif in_status in ('approved', 'declined', 'looked-at') then
    if board_kind not in ('suggestions', 'both') then
      raise exception 'Suggestions are not decided in this category.';
    end if;
  else
    raise exception 'That is not one of the marks.';
  end if;

  update public.forum_topics
     set status = in_status,
         status_by = case when in_status = 'open' then null else auth.uid() end,
         status_at = case when in_status = 'open' then null else now() end
   where id = in_topic;
end $$;

grant execute on function public.forum_set_status to authenticated;

/** Pinning and closing. Staff only, both. */
create or replace function public.forum_set_flags(
  in_topic bigint, in_pinned boolean default null, in_locked boolean default null
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.is_moderator() then
    raise exception 'Only Kobblon staff can pin or close a topic.';
  end if;
  update public.forum_topics
     set is_pinned = coalesce(in_pinned, is_pinned),
         is_locked = coalesce(in_locked, is_locked)
   where id = in_topic;
  if not found then raise exception 'There is no such topic.'; end if;
end $$;

grant execute on function public.forum_set_flags to authenticated;

/**
 * Marking the reply that answered it.
 *
 * The person who asked says what answered them, and staff can too, because
 * a thread whose asker left is a thread nobody else can ever close.
 */
create or replace function public.forum_mark_answer(in_post bigint)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare asked uuid; topic bigint; already bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  select r.topic_id, t.author_id, t.answer_id into topic, asked, already
    from public.forum_posts r
    join public.forum_topics t on t.id = r.topic_id
   where r.id = in_post and not r.is_removed;
  if topic is null then raise exception 'There is no such post.'; end if;

  if asked <> auth.uid() and not public.is_moderator() then
    raise exception 'Only the person who asked can mark the answer.';
  end if;

  update public.forum_topics
     set answer_id = case when already = in_post then null else in_post end
   where id = topic;
end $$;

grant execute on function public.forum_mark_answer to authenticated;

-- --------------------------------------------------------- helpful, seen

/** The one mark. Pressing it again takes it off; returns whether it is on. */
create or replace function public.forum_like(in_what text, in_id bigint)
returns boolean language plpgsql security definer
set search_path = public, extensions as $$
declare had boolean;
begin
  perform public.forum_may_write();
  if in_what not in ('topic', 'post') then
    raise exception 'You can mark a topic or a post.';
  end if;

  if in_what = 'topic' then
    if not exists (select 1 from public.forum_topics where id = in_id and not is_removed) then
      raise exception 'There is no such topic.';
    end if;
  else
    if not exists (select 1 from public.forum_posts where id = in_id and not is_removed) then
      raise exception 'There is no such post.';
    end if;
  end if;

  select true into had from public.forum_likes
   where target_type = in_what and target_id = in_id and user_id = auth.uid();

  if had then
    delete from public.forum_likes
     where target_type = in_what and target_id = in_id and user_id = auth.uid();
  else
    insert into public.forum_likes (target_type, target_id, user_id)
    values (in_what, in_id, auth.uid());
  end if;

  if in_what = 'topic' then
    update public.forum_topics
       set like_count = (select count(*) from public.forum_likes
                          where target_type = 'topic' and target_id = in_id)
     where id = in_id;
  else
    update public.forum_posts
       set like_count = (select count(*) from public.forum_likes
                          where target_type = 'post' and target_id = in_id)
     where id = in_id;
  end if;

  return not coalesce(had, false);
end $$;

grant execute on function public.forum_like to authenticated;

/**
 * Having read it. One account, once, ever - the insert is the counter, and
 * a second visit does nothing because the primary key refuses it.
 *
 * A guest moves nothing, and that is the honest version rather than a
 * limitation: telling two guests apart means keeping something about them
 * that we have no business keeping.
 */
create or replace function public.forum_seen(in_topic bigint)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare written integer := 0;
begin
  if auth.uid() is null then return; end if;

  insert into public.forum_topic_views (topic_id, user_id)
  values (in_topic, auth.uid())
  on conflict do nothing;

  /* `row_count` is an integer. A boolean here is a type error at run time,
     which on a counter nobody watches is a page that breaks on its view. */
  get diagnostics written = row_count;
  if written > 0 then
    update public.forum_topics set view_count = view_count + 1 where id = in_topic;
  end if;
end $$;

grant execute on function public.forum_seen to authenticated;

commit;
