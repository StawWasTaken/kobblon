begin;

-- 1. What a guest arrives wearing.
--
-- Staw's numbers: a shirt, trousers and an accessory, on top of the face and
-- the t-decal everybody gets. Rows rather than code, which is what
-- `starting_kit` is for - the table was built so that this day would be an
-- insert and nothing else.
--
-- `who = 'guest'` and locked: a guest is an advert for the platform walking
-- around inside it, and one that can undress is an advert for nothing.

insert into public.starting_kit (content_id, who, locked_for_guests, note) values
  (1221, 'guest', true, 'The guest shirt.'),
  (1220, 'guest', true, 'The guest trousers.'),
  (1212, 'guest', true, 'The guest cap.')
on conflict (content_id) do update
   set who = excluded.who,
       locked_for_guests = excluded.locked_for_guests,
       note = excluded.note;

-- 1b. And the grant `starting_kit` never had.
--
-- 0131 gave it a policy saying anybody may read it and no grant, so the
-- policy was guarding a door nobody could reach: a check here failed with
-- "permission denied for table starting_kit". The same mistake as the outfit
-- tables a few files ago, which is the second time, which is why it is now
-- written down as a trap rather than as a comment.
--
-- `give_starting_kit` is `security definer` and never noticed, which is
-- exactly why nobody noticed: the feature worked and only a page reading the
-- table directly would have found it.
grant select on public.starting_kit to anon, authenticated;

-- 2. Kobblon can price its own work at anything, including nothing.
--
-- Every kind has a floor - a shirt sells for at least five Brix - and that
-- floor exists so the Catalog is not drowned in free listings made to farm
-- something. Kobblon is not who that rule is about: the house setting its
-- own starter clothes to free is the house giving people clothes.
--
-- The exemption is read from the database rather than passed in, so it is
-- not something a page can claim. And it is only about the *floor*: Kobblon
-- is still screened, still charged the upload fee, and still has to own what
-- it is listing.

create or replace function public.price_floor_for(who uuid, of_kind text)
returns integer
language sql stable
set search_path = public, extensions as $$
  select case
    when coalesce((select is_admin from public.profiles where id = who), false)
      then 0
    else coalesce((select r.least_price from public.avatar_rules() r where r.kind = of_kind), 0)
  end;
$$;

grant execute on function public.price_floor_for to authenticated;

create or replace function public.list_avatar_item(
  target uuid, listed boolean, cost integer default null
)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  floor_price integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into item from public.avatar_items where id = target;
  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.creator_id <> me then raise exception 'That is not yours.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if listed then
    if item.status <> 'approved' then
      raise exception 'It has not been screened yet.';
    end if;

    floor_price := public.price_floor_for(me, item.kind);
    if coalesce(cost, item.price) < floor_price then
      raise exception 'A % sells for at least % Brix.', item.kind, floor_price;
    end if;
  end if;

  update public.avatar_items
     set is_public = listed,
         price = coalesce(cost, price),
         updated_at = now()
   where id = target;
end;
$$;

grant execute on function public.list_avatar_item to authenticated;

commit;
