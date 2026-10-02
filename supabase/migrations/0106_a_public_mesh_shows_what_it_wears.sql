begin;

-- A mesh everybody can see shows the Decal it is wearing.
--
-- Staw: when uploading a mesh you can upload a texture or give a Decal id,
-- and neither one shows up.
--
-- Two causes, and only one of them was in the database. The viewer flipped
-- every texture the wrong way and painted maps onto geometry with no texture
-- coordinates, which is fixed in `@/engine/meshes`. This is the other half.
--
-- `get_asset` returns `texture_path` - the only thing a viewer can actually
-- sign for - and 0096 returns it to three people: the Decal's owner, a
-- moderator, and anybody at all if the Decal is approved *and listed*.
--
-- A texture uploaded alongside its mesh is deliberately not listed. Being
-- the skin of a mesh is not an offer to sell a picture, and the upload path
-- says so in as many words. The consequence nobody followed through: the
-- creator saw their mesh dressed, and every visitor saw a grey shape. The
-- texture was attached, screened, and withheld from everyone it was for.
--
-- So the rule gains a case. A Decal's picture is served when it has been
-- approved, its creator is in good standing, and *either* it is listed in
-- its own right *or* the mesh wearing it is one this viewer could already
-- open. Dressing a public mesh in a picture is publishing that picture, on
-- that mesh, by choice - which is the thing the creator did on purpose.
--
-- What this deliberately does not open:
--
--   * Screening. The Decal must still be `approved`. An unscreened picture
--     is not served to strangers by being bolted to a mesh - which would
--     have made a mesh the way around image review.
--   * The Decal's own page. This widens one storage path on one mesh, not
--     `can_use_asset`, not the Marketplace, not any row the policies hide.
--   * Anything about who may attach what. `check_texture` still allows only
--     your own Decal or one that is approved and listed, so the private
--     picture a public mesh can wear is always the creator's own.
--
-- Same drop-and-recreate as 0096, for the same reason: the return type is
-- unchanged here, but `create or replace` on a set-returning function is
-- fragile enough that 0096's note applies, and the grant at the bottom is
-- what keeps a signed-out visitor from getting "permission denied for
-- function get_asset" on every item page.

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
$$;

grant execute on function public.get_asset to anon, authenticated;

commit;
