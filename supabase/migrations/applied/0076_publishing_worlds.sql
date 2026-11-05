-- Publishing a World from Creator.
--
-- Creator can sign in, but until now there was nowhere for what it makes to
-- go: worlds could be read and updated, never created, and a manifest had no
-- address on Kobblon to live at. Both are here.
--
-- The manifest is a file in a bucket, not a column. It is the thing the
-- engine fetches at the start of every session, it will grow, and a row read
-- by the player on every join should not carry a scene inside it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worlds', 'worlds', true, 33554432, array['application/json'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/*
 * A World's files live under its own id, and only the account that owns that
 * World may write there. The folder is the World rather than the person, so
 * handing a World to somebody else later does not mean moving files.
 */
drop policy if exists worlds_files_read on storage.objects;
create policy worlds_files_read on storage.objects for select
  using (bucket_id = 'worlds');

drop policy if exists worlds_files_write on storage.objects;
create policy worlds_files_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'worlds'
    and exists (
      select 1 from public.worlds w
       where w.id::text = (storage.foldername(name))[1]
         and w.owner_id = auth.uid()
    )
  );

drop policy if exists worlds_files_replace on storage.objects;
create policy worlds_files_replace on storage.objects for update to authenticated
  using (
    bucket_id = 'worlds'
    and exists (
      select 1 from public.worlds w
       where w.id::text = (storage.foldername(name))[1]
         and w.owner_id = auth.uid()
    )
  );

drop policy if exists worlds_files_delete on storage.objects;
create policy worlds_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'worlds'
    and exists (
      select 1 from public.worlds w
       where w.id::text = (storage.foldername(name))[1]
         and w.owner_id = auth.uid()
    )
  );

-- Where a bucket answers from, so manifest_url is built in one place rather
-- than guessed by every client.
create or replace function public.storage_base()
returns text
language sql immutable set search_path = public as $$
  select coalesce(
    nullif(current_setting('app.settings.storage_url', true), ''),
    'https://kobblon.supabase.co/storage/v1/object/public'
  )
$$;

/**
 * A new World, empty, unpublished, owned by whoever asked.
 *
 * Creator calls this first and uploads the manifest to `<id>/manifest.json`
 * afterwards. Nothing is visible to anybody else until it is published.
 */
create or replace function public.create_world(called text)
returns public.worlds
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  guest boolean;
  recent integer;
  made public.worlds;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  select coalesce(p.is_guest, false) into guest from public.profiles p where p.id = me;
  if guest then
    raise exception 'Turn your guest account into a proper one before building.';
  end if;

  if public.is_blocked_from('publish') then
    raise exception 'Publishing is switched off on this account.';
  end if;

  select count(*) into recent from public.worlds
   where owner_id = me and created_at > now() - interval '1 hour';
  if recent >= 20 then
    raise exception 'That is enough new Worlds for one hour.';
  end if;

  insert into public.worlds (owner_id, name, creator_name, manifest_url, is_published)
  select me, called, p.display_name,
         public.storage_base() || '/worlds/' || gen_random_uuid()::text || '/manifest.json',
         false
    from public.profiles p where p.id = me
  returning * into made;

  -- The address has to name this World, which is only known after the insert.
  update public.worlds
     set manifest_url = public.storage_base() || '/worlds/' || made.id::text || '/manifest.json'
   where id = made.id
  returning * into made;

  return made;
end $$;

grant execute on function public.create_world(text) to authenticated;

/**
 * Putting a World out, or taking it back in.
 *
 * Publishing does not check the manifest is there: the engine does that when
 * it fetches it, and a database has no business parsing a scene. What this
 * does enforce is who may publish and what a published row is allowed to say.
 */
create or replace function public.publish_world(which uuid, out_now boolean default true)
returns public.worlds
language plpgsql security definer set search_path = public as $$
declare mine public.worlds;
begin
  select * into mine from public.worlds where id = which;

  if mine.id is null then
    raise exception 'There is no World of yours with that number.';
  end if;

  if mine.owner_id <> auth.uid() and not public.is_moderator() then
    raise exception 'That is not your World.';
  end if;

  if out_now and public.is_blocked_from('publish') then
    raise exception 'Publishing is switched off on this account.';
  end if;

  update public.worlds
     set is_published = out_now,
         published_at = case when out_now and published_at is null then now() else published_at end,
         updated_at = now()
   where id = which
  returning * into mine;

  return mine;
end $$;

grant execute on function public.publish_world(uuid, boolean) to authenticated;

/** What somebody has built, whether or not any of it is out. */
create or replace function public.my_worlds()
returns setof public.worlds
language sql security definer set search_path = public stable as $$
  select * from public.worlds
   where owner_id = auth.uid() and not is_removed
   order by updated_at desc
$$;

grant execute on function public.my_worlds() to authenticated;

/*
 * Creating and deleting rows stays with the functions above. A browser may
 * update its own World's name and description through the existing policy,
 * and nothing else.
 */
revoke insert, delete on public.worlds from authenticated;
