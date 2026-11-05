-- An ad now runs for a length of time as well as a number of views.
--
-- The more Kubes behind a campaign, the longer it stays up, to a limit of two
-- weeks. It comes down when its time is up or when its budget is spent,
-- whichever happens first, and a finished campaign can be renewed rather than
-- built again from nothing.
--
-- Ad slots also stop being a thing only Spaces have. Kobbleston keeps a few
-- of its own, on the home page, in Discover, on profiles and community pages.
-- A slot with no Space behind it pays nobody a share, because there is nobody
-- whose page it is. Safe to run again.

alter table public.ads add column if not exists ends_at timestamptz;
alter table public.ads add column if not exists renewed_count integer not null default 0;

-- Campaigns bought before there was such a thing as an ending get two weeks
-- from when they were bought.
update public.ads set ends_at = created_at + interval '14 days' where ends_at is null;

create index if not exists ads_running_idx on public.ads (size, ends_at) where is_running;

/** The most Kubes a campaign can carry, which is also its longest run. */
create or replace function public.ad_max_kubes() returns integer
language sql immutable as $$ select 2000 $$;

/** How long that many Kubes keeps an ad up: two weeks at the top, a day at least. */
create or replace function public.ad_days(kubes integer) returns integer
language sql immutable as $$
  select greatest(1, least(14, round(14.0 * kubes / public.ad_max_kubes())::integer));
$$;

grant execute on function public.ad_max_kubes, public.ad_days to anon, authenticated;

create or replace function public.buy_ad(
  ad_name text,
  ad_size public.ad_size,
  picture uuid,
  kubes integer,
  kind public.ad_target default 'space',
  target uuid default null,
  outward text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  balance integer;
  made uuid;
  path text;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if public.is_guest() then raise exception 'Guests cannot buy ads.'; end if;
  if kubes < 10 then raise exception 'An ad needs at least 10 Kubes behind it.'; end if;
  if kubes > public.ad_max_kubes() then
    raise exception 'An ad carries at most % Kubes, which is two weeks.', public.ad_max_kubes();
  end if;

  if kind = 'link' then
    if not public.is_kobbleston(me) then
      raise exception 'An ad can point at a Space, a community, an event or something in the Marketplace.';
    end if;
    if outward !~ '^https://[a-zA-Z0-9._~:/?#@!$&''()*+,;=%-]{3,200}$' then
      raise exception 'That is not a web address.';
    end if;
    path := outward;
  else
    if target is null then raise exception 'Say what the ad is for.'; end if;
    if not public.can_advertise(kind, target, me) then
      raise exception 'You do not have permission to advertise that.';
    end if;
    path := public.ad_target_path(kind, target);
    if path is null then raise exception 'That cannot be advertised yet: it has no number.'; end if;
  end if;

  if not exists (
    select 1 from public.assets a
     where a.id = picture and a.kind = 'image' and a.status = 'approved'
  ) then
    raise exception 'Pick an approved image from Create for the ad.';
  end if;

  if not public.can_use_asset(picture) then
    raise exception 'You can only advertise with content you own.';
  end if;

  select pixels into balance from public.profiles where id = me;
  if balance < kubes then raise exception 'You do not have that many Kubes.'; end if;

  insert into public.ads (buyer_id, name, size, asset_id, target_path, budget,
                          target_kind, target_id, ends_at)
  values (me, trim(ad_name), ad_size, picture, path, kubes, kind, target,
          now() + (public.ad_days(kubes) || ' days')::interval)
  returning id into made;

  perform public.move_pixels(me, -kubes, 'ad_budget', 'Ad: ' || trim(ad_name));
  return made;
end;
$$;

/**
 * Putting a finished campaign back up. Whatever was left of the old budget
 * stays where it is; the new Kubes are added to it, and the clock starts
 * again from what was just paid.
 */
create or replace function public.renew_ad(target uuid, kubes integer)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  row_ad public.ads%rowtype;
  balance integer;
  until timestamptz;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if kubes < 10 then raise exception 'A renewal needs at least 10 Kubes behind it.'; end if;
  if kubes > public.ad_max_kubes() then
    raise exception 'An ad carries at most % Kubes, which is two weeks.', public.ad_max_kubes();
  end if;

  select * into row_ad from public.ads where id = target for update;
  if row_ad.id is null then raise exception 'No such ad.'; end if;
  if row_ad.buyer_id <> me then raise exception 'That is not your ad.'; end if;

  -- The thing it points at still has to be the buyer's to advertise: a
  -- community you were thrown out of is not yours to keep advertising.
  if row_ad.target_kind <> 'link' and row_ad.target_id is not null
     and not public.can_advertise(row_ad.target_kind, row_ad.target_id, me) then
    raise exception 'You no longer have permission to advertise that.';
  end if;
  if row_ad.target_kind = 'link' and not public.is_kobbleston(me) then
    raise exception 'That ad points off Kobbleston and cannot be renewed.';
  end if;

  select pixels into balance from public.profiles where id = me;
  if balance < kubes then raise exception 'You do not have that many Kubes.'; end if;

  until := now() + (public.ad_days(kubes) || ' days')::interval;

  update public.ads
     set budget = budget + kubes,
         ends_at = until,
         is_running = true,
         renewed_count = renewed_count + 1
   where id = target;

  perform public.move_pixels(me, -kubes, 'ad_budget', 'Ad renewed: ' || row_ad.name);
  return until;
end;
$$;

/**
 * An ad to show in a slot of this size, and the counting that goes with it.
 *
 * `space` is the Space the slot sits in, and is null for one of Kobbleston's
 * own slots: the ad is still shown and still paid for, but there is nobody
 * whose page it is, so nobody takes a share. A Space never shows its owner's
 * own ads, so nobody can pay themselves by leaving a tab open.
 */
create or replace function public.pick_ad(slot public.ad_size, space uuid default null)
returns table (id uuid, name text, file_path text, target_path text)
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
  chosen public.ads%rowtype;
  fresh boolean := true;
  share integer;
begin
  -- Anything past its day comes down, whoever happens to ask first.
  update public.ads set is_running = false
   where is_running and ends_at is not null and ends_at <= now();

  if space is not null then
    select s.owner_id into owner from public.spaces s where s.id = space;
  end if;

  select a.* into chosen
    from public.ads a
   where a.is_running
     and a.size = slot
     and a.spent < a.budget
     and (a.ends_at is null or a.ends_at > now())
     and (owner is null or a.buyer_id <> owner)
   order by random()
   limit 1;

  if chosen.id is null then return; end if;

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

      update public.ads
         set spent = least(spent + public.ad_view_cost(), budget),
             views = views + 1,
             is_running = (spent + public.ad_view_cost() < budget)
       where ads.id = chosen.id;

      if space is not null and owner is not null then
        share := public.ad_view_cost() * public.ad_owner_share();

        insert into public.ad_earnings (space_id, hundredths)
        values (space, share)
        on conflict (space_id) do update set hundredths = ad_earnings.hundredths + share;

        -- Paid out in whole Kubes as soon as the hundredths add up to one.
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
    select chosen.id, chosen.name, a.file_path, chosen.target_path
      from public.assets a where a.id = chosen.asset_id;
end;
$$;

/** The campaigns somebody is running, with how they are doing. */
drop function if exists public.my_ads();
create function public.my_ads()
returns table (
  id uuid, name text, size public.ad_size, target_path text,
  budget integer, spent integer, views integer, clicks integer,
  is_running boolean, created_at timestamptz, file_path text,
  target_kind public.ad_target, ends_at timestamptz, renewed_count integer
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.size, a.target_path, a.budget, a.spent, a.views, a.clicks,
         (a.is_running and (a.ends_at is null or a.ends_at > now())) as is_running,
         a.created_at, s.file_path, a.target_kind, a.ends_at, a.renewed_count
    from public.ads a
    join public.assets s on s.id = a.asset_id
   where a.buyer_id = auth.uid()
   order by a.created_at desc;
$$;

grant execute on function public.buy_ad, public.my_ads, public.renew_ad to authenticated;
grant execute on function public.pick_ad to anon, authenticated;
