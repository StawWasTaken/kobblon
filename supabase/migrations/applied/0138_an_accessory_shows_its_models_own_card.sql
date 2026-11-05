begin;

-- An accessory shows the picture its own model already has.
--
-- Staw, and he is right that this was over-thought: a mesh in the Creator
-- Hub already has a card, drawn at upload from the file the browser was
-- holding. An accessory *is* that mesh. Drawing a second picture of it meant
-- signing a private address, loading the model again and building a WebGL
-- context, any of which failing leaves the shelf showing a shirt icon -
-- which is what it has been showing.
--
-- So the readers hand back `assets.preview_path` for the model, and the card
-- falls back to it. It is public, it already exists, and it is the same
-- picture the Marketplace shows for the same object - which is the right
-- answer as well as the simple one, because two pictures of one mesh is two
-- things to keep in step.
--
-- `preview_path` on the item still wins where it exists: a maker who has
-- placed their accessory on a body has a better picture than one of the
-- model alone.
--
-- Each definition is taken from the database as it stands with one column
-- added, rather than retyped.

drop function if exists public.avatar_shelf(of_kind text, term text, how_many integer, made_by text, sort_by text);

create function public.avatar_shelf(of_kind text DEFAULT NULL::text, term text DEFAULT NULL::text, how_many integer DEFAULT 60, made_by text DEFAULT NULL::text, sort_by text DEFAULT 'newest'::text)
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, mesh_preview_path text, sells_until timestamp with time zone, mesh_path text, texture_path text, creator_id uuid, creator_username text, creator_display_name text, creator_is_verified boolean, creator_is_staff boolean, created_at timestamp with time zone, owned boolean, taken integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.sells_until,
         m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         coalesce(c.is_admin, false) or coalesce(c.is_moderator, false),
         i.created_at,
         exists (select 1 from public.avatar_owned o
                  where o.item_id = i.id and o.user_id = auth.uid()),
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id)
    from public.avatar_items i
    join public.profiles c on c.id = i.creator_id and not c.is_suspended
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.status = 'approved' and i.is_public and not i.is_removed
     and (of_kind is null or i.kind = of_kind)
     and (term is null or btrim(term) = '' or i.name ilike '%' || btrim(term) || '%')
     and (
       made_by is null or made_by = 'anybody'
       or (made_by = 'kobblon' and coalesce(c.is_admin, false))
       or lower(c.username) = lower(ltrim(made_by, '@'))
     )
   order by
     case when sort_by = 'cheapest' then i.price end asc nulls last,
     case when sort_by = 'dearest'  then i.price end desc nulls last,
     case when sort_by = 'oldest'   then i.created_at end asc nulls last,
     case when sort_by = 'taken' then
       (select count(*) from public.avatar_owned o
         where o.item_id = i.id and o.user_id <> i.creator_id) end desc nulls last,
     i.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 120);
$function$;

drop function if exists public.my_made_avatar_items();

create function public.my_made_avatar_items()
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, mesh_preview_path text, fit jsonb, sells_until timestamp with time zone, mesh_path text, texture_path text, status moderation_status, review_note text, is_public boolean, created_at timestamp with time zone, taken integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.fit, i.sells_until, m.file_path, t.file_path, i.status, i.review_note,
         i.is_public, i.created_at,
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id)
    from public.avatar_items i
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.creator_id = auth.uid() and not i.is_removed
   order by i.created_at desc;
$function$;

drop function if exists public.my_avatar_items();

create function public.my_avatar_items()
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, price integer, image_path text, image_bucket text, preview_path text, mesh_preview_path text, fit jsonb, sells_until timestamp with time zone, mesh_path text, texture_path text, creator_username text, worn boolean, status moderation_status, is_public boolean, mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.price, i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.fit, i.sells_until,
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
$function$;

drop function if exists public.avatar_item_page(wanted bigint);

create function public.avatar_item_page(wanted bigint)
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, mesh_preview_path text, fit jsonb, sells_until timestamp with time zone, mesh_path text, mesh_format text, texture_path text, creator_id uuid, creator_username text, creator_display_name text, creator_is_verified boolean, creator_is_staff boolean, created_at timestamp with time zone, owned boolean, worn boolean, mine boolean, is_public boolean, taken integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select
    i.id, i.content_id, i.kind, i.slot, i.name,
    i.description, i.price,
    i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.fit,
    i.sells_until,
    m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    c.id, c.username, c.display_name,
    coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
    coalesce(c.is_admin, false) or coalesce(c.is_moderator, false),
    i.created_at,
    exists (select 1 from public.avatar_owned o
             where o.item_id = i.id and o.user_id = auth.uid()),
    exists (select 1 from public.avatar_worn w
             where w.item_id = i.id and w.user_id = auth.uid()),
    i.creator_id = auth.uid(),
    i.is_public,
    (select count(*)::int from public.avatar_owned o
      where o.item_id = i.id and o.user_id <> i.creator_id)
  from public.avatar_items i
  join public.profiles c on c.id = i.creator_id and not c.is_suspended
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where i.content_id = wanted
    and not i.is_removed
    and (i.status = 'approved' or i.creator_id = auth.uid());
$function$;


grant execute on function public.avatar_shelf to anon, authenticated;
grant execute on function public.my_made_avatar_items to authenticated;
grant execute on function public.my_avatar_items to authenticated;
grant execute on function public.avatar_item_page to anon, authenticated;

commit;
