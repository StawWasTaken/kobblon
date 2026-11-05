-- Two small things and one rule.
--
-- Guests are people. They are on the site, they are in People, they turn up
-- in searches, and the number on the front page should say so rather than
-- quietly leaving them out.
--
-- And a campaign's length can be changed after it is bought. Lengthening is
-- paid for; shortening hands nothing back. That is deliberate: if changing
-- the clock could return Kubes, somebody would buy a month, run it for an
-- hour and shorten it to get the rest back, which is a refund with extra
-- steps. Stopping a campaign already returns what it never spent on views,
-- and that is the one way money comes back.
--
-- Safe to run again.

create or replace function public.platform_stats()
returns table (
  total_visits bigint,
  published_spaces bigint,
  total_updates bigint,
  total_accounts bigint,
  people_online bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(visit_count) from public.spaces where is_published and not is_removed), 0),
    (select count(*) from public.spaces where is_published and not is_removed),
    (select count(*) from public.space_updates),
    -- Guests included: somebody looking round as a guest is still somebody.
    (select count(*) from public.profiles where not is_suspended),
    (select count(*) from public.profiles
      where is_online and last_seen_at > now() - public.presence_window());
$$;

grant execute on function public.platform_stats to anon, authenticated;

/** What a run of that many days costs, which is the same sum as ad_days backwards. */
create or replace function public.ad_kubes_for(days integer) returns integer
language sql immutable as $$
  select greatest(10, least(public.ad_max_kubes(),
    ceil(public.ad_max_kubes() * greatest(1, least(30, days)) / 30.0)::integer));
$$;

grant execute on function public.ad_kubes_for to anon, authenticated;

/**
 * Changing how long a campaign runs, counted from now.
 *
 * Longer costs the difference, up front, like buying it did. Shorter costs
 * nothing and returns nothing: the Kubes already behind it stay behind it as
 * views, so nothing is lost, but nobody gets Kubes back by moving the clock.
 */
create or replace function public.set_campaign_days(target uuid, days integer)
returns timestamptz language plpgsql security definer set search_path = public as $$
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
      raise exception 'That much longer costs % more Kubes and you have %.', owed, balance;
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
$$;

grant execute on function public.set_campaign_days to authenticated;
