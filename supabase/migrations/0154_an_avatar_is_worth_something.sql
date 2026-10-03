begin;

-- What somebody is wearing, and what it cost.
--
-- Staw: "i also want to see, not in the avatar currently wearing thing but,
-- somewhere in a corner of the card the value of the avatar (also put how
-- much are worth the items worn)".
--
-- The price is on the item already and every other reader hands it back;
-- `avatar_of` did not, for the same reason it did not hand back the model's
-- card until two files ago - nothing had ever needed it. Adding the column
-- rather than letting a page look each item up: a profile wearing eight
-- things would be eight more requests to say one number.
--
-- It is the asking price today, not what anybody paid. Those are different
-- numbers - `avatar_owned.paid` is what it actually cost - and the one worth
-- showing on a profile is what the outfit is worth now, the way a shop
-- window is priced rather than a receipt.
--
-- Taken from the database as it stands with one column added, not retyped.

drop function if exists public.avatar_of(target uuid);

create function public.avatar_of(target uuid)
 returns table(
   body jsonb, slot text, kind text, item_id uuid, content_id bigint,
   item_name text, price integer, image_path text, image_bucket text,
   preview_path text, mesh_preview_path text, fit jsonb,
   mesh_path text, mesh_format text, texture_path text
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
    i.price,
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
