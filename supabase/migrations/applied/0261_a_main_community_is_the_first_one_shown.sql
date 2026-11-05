begin;

/*
 * Which of somebody's Communities is the one they lead with.
 *
 * 0259 gave a profile a `primary_community`, and `set_primary_community` to
 * pick it. This is the half that was missing: a way for anybody *else* to
 * see it. A profile draws the Communities of the person whose page it is,
 * and the one at the front of it is their choice rather than the reader's,
 * so reading it off the reader's own row - which is all the website could do
 * - would have shown everybody their own answer on everybody's page.
 *
 * So `member_communities` carries it. One column, and the order changes with
 * it: the main one first, then the rest as they were, by how many people are
 * in them. The rail in the sidebar uses the same call, which is the other
 * half of what Staw asked for - "displays it as your main community on your
 * profile and in your communities sidebar" - without the rail having to
 * learn anything new.
 *
 * `is_public and not is_removed` stays, so a main Community that has since
 * been taken down or made private simply does not come back, which is the
 * same answer the rest of the function gives for every other one.
 */

drop function if exists public.member_communities(uuid);

create or replace function public.member_communities(target uuid)
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  member_count integer,
  content_id bigint,
  role community_role,
  is_primary boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.icon_url, c.member_count, c.content_id, m.role,
         coalesce(c.id = p.primary_community, false) as is_primary
    from public.community_members m
    join public.communities c on c.id = m.community_id
    join public.profiles p on p.id = m.user_id
   where m.user_id = target and c.is_public and not c.is_removed
   order by coalesce(c.id = p.primary_community, false) desc, c.member_count desc;
$$;

grant execute on function public.member_communities(uuid) to authenticated, anon;

commit;
