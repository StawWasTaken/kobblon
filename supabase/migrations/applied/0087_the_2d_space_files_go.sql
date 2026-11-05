-- The files the 2D Space builder wrote.
--
-- Kobblon does not make 2D Spaces any more. The builder is gone, the pages
-- that drew them are gone, and nothing on the website has read these tables
-- for several migrations. What is left is a draft copy and a live copy of
-- every file of every Space that was ever built, and a set of functions to
-- move one to the other.
--
-- Staw asked for them to go, so they go. The Spaces themselves stay: a
-- Space is a thing somebody made and is still listed, still owned, still
-- reachable by its number. This removes the HTML it used to serve, which is
-- the part nothing can render any more.

drop function if exists public.publish_space_files(uuid);
drop function if exists public.revert_space_files(uuid);
drop function if exists public.save_space_file(uuid, text, text);
drop function if exists public.delete_space_file(uuid, text);
drop function if exists public.space_files_of(uuid, boolean);
drop function if exists public.space_file_limit();

drop table if exists public.space_file_backups;
drop table if exists public.space_files;

/*
 * The builder's own bucket, if it had one. A file with no row pointing at
 * it is litter that nothing will ever clean up.
 */
delete from storage.objects where bucket_id = 'space-files';
delete from storage.buckets where id = 'space-files';
