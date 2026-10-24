begin;

-- A board can have its own staff
-- -----------------------------------------------------------------------
--
-- Staff on the forum has been all or nothing: `is_moderator()` is true for
-- every admin and moderator on the whole platform, and false for everybody
-- else. So somebody who knows building and scripting inside out and should
-- be closing duplicates on that board had to be given the keys to the
-- entire site, or nothing.
--
-- This is the third thing. `forum_category_staff` says that one account
-- looks after one board, and `forum_can_moderate(slug)` is the question
-- every forum function asks instead of `is_moderator()`.
--
-- **The powers are the board's, and only the board's.** Pin, close, mark,
-- take a post down, post in a staff-only board, and bypass the five-topics
-- -an-hour floodgate - on that board. Elsewhere they are an ordinary
-- account. What this does **not** give, anywhere, and must never:
-- warnings, suspensions, anything on anybody's standing, or the ability to
-- appoint more of themselves. Those stay with real staff, and
-- `is_moderator()` is still the question everywhere outside this file.
--
-- Who may appoint one: `is_admin` only, not `is_moderator`. A moderator
-- handing out board keys is a moderator growing their own staff, and the
-- log row is written either way so it is answerable.

set search_path = public, extensions;

-- ------------------------------------------------------------ the table

create table if not exists public.forum_category_staff (
  category text not null references public.forum_categories (slug) on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  given_at timestamptz not null default now(),
  given_by uuid references public.profiles on delete set null,
  primary key (category, user_id)
);

/*
 * Grants, in the same file as the table.
 *
 * This project has shipped a carefully-policied table that nobody could
 * touch twice, because a policy says which rows and a grant says whether
 * the role may reach the table at all. Reading is public - who looks after
 * a board is not a secret, and the board page says so - and every write
 * goes through the two functions below.
 */
alter table public.forum_category_staff enable row level security;

grant select on public.forum_category_staff to anon, authenticated;
revoke insert, update, delete on public.forum_category_staff from anon, authenticated;

drop policy if exists forum_category_staff_are_public on public.forum_category_staff;
create policy forum_category_staff_are_public on public.forum_category_staff
  for select using (true);

create index if not exists forum_category_staff_by_person
  on public.forum_category_staff (user_id);

-- --------------------------------------------------------- the question

/**
 * May this account moderate this board.
 *
 * Real staff anywhere, or this board's own somebody here. A null slug
 * means "anywhere", which is what the few forum functions that are not
 * about one board want.
 *
 * `stable` and not `security definer`: it reads a table anybody may read,
 * so it needs no rights of its own, and a definer function that does not
 * need to be one is a definer function waiting to be given a hole.
 */
create or replace function public.forum_can_moderate(in_category text default null)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select public.is_moderator()
      or (
        in_category is not null
        and auth.uid() is not null
        and exists (
          select 1 from public.forum_category_staff s
           where s.category = in_category and s.user_id = auth.uid()
        )
      );
$$;

grant execute on function public.forum_can_moderate to anon, authenticated;

/** Which boards this account looks after. For the page that says so. */
create or replace function public.forum_boards_i_mind()
returns table (category text, name text)
language sql stable
set search_path = public, extensions as $$
  select s.category, c.name
    from public.forum_category_staff s
    join public.forum_categories c on c.slug = s.category
   where s.user_id = auth.uid()
   order by c.position, c.name;
$$;

grant execute on function public.forum_boards_i_mind to authenticated;

/**
 * Who looks after a board, for the board's own header.
 *
 * Public, because a board whose staff are anonymous is a board where
 * nobody is answerable for a decision. Platform staff are not listed here
 * - they are staff everywhere and listing them on six boards says
 * something untrue about what the list means.
 */
create or replace function public.forum_board_staff(in_category text)
returns table (user_id uuid, username text, display_name text, avatar_url text)
language sql stable
set search_path = public, extensions as $$
  select p.id, p.username, coalesce(p.display_name, p.username), p.avatar_url
    from public.forum_category_staff s
    join public.profiles p on p.id = s.user_id
   where s.category = in_category
   order by s.given_at;
$$;

grant execute on function public.forum_board_staff to anon, authenticated;

-- ----------------------------------------------------- giving and taking

/**
 * Putting somebody in charge of a board, or taking them off it.
 *
 * Admins only. A moderator cannot do this, for the reason at the top.
 */
create or replace function public.set_forum_board_staff(
  in_category text, in_user uuid, in_on boolean
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare am_admin boolean;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  select coalesce(is_admin or is_superadmin, false) into am_admin
    from public.profiles where id = auth.uid();
  if not coalesce(am_admin, false) then
    raise exception 'Only a Kobblon admin can put somebody in charge of a board.';
  end if;

  if not exists (select 1 from public.forum_categories where slug = in_category) then
    raise exception 'There is no such category.';
  end if;
  if not exists (select 1 from public.profiles where id = in_user) then
    raise exception 'There is no such account.';
  end if;

  if in_on then
    insert into public.forum_category_staff (category, user_id, given_by)
    values (in_category, in_user, auth.uid())
    on conflict (category, user_id) do nothing;
  else
    delete from public.forum_category_staff
     where category = in_category and user_id = in_user;
  end if;
end $$;

grant execute on function public.set_forum_board_staff to authenticated;

-- --------------------------------------- what now asks the new question

/*
 * The six functions where "staff" meant the whole platform and should
 * mean this board.
 *
 * Replaced whole rather than patched, because `create or replace` is how
 * these are written and a function body cannot be edited in place. The
 * bodies are 0276's and 0285's, with `is_moderator()` changed to
 * `forum_can_moderate(<the board>)` and nothing else touched.
 *
 * `forum_edit` is **not** here and must not be: it is author-only, and
 * staff of any kind do not rewrite somebody's words. They take a post
 * down, which is `forum_remove`, which is here.
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

  if board.staff_only and not public.forum_can_moderate(in_category) then
    raise exception 'Only Kobblon staff open topics in %.', board.name;
  end if;

  if coalesce(array_length(in_images, 1), 0) > 4 then
    raise exception 'Four pictures at most.';
  end if;

  select count(*)::integer into recently from public.forum_topics
   where author_id = auth.uid() and created_at > now() - interval '1 hour';
  if recently >= 5 and not public.forum_can_moderate(in_category) then
    raise exception 'That is five topics in an hour. Give it a little while.';
  end if;

  insert into public.forum_topics (category, author_id, title, body, images)
  values (in_category, auth.uid(), in_title, in_body, coalesce(in_images, '{}'))
  returning id into made;

  return made;
end $$;

grant execute on function public.forum_topic_create to authenticated;

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
  if topic.is_locked and not public.forum_can_moderate(topic.category) then
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

  if topic.author_id <> auth.uid() then
    insert into public.notifications (user_id, kind, actor_id, body, link)
    values (topic.author_id, 'forum_reply', auth.uid(),
            'replied to "' || left(topic.title, 60) || '"',
            '/forum/t/' || in_topic::text);
  end if;

  return made;
end $$;

grant execute on function public.forum_reply to authenticated;

create or replace function public.forum_remove(in_what text, in_id bigint)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare owner uuid; topic bigint; board text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  if in_what = 'topic' then
    select author_id, category into owner, board
      from public.forum_topics where id = in_id;
    if owner is null then raise exception 'There is no such topic.'; end if;
    if owner <> auth.uid() and not public.forum_can_moderate(board) then
      raise exception 'That is not yours to take down.';
    end if;
    update public.forum_topics set is_removed = true where id = in_id;
  elsif in_what = 'post' then
    select r.author_id, r.topic_id, t.category into owner, topic, board
      from public.forum_posts r
      join public.forum_topics t on t.id = r.topic_id
     where r.id = in_id;
    if owner is null then raise exception 'There is no such post.'; end if;
    if owner <> auth.uid() and not public.forum_can_moderate(board) then
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

create or replace function public.forum_mark_answer(in_post bigint)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare asked uuid; topic bigint; already bigint; board text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  select r.topic_id, t.author_id, t.answer_id, t.category
    into topic, asked, already, board
    from public.forum_posts r
    join public.forum_topics t on t.id = r.topic_id
   where r.id = in_post and not r.is_removed;
  if topic is null then raise exception 'There is no such post.'; end if;

  if asked <> auth.uid() and not public.forum_can_moderate(board) then
    raise exception 'Only the person who asked can mark the answer.';
  end if;

  update public.forum_topics
     set answer_id = case when already = in_post then null else in_post end
   where id = topic;
end $$;

grant execute on function public.forum_mark_answer to authenticated;

create or replace function public.forum_set_status(in_topic bigint, in_status text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare board_kind text; board text;
begin
  select c.kind, c.slug into board_kind, board
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
   where t.id = in_topic;
  if board_kind is null then raise exception 'There is no such topic.'; end if;

  if not public.forum_can_moderate(board) then
    raise exception 'Only Kobblon staff can mark a topic.';
  end if;

  if in_status = 'open' then
    null;
  elsif in_status = 'solved' then
    if board_kind not in ('bugs', 'both') then
      raise exception 'Nothing is solved in this category.';
    end if;
  elsif in_status in ('approved', 'declined') then
    if board_kind not in ('suggestions', 'both') then
      raise exception 'Suggestions are not decided in this category.';
    end if;
  elsif in_status = 'looked-at' then
    if board_kind not in ('bugs', 'suggestions', 'both') then
      raise exception 'Nothing is marked in this category.';
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

create or replace function public.forum_set_flags(
  in_topic bigint, in_pinned boolean default null, in_locked boolean default null
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare board text;
begin
  select t.category into board from public.forum_topics t where t.id = in_topic;
  if board is null then raise exception 'There is no such topic.'; end if;

  if not public.forum_can_moderate(board) then
    raise exception 'Only Kobblon staff can pin or close a topic.';
  end if;

  update public.forum_topics
     set is_pinned = coalesce(in_pinned, is_pinned),
         is_locked = coalesce(in_locked, is_locked)
   where id = in_topic;
end $$;

grant execute on function public.forum_set_flags to authenticated;

commit;
