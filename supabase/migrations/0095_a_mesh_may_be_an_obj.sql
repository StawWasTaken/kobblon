begin;

-- A mesh may arrive as an OBJ.
--
-- Staw: people have .obj files and glTF is not what a lot of modelling
-- software hands you first. An OBJ is plain text, carries geometry and
-- nothing else - no materials, no texture, no units - which suits Kobblon,
-- because a mesh here wears a Decal rather than bringing its own picture.
--
-- `expected_extensions` is what actually decides. The file picker in the
-- browser and `meshFormats` in the engine say no earlier and more politely,
-- and neither of them is a check: a request that never opens a picker still
-- arrives here.

create or replace function public.expected_extensions(kind public.asset_kind)
returns text[] language sql immutable as $$
  select case kind::text
    when 'image' then array['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']
    when 'audio' then array['mp3', 'ogg', 'wav', 'flac', 'aac', 'm4a']
    when 'video' then array['mp4', 'webm', 'ogg', 'mov']
    when 'font'  then array['woff2', 'woff', 'ttf', 'otf']
    when 'build' then array['kbfl', 'json']
    when 'mesh'  then array['glb', 'gltf', 'obj']
    else array[]::text[]
  end;
$$;

commit;
