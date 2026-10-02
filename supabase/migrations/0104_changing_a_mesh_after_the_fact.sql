begin;

-- Changing a mesh's picture, or its model, after it was uploaded.
--
-- Staw: "i want to be able to modify the mesh' texture & 3d file for 10 brix
-- each". It is also the answer to "the textures are still not applied" -
-- the burger in his screenshot has no Decal on it at all, and until now the
-- only way to attach one was to upload the whole thing again under a new
-- number, losing the uses, the reviews and the id anybody had already pasted
-- into a World.
--
-- Two functions rather than one, because they are two decisions and one of
-- them is far more serious: a picture can be swapped as often as somebody
-- likes, and replacing the model changes what every World that already
-- pasted this id is drawing.

create or replace function public.mesh_edit_price()
returns integer language sql immutable as $$ select 10 $$;

-- ------------------------------------------------------------- the picture

/*
 * Dressing a mesh, or undressing it.
 *
 * Taking a Decal off is free. Charging somebody to undo a thing they paid
 * for is how a shop makes people frightened of its own buttons, and the
 * point of the price is to make swapping deliberate, not to make it a trap.
 *
 * What may be worn is not decided here: `check_texture` already refuses
 * anything that is not a Decal, and anything the person could not open
 * anyway. This only decides who may ask and what it costs.
 */
create or replace function public.redress_mesh(target uuid, decal uuid)
returns integer language plpgsql security definer
  set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  cost integer := public.mesh_edit_price();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select a.id, a.creator_id, a.kind, a.texture_id into item
    from public.assets a where a.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.creator_id <> me then raise exception 'That is not yours to change.'; end if;
  if item.kind::text <> 'mesh' then raise exception 'Only a mesh wears a Decal.'; end if;

  if item.texture_id is not distinct from decal then
    -- Nothing to do, and nothing to charge for doing nothing.
    return 0;
  end if;

  if decal is not null then
    select pixels into balance from public.profiles where id = me;
    if balance < cost then
      raise exception 'Changing the picture costs % Brix and you have %.', cost, balance;
    end if;
  end if;

  update public.assets set texture_id = decal where id = target;

  if decal is not null then
    perform public.move_pixels(me, -cost, 'admin', 'Changed a mesh picture');
    return cost;
  end if;
  return 0;
end;
$$;

-- --------------------------------------------------------------- the model

/*
 * Replacing the model itself.
 *
 * The caller uploads the new file first and hands the path here, which is
 * the same shape every other upload has. So the path is checked rather than
 * trusted: it must sit in the caller's own folder, and it must be a format
 * `expected_extensions` allows for a mesh. Without the first of those, a
 * path is a way to point somebody's row at somebody else's file.
 *
 * `file_path` is pinned by `guard_asset_update` and stays pinned - a
 * creator still cannot write it directly. This is the one door, and it
 * charges on the way through.
 */
create or replace function public.replace_mesh_file(
  target uuid, new_path text, new_size bigint
) returns integer language plpgsql security definer
  set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  cost integer := public.mesh_edit_price();
  extension text;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if coalesce(btrim(new_path), '') = '' then raise exception 'No file was given.'; end if;

  select a.id, a.creator_id, a.kind, a.file_path into item
    from public.assets a where a.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.creator_id <> me then raise exception 'That is not yours to change.'; end if;
  if item.kind::text <> 'mesh' then raise exception 'Only a mesh has a model.'; end if;

  if split_part(new_path, '/', 1) <> me::text then
    raise exception 'That file is not yours.';
  end if;

  extension := lower(split_part(new_path, '.', array_length(string_to_array(new_path, '.'), 1)));
  if not (extension = any(public.expected_extensions('mesh'))) then
    raise exception 'A mesh is %.', array_to_string(public.expected_extensions('mesh'), ', ');
  end if;

  if new_size is null or new_size <= 0 then raise exception 'That file is empty.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < cost then
    raise exception 'Changing the model costs % Brix and you have %.', cost, balance;
  end if;

  /*
   * Back to pending. The model is what moderation looked at, so a new one
   * has not been looked at - and leaving it approved would make this the
   * way to get anything past screening: upload something harmless, wait,
   * then swap the file underneath the approval.
   */
  /*
   * `guard_asset_update` pins file_path, byte_size and status against a
   * creator writing them directly, and rightly - this function is the one
   * door, and it has to say so on the way through or the guard quietly puts
   * every one of them back. Exactly the shape that stopped Brix moving:
   * security definer changes what a function may do, not who auth.uid()
   * says is asking.
   */
  perform set_config('kobbleston.counting', 'on', true);

  update public.assets
     set file_path = new_path,
         byte_size = new_size,
         status = 'pending',
         reviewed_at = null,
         review_note = null
   where id = target;

  perform set_config('kobbleston.counting', 'off', true);

  perform public.move_pixels(me, -cost, 'admin', 'Changed a mesh model');
  return cost;
end;
$$;

grant execute on function public.mesh_edit_price to anon, authenticated;
grant execute on function public.redress_mesh to authenticated;
grant execute on function public.replace_mesh_file to authenticated;

commit;
