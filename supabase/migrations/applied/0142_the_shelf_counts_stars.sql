begin;

-- The shelf and the item page say how many people starred it, and whether
-- you did.
--
-- Two facts rather than one, because they answer different questions: the
-- count is about the item and belongs beside its price; `starred` is about
-- you and decides whether the star is filled. A page that has only the count
-- has to ask a second time to know how to draw its own button.
--
-- Taken from the database as it stands with two columns added, not retyped.

drop function if exists public.avatar_shelf(of_kind text, term text, how_many integer, made_by text, sort_by text);

create function public.avatar_shelf(of_kind text DEFAULT NULL::text, term text DEFAULT NULL::text, how_many integer DEFAULT 60, made_by text DEFAULT NULL::text, sort_by text DEFAULT 'newest'::text)
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, mesh_preview_path text, sells_until timestamp with time zone, mesh_path text, texture_path text, creator_id uuid, creator_username text, creator_display_name text, creator_is_verified boolean, creator_is_staff boolean, created_at timestamp with time zone, owned boolean, taken integer, stars integer, starred boolean)
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
           where o.item_id = i.id and o.user_id <> i.creator_id),
         (select count(*)::int from public.avatar_favourites f where f.item_id = i.id),
         exists (select 1 from public.avatar_favourites f
                  where f.item_id = i.id and f.user_id = auth.uid())
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

drop function if exists public.avatar_item_page(wanted bigint);

create function public.avatar_item_page(wanted bigint)
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, mesh_preview_path text, fit jsonb, sells_until timestamp with time zone, mesh_path text, mesh_format text, texture_path text, creator_id uuid, creator_username text, creator_display_name text, creator_is_verified boolean, creator_is_staff boolean, created_at timestamp with time zone, owned boolean, worn boolean, mine boolean, is_public boolean, taken integer, stars integer, starred boolean)
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
      where o.item_id = i.id and o.user_id <> i.creator_id),
         (select count(*)::int from public.avatar_favourites f where f.item_id = i.id),
         exists (select 1 from public.avatar_favourites f
                  where f.item_id = i.id and f.user_id = auth.uid())
  from public.avatar_items i
  join public.profiles c on c.id = i.creator_id and not c.is_suspended
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where i.content_id = wanted
    and not i.is_removed
    and (i.status = 'approved' or i.creator_id = auth.uid());
$function$;


grant execute on function public.avatar_shelf to anon, authenticated;
grant execute on function public.avatar_item_page to anon, authenticated;

commit;
