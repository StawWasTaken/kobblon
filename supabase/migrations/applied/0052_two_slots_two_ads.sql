-- A page with more than one ad slot on it should not show the same ad twice.
--
-- Picking is random, so two slots on one page could easily land on the same
-- campaign, which reads as one ad repeated rather than as advertising. A
-- slot can now say which ads are already up, and those are passed over while
-- there is anything else to show. When there is nothing else, the same ad is
-- better than an empty box, so it is still allowed.
--
-- Safe to run again.

-- The two argument shape is replaced by the three argument one.
drop function if exists public.pick_ad(public.ad_size, uuid);

create or replace function public.pick_ad(
  slot public.ad_size,
  space uuid default null,
  avoid uuid[] default '{}'
)
returns table (id uuid, name text, file_path text, target_path text)
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
  chosen public.ads%rowtype;
  campaign public.ad_campaigns%rowtype;
  fresh boolean := true;
  share integer;
begin
  update public.ad_campaigns set is_running = false
   where is_running and ends_at is not null and ends_at <= now();

  if space is not null then
    select s.owner_id into owner from public.spaces s where s.id = space;
  end if;

  -- Anything already on the page goes to the back of the queue rather than
  -- out of it, so a single campaign still fills every slot it can.
  select a.* into chosen
    from public.ads a
    join public.ad_campaigns c on c.id = a.campaign_id
   where a.is_active
     and a.size = slot
     and c.is_running
     and c.spent < c.budget - c.refunded
     and (c.ends_at is null or c.ends_at > now())
     and (owner is null or c.buyer_id <> owner)
   order by (a.id = any (coalesce(avoid, '{}'))), random()
   limit 1;

  if chosen.id is null then return; end if;

  select * into campaign from public.ad_campaigns where ad_campaigns.id = chosen.campaign_id;

  if me is not null then
    select false into fresh
      from public.ad_views v
     where v.ad_id = chosen.id and v.viewer_id = me
       and v.seen_at > now() - interval '1 hour';

    fresh := coalesce(fresh, true);

    if fresh then
      insert into public.ad_views (ad_id, viewer_id, seen_at)
      values (chosen.id, me, now())
      on conflict (ad_id, viewer_id) do update set seen_at = now();

      update public.ads set views = views + 1 where ads.id = chosen.id;

      update public.ad_campaigns
         set spent = least(spent + public.ad_view_cost(), budget),
             is_running = (spent + public.ad_view_cost() < budget)
       where ad_campaigns.id = campaign.id;

      if space is not null and owner is not null then
        share := public.ad_view_cost() * public.ad_owner_share();

        insert into public.ad_earnings (space_id, hundredths)
        values (space, share)
        on conflict (space_id) do update set hundredths = ad_earnings.hundredths + share;

        update public.ad_earnings e
           set hundredths = e.hundredths % 100,
               paid = e.paid + (e.hundredths / 100)
         where e.space_id = space and e.hundredths >= 100
        returning (e.hundredths / 100) into share;

        if share is not null and share > 0 then
          perform public.move_pixels(owner, share, 'ad_earning', 'Ads shown in a Space');
        end if;
      end if;
    end if;
  end if;

  return query
    select chosen.id, campaign.name, a.file_path, chosen.target_path
      from public.assets a where a.id = chosen.asset_id;
end;
$$;

grant execute on function public.pick_ad(public.ad_size, uuid, uuid[]) to anon, authenticated;
