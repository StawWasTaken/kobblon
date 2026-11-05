-- Storage for creator uploads, plus the review queue the moderation worker
-- reads from.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads', 'uploads', true, 26214400,
  array[
    'image/png','image/jpeg','image/gif','image/webp',
    'audio/mpeg','audio/ogg','audio/wav',
    'video/mp4','video/webm',
    'font/woff2','font/woff','font/ttf','font/otf',
    'model/gltf-binary','model/gltf+json'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- People upload only into their own folder, and only while signed in.
create policy uploads_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy uploads_read on storage.objects for select
  using (bucket_id = 'uploads');

create policy uploads_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- --------------------------------------------------------------- reviewing
--
-- Uploads land as 'pending' and stay invisible to everyone but their creator
-- until something approves them. That decision is made outside the database
-- by the review worker (see supabase/README.md), which runs as the service
-- role and calls this function. Nothing reachable from the browser can set a
-- status, so an upload cannot publish itself.

create or replace function public.review_asset(
  target uuid,
  decision public.moderation_status,
  note text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_moderator() then
    raise exception 'not allowed';
  end if;

  update public.assets
     set status = decision,
         review_note = note,
         reviewed_at = now()
   where id = target;
end;
$$;

revoke execute on function public.review_asset from anon, authenticated;

-- What a human moderator works through, newest last.
create or replace function public.review_queue(limit_count int default 50)
returns setof public.assets
language sql stable security definer set search_path = public as $$
  select * from public.assets
   where status = 'pending' and public.is_moderator()
   order by created_at
   limit least(greatest(limit_count, 1), 200);
$$;

grant execute on function public.review_queue to authenticated;
