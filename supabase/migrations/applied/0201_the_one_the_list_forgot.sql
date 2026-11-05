begin;

-- The word next to the word that was on the list
-- -----------------------------------------------------------------------
--
-- "you suck dicks dont you" went through a World's chat untouched, on the
-- same screen where "shut your ••••••••" was masked. Not a bypass, not a
-- clever spelling - `dickhead` was on the list and `dick` never was, the
-- same way `cock` was there and its obvious neighbour was not.
--
-- The end guard is what keeps this off ordinary writing: `(?![a-z])` means
-- "dickens", "dickinson" and "haddock" are not matched. A name spelled
-- exactly "Dick" is, and that is the trade - it is a word people use as an
-- insult far more often than as a name here.
--
-- Nothing about the standard changes. These are words of the same kind as
-- the ones already listed, and they were missing from a list rather than
-- deliberately allowed.

insert into public.moderation_terms (pattern, decision, reason, scope) values
  ('d+[i1]+c+k+s*(?![a-z])', 'block', 'Strong language', 'all'),
  ('b+o+l+l+o+c+k+s*(?![a-z])', 'block', 'Strong language', 'all'),
  ('b+e+l+l+e+n+d+(?![a-z])', 'block', 'Strong language', 'all'),
  ('m+i+n+g+e+(?![a-z])', 'block', 'Strong language', 'all'),
  ('n+o+n+c+e+(?![a-z])', 'block', 'Strong language', 'all'),
  ('w+a+n+k+(e+r+|i+n+g+)?(?![a-z])', 'block', 'Strong language', 'all')
on conflict do nothing;

-- And the spelled-out forms, so "d i c k" is the same answer.
insert into public.moderation_terms (pattern, decision, reason, scope) values
  ('d+[i1]*c+k+', 'block', 'Strong language', 'spaced'),
  ('b+o*l+o*c+k+', 'block', 'Strong language', 'spaced')
on conflict do nothing;

commit;
