begin;

/*
 * Three fields the Launcher has asked for three rounds running.
 *
 * `world_to_play` hands back six fields because the runtime "has no business
 * with the rest of the row", and that is still right. These three are not
 * the rest of the row — they are things the Launcher has to draw and cannot
 * work out:
 *
 *   - `emblem_url`, because the emblem is what a World is named by in a
 *     list, and the cover is the wrong picture at that size.
 *   - `page_url`, because "view on the website" is a link, and a client
 *     building one out of an id and a slug is a client that breaks the day
 *     the address changes. The address belongs to the website.
 *   - `slug`, because it is what the address is made of, and a client that
 *     wants to build its own anyway should use ours rather than slugifying
 *     a name a second time and getting a different answer.
 *
 * The return type changes, so the function is dropped rather than replaced:
 * `create or replace` cannot change the shape of what comes back.
 * `experience_to_play`, the old name kept pointing at this one, has to go
 * first because it depends on it — and it comes back naming its six fields
 * explicitly rather than `select *`, so the next field added here does not
 * silently change the old interface too.
 */

drop function if exists public.experience_to_play(uuid);
drop function if exists public.world_to_play(uuid);

create function public.world_to_play(wanted uuid)
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
  select w.id, w.name, w.creator_name, w.cover_url, w.emblem_url,
         w.manifest_url, w.runtime_version,
         w.slug,
         'https://kobblon.com/worlds/' || w.content_id::text ||
           case when coalesce(w.slug, '') = '' then '' else '/' || w.slug end
    from public.worlds w
   where w.id = wanted
     and w.is_published
     and not w.is_removed
$$;

create function public.experience_to_play(wanted uuid)
returns table (
  id uuid,
  name text,
  creator_name text,
  cover_url text,
  manifest_url text,
  runtime_version integer
)
language sql security definer set search_path = public, extensions stable as $$
  select p.id, p.name, p.creator_name, p.cover_url, p.manifest_url, p.runtime_version
    from public.world_to_play(wanted) p
$$;

grant execute on function public.world_to_play(uuid) to anon, authenticated;
grant execute on function public.experience_to_play(uuid) to anon, authenticated;

commit;
