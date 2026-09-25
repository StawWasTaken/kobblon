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

-- ------------------------------------------------- what each kind may be

-- The screening trigger refuses a file whose extension does not match what
-- it says it is, so both new kinds need their own list. A Build is Kobblon's
-- own part file; a mesh is glTF, which is what the engine's loader reads.
create or replace function public.expected_extensions(kind public.asset_kind)
returns text[] language sql immutable as $$
  select case kind
    when 'image' then array['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']
    when 'audio' then array['mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a']
    when 'video' then array['mp4', 'webm', 'ogg', 'mov']
    when 'font'  then array['woff2', 'woff', 'ttf', 'otf']
    when 'build' then array['kbfl', 'json']
    when 'mesh'  then array['glb', 'gltf']
    else array[]::text[]
  end;
$$;

-- ------------------------------------------- what a kind may be sold for

/*
 * Renaming an enum value does not rename it inside a function that compares
 * to the literal, and `price_ceiling` compared to 'model'. Every update to
 * any asset runs through it, so without this the rename turns saving a name
 * into "invalid input value for enum asset_kind". Caught by running the
 * migration twice and then doing something ordinary.
 *
 * A mesh sits with a Build: both are somebody's modelling time rather than
 * a picture.
 */
create or replace function public.price_ceiling(kind public.asset_kind)
returns integer language sql immutable as $$
  select case kind
    when 'image' then 100
    when 'audio' then 250
    when 'video' then 500
    when 'font'  then 300
    when 'build' then 750
    when 'mesh'  then 750
  end;
$$;

grant execute on function public.price_ceiling to anon, authenticated;

-- --------------------------------------------- listing is a thing you do

-- Yours until you say otherwise. The column stays exactly as it is for
-- everything already uploaded; only the default changes, so nothing that is
-- on the Marketplace today comes off it.
alter table public.assets alter column is_public set default false;

comment on column public.assets.is_public is
  'Listed on the Creator Marketplace. False by default: uploading is not '
  'publishing, and a texture somebody uploads for their own World should not '
  'appear in a shop because they did not find a checkbox.';

-- The insert policy already refuses anything but `pending`, so a client
-- cannot publish directly; this only decides where a thing sits once it has
-- been screened. Listing and unlisting is the owner's own update, which
-- assets_update_own already allows.
