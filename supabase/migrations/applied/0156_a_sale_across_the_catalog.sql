begin;

-- Kobblon can put the whole Catalog on sale for a while.
--
-- Staw: "make that through the staff console we can set reduction of prices
-- across the entire catalog for a limited time (does not apply to limited
-- items)".
--
-- A row with a percentage and an end, not a column on every item: a sale is
-- one fact about the shop, and writing it onto ten thousand rows means
-- writing it off them again afterwards - and whatever is half-written when
-- that fails is a shop with no consistent price in it.
--
-- Limiteds are left out, and that is the whole point of them: somebody paid
-- what a limited cost because it was closing, and a discount a week later is
-- that promise broken. The rule lives in `sale_price` so it is one sentence
-- in one place rather than a condition every caller has to remember.

create table if not exists public.catalog_sales (
  id uuid primary key default gen_random_uuid(),
  /* How much comes off, in whole percent. Capped well short of free: a sale
     is a discount, and anything that can take a price to nothing is a way to
     empty the economy by pressing one button. */
  percent_off integer not null check (percent_off between 1 and 75),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  note text,
  started_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists catalog_sales_window_idx
  on public.catalog_sales (ends_at desc);

alter table public.catalog_sales enable row level security;

-- Anybody may read it: a sale is a thing the shop announces, and the price
-- shown has to agree with the price charged.
drop policy if exists catalog_sales_read on public.catalog_sales;
create policy catalog_sales_read on public.catalog_sales for select using (true);

-- The grants, in the same file as the table. Twice this project has written
-- a policy and no grant and spent days with a table nobody could reach.
grant select on public.catalog_sales to anon, authenticated;

/**
 * The sale that is on, if one is.
 *
 * The one that started most recently wins where two overlap, which is the
 * answer somebody expects from pressing the button twice - the new sale is
 * the sale. Nothing here stops two existing, because stopping it means a
 * constraint over ranges and the question "which is on" has a plain answer
 * without one.
 */
create or replace function public.sale_now()
returns table (percent_off integer, ends_at timestamptz, note text)
language sql stable
set search_path = public, extensions as $$
  select s.percent_off, s.ends_at, s.note
    from public.catalog_sales s
   where s.starts_at <= now() and s.ends_at > now()
   order by s.starts_at desc
   limit 1;
$$;

grant execute on function public.sale_now to anon, authenticated;

/**
 * What something actually costs right now.
 *
 * One sentence, in one place: a limited is never discounted, a free thing
 * stays free, and everything else comes down by the sale's percentage,
 * rounded up so a sale never makes something cost nothing.
 *
 * The website has a copy of this rule for showing prices. The copy is the
 * price people *see*; this is the price they are *charged*, and the charging
 * one is the one that counts.
 */
create or replace function public.sale_price(
  full_price integer, sells_until timestamptz
)
returns integer
language sql stable
set search_path = public, extensions as $$
  select case
    when coalesce(full_price, 0) <= 0 then coalesce(full_price, 0)
    -- A limited: what it cost is what it cost.
    when sells_until is not null then full_price
    else coalesce(
      (select greatest(1, ceil(full_price * (100 - s.percent_off) / 100.0)::integer)
         from public.sale_now() s),
      full_price
    )
  end;
$$;

grant execute on function public.sale_price to anon, authenticated;

/**
 * Starts a sale. Kobblon only, and the database says so.
 *
 * `security definer` with the check inside, so the page offering it is a
 * suggestion and this is the rule.
 */
create or replace function public.start_catalog_sale(
  percent integer, until timestamptz, why text default null
)
returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon can put the Catalog on sale.';
  end if;
  if percent is null or percent < 1 or percent > 75 then
    raise exception 'A sale takes between 1 and 75 percent off.';
  end if;
  if until is null or until <= now() then
    raise exception 'A sale has to end some time after it starts.';
  end if;
  if until > now() + interval '90 days' then
    raise exception 'Three months is as long as a sale may run.';
  end if;

  insert into public.catalog_sales (percent_off, ends_at, note, started_by)
  values (percent, until, nullif(btrim(coalesce(why, '')), ''), me)
  returning id into made;

  return made;
end;
$$;

grant execute on function public.start_catalog_sale to authenticated;

/** Ends whatever is on, now. Kobblon only. */
create or replace function public.end_catalog_sale()
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon can end a sale.';
  end if;

  update public.catalog_sales
     set ends_at = now()
   where starts_at <= now() and ends_at > now();
end;
$$;

grant execute on function public.end_catalog_sale to authenticated;

commit;

begin;

/**
 * Buying something, at the price it costs today.
 *
 * Taken from the database as it stands with one change: the amount charged,
 * the maker's share, the platform's cut and the figure written into
 * `avatar_owned.paid` all come from `sale_price` rather than from the
 * item's own number.
 *
 * `paid` matters more than it looks: a takedown refunds 40% of what somebody
 * actually paid, so writing the full price there would pay people back more
 * than they spent - a sale that loses Kobblon money every time something is
 * taken down afterwards.
 */
create or replace function public.buy_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  keeps integer;
  cut integer;
  costs integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot take things. Make an account and you can.';
  end if;

  select i.*, p.is_suspended as maker_suspended into item
    from public.avatar_items i
    join public.profiles p on p.id = i.creator_id
   where i.id = target;

  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if exists (select 1 from public.avatar_owned o
              where o.item_id = target and o.user_id = me) then
    return;
  end if;

  if item.creator_id = me then
    insert into public.avatar_owned (item_id, user_id, paid) values (target, me, 0)
    on conflict do nothing;
    return;
  end if;

  if not item.is_public or item.status <> 'approved' or item.maker_suspended then
    raise exception 'That is not for sale.';
  end if;

  if item.sells_until is not null and item.sells_until <= now() then
    raise exception 'That was limited, and the time to take it has passed.';
  end if;

  costs := public.sale_price(item.price, item.sells_until);

  if costs > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < costs then
      raise exception 'That costs % Brix and you have %.', costs, balance;
    end if;

    cut := round(costs * public.platform_share() / 100.0)::integer;
    keeps := costs - cut;

    perform public.move_pixels(me, -costs, 'purchase', 'Bought ' || item.name);
    perform public.move_pixels(item.creator_id, keeps, 'sale', 'Sold ' || item.name);
    if cut > 0 and house is not null and house <> item.creator_id then
      perform public.move_pixels(house, cut, 'platform_fee', 'Cut of ' || item.name);
    end if;
  end if;

  insert into public.avatar_owned (item_id, user_id, paid)
  values (target, me, costs)
  on conflict do nothing;
end;
$$;

commit;
