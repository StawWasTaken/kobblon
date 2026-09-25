-- A mesh arrives wearing something.
--
-- Staw: uploading a mesh should let you upload its texture at the same time,
-- or point at a Decal that already exists — one of yours, or somebody
-- else's. A mesh with no texture is a grey shape, and making somebody upload
-- the shape, then find the Decal page, then come back, is three steps for
-- one thought.
--
-- So a mesh carries the Decal it wears. Not a copy of the picture: the id of
-- a Decal, which is a piece of content in its own right with its own page,
-- its own owner and its own moderation. Pointing two meshes at one Decal is
-- one upload, and somebody else's Decal stays theirs.

alter table public.assets
  add column if not exists texture_id uuid references public.assets(id) on delete set null;

comment on column public.assets.texture_id is
  'The Decal a mesh wears by default. Null for everything else, and for a '
  'mesh nobody has dressed. On delete set null, because a Decal going away '
  'should undress a mesh rather than delete it.';

create index if not exists assets_texture_idx on public.assets (texture_id)
  where texture_id is not null;

/*
 * What may be pointed at, decided here rather than in a client.
 *
 * Only a mesh wears one; only a Decal can be worn. And it has to be a Decal
 * the person can actually see — their own, whatever state it is in, or one
 * that is approved and listed. Without that last part, a texture id is a way
 * of asking whether a private upload exists: point at one, see whether it is
 * refused, and you have read a row the policies would never have shown you.
 */
create or replace function public.check_texture()
returns trigger language plpgsql security definer set search_path = public as $$
declare wearing public.assets%rowtype;
begin
  if new.texture_id is null then return new; end if;

  if new.kind::text <> 'mesh' then
    raise exception 'Only a mesh wears a Decal.';
  end if;

  select * into wearing from public.assets where id = new.texture_id;

  if wearing.id is null or wearing.kind::text <> 'image' then
    raise exception 'That is not a Decal.';
  end if;

  if wearing.creator_id <> new.creator_id
     and not (wearing.status = 'approved' and wearing.is_public) then
    raise exception 'That Decal is not yours to use.';
  end if;

  return new;
end;
$$;

drop trigger if exists assets_texture_check on public.assets;
create trigger assets_texture_check
  before insert or update of texture_id on public.assets
  for each row execute function public.check_texture();

-- A note for whoever reads this next, having checked rather than assumed:
-- `guard_asset_update` pins what a creator may not change by copying the old
-- row's value over the new one, field by field. `texture_id` is deliberately
-- not in that list, so dressing a mesh after uploading it works — which is
-- what somebody will want, having found a better Decal a week later.
