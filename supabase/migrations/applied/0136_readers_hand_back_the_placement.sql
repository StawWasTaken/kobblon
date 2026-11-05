begin;

-- Every reader that feeds a renderer hands back the placement.
--
-- 0135 gave an item somewhere to keep one; without this nothing can apply
-- it, which would be a column nobody reads and a slider that moves nothing.
--
-- `avatar_shelf` is left out on purpose: a shelf card is a drawn picture, so
-- the placement is already baked into it, and adding a column to the busiest
-- reader on the site to carry a number it does not use is a cost for nothing.
--
-- Each definition below is taken from the database as it stands and has one
-- column added, rather than retyped. Retyping one of these is how a rewrite
-- silently drops a join.

drop function if exists public.avatar_of(target uuid);

create function public.avatar_of(target uuid)
 RETURNS TABLE(body jsonb, slot text, kind text, item_id uuid, content_id bigint, item_name text, image_path text, image_bucket text, preview_path text, fit jsonb, mesh_path text, mesh_format text, texture_path text)
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
    i.image_path, i.image_bucket, i.preview_path, i.fit,
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

drop function if exists public.my_made_avatar_items();

create function public.my_made_avatar_items()
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, fit jsonb, sells_until timestamp with time zone, mesh_path text, texture_path text, status moderation_status, review_note text, is_public boolean, created_at timestamp with time zone, taken integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, i.fit, i.sells_until, m.file_path, t.file_path, i.status, i.review_note,
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
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, price integer, image_path text, image_bucket text, preview_path text, fit jsonb, sells_until timestamp with time zone, mesh_path text, texture_path text, creator_username text, worn boolean, status moderation_status, is_public boolean, mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.price, i.image_path, i.image_bucket, i.preview_path, i.fit, i.sells_until,
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
 RETURNS TABLE(id uuid, content_id bigint, kind text, slot text, name text, description text, price integer, image_path text, image_bucket text, preview_path text, fit jsonb, sells_until timestamp with time zone, mesh_path text, mesh_format text, texture_path text, creator_id uuid, creator_username text, creator_display_name text, creator_is_verified boolean, creator_is_staff boolean, created_at timestamp with time zone, owned boolean, worn boolean, mine boolean, is_public boolean, taken integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select
    i.id, i.content_id, i.kind, i.slot, i.name,
    i.description, i.price,
    i.image_path, i.image_bucket, i.preview_path, i.fit,
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


grant execute on function public.avatar_of to anon, authenticated;
grant execute on function public.my_made_avatar_items to authenticated;
grant execute on function public.my_avatar_items to authenticated;
grant execute on function public.avatar_item_page to anon, authenticated;

commit;
