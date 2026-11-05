-- "mime type image/png is not supported" when setting a World's emblem.
--
-- The worlds bucket was created to hold one kind of file: the manifest, which
-- is JSON. Then emblems and thumbnails were put in the same bucket, on
-- purpose and correctly, because those belong to the World rather than to the
-- Marketplace. Nobody widened what the bucket accepts, so every picture was
-- refused at the door with a message about PNG not being supported, which
-- reads as though Kobblon does not support PNG.
--
-- It supports PNG. This is the bucket that did not.

update storage.buckets
   set allowed_mime_types = array[
         'application/json',
         'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif',
         'video/mp4', 'video/webm'
       ],
       -- A thumbnail may be a clip, and a clip is not a 32 MB file.
       file_size_limit = 134217728
 where id = 'worlds';

/*
 * A World's own pictures are not Marketplace content and must never become
 * it. An emblem, a thumbnail and a banner belong to the thing they are on:
 * they are not given a content id, they do not appear in anybody's
 * inventory, and nobody can take one and put it on a part. A decal is made
 * when somebody says they are making a decal, and never as a side effect of
 * setting a picture on something.
 *
 * Nothing enforces that here because nothing has to: these files live in the
 * worlds bucket and are recorded in world_media and worlds.cover_url. The
 * assets table is not involved and this comment is here so it stays that
 * way.
 */
