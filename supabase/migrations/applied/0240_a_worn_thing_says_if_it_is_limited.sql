begin;

/*
 * What somebody is wearing says whether it was a limited.
 *
 * Staw: "in the my profile page we see if one of the items you have is a
 * limited, cuz rn we dont show the limited badge outside of the catalog".
 *
 * The badge exists and the Catalog draws it from `sells_until`, which
 * `avatar_shelf` hands over and `avatar_of` did not - so a profile had no
 * way to know, and the rarest thing somebody owns looked exactly like the
 * commonest thing they own on the one page where they are showing it off.
 *
 * One column on both readers, because an outfit is drawn by the same shape
 * and a limited inside an outfit is the same fact.
 */

/*
 * Dropped first, because `create or replace` cannot change a return type
 * and adding a column to a `returns table` is changing it. In the same
 * transaction as the create, so nothing is ever without it.
 */
drop function if exists public.avatar_of(uuid);
create or replace function public.avatar_of(target uuid)
returns table(
  body jsonb, slot text, kind text, item_id uuid, content_id bigint,
  item_name text, price integer, image_path text, image_bucket text,
  preview_path text, mesh_preview_path text, fit jsonb,
  mesh_path text, mesh_format text, texture_path text,
  /* When it stopped or stops selling. Null for anything always on sale. */
  sells_until timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    p.body, w.slot, i.kind, i.id, i.content_id, i.name, i.price,
    i.image_path, i.image_bucket, i.preview_path,
    m.preview_path, i.fit, m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    i.sells_until
  from public.profiles p
  left join public.avatar_worn w on w.user_id = p.id
  left join public.avatar_items i on i.id = w.item_id and not i.is_removed
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where p.id = target and not p.is_suspended;
$$;

grant execute on function public.avatar_of(uuid) to anon, authenticated;

drop function if exists public.outfit_look(uuid);
create or replace function public.outfit_look(outfit uuid)
returns table(
  body jsonb, slot text, kind text, item_id uuid, content_id bigint,
  item_name text, price integer, image_path text, image_bucket text,
  preview_path text, mesh_preview_path text, fit jsonb,
  mesh_path text, mesh_format text, texture_path text,
  sells_until timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    o.body, oi.slot, i.kind, i.id, i.content_id, i.name, i.price,
    i.image_path, i.image_bucket, i.preview_path,
    m.preview_path, i.fit, m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    i.sells_until
  from public.outfits o
  left join public.outfit_items oi on oi.outfit_id = o.id
  left join public.avatar_items i on i.id = oi.item_id and not i.is_removed
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where o.id = outfit
    and not o.is_removed
    and (o.owner_id = auth.uid() or o.is_public);
$$;

grant execute on function public.outfit_look(uuid) to anon, authenticated;

commit;
