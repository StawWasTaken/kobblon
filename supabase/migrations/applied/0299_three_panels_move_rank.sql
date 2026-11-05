begin;

/*
 * Three panels change hands, and the inbox stops being readable by staff.
 *
 * Staw, 25 October, looking at what 0298 left: "make 'words' superadmin
 * actually, make 'record' mod, make 'map' admin". Plus a thing he found on
 * his own account, which is the serious half of this file: "the inbox
 * messages arent for one single user, everyone sees everyone else's inbox
 * messages".
 *
 * The three moves, and why each one is where it is:
 *
 *   * **Words** is superadmin. It is the one admin panel that writes a rule
 *     every piece of text on the platform is run through; a bad pattern
 *     there is a platform that refuses everybody, and 0099 already says so
 *     in its own comments.
 *   * **Record** is a moderator's. It is what staff have done, and a
 *     moderator reading it is a moderator checking their own work and the
 *     decisions they are about to build on. 0298 moved it up with the
 *     economy, which read it as a privilege rather than as a log.
 *   * **Map** is an admin's. It is counts by zone and names nobody, so it
 *     is not dangerous; it is also nothing a moderator working a queue
 *     needs, and it was a moderator's by default rather than by decision.
 *
 * The gates are rewritten from `pg_get_functiondef` for the reason 0298
 * gives: several of these have been replaced more than once and pasting a
 * body here would revert whichever version this file did not know about.
 */

-- -------------------------------------------------- the three panels move

do $$
declare
  /* Each row: the function, and the rank it answers to from now on. */
  moves text[][] := array[
    -- Words: what the moderation system catches, for everything anybody writes.
    ['admin_terms', 'superadmin'],
    ['admin_save_term', 'superadmin'],
    ['admin_delete_term', 'superadmin'],
    ['admin_try_term', 'superadmin'],
    -- Record: what staff have done, which is a moderator's to read.
    ['staff_record', 'moderator'],
    ['staff_record_kinds', 'moderator'],
    -- Map: where people are, by zone and by nobody's name.
    ['where_people_are', 'admin']
  ];
  at integer;
  name text;
  want text;
  one record;
  source text;
  changed text;
  found boolean;
begin
  for at in 1 .. array_length(moves, 1) loop
    name := moves[at][1];
    want := moves[at][2];
    found := false;

    for one in
      select p.oid, pg_get_functiondef(p.oid) as def
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = name
    loop
      found := true;
      source := one.def;
      changed := source;

      /*
       * Every spelling of a gate these files use, pointed at the one rank
       * this function now answers to. Replacing all three rather than the
       * one it happens to carry today is what makes the file safe to run
       * whether or not 0298 has been applied to this database - and it is
       * why the "already done" test below is a comparison rather than a
       * search for a word, which is the mistake 0298 made and wrote down.
       */
      changed := replace(changed, 'public.require_moderator()', 'public.require_' || want || '()');
      changed := replace(changed, 'public.require_admin()', 'public.require_' || want || '()');
      changed := replace(changed, 'public.require_superadmin()', 'public.require_' || want || '()');
      changed := replace(changed, 'public.is_moderator()', 'public.is_' || want || '()');
      changed := replace(changed, 'public.is_admin()', 'public.is_' || want || '()');
      changed := replace(changed, 'public.is_superadmin()', 'public.is_' || want || '()');

      if changed = source then
        /* Unchanged means one of two things, and they are opposites. */
        if source like '%public.is_' || want || '()%'
           or source like '%public.require_' || want || '()%' then
          continue;
        end if;
        raise exception
          'public.% carries no gate this migration knows how to move. Look at it by hand.',
          name;
      end if;

      execute changed;
    end loop;

    if not found then
      raise exception 'public.% does not exist. The move cannot be checked.', name;
    end if;
  end loop;
end $$;

-- ------------------------------------------------ post is nobody else's

/*
 * Your inbox is yours, and staff have no screen that needs it.
 *
 * `mail_read` has said `user_id = auth.uid() or public.is_moderator()`
 * since 0072, which was written beside the policies for violations,
 * appeals and tickets - and for those three it is correct, because the
 * console has a queue built on each of them. There is no staff screen for
 * somebody's post, so the exception bought nothing and cost this: every
 * moderator's own inbox listed every letter Kobblon has ever written to
 * anybody, because the page asks the table for its rows and the table was
 * willing.
 *
 * It is the same shape as "WHY CAN I SEE TICKETS MADE BY OTHER PEOPLE" in
 * August, and worth saying what is different. There the page was narrowed
 * and the policy stayed open, because the console genuinely reads every
 * ticket. Here nothing reads this but the person it was written to, so the
 * policy closes too: a page that asks for the right rows is a courtesy, and
 * the wall is the policy.
 *
 * Nothing staff-facing breaks. `send_mail`, `unread_mail`, `read_mail` and
 * `read_all_mail` are all `security definer` and do not consult this
 * policy; the moderation functions that write a letter go through
 * `send_mail`.
 */
drop policy if exists mail_read on public.mail;
create policy mail_read on public.mail for select
  using (user_id = auth.uid());

commit;
