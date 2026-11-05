-- A thing to wear gets a page of its own.
--
-- Every other kind of content on Kobbleston has an address you can send
-- somebody: a Space, a Community, an upload. A hat had a tile in a grid and
-- nothing else, so there was nowhere to read what it is, see who made it, or
-- look at it properly before spending Kubes on it.

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in
    ('profile', 'space', 'message', 'ad', 'asset', 'community', 'style'));

/** One thing, by the number in its address. */
drop function if exists public.style_item(bigint);
create or replace function public.style_item(target_content bigint)
returns table (
  id uuid,
  content_id bigint,
  name text,
  description text,
  slot text,
  image_path text,
  x real,
  y real,
  width real,
  rotation real,
  flipped boolean,
  layer smallint,
  price integer,
  is_public boolean,
  created_at timestamptz,
  creator_id uuid,
  creator_name text,
  creator_username text,
  creator_avatar text,
  owned boolean,
  worn boolean,
  mine boolean,
  owners bigint
)
language sql stable security definer set search_path = public as $$
  select s.id, s.content_id, s.name, s.description, s.slot, s.image_path,
         s.x, s.y, s.width, s.rotation, s.flipped, s.layer, s.price,
         s.is_public, s.created_at,
         p.id, p.display_name, p.username, p.avatar_url,
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

/**
 * More like this: the same kind first, then whatever else the same person
 * made, then the rest of the shop, so the row under something is never
 * empty and never random.
 */
drop function if exists public.similar_style(uuid, integer);
create or replace function public.similar_style(target uuid, wanted integer default 12)
returns table (
  id uuid,
  content_id bigint,
  name text,
  slot text,
  image_path text,
  x real,
  y real,
  width real,
  rotation real,
  flipped boolean,
  layer smallint,
  price integer,
  creator_username text,
  owned boolean
)
language sql stable security definer set search_path = public as $$
  with it as (select * from public.style_items where id = target)
  select s.id, s.content_id, s.name, s.slot, s.image_path,
         s.x, s.y, s.width, s.rotation, s.flipped, s.layer, s.price,
         p.username,
         exists (select 1 from public.style_owners o
                  where o.item_id = s.id and o.user_id = auth.uid())
    from public.style_items s
    join public.profiles p on p.id = s.creator_id
    cross join it
   where s.id <> target and s.is_public and not s.is_removed
   order by (s.slot = it.slot) desc,
            (s.creator_id = it.creator_id) desc,
            abs(s.price - it.price),
            s.created_at desc
   limit greatest(1, least(coalesce(wanted, 12), 40));
$$;

grant execute on function public.style_item, public.similar_style to authenticated;
grant execute on function public.style_item, public.similar_style to anon;
