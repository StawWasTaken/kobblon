begin;

/*
 * Two things: who may write a World's files, and which picture is its
 * thumbnail.
 *
 * ---------------------------------------------------------------- files
 *
 * **Nobody has ever been able to upload a World's pictures.** The policy
 * from 0076 reads:
 *
 *     exists (select 1 from public.worlds w
 *              where w.id::text = (storage.foldername(name))[1]
 *                and w.owner_id = auth.uid())
 *
 * `public.worlds` has a `name` column. Inside that subquery `name` binds to
 * **`w.name`**, the World's name, not to `storage.objects.name`, the file
 * being written - Postgres resolves an unqualified column against the inner
 * query first, and it is a legal reference, so nothing complains. Every
 * upload therefore asked whether some World's id equals the first folder of
 * its own *name*, which is never true, and the person saw "new row violates
 * row-level security policy", which names nothing.
 *
 * It read as correct for a year because it is correct everywhere else: the
 * other buckets compare the folder to `auth.uid()` with no subquery, and
 * the two that do have a subquery say `storage.objects.name` in full.
 *
 * The fix is to ask the question outside the subquery, where `name` can
 * only mean one thing: one security-definer function, called by the three
 * policies that write. A moderator can fix a World's pictures now too,
 * which they could not before.
 *
 * ----------------------------------------------------------- thumbnails
 *
 * Staw: "we dont need to upload a main thumbnail separatedly but in the all
 * the thumbnails, the one thats first is the main thumbnail (if its a video
 * then its played in mute across all pages by default)".
 *
 * So `worlds.cover_url` stops being something a person sets and becomes
 * what the first of a World's pictures is, kept in step by a trigger. Every
 * reader on both sides keeps reading `cover_url` and needs no change.
 * `cover_is_video` says what it is, because a page cannot draw an <img> at
 * an .mp4 and has to know before it tries.
 *
 * The emblem is still set by hand: it is a square mark, not one of the
 * pictures a World shows of itself.
 */

create or replace function public.world_is_mine(which uuid)
returns boolean
language sql security definer set search_path = public, extensions stable as $$
  select exists (
    select 1 from public.worlds w
     where w.id = which
       and (w.owner_id = auth.uid() or public.is_moderator())
  )
$$;

revoke all on function public.world_is_mine(uuid) from public, anon;
grant execute on function public.world_is_mine(uuid) to authenticated;

/*
 * The first folder of the name is the World. A name that is not a folder,
 * or whose folder is not a uuid, is nobody's: `safe_uuid` answers null
 * rather than raising, because a policy that throws on a malformed name
 * is a policy that turns a bad request into a server error.
 */
create or replace function public.safe_uuid(text)
returns uuid
language plpgsql immutable as $$
begin
  return $1::uuid;
exception when others then
  return null;
end $$;

revoke all on function public.safe_uuid(text) from public, anon;
grant execute on function public.safe_uuid(text) to authenticated, anon;

drop policy if exists worlds_files_write on storage.objects;
create policy worlds_files_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'worlds'
    and public.world_is_mine(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists worlds_files_replace on storage.objects;
create policy worlds_files_replace on storage.objects for update to authenticated
  using (
    bucket_id = 'worlds'
    and public.world_is_mine(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists worlds_files_delete on storage.objects;
create policy worlds_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'worlds'
    and public.world_is_mine(public.safe_uuid((storage.foldername(name))[1]))
  );

-- ------------------------------------------------------------ thumbnails

alter table public.worlds
  add column if not exists cover_is_video boolean not null default false;

/*
 * The first picture a World shows is its thumbnail, wherever it is drawn.
 *
 * Security definer because `worlds` has a row-level guard of its own and
 * this writes on behalf of whoever changed the media - the same shape the
 * rest of this schema uses when a trusted write meets an identity-based
 * guard.
 */
create or replace function public.world_cover_follows_media()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  touched uuid := coalesce(new.world_id, old.world_id);
  lead public.world_media;
begin
  select * into lead
    from public.world_media
   where world_id = touched
   order by position, created_at
   limit 1;

  update public.worlds
     set cover_url = case
                       when lead.id is null then null
                       else public.storage_base() || '/worlds/' || lead.path
                     end,
         cover_is_video = coalesce(lead.kind = 'video', false),
         updated_at = now()
   where id = touched;

  return null;
end $$;

drop trigger if exists world_cover_from_media on public.world_media;
create trigger world_cover_from_media
  after insert or update or delete on public.world_media
  for each row execute function public.world_cover_follows_media();

/*
 * And once for what is already there, so a World that has pictures gets
 * its thumbnail from them today rather than the next time somebody edits
 * one. A World with no pictures keeps the single picture it was given
 * under the old page - taking that away would leave it blank.
 */
update public.worlds w
   set cover_url = public.storage_base() || '/worlds/' || m.path,
       cover_is_video = (m.kind = 'video')
  from (
    select distinct on (world_id) world_id, path, kind
      from public.world_media
     order by world_id, position, created_at
  ) m
 where m.world_id = w.id;

commit;
