begin;

/*
 * The forum.
 *
 * Staw: "now we shall make a community forum (design based on roblox'
 * devforum and luduvo's forum [...]) like the dots moving before u enter
 * the forum and yeah people can make posts and add images attachments and
 * if u are already logged in onto the logged in pages then u can write
 * posts too and ofc theres verified badges and staff badges [...] and in
 * the community forum theres multiple categories.. including community
 * creations, feedback & suggestions [...] and make that admins+ can make
 * posts from feedback & suggestions solved if theres bugs, for suggestions
 * approved or declined and been looked at".
 *
 * Shape, and why each piece is the way it is:
 *
 *  * **A category is a row, not a constant in the website.** The two that
 *    already exist on the Discord - community creations, feedback and
 *    suggestions - are seeded here, and the rest with them. A category in
 *    the code means the Workspace has to ship a copy of the list, and the
 *    day somebody adds one it is two deploys instead of one insert.
 *  * **A topic carries its own reply count and the time of the last reply**
 *    rather than being counted on every listing. A board is read far more
 *    often than it is written to, and a count(*) per row over a growing
 *    table is the thing that makes a forum slow a year in.
 *  * **Writing goes through functions, reading goes through policies.** The
 *    tables take no insert, update or delete from `authenticated` at all -
 *    every rule about who may post, what a guest may not do, who may close
 *    a topic and who may answer it lives in one place. A policy that lets
 *    somebody write a row directly is a second copy of those rules, and the
 *    two drift.
 *  * **A guest cannot post.** Nor can a suspended account. Both are refused
 *    with a sentence rather than silently, so the page can say why.
 *
 * What is deliberately not here: no private categories, no per-category
 * membership, no trust levels, no editing somebody else's topic. A forum on
 * a week-old platform needs somewhere to put a screenshot and somebody to
 * answer; the rest can be built when there is anybody asking for it.
 */

-- ------------------------------------------------------------ categories

/*
 * `kind` is what the status ladder on a topic means, and it is the whole
 * reason the column exists. Staw: solved for bugs; approved, declined or
 * looked at for suggestions. Those are two different ladders, and a topic
 * in a category that has neither cannot be given either - a "declined"
 * badge on somebody showing off a build would be a sentence nobody passed.
 */
create table if not exists public.forum_categories (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{1,38}$'),
  name text not null check (char_length(name) between 1 and 48),
  blurb text not null check (char_length(blurb) between 1 and 200),
  /* Which ladder a staff member may put a topic on. */
  kind text not null default 'plain' check (kind in ('plain', 'bugs', 'suggestions', 'both')),
  /* Only staff may open a topic here. For announcements, and nothing else. */
  staff_only boolean not null default false,
  position smallint not null default 100,
  is_hidden boolean not null default false
);

insert into public.forum_categories (slug, name, blurb, kind, staff_only, position) values
  ('announcements', 'Announcements',
   'What Kobblon is doing, said by the people doing it.', 'plain', true, 10),
  ('community-creations', 'Community creations',
   'Worlds, items, art and whatever else you made. Show it here.', 'plain', false, 20),
  ('feedback-and-suggestions', 'Feedback and suggestions',
   'Ideas for Kobblon, and the things that are wrong with it.', 'both', false, 30),
  ('help-and-support', 'Help and support',
   'Stuck on something? Ask, and somebody who knows will answer.', 'bugs', false, 40),
  ('building-and-scripting', 'Building and scripting',
   'Making Worlds: the engine, the Workspace, and how to do the hard part.', 'plain', false, 50),
  ('off-topic', 'Off topic',
   'Everything else, within the Guidelines.', 'plain', false, 60)
on conflict (slug) do update
   set name = excluded.name,
       blurb = excluded.blurb,
       kind = excluded.kind,
       staff_only = excluded.staff_only,
       position = excluded.position;

alter table public.forum_categories enable row level security;

/*
 * The grants, in the same file as the table, and the check that goes with
 * them reads as `authenticated` rather than as the owner. CLAUDE.md's
 * fourth trap: a policy decides which rows a role may see, a grant decides
 * whether it may touch the table at all, and a new table has none.
 */
grant select on public.forum_categories to anon, authenticated;
revoke insert, update, delete on public.forum_categories from anon, authenticated;

drop policy if exists forum_categories_read on public.forum_categories;
create policy forum_categories_read on public.forum_categories for select
  using (not is_hidden or public.is_moderator());

-- --------------------------------------------------------------- topics

create table if not exists public.forum_topics (
  id bigserial primary key,
  category text not null references public.forum_categories (slug) on delete restrict,
  author_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 6 and 140),
  body text not null check (char_length(body) between 1 and 12000),
  /*
   * Paths in the public `forum` bucket. An array rather than a table
   * because an attachment here has no life of its own - it is never
   * reordered, never shared between posts, and never asked about on its
   * own. Four is the ceiling and the function enforces it.
   */
  images text[] not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'solved', 'approved', 'declined', 'looked-at')),
  /** Who last moved it along the ladder, so the badge can say by whom. */
  status_by uuid references public.profiles on delete set null,
  status_at timestamptz,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  is_removed boolean not null default false,
  view_count integer not null default 0,
  reply_count integer not null default 0,
  like_count integer not null default 0,
  /** The reply marked as the answer, where there is one. */
  answer_id bigint,
  last_post_at timestamptz not null default now(),
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists forum_topics_board_idx
  on public.forum_topics (category, is_pinned desc, last_post_at desc)
  where not is_removed;
create index if not exists forum_topics_recent_idx
  on public.forum_topics (last_post_at desc) where not is_removed;
create index if not exists forum_topics_author_idx
  on public.forum_topics (author_id, created_at desc);

alter table public.forum_topics enable row level security;

grant select on public.forum_topics to anon, authenticated;
revoke insert, update, delete on public.forum_topics from anon, authenticated;

/*
 * Anybody may read the board, signed in or not. Staw: "you can see posts
 * even if youre not logged in". A removed topic is visible to its author
 * and to staff only - the author because a post that silently vanishes is
 * indistinguishable from a bug, and staff because somebody has to be able
 * to look at what was taken down.
 */
drop policy if exists forum_topics_read on public.forum_topics;
create policy forum_topics_read on public.forum_topics for select
  using (not is_removed or author_id = auth.uid() or public.is_moderator());

-- ---------------------------------------------------------------- posts

create table if not exists public.forum_posts (
  id bigserial primary key,
  topic_id bigint not null references public.forum_topics on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 12000),
  images text[] not null default '{}',
  /** The reply this one is answering, for a conversation inside a thread. */
  reply_to bigint references public.forum_posts on delete set null,
  is_removed boolean not null default false,
  like_count integer not null default 0,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists forum_posts_thread_idx
  on public.forum_posts (topic_id, created_at);
create index if not exists forum_posts_author_idx
  on public.forum_posts (author_id, created_at desc);

alter table public.forum_posts enable row level security;

grant select on public.forum_posts to anon, authenticated;
revoke insert, update, delete on public.forum_posts from anon, authenticated;

drop policy if exists forum_posts_read on public.forum_posts;
create policy forum_posts_read on public.forum_posts for select
  using (not is_removed or author_id = auth.uid() or public.is_moderator());

alter table public.forum_topics
  drop constraint if exists forum_topics_answer_fk;
alter table public.forum_topics
  add constraint forum_topics_answer_fk
  foreign key (answer_id) references public.forum_posts (id) on delete set null;

-- ---------------------------------------------------------------- likes

/*
 * One mark, not ten faces.
 *
 * The posts on a Community wall take reactions, and they are right to: a
 * wall is a place to feel something at somebody. A forum is a place to
 * find the answer, and the only question worth asking about a reply is
 * whether it helped. So this is a single mark, it is what "helpful" means
 * in the feed on the front page, and the count on the row is kept by the
 * function rather than counted on every listing.
 */
create table if not exists public.forum_likes (
  /* 'topic' or 'post'; both are bigints, so one text column keys both. */
  target_type text not null check (target_type in ('topic', 'post')),
  target_id bigint not null,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);

create index if not exists forum_likes_on_a_thing
  on public.forum_likes (target_type, target_id);

alter table public.forum_likes enable row level security;

grant select on public.forum_likes to anon, authenticated;
revoke insert, update, delete on public.forum_likes from anon, authenticated;

drop policy if exists forum_likes_read on public.forum_likes;
create policy forum_likes_read on public.forum_likes for select using (true);

-- ---------------------------------------------------------------- views

/*
 * A view is one account, once. Not one page load.
 *
 * A counter that goes up every time the page is opened is a counter the
 * author can move on their own, and "most viewed" on the front page would
 * then be a list of who refreshed hardest. A guest moves nothing at all,
 * which is the honest version: we cannot tell two guests apart without
 * keeping something about them that we have no business keeping.
 */
create table if not exists public.forum_topic_views (
  topic_id bigint not null references public.forum_topics on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (topic_id, user_id)
);

alter table public.forum_topic_views enable row level security;

grant select on public.forum_topic_views to authenticated;
revoke insert, update, delete on public.forum_topic_views from anon, authenticated;

drop policy if exists forum_topic_views_mine on public.forum_topic_views;
create policy forum_topic_views_mine on public.forum_topic_views for select
  using (user_id = auth.uid() or public.is_moderator());

-- ------------------------------------------------------- the bucket

/*
 * Attachments. Public, because a forum post with a screenshot nobody can
 * see is a forum post with no screenshot, and a signed link that expires
 * is a thread that rots. Two megabytes and pictures only; the folder is
 * the uploader's own id, so nothing can be written against somebody else.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forum', 'forum', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
   set public = true,
       file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists forum_files_read on storage.objects;
create policy forum_files_read on storage.objects for select
  using (bucket_id = 'forum');

drop policy if exists forum_files_write on storage.objects;
create policy forum_files_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'forum'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.is_guest()
  );

drop policy if exists forum_files_remove on storage.objects;
create policy forum_files_remove on storage.objects for delete to authenticated
  using (
    bucket_id = 'forum'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator())
  );

commit;
