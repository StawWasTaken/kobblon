begin;

-- A post can carry a clip
-- -----------------------------------------------------------------------
--
-- Staw: "i also want to be able to upload videos, and more than just 2mb, i
-- want it to be up to 40mb".
--
-- Both of those live in the bucket rather than in a table. 0275 created
-- `forum` with `file_size_limit` at two megabytes and four image types, and
-- storage refuses on those before any policy or function of ours is
-- consulted - so a browser that allowed a 30MB clip would get a refusal from
-- Supabase and a composer that looked broken. This is the half of the limit
-- that is actually the limit; the composer's copy of it exists to say no
-- before somebody waits for an upload, not instead of this.
--
-- Forty megabytes, and the four video types a browser can actually play
-- back without a codec of its own: mp4, webm, ogg, and quicktime, which is
-- what a Mac or an iPhone hands over when you drag a clip in. A `.mov` whose
-- codec a browser will not decode still uploads and still will not play,
-- which is worth knowing and is not something a mime list can fix.
--
-- What is deliberately not changed: the column is still called `images`.
-- Renaming it reaches four functions, two types and every caller, to say the
-- same thing in a better word; it can happen the day something else in that
-- file has to change anyway.
--
-- The four-per-post ceiling in `forum_open` and `forum_reply` is untouched.
-- Four clips at forty megabytes is a hundred and sixty, which is a lot for
-- one post and still less than a thread of forty people with one each.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forum', 'forum', true, 41943040,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
  ]
)
on conflict (id) do update
   set public = true,
       file_size_limit = 41943040,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
       ];

commit;
