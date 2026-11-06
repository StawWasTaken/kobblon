begin;

/*
 * The filter over a Community wall, re-asserted and then proved.
 *
 * Staw: "apparently community posts dont have the kobblon filter on".
 *
 * By the files it has been on since 0170: `community_posts_are_censored`,
 * `before insert or update of body`, running `words_are_censored`, which
 * masks `new.body` whatever table it is on. Nothing since drops it - every
 * later migration that touches that function uses `create or replace`,
 * which leaves the triggers pointing at it alone. So this migration does
 * not fix a bug I found in the files; it settles the question against the
 * database that is actually running, which is the only one that counts.
 *
 * Re-creating a trigger that is already there costs nothing and is the
 * cheapest way to rule out the one thing the files cannot tell me: whether
 * it was dropped by hand, or lost when a table was recreated. If it was
 * missing, this puts it back. If it was there, this changes nothing and the
 * check below still has to pass.
 */
drop trigger if exists community_posts_screen on public.community_posts;
drop trigger if exists community_posts_are_censored on public.community_posts;
create trigger community_posts_are_censored
  before insert or update of body on public.community_posts
  for each row execute function public.words_are_censored();

/*
 * And the check, which is the point of the migration rather than a
 * footnote on it.
 *
 * It asks `censor_text` directly rather than inserting a post, because an
 * insert needs a Community, a membership and an identity, and a check that
 * needs that much scaffolding is a check that gets skipped. What it proves
 * is the half that was in doubt: that the filter the trigger calls does
 * mask a word on this database. If somebody has emptied
 * `moderation_terms`, or the scope on those rows is not one the wall uses,
 * this raises here rather than being discovered on the wall.
 */
do $$
declare
  masked text;
begin
  masked := public.censor_text('fuck this', 'say');
  if masked = 'fuck this' then
    raise exception
      'The filter is not masking: censor_text left the line alone. Check that moderation_terms has rows with scope all or say.';
  end if;
  raise notice 'The filter masks: % -> %', 'fuck this', masked;
end $$;

commit;
