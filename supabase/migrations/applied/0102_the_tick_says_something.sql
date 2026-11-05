begin;

-- The verified tick, where it was decoration.
--
-- Staw: "theres also an issue that we dont see the verified tick on verified
-- users by staff". Two faults, opposite ways round.
--
-- A profile page asked whether somebody was an *admin*, so an account the
-- staff panel had verified showed no tick at all. That one is a line in the
-- page and is fixed there.
--
-- The other is here. The Catalog and an item's page drew the tick beside
-- every creator's name with nothing asked - the flag was not in what these
-- functions return, so there was nothing to ask. Everybody looked verified,
-- which is worse than nobody: a mark that is always on means nothing, and it
-- is the mark that is supposed to mean Kobblon vouches for this person.
--
-- Being staff implies the tick; being verified does not imply being staff.
-- The same rule as `isVerified` in the website, so the two cannot drift.

drop function if exists public.style_shop(text, text, integer);

create function public.style_shop(
  search text default null, slot_name text default null, wanted integer default 60
) returns table(
  id uuid, content_id bigint, name text, description text, slot text,
  image_path text, x real, y real, width real, rotation real, flipped boolean,
  layer smallint, price integer, created_at timestamptz,
  creator_id uuid, creator_name text, creator_username text,
  creator_is_verified boolean,
  owned boolean, worn boolean, owners bigint
) language sql stable security definer
set search_path = public, extensions as $$
  select s.id, s.content_id, s.name, s.description, s.slot, s.image_path,
         s.x, s.y, s.width, s.rotation, s.flipped, s.layer, s.price, s.created_at,
         p.id, p.display_name, p.username,
         coalesce(p.is_verified, false) or coalesce(p.is_admin, false),
         exists (select 1 from public.style_owners o
                  where o.item_id = s.id and o.user_id = auth.uid()),
         exists (select 1 from public.style_worn w
                  where w.item_id = s.id and w.user_id = auth.uid()),
         (select count(*) from public.style_owners o where o.item_id = s.id)
    from public.style_items s
    join public.profiles p on p.id = s.creator_id
   where s.is_public and not s.is_removed
     and (slot_name is null or s.slot = slot_name)
     and (
       search is null or search = ''
       or s.name ilike '%' || search || '%'
       or coalesce(s.description, '') ilike '%' || search || '%'
       or p.username ilike '%' || search || '%'
     )
   order by s.created_at desc
   limit greatest(1, least(coalesce(wanted, 60), 200));
$$;

drop function if exists public.style_item(bigint);

create function public.style_item(target_content bigint)
returns table(
  id uuid, content_id bigint, name text, description text, slot text,
  image_path text, x real, y real, width real, rotation real, flipped boolean,
  layer smallint, price integer, is_public boolean, created_at timestamptz,
  creator_id uuid, creator_name text, creator_username text, creator_avatar text,
  creator_is_verified boolean,
  owned boolean, worn boolean, mine boolean, owners bigint
) language sql stable security definer
set search_path = public, extensions as $$
  select s.id, s.content_id, s.name, s.description, s.slot, s.image_path,
         s.x, s.y, s.width, s.rotation, s.flipped, s.layer, s.price,
         s.is_public, s.created_at,
         p.id, p.display_name, p.username, p.avatar_url,
         coalesce(p.is_verified, false) or coalesce(p.is_admin, false),
         exists (select 1 from public.style_owners o
                  where o.item_id = s.id and o.user_id = auth.uid()),
         exists (select 1 from public.style_worn w
                  where w.item_id = s.id and w.user_id = auth.uid()),
         s.creator_id = auth.uid(),
         (select count(*) from public.style_owners o where o.item_id = s.id)
    from public.style_items s
    join public.profiles p on p.id = s.creator_id
   where s.content_id = target_content
     and not s.is_removed
     and (s.is_public or s.creator_id = auth.uid() or public.is_moderator());
$$;

-- A drop takes the grants with it, silently, and the Catalog is open to
-- anybody - so a signed-out visitor would get "permission denied for
-- function style_shop" on a page that has always worked.
grant execute on function public.style_shop to anon, authenticated;
grant execute on function public.style_item to anon, authenticated;

commit;
