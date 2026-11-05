begin;

-- The prefix nobody tested
-- -----------------------------------------------------------------------
--
-- Every word pattern on the list begins `(^|[^a-z])`, which does not mean
-- "a whole word" - it means the word has to **start** there. 0017 took the
-- boundary off the end so "fuckyou" was caught, and left the one on the
-- front alone. So the other half of the same bypass was open the whole
-- time: put any letters in front and the line goes through.
--
--   fucker        -> block
--   motherfucker  -> ok
--
-- Same for bullshit, dumbfuck, clusterfuck, horseshit. Not a clever
-- bypass; just a word with a word in front of it.
--
-- This is not stricter. No word is added. It is the words already on the
-- list being found where they actually are.
--
-- The anchor comes off only where no ordinary word contains the stem.
-- It stays on `rape` (therapeutic, grape, scrape), `pedo` (torpedo),
-- `cock` (peacock, cockpit), `nigg` (snigger) and `cum` (document,
-- cucumber) - there the prefix guard is the only thing keeping the filter
-- off innocent writing, and `cunt` keeps a guard of its own for
-- Scunthorpe.

update public.moderation_terms
   set pattern = '(?<!s)(fuck|shit|bitch|cunt|whore|slut)'
 where pattern = '(^|[^a-z])(fuck|shit|bitch|cunt|whore|slut)';

update public.moderation_terms
   set pattern = 'f[uaeio]{1,2}c*k+(?![a-z])'
 where pattern = '(^|[^a-z])f[uaeio]{1,2}c*k+(?![a-z])';

update public.moderation_terms
   set pattern = 'sh[ia1y]{1,2}t+(?![a-z])'
 where pattern = '(^|[^a-z])sh[ia1y]{1,2}t+(?![a-z])';

update public.moderation_terms
   set pattern = 'b[iy1]+t?ch'
 where pattern = '(^|[^a-z])b[iy1]+t?ch';

update public.moderation_terms
   set pattern = '(?<!s)c+u+n+t+(?![a-z])'
 where pattern = '(^|[^a-z])c+u+n+t+(?![a-z])';

update public.moderation_terms
   set pattern = 'p+u+s+s+(y|i)+(e?s)?(?![a-z])'
 where pattern = '(^|[^a-z])p+u+s+s+(y|i)+(e?s)?(?![a-z])';

update public.moderation_terms
   set pattern = 'a+s+h+[o0]+l+e'
 where pattern = '(^|[^a-z])a+s+h+[o0]+l+e';

update public.moderation_terms
   set pattern = 'd[iy1]+c*k+h[e3a]+d'
 where pattern = '(^|[^a-z])d[iy1]+c*k+h[e3a]+d';

update public.moderation_terms
   set pattern = '(b+a+s+t+a+r+d|d+o+u+c+h+e+(b+a+g)?|p+r+i+c+k+(?![a-z]))'
 where pattern = '(^|[^a-z])(b+a+s+t+a+r+d|d+o+u+c+h+e+(b+a+g)?|p+r+i+c+k+(?![a-z]))';

update public.moderation_terms
   set pattern = '(w+a+n+k+s+t+a|t+w+a+t+(?![a-z])|a+r+s+e+h+o+l+e)'
 where pattern = '(^|[^a-z])(w+a+n+k+s+t+a|t+w+a+t+(?![a-z])|a+r+s+e+h+o+l+e)';

commit;
