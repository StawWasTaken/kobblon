begin;

-- Reselling a limited, and the average price that comes out of it.
--
-- Staw: "people who own limited items can resell them and affect the average
-- price too (economy system)".
--
-- Limiteds only, and that is the whole shape of it: a thing you can still
-- buy from its maker has a price, and a market in it is a market against a
-- shop that never runs out. A limited stops selling, and from then on the
-- only way to get one is from somebody who has one - which is where a price
-- that moves comes from.
--
-- What is deliberately *not* here:
--
--   * No automatic pricing. The average is a number people are shown, not a
--     number anything is charged.
--   * No holding somebody's Brix. A sale happens when a buyer presses buy;
--     nothing is escrowed, because escrow is a second kind of balance and
--     this platform has one.
--   * No cancelling fee, no listing fee. Making a market expensive to enter
--     is how a market ends up with three sellers.

create table if not exists public.avatar_resales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.avatar_items(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  price integer not null check (price > 0),
  listed_at timestamptz not null default now(),
  -- Filled in when it goes. A sold row is the history this platform's prices
  -- are read out of, so it is kept rather than deleted.
  sold_at timestamptz,
  buyer_id uuid references public.profiles(id) on delete set null
);

-- One live listing per person per item: somebody with one copy cannot offer
-- it twice, and the rule is the index rather than a check in the function.
create unique index if not exists avatar_resales_one_live
  on public.avatar_resales (item_id, seller_id) where sold_at is null;

create index if not exists avatar_resales_cheapest
  on public.avatar_resales (item_id, price) where sold_at is null;

create index if not exists avatar_resales_history
  on public.avatar_resales (item_id, sold_at desc) where sold_at is not null;

alter table public.avatar_resales enable row level security;

-- Anybody may read the market: a price nobody can see is not a price.
drop policy if exists avatar_resales_read on public.avatar_resales;
create policy avatar_resales_read on public.avatar_resales for select using (true);

-- The grants, in the same file as the table.
grant select on public.avatar_resales to anon, authenticated;

/**
 * What a limited is going for.
 *
 * Three numbers, and each answers a different question: what it would cost
 * you now (the cheapest standing offer), what it has been going for (the
 * average of the last ten sales), and how many have changed hands.
 *
 * The average is of *sales*, not of listings. Listings are what people hope
 * for; sales are what people paid, and a market priced off hopes is a market
 * where one optimist moves the number.
 */
create or replace function public.resale_prices(target uuid)
returns table (cheapest integer, average integer, sold integer, offers integer)
language sql stable
set search_path = public, extensions as $$
  select
    (select min(r.price) from public.avatar_resales r
      where r.item_id = target and r.sold_at is null),
    (select round(avg(r.price))::integer from (
       select price from public.avatar_resales
        where item_id = target and sold_at is not null
        order by sold_at desc limit 10
     ) r),
    (select count(*)::integer from public.avatar_resales r
      where r.item_id = target and r.sold_at is not null),
    (select count(*)::integer from public.avatar_resales r
      where r.item_id = target and r.sold_at is null);
$$;

grant execute on function public.resale_prices to anon, authenticated;

/** The offers on one thing, cheapest first. */
create or replace function public.resale_offers(target uuid, how_many integer default 20)
returns table (
  id uuid, price integer, listed_at timestamptz,
  seller_id uuid, seller_username text, seller_display_name text, mine boolean
)
language sql stable
set search_path = public, extensions as $$
  select r.id, r.price, r.listed_at, p.id, p.username, p.display_name,
         r.seller_id = auth.uid()
    from public.avatar_resales r
    join public.profiles p on p.id = r.seller_id
   where r.item_id = target and r.sold_at is null and not p.is_suspended
   order by r.price, r.listed_at
   limit least(greatest(coalesce(how_many, 20), 1), 100);
$$;

grant execute on function public.resale_offers to anon, authenticated;

/**
 * Offering one for sale.
 *
 * It stays yours and stays on your body until somebody buys it: a listing is
 * an offer, not a surrender. The copy only moves at the moment money does.
 */
create or replace function public.list_resale(target uuid, asking integer)
returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  made uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot sell things. Make an account and you can.';
  end if;
  if asking is null or asking < 1 then
    raise exception 'Ask for at least one Brix.';
  end if;

  select * into item from public.avatar_items where id = target;
  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;
  if item.sells_until is null then
    raise exception 'Only a limited can be resold. Anything else is still on sale from the Catalog.';
  end if;

  if not exists (select 1 from public.avatar_owned o
                  where o.item_id = target and o.user_id = me) then
    raise exception 'You do not have one.';
  end if;

  begin
    insert into public.avatar_resales (item_id, seller_id, price)
    values (target, me, asking)
    returning id into made;
  exception when unique_violation then
    -- The index is the rule; this is the rule said in English. A refusal
    -- that quotes a constraint name is a refusal nobody can act on.
    raise exception 'You are already offering one. Take that offer back first.';
  end;

  return made;
end;
$$;

grant execute on function public.list_resale to authenticated;

/** Taking your own offer back. Only yours, and only while it is standing. */
create or replace function public.cancel_resale(offer uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  delete from public.avatar_resales
   where id = offer and seller_id = me and sold_at is null;
end;
$$;

grant execute on function public.cancel_resale to authenticated;

/**
 * Buying one from somebody.
 *
 * The copy moves: the seller stops owning it and the buyer starts, which is
 * the difference between a resale and a second sale of the same thing. The
 * seller's own listing is marked sold rather than deleted, because the
 * history is what the average is read out of.
 *
 * Kobblon takes the same cut it takes on everything, and the rest goes to
 * the seller - not to the maker. A maker is paid when their work is bought
 * from them; a resale is two other people trading something that is already
 * out in the world.
 */
create or replace function public.buy_resale(offer uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  deal record;
  item record;
  balance integer;
  cut integer;
  keeps integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot buy things. Make an account and you can.';
  end if;

  -- Locked, because two people pressing buy on the last copy at the same
  -- moment is the one thing a market has to get right.
  select * into deal from public.avatar_resales
   where id = offer and sold_at is null
   for update;
  if deal.id is null then raise exception 'That offer is gone.'; end if;
  if deal.seller_id = me then raise exception 'That is your own offer.'; end if;

  select * into item from public.avatar_items where id = deal.item_id;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if exists (select 1 from public.avatar_owned o
              where o.item_id = deal.item_id and o.user_id = me) then
    raise exception 'You already have one.';
  end if;

  -- The seller may have sold or been stripped of it since they offered it.
  if not exists (select 1 from public.avatar_owned o
                  where o.item_id = deal.item_id and o.user_id = deal.seller_id) then
    delete from public.avatar_resales where id = offer;
    raise exception 'They do not have it any more.';
  end if;

  select pixels into balance from public.profiles where id = me;
  if balance < deal.price then
    raise exception 'That costs % Brix and you have %.', deal.price, balance;
  end if;

  cut := round(deal.price * public.platform_share() / 100.0)::integer;
  keeps := deal.price - cut;

  perform public.move_pixels(me, -deal.price, 'purchase', 'Bought ' || item.name);
  perform public.move_pixels(deal.seller_id, keeps, 'sale', 'Resold ' || item.name);
  if cut > 0 and house is not null and house <> deal.seller_id then
    perform public.move_pixels(house, cut, 'platform_fee', 'Cut of ' || item.name);
  end if;

  -- The copy itself.
  delete from public.avatar_worn
   where user_id = deal.seller_id and item_id = deal.item_id;
  delete from public.avatar_owned
   where user_id = deal.seller_id and item_id = deal.item_id;

  insert into public.avatar_owned (item_id, user_id, paid)
  values (deal.item_id, me, deal.price)
  on conflict do nothing;

  update public.avatar_resales
     set sold_at = now(), buyer_id = me
   where id = offer;

  -- Any other offer that seller had on this thing is no longer theirs to
  -- make. One copy, one listing - but a row can outlive the copy.
  delete from public.avatar_resales
   where item_id = deal.item_id and seller_id = deal.seller_id and sold_at is null;
end;
$$;

grant execute on function public.buy_resale to authenticated;

commit;
