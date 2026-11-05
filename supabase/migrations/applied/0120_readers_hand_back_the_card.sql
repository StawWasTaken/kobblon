begin;

-- Every reader hands back the drawn card.
--
-- 0119 gave an item somewhere to keep one; this is what lets anything see
-- it. Each of these is dropped and recreated because the returned row grows,
-- and the grants are re-issued at the bottom because a drop takes them with
-- it silently - a signed-out visitor would otherwise get "permission denied"
-- on the whole Catalog.
--
-- Both signatures of `avatar_shelf` are dropped, not just the current one.
-- These are applied by hand, where running a file twice to be sure is
-- exactly what somebody does, and the second run is where a missed drop
-- shows up.

-- The column this file reads, said again here on purpose.
--
-- It belongs to 0119 and this is `if not exists`, so on a database that has
-- 0119 it does nothing at all. It is here because these are applied by hand
-- in the SQL editor, one file at a time, and a file that reads a column it
-- did not create fails with `column i.preview_path does not exist` and no
-- hint at all about which earlier file was missed. It already happened.
alter table public.avatar_items
  add column if not exists preview_path text;

drop function if exists public.avatar_shelf(text, text, integer);

drop function if exists public.avatar_of(target uuid);

create function public.avatar_of(target uuid)
 RETURNS TABLE(body jsonb, slot text, kind text, item_id uuid, content_id bigint, item_name text, image_path text, image_bucket text, preview_path text, mesh_path text, mesh_format text, texture_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select
    p.body,
    w.slot,
    i.kind,
    i.id,
    i.content_id,
    i.name,
    i.image_path, i.image_bucket, i.preview_path,
    m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path
  from public.profiles p
  left join public.avatar_worn w on w.user_id = p.id
  left join public.avatar_items i on i.id = w.item_id and not i.is_removed
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where p.id = target and not p.is_suspended;
$function$;

drop function if exists public.my_avatar_items();

create function public.my_avatar_items()
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, price integer, image_path text, image_bucket text, preview_path text, mesh_path text, texture_path text, creator_username text, worn boolean, status moderation_status, is_public boolean, mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.price, i.image_path, i.image_bucket, i.preview_path,
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

drop function if exists public.avatar_shelf(of_kind text, term text, how_many integer, made_by text, sort_by text);

create function public.avatar_shelf(of_kind text DEFAULT NULL::text, term text DEFAULT NULL::text, how_many integer DEFAULT 60, made_by text DEFAULT NULL::text, sort_by text DEFAULT 'newest'::text)
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, mesh_path text, texture_path text, creator_id uuid, creator_username text, creator_display_name text, creator_is_verified boolean, created_at timestamp with time zone, owned boolean, taken integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
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
     -- Newest, and the tie-breaker for every other sort: two things at the
     -- same price should not come back in a different order each time.
     i.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 120);
$function$;

drop function if exists public.my_made_avatar_items();

create function public.my_made_avatar_items()
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, mesh_path text, texture_path text, status moderation_status, review_note text, is_public boolean, created_at timestamp with time zone, taken integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.file_path, t.file_path, i.status, i.review_note,
         i.is_public, i.created_at,
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id)
    from public.avatar_items i
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.creator_id = auth.uid() and not i.is_removed
   order by i.created_at desc;
$function$;

grant execute on function public.avatar_of to anon, authenticated;
grant execute on function public.my_avatar_items to authenticated;
grant execute on function public.avatar_shelf to anon, authenticated;
grant execute on function public.my_made_avatar_items to authenticated;

commit;
