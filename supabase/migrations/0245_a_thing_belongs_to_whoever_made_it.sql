begin;

/*
 * Who a thing to wear belongs to, and where it is therefore listed.
 *
 * Staw, on the Create tab: "everything made by a community should be only
 * seen on the working as [community]". It was not. my_made_avatar_items
 * asked one question - did you make it - so a Community's shirts sat in the
 * personal list beside the maker's own, and switching who you are working as
 * changed the sidebar and nothing else.
 *
 * And the older half of the same complaint: things uploaded for a Community
 * before there was a column to say so carry community_id null, so they read
 * as the maker's personal work, in the Create list and in the byline both.
 * Nothing can guess which ones those were, so this gives the person who made
 * them the means to say: move_avatar_item_maker.
 */

/* Both arities: the old no-argument one, and this one if it is already here. */
drop function if exists public.my_made_avatar_items();
drop function if exists public.my_made_avatar_items(uuid);

create function public.my_made_avatar_items(for_community uuid default null)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text, description text,
  price integer, image_path text, image_bucket text, preview_path text,
  mesh_preview_path text, fit jsonb, sells_until timestamptz,
  mesh_path text, texture_path text, status moderation_status, review_note text,
  is_public boolean, created_at timestamptz, taken integer,
  community_id uuid, community_slug text, community_name text,
  /* Who actually uploaded it, which a Community's list needs: only Kobblon
     may replace a template, and only on one of its own. */
  creator_id uuid
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.fit,
         i.sells_until, m.file_path, t.file_path, i.status, i.review_note,
         i.is_public, i.created_at,
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id),
         g.id, g.slug, g.name, i.creator_id
    from public.avatar_items i
    left join public.communities g on g.id = i.community_id
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where not i.is_removed
     and case
           /*
            * A Community's list is everything of its own, whoever in it made
            * the thing - that is the point of making for one. The rights
            * check is the same one that lets you make for it at all.
            */
           when for_community is not null
             then i.community_id = for_community
              and public.community_can(for_community, 'can_manage_community')
           else i.creator_id = auth.uid() and i.community_id is null
         end
   order by i.created_at desc;
$$;

grant execute on function public.my_made_avatar_items(uuid) to authenticated;

/*
 * Handing a thing over, in either direction.
 *
 * Only the person who made it may do this, and only towards a Community they
 * may manage - otherwise anyone able to name an id could pin their work on
 * somebody else's shop. Moving it back needs nothing but having made it.
 *
 * What moves with it is where the money lands and whose name the byline
 * carries. Copies already sold are untouched: somebody who bought a shirt
 * keeps it whoever is now said to have made it.
 */
create or replace function public.move_avatar_item_maker(
  item_id uuid,
  to_community uuid default null
)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item public.avatar_items;
begin
  if me is null then
    raise exception 'You have to be signed in.';
  end if;

  select * into item from public.avatar_items where id = item_id;
  if not found or item.is_removed then
    raise exception 'That does not exist.';
  end if;

  if item.creator_id <> me then
    raise exception 'Only whoever made it can move it.';
  end if;

  if to_community is not null
     and not public.community_can(to_community, 'can_manage_community') then
    raise exception 'You cannot make things for that Community.';
  end if;

  if item.community_id is not distinct from to_community then
    return;
  end if;

  update public.avatar_items
     set community_id = to_community, updated_at = now()
   where id = item_id;

  if to_community is not null then
    perform public.log_community(to_community, 'made', item.name);
  end if;
end;
$$;

grant execute on function public.move_avatar_item_maker(uuid, uuid) to authenticated;

commit;
