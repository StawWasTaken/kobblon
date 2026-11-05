-- The functions that know what the new kinds are.
--
-- Split from 0092 because `mesh` is added there, and Postgres will not let a
-- new enum value be *used* in the transaction that added it. Run 0092 first.
--
-- And then belt and braces: both functions below compare `kind::text` rather
-- than the enum itself. A case over the enum resolves 'mesh' as a label when
-- the function is parsed, which is the thing Postgres refuses; a case over
-- text is just a string, and never refuses. So this file works whether it is
-- run after 0092 has committed or pasted underneath it in the same tab,
-- which is how it will actually be run by somebody in a hurry.

-- ------------------------------------------------- what each kind may be


-- The screening trigger refuses a file whose extension does not match what
-- it says it is, so both new kinds need their own list. A Build is Kobblon's
-- own part file; a mesh is glTF, which is what the engine's loader reads.
create or replace function public.expected_extensions(kind public.asset_kind)
returns text[] language sql immutable as $$
  select case kind::text
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
  select case kind::text
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
