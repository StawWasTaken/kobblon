begin;

-- Two fields the apps were told to read, on the function they actually call
-- -----------------------------------------------------------------------
--
-- 0167 added `emblem_url` and `page_url` to `world_to_play` and left
-- `experience_to_play` - the older name, and the one the Launcher calls -
-- selecting the six columns it always had. So the fields exist, the round
-- said they exist, and the caller cannot see them. An alias narrower than
-- the thing it aliases is worse than no alias.
--
-- `page_url` is what unblocks Discord's Join button: Discord refuses a
-- button that is not https, so it cannot be a `kobblon://` link - and an
-- https one is better anyway, because it works for somebody who has not
-- installed Kobblon.
--
-- `emblem_url` is for the loading screen, which already reads it and falls
-- back to the cover. A cover is wide art for a card; an emblem is a square
-- mark. The same picture in both is what made that screen read as
-- repetitive.

drop function if exists public.experience_to_play(uuid);

create function public.experience_to_play(wanted uuid)
returns table (
  id uuid,
  name text,
  creator_name text,
  cover_url text,
  emblem_url text,
  manifest_url text,
  runtime_version integer,
  slug text,
  page_url text
)
language sql security definer set search_path = public, extensions stable as $$
  select p.id, p.name, p.creator_name, p.cover_url, p.emblem_url,
         p.manifest_url, p.runtime_version, p.slug, p.page_url
    from public.world_to_play(wanted) p
$$;

grant execute on function public.experience_to_play(uuid) to anon, authenticated;

commit;
