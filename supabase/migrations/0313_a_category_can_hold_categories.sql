begin;

/*
 * A forum category can hold other categories, three deep.
 *
 * Staw, setting up the Halloween avatar contest: "we need a forum
 * category for avatar contests and a subcategory for each year and inside
 * every sub-subcategory for each avatar contest". The board list has been
 * flat since 0275, so this is the shape it was missing, built once rather
 * than for Halloween - there is a contest every year and more than one a
 * year, and six flat rooms called "Halloween 2026" is the thing this is
 * instead of.
 *
 * Three levels and no more, and the limit is enforced rather than
 * described. An unbounded tree in a board list is a page that can be made
 * to indent off the right of the screen by anybody who can add a row, and
 * a depth nothing checks is a depth the reader has to be careful about.
 */
alter table public.forum_categories
  add column if not exists parent text references public.forum_categories(slug) on delete restrict;

create index if not exists forum_categories_parent on public.forum_categories (parent);

/*
 * The limit, as a rule the table keeps rather than a note in a file.
 *
 * Both halves matter and the second is the one that is easy to miss: a
 * row may not be given a parent that already has a grandparent, *and* a
 * row that already has children may not be given a parent itself. The
 * first alone lets a legal three-deep tree be pushed to four by moving
 * its root under something, which is the same mistake as a guard that
 * watches the wrong event - it is checked, it is deliberate, and it reads
 * the one direction the depth can grow in.
 */
create or replace function public.forum_depth_is_three()
returns trigger language plpgsql set search_path = public as $$
declare
  grandparent text;
begin
  if new.parent is null then return new; end if;
  if new.parent = new.slug then
    raise exception 'A category cannot be inside itself.';
  end if;

  select parent into grandparent from public.forum_categories where slug = new.parent;
  if grandparent is not null then
    select parent into grandparent from public.forum_categories where slug = grandparent;
    if grandparent is not null then
      raise exception 'Forum categories only go three deep.';
    end if;
  end if;

  if exists (
    select 1 from public.forum_categories kid
     where kid.parent = new.slug
       and exists (select 1 from public.forum_categories g
                    where g.parent = kid.slug)
  ) then
    raise exception 'Forum categories only go three deep.';
  end if;

  return new;
end $$;

drop trigger if exists forum_categories_are_three_deep on public.forum_categories;
create trigger forum_categories_are_three_deep
  before insert or update of parent, slug on public.forum_categories
  for each row execute function public.forum_depth_is_three();

-- ------------------------------------------------------ avatar contests

/*
 * The rooms themselves.
 *
 * The two above the contest are containers and nothing else, so they are
 * `staff_only` - not because staff post in them, but because nobody
 * should: a topic opened in "2026" belongs to no contest and would sit
 * there for a year. The contest itself is open to everybody, which is the
 * whole point of it.
 */
insert into public.forum_categories (slug, name, blurb, kind, staff_only, position, parent) values
  ('avatar-contests', 'Avatar contests',
   'Dress up, enter, win Brix. Every contest Kobblon has run, by year.',
   'plain', true, 25, null),
  ('avatar-contests-2026', '2026',
   'The contests we ran in 2026.', 'plain', true, 10, 'avatar-contests'),
  ('avatar-contest-halloween-2026', 'Halloween 2026',
   'Build the best Halloween avatar. 10,000 Brix for first, 5,000 for second, 2,500 for third.',
   'plain', false, 10, 'avatar-contests-2026')
on conflict (slug) do update
   set name = excluded.name,
       blurb = excluded.blurb,
       kind = excluded.kind,
       staff_only = excluded.staff_only,
       position = excluded.position,
       parent = excluded.parent;

-- ---------------------------------------------------------- the reading

/*
 * `forum_boards` gains the tree, which means two things rather than one.
 *
 * It carries `parent` and `depth` so the page can draw the nesting, and
 * it orders the rows by the path down the tree so a child always follows
 * its own parent - the page indents what it is given and never has to
 * sort a flat list back into a shape.
 *
 * The counts roll up. A container's own topic count is zero by
 * construction, and a row reading "Avatar contests - 0 topics" over forty
 * entries is the page saying something untrue about itself. So the number
 * beside a category is the topics in it and in everything under it, and
 * the same for the latest post.
 */
drop function if exists public.forum_boards();

create function public.forum_boards()
returns table (
  slug text, name text, blurb text, kind text, staff_only boolean,
  parent text, depth integer,
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
         c.parent, t.depth,
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
