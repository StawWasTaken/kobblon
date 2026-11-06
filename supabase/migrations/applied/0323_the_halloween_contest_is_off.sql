begin;

/*
 * The Halloween avatar contest is cancelled, so it goes.
 *
 * Staw: "in the forums delete everything about the halloween avatar
 * contests - we cancel it this year".
 *
 * Everything is three rooms and not one. 0313 built "Avatar contests", a
 * year inside it, and the contest inside that, and the two above it are
 * containers that exist only to hold contests - with the contest gone they
 * are two empty staff-only rooms in a six-room forum, which is furniture.
 * So the family goes and the forum is the six rooms it was before, and the
 * tree that 0313 built stays: the next contest puts its own rooms back.
 *
 * The topics in it go with it, which is said plainly rather than done
 * quietly: `forum_topics.category` is `on delete restrict`, so a category
 * with anything in it cannot simply be dropped, and a migration that fails
 * halfway is worse than one that says what it removed. Posts and views
 * follow by cascade. A contest nobody entered deletes nothing; a contest
 * somebody posted in deletes their posts, and that is what cancelling it
 * means.
 */
do $$
declare
  rooms text[] := array[
    'avatar-contest-halloween-2026', 'avatar-contests-2026', 'avatar-contests'
  ];
  topics integer;
begin
  select count(*) into topics
    from public.forum_topics where category = any (rooms);
  raise notice 'Taking down the avatar contest: % topic(s) go with it.', topics;

  delete from public.forum_topics where category = any (rooms);

  /* Deepest first: a parent cannot go while a child still points at it. */
  delete from public.forum_categories where slug = 'avatar-contest-halloween-2026';
  delete from public.forum_categories where slug = 'avatar-contests-2026';
  delete from public.forum_categories where slug = 'avatar-contests';
end $$;

/*
 * And the band on the homepage that pointed at it.
 *
 * 0321 seeded the contest as a row so the homepage would keep the header it
 * had; that seed is gone from 0321 now, but this runs on a database where
 * it may already have been applied - and a band whose button leads to a
 * category that no longer exists is the worst thing the homepage can be
 * carrying. Matched on the link rather than the name, because the link is
 * the part that is now a dead end.
 *
 * Only that one. Anything a superadmin has written since is theirs.
 */
delete from public.platform_events
 where link = '/forum/c/avatar-contest-halloween-2026';

commit;
