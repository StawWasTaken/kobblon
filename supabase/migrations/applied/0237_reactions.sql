begin;

/*
 * Reactions: ten faces, on the things people write.
 *
 * Staw: "Reactions are for announcements & posts, instead of simple
 * likes/dislikes while worlds keep the dislikes & likes only, but klub
 * users can also click a third button to add reactions to worlds".
 *
 * So the rule is not "reactions everywhere". It is:
 *
 *   a post or an announcement   reactions, and nothing else. A like on
 *                               something somebody wrote is a thumb where
 *                               a face would say what you actually felt.
 *   a World                     likes and dislikes, as now, because the
 *                               bar on a World is a rating and a rating
 *                               has to be one number. A Klub member may
 *                               add a face **as well** - it sits beside
 *                               the rating and does not move it.
 *
 * One table for both, keyed by what is being reacted to, because the
 * alternative is `post_reactions` and `world_reactions` with the same six
 * columns and two copies of every function over them. `target_type` is
 * checked against a list rather than being free text: a typo'd kind is a
 * reaction nobody can ever count.
 *
 * **One face per person per thing.** Reacting again with the same face
 * takes it off; reacting with a different one moves it. That is a decision
 * and not a limitation - a post with nine faces from one person is a post
 * nobody can read a feeling off, and the primary key is what enforces it
 * rather than a rule in a function that a second caller forgets.
 */

create table if not exists public.reactions (
  target_type text not null check (target_type in ('post', 'world')),
  /*
   * Text, because a post is a bigint and a World is a uuid. The cast back
   * is done where the kind is known, which is the only place it can be
   * done safely.
   */
  target_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  face text not null check (face in (
    'angry', 'happy-grin', 'heart-eyes', 'laugh', 'sad',
    'shocked', 'skull', 'smile', 'sunglasses', 'winky-grin')),
  created_at timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);

create index if not exists reactions_on_a_thing
  on public.reactions (target_type, target_id);
create index if not exists reactions_by_a_person
  on public.reactions (user_id, created_at desc);

alter table public.reactions enable row level security;

/*
 * The grants, in the same file as the table.
 *
 * CLAUDE.md's fourth trap, and it has cost this project a fortnight twice:
 * a policy decides which rows a role may see, a grant decides whether the
 * role may touch the table at all, and a new table has no grants. A policy
 * without one is a table that looks carefully protected and answers
 * "permission denied" to everybody.
 */
grant select on public.reactions to anon, authenticated;
grant insert, update, delete on public.reactions to authenticated;

drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions
  for select using (true);

/*
 * Writes go through `react` and not through the table. The policy allows a
 * person their own row anyway, because a policy that forbids what the
 * function does is a function that stops working the day it is not
 * `security definer` any more - but the Klub rule for Worlds lives in the
 * function, which is why the function is the door.
 */
drop policy if exists reactions_own on public.reactions;
create policy reactions_own on public.reactions
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/**
 * React, change your mind, or take it back.
 *
 * Passing the face you already have takes it off, which is what every
 * reaction control anybody has used does. Passing a different one moves
 * it. Returns the face that is now on, or null.
 *
 * The one rule that is not about the person: a World may only be reacted
 * to by somebody in the Klub. Checked here rather than in the page,
 * because a page is a suggestion - and checked with `in_the_klub` so a
 * lapsed membership stops working the day it lapses.
 */
/*
 * The parameters are `what` and `which` rather than `target_type` and
 * `target_id`, and that is not a style choice: those two are also columns
 * of the table this function writes to, and Postgres cannot tell a
 * parameter from a column of the same name inside a statement that touches
 * both - "column reference target_type is ambiguous", which is what the
 * first version of this did on its first call.
 */
create or replace function public.react(
  what text, which text, face text
)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  had text;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  if what not in ('post', 'world') then
    raise exception 'You can react to a post or a World.';
  end if;

  if face is not null and face not in (
    'angry', 'happy-grin', 'heart-eyes', 'laugh', 'sad',
    'shocked', 'skull', 'smile', 'sunglasses', 'winky-grin'
  ) then
    raise exception 'That is not one of the faces.';
  end if;

  -- Reacting to a World is a Klub thing. Posts are for everybody.
  if what = 'world' and not public.in_the_klub(me, 'lite') then
    raise exception 'Reacting to a World is a Kobblon Klub thing.';
  end if;

  /*
   * The thing has to exist, and has to be one this person could be
   * looking at. Without this, a reaction is a way to find out whether a
   * numbered row exists by whether the insert succeeds.
   */
  if what = 'post' then
    if which !~ '^[0-9]+$' then
      raise exception 'There is no post with that number.';
    end if;
    if not exists (
      select 1 from public.community_posts p
       where p.id = which::bigint and not p.is_removed
    ) then
      raise exception 'There is no post with that number.';
    end if;
  else
    if not exists (
      select 1 from public.worlds w
       where w.id::text = which and not w.is_removed
    ) then
      raise exception 'There is no World with that number.';
    end if;
  end if;

  select r.face into had from public.reactions r
   where r.target_type = what
     and r.target_id = which
     and r.user_id = me;

  -- The same one again, or nothing at all, takes it off.
  if face is null or had = face then
    delete from public.reactions r
     where r.target_type = what
       and r.target_id = which
       and r.user_id = me;
    return null;
  end if;

  insert into public.reactions (target_type, target_id, user_id, face)
  values (what, which, me, react.face)
  on conflict (target_type, target_id, user_id)
  do update set face = excluded.face, created_at = now();

  return face;
end $$;

revoke all on function public.react(text, text, text) from public;
grant execute on function public.react(text, text, text) to authenticated;

/**
 * What is on one thing: every face that has been used, how many times, and
 * which one is yours.
 *
 * Only the faces somebody actually pressed come back. A row of ten zeroes
 * is ten things to read and no information in any of them.
 */
create or replace function public.reactions_on(what text, which text)
returns table (face text, how_many integer, mine boolean)
language sql stable security definer
set search_path = public, extensions as $$
  select r.face,
         count(*)::integer,
         bool_or(r.user_id = auth.uid())
    from public.reactions r
   where r.target_type = what
     and r.target_id = which
   group by r.face
   order by count(*) desc, r.face
$$;

grant execute on function public.reactions_on(text, text) to anon, authenticated;

/**
 * The same, for a page full of things at once.
 *
 * A wall of twenty posts asking `reactions_on` twenty times is twenty
 * round trips before anybody can read the first one. This takes the whole
 * list and answers in one.
 */
create or replace function public.reactions_on_many(
  what text, whichever text[]
)
returns table (target_id text, face text, how_many integer, mine boolean)
language sql stable security definer
set search_path = public, extensions as $$
  select r.target_id,
         r.face,
         count(*)::integer,
         bool_or(r.user_id = auth.uid())
    from public.reactions r
   where r.target_type = what
     and r.target_id = any (whichever)
   group by r.target_id, r.face
   order by r.target_id, count(*) desc, r.face
$$;

grant execute on function public.reactions_on_many(text, text[]) to anon, authenticated;

commit;
