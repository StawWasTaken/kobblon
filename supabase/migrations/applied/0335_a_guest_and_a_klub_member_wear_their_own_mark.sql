-- A guest and a Klub member wear their own mark.
--
-- `name_marks` has answered "verified, staff, or nothing" since 0180. Two
-- more facts about a name are worth saying beside it, and both of them
-- already exist in the database with nowhere to be shown:
--
--   * **guest** - an account that has not been made real yet. Staw added the
--     artwork and asked for it to work exactly like the tick. It is not an
--     honour and it is not meant to read as one; it says "this person is
--     visiting", which is useful to know before you trade with them, add
--     them, or believe them.
--   * **klub** - a membership that is running today. `in_the_klub` has been
--     the answer since 0235 and nothing has ever drawn it.
--
-- The part that is easy to get wrong, and the reason this is not a one-line
-- change to `name_marks`: **the two list functions filter.** They return
-- only rows where somebody is verified or wears the k, because that was the
-- whole set. A guest is neither, so adding the mark to `name_marks` alone
-- would have changed nothing anybody could see - the row is dropped before
-- the mark is read. The filter becomes "wears anything at all", said once as
-- `wears_any_mark`, so the next mark added here cannot repeat this.
--
-- Applying this twice is a no-op; every function is `create or replace` with
-- an unchanged signature.

begin;

set search_path = public, extensions;

-- ------------------------------------------------------------- the facts

/**
 * Whether this account is still a guest.
 *
 * Its own function, beside `is_name_verified` and `wears_staff_badge`, so
 * that "what does a name wear" is one list of questions with one shape
 * rather than a column read inline in three places.
 */
create or replace function public.is_name_guest(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select coalesce((select is_guest from public.profiles where id = who), false);
$$;

grant execute on function public.is_name_guest(uuid) to anon, authenticated;

/**
 * Whether this account's Klub membership is running today.
 *
 * A thin wrapper on `in_the_klub` so the marks all read the same way. The
 * tier is deliberately not in the mark: the badge says "in the Klub", and
 * lite, klub and life are a matter for the Klub page rather than for a
 * glyph twelve pixels wide.
 */
create or replace function public.wears_klub_mark(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select public.in_the_klub(who, 'lite');
$$;

grant execute on function public.wears_klub_mark(uuid) to anon, authenticated;

-- -------------------------------------------------------------- the marks

/**
 * Everything a name wears, in the order it is drawn.
 *
 * Verified, then staff, then Klub, then guest. The order is the order of
 * the answer and the website draws it in the order it arrives, so this is
 * where "which mark comes first" is decided - not in twenty components.
 *
 * Guest last because it is the one that is not a credential.
 */
create or replace function public.name_marks(who uuid)
returns text[]
language sql stable
set search_path = public, extensions as $$
  select array_remove(array[
    case when public.is_name_verified(who) then 'verified' end,
    case when public.wears_staff_badge(who) then 'staff' end,
    case when public.wears_klub_mark(who) then 'klub' end,
    case when public.is_name_guest(who) then 'guest' end
  ], null)
$$;

grant execute on function public.name_marks(uuid) to anon, authenticated;

/**
 * Whether this name wears anything at all.
 *
 * The one place the list functions ask, so that a mark added above reaches
 * the lists without anybody remembering to widen a `where`. That is exactly
 * what went wrong the first time this was extended: the mark was added and
 * the filter was not, and the result was a function returning a correct
 * answer for rows nothing asked about.
 */
create or replace function public.wears_any_mark(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select cardinality(public.name_marks(who)) > 0;
$$;

grant execute on function public.wears_any_mark(uuid) to anon, authenticated;

-- ------------------------------------------------------------- the lists

create or replace function public.name_marks_for(who uuid[])
returns table (id uuid, marks text[])
language sql stable
set search_path = public, extensions as $$
  select p.id, public.name_marks(p.id)
    from public.profiles p
   where p.id = any(who)
     and public.wears_any_mark(p.id)
$$;

grant execute on function public.name_marks_for(uuid[]) to anon, authenticated;

create or replace function public.name_marks_by_name(names text[])
returns table (username text, marks text[])
language sql stable
set search_path = public, extensions as $$
  select p.username, public.name_marks(p.id)
    from public.profiles p
   where lower(p.username) = any (select lower(n) from unnest(names) n)
     and public.wears_any_mark(p.id)
$$;

grant execute on function public.name_marks_by_name(text[]) to anon, authenticated;

commit;
