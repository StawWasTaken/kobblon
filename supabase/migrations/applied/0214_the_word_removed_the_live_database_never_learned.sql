begin;

-- The word "removed", which the live database never learned
-- -----------------------------------------------------------------------
--
-- 0174 added this value and never reached the live database, the same way
-- 0172, 0173 and 0176 to 0178 did not. `take_down` sets an asset's status to
-- 'removed' by name, so without it the one action a report console exists
-- for raises "invalid input value for enum moderation_status".
--
-- Alone in its own file, and that is not tidiness. Postgres refuses to use a
-- new enum value in the transaction that added it, and the Supabase SQL
-- editor runs a whole file as one transaction - so anything naming 'removed'
-- has to wait for the next migration. That is exactly how
-- `unsafe use of new value "mesh" of enum type asset_kind` happened here
-- before.
alter type public.moderation_status add value if not exists 'removed';

commit;
