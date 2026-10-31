begin;

/*
 * A category that holds categories holds no topics.
 *
 * Staw, straight after 0313: "the two other categories can only contain
 * categories, not posts". Avatar contests and 2026 are filing, not rooms -
 * a topic opened in "2026" belongs to no contest and sits there for a
 * year.
 *
 * 0313 reached for `staff_only` to say this, and `staff_only` does not say
 * it. It says "only staff open topics here", which is a different sentence
 * with a different meaning everywhere else it is used, and it leaves the
 * one case that actually happens wide open: a moderator tidying up posts
 * the contest into the year by hand, and nothing stops them. So the rule
 * gets a column of its own, and the two categories go back to being open
 * rather than staff-only, because what is true of them is not that staff
 * may post - it is that nobody may.
 */
alter table public.forum_categories
  add column if not exists holds_only_categories boolean not null default false;

/*
 * Enforced on the topics table rather than in `forum_topic_create`.
 *
 * The RPC is where somebody opens a topic, so it is where the readable
 * refusal lives - but it is not the only statement that can put a row in a
 * category. Moving a topic is an update, and a guard that only watches the
 * insert is a guard watching one of the two events that should invalidate
 * it. This watches both.
 */
create or replace function public.forum_topic_has_a_room()
returns trigger language plpgsql set search_path = public as $$
declare
  holder boolean;
begin
  select holds_only_categories into holder
    from public.forum_categories where slug = new.category;
  if coalesce(holder, false) then
    raise exception 'The category % only holds other categories.', new.category;
  end if;
  return new;
end $$;

drop trigger if exists forum_topics_have_a_room on public.forum_topics;
create trigger forum_topics_have_a_room
  before insert or update of category on public.forum_topics
  for each row execute function public.forum_topic_has_a_room();

/*
 * And the same refusal said in English, before the trigger gets to it.
 *
 * Only the first `if` is new; the rest is 0289's function unchanged, which
 * is why the whole body is here rather than a patch - a `create or
 * replace` replaces the whole thing either way, and half of one in a file
 * is how a rate limit goes missing.
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

  if board.holds_only_categories then
    raise exception '% only holds other categories. Pick one of them.', board.name;
  end if;

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

/* The two containers, said properly this time. */
update public.forum_categories
   set holds_only_categories = true, staff_only = false
 where slug in ('avatar-contests', 'avatar-contests-2026');

-- ---------------------------------------------------------- the reading

/*
 * `forum_boards` carries it, so the page can take the "Start a topic"
 * button off a container rather than offering one that the database will
 * refuse. A control that implies something the runtime does not do is the
 * fake thing the ethos is about.
 */
drop function if exists public.forum_boards();

create function public.forum_boards()
returns table (
  slug text, name text, blurb text, kind text, staff_only boolean,
  parent text, depth integer, holds_only_categories boolean,
  topic_count integer, post_count integer, last_post_at timestamptz,
  last_title text, last_topic_id bigint,
  last_author text, last_author_avatar text, last_author_username text,
  last_author_id uuid
)
language sql stable security definer
set search_path = public, extensions as $$
  with recursive tree as (
    select c.slug, c.parent, 0 as depth,
           array[c.position] as rank, array[c.slug] as path
      from public.forum_categories c
     where c.parent is null and not c.is_hidden
    union all
    select c.slug, c.parent, t.depth + 1,
           t.rank || c.position, t.path || c.slug
      from public.forum_categories c
      join tree t on t.slug = c.parent
     where not c.is_hidden
  ),
  /* Every category paired with each of its descendants, and with itself. */
  under as (
    select t.slug as top, d.slug as inside
      from tree t
      join tree d on d.path[1:array_length(t.path, 1)] = t.path
  )
  select c.slug, c.name, c.blurb, c.kind, c.staff_only,
         c.parent, t.depth, c.holds_only_categories,
         coalesce(n.topics, 0)::integer,
         coalesce(n.posts, 0)::integer,
         n.last_at, n.last_title, n.last_id,
         n.last_author, n.last_avatar, n.last_username, n.last_author_id
    from tree t
    join public.forum_categories c on c.slug = t.slug
    left join lateral (
      select count(*)::integer as topics,
             (coalesce(sum(tp.reply_count), 0) + count(*))::integer as posts,
             max(tp.last_post_at) as last_at,
             (array_agg(tp.title order by tp.last_post_at desc))[1] as last_title,
             (array_agg(tp.id order by tp.last_post_at desc))[1] as last_id,
             (array_agg(coalesce(p.display_name, p.username) order by tp.last_post_at desc))[1] as last_author,
             (array_agg(p.avatar_url order by tp.last_post_at desc))[1] as last_avatar,
             (array_agg(p.username order by tp.last_post_at desc))[1] as last_username,
             (array_agg(p.id order by tp.last_post_at desc))[1] as last_author_id
        from public.forum_topics tp
        join public.profiles p on p.id = tp.author_id
       where tp.category in (select inside from under u where u.top = c.slug)
         and not tp.is_removed
    ) n on true
   order by t.rank, t.path;
$$;

grant execute on function public.forum_boards to anon, authenticated;

commit;
