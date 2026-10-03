begin;

-- Narrowing the shelf by more than a name.
--
-- Four more ways in, and all four are things somebody says out loud while
-- shopping: nothing over forty, nothing under ten, only the limiteds, only
-- what is free. They are arguments to the reader rather than a filter the
-- page applies to sixty rows it already has, because filtering after the
-- limit shows somebody four hats and calls it everything.
--
-- All default to doing nothing, so every existing call behaves exactly as
-- before. Taken from the database as it stands rather than retyped.

-- Both signatures: the one being replaced, and the one this file creates.
--
-- Naming only the old one passes the first time and fails the second with
-- "function already exists with same argument types" - because by then the
-- old arity is gone and the drop skips. Running a file twice is exactly what
-- somebody does to be sure, and this is the third time that habit has caught
-- a signature mistake in this project.
drop function if exists public.avatar_shelf(text, text, integer, text, text);
drop function if exists public.avatar_shelf(text, text, integer, text, text, integer, integer, boolean, boolean);

create function public.avatar_shelf(of_kind text DEFAULT NULL::text, term text DEFAULT NULL::text, how_many integer DEFAULT 60, made_by text DEFAULT NULL::text, sort_by text DEFAULT 'newest'::text, least_price integer DEFAULT NULL::integer, most_price integer DEFAULT NULL::integer, only_limited boolean DEFAULT false, only_free boolean DEFAULT false)
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
     and (least_price is null or i.price >= least_price)
     and (most_price is null or i.price <= most_price)
     and (not coalesce(only_free, false) or i.price = 0)
     and (not coalesce(only_limited, false) or i.sells_until is not null)
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

grant execute on function public.avatar_shelf to anon, authenticated;

commit;
