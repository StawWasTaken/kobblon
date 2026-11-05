-- Changing a face after it is out, and getting rid of one.
--
-- The same two things every other piece of content on Kobblon has, with one
-- difference that matters: a face can be owned. Somebody paid Brix for it.
-- So there are two ways out, not one, and which you get depends on whether
-- anybody is holding it:
--
--   Nobody owns it  -> it is deleted. The row goes, the picture goes.
--   Somebody owns it -> it is retired. It leaves the Catalog, and the people
--                       who already have it keep it.
--
-- Destroying something people bought is not a tidy-up, and a function that
-- quietly does it because the alternative was more work is how a platform
-- loses trust it cannot buy back.

/**
 * Changing one. Null leaves a field alone, so a caller that knows about
 * three fields does not wipe the fourth by not knowing it.
 */
create or replace function public.edit_face(
  which uuid,
  called text default null,
  about text default null,
  cost integer default null,
  shown boolean default null,
  picture text default null
)
returns public.faces
language plpgsql security definer set search_path = public, extensions as $$
declare mine public.faces;
begin
  if not public.is_kobblon() then
    raise exception 'Only Kobblon publishes faces.';
  end if;

  select * into mine from public.faces where id = which and not is_removed;
  if mine.id is null then
    raise exception 'There is no face with that number.';
  end if;

  if called is not null and char_length(btrim(called)) = 0 then
    raise exception 'A face needs a name.';
  end if;

  /*
   * A picture is a path in the faces bucket, never an address.
   *
   * Two checks rather than one pattern: Postgres will not accept a
   * repetition count past 255, so {3,400} is not a strict rule, it is an
   * invalid expression that refuses everything and looks like it works.
   */
  if picture is not null and (
       char_length(picture) < 3
       or char_length(picture) > 400
       or picture !~ '^[A-Za-z0-9._/-]+$'
     ) then
    raise exception 'A face''s picture lives in the faces bucket.';
  end if;

  update public.faces
     set name        = coalesce(nullif(btrim(called), ''), name),
         description = coalesce(about, description),
         price       = coalesce(cost, price),
         is_public   = coalesce(shown, is_public),
         image_path  = coalesce(picture, image_path),
         updated_at  = now()
   where id = which
  returning * into mine;

  return mine;
end $$;

revoke all on function public.edit_face(uuid, text, text, integer, boolean, text) from public, anon;
grant execute on function public.edit_face(uuid, text, text, integer, boolean, text) to authenticated;

/**
 * Getting rid of one.
 *
 * Returns the picture's path when the row was actually deleted, so the
 * caller can take the file down too, and nothing when the face was retired
 * instead because somebody owns it. A caller that ignores the difference
 * still does no harm; one that reads it can say which happened.
 */
create or replace function public.delete_face(which uuid, out removed_path text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  mine public.faces;
  held integer;
begin
  removed_path := null;

  if not public.is_kobblon() then
    raise exception 'Only Kobblon publishes faces.';
  end if;

  select * into mine from public.faces where id = which;
  if mine.id is null then
    raise exception 'There is no face with that number.';
  end if;

  select count(*) into held from public.face_owners where face_id = which;

  if held > 0 then
    -- Somebody paid for this. It leaves the shelf; it does not leave them.
    update public.faces
       set is_public = false, is_removed = true, updated_at = now()
     where id = which;
    return;
  end if;

  /*
   * Nobody has it, so nothing is taken from anybody. Anyone wearing it was
   * wearing it without owning it, which cannot happen, but the column is
   * cleared anyway rather than left pointing at a row that has gone.
   */
  update public.profiles set face_id = null where face_id = which;
  delete from public.faces where id = which;

  removed_path := mine.image_path;
end $$;

revoke all on function public.delete_face(uuid) from public, anon;
grant execute on function public.delete_face(uuid) to authenticated;

/**
 * Every face Kobblon has, including the ones taken off the shelf.
 *
 * The Catalog shows what is for sale. Whoever publishes them needs to see
 * what they have published, which is a different list.
 */
create or replace function public.all_faces()
returns setof public.faces
language sql stable security definer set search_path = public, extensions as $$
  select * from public.faces
   where public.is_kobblon()
   order by created_at desc
$$;

grant execute on function public.all_faces() to authenticated;

/**
 * What somebody owns, including faces that have left the Catalog.
 *
 * Retiring a face instead of deleting it is pointless if the people who
 * paid for it then cannot see it. The shelf and somebody's own things are
 * two different lists and only one of them is about what is for sale.
 */
create or replace function public.my_faces()
returns setof public.faces
language sql stable security definer set search_path = public, extensions as $$
  select f.* from public.faces f
    join public.face_owners o on o.face_id = f.id
   where o.user_id = auth.uid()
   order by o.acquired_at desc
$$;

grant execute on function public.my_faces() to authenticated;
