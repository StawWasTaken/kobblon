begin;

-- The one the battery caught
-- -----------------------------------------------------------------------
--
-- `go\s*(and\s*)?die` was in 0185 to catch "go die", and it also caught
--
--     go die in the lava
--
-- which is how people talk about a World. That is the worst kind of mistake
-- this filter can make: a suspension, on the serious ladder, with a report
-- opened about the account, for a sentence about a game. A miss costs one
-- unpleasant message; this costs somebody their account's standing for
-- nothing, and teaches everybody that Kobblon's moderation is random.
--
-- So "go die" only counts when nothing follows it that makes it about a
-- place. "go die in the lava", "go die on the roof", "go die at spawn" are
-- all sentences about a World. "go die", "go die plz", "go die already"
-- are not about anywhere.
--
-- The cost, said out loud: **"go die in a hole" now gets through.** That is
-- the wrong way round in the abstract and the right way round in practice,
-- because the alternative is the lava. The directed forms - "go die irl",
-- anything with "yourself" in it - are untouched and still serious.

delete from public.moderation_terms
 where scope = 'serious' and pattern = '(^|[^a-z])go\s*(and\s*)?die(?![a-z])';

insert into public.moderation_terms (pattern, decision, reason, scope) values
  ('(^|[^a-z])go\s*(and\s*)?die(?![a-z])(?!\s*(in|on|at|to|from|under|behind|near)(?![a-z]))',
   'block', 'Telling somebody to end their life', 'serious')
on conflict (pattern, scope) do nothing;

commit;
