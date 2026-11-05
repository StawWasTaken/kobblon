-- Two things a Space can hold that involve other people's money: an ad slot,
-- and a donate button.
--
-- An ad is bought up front. The Kubes leave the buyer's account the moment
-- the campaign is made, so a campaign can never spend what is not there, and
-- whatever is left comes back when it is stopped. Every view costs one Kube,
-- and the Space that showed it keeps fifteen per cent, kept in hundredths
-- until it is worth a whole Kube.
--
-- A donation is one person giving Kubes to the owner of a Space, on purpose,
-- from a button the owner put there. Safe to run again.

alter table public.pixel_transactions drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions add constraint pixel_transactions_kind_check
  check (kind in ('signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
                  'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning'));

do $$ begin
  create type public.ad_size as enum ('banner', 'box', 'tall');
exception when duplicate_object then null;
end $$;

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  size public.ad_size not null,
  -- The picture is Create content, referenced by its number like everything
  -- else, so an ad cannot show something that was never reviewed.
  asset_id uuid not null references public.assets on delete restrict,
  target_path text not null check (target_path ~ '^/[a-zA-Z0-9/_-]{0,120}$'),
  budget integer not null check (budget between 10 and 100000),
  spent integer not null default 0,
  views integer not null default 0,
  clicks integer not null default 0,
  is_running boolean not null default true,
  created_at timestamptz not null default now(),
  check (spent <= budget)
);

create index if not exists ads_live_idx on public.ads (size) where is_running;

-- One view counted per person per ad per hour, so a page left open overnight
-- does not empty somebody's budget.
create table if not exists public.ad_views (
  ad_id uuid not null references public.ads on delete cascade,
  viewer_id uuid not null references public.profiles on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (ad_id, viewer_id)
);

-- What a Space has earned but not yet been paid, in hundredths of a Kube.
create table if not exists public.ad_earnings (
  space_id uuid primary key references public.spaces on delete cascade,
  hundredths integer not null default 0,
  paid integer not null default 0
);

alter table public.ads enable row level security;
alter table public.ad_views enable row level security;
alter table public.ad_earnings enable row level security;

drop policy if exists ads_read_own on public.ads;
create policy ads_read_own on public.ads for select
  using (buyer_id = auth.uid() or public.is_moderator());

drop policy if exists ad_earnings_read on public.ad_earnings;
create policy ad_earnings_read on public.ad_earnings for select
  using (public.owns_space(space_id) or public.is_moderator());

revoke insert, update, delete on public.ads, public.ad_views, public.ad_earnings
  from anon, authenticated;

-- Reading is decided by the policies above rather than by whatever default
-- privileges happen to be in place.
grant select on public.ads, public.ad_earnings to authenticated;

/** What a view costs, and what the Space showing it keeps. */
create or replace function public.ad_view_cost() returns integer
language sql immutable as $$ select 1 $$;

create or replace function public.ad_owner_share() returns integer
language sql immutable as $$ select 15 $$;

/**
 * Buying an ad. The whole budget leaves the account now, so the campaign can
 * only ever spend money that has already been paid.
 */
create or replace function public.buy_ad(
  ad_name text, ad_size public.ad_size, picture uuid, target text, kubes integer
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  balance integer;
  made uuid;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if public.is_guest() then raise exception 'Guests cannot buy ads.'; end if;
  if kubes < 10 then raise exception 'An ad needs at least 10 Kubes behind it.'; end if;

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

  insert into public.ads (buyer_id, name, size, asset_id, target_path, budget)
  values (me, trim(ad_name), ad_size, picture, target, kubes)
  returning id into made;

  perform public.move_pixels(me, -kubes, 'ad_budget', 'Ad: ' || trim(ad_name));
  return made;
end;
$$;

/** Stopping a campaign hands back whatever it did not spend. */
create or replace function public.end_ad(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  row_ad public.ads%rowtype;
  left_over integer;
begin
  select * into row_ad from public.ads where id = target for update;
  if row_ad.id is null then raise exception 'No such ad.'; end if;
  if row_ad.buyer_id <> auth.uid() and not public.is_moderator() then
    raise exception 'That is not your ad.';
  end if;
  if not row_ad.is_running then return 0; end if;

  left_over := row_ad.budget - row_ad.spent;
  update public.ads set is_running = false where id = target;

  if left_over > 0 then
    perform public.move_pixels(row_ad.buyer_id, left_over, 'ad_refund', 'Ad stopped: ' || row_ad.name);
  end if;

  return left_over;
end;
$$;

/**
 * An ad to show in a slot of this size, and the counting that goes with it.
 * Whoever is looking pays nothing; the campaign pays a Kube, and the Space
 * showing it keeps its share. A Space never shows its owner's own ads, so
 * nobody can pay themselves by leaving a tab open.
 */
create or replace function public.pick_ad(slot public.ad_size, space uuid)
returns table (id uuid, name text, file_path text, target_path text)
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
  chosen public.ads%rowtype;
  fresh boolean := true;
  share integer;
begin
  select s.owner_id into owner from public.spaces s where s.id = space;

  select a.* into chosen
    from public.ads a
   where a.is_running
     and a.size = slot
     and a.spent < a.budget
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

      if share is not null and share > 0 and owner is not null then
        perform public.move_pixels(owner, share, 'ad_earning', 'Ads shown in a Space');
      end if;
    end if;
  end if;

  return query
    select chosen.id, chosen.name, a.file_path, chosen.target_path
      from public.assets a where a.id = chosen.asset_id;
end;
$$;

create or replace function public.record_ad_click(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ads set clicks = clicks + 1 where id = target and is_running;
end;
$$;

/** The campaigns somebody is running, with how they are doing. */
create or replace function public.my_ads()
returns table (
  id uuid, name text, size public.ad_size, target_path text,
  budget integer, spent integer, views integer, clicks integer,
  is_running boolean, created_at timestamptz, file_path text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.size, a.target_path, a.budget, a.spent, a.views, a.clicks,
         a.is_running, a.created_at, s.file_path
    from public.ads a
    join public.assets s on s.id = a.asset_id
   where a.buyer_id = auth.uid()
   order by a.created_at desc;
$$;

/**
 * Giving Kubes to whoever made a Space. It is a gift: nothing is promised in
 * return, and it cannot be taken back.
 */
create or replace function public.donate_to_space(space uuid, amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
  space_name text;
  balance integer;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  if public.is_guest() then raise exception 'Guests cannot give Kubes. Make an account and you can.'; end if;
  if amount < 1 or amount > 10000 then raise exception 'Between 1 and 10000 Kubes.'; end if;

  select s.owner_id, s.name into owner, space_name
    from public.spaces s
   where s.id = space and s.is_published and not s.is_removed;

  if owner is null then raise exception 'No such Space.'; end if;
  if owner = me then raise exception 'You cannot tip yourself.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < amount then raise exception 'You do not have that many Kubes.'; end if;

  perform public.move_pixels(me, -amount, 'donation', 'Gave to ' || space_name);
  perform public.move_pixels(owner, amount, 'donation', 'A gift from a visitor to ' || space_name);

  return balance - amount;
end;
$$;

grant execute on function public.buy_ad, public.end_ad, public.my_ads,
  public.donate_to_space, public.record_ad_click to authenticated;
grant execute on function public.pick_ad to anon, authenticated;
grant execute on function public.ad_view_cost, public.ad_owner_share to anon, authenticated;
