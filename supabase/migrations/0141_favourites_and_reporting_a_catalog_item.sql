begin;

-- Starring something, and reporting it.

-- 1. Favourites.
--
-- A row per person per item, which is the whole of it. No count column on
-- the item: a number kept beside the rows that produce it is a number that
-- goes wrong the first time a row is deleted by something that forgot to
-- decrement it, and this count is small enough to ask for.

create table if not exists public.avatar_favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.avatar_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists avatar_favourites_by_item
  on public.avatar_favourites (item_id);

alter table public.avatar_favourites enable row level security;

-- Readable by anybody, because the count is public - "forty people starred
-- this" is a fact about the item. Written only by the person it belongs to,
-- and that is the policy rather than a function, because there is no rule
-- here beyond "it is yours".
drop policy if exists avatar_favourites_read on public.avatar_favourites;
create policy avatar_favourites_read on public.avatar_favourites
  for select using (true);

drop policy if exists avatar_favourites_own on public.avatar_favourites;
create policy avatar_favourites_own on public.avatar_favourites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

/**
 * Stars something, or takes the star off.
 *
 * Returns how many people have starred it afterwards, so a page can show the
 * new number without asking again - and so the number shown is the server's
 * rather than the page's guess at what its own press did.
 */
create or replace function public.favourite_avatar_item(target uuid, on_off boolean)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  how_many integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot keep favourites. Make an account and you can.';
  end if;

  if not exists (
    select 1 from public.avatar_items i
     where i.id = target and not i.is_removed
       and (i.status = 'approved' or i.creator_id = me)
  ) then
    raise exception 'There is no such item.';
  end if;

  if on_off then
    insert into public.avatar_favourites (user_id, item_id)
    values (me, target) on conflict do nothing;
  else
    delete from public.avatar_favourites where user_id = me and item_id = target;
  end if;

  select count(*)::int into how_many
    from public.avatar_favourites where item_id = target;
  return how_many;
end;
$$;

grant execute on function public.favourite_avatar_item to authenticated;

/** Everything somebody has starred, newest first. */
create or replace function public.my_favourite_avatar_items()
returns table (
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, price integer,
  image_path text, image_bucket text, preview_path text, mesh_preview_path text,
  sells_until timestamptz, mesh_path text, texture_path text,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_verified boolean, creator_is_staff boolean,
  created_at timestamptz, owned boolean, taken integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path,
         i.sells_until, m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         public.wears_staff_badge(c.id),
         i.created_at,
         exists (select 1 from public.avatar_owned o
                  where o.item_id = i.id and o.user_id = auth.uid()),
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id)
    from public.avatar_favourites f
    join public.avatar_items i on i.id = f.item_id
    join public.profiles c on c.id = i.creator_id and not c.is_suspended
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where f.user_id = auth.uid()
     and not i.is_removed
   order by f.created_at desc
   limit 200;
$$;

grant execute on function public.my_favourite_avatar_items to authenticated;

-- 2. A Catalog item is a thing that can be reported.
--
-- The table already takes reports about seven kinds of thing and a Catalog
-- item was not one of them, so the control had nowhere to send one. Widened
-- rather than given a table of its own: a moderator works one queue.

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type = any (array[
    'profile', 'space', 'message', 'ad', 'asset', 'community', 'style',
    'avatar_item'
  ]));

commit;
