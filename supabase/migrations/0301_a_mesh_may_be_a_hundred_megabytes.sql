begin;

/*
 * Room for a real 3D file.
 *
 * Staw: "i want to make that to upload accessories/hairs, basically
 * uploading anything 3d accepts large files basically 100MB would be cool".
 * A hair card with a proper texture set and a few LODs does not fit in
 * twenty-five megabytes, and the bucket was refusing them before anybody
 * saw a message about it.
 *
 * Two parts, because a bucket limit cannot tell a mesh from a Decal:
 *
 *   1. The `uploads` bucket goes to a hundred megabytes, which is the
 *      ceiling for everything in it.
 *   2. A trigger on `assets` holds every other kind at twenty-five, where
 *      it already was.
 *
 * Without the second part this is "every upload may now be a hundred
 * megabytes", which is not what was asked for and is a bill. A Decal is a
 * picture; a picture that size is a mistake, and the right place to say so
 * is the database rather than the dialog.
 *
 * The size the trigger judges is **the one storage recorded**, not the one
 * the browser sent. `byte_size` arrives in the insert from client code, so
 * it is a claim: the check reads `storage.objects` for the file that was
 * actually written and overwrites the column with what it finds. A limit
 * that trusts the number beside the file is not a limit.
 */

set search_path = public, extensions;

-- ------------------------------------------------------------ the bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads', 'uploads', true, 104857600,
  array[
    'image/png','image/jpeg','image/gif','image/webp','image/avif',
    'audio/mpeg','audio/ogg','application/ogg','audio/wav','audio/aac','audio/flac',
    'video/mp4','video/webm',
    'font/woff2','font/woff','font/ttf','font/otf',
    'model/gltf-binary','model/gltf+json',
    'application/json','application/octet-stream'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------- what each may be

/**
 * The most a kind of upload may weigh, in bytes.
 *
 * A function rather than a table: it is five numbers that change when
 * somebody decides they change, and a table would need a page to edit it
 * and a policy to protect it to say the same thing.
 *
 * `@/lib/kinds` carries the same five numbers for the dialog and for the
 * Workspace. They are a copy, deliberately - the browser has to know before
 * it starts uploading, and asking the database to find out whether a file
 * may be picked is a round trip per file picker. This is the one that
 * decides; that one is the one that explains.
 */
create or replace function public.upload_limit(in_kind text)
returns bigint
language sql immutable
set search_path = public, extensions as $$
  select case in_kind
           when 'mesh' then 104857600::bigint   -- 100 MB
           else 26214400::bigint                --  25 MB
         end;
$$;

grant execute on function public.upload_limit(text) to anon, authenticated;

/**
 * What the file actually weighs, and whether that is allowed.
 *
 * `before insert`, so a file over the line never becomes a row - the
 * uploader's own error path then takes the object back out of storage,
 * which is what it already does for every other refusal here.
 *
 * Where storage has no row for the path, the claimed size is kept rather
 * than trusted: it is still held to the same ceiling, so the worst a lie
 * can do is understate a file that the bucket already refused to store.
 *
 * It runs on update too, when `file_path` moves. `replace_mesh_file` takes
 * a new path and a `new_size` from the caller, and a check that only ever
 * looked at inserts would be a limit with a door beside it - which is the
 * shape of guard this project has already been caught by twice.
 */
create or replace function public.check_upload_size()
returns trigger
language plpgsql security definer
set search_path = public, extensions as $$
declare
  stored bigint;
  allowed bigint := public.upload_limit(new.kind::text);
begin
  select nullif(o.metadata ->> 'size', '')::bigint
    into stored
    from storage.objects o
   where o.bucket_id = 'uploads'
     and o.name = new.file_path;

  if stored is not null then
    new.byte_size := stored;
  end if;

  if new.byte_size > allowed then
    /* No article in front of the kind: "a image" is what the obvious
       wording produces, and this string is read by whoever hit the limit. */
    raise exception 'That file is % MB. The most a % may be is % MB.',
      round(new.byte_size / 1048576.0, 1),
      new.kind,
      round(allowed / 1048576.0)
      using errcode = '22003';
  end if;

  return new;
end;
$$;

drop trigger if exists assets_size_check on public.assets;
create trigger assets_size_check
  before insert or update of file_path, byte_size on public.assets
  for each row execute function public.check_upload_size();

commit;
