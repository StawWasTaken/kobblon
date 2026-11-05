begin;

-- Who fills `marks` on a chat line
-- -----------------------------------------------------------------------
--
-- The apps draw `ChatLine.marks` now and nothing fills it, because nothing
-- could: the alternative they named - a window reading a profile per speaker
-- and deciding for itself - is the twenty-one call sites `NameMarks` was
-- written to end, and it would disagree with the database the week a flag
-- changes meaning. So the answer is resolved here and carried with the line.
--
-- Two functions: one for a single person, one for a set of them, because a
-- transport handing over a room's worth of lines should ask once rather than
-- once per line.
--
-- The order is the order they are drawn: verified, then staff. It is decided
-- here so two windows cannot draw them in two orders.
--
-- Also repaired while passing: `wears_staff_badge` and the verified rule both
-- predate `is_superadmin` and neither knew about it. A superadmin whose
-- `is_admin` column happened to be false would have worn no mark at all -
-- which is not reachable today, because 0172 sets both, but it is the same
-- staleness that bit `guard_profile_update` in 0175 and it is cheaper to fix
-- than to remember.

create or replace function public.wears_staff_badge(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select coalesce(
    (select has_staff_badge or is_admin or is_moderator or is_superadmin
       from public.profiles where id = who),
    false
  );
$$;

/**
 * Whether somebody's name carries the tick.
 *
 * The mirror of `isVerified` in `@/components/brand/Verified`, and the two
 * have to say the same thing: Kobblon's own accounts are verified by being
 * Kobblon, and everybody else by being given it.
 */
create or replace function public.is_name_verified(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select coalesce(
    (select is_verified or is_admin or is_superadmin
       from public.profiles where id = who),
    false
  );
$$;

grant execute on function public.is_name_verified(uuid) to anon, authenticated;

/**
 * The marks beside one name, in the order they are drawn.
 *
 * Empty rather than null for somebody who wears neither, so a caller can
 * hand the answer straight to a line without a coalesce it will forget.
 */
create or replace function public.name_marks(who uuid)
returns text[]
language sql stable
set search_path = public, extensions as $$
  select array_remove(array[
    case when public.is_name_verified(who) then 'verified' end,
    case when public.wears_staff_badge(who) then 'staff' end
  ], null)
$$;

grant execute on function public.name_marks(uuid) to anon, authenticated;

/**
 * The same, for everybody in a room at once.
 *
 * One round trip per set of speakers rather than one per line. Only the
 * people who wear something come back - a line whose speaker is absent from
 * the result wears nothing, which is the common case and not worth a row.
 */
create or replace function public.name_marks_for(who uuid[])
returns table (id uuid, marks text[])
language sql stable
set search_path = public, extensions as $$
  select p.id, public.name_marks(p.id)
    from public.profiles p
   where p.id = any(who)
     and (public.is_name_verified(p.id) or public.wears_staff_badge(p.id))
$$;

grant execute on function public.name_marks_for(uuid[]) to anon, authenticated;

commit;
