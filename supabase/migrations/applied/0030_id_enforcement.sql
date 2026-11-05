-- An id is not a secret and never was: it is in the address bar, in a tile,
-- in a tooltip. What stops somebody using a thing they have not taken is not
-- hiding the number, it is the platform refusing to resolve it for them.
--
-- So: resolving a reference goes through here, and here checks the
-- inventory. Copying "IMG-1042" out of a URL gets you the number and
-- nothing else.

/*
 * The builder's side. Called when somebody is putting content into a Space
 * they own. It answers with the file only when that person may use it.
 */
create or replace function public.resolve_asset_ref(target_content_id bigint)
returns table (id uuid, kind public.asset_kind, file_path text, name text)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.file_path, a.name
    from public.assets a
   where a.content_id = target_content_id
     and a.status = 'approved'
     and public.can_use_asset(a.id);
$$;

grant execute on function public.resolve_asset_ref to authenticated;

/*
 * What a Space is using, written when the owner puts it in. The check runs
 * once, at that moment, against the person building. Visitors then see the
 * picture because the Space is allowed to show it, not because they own it,
 * which is how it should be: you do not have to own a font to read a page
 * set in it.
 */
create table if not exists public.space_assets (
  space_id uuid not null references public.spaces on delete cascade,
  asset_id uuid not null references public.assets on delete cascade,
  added_by uuid references public.profiles on delete set null,
  added_at timestamptz not null default now(),
  primary key (space_id, asset_id)
);

create index if not exists space_assets_asset_idx on public.space_assets (asset_id);

alter table public.space_assets enable row level security;

drop policy if exists space_assets_read on public.space_assets;
create policy space_assets_read on public.space_assets for select using (true);

-- Nothing writes to this except the function below, which does the checking.
revoke insert, update, delete on public.space_assets from anon, authenticated;

create or replace function public.use_asset_in_space(space uuid, target_content_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare item record;
begin
  if not public.can_edit_space(space) then
    raise exception 'That is not your Space.';
  end if;

  select a.id, a.file_path, a.name, a.status
    into item
    from public.assets a
   where a.content_id = target_content_id;

  if item.id is null then raise exception 'Nothing carries that id.'; end if;
  if item.status <> 'approved' then raise exception 'That is not approved.'; end if;

  if not public.can_use_asset(item.id) then
    raise exception 'That is not in your inventory. Take it in the marketplace first.';
  end if;

  insert into public.space_assets (space_id, asset_id, added_by)
  values (space, item.id, auth.uid())
  on conflict (space_id, asset_id) do nothing;

  return item.file_path;
end;
$$;

grant execute on function public.use_asset_in_space to authenticated;

/*
 * The visitor's side: the file behind a reference a Space is already using.
 * No inventory check, because the Space carries the right, not the reader.
 */
create or replace function public.space_asset_path(space uuid, target_content_id bigint)
returns text language sql stable security definer set search_path = public as $$
  select a.file_path
    from public.space_assets sa
    join public.assets a on a.id = sa.asset_id
   where sa.space_id = space
     and a.content_id = target_content_id
     and a.status = 'approved';
$$;

grant execute on function public.space_asset_path to anon, authenticated;

-- Taking something back out of your inventory. Your own work and verified
-- Kobbleston content are not in there by choice, so they cannot be removed;
-- what you paid is not refunded, which the interface says before you do it.
create or replace function public.drop_from_inventory(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  if not exists (select 1 from public.asset_grants g
                  where g.asset_id = target and g.user_id = auth.uid()) then
    raise exception 'That is not something you took.';
  end if;

  delete from public.asset_grants where asset_id = target and user_id = auth.uid();
end;
$$;

grant execute on function public.drop_from_inventory to authenticated;
