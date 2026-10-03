begin;

-- Kobblon can change the picture on a face it made.
--
-- Staw, twice now: "make that we can actually edit the faces (so that when
-- we need to modernize a face we just reupload the thing as the asset itself
-- so we dont have to reupload it separately)", and today: "make that kobblon
-- can actually, when clicking edit, on a face, change the image of a face".
--
-- Faces only, and Kobblon only, and both halves are deliberate:
--
--   * **Faces only.** The edit card promises "what it is and the picture on
--     it stay as they are - somebody who bought this bought this", and that
--     promise is worth keeping. A face is the exception because faces are
--     the house's own, nobody else can make one, and redrawing one is
--     maintaining the platform's furniture rather than changing what
--     somebody bought.
--   * **Kobblon only**, which today is the same set of people - faces are
--     `kobblon_only` to make - but says so itself rather than relying on
--     that staying true.
--
-- The picture is a path in the Catalog bucket, uploaded the ordinary way
-- before this is called. Nothing here touches storage: a function that
-- deletes files is a function that deletes the wrong file one day.

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

  if item.kind <> 'face' then
    raise exception 'Only a face can be redrawn. Everything else is what somebody bought.';
  end if;

  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon redraws a face.';
  end if;

  update public.avatar_items
     set image_path = picture,
         -- Everything made since 0115 lives in `catalog`; saying so stops a
         -- redrawn face being looked for in the old `faces` bucket.
         image_bucket = 'catalog',
         -- A face's card is its own picture, so a card drawn from the old
         -- one is a card of the old face.
         preview_path = null,
         updated_at = now()
   where id = target;
end;
$$;

grant execute on function public.replace_avatar_picture to authenticated;

commit;
