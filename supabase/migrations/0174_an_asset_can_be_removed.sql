begin;

-- `take_down` on a Create asset has never worked
-- -----------------------------------------------------------------------
--
-- 0089 gave Kobblon a takedown, and its asset branch does this:
--
--     update public.assets set status = 'removed' where id = which
--
-- `assets.status` is `moderation_status`, which 0005 created as
-- ('pending', 'approved', 'rejected'). There is no 'removed', so that
-- statement has raised `invalid input value for enum moderation_status`
-- every time it has been reached - which is to say taking down an uploaded
-- model has been impossible since the day the button appeared. Found while
-- resolving a report's subject, not by reading the function: the value is a
-- string in both places and the two files look consistent.
--
-- This migration adds the value and does nothing else, because Postgres will
-- not let a new enum value be used in the transaction that added it
-- ('unsafe use of new value'). Everything that names it is in 0175.

alter type public.moderation_status add value if not exists 'removed';

commit;
