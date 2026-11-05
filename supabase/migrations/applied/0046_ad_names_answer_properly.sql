-- The name of a campaign is checked before the row is written, so somebody
-- who leaves it empty is told what to do rather than shown the constraint
-- that stopped them. Safe to run again.

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
  if char_length(trim(ad_name)) < 3 or char_length(trim(ad_name)) > 60 then
    raise exception 'Give the ad a name, between 3 and 60 letters.';
  end if;
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

grant execute on function public.buy_ad to authenticated;
