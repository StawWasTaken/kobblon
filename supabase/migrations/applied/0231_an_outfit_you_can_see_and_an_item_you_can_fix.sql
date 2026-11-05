begin;

/*
 * Three things about things people have made and saved.
 *
 * **An outfit you can look at.** Staw: "for outfits, i want to see each
 * outfit in 3d". `my_outfits` hands back the pieces as names and numbers,
 * which is enough to say "four things" and not enough to draw anybody. So
 * `outfit_look` answers for an outfit exactly what `avatar_of` answers for a
 * person - the same columns, in the same order, so one component draws both
 * and there is no second idea of what an avatar is. A saved look is a body
 * and some pieces; the only difference is where the list comes from.
 *
 * **An outfit you can change.** The card had Wear, Sell and a bin. Staw's
 * menu has Update, Rename, Delete. Update is "this outfit, but what I have
 * on now" - the thing somebody wants after they tweak a hat and do not want
 * a second copy called "halloween 2". Rename is a rename. Both of them read
 * what is worn on the server rather than taking a list from the page, for
 * the same reason `save_outfit` does: an outfit assembled by a page is an
 * outfit that can disagree with the body it was saved from.
 *
 * **An item you can fix.** Staw: "we also should let people update the mesh
 * & texture & name & description & position & price of their accessories for
 * 60 brix". Sixty Brix, charged once, and everything in one function so a
 * person pays once for the edit rather than once per field. The parts that
 * matter:
 *
 *   * **A new mesh or texture sends it back for review.** Changing the
 *     picture of a thing that is already in the Catalog is the oldest way
 *     round moderation there is: get a cube approved, then swap the file.
 *     Name and description changes go through `censor_text` and the queue
 *     0233 will put them in; a new file goes back to `pending` and is looked
 *     at again.
 *   * **Nothing is charged for a change that is refused.** The Brix move
 *     after every check, not before, so a name that fails the length rule
 *     costs nothing.
 *   * **The price may move freely.** It is not a moderation question and
 *     charging to correct a typo in a number would be mean.
 */

/*
 * The ledger has to have a word for it.
 *
 * `pixel_transactions.kind` is a closed list, and `move_pixels` writes a
 * row with whatever word it is handed - so a fee with a word the list does
 * not know raises inside the function that was meant to charge it, after
 * every other check has passed. The edit is refused and the reason reads
 * like a bug in the editor.
 */
alter table public.pixel_transactions drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions add constraint pixel_transactions_kind_check
  check (kind in (
    'signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
    'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning',
    'listing_fee', 'listing_refund', 'platform_fee', 'burn', 'code',
    'item_edit'));

-- --------------------------------------------------- an outfit, as a body

/**
 * What an outfit looks like, shaped exactly like `avatar_of`.
 *
 * Readable by anybody who may read the outfit itself, which the policy
 * already decides: yours, or listed in the Catalog. A `security definer`
 * function with no check of its own here would be a way of reading
 * somebody's private wardrobe by guessing numbers, so the first thing it
 * does is ask.
 */
create or replace function public.outfit_look(outfit uuid)
returns table(
  body jsonb,
  slot text,
  kind text,
  item_id uuid,
  content_id bigint,
  item_name text,
  price integer,
  image_path text,
  image_bucket text,
  preview_path text,
  mesh_preview_path text,
  fit jsonb,
  mesh_path text,
  mesh_format text,
  texture_path text
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    o.body,
    oi.slot,
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

-- ------------------------------------------------- renaming and re-saving

/** A new name on a saved look. Yours, and the name rules are the table's. */
create or replace function public.rename_outfit(outfit uuid, new_name text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  new_name := btrim(coalesce(new_name, ''));
  if char_length(new_name) < 1 or char_length(new_name) > 60 then
    raise exception 'A name is between one and sixty characters.';
  end if;

  update public.outfits
     set name = public.censor_text(new_name, 'name'), updated_at = now()
   where id = outfit and owner_id = me and not is_removed;

  if not found then
    raise exception 'That is not one of your outfits.';
  end if;
end $$;

revoke all on function public.rename_outfit(uuid, text) from public;
grant execute on function public.rename_outfit(uuid, text) to authenticated;

/**
 * This outfit, but what I have on now.
 *
 * Read from `avatar_worn` rather than taken from the page, which is the same
 * promise `save_outfit` makes: the thing saved is the thing being worn, not
 * a list a browser assembled and may have got wrong.
 *
 * It keeps the outfit's name, folder, price and listing. Only the body and
 * the pieces move - the point of pressing Update rather than saving a new
 * one is that everything else about it stays put, including the Catalog
 * listing somebody may already have sold copies of.
 */
create or replace function public.restyle_outfit(outfit uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  how_many integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if not exists (
    select 1 from public.outfits
     where id = outfit and owner_id = me and not is_removed
  ) then
    raise exception 'That is not one of your outfits.';
  end if;

  if not exists (select 1 from public.avatar_worn where user_id = me) then
    raise exception 'You are not wearing anything to save.';
  end if;

  delete from public.outfit_items where outfit_id = outfit;

  insert into public.outfit_items (outfit_id, slot, item_id)
  select outfit, w.slot, w.item_id
    from public.avatar_worn w
    join public.avatar_items i on i.id = w.item_id and not i.is_removed;

  get diagnostics how_many = row_count;

  update public.outfits
     set body = (select body from public.profiles where id = me),
         updated_at = now()
   where id = outfit;

  return how_many;
end $$;

revoke all on function public.restyle_outfit(uuid) from public;
grant execute on function public.restyle_outfit(uuid) to authenticated;

-- ------------------------------------------------------ fixing an item

/** What a change to a published item costs. One number, named once. */
create or replace function public.item_edit_price()
returns integer language sql immutable as $$ select 60 $$;

grant execute on function public.item_edit_price() to anon, authenticated;

/**
 * Change something you made: its name, its words, its files, its placement,
 * its price.
 *
 * Every argument is optional and null means "leave it". That is deliberate
 * rather than lazy: a page that has to send every field back sends back the
 * value it happened to be holding, and the value it happened to be holding
 * is the one from before somebody else's change. Null is "I am not talking
 * about this one".
 *
 * Charged once, after every refusal has had its chance, and only when
 * something actually moves - pressing Save on a dialog nobody typed in costs
 * nothing.
 */
create or replace function public.update_avatar_item(
  item uuid,
  new_name text default null,
  new_description text default null,
  new_mesh uuid default null,
  new_texture uuid default null,
  new_fit jsonb default null,
  new_price integer default null
)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  row_item public.avatar_items;
  cost integer := public.item_edit_price();
  files_moved boolean := false;
  anything boolean := false;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into row_item from public.avatar_items where id = item;
  if row_item.id is null then
    raise exception 'There is no item with that number.';
  end if;
  if row_item.creator_id <> me then
    raise exception 'That is not yours to change.';
  end if;
  if row_item.is_removed then
    raise exception 'That item has been taken down.';
  end if;

  -- ------------------------------------------------- what is being asked

  if new_name is not null then
    new_name := btrim(new_name);
    if char_length(new_name) < 3 or char_length(new_name) > 60 then
      raise exception 'A name is between three and sixty characters.';
    end if;
    if new_name <> row_item.name then anything := true; end if;
  end if;

  if new_description is not null then
    new_description := btrim(new_description);
    if char_length(new_description) > 500 then
      raise exception 'A description stops at five hundred characters.';
    end if;
    if new_description is distinct from coalesce(row_item.description, '') then
      anything := true;
    end if;
  end if;

  if new_price is not null then
    if new_price < 0 or new_price > 1000000 then
      raise exception 'A price is between nothing and a million.';
    end if;
    if new_price <> row_item.price then anything := true; end if;
  end if;

  if new_fit is not null and new_fit is distinct from row_item.fit then
    anything := true;
  end if;

  /*
   * A file has to be one of yours and it has to be the right sort of
   * thing. Asked here rather than trusted from the page, because a page
   * sending somebody else's asset id is the whole of this class of bug.
   */
  if new_mesh is not null then
    if not exists (
      select 1 from public.assets
       where id = new_mesh and creator_id = me and kind = 'mesh' and status = 'approved'
    ) then
      raise exception 'That mesh is not one of yours, or it has not been approved yet.';
    end if;
    if new_mesh is distinct from row_item.mesh_id then
      anything := true; files_moved := true;
    end if;
  end if;

  if new_texture is not null then
    if not exists (
      select 1 from public.assets
       where id = new_texture and creator_id = me and kind = 'image' and status = 'approved'
    ) then
      raise exception 'That picture is not one of yours, or it has not been approved yet.';
    end if;
    if new_texture is distinct from row_item.texture_id then
      anything := true; files_moved := true;
    end if;
  end if;

  if not anything then
    return 'nothing';
  end if;

  -- --------------------------------------------------------- paying for it

  if cost > 0 then
    perform public.move_pixels(
      me, -cost, 'item_edit',
      'Changing ' || row_item.name
    );
  end if;

  -- -------------------------------------------------------- the change

  update public.avatar_items
     set name = case when new_name is null then name
                     else public.censor_text(new_name, 'name') end,
         description = case when new_description is null then description
                            else public.censor_text(new_description, 'description') end,
         mesh_id = coalesce(new_mesh, mesh_id),
         texture_id = coalesce(new_texture, texture_id),
         fit = coalesce(new_fit, fit),
         price = coalesce(new_price, price),
         /*
          * New files mean it has not been looked at in its new shape. A
          * thing approved as a cube and then swapped for something else is
          * the oldest way round a review there is, and it costs nothing to
          * close.
          */
         status = case when files_moved then 'pending'::public.moderation_status
                       else status end,
         review_note = case when files_moved then null else review_note end,
         reviewed_at = case when files_moved then null else reviewed_at end,
         updated_at = now()
   where id = item;

  return case when files_moved then 'pending' else 'changed' end;
end $$;

revoke all on function public.update_avatar_item(uuid, text, text, uuid, uuid, jsonb, integer) from public;
grant execute on function public.update_avatar_item(uuid, text, text, uuid, uuid, jsonb, integer)
  to authenticated;

commit;
