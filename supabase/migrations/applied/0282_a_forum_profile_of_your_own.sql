begin;

-- A forum profile of your own
-- -----------------------------------------------------------------------
--
-- Staw: "i want forum profiles (a bit more professioanl, same pfp, by
-- default the same bio as your normal profile but if you edit your forum
-- profile bio then it'll be different, discord handle if connected, badges
-- ofc, username, button to see kobblon profile, add friend, block/ignore,
-- report, and see all posts and we see the tag, editable directly onto that
-- profile page)".
--
-- Two columns and the whole feature falls out of them, which is why this is
-- a table of two columns rather than a second profile.
--
-- `bio` null means "the one on my Kobblon profile". It is not a copy taken
-- at signup: a copy would be the first trap in CLAUDE.md wearing a new
-- coat - a value captured before the thing that decides it has finished
-- deciding - and somebody who rewrote their Kobblon bio would find the
-- forum still quoting the old one for ever. Null is asked at the moment of
-- use. Writing one here is the act that makes it its own thing, and
-- clearing it hands the question back.
--
-- `tag` is null for no tag, which is a real answer and the default. Staff
-- is not in this column at all: Staw asked for it to be "automatically
-- given for those with the k badge", so it is read off `wears_staff_badge`
-- at the moment of use and nobody can pick it. A tag that can be given to
-- yourself by choosing it from a list is not a mark of anything.

set search_path = public, extensions;

-- ------------------------------------------------------------- the tags

/*
 * A table rather than a check constraint, so adding "animator" later is an
 * insert and not a migration that rewrites every row's constraint - and so
 * the list the page draws is the list the database enforces, rather than a
 * second copy of it in TypeScript that drifts.
 */
create table if not exists public.forum_tags (
  code text primary key check (code ~ '^[a-z][a-z-]{1,22}$'),
  label text not null check (char_length(label) between 2 and 32),
  position smallint not null default 100,
  /** Given, never chosen. `staff` is the only one, and nobody may pick it. */
  automatic boolean not null default false
);

-- The grants, in the same file as the table. A policy decides which rows a
-- role may see; a grant decides whether it may touch the table at all, and
-- a new table has none. That is CLAUDE.md's fourth trap and it has cost
-- this project a fortnight twice.
alter table public.forum_tags enable row level security;
grant select on public.forum_tags to anon, authenticated;

drop policy if exists forum_tags_are_public on public.forum_tags;
create policy forum_tags_are_public on public.forum_tags for select using (true);

insert into public.forum_tags (code, label, position, automatic) values
  ('staff',           'Staff',            0,  true),
  ('player',          'Player',           10, false),
  ('builder',         'Builder',          20, false),
  ('scripter',        'Scripter',         30, false),
  ('programmer',      'Programmer',       40, false),
  ('developer',       'Developer',        50, false),
  ('modeller',        'Modeller',         60, false),
  ('artist',          'Artist',           70, false),
  ('designer',        'Designer',         80, false),
  ('animator',        'Animator',         90, false),
  ('musician',        'Musician',        100, false),
  ('sound-designer',  'Sound designer',  110, false),
  ('writer',          'Writer',          120, false),
  ('translator',      'Translator',      130, false),
  ('tester',          'Tester',          140, false),
  ('content-creator', 'Content creator', 150, false),
  ('teacher',         'Teacher',         160, false),
  ('learning',        'Still learning',  170, false)
on conflict (code) do update
  set label = excluded.label,
      position = excluded.position,
      automatic = excluded.automatic;

-- --------------------------------------------------------- the profiles

create table if not exists public.forum_profiles (
  user_id uuid primary key references public.profiles on delete cascade,
  /** Null is "no tag", which is the default and a real answer. */
  tag text references public.forum_tags (code) on delete set null,
  /** Null is "the one on my Kobblon profile", asked at the moment of use. */
  bio text check (bio is null or char_length(bio) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.forum_profiles enable row level security;
grant select on public.forum_profiles to anon, authenticated;

drop policy if exists forum_profiles_are_public on public.forum_profiles;
create policy forum_profiles_are_public on public.forum_profiles for select using (true);

/*
 * Nobody writes this table directly, including its owner. Everything goes
 * through `set_forum_profile`, which is where the automatic tag is refused
 * and the words are sent to be read.
 */
revoke insert, update, delete on public.forum_profiles from anon, authenticated;

-- ------------------------------------------------- a bio is words too

/*
 * A forum bio is a public sentence somebody wrote about themselves, which
 * is exactly what `names_to_read` is for. A new kind rather than a new
 * queue: `judge_profile_text` already calls anything that is not a handle
 * or a display name a bio, so it needs no change to read these.
 */
alter table public.names_to_read drop constraint if exists names_to_read_kind_check;
alter table public.names_to_read add constraint names_to_read_kind_check
  check (kind in ('username', 'display_name', 'bio', 'forum_bio'));

/*
 * The censor, and only the censor. The queue is in `set_forum_profile`
 * instead, and that is not a style choice.
 *
 * This table is written by one upsert, and `insert ... on conflict do
 * update` fires the BEFORE INSERT trigger *and then* the BEFORE UPDATE
 * one on the same statement. A queue in here put two rows in
 * `names_to_read` for one edit - two reads, two verdicts, on one sentence
 * somebody wrote once. A check counting the rows is what found it; a check
 * asking "is it queued" would have passed.
 */
create or replace function public.forum_bio_is_censored()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  new.bio := public.censor_text(new.bio, 'say');
  return new;
end $$;

drop trigger if exists a_forum_bio_is_read on public.forum_profiles;
drop trigger if exists a_forum_bio_is_censored on public.forum_profiles;
create trigger a_forum_bio_is_censored
  before insert or update of bio on public.forum_profiles
  for each row execute function public.forum_bio_is_censored();

-- -------------------------------------------------------------- reading

/** The tags somebody may pick from, and the one nobody may. */
create or replace function public.forum_tag_list()
returns table (code text, label text, automatic boolean)
language sql stable
set search_path = public, extensions as $$
  select t.code, t.label, t.automatic
    from public.forum_tags t
   order by t.position, t.label;
$$;

grant execute on function public.forum_tag_list() to anon, authenticated;

/**
 * Somebody's forum profile, by username.
 *
 * `tags` is an array because staff who also call themselves a programmer
 * are both, and throwing one of the two away to fit a single column would
 * be a decision this table has no business making.
 *
 * The Discord handle goes through `discord_handle_of`, which already knows
 * who is allowed to see it - everyone, friends, or nobody. Reading the
 * column directly here would be a forum page quietly publishing something
 * somebody set to friends-only on their settings page.
 */
create or replace function public.forum_profile(in_username text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  marks text[],
  tags text[],
  tag_labels text[],
  bio text,
  bio_is_own boolean,
  discord text,
  joined_at timestamptz,
  topic_count integer,
  post_count integer,
  is_me boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  select p.id,
         p.username,
         coalesce(p.display_name, p.username),
         p.avatar_url,
         public.name_marks(p.id),
         array_remove(array[
           case when public.wears_staff_badge(p.id) then 'staff' end,
           f.tag
         ], null),
         array_remove(array[
           case when public.wears_staff_badge(p.id)
                then (select label from public.forum_tags where code = 'staff') end,
           (select label from public.forum_tags where code = f.tag)
         ], null),
         coalesce(f.bio, p.bio),
         (f.bio is not null),
         public.discord_handle_of(p.id),
         p.created_at,
         (select count(*)::integer from public.forum_topics t
           where t.author_id = p.id and not t.is_removed),
         (select count(*)::integer from public.forum_posts r
           where r.author_id = p.id and not r.is_removed),
         coalesce(p.id = auth.uid(), false)
    from public.profiles p
    left join public.forum_profiles f on f.user_id = p.id
   where lower(p.username) = lower(in_username);
$$;

grant execute on function public.forum_profile(text) to anon, authenticated;

/**
 * Everything somebody has written on the forum, newest first.
 *
 * Topics and replies in one list, because "all posts" is one list to the
 * person reading it. `kind` says which, and a reply carries the title of
 * the topic it is in so the row can be read without opening it.
 */
create or replace function public.forum_posts_of(
  in_user uuid, in_limit integer default 20, in_offset integer default 0
)
returns table (
  kind text, id bigint, topic_id bigint, category text, category_name text,
  title text, body text, like_count integer, created_at timestamptz,
  edited_at timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select 'topic', t.id, t.id, t.category, c.name,
         t.title, t.body, t.like_count, t.created_at, t.edited_at
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
   where t.author_id = in_user and not t.is_removed and not c.is_hidden
  union all
  select 'reply', r.id, r.topic_id, t.category, c.name,
         t.title, r.body, r.like_count, r.created_at, r.edited_at
    from public.forum_posts r
    join public.forum_topics t on t.id = r.topic_id
    join public.forum_categories c on c.slug = t.category
   where r.author_id = in_user and not r.is_removed
     and not t.is_removed and not c.is_hidden
   order by created_at desc
   limit greatest(1, least(coalesce(in_limit, 20), 50))
  offset greatest(0, coalesce(in_offset, 0));
$$;

grant execute on function public.forum_posts_of(uuid, integer, integer) to anon, authenticated;

-- -------------------------------------------------------------- writing

/**
 * Setting your own tag and your own bio.
 *
 * Both at once, because the page edits them on one form and two functions
 * would be two round trips and a half-saved profile if the second failed.
 *
 * `in_bio` of null clears it, which hands the question back to the Kobblon
 * profile rather than leaving an empty sentence behind. An empty string is
 * the same answer said differently and is treated the same way.
 */
create or replace function public.set_forum_profile(
  in_tag text default null, in_bio text default null
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare
  chosen text;
  words text;
  had text;
  now_says text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  chosen := nullif(trim(coalesce(in_tag, '')), '');
  if chosen is not null then
    if not exists (select 1 from public.forum_tags where code = chosen) then
      raise exception 'There is no such tag.';
    end if;
    if exists (select 1 from public.forum_tags where code = chosen and automatic) then
      raise exception 'That one is given, not chosen.';
    end if;
  end if;

  words := nullif(trim(coalesce(in_bio, '')), '');
  if words is not null and char_length(words) > 500 then
    raise exception 'Five hundred characters at most.';
  end if;

  select bio into had from public.forum_profiles where user_id = auth.uid();

  insert into public.forum_profiles (user_id, tag, bio, updated_at)
  values (auth.uid(), chosen, words, now())
  on conflict (user_id) do update
    set tag = excluded.tag, bio = excluded.bio, updated_at = now();

  /*
   * Read the stored words back rather than queueing `words`: the censor
   * runs on the way in, so what is on the forum is not always what was
   * typed, and the machine should read what a stranger will see.
   */
  select bio into now_says from public.forum_profiles where user_id = auth.uid();

  if coalesce(now_says, '') <> '' and now_says is distinct from had then
    insert into public.names_to_read (who, kind, body)
    values (auth.uid(), 'forum_bio', now_says);
  end if;
end $$;

grant execute on function public.set_forum_profile(text, text) to authenticated;

commit;
