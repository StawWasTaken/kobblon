-- A link to a piece of content should show the content, not a stand in.
--
-- The file itself stays where it was: the uploads bucket is private, so the
-- work cannot be linked to, hotlinked or taken by address. What a card needs
-- is something a robot with no session can fetch, so the browser makes a
-- small picture of the work at upload time and that, and only that, is
-- public. It is a preview of something already on show: a piece of content
-- listed in Create shows this same picture to anybody who opens its page.

-- ------------------------------------------------------------- the bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'previews', 'previews', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
   set public = true,
       file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

/*
 * Anybody may read one, which is the whole point of it. Writing one is your
 * own folder only, so a preview can never be put against somebody else's
 * work.
 */
drop policy if exists previews_read on storage.objects;
create policy previews_read on storage.objects for select
  using (bucket_id = 'previews');

drop policy if exists previews_write on storage.objects;
create policy previews_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'previews'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists previews_replace on storage.objects;
create policy previews_replace on storage.objects for update to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists previews_remove on storage.objects;
create policy previews_remove on storage.objects for delete to authenticated
  using (
    bucket_id = 'previews'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator())
  );

-- -------------------------------------------------------------- the column

alter table public.assets add column if not exists preview_path text;

/*
 * The row may only ever point at a picture in your own folder. Everything
 * else about where it came from is checked by the bucket above.
 */
create or replace function public.guard_asset_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare verdict public.screen_decision;
begin
  if public.is_moderator()
     or current_setting('kobbleston.counting', true) = 'on' then
    new.updated_at := now();
    return new;
  end if;

  new.creator_id     := old.creator_id;
  new.kind           := old.kind;
  new.file_path      := old.file_path;
  new.thumbnail_path := old.thumbnail_path;
  new.byte_size      := old.byte_size;
  new.content_id     := old.content_id;
  new.download_count := old.download_count;
  new.created_at     := old.created_at;
  new.status         := old.status;
  new.review_note    := old.review_note;
  new.reviewed_at    := old.reviewed_at;

  if new.preview_path is distinct from old.preview_path
     and new.preview_path is not null
     and split_part(new.preview_path, '/', 1) <> coalesce(auth.uid()::text, '') then
    raise exception 'A preview has to be your own picture.';
  end if;

  if current_setting('kobbleston.pricing', true) <> 'on' then
    new.price := old.price;
  elsif new.price > public.price_ceiling(new.kind) then
    raise exception 'That is more than a % can be sold for.', new.kind;
  end if;

  if new.name is distinct from old.name
     or new.description is distinct from old.description then
    verdict := (public.screen_text(
      coalesce(new.name, '') || ' ' || coalesce(new.description, ''))).decision;
    if verdict = 'block' then
      raise exception 'That name or description is not allowed here.';
    elsif verdict = 'review' then
      new.status := 'pending';
      new.review_note := null;
      new.reviewed_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_asset_update on public.assets;
create trigger guard_asset_update before update on public.assets
  for each row execute function public.guard_asset_update();

/*
 * Taking something out of Create takes its picture down with it: the row
 * stops pointing at the file, and the page that unlisted it deletes the file
 * itself. Coming back into Create makes a new one.
 */
create or replace function public.forget_preview_when_unlisted()
returns trigger language plpgsql set search_path = public as $$
begin
  if not new.is_public and old.is_public then
    new.preview_path := null;
  end if;
  return new;
end;
$$;

drop trigger if exists assets_forget_preview on public.assets;
create trigger assets_forget_preview before update on public.assets
  for each row execute function public.forget_preview_when_unlisted();
