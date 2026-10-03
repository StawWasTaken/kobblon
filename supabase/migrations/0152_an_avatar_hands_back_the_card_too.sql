begin;

-- The one reader that did not hand back an accessory's card.
--
-- Staw: "the accessories previews dont appear into the currently wearing,
-- fix that, cuz basically they appear elsewear so once it appears somewhere
-- it appears everywhere bruh (should)". He is right, and the reason is dull:
-- 0138 taught every reader to hand back `mesh_preview_path` - the card the
-- Creator Hub already drew for the model - and `avatar_of` was not one of
-- them, because at the time nothing drew a card from what somebody was
-- wearing. The profile does now.
--
-- `cardFor` on the website reads preview, then the model's card, then the
-- picture itself, and an accessory has no picture of its own - so without
-- this column the fallback ran out and the tile was empty. The same item on
-- the shelf, on its page and in a drawer had a card the whole time, which is
-- exactly what makes it read as a bug rather than as a missing column.
--
-- Taken from the database as it stands with one column added, not retyped.

drop function if exists public.avatar_of(target uuid);

create function public.avatar_of(target uuid)
 returns table(
   body jsonb, slot text, kind text, item_id uuid, content_id bigint,
   item_name text, image_path text, image_bucket text, preview_path text,
   mesh_preview_path text, fit jsonb, mesh_path text, mesh_format text,
   texture_path text
 )
 language sql
 stable security definer
 set search_path to 'public', 'extensions'
as $function$
  select
    p.body,
    w.slot,
    i.kind,
    i.id,
    i.content_id,
    i.name,
    i.image_path, i.image_bucket, i.preview_path,
    m.preview_path,
    i.fit,
    m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path
  from public.profiles p
  left join public.avatar_worn w on w.user_id = p.id
  left join public.avatar_items i on i.id = w.item_id and not i.is_removed
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where p.id = target and not p.is_suspended;
$function$;

grant execute on function public.avatar_of(uuid) to anon, authenticated;

commit;
