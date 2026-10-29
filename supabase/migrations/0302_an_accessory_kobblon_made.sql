begin;

/*
 * ACCS-1440 belongs to Kobblon.
 *
 * Staw: "can you also make that this accesory is made by kobblon and not by
 * staw ACCS-1440". He built it on his own account because that is the
 * account he was signed in to, and the Catalog says who made a thing by
 * naming the row's creator - so the item reads as one person's work when it
 * is the platform's.
 *
 * A data correction rather than a feature: there is no screen for moving an
 * item between accounts, and building one for a single accessory would be a
 * page, a permission and a record of who moved what. If this becomes a
 * habit it earns that page; once, it earns this.
 *
 * Two rows move, not one. The item is what the Catalog names, but the mesh
 * it wears is an upload with a creator of its own, and the asset page for
 * that mesh would still say Staw - which is the same confusion one click
 * further in. The Decal the mesh wears moves with it for the same reason.
 *
 * `kobbleston.counting` is raised around the asset update because
 * `guard_asset_update` pins `creator_id` back to its old value for anybody
 * who is not a moderator, and the SQL editor is nobody: `auth.uid()` is
 * null there. Without the flag this file applies cleanly, reports success,
 * and moves nothing - which is this project's third trap exactly.
 *
 * Applying it twice is a no-op: the second run finds nothing owned by
 * anybody else.
 */

set search_path = public, extensions;

do $$
declare
  kobblon uuid;
  item    record;
  moved   integer := 0;
begin
  select id into kobblon
    from public.profiles
   where lower(username) = 'kobblon'
   limit 1;

  if kobblon is null then
    raise exception 'There is no account called kobblon to give this to.';
  end if;

  select id, creator_id, mesh_id, texture_id, name
    into item
    from public.avatar_items
   where content_id = 1440
     and kind = 'accessory'
   limit 1;

  if item.id is null then
    raise exception 'ACCS-1440 does not exist.';
  end if;

  if item.creator_id = kobblon then
    raise notice 'ACCS-1440 (%) is already Kobblon''s.', item.name;
    return;
  end if;

  update public.avatar_items
     set creator_id = kobblon
   where id = item.id;

  /* The guard pins creator_id for anybody who is not a moderator, and in
     the SQL editor auth.uid() is null, so it would pin it here. */
  perform set_config('kobbleston.counting', 'on', true);

  update public.assets
     set creator_id = kobblon
   where id in (item.mesh_id, item.texture_id)
     and creator_id is distinct from kobblon;

  get diagnostics moved = row_count;
  perform set_config('kobbleston.counting', 'off', true);

  raise notice 'ACCS-1440 (%) is Kobblon''s now, with % of its files.',
    item.name, moved;
end;
$$;

commit;
