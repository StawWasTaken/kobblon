-- "More from somebody" was only ever more from that person, which is thin
-- when they have made two things. What somebody actually wants next is
-- something like the thing they are looking at: the same kind of thing,
-- called something similar, described in the same words, put up around the
-- same time.
--
-- The ranking is plain arithmetic on what is already there, and it says so:
-- same maker, same kind, words shared with the name, words shared with the
-- description, and a small nudge for having been uploaded nearby. Nothing
-- here pretends to understand anything.
--
-- Safe to run again.

create or replace function public.similar_assets(target uuid, limit_count integer default 12)
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  description text,
  file_path text,
  thumbnail_path text,
  download_count integer,
  content_id bigint,
  price integer,
  created_at timestamptz,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  creator_is_admin boolean,
  by_same_creator boolean
)
language sql stable security definer set search_path = public as $$
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
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
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
$$;

grant execute on function public.similar_assets to anon, authenticated;
