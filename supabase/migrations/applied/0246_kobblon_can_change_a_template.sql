begin;

/*
 * Kobblon replacing the picture on its own shirt or trousers.
 *
 * Staw: "in create, only the kobblon account can replace its own shirt &
 * trousers images by a new one, instead of reuploading them". The house's
 * own garments are platform furniture the way the free face is - when the
 * template geometry changes underneath them, the alternative is deleting
 * them and remaking them, and everybody who owns one loses it.
 *
 * It stays Kobblon's and nobody else's, for the same reason the refusal
 * below has always been there: for anybody else, a thing on sale is what
 * somebody bought, and swapping the picture under it afterwards is selling
 * one thing and delivering another.
 */
create or replace function public.replace_avatar_picture(target uuid, picture text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if coalesce(btrim(picture), '') = '' then
    raise exception 'There is no picture to put on it.';
  end if;

  select * into item from public.avatar_items where id = target;
  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if item.kind not in ('face', 'shirt', 'trousers') then
    raise exception 'Only a face or a garment can be redrawn. Everything else is what somebody bought.';
  end if;

  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon puts a new picture on one of these.';
  end if;

  /*
   * And only on its own. A moderator with the admin flag is still not the
   * person who made somebody else's shirt, and this is the one door that
   * changes a thing after it is sold.
   */
  if item.kind <> 'face' and item.creator_id <> me then
    raise exception 'That is not yours to change.';
  end if;

  update public.avatar_items
     set image_path = picture,
         image_bucket = 'catalog',
         /*
          * The card is drawn from the picture, so a card drawn from the old
          * one is a picture of the old garment. Cleared here and drawn again
          * the next time Create or a shelf looks at it.
          */
         preview_path = null,
         updated_at = now()
   where id = target;
end;
$$;

commit;
