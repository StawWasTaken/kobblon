begin;

-- An item's page shows the mesh wearing its Decal.
--
-- Staw: we want to see the mesh and the texture in the Create pages too. A
-- mesh has worn a Decal since 0094, and nothing anywhere could say so: the
-- column existed, `get_asset` did not return it, and the page drew the flat
-- card picture that was taken at upload.
--
-- So `get_asset` returns what the mesh wears. Three things about it, and the
-- second is the one that matters.
--
-- The name and number are for the line under the viewer, so somebody can
-- follow the Decal to its own page and see whose it is - a mesh wearing
-- somebody else's Decal should credit them where a person can see it.
--
-- The path is only returned when the person asking could open that Decal's
-- own page anyway: their own, whatever state it is in, or one that is
-- approved and listed. Without that, dressing a mesh in a private upload and
-- reading the mesh's page back would hand out a storage path for a row the
-- policies would never have shown - the same hole `check_texture` closes on
-- the way in, which does not close it on the way out.
--
-- And a suspended creator's Decal is not served, matching how this function
-- already refuses a suspended creator's own asset.

-- `create or replace` cannot add a column to a function that returns a
-- table - "cannot change return type of existing function" - so this drops
-- and recreates. The drop takes the grants with it, silently, and a
-- signed-out visitor would get "permission denied for function get_asset" on
-- every item page. They are given back at the bottom, which is why that line
-- is not optional tidiness.
drop function if exists public.get_asset(bigint);

create function public.get_asset(target_content_id bigint)
returns table(
  id uuid, kind public.asset_kind, name text, description text,
  file_path text, thumbnail_path text, byte_size bigint,
  download_count integer, content_id bigint, status public.moderation_status,
  is_public boolean, review_note text, price integer,
  created_at timestamptz, updated_at timestamptz,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_avatar_url text, creator_is_admin boolean,
  community_id uuid, community_slug text, community_name text,
  community_icon text,
  i_can_use boolean, i_asked boolean, votes bigint, score integer,
  review_count bigint, my_vote boolean, i_can_edit boolean,
  texture_content_id bigint, texture_name text, texture_path text
)
language sql stable security definer
set search_path = public, extensions as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
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
           when t.status = 'approved' and t.is_public and not tp.is_suspended
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
$$;

grant execute on function public.get_asset to anon, authenticated;

commit;
