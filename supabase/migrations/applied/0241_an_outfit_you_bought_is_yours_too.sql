begin;

/*
 * Buying an outfit leaves you with the outfit, not only with its clothes.
 *
 * `buy_outfit` bought every piece and stopped there, which is correct about
 * the money and wrong about what somebody thinks they bought: they pressed
 * a button under a picture of a look, paid for it, and were handed five
 * separate things and no way to put them on together. The maker's
 * arrangement - which slot each piece sits in, and the body colours under
 * it - was the part being sold and the part that was not kept.
 *
 * So the purchase takes a copy: same name, same pieces in the same slots,
 * same body, owned by the buyer, marked with where it came from.
 *
 * Staw: "for outfits i want two sections: purchased, created/saved". The
 * mark is what makes those two sections possible, and it is a fact about
 * the outfit rather than a label the page keeps.
 *
 * A bought copy cannot be put on the Catalog. Reselling somebody else's
 * arrangement under your own name is the one thing this copy would make
 * easy, and a rule a page keeps is a rule anybody with a console does not
 * have - so it is a trigger.
 */

alter table public.outfits
  add column if not exists bought_from uuid references public.outfits(id) on delete set null,
  add column if not exists bought_at timestamptz;

create index if not exists outfits_bought on public.outfits (owner_id, bought_at);

create or replace function public.guard_bought_outfit()
returns trigger
language plpgsql
set search_path = public, extensions as $$
begin
  if new.is_public and new.bought_from is not null then
    raise exception 'An outfit you bought cannot be sold on. Save your own version of it first.';
  end if;
  return new;
end;
$$;

drop trigger if exists outfits_bought_stay_private on public.outfits;
create trigger outfits_bought_stay_private
  before insert or update on public.outfits
  for each row execute function public.guard_bought_outfit();

create or replace function public.buy_outfit(target uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  outfit record;
  one record;
  bought integer := 0;
  spent integer := 0;
  cut integer;
  copy_id uuid;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot buy. Make an account and you can.';
  end if;

  select * into outfit from public.outfits
   where id = target and is_public and not is_removed;
  if outfit.id is null then raise exception 'That outfit is not for sale.'; end if;
  if outfit.owner_id = me then raise exception 'That one is already yours.'; end if;

  for one in
    select i.id, i.price
      from public.outfit_items oi
      join public.avatar_items i on i.id = oi.item_id
     where oi.outfit_id = target
       and not i.is_removed
       and i.status = 'approved'
       and not exists (
         select 1 from public.avatar_owned o
          where o.item_id = i.id and o.user_id = me
       )
  loop
    perform public.buy_avatar_item(one.id);
    bought := bought + 1;
    spent := spent + one.price;
  end loop;

  if bought = 0 then
    raise exception 'You already own everything in it.';
  end if;

  if outfit.maker_share > 0 and spent > 0 and house is not null then
    cut := floor(spent * outfit.maker_share / 100.0)::integer;
    if cut > 0 and outfit.owner_id <> house then
      perform public.move_pixels(house, -cut, 'sale', 'Outfit share: ' || outfit.name);
      perform public.move_pixels(outfit.owner_id, cut, 'sale', 'Outfit sold: ' || outfit.name);
    end if;
  end if;

  /*
   * The copy. Only once: buying the same outfit twice is not two outfits
   * in the drawer, and the pieces are already owned the second time
   * anyway, so this only ever fires on a purchase that did something.
   */
  if not exists (
    select 1 from public.outfits
     where owner_id = me and bought_from = target and not is_removed
  ) then
    insert into public.outfits (owner_id, name, body, bought_from, bought_at)
    values (me, outfit.name, outfit.body, target, now())
    returning id into copy_id;

    insert into public.outfit_items (outfit_id, item_id, slot)
    select copy_id, oi.item_id, oi.slot
      from public.outfit_items oi
     where oi.outfit_id = target;
  end if;

  return bought;
end;
$$;

/* The reader has to say where an outfit came from, or the drawer cannot. */
drop function if exists public.my_outfits();
create function public.my_outfits()
returns table (
  id uuid, content_id bigint, name text, folder_id uuid, folder_name text,
  body jsonb, is_public boolean, price integer, maker_share integer,
  created_at timestamptz, pieces jsonb,
  bought_from uuid, bought_at timestamptz,
  maker_username text, maker_display_name text
)
language sql stable security definer
set search_path = public, extensions as $$
  select o.id, o.content_id, o.name, o.folder_id, f.name,
         o.body, o.is_public, o.price, o.maker_share, o.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'item_id', i.id, 'slot', oi.slot, 'kind', i.kind, 'name', i.name,
             'price', i.price,
             'image_path', i.image_path, 'image_bucket', i.image_bucket,
             'preview_path', i.preview_path,
             'mesh_preview_path', m.preview_path,
             'owned', exists (select 1 from public.avatar_owned w
                               where w.item_id = i.id and w.user_id = auth.uid())
           ) order by oi.slot)
           from public.outfit_items oi
           join public.avatar_items i on i.id = oi.item_id
           left join public.assets m on m.id = i.mesh_id
          where oi.outfit_id = o.id
        ), '[]'::jsonb),
         o.bought_from, o.bought_at,
         mk.username, mk.display_name
    from public.outfits o
    left join public.outfit_folders f on f.id = o.folder_id
    left join public.outfits src on src.id = o.bought_from
    left join public.profiles mk on mk.id = src.owner_id
   where o.owner_id = auth.uid() and not o.is_removed
   order by o.updated_at desc
   limit 200;
$$;

grant execute on function public.my_outfits to authenticated;
grant execute on function public.buy_outfit to authenticated;

commit;
