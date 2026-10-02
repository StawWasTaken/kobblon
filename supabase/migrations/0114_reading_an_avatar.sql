begin;

-- Reading an avatar, and getting at the files it is made of.
--
-- 0112 is the shape and 0113 is everything that may happen to it. This is
-- how anybody draws anybody: one call that says what a person's body is
-- coloured and what they have on, with the paths of the files that make it.
--
-- The hard part is not the query. It is that **everybody has to be able to
-- see what everybody else is wearing.** A World full of people draws all of
-- them, and a hat nobody but its wearer can fetch is a hat nobody but its
-- wearer can see.

-- ------------------------------------------------------------ the bucket

/*
 * Pictures that are worn live in their own public bucket.
 *
 * Public because a shirt is seen by everybody who sees the person wearing
 * it, which is everybody. That is not a hole: the picture *is* the shirt,
 * the shirt is for sale to anybody, and its page shows it at full size.
 * Wearing is publishing.
 *
 * Its own bucket rather than `avatars`, which holds the profile pictures
 * people upload of themselves, because those are two different things to
 * moderate and one day somebody will want to wipe one without the other.
 */
insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do nothing;

drop policy if exists catalog_read on storage.objects;
create policy catalog_read on storage.objects for select
  using (bucket_id = 'catalog');

drop policy if exists catalog_write on storage.objects;
create policy catalog_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'catalog'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists catalog_remove on storage.objects;
create policy catalog_remove on storage.objects for delete to authenticated
  using (
    bucket_id = 'catalog'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator())
  );

/*
 * A model worn by somebody is readable by everybody.
 *
 * An accessory is made from a mesh in the private `uploads` bucket, and the
 * rule there is "yours, or one you have been granted". That is right for a
 * file somebody uses to build a World, and wrong for a hat: the moment the
 * hat is listed, everyone who looks at its wearer has to fetch the model.
 *
 * So this opens exactly those files and nothing else - the mesh and the
 * texture of an item that is approved, listed and not taken down. It does
 * not open the uploads bucket, and it does not open the creator's other
 * work; a file becomes readable by being made into something for sale, and
 * stops being readable when that is taken down.
 */
drop policy if exists uploads_worn_read on storage.objects;
create policy uploads_worn_read on storage.objects for select
  using (
    bucket_id = 'uploads'
    and exists (
      select 1
        from public.avatar_items i
        join public.assets a on a.id in (i.mesh_id, i.texture_id)
       where a.file_path = storage.objects.name
         and i.status = 'approved' and i.is_public and not i.is_removed
    )
  );

-- --------------------------------------------------------- what somebody is

/**
 * Everything needed to draw one person.
 *
 * Returns a row per worn thing, with the body colours repeated on each -
 * which is not elegant and is the right trade: one call, one round trip, and
 * a caller that never has to put two answers together to draw one person.
 *
 * `security definer` so it can see the item behind what somebody is wearing
 * even when the viewer could not open that item's own page. A person wearing
 * a thing that was later unlisted still has it on, and still draws.
 */
create or replace function public.avatar_of(target uuid)
returns table(
  body jsonb,
  slot text,
  kind text,
  item_id uuid,
  content_id bigint,
  item_name text,
  image_path text,
  mesh_path text,
  mesh_format text,
  texture_path text
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    p.body,
    w.slot,
    i.kind,
    i.id,
    i.content_id,
    i.name,
    i.image_path,
    m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path
  from public.profiles p
  left join public.avatar_worn w on w.user_id = p.id
  left join public.avatar_items i on i.id = w.item_id and not i.is_removed
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where p.id = target and not p.is_suspended;
$$;

grant execute on function public.avatar_of to anon, authenticated;

-- ------------------------------------------------------------ the shelves

/** What somebody has, to choose from when dressing. */
create or replace function public.my_avatar_items()
returns table(
  id uuid, content_id bigint, kind text, slot text, name text,
  price integer, image_path text, mesh_path text, texture_path text,
  creator_username text, worn boolean, status public.moderation_status,
  is_public boolean, mine boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.price, i.image_path,
         m.file_path, t.file_path, c.username,
         exists (select 1 from public.avatar_worn w
                  where w.user_id = auth.uid() and w.item_id = i.id),
         i.status, i.is_public, i.creator_id = auth.uid()
    from public.avatar_owned o
    join public.avatar_items i on i.id = o.item_id and not i.is_removed
    join public.profiles c on c.id = i.creator_id
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where o.user_id = auth.uid()
   order by o.got_at desc;
$$;

grant execute on function public.my_avatar_items to authenticated;

/**
 * The Catalog: what is for sale, of one kind or all of them.
 *
 * `mine` says whether the person asking already has it, so a shelf can show
 * "Owned" without a second call and a list of ids to cross-reference.
 */
create or replace function public.avatar_shelf(
  of_kind text default null,
  term text default null,
  how_many integer default 60
)
returns table(
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, price integer, image_path text, mesh_path text,
  texture_path text, creator_id uuid, creator_username text,
  creator_display_name text, creator_is_verified boolean,
  created_at timestamptz, owned boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         i.created_at,
         exists (select 1 from public.avatar_owned o
                  where o.item_id = i.id and o.user_id = auth.uid())
    from public.avatar_items i
    join public.profiles c on c.id = i.creator_id and not c.is_suspended
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.status = 'approved' and i.is_public and not i.is_removed
     and (of_kind is null or i.kind = of_kind)
     and (term is null or btrim(term) = '' or i.name ilike '%' || btrim(term) || '%')
   order by i.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 120);
$$;

grant execute on function public.avatar_shelf to anon, authenticated;

/** Everything one person has made, for their own Create page. */
create or replace function public.my_made_avatar_items()
returns table(
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, price integer, image_path text, mesh_path text,
  texture_path text, status public.moderation_status, review_note text,
  is_public boolean, created_at timestamptz, taken integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, m.file_path, t.file_path, i.status, i.review_note,
         i.is_public, i.created_at,
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id)
    from public.avatar_items i
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.creator_id = auth.uid() and not i.is_removed
   order by i.created_at desc;
$$;

grant execute on function public.my_made_avatar_items to authenticated;

commit;
