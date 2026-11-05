begin;

-- A picture of the thing as it is worn.
--
-- Staw: everything in the Catalog, on the avatar page and in Things to Wear
-- needs a preview - flat first, and the three-dimensional one where somebody
-- has asked for that thing in particular. And clothes have to be shown on a
-- body, because a shirt laid out flat is a template, not a shirt.
--
-- So an item carries a card, drawn in the browser the way every other card
-- on Kobblon is drawn: the body wearing it for clothes, the model itself for
-- an accessory, and for a face the picture it already is.
--
-- Separate from `image_path`, which is the thing itself. A shirt's picture is
-- its template and will never be what a shirt looks like; that is the whole
-- reason this column exists rather than reusing the one next to it.

alter table public.avatar_items
  add column if not exists preview_path text;

comment on column public.avatar_items.preview_path is
  'A drawn card for this item, in the catalog bucket. Null until one has '
  'been drawn - a face needs none, because its own picture is the card.';

/**
 * Hangs a drawn card on something you made.
 *
 * Its own function rather than part of `edit_avatar_item`, because this is
 * not an edit: it is the picture catching up with the thing. It is allowed
 * on an item that is already listed and already screened, and it changes
 * nothing anybody has bought.
 *
 * The path has to be inside the caller's own folder, which is the same rule
 * the bucket's policy enforces on the way in. Without it somebody could
 * point their card at a file of yours.
 */
create or replace function public.set_avatar_preview(target uuid, picture text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if picture is not null and split_part(picture, '/', 1) <> me::text then
    raise exception 'That picture is not in your own folder.';
  end if;

  update public.avatar_items
     set preview_path = picture, updated_at = now()
   where id = target and creator_id = me;
  if not found then raise exception 'That is not yours.'; end if;
end;
$$;

grant execute on function public.set_avatar_preview to authenticated;

commit;
