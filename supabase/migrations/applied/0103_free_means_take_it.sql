begin;

-- A free thing is taken, not asked for.
--
-- Staw: "theres also an issue with the creator marketplace that u cant buy
-- or get others' stuff, but u need to 'ask' them, just remove the ask thing
-- shit".
--
-- `buy_asset` refused anything priced at zero outright - "That one is free.
-- Ask its creator instead." - and the website drew a Get button for exactly
-- those, which called it and got that back. Every free upload on the
-- Marketplace was a dead end with a working-looking button on it.
--
-- The asking it pointed at is gone from the website already: nothing calls
-- `requestAssetUse`, nothing renders a request, and `asset_grants` is only
-- ever written by a purchase. So the message named a door that was not
-- there any more.
--
-- Taking a free one now grants it the same way buying does, with no money
-- moved, because there is none to move. Everything else it refuses, it
-- still refuses: not listed, not approved, already yours, already usable,
-- and guests.

create or replace function public.buy_asset(target uuid)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  house uuid := public.kobbleston_account();
  cut integer;
  earned integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot take things.'; end if;

  select a.id, a.creator_id, a.price, a.name, a.status, a.is_public
    into item
    from public.assets a
   where a.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.status <> 'approved' or not item.is_public then
    raise exception 'That is not on the Marketplace.';
  end if;
  if item.creator_id = me then raise exception 'That is already yours.'; end if;
  if public.can_use_asset(target, me) then raise exception 'You can already use it.'; end if;

  /*
   * Only a priced one moves money. A free one skips the balance check, the
   * ledger and the platform's share, because a share of nothing is nothing
   * and a ledger row saying zero is noise in somebody's history.
   */
  if item.price > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < item.price then
      raise exception 'That costs % Brix and you have %.', item.price, balance;
    end if;

    cut := round(item.price * public.platform_share() / 100.0)::integer;
    earned := item.price - cut;

    perform public.move_pixels(me, -item.price, 'purchase', 'Bought ' || item.name);
    perform public.move_pixels(item.creator_id, earned, 'sale', 'Sold ' || item.name);

    if cut > 0 and house is not null and house <> item.creator_id then
      perform public.move_pixels(house, cut, 'platform_fee', 'Share of ' || item.name);
    end if;
  end if;

  insert into public.asset_grants (asset_id, user_id, state, answered_at)
  values (target, me, 'granted', now())
  on conflict (asset_id, user_id) do update set state = 'granted', answered_at = now();
end;
$$;

-- ------------------------------------------------- the currency's own name

/*
 * Brix, everywhere somebody can read it. Seven functions still said Kubes,
 * which is what the currency was called before it was called Brix - so the
 * website says one thing and the refusal that comes back from the server
 * says another, in the same sentence as somebody being told they cannot
 * afford something.
 */
create or replace function public.buy_style_item(target uuid)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
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

  select s.id, s.creator_id, s.price, s.name, s.is_public, s.is_removed
    into item
    from public.style_items s where s.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.is_removed or not item.is_public then raise exception 'That is not on sale.'; end if;

  if exists (select 1 from public.style_owners o
              where o.item_id = target and o.user_id = me) then
    raise exception 'You have that already.';
  end if;

  if item.price > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < item.price then
      raise exception 'That costs % Brix and you have %.', item.price, balance;
    end if;

    cut := round(item.price * public.platform_share() / 100.0)::integer;
    earned := item.price - cut;

    perform public.move_pixels(me, -item.price, 'purchase', 'Bought ' || item.name);
    perform public.move_pixels(item.creator_id, earned, 'sale', 'Sold ' || item.name);

    if cut > 0 and house is not null and house <> item.creator_id then
      perform public.move_pixels(house, cut, 'platform_fee', 'Share of ' || item.name);
    end if;
  end if;

  insert into public.style_owners (item_id, user_id, paid)
  values (target, me, item.price)
  on conflict do nothing;
end;
$$;

-- Six more still say Kubes: create_campaign, donate_to_space,
-- grant_community_kubes, list_for_sale, renew_campaign and
-- set_campaign_days. Deliberately not touched here. Rewriting a function
-- from its name rather than from its body is how the `on conflict do
-- nothing` on the insert above nearly went missing - it is not in the
-- version I first wrote for this file, and it matters the moment two
-- presses race. They get a pass of their own, each one read first.

commit;
