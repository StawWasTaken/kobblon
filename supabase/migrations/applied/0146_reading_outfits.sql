begin;

-- What the pages need to show outfits.
--
-- Three readers, and each hands back the pieces as json rather than a row
-- per piece: an outfit with five things in it is one card, and a reader that
-- returns five rows makes every caller regroup them. The pieces carry what a
-- card needs to draw them, so showing an outfit is not six more requests.

/** Somebody's own outfits, newest first, with their folders. */
create or replace function public.my_outfits()
returns table (
  id uuid, content_id bigint, name text, folder_id uuid, folder_name text,
  body jsonb, is_public boolean, price integer, maker_share integer,
  created_at timestamptz, pieces jsonb
)
language sql stable security definer
set search_path = public, extensions as $$
  select o.id, o.content_id, o.name, o.folder_id, f.name,
         o.body, o.is_public, o.price, o.maker_share, o.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'item_id', i.id, 'slot', oi.slot, 'kind', i.kind, 'name', i.name,
             'price', i.price,
             'image_path', i.image_path, 'image_bucket', i.image_bucket,
             'preview_path', i.preview_path,
             'mesh_preview_path', m.preview_path,
             'owned', exists (select 1 from public.avatar_owned w
                               where w.item_id = i.id and w.user_id = auth.uid())
           ) order by oi.slot)
           from public.outfit_items oi
           join public.avatar_items i on i.id = oi.item_id
           left join public.assets m on m.id = i.mesh_id
          where oi.outfit_id = o.id
        ), '[]'::jsonb)
    from public.outfits o
    left join public.outfit_folders f on f.id = o.folder_id
   where o.owner_id = auth.uid() and not o.is_removed
   order by o.updated_at desc
   limit 200;
$$;

/** Outfits on sale, for the Catalog. */
create or replace function public.outfit_shelf(term text default null, how_many integer default 40)
returns table (
  id uuid, content_id bigint, name text, price integer,
  owner_id uuid, owner_username text, owner_display_name text,
  owner_is_verified boolean, owner_is_staff boolean,
  created_at timestamptz, pieces jsonb, costs integer, owned_already integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select o.id, o.content_id, o.name, o.price,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         public.wears_staff_badge(c.id),
         o.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'item_id', i.id, 'slot', oi.slot, 'kind', i.kind, 'name', i.name,
             'price', i.price,
             'image_path', i.image_path, 'image_bucket', i.image_bucket,
             'preview_path', i.preview_path,
             'mesh_preview_path', m.preview_path,
             'owned', exists (select 1 from public.avatar_owned w
                               where w.item_id = i.id and w.user_id = auth.uid())
           ) order by oi.slot)
           from public.outfit_items oi
           join public.avatar_items i on i.id = oi.item_id
           left join public.assets m on m.id = i.mesh_id
          where oi.outfit_id = o.id and not i.is_removed and i.status = 'approved'
        ), '[]'::jsonb),
         -- What it would cost this person: the pieces they do not have yet.
         -- The number somebody is actually deciding about, which is not the
         -- sum of the price tags once they own half of it.
         coalesce((
           select sum(i.price)::int
             from public.outfit_items oi
             join public.avatar_items i on i.id = oi.item_id
            where oi.outfit_id = o.id
              and not i.is_removed and i.status = 'approved'
              and not exists (select 1 from public.avatar_owned w
                               where w.item_id = i.id and w.user_id = auth.uid())
         ), 0),
         coalesce((
           select count(*)::int
             from public.outfit_items oi
             join public.avatar_owned w on w.item_id = oi.item_id and w.user_id = auth.uid()
            where oi.outfit_id = o.id
         ), 0)
    from public.outfits o
    join public.profiles c on c.id = o.owner_id and not c.is_suspended
   where o.is_public and not o.is_removed
     and (term is null or btrim(term) = '' or o.name ilike '%' || btrim(term) || '%')
   order by o.created_at desc
   limit least(greatest(coalesce(how_many, 40), 1), 100);
$$;

/** Somebody's folders. */
create or replace function public.my_outfit_folders()
returns table (id uuid, name text, created_at timestamptz, how_many integer)
language sql stable security definer
set search_path = public, extensions as $$
  select f.id, f.name, f.created_at,
         (select count(*)::int from public.outfits o
           where o.folder_id = f.id and not o.is_removed)
    from public.outfit_folders f
   where f.owner_id = auth.uid()
   order by f.created_at;
$$;

grant execute on function public.my_outfits         to authenticated;
grant execute on function public.my_outfit_folders  to authenticated;
grant execute on function public.outfit_shelf       to anon, authenticated;

commit;
