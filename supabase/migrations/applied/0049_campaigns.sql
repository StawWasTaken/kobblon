-- Ads belong to a campaign now.
--
-- Before this, every ad was its own little business: its own name, its own
-- budget, its own fortnight, stopped and renewed on its own. Anybody running
-- more than one had to keep the same idea alive in several places at once.
--
-- So the money and the clock move up a level. A campaign has the name, the
-- budget and the time; the ads inside it are the creative work, each with its
-- decal, its shape and what it points at, and any of them can be changed,
-- paused or thrown away without touching what was paid. Views and presses are
-- counted per ad, so it is possible to see which one is doing the work, and
-- spending comes off the campaign.
--
-- Everything already bought becomes a campaign of one, keeping its name, its
-- budget, what it had spent and when it ends. Safe to run again.

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  budget integer not null check (budget between 10 and 100000),
  spent integer not null default 0,
  is_running boolean not null default true,
  ends_at timestamptz,
  renewed_count integer not null default 0,
  -- What has already been handed back, so stopping and then removing cannot
  -- pay the same Kubes out twice.
  refunded integer not null default 0,
  created_at timestamptz not null default now(),
  check (spent <= budget)
);

alter table public.ad_campaigns add column if not exists refunded integer not null default 0;

create index if not exists ad_campaigns_mine_idx on public.ad_campaigns (buyer_id, created_at desc);

alter table public.ads add column if not exists campaign_id uuid references public.ad_campaigns on delete cascade;
alter table public.ads add column if not exists is_active boolean not null default true;

-- Everything bought before campaigns existed becomes one of its own.
do $$
declare row_ad public.ads%rowtype; made uuid;
begin
  for row_ad in select * from public.ads where campaign_id is null loop
    insert into public.ad_campaigns (buyer_id, name, budget, spent, is_running, ends_at,
                                     renewed_count, created_at)
    values (row_ad.buyer_id, row_ad.name, row_ad.budget, row_ad.spent, row_ad.is_running,
            row_ad.ends_at, row_ad.renewed_count, row_ad.created_at)
    returning id into made;

    update public.ads set campaign_id = made where id = row_ad.id;
  end loop;
end $$;

alter table public.ads alter column campaign_id set not null;

-- The money and the clock live on the campaign; an ad keeps only what it is.
alter table public.ads drop column if exists budget;
alter table public.ads drop column if exists spent;
alter table public.ads drop column if exists ends_at;
alter table public.ads drop column if exists renewed_count;
alter table public.ads drop column if exists is_running;
alter table public.ads drop column if exists name;

drop index if exists public.ads_live_idx;
drop index if exists public.ads_running_idx;
create index if not exists ads_of_campaign_idx on public.ads (campaign_id);
create index if not exists ads_showable_idx on public.ads (size) where is_active;

alter table public.ad_campaigns enable row level security;

drop policy if exists ad_campaigns_read on public.ad_campaigns;
create policy ad_campaigns_read on public.ad_campaigns for select
  using (buyer_id = auth.uid() or public.is_moderator());

revoke insert, update, delete on public.ad_campaigns from anon, authenticated;
grant select on public.ad_campaigns to authenticated;

-- ------------------------------------------------------------ campaigns

/**
 * Starting a campaign. The whole budget leaves the account now, so it can
 * only ever spend what has already been paid, and how long it runs comes
 * from how much is behind it.
 */
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
    raise exception 'A campaign carries at most % Kubes, which is two weeks.', public.ad_max_kubes();
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

/** Changing what a campaign is called. The money and the clock are not this. */
create or replace function public.rename_campaign(target uuid, campaign_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(campaign_name)) < 3 or char_length(trim(campaign_name)) > 60 then
    raise exception 'A name is between 3 and 60 letters.';
  end if;
  if not exists (select 1 from public.ad_campaigns c
                  where c.id = target and c.buyer_id = auth.uid()) then
    raise exception 'That is not your campaign.';
  end if;

  update public.ad_campaigns set name = trim(campaign_name) where id = target;
end;
$$;

/** Stopping a campaign hands back whatever it did not spend. */
create or replace function public.end_campaign(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  row_c public.ad_campaigns%rowtype;
  left_over integer;
begin
  select * into row_c from public.ad_campaigns where id = target for update;
  if row_c.id is null then raise exception 'No such campaign.'; end if;
  if row_c.buyer_id <> auth.uid() and not public.is_moderator() then
    raise exception 'That is not your campaign.';
  end if;
  if not row_c.is_running then return 0; end if;

  left_over := greatest(0, row_c.budget - row_c.spent - row_c.refunded);
  update public.ad_campaigns
     set is_running = false, refunded = refunded + left_over
   where id = target;

  if left_over > 0 then
    perform public.move_pixels(row_c.buyer_id, left_over, 'ad_refund',
                               'Campaign stopped: ' || row_c.name);
  end if;

  return left_over;
end;
$$;

/**
 * Putting a finished campaign back up. What was left of the old budget stays
 * where it is, the new Kubes are added to it, and the clock starts again.
 */
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
    raise exception 'A campaign carries at most % Kubes, which is two weeks.', public.ad_max_kubes();
  end if;

  select * into row_c from public.ad_campaigns where id = target for update;
  if row_c.id is null then raise exception 'No such campaign.'; end if;
  if row_c.buyer_id <> me then raise exception 'That is not your campaign.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < kubes then raise exception 'You do not have that many Kubes.'; end if;

  until := now() + (public.ad_days(kubes) || ' days')::interval;

  -- A renewal after a stop starts from what is actually there: whatever was
  -- handed back is no longer part of the budget.
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

/** Taking a finished campaign off the list, ads and all. */
create or replace function public.remove_campaign(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  row_c public.ad_campaigns%rowtype;
  left_over integer := 0;
begin
  select * into row_c from public.ad_campaigns where id = target for update;
  if row_c.id is null then raise exception 'That campaign is not here.'; end if;
  if row_c.buyer_id <> auth.uid() and not public.is_moderator() then
    raise exception 'That is not your campaign.';
  end if;

  if row_c.is_running and (row_c.ends_at is null or row_c.ends_at > now())
     and row_c.spent < row_c.budget then
    raise exception 'That campaign is still running. Stop it first.';
  end if;

  left_over := greatest(0, row_c.budget - row_c.spent - row_c.refunded);
  if left_over > 0 then
    perform public.move_pixels(row_c.buyer_id, left_over, 'ad_refund',
                               'Campaign removed: ' || row_c.name);
  end if;

  delete from public.ad_campaigns where id = target;
  return left_over;
end;
$$;

-- ------------------------------------------------------------------ ads

/**
 * What an ad may point at and where that lands, checked in one place because
 * adding one and editing one ask exactly the same question.
 */
create or replace function public.ad_destination(
  kind public.ad_target, target uuid, outward text
)
returns text language plpgsql stable security definer set search_path = public as $$
declare path text;
begin
  if kind = 'link' then
    if not public.is_kobbleston(auth.uid()) then
      raise exception 'An ad can point at a Space, a community, an event or something in the Marketplace.';
    end if;
    if outward !~ '^https://[a-zA-Z0-9._~:/?#@!$&''()*+,;=%-]{3,200}$' then
      raise exception 'That is not a web address.';
    end if;
    return outward;
  end if;

  if target is null then raise exception 'Say what the ad is for.'; end if;
  if not public.can_advertise(kind, target) then
    raise exception 'You do not have permission to advertise that.';
  end if;

  path := public.ad_target_path(kind, target);
  if path is null then raise exception 'That cannot be advertised yet: it has no number.'; end if;
  return path;
end;
$$;

/** A decal has to be yours, approved, and a decal. */
create or replace function public.check_ad_decal(picture uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.assets a
     where a.id = picture and a.kind = 'image' and a.status = 'approved'
  ) then
    raise exception 'Pick an approved decal from Create for the ad.';
  end if;

  if not public.can_use_asset(picture) then
    raise exception 'You can only advertise with content you own.';
  end if;
end;
$$;

/** Putting an ad into a campaign. It costs nothing: the campaign is paid for. */
create or replace function public.add_ad(
  campaign uuid,
  ad_size public.ad_size,
  picture uuid,
  kind public.ad_target default 'space',
  target uuid default null,
  outward text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
  path text;
  made uuid;
begin
  if me is null then raise exception 'Not signed in.'; end if;

  select buyer_id into owner from public.ad_campaigns where id = campaign;
  if owner is null then raise exception 'No such campaign.'; end if;
  if owner <> me then raise exception 'That is not your campaign.'; end if;

  perform public.check_ad_decal(picture);
  path := public.ad_destination(kind, target, outward);

  insert into public.ads (campaign_id, buyer_id, size, asset_id, target_path,
                          target_kind, target_id)
  values (campaign, me, ad_size, picture, path, kind, target)
  returning id into made;

  return made;
end;
$$;

/**
 * Changing an ad: a different decal, a different shape, somewhere else to
 * send people. What it has been shown and pressed stays with it.
 */
create or replace function public.edit_ad(
  target_ad uuid,
  ad_size public.ad_size,
  picture uuid,
  kind public.ad_target default 'space',
  target uuid default null,
  outward text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  row_ad public.ads%rowtype;
  path text;
begin
  if me is null then raise exception 'Not signed in.'; end if;

  select * into row_ad from public.ads where id = target_ad;
  if row_ad.id is null then raise exception 'That ad is not here.'; end if;
  if row_ad.buyer_id <> me then raise exception 'That is not your ad.'; end if;

  perform public.check_ad_decal(picture);
  path := public.ad_destination(kind, target, outward);

  update public.ads
     set size = ad_size, asset_id = picture, target_path = path,
         target_kind = kind, target_id = target
   where id = target_ad;
end;
$$;

/** Taking one ad out of a campaign. The money is the campaign's, so none moves. */
create or replace function public.remove_ad(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ads a
                  where a.id = target and (a.buyer_id = auth.uid() or public.is_moderator())) then
    raise exception 'That is not your ad.';
  end if;

  delete from public.ads where id = target;
  return 0;
end;
$$;

/** Resting one ad without touching the rest of the campaign. */
create or replace function public.pause_ad(target uuid, resting boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.ads a where a.id = target and a.buyer_id = auth.uid()) then
    raise exception 'That is not your ad.';
  end if;

  update public.ads set is_active = not resting where id = target;
end;
$$;

create or replace function public.record_ad_click(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ads set clicks = clicks + 1 where id = target and is_active;
end;
$$;

-- --------------------------------------------------------------- showing

/**
 * An ad to show in a slot of this size, and the counting that goes with it.
 * The ad is picked, the campaign behind it pays.
 */
create or replace function public.pick_ad(slot public.ad_size, space uuid default null)
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
  -- Anything past its day comes down, whoever happens to ask first.
  update public.ad_campaigns set is_running = false
   where is_running and ends_at is not null and ends_at <= now();

  if space is not null then
    select s.owner_id into owner from public.spaces s where s.id = space;
  end if;

  select a.* into chosen
    from public.ads a
    join public.ad_campaigns c on c.id = a.campaign_id
   where a.is_active
     and a.size = slot
     and c.is_running
     and c.spent < c.budget - c.refunded
     and (c.ends_at is null or c.ends_at > now())
     and (owner is null or c.buyer_id <> owner)
   order by random()
   limit 1;

  if chosen.id is null then return; end if;

  select * into campaign from public.ad_campaigns where ad_campaigns.id = chosen.campaign_id;

  if me is not null then
    -- One counted view per person per ad per hour.
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

-- ---------------------------------------------------------------- mine

/** The campaigns somebody is running, with how they are doing. */
drop function if exists public.my_campaigns();
create function public.my_campaigns()
returns table (
  id uuid, name text, budget integer, spent integer, is_running boolean,
  ends_at timestamptz, renewed_count integer, refunded integer, created_at timestamptz,
  ad_count integer, views integer, clicks integer
)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.budget, c.spent,
         (c.is_running and (c.ends_at is null or c.ends_at > now())) as is_running,
         c.ends_at, c.renewed_count, c.refunded, c.created_at,
         coalesce(count(a.id), 0)::integer,
         coalesce(sum(a.views), 0)::integer,
         coalesce(sum(a.clicks), 0)::integer
    from public.ad_campaigns c
    left join public.ads a on a.campaign_id = c.id
   where c.buyer_id = auth.uid()
   group by c.id
   order by c.created_at desc;
$$;

/** The ads inside one campaign. */
drop function if exists public.my_ads();
drop function if exists public.campaign_ads(uuid);
create function public.campaign_ads(campaign uuid)
returns table (
  id uuid, size public.ad_size, asset_id uuid, file_path text,
  target_kind public.ad_target, target_id uuid, target_path text,
  views integer, clicks integer, is_active boolean, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.size, a.asset_id, s.file_path, a.target_kind, a.target_id, a.target_path,
         a.views, a.clicks, a.is_active, a.created_at
    from public.ads a
    join public.assets s on s.id = a.asset_id
   where a.campaign_id = campaign
     and (a.buyer_id = auth.uid() or public.is_moderator())
   order by a.created_at;
$$;

-- The old one ad at a time doors are gone.
drop function if exists public.buy_ad(text, public.ad_size, uuid, integer, public.ad_target, uuid, text);
drop function if exists public.end_ad(uuid);
drop function if exists public.renew_ad(uuid, integer);

grant execute on function public.create_campaign, public.rename_campaign, public.end_campaign,
  public.renew_campaign, public.remove_campaign, public.add_ad, public.edit_ad,
  public.remove_ad, public.pause_ad, public.record_ad_click,
  public.my_campaigns, public.campaign_ads to authenticated;
grant execute on function public.pick_ad to anon, authenticated;
