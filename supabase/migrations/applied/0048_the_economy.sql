-- Where Kubes go when something is sold.
--
-- Three rules, and one deliberate choice about the fourth.
--
-- 1. Putting something up for sale costs Kubes, and they go to Kobbleston's
--    own account. The fee is a tenth of what you are asking, never less than
--    five and never more than two hundred and fifty, so a cheap thing is
--    cheap to list and nobody lists a thousand things for nothing.
-- 2. Taking it back off sale hands back a quarter of what that listing cost,
--    paid out of the same account it went into.
-- 3. A sale is split: 35% to Kobbleston, the rest to whoever made the thing.
-- 4. Kubes are burned from Kobbleston's own holdings rather than out of each
--    sale, because a closed currency needs the total to come down sometimes
--    and doing it in one visible act a month is easier to reason about, and
--    to explain, than a tenth vanishing from every purchase. `burn_kubes`
--    takes between a tenth and a seventh of the account and records it.
--
-- Safe to run again.

alter table public.pixel_transactions drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions add constraint pixel_transactions_kind_check
  check (kind in ('signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
                  'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning',
                  'listing_fee', 'listing_refund', 'platform_fee', 'burn'));

/** Kobbleston's own account: where the platform's share of everything lands. */
create or replace function public.kobbleston_account()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p where lower(p.username) = 'kobbleston' limit 1;
$$;

grant execute on function public.kobbleston_account to authenticated;

/** What it costs to put something up at that price. */
create or replace function public.listing_fee(price integer)
returns integer language sql immutable as $$
  select greatest(5, least(250, round(coalesce(price, 0) * 0.10)::integer));
$$;

/** The platform's share of a sale, in hundredths, so the sums are one place. */
create or replace function public.platform_share() returns integer
language sql immutable as $$ select 35 $$;

grant execute on function public.listing_fee, public.platform_share to anon, authenticated;

-- What each listing cost, so taking it down can hand back a quarter of it.
create table if not exists public.asset_listings (
  asset_id uuid primary key references public.assets on delete cascade,
  price integer not null,
  fee integer not null,
  listed_at timestamptz not null default now()
);

alter table public.asset_listings enable row level security;

drop policy if exists asset_listings_read on public.asset_listings;
create policy asset_listings_read on public.asset_listings for select
  using (
    exists (select 1 from public.assets a
             where a.id = asset_id and a.creator_id = auth.uid())
    or public.is_moderator()
  );

revoke insert, update, delete on public.asset_listings from anon, authenticated;
grant select on public.asset_listings to authenticated;

-- A burn, kept as a record rather than a number that quietly changed.
create table if not exists public.kube_burns (
  id bigserial primary key,
  amount integer not null check (amount > 0),
  held_before integer not null,
  percent integer not null,
  burned_at timestamptz not null default now()
);

alter table public.kube_burns enable row level security;

drop policy if exists kube_burns_read on public.kube_burns;
create policy kube_burns_read on public.kube_burns for select using (true);

revoke insert, update, delete on public.kube_burns from anon, authenticated;
grant select on public.kube_burns to anon, authenticated;

/**
 * Putting something up for sale, or changing what it costs. The fee is paid
 * now, to Kobbleston, and it is what the refund is worked out from later.
 */
create or replace function public.list_for_sale(target uuid, asking integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  row_asset public.assets%rowtype;
  house uuid := public.kobbleston_account();
  fee integer;
  balance integer;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if asking is null or asking < 1 then
    raise exception 'A price of at least one Kube, or take it off sale instead.';
  end if;

  select * into row_asset from public.assets where id = target;
  if row_asset.id is null then raise exception 'That is not here.'; end if;
  if row_asset.creator_id <> me then raise exception 'That is not yours to sell.'; end if;
  if row_asset.status <> 'approved' then
    raise exception 'It has to pass review before it can be sold.';
  end if;
  if asking > public.price_ceiling(row_asset.kind) then
    raise exception 'The most a % can be sold for is %.',
      row_asset.kind, public.price_ceiling(row_asset.kind);
  end if;

  fee := public.listing_fee(asking);

  select pixels into balance from public.profiles where id = me;
  if balance < fee then
    raise exception 'Putting that up costs % Kubes and you have %.', fee, balance;
  end if;

  perform public.move_pixels(me, -fee, 'listing_fee', 'Put ' || row_asset.name || ' up for sale');
  if house is not null and house <> me then
    perform public.move_pixels(house, fee, 'listing_fee', 'Listing: ' || row_asset.name);
  end if;

  -- The price is pinned by the guard on this table, so it is set here, once,
  -- after the fee has actually been paid.
  perform set_config('kobbleston.pricing', 'on', true);
  update public.assets set price = asking where id = target;
  perform set_config('kobbleston.pricing', 'off', true);

  insert into public.asset_listings (asset_id, price, fee)
  values (target, asking, fee)
  on conflict (asset_id) do update
    set price = excluded.price, fee = excluded.fee, listed_at = now();

  return fee;
end;
$$;

/**
 * Taking something back off sale. A quarter of what the listing cost comes
 * back, out of the account it was paid into.
 */
create or replace function public.unlist_for_sale(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  row_asset public.assets%rowtype;
  house uuid := public.kobbleston_account();
  paid integer;
  back integer := 0;
  held integer;
begin
  if me is null then raise exception 'Not signed in.'; end if;

  select * into row_asset from public.assets where id = target;
  if row_asset.id is null then raise exception 'That is not here.'; end if;
  if row_asset.creator_id <> me then raise exception 'That is not yours.'; end if;
  if row_asset.price = 0 then raise exception 'That is not on sale.'; end if;

  select fee into paid from public.asset_listings where asset_id = target;
  back := round(coalesce(paid, 0) * 0.25)::integer;

  perform set_config('kobbleston.pricing', 'on', true);
  update public.assets set price = 0 where id = target;
  perform set_config('kobbleston.pricing', 'off', true);

  delete from public.asset_listings where asset_id = target;

  if back > 0 and house is not null and house <> me then
    select pixels into held from public.profiles where id = house;
    back := least(back, coalesce(held, 0));
    if back > 0 then
      perform public.move_pixels(house, -back, 'listing_refund', 'Unlisted: ' || row_asset.name);
      perform public.move_pixels(me, back, 'listing_refund',
                                 'Took ' || row_asset.name || ' off sale');
    end if;
  end if;

  return back;
end;
$$;

grant execute on function public.list_for_sale, public.unlist_for_sale to authenticated;

/**
 * Buying somebody's work. The price leaves the buyer whole; Kobbleston keeps
 * its share and the rest reaches whoever made the thing.
 */
create or replace function public.buy_asset(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  house uuid := public.kobbleston_account();
  cut integer;
  earned integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot buy.'; end if;

  select a.id, a.creator_id, a.price, a.name, a.status, a.is_public
    into item
    from public.assets a
   where a.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.status <> 'approved' or not item.is_public then
    raise exception 'That is not on sale.';
  end if;
  if item.creator_id = me then raise exception 'That is already yours.'; end if;
  if item.price = 0 then raise exception 'That one is free. Ask its creator instead.'; end if;
  if public.can_use_asset(target, me) then raise exception 'You can already use it.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < item.price then
    raise exception 'That costs % Kubes and you have %.', item.price, balance;
  end if;

  cut := round(item.price * public.platform_share() / 100.0)::integer;
  earned := item.price - cut;

  perform public.move_pixels(me, -item.price, 'purchase', 'Bought ' || item.name);
  perform public.move_pixels(item.creator_id, earned, 'sale', 'Sold ' || item.name);

  if cut > 0 and house is not null and house <> item.creator_id then
    perform public.move_pixels(house, cut, 'platform_fee', 'Share of ' || item.name);
  end if;

  insert into public.asset_grants (asset_id, user_id, state, answered_at)
  values (target, me, 'granted', now())
  on conflict (asset_id, user_id) do update set state = 'granted', answered_at = now();
end;
$$;

grant execute on function public.buy_asset to authenticated;

/**
 * The burn. Between a tenth and a seventh of what Kobbleston is holding stops
 * existing, and the fact of it is written down where anybody can read it.
 * Meant to be run once a month.
 */
create or replace function public.burn_kubes(percent integer default 12)
returns integer language plpgsql security definer set search_path = public as $$
declare
  house uuid := public.kobbleston_account();
  held integer;
  amount integer;
begin
  if not public.is_moderator() then raise exception 'Only Kobbleston can do that.'; end if;
  if percent < 10 or percent > 15 then
    raise exception 'A burn is between 10 and 15 per cent.';
  end if;
  if house is null then raise exception 'There is no Kobbleston account to burn from.'; end if;

  select pixels into held from public.profiles where id = house;
  amount := floor(coalesce(held, 0) * percent / 100.0)::integer;
  if amount < 1 then return 0; end if;

  perform public.move_pixels(house, -amount, 'burn', 'Burned ' || percent || '% of what was held');
  insert into public.kube_burns (amount, held_before, percent) values (amount, held, percent);

  return amount;
end;
$$;

grant execute on function public.burn_kubes to authenticated;

/** What has been burned so far, which is nobody's secret. */
create or replace function public.burn_history(limit_count integer default 24)
returns table (amount integer, held_before integer, percent integer, burned_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.amount, b.held_before, b.percent, b.burned_at
    from public.kube_burns b
   order by b.burned_at desc
   limit greatest(1, least(100, limit_count));
$$;

grant execute on function public.burn_history to anon, authenticated;

/*
 * The price can no longer be changed by writing to the row: it goes through
 * list_for_sale and unlist_for_sale, which is where the fee is charged. The
 * rest of this guard is as it was.
 */
create or replace function public.guard_asset_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare verdict public.screen_decision;
begin
  if public.is_moderator()
     or current_setting('kobbleston.counting', true) = 'on' then
    new.updated_at := now();
    return new;
  end if;

  new.creator_id     := old.creator_id;
  new.kind           := old.kind;
  new.file_path      := old.file_path;
  new.thumbnail_path := old.thumbnail_path;
  new.byte_size      := old.byte_size;
  new.content_id     := old.content_id;
  new.download_count := old.download_count;
  new.created_at     := old.created_at;
  new.status         := old.status;
  new.review_note    := old.review_note;
  new.reviewed_at    := old.reviewed_at;

  if current_setting('kobbleston.pricing', true) <> 'on' then
    new.price := old.price;
  elsif new.price > public.price_ceiling(new.kind) then
    raise exception 'That is more than a % can be sold for.', new.kind;
  end if;

  if new.name is distinct from old.name
     or new.description is distinct from old.description then
    verdict := (public.screen_text(
      coalesce(new.name, '') || ' ' || coalesce(new.description, ''))).decision;
    if verdict = 'block' then
      raise exception 'That name or description is not allowed here.';
    elsif verdict = 'review' then
      new.status := 'pending';
      new.review_note := null;
      new.reviewed_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_asset_update on public.assets;
create trigger guard_asset_update before update on public.assets
  for each row execute function public.guard_asset_update();
