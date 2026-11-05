begin;

-- "pussy"
-- -----------------------------------------------------------------------
--
-- Staw found it by typing it. It was never on the list, and nor were a
-- dozen others in the same category - the list was written quickly in 0011
-- and nothing has gone back over it since.
--
-- The line the guidelines draw, and the one these are sorted by: ordinary
-- swearing is allowed to be said and is masked; sexual language aimed at a
-- person, and slurs, are not. Nothing here changes what is *decided* about
-- an account - these are masked like the rest and count one strike, the
-- same as "fuck" - it is only that they were missing from a list that was
-- always meant to have them.
--
-- The three that are deliberately NOT here, so the next person does not
-- add them: `gay`, `lesbian` and `trans` as plain words. They are how
-- people describe themselves, and a platform that masks them has said
-- something about its users that Kobblon does not mean.

insert into public.moderation_terms (pattern, decision, reason, scope) values
  ('(^|[^a-z])p+u+s+s+(y|i)+(e?s)?(?![a-z])', 'block', 'Sexual', 'all'),
  ('(^|[^a-z])(d+i+l+d+o|b+l+o+w+j+o+b|b+j+o+b|h+a+n+d+j+o+b)', 'block', 'Sexual', 'all'),
  ('(^|[^a-z])(c+o+c+k+s*(?![a-z])|p+e+n+i+s|v+a+g+i+n+a)', 'block', 'Sexual', 'all'),
  ('(^|[^a-z])(t+i+t+t+(y|i+e)s*|b+o+o+b+(s|i+e+s)?)(?![a-z])', 'block', 'Sexual', 'all'),
  ('(^|[^a-z])(j+e+r+k+\s*o+f+f|w+a+n+k+(e+r)?|m+a+s+t+u+r+b)', 'block', 'Sexual', 'all'),
  ('(^|[^a-z])(h+o+r+n+y|c+u+m+(m+i+n+g)?(?![a-z]))', 'block', 'Sexual', 'all'),
  ('(^|[^a-z])(s+e+x+(y+)?\s*(m+e|w+i+t+h)|s+e+n+d\s*n+u+d+e)', 'block', 'Sexual', 'all'),
  ('(^|[^a-z])(b+a+s+t+a+r+d|d+o+u+c+h+e+(b+a+g)?|p+r+i+c+k+(?![a-z]))', 'block', 'Insult', 'all'),
  ('(^|[^a-z])(w+a+n+k+s+t+a|t+w+a+t+(?![a-z])|a+r+s+e+h+o+l+e)', 'block', 'Insult', 'all'),
  ('(^|[^a-z])(s+p+(i+c+|a+s+t+i+c)(?![a-z])|m+o+n+g+o+l+o+i+d|c+r+i+p+p+l+e+d*(?![a-z]))', 'block', 'Slur', 'all'),
  ('(^|[^a-z])(c+h+i+n+k+(?![a-z])|g+o+o+k+(?![a-z])|k+i+k+e+(?![a-z])|w+e+t+b+a+c+k)', 'block', 'Slur', 'all'),
  ('(^|[^a-z])(t+r+a+n+n+(y|i+e)|s+h+e+m+a+l+e|d+y+k+e+(?![a-z]))', 'block', 'Slur', 'all')
on conflict (pattern, scope) do nothing;

-- The skeletons, for the same words spelled out. Same rule as 0183: these
-- only ever run where the structure already says somebody was spacing a
-- word out, which is why they can afford to have no vowels.
insert into public.moderation_terms (pattern, decision, reason, scope) values
  ('p+u*s+s+[yi]+',   'block', 'Spelled out', 'spaced'),
  ('c+[o0]*c+k+',     'block', 'Spelled out', 'spaced'),
  ('t+w+[a4]*t+',     'block', 'Spelled out', 'spaced'),
  ('b+[a4]*s+t+[a4]*r+d+', 'block', 'Spelled out', 'spaced')
on conflict (pattern, scope) do nothing;

commit;
