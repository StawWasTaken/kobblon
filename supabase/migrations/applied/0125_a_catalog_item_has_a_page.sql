begin;

-- One item, by its number, with everything its page needs.
--
-- The shelf answers "what is for sale"; this answers "show me this one",
-- which is a different question in two ways. It finds an item that is not
-- on the shelf any more - a limited that has closed, something taken down -
-- because a link to it should still open rather than go nowhere, and it says
-- which of those it is instead of pretending the thing never existed.
--
-- Security definer and it still refuses what it should: an item that was
-- never screened, that was removed, or whose maker is suspended comes back
-- as nothing at all. "Not for sale" and "not a thing" stay different
-- answers, and only the first one has a page.

create or replace function public.avatar_item_page(wanted bigint)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, price integer,
  image_path text, image_bucket text, preview_path text,
  sells_until timestamptz, mesh_path text, mesh_format text, texture_path text,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_verified boolean, created_at timestamptz,
  owned boolean, worn boolean, mine boolean, is_public boolean, taken integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    i.id, i.content_id, i.kind, i.slot, i.name,
    i.description, i.price,
    i.image_path, i.image_bucket, i.preview_path,
    i.sells_until,
    m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    c.id, c.username, c.display_name,
    coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
    i.created_at,
    exists (select 1 from public.avatar_owned o
             where o.item_id = i.id and o.user_id = auth.uid()),
    exists (select 1 from public.avatar_worn w
             where w.item_id = i.id and w.user_id = auth.uid()),
    i.creator_id = auth.uid(),
    i.is_public,
    (select count(*)::int from public.avatar_owned o
      where o.item_id = i.id and o.user_id <> i.creator_id)
  from public.avatar_items i
  join public.profiles c on c.id = i.creator_id and not c.is_suspended
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where i.content_id = wanted
    and not i.is_removed
    -- Screened, or it is the maker's own, so somebody can open what they
    -- made while it is still waiting.
    and (i.status = 'approved' or i.creator_id = auth.uid());
$$;

grant execute on function public.avatar_item_page to anon, authenticated;

commit;
