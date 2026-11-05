begin;

-- The faces that were in Style become Catalog items.
--
-- Staw: the faces are already uploaded, so move them rather than make them
-- again. They are Kobblon's own, they already have numbers people have seen,
-- and some of them are already on people's avatars - so this carries all
-- three across: the face, who owns it, and who is wearing it.
--
-- Matched on `content_id`, which both tables draw from the same sequence. A
-- face keeps the number it already had, every link to it still lands, and
-- running this twice does nothing the second time because `content_id` is
-- unique on `avatar_items`.

/*
 * Which bucket a worn picture is in.
 *
 * Everything made from now on goes in `catalog`. The faces are already in
 * `faces`, uploaded long before that bucket existed, and moving a file
 * between buckets means copying bytes and breaking every address anybody
 * has cached. Carrying the bucket name is one column against that, and it
 * is a fact worth storing anyway: a reader should not have to know which
 * era a picture came from to build its address.
 */
alter table public.avatar_items
  add column if not exists image_bucket text not null default 'catalog'
  check (image_bucket in ('catalog', 'faces'));

insert into public.avatar_items (
  creator_id, content_id, kind, slot, name, description, price,
  image_path, image_bucket, status, is_public, is_removed, created_at
)
select
  public.kobbleston_account(),
  f.content_id,
  'face', 'face',
  f.name,
  f.description,
  f.price,
  f.image_path,
  'faces',
  -- Already screened: these have been on the site, and sending Kobblon's
  -- own faces back through review would take every one of them off people
  -- who are wearing them right now.
  'approved',
  f.is_public,
  f.is_removed,
  f.created_at
  from public.faces f
 where f.image_path is not null
   and public.kobbleston_account() is not null
on conflict (content_id) do nothing;

/* Everybody who had one keeps it. */
insert into public.avatar_owned (item_id, user_id, got_at)
select i.id, o.user_id, coalesce(o.acquired_at, now())
  from public.face_owners o
  join public.faces f on f.id = o.face_id
  join public.avatar_items i on i.content_id = f.content_id
on conflict do nothing;

/*
 * And whoever was wearing one still is.
 *
 * `profiles.face_id` was where a worn face lived. It is left alone rather
 * than cleared: this migration can be run again, and the column goes when
 * the rest of Style does, in its own migration, once nobody wants the old
 * rows back.
 */
insert into public.avatar_worn (user_id, slot, item_id)
select p.id, 'face', i.id
  from public.profiles p
  join public.faces f on f.id = p.face_id
  join public.avatar_items i on i.content_id = f.content_id
on conflict (user_id, slot) do nothing;

commit;
