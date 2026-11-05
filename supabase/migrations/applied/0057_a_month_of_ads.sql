-- A campaign can run for a month.
--
-- A fortnight was the longest anything could stay up, which is short for
-- something somebody is paying for in advance. The same money now buys twice
-- the time: the top of the scale, two thousand Kubes, is thirty days rather
-- than fourteen, and everything below scales the same way.
--
-- Nothing already running changes: a campaign keeps the ending it was sold.
-- Safe to run again.

create or replace function public.ad_days(kubes integer) returns integer
language sql immutable as $$
  select greatest(1, least(30, round(30.0 * kubes / public.ad_max_kubes())::integer));
$$;

grant execute on function public.ad_days to anon, authenticated;

-- The two places that said "two weeks" in a refusal now say a month.
create or replace function public.create_campaign(campaign_name text, kubes integer)
returns uuid language plpgsql security definer set search_path = public as $$
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
  if kubes < 10 then raise exception 'A campaign needs at least 10 Kubes behind it.'; end if;
  if kubes > public.ad_max_kubes() then
    raise exception 'A campaign carries at most % Kubes, which is a month.', public.ad_max_kubes();
  end if;

  select pixels into balance from public.profiles where id = me;
  if balance < kubes then raise exception 'You do not have that many Kubes.'; end if;

  insert into public.ad_campaigns (buyer_id, name, budget, ends_at)
  values (me, trim(campaign_name), kubes, now() + (public.ad_days(kubes) || ' days')::interval)
  returning id into made;

  perform public.move_pixels(me, -kubes, 'ad_budget', 'Campaign: ' || trim(campaign_name));
  return made;
end;
$$;

create or replace function public.renew_campaign(target uuid, kubes integer)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  row_c public.ad_campaigns%rowtype;
  balance integer;
  until timestamptz;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if kubes < 10 then raise exception 'A renewal needs at least 10 Kubes behind it.'; end if;
  if kubes > public.ad_max_kubes() then
    raise exception 'A campaign carries at most % Kubes, which is a month.', public.ad_max_kubes();
  end if;

  select * into row_c from public.ad_campaigns where id = target for update;
  if row_c.id is null then raise exception 'No such campaign.'; end if;
  if row_c.buyer_id <> me then raise exception 'That is not your campaign.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < kubes then raise exception 'You do not have that many Kubes.'; end if;

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
$$;

grant execute on function public.create_campaign, public.renew_campaign to authenticated;
