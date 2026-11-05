begin;

-- Every preview drawn since 0061 went into a column nothing reads.
--
-- Staw: the mesh cards in Create show a grey cube rather than the model.
--
-- There are two columns on `assets` for one idea. `thumbnail_path` is the
-- older one, and since 0061 it is pinned by `guard_asset_update` - so
-- nothing has written to it in a long time. `preview_path` is the newer one,
-- and it is what `makeAssetPreview` fills: the picture is drawn in the
-- browser at upload, uploaded to the previews bucket, and saved.
--
-- Saved to `preview_path`. And every reader - `list_assets`,
-- `my_inventory`, `similar_assets`, `assets_by_creator`, `community_assets`,
-- `get_asset` - returns `thumbnail_path`. So the work was done correctly at
-- every step and landed somewhere nobody looks.
--
-- It was invisible for images, because a Decal falls back to its own file
-- and a Decal's file *is* the picture. Meshes and clips have no such
-- fallback, so they are the ones that look broken - which is exactly the two
-- kinds Staw is pointing at.
--
-- Fixed by coalescing in the one slot that is already there, rather than
-- adding a column to six return types. `create or replace` with an identical
-- return type keeps the grants, where a drop would take them with it and
-- hand every signed-out visitor "permission denied" on the Marketplace.
-- `preview_path` wins; `thumbnail_path` stays as the fallback so that
-- anything drawn before 0061 still shows.
--
-- The naming is still two words for one thing, and the returned column is
-- still called `thumbnail_path`. Renaming it is a change to every caller on
-- both the website and the Workspace, so it is a round of its own.

-- assets_by_creator
create or replace function public.assets_by_creator(target uuid, except_id uuid DEFAULT NULL::uuid, limit_count integer DEFAULT 12)
 RETURNS TABLE(id uuid, kind asset_kind, name text, description text, file_path text, thumbnail_path text, download_count integer, content_id bigint, created_at timestamp with time zone, creator_username text, creator_display_name text, creator_avatar_url text, creator_is_admin boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.kind, a.name, a.description, a.file_path, coalesce(a.preview_path, a.thumbnail_path),
         a.download_count, a.content_id, a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin
    from public.assets a
    join public.profiles p on p.id = a.creator_id and not p.is_suspended
   where a.creator_id = target
     and a.status = 'approved'
     and a.is_public
     and (except_id is null or a.id <> except_id)
   order by a.created_at desc
   limit least(greatest(limit_count, 1), 24);
$function$;

-- community_assets
create or replace function public.community_assets(target uuid, limit_count integer DEFAULT 24)
 RETURNS TABLE(id uuid, kind asset_kind, name text, description text, file_path text, thumbnail_path text, download_count integer, content_id bigint, price integer, score integer, votes bigint, created_at timestamp with time zone, creator_username text, creator_display_name text, creator_avatar_url text, creator_is_admin boolean, community_id uuid, community_slug text, community_name text, community_icon text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.kind, a.name, a.description, a.file_path, coalesce(a.preview_path, a.thumbnail_path),
         a.download_count, a.content_id, a.price,
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin,
         c.id, c.slug, c.name, c.icon_url
    from public.assets a
    join public.profiles p on p.id = a.creator_id
    join public.communities c on c.id = a.community_id
   where a.community_id = target and a.status = 'approved' and a.is_public
   order by a.created_at desc
   limit least(greatest(limit_count, 1), 60);
$function$;

-- list_assets
create or replace function public.list_assets(kind_filter text DEFAULT NULL::text, search text DEFAULT NULL::text, limit_count integer DEFAULT 24, sort text DEFAULT 'new'::text, creator text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, kind asset_kind, name text, description text, file_path text, thumbnail_path text, download_count integer, content_id bigint, price integer, score integer, votes bigint, created_at timestamp with time zone, creator_username text, creator_display_name text, creator_avatar_url text, creator_is_admin boolean, community_id uuid, community_slug text, community_name text, community_icon text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with needle as (select nullif(trim(coalesce(search, '')), '') as q)
  select a.id, a.kind, a.name, a.description, a.file_path, coalesce(a.preview_path, a.thumbnail_path),
         a.download_count, a.content_id, a.price,
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin,
         c.id, c.slug, c.name, c.icon_url
    from public.assets a
    join public.profiles p on p.id = a.creator_id and not p.is_suspended
    left join public.communities c on c.id = a.community_id
   cross join needle n
   where a.status = 'approved'
     and a.is_public
     and (kind_filter is null or a.kind::text = kind_filter)
     and (
       creator is null
       or lower(p.username) = lower(creator)
       or lower(c.slug) = lower(creator)
     )
     and (
       n.q is null
       or a.name ilike '%' || n.q || '%'
       or a.description ilike '%' || n.q || '%'
       or p.username ilike '%' || n.q || '%'
       or p.display_name ilike '%' || n.q || '%'
       or c.name ilike '%' || n.q || '%'
       or a.content_id::text = n.q
     )
   order by
     case when sort = 'used' then a.download_count end desc nulls last,
     case when sort = 'rated' then
       (select count(*) filter (where r.up) from public.asset_ratings r where r.asset_id = a.id)
     end desc nulls last,
     case when sort = 'cheap' then a.price end asc nulls last,
     p.is_admin desc,
     a.created_at desc
   limit least(greatest(limit_count, 1), 60);
$function$;

-- my_inventory
create or replace function public.my_inventory(kind_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, kind asset_kind, name text, description text, file_path text, thumbnail_path text, download_count integer, content_id bigint, price integer, score integer, votes bigint, created_at timestamp with time zone, creator_username text, creator_display_name text, creator_avatar_url text, creator_is_admin boolean, source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.kind, a.name, a.description, a.file_path, coalesce(a.preview_path, a.thumbnail_path),
         a.download_count, a.content_id, a.price,
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin,
         case when a.creator_id = auth.uid() then 'yours' else 'collected' end
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.status = 'approved'
     and (kind_filter is null or a.kind::text = kind_filter)
     and (
       a.creator_id = auth.uid()
       or exists (select 1 from public.asset_grants g
                   where g.asset_id = a.id and g.user_id = auth.uid() and g.state = 'granted')
     )
   order by a.created_at desc;
$function$;

-- similar_assets
create or replace function public.similar_assets(target uuid, limit_count integer DEFAULT 12)
 RETURNS TABLE(id uuid, kind asset_kind, name text, description text, file_path text, thumbnail_path text, download_count integer, content_id bigint, price integer, created_at timestamp with time zone, creator_username text, creator_display_name text, creator_avatar_url text, creator_is_admin boolean, by_same_creator boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select a.id, a.kind, a.creator_id, a.name, coalesce(a.description, '') as description,
           a.created_at
      from public.assets a
     where a.id = target
  ),
  -- The words worth matching on: anything of three letters or more.
  mine as (
    select me.*,
           array(
             select w from unnest(
               regexp_split_to_array(lower(me.name || ' ' || me.description), '[^a-z0-9]+')
             ) as w
              where length(w) >= 3
           ) as words
      from me
  )
  select a.id, a.kind, a.name, a.description, a.file_path, coalesce(a.preview_path, a.thumbnail_path),
         a.download_count, a.content_id, a.price, a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin,
         a.creator_id = mine.creator_id
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   cross join mine
   where a.id <> mine.id
     and a.status = 'approved'
     and a.is_public
     and not p.is_suspended
   order by
     -- Their own work first, then the same kind of thing.
     (a.creator_id = mine.creator_id) desc,
     (a.kind = mine.kind) desc,
     -- Then how many of its words this one shares.
     (
       select count(*)
         from unnest(mine.words) as w
        where lower(a.name) like '%' || w || '%'
           or lower(coalesce(a.description, '')) like '%' || w || '%'
     ) desc,
     -- Then how close together they were put up.
     abs(extract(epoch from (a.created_at - mine.created_at))) asc,
     a.download_count desc
   limit least(greatest(limit_count, 1), 40);
$function$;

-- get_asset
create or replace function public.get_asset(target_content_id bigint)
 RETURNS TABLE(id uuid, kind asset_kind, name text, description text, file_path text, thumbnail_path text, byte_size bigint, download_count integer, content_id bigint, status moderation_status, is_public boolean, review_note text, price integer, created_at timestamp with time zone, updated_at timestamp with time zone, creator_id uuid, creator_username text, creator_display_name text, creator_avatar_url text, creator_is_admin boolean, community_id uuid, community_slug text, community_name text, community_icon text, i_can_use boolean, i_asked boolean, votes bigint, score integer, review_count bigint, my_vote boolean, i_can_edit boolean, texture_content_id bigint, texture_name text, texture_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select a.id, a.kind, a.name, a.description, a.file_path, coalesce(a.preview_path, a.thumbnail_path),
         a.byte_size, a.download_count, a.content_id, a.status, a.is_public,
         case when a.creator_id = auth.uid() or public.is_moderator()
              then a.review_note end,
         a.price,
         a.created_at, a.updated_at,
         p.id, p.username, p.display_name, p.avatar_url, p.is_admin,
         c.id, c.slug, c.name, c.icon_url,
         public.can_use_asset(a.id),
         exists (select 1 from public.asset_grants g
                  where g.asset_id = a.id and g.user_id = auth.uid()),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_reviews v where v.asset_id = a.id),
         (select r.up from public.asset_ratings r
           where r.asset_id = a.id and r.user_id = auth.uid()),
         a.creator_id = auth.uid()
           or (a.community_id is not null
               and public.community_can(a.community_id, 'can_manage_spaces')),
         t.content_id,
         t.name,
         case
           when t.id is null then null
           when t.creator_id = auth.uid() then t.file_path
           when public.is_moderator() then t.file_path
           -- Approved, creator in good standing, and either listed itself or
           -- worn by a mesh this viewer could already open.
           when t.status = 'approved' and not coalesce(tp.is_suspended, false)
                and (
                  t.is_public
                  or (a.status = 'approved' and a.is_public
                      and not coalesce(p.is_suspended, false))
                )
             then t.file_path
         end
    from public.assets a
    join public.profiles p on p.id = a.creator_id
    left join public.communities c on c.id = a.community_id
    left join public.assets t on t.id = a.texture_id
    left join public.profiles tp on tp.id = t.creator_id
   where a.content_id = target_content_id
     and (
       (a.status = 'approved' and a.is_public and not p.is_suspended)
       or a.creator_id = auth.uid()
       or public.is_moderator()
     );
$function$;
grant execute on function public.list_assets to anon, authenticated;
grant execute on function public.my_inventory to authenticated;
grant execute on function public.similar_assets to anon, authenticated;
grant execute on function public.assets_by_creator to anon, authenticated;
grant execute on function public.community_assets to anon, authenticated;
grant execute on function public.get_asset to anon, authenticated;

commit;
