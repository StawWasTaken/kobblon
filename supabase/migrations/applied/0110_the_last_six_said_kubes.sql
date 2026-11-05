begin;

-- The last six places that still said Kubes.
--
-- The currency has been Brix since 0071 and these were missed: the money
-- moved correctly, and then the refusal came back in the old name. Somebody
-- short of money was told "You do not have that many Kubes", which names
-- something that does not exist on this site any more - so it reads as a
-- fault rather than as a balance.
--
-- Only the words a person reads. `ad_max_kubes()` and the `kubes` arguments
-- keep their names: renaming an argument changes a function's signature, and
-- every caller with it, to fix something nobody will ever see. A name in the
-- schema is not a name in the product.

-- create_campaign: 3 said Kubes
create or replace function public.create_campaign(campaign_name text, kubes integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  balance integer;
  made uuid;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if public.is_guest() then raise exception 'Guests cannot buy ads.'; end if;
  if char_length(trim(campaign_name)) < 3 or char_length(trim(campaign_name)) > 60 then
    raise exception 'Give the campaign a name, between 3 and 60 letters.';
  end if;
  if kubes < 10 then raise exception 'A campaign needs at least 10 Brix behind it.'; end if;
  if kubes > public.ad_max_kubes() then
    raise exception 'A campaign carries at most % Brix, which is a month.', public.ad_max_kubes();
  end if;

  select pixels into balance from public.profiles where id = me;
  if balance < kubes then raise exception 'You do not have that many Brix.'; end if;

  insert into public.ad_campaigns (buyer_id, name, budget, ends_at)
  values (me, trim(campaign_name), kubes, now() + (public.ad_days(kubes) || ' days')::interval)
  returning id into made;

  perform public.move_pixels(me, -kubes, 'ad_budget', 'Campaign: ' || trim(campaign_name));
  return made;
end;
$function$;

-- donate_to_space: 3 said Kubes
create or replace function public.donate_to_space(space uuid, amount integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  owner uuid;
  space_name text;
  balance integer;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if public.is_guest() then raise exception 'Guests cannot give Brix. Make an account and you can.'; end if;
  if amount < 1 or amount > 10000 then raise exception 'Between 1 and 10000 Brix.'; end if;

  select s.owner_id, s.name into owner, space_name
    from public.spaces s
   where s.id = space and s.is_published and not s.is_removed;

  if owner is null then raise exception 'No such Space.'; end if;
  if owner = me then raise exception 'You cannot tip yourself.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < amount then raise exception 'You do not have that many Brix.'; end if;

  perform public.move_pixels(me, -amount, 'donation', 'Gave to ' || space_name);
  perform public.move_pixels(owner, amount, 'donation', 'A gift from a visitor to ' || space_name);

  return balance - amount;
end;
$function$;

-- grant_community_kubes: 2 said Kubes
create or replace function public.grant_community_kubes(community uuid, target uuid, amount integer, note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare available integer;
begin
  if not public.community_can(community, 'can_manage_community') then
    raise exception 'You cannot spend this Community''s funds.';
  end if;
  if amount is null or amount < 1 then raise exception 'Give at least 1 Brix.'; end if;

  if not exists (select 1 from public.community_members m
                  where m.community_id = community and m.user_id = target) then
    raise exception 'They are not in this Community.';
  end if;

  select funds into available from public.communities where id = community for update;
  if available < amount then
    raise exception 'That would spend % Brix and the Community has %.', amount, available;
  end if;

  update public.communities set funds = funds - amount where id = community;
  perform public.move_pixels(target, amount, 'admin', coalesce(note, 'From a Community'));
  perform public.log_community_money(community, -amount, 'grant', note, target);
  perform public.log_community(community, 'granted_kubes', target::text);
end;
$function$;

-- list_for_sale: 2 said Kubes
create or replace function public.list_for_sale(target uuid, asking integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  row_asset public.assets%rowtype;
  house uuid := public.kobbleston_account();
  fee integer;
  balance integer;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if asking is null or asking < 1 then
    raise exception 'A price of at least one Brix, or take it off sale instead.';
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
    raise exception 'Putting that up costs % Brix and you have %.', fee, balance;
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
$function$;

-- renew_campaign: 3 said Kubes
create or replace function public.renew_campaign(target uuid, kubes integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  row_c public.ad_campaigns%rowtype;
  balance integer;
  until timestamptz;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if kubes < 10 then raise exception 'A renewal needs at least 10 Brix behind it.'; end if;
  if kubes > public.ad_max_kubes() then
    raise exception 'A campaign carries at most % Brix, which is a month.', public.ad_max_kubes();
  end if;

  select * into row_c from public.ad_campaigns where id = target for update;
  if row_c.id is null then raise exception 'No such campaign.'; end if;
  if row_c.buyer_id <> me then raise exception 'That is not your campaign.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < kubes then raise exception 'You do not have that many Brix.'; end if;

  until := now() + (public.ad_days(kubes) || ' days')::interval;

  update public.ad_campaigns
     set budget = budget - refunded + kubes,
         refunded = 0,
         ends_at = until,
         is_running = true,
         renewed_count = renewed_count + 1
   where id = target;

  perform public.move_pixels(me, -kubes, 'ad_budget', 'Campaign renewed: ' || row_c.name);
  return until;
end;
$function$;

-- set_campaign_days: 1 said Kubes
create or replace function public.set_campaign_days(target uuid, days integer)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  row_c public.ad_campaigns%rowtype;
  want integer;
  have integer;
  owed integer;
  balance integer;
  until timestamptz;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if days < 1 or days > 30 then raise exception 'Between 1 and 30 days.'; end if;

  select * into row_c from public.ad_campaigns where id = target for update;
  if row_c.id is null then raise exception 'No such campaign.'; end if;
  if row_c.buyer_id <> me then raise exception 'That is not your campaign.'; end if;

  want := public.ad_kubes_for(days);
  have := greatest(0, row_c.budget - row_c.refunded);
  owed := greatest(0, want - have);

  if owed > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < owed then
      raise exception 'That much longer costs % more Brix and you have %.', owed, balance;
    end if;

    perform public.move_pixels(me, -owed, 'ad_budget', 'Longer campaign: ' || row_c.name);
  end if;

  until := now() + (days || ' days')::interval;

  update public.ad_campaigns
     set budget = budget + owed,
         ends_at = until,
         is_running = (spent < budget + owed - refunded)
   where id = target;

  return until;
end;
$function$;

commit;
