begin;

/*
 * A number a topic starts with, kept apart from the one people gave it.
 *
 * Staw wants every announcement to start at thirty marks and the current
 * one to start higher. Say plainly what that is: it is a number shown to
 * readers that nobody pressed a button for, and it will read to them as
 * other people having liked the post.
 *
 * Given that it is wanted, the way it is done matters. The obvious way -
 * `update forum_topics set like_count = like_count + 30` - does not work
 * and would have looked like it did for about a day: `forum_like` does not
 * count up and down, it **recomputes** `like_count` from the rows in
 * `forum_likes` every time anybody presses the mark. So the first real
 * like on a seeded announcement takes the thirty away again, and the
 * author of the next bug report would be looking at the forum rather than
 * at the function.
 *
 * The other obvious way - writing thirty rows into `forum_likes` - is
 * worse: those rows belong to accounts, so it would put a like on thirty
 * real people's names that they never gave, and each of them would see it
 * on their own screen as a post they had marked.
 *
 * So the seed is a column of its own. `like_count` stays exactly what it
 * has always been plus whatever the seed says, the rows underneath stay
 * true, and a person who likes the post still moves the number by one.
 * Taking the seed off is one update and nothing is lost.
 */

alter table public.forum_topics
  add column if not exists like_seed integer not null default 0
  check (like_seed >= 0);

comment on column public.forum_topics.like_seed is
  'Marks a topic starts with, set by staff. Added to the real count; the '
  'rows in forum_likes stay the record of who actually pressed it.';

/**
 * The mark, with the seed carried through.
 *
 * 0276's body, retyped in full rather than patched - rewriting one of
 * these from memory is how a check quietly goes missing - with the two
 * recomputes made aware of the seed. A post has no seed and does not want
 * one: the thing being started off is an announcement, not a reply.
 */
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
       set like_count = like_seed + (select count(*) from public.forum_likes
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

/* ------------------------------------------------- what Staw asked for */

/*
 * Thirty on every announcement, and ten more on the one that is up now.
 *
 * Written as a set rather than as an addition, so running this file twice
 * leaves the same numbers rather than sixty. `like_count` is then put back
 * in step with the seed plus the real rows, which is what `forum_like`
 * will compute the next time anybody presses it.
 */
update public.forum_topics t
   set like_seed = case when t.id = 17 then 40 else 30 end
 where t.category = 'announcements'
   and not t.is_removed;

update public.forum_topics t
   set like_count = t.like_seed + (select count(*) from public.forum_likes l
                                    where l.target_type = 'topic' and l.target_id = t.id)
 where t.category = 'announcements'
   and not t.is_removed;

/*
 * And two hundred views on that one.
 *
 * This one is an addition and not a seed, because `forum_seen` counts up
 * by one rather than recomputing - so the number stays put on its own and
 * a real reader still adds to it. It is also the reason this file is not
 * safe to run twice for the views: running it again adds another two
 * hundred. Once.
 */
update public.forum_topics
   set view_count = view_count + 200
 where id = 17 and not is_removed;

commit;
