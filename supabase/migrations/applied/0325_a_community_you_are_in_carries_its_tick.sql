begin;

/*
 * `member_communities` leaves the tick behind.
 *
 * It returns the eight things a row in a list of "your Communities" needs
 * and not `is_verified`, so every list built from it draws an unverified
 * card for a verified Community: the shelf on Home, the "Yours" shelf on
 * the Communities page, and the list on a profile. One page over, the
 * directory reads `communities` directly and shows the tick - so the same
 * Community is verified in one list and not in the next.
 *
 * The return type changes, which `create or replace` will not do, so the
 * function is dropped and written again. Dropping it drops its grants with
 * it, which is the trap this project has fallen into twice: the grants are
 * in this file, under the function, and the check below reads it as
 * `authenticated` rather than as the owner.
 */

drop function if exists public.member_communities(uuid);

create function public.member_communities(target uuid)
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  member_count integer,
  content_id bigint,
  role community_role,
  is_primary boolean,
  is_verified boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.slug, c.name, c.icon_url, c.member_count, c.content_id, m.role,
         coalesce(c.id = p.primary_community, false) as is_primary,
         coalesce(c.is_verified, false) as is_verified
    from public.community_members m
    join public.communities c on c.id = m.community_id
    join public.profiles p on p.id = m.user_id
   where m.user_id = target and c.is_public and not c.is_removed
   order by coalesce(c.id = p.primary_community, false) desc, c.member_count desc;
$$;

grant execute on function public.member_communities(uuid) to authenticated, anon;

commit;
