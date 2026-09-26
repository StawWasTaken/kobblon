begin;

-- The uploads bucket takes an OBJ.
--
-- 0095 taught `expected_extensions` about `.obj` and the apps session asked
-- the right question back: the storage allowlist is a second list, and a
-- file Kobblon's own rules accept is still refused by the bucket if its
-- media type is not in it.
--
-- It would have half worked, which is worse than failing. A browser has no
-- media type for `.obj`, so `file.type` is usually empty and the client
-- falls back to `application/octet-stream`, which the bucket already
-- allows. On a machine whose system does have a mapping - some map `.obj`
-- to `application/x-tgif` - `file.type` is set, sent as it stands, and
-- refused. The same upload working on one laptop and failing on another is
-- the sort of bug that gets reported as "it's broken sometimes".
--
-- `model/obj` is the type the client now sends deliberately for `.obj`,
-- rather than whatever the operating system happened to guess.

update storage.buckets
   set allowed_mime_types = array(
     select distinct unnest(allowed_mime_types || array['model/obj'])
   )
 where id = 'uploads';

commit;
