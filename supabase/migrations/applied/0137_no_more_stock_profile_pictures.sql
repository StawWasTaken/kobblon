begin;

-- The eight stock pictures are gone, and so are the rows pointing at them.
--
-- They were handed out at random so an account always had something. A
-- profile picture is a shot of the person's own avatar now, so a stock
-- picture is not a fallback - it is a different person's face sitting on
-- their account until they notice.
--
-- The files are deleted from the site, which means every row still naming
-- one is a broken image. Nulled rather than left: empty is the ordinary
-- state and the thing that draws a headshot fills it the next time they look
-- at themselves.
--
-- Matched on the path rather than on a list of eight names, so a ninth that
-- somebody added before this does not survive by being unlisted.

update public.profiles
   set avatar_url = null
 where avatar_url like '%/brand/avatars/%';

commit;
