begin;

/*
 * The forum, from the staff console
 * -----------------------------------------------------------------------
 *
 * Staw: "we'll also need to upgrade our admin panel for the new forum &
 * other stuff".
 *
 * The console can already act on a forum post: `forum_set_flags` pins and
 * locks, `forum_remove` takes one down, and 0294 made the report path work
 * at all. What it cannot do is **look**. Every reading function the forum
 * has filters `not is_removed` - `forum_topics_list` does it in its where
 * clause - so a moderator has no list of what has been taken down, no way
 * to check a decision somebody made last week, and no way to find a topic
 * that is not on a board they can guess.
 *
 * Two functions, staff only:
 *
 *   `forum_staff_topics`  the same columns `forum_topics_list` returns,
 *       for all of them, with the removed ones included and filterable.
 *       Deliberately the same shape, so the console draws the same card
 *       the forum does rather than a second idea of what a topic is.
 *
 *   `forum_restore`       putting one back. Taking something down has been
 *       possible since the forum existed and undoing it has not, which
 *       makes every takedown a decision nobody can walk back - and an
 *       appeal that is upheld has nothing to act on.
 *
 * `forum_topics_list` is left exactly as it is. Widening the function the
 * whole forum reads, so that one console can see more, is how a filter
 * stops being a filter: the right answer is a second door with a lock on
 * it, not a bigger hole in the first one.
 */

create or replace function public.forum_staff_topics(
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

/**
 * Putting one back.
 *
 * Staff only and deliberately not part of `forum_remove`, which takes an
 * author as well: somebody deleting their own post is not somebody who
 * may undelete it, or a thread could be pulled out of a moderator's hands
 * and put back by the person who wrote it.
 *
 * The author is told, because they were told when it came down.
 */
create or replace function public.forum_restore(in_what text, in_id bigint)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  owner uuid;
  said_about text;
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  if in_what = 'topic' then
    update public.forum_topics t set is_removed = false
     where t.id = in_id returning t.author_id, t.title into owner, said_about;
  elsif in_what = 'post' then
    update public.forum_posts r set is_removed = false
     where r.id = in_id returning r.author_id, 'Your forum reply' into owner, said_about;
  else
    raise exception 'Kobblon does not put a % back.', in_what;
  end if;

  if said_about is null then
    raise exception 'There is no % with that number.', in_what;
  end if;

  perform public.write_admin_log('forum-restored', owner,
    jsonb_build_object('what', in_what, 'which', in_id));

  if owner is null or owner = auth.uid() then
    return;
  end if;

  insert into public.notifications (user_id, kind, actor_id, body)
  values (owner, 'system', auth.uid(),
          left(said_about || ' is back up.', 300));
end $$;

grant execute on function public.forum_restore(text, bigint) to authenticated;

commit;
