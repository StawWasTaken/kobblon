-- A rivalry is visible from both sides. Declaring an enemy needs nobody's
-- agreement, so it stays a single row, but the Community on the receiving end
-- now sees it on their own page rather than being the last to know. Only the
-- side that declared it can call it off. Safe to run again.

drop function if exists public.community_relations_list(uuid, public.relation_kind, boolean);
create function public.community_relations_list(
  community uuid, want public.relation_kind, only_pending boolean default false
)
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  member_count integer,
  content_id bigint,
  accepted boolean,
  incoming boolean,
  mine boolean
)
language sql stable security definer set search_path = public as $$
  -- Relations we hold: allies we are in with, enemies we declared.
  select c.id, c.slug, c.name, c.icon_url, c.member_count, c.content_id, r.accepted, false, true
    from public.community_relations r
    join public.communities c on c.id = r.other_id
   where r.community_id = community and r.relation = want
     and r.accepted = (not only_pending)
     and c.is_public and not c.is_removed
  union all
  -- Relations pointing at us: ally requests to answer, and rivalries declared
  -- against us, which we can see but cannot undo.
  select c.id, c.slug, c.name, c.icon_url, c.member_count, c.content_id, r.accepted, true, false
    from public.community_relations r
    join public.communities c on c.id = r.community_id
   where r.other_id = community and r.relation = want
     and c.is_public and not c.is_removed
     and case
           when want = 'ally' then only_pending and not r.accepted
           else not only_pending
             and not exists (
               select 1 from public.community_relations back
                where back.community_id = community and back.other_id = c.id
                  and back.relation = want
             )
         end;
$$;

grant execute on function public.community_relations_list to anon, authenticated;

-- A rivalry declared against us is part of our public face too, so it reads
-- the same way for everybody looking at either Community.
drop policy if exists community_relations_read on public.community_relations;
create policy community_relations_read on public.community_relations for select
  using (
    accepted
    or public.community_can(community_id, 'can_manage_community')
    or public.community_can(other_id, 'can_manage_community')
  );
