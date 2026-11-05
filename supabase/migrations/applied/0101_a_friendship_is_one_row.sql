begin;

-- A friendship is one row, whichever way round it was asked.
--
-- Two bugs a tester found, and they are one bug:
--
--   "it allows me to add people i already have added"
--   "when someone sends a friend request and u go to their profile to add
--    them... there is somehow 2 copies of profiles"
--
-- The unique constraint is `(requester_id, addressee_id)`, which is
-- directional - so A asking B and B asking A are two different rows and both
-- are allowed. Press Add on somebody who has already asked you and there are
-- now two friendships between two people. Accept both and every list built
-- from this table shows that person twice.
--
-- Nothing was wrong with the client. The rule it was keeping - "do not ask
-- somebody who already asked you" - was never written down anywhere that
-- could refuse it, and a rule only the client keeps is a rule.

-- --------------------------------------------------- tidying what exists

/*
 * Any pair that already has two rows keeps one: an accepted one if there is
 * one, because two people who are friends by either row are friends; and the
 * oldest otherwise, because that is the request that was actually made first.
 */
with pairs as (
  select id,
         least(requester_id, addressee_id) as low,
         greatest(requester_id, addressee_id) as high,
         status,
         created_at,
         row_number() over (
           partition by least(requester_id, addressee_id), greatest(requester_id, addressee_id)
           order by (status = 'accepted') desc, (status = 'blocked') desc, created_at
         ) as keep
    from public.friendships
)
delete from public.friendships f
 using pairs p
 where f.id = p.id and p.keep > 1;

-- --------------------------------------------------------- the real rule

/*
 * One row per pair of people, in whichever order they are written. The old
 * directional constraint stays: it costs nothing and it is still true.
 */
create unique index if not exists friendships_one_per_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

commit;
