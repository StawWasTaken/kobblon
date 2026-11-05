begin;

-- The function took a verdict the table refused
-- -----------------------------------------------------------------------
--
-- 0190 added `quieted` to `apply_ai_verdict`'s list of accepted verdicts
-- and not to `ai_reviews`'s check constraint. So the function validated the
-- word, built the row, and the table threw it out - which, because the
-- insert is the first thing the function does, meant the verdict did
-- nothing at all and raised a constraint error at the worker instead.
--
-- The shape, which is the third time today something of this family has
-- turned up: **two places that both have to know the same list, and only
-- one of them was told.** A function's own validation reads like the
-- authority and is not.

alter table public.ai_reviews drop constraint if exists ai_reviews_decision_check;
alter table public.ai_reviews add constraint ai_reviews_decision_check
  check (decision = any (array[
    'approved', 'rejected', 'warned', 'quieted', 'suspended', 'nothing', 'unsure'
  ]));

commit;
