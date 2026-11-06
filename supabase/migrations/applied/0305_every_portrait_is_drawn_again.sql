begin;

/*
 * Every stored profile picture is out of date as of now.
 *
 * Staw: "could we also have a migration or wahetever to now refresh all of
 * the PFPs of all players of kobblon right now so that the old bugged PFPs
 * are fixed".
 *
 * **What this cannot do, said first.** A portrait is a WebGL render: the
 * avatar is dressed in a browser, the head is photographed, and the result
 * is uploaded as a file. Postgres cannot draw one. No migration can.
 *
 * What it can do is make every stored one *read as out of date*, which is
 * the same outcome by the only route there is. `portraitIsCurrent` compares
 * the stamp in the filename - `portrait-<when>.webp` - against
 * `avatar_changed_at`. Older means the picture is of who they used to be,
 * and the site then:
 *
 *   * draws the face fresh in the browser everywhere that person is shown,
 *     immediately, for everybody looking - so the bugged pictures stop
 *     being seen the moment this runs; and
 *   * saves a new one, permanently, the next time **that person** opens a
 *     page while signed in, because a page may not write to somebody
 *     else's row and should not be able to.
 *
 * So this is immediate for viewers and gradual for the stored files, and
 * the stored file is only the cache. Somebody who never signs in again
 * keeps a stale file in the bucket that nothing ever shows.
 *
 * It is safe to run twice, and safe to run on a Tuesday for no reason: the
 * worst it costs is one redraw each.
 *
 * Only rows holding a drawn portrait are touched. An uploaded picture is
 * not a portrait and is already ignored by the rule above, and a row with
 * nothing stored is already drawn live - moving either would be a write
 * that changes nothing.
 */

set search_path = public, extensions;

/**
 * Mark every stored portrait as old, and say how many.
 *
 * A function rather than only the statement below, because this is the
 * second time a drawing bug has needed every face redrawn and it will not
 * be the last. Staff can run it from the SQL editor without this file
 * being found and copied.
 *
 * `security definer` so it is not subject to the caller's policies, and
 * `require_admin()` so that privilege is not simply handed to everybody
 * with an account - the two always go together.
 */
create or replace function public.refresh_every_portrait()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  touched integer;
begin
  perform public.require_admin();

  update public.profiles
     set avatar_changed_at = clock_timestamp()
   where avatar_url like '%portrait-%.webp';

  get diagnostics touched = row_count;
  return touched;
end;
$$;

grant execute on function public.refresh_every_portrait() to authenticated;

/*
 * And once, now, which is what was actually asked for.
 *
 * The statement is repeated rather than calling the function above: the
 * function insists on an admin, and this file is applied in the SQL editor
 * where there is no signed-in person at all. Calling it here would fail on
 * `require_admin()` - which is the function behaving correctly and the
 * migration failing for no reason.
 *
 * `avatar_changed_at` is not pinned by `guard_profile_update`, and that
 * guard returns early when `auth.uid()` is null, which is the case here.
 * Both were checked rather than assumed; this project has lost days to a
 * privileged write a row-level guard quietly undid.
 */
do $$
declare
  touched integer;
begin
  update public.profiles
     set avatar_changed_at = clock_timestamp()
   where avatar_url like '%portrait-%.webp';

  get diagnostics touched = row_count;
  raise notice 'Marked % stored portraits as out of date. They redraw on sight and are saved again when each person next signs in.', touched;
end;
$$;

commit;
