-- What an ad is allowed to point at.
--
-- An ad sends people somewhere, and until now it could send them anywhere
-- inside Kobbleston, including at somebody else's work. So an ad now names
-- the thing it advertises rather than an address: a Space, a community, an
-- event, or something in the Marketplace. The address is worked out from
-- that thing on this side, so it always leads where it says it does, and it
-- cannot be bought unless the buyer is allowed to advertise it.
--
-- Allowed means: you made it, or you have been given the run of it. Your own
-- Space, a community whose settings you can change, an event in such a
-- community or one you put on yourself, and content that is yours or that its
-- creator has shared with you.
--
-- The one account that may advertise an ordinary web address is Kobbleston's
-- own, because somebody has to be able to point at something off the site.
-- Safe to run again.

do $$ begin
  create type public.ad_target as enum ('space', 'community', 'event', 'asset', 'link');
exception when duplicate_object then null;
end $$;

alter table public.ads add column if not exists target_kind public.ad_target not null default 'link';
alter table public.ads add column if not exists target_id uuid;

-- Campaigns bought before any of this existed keep pointing where they point.
alter table public.ads drop constraint if exists ads_target_path_check;
alter table public.ads add constraint ads_target_path_check check (
  target_path ~ '^/[a-zA-Z0-9/_.%-]{0,200}$'
  or target_path ~ '^https://[a-zA-Z0-9._~:/?#@!$&''()*+,;=%-]{3,200}$'
);

/** Kobbleston's own account, which is the only one that may link outwards. */
create or replace function public.is_kobbleston(who uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = who and lower(p.username) = 'kobbleston'
  );
$$;

grant execute on function public.is_kobbleston to authenticated;

/**
 * Whether somebody may put the named thing in an ad.
 */
create or replace function public.can_advertise(
  kind public.ad_target, target uuid, who uuid default auth.uid()
)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if who is null then return false; end if;
  if public.is_kobbleston(who) then return true; end if;

  case kind
    when 'space' then
      return exists (
        select 1 from public.spaces s
         where s.id = target
           and (
             s.owner_id = who
             or exists (select 1 from public.space_collaborators c
                         where c.space_id = s.id and c.user_id = who)
           )
      );

    when 'community' then
      return public.community_can(target, 'can_manage_community', who);

    when 'event' then
      return exists (
        select 1 from public.community_events e
         where e.id = target
           and (e.created_by = who or public.community_can(e.community_id, 'can_manage_community', who))
      );

    when 'asset' then
      -- Yours, or shared with you by whoever made it.
      return public.can_use_asset(target, who);

    else
      -- An ordinary web address, which only Kobbleston's own account reaches.
      return false;
  end case;
end;
$$;

grant execute on function public.can_advertise to authenticated;

/**
 * Where an ad lands, worked out from the thing itself rather than typed in.
 */
create or replace function public.ad_target_path(kind public.ad_target, target uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  found text;
begin
  case kind
    when 'space' then
      select '/s/' || s.content_id || '/' || s.slug into found
        from public.spaces s where s.id = target and s.content_id is not null;

    when 'community' then
      select '/c/' || c.content_id || '/' || c.slug into found
        from public.communities c where c.id = target and c.content_id is not null;

    when 'event' then
      select '/e/' || e.content_id into found
        from public.community_events e where e.id = target and e.content_id is not null;

    when 'asset' then
      select '/create/'
             || case a.kind
                  when 'image' then 'IMG' when 'audio' then 'SND' when 'video' then 'VID'
                  when 'font' then 'FNT' else 'MDL' end
             || '-' || a.content_id
        into found
        from public.assets a where a.id = target and a.content_id is not null;

    else
      found := null;
  end case;

  return found;
end;
$$;

grant execute on function public.ad_target_path to authenticated;

/**
 * Buying an ad. The whole budget leaves the account now, so the campaign can
 * only ever spend money that has already been paid, and the thing being
 * advertised has to be the buyer's to advertise.
 *
 * `target` is what the ad is for. `outward` is only read for Kobbleston's own
 * account, which is the only one that may point at another website.
 */
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

  insert into public.ads (buyer_id, name, size, asset_id, target_path, budget, target_kind, target_id)
  values (me, trim(ad_name), ad_size, picture, path, kubes, kind, target)
  returning id into made;

  perform public.move_pixels(me, -kubes, 'ad_budget', 'Ad: ' || trim(ad_name));
  return made;
end;
$$;

-- The shape it had before, with a path typed in by hand, is gone.
drop function if exists public.buy_ad(text, public.ad_size, uuid, text, integer);

/** The campaigns somebody is running, with how they are doing. */
drop function if exists public.my_ads();
create function public.my_ads()
returns table (
  id uuid, name text, size public.ad_size, target_path text,
  budget integer, spent integer, views integer, clicks integer,
  is_running boolean, created_at timestamptz, file_path text,
  target_kind public.ad_target
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.size, a.target_path, a.budget, a.spent, a.views, a.clicks,
         a.is_running, a.created_at, s.file_path, a.target_kind
    from public.ads a
    join public.assets s on s.id = a.asset_id
   where a.buyer_id = auth.uid()
   order by a.created_at desc;
$$;

/**
 * Everything the person asking is allowed to advertise, so nobody has to
 * guess at an address or find out afterwards that they were not allowed.
 *
 * This is the list of what is theirs, which is not quite the same question as
 * whether a particular thing may be advertised: Kobbleston's own account may
 * advertise anything at all, and is not shown the whole site here.
 */
drop function if exists public.advertisable();
create function public.advertisable()
returns table (kind public.ad_target, id uuid, label text, note text, path text)
language sql stable security definer set search_path = public as $$
  select 'space'::public.ad_target, s.id, s.name,
         case when s.is_published then 'Your Space' else 'Not published yet' end,
         public.ad_target_path('space', s.id)
    from public.spaces s
   where not s.is_removed
     and (s.owner_id = auth.uid()
          or exists (select 1 from public.space_collaborators c
                      where c.space_id = s.id and c.user_id = auth.uid()))
     and s.content_id is not null

  union all
  select 'community'::public.ad_target, c.id, c.name, 'A community you run',
         public.ad_target_path('community', c.id)
    from public.communities c
   where public.community_can(c.id, 'can_manage_community')
     and c.content_id is not null

  union all
  select 'event'::public.ad_target, e.id, e.title, 'An event',
         public.ad_target_path('event', e.id)
    from public.community_events e
   where not e.is_cancelled
     and e.content_id is not null
     and (e.created_by = auth.uid()
          or public.community_can(e.community_id, 'can_manage_community'))

  union all
  select 'asset'::public.ad_target, a.id, a.name,
         case when a.creator_id = auth.uid() then 'Yours' else 'Shared with you' end,
         public.ad_target_path('asset', a.id)
    from public.assets a
   where a.status = 'approved'
     and a.content_id is not null
     and public.can_use_asset(a.id)
   order by 1, 3;
$$;

grant execute on function public.buy_ad, public.my_ads, public.advertisable to authenticated;
