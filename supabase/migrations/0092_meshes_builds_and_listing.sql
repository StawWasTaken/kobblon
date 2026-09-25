-- What a thing is, and whether anybody else can see it.
--
-- Three changes Staw asked for, and they are one change really: what the
-- Create pages are for.
--
-- 1. A `model` is no longer something anybody uploads a file for. It is a
--    Build: an arrangement of parts made in Kobblon Workspace and published
--    from it. Renamed rather than added beside, because the old name meant
--    both things at once and that is exactly why nobody could find meshes.
--
-- 2. `mesh` is the new kind for the geometry a MeshPart draws: a .glb or a
--    .gltf somebody made in Blender. That is the thing that was missing, and
--    it was missing because `model` looked like it already covered it.
--
-- 3. Uploading no longer lists anything. Content is yours until you say
--    otherwise: you manage it in the Create pages and publish it there, or
--    tick the box while uploading. `is_public` defaulted to true, which
--    meant every upload went to the Marketplace whether or not that was what
--    anybody meant.
--
-- Nothing already uploaded changes hands: rows that are listed stay listed.
-- Only what happens next is different.

-- ------------------------------------------------------------ the kinds

-- A Build comes out of the Workspace. Renaming the value keeps every row,
-- every index and every foreign key exactly where it was.
--
-- Guarded so this file can be run twice, which is how it is checked: a bare
-- rename refuses the second time with "model is not an existing enum label",
-- and a migration that only works once is a migration nobody can re-run
-- against a database they are not sure about.
do $$
begin
  if exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'asset_kind' and e.enumlabel = 'model'
  ) then
    alter type public.asset_kind rename value 'model' to 'build';
  end if;
end $$;

-- And the geometry a MeshPart draws, which nothing could be until now.
alter type public.asset_kind add value if not exists 'mesh';

-- Nothing below uses the new value. That is not tidiness, it is the rule:
-- Postgres refuses to *use* an enum value in the same transaction that adds
-- it ("unsafe use of new value"), and the Supabase SQL editor runs a whole
-- file as one transaction. So the kinds land here, on their own, and
-- everything that mentions them by name is the next migration.
