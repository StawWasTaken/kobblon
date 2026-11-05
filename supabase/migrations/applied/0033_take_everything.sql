-- Kobbleston's own uploads were landing in everybody's inventory the moment
-- they were published. They should be taken like anything else: open the
-- item, press Get, and it is yours. Being verified means it is free and
-- trustworthy, not that it is already on your shelf.

create or replace function public.can_use_asset(target uuid, who uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.assets a
     where a.id = target
       and a.status = 'approved'
       and (
         a.creator_id = who
         or exists (select 1 from public.asset_grants g
                     where g.asset_id = a.id and g.user_id = who and g.state = 'granted')
       )
  );
$$;

grant execute on function public.can_use_asset to anon, authenticated;

-- The inventory follows: your own work, and what you have taken.
drop function if exists public.my_inventory(text);
create function public.my_inventory(kind_filter text default null)
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  description text,
  file_path text,
  thumbnail_path text,
  download_count integer,
  content_id bigint,
  price integer,
  score integer,
  votes bigint,
  created_at timestamptz,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  creator_is_admin boolean,
  source text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.download_count, a.content_id, a.price,
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin,
         case when a.creator_id = auth.uid() then 'yours' else 'collected' end
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.status = 'approved'
     and (kind_filter is null or a.kind::text = kind_filter)
     and (
       a.creator_id = auth.uid()
       or exists (select 1 from public.asset_grants g
                   where g.asset_id = a.id and g.user_id = auth.uid() and g.state = 'granted')
     )
   order by a.created_at desc;
$$;

grant execute on function public.my_inventory to authenticated;

/*
 * Taking something you were given for nothing. Verified work is free, so
 * this is the same path with no Kubes moving, and it still has to be asked
 * for. Anything a Community sells still fills that Community's funds.
 */
create or replace function public.buy_asset(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot collect things.'; end if;

  select a.id, a.creator_id, a.community_id, a.price, a.name, a.status, a.is_public
    into item
    from public.assets a
   where a.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.status <> 'approved' or not item.is_public then
    raise exception 'That is not in the marketplace.';
  end if;
  if item.creator_id = me and item.community_id is null then
    raise exception 'That is already yours.';
  end if;

  if exists (select 1 from public.asset_grants g
              where g.asset_id = target and g.user_id = me and g.state = 'granted') then
    raise exception 'It is already in your inventory.';
  end if;

  if item.price > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < item.price then
      raise exception 'That costs % Kubes and you have %.', item.price, balance;
    end if;

    perform public.move_pixels(me, -item.price, 'purchase', 'Got ' || item.name);

    if item.community_id is not null then
      update public.communities set funds = funds + item.price where id = item.community_id;
      perform public.log_community(item.community_id, 'sale', item.name);
    else
      perform public.move_pixels(item.creator_id, item.price, 'sale', 'Sold ' || item.name);
    end if;
  end if;

  insert into public.asset_grants (asset_id, user_id, state, answered_at)
  values (target, me, 'granted', now())
  on conflict (asset_id, user_id) do update set state = 'granted', answered_at = now();
end;
$$;

grant execute on function public.buy_asset to authenticated;

/*
 * You can only rate and review something you have. Otherwise a rating says
 * nothing about the thing: it is a drive-by from somebody who never used it.
 * Taking it is free where the creator made it free, so this costs nobody
 * anything except a moment.
 */
drop policy if exists asset_ratings_write on public.asset_ratings;
create policy asset_ratings_write on public.asset_ratings for insert
  with check (
    user_id = auth.uid()
    and not public.is_guest()
    and public.can_use_asset(asset_id)
    and not exists (select 1 from public.assets a
                     where a.id = asset_id and a.creator_id = auth.uid())
  );

drop policy if exists asset_ratings_change on public.asset_ratings;
create policy asset_ratings_change on public.asset_ratings for update
  using (user_id = auth.uid() and public.can_use_asset(asset_id))
  with check (user_id = auth.uid() and public.can_use_asset(asset_id));

drop policy if exists asset_reviews_write on public.asset_reviews;
create policy asset_reviews_write on public.asset_reviews for insert
  with check (
    user_id = auth.uid()
    and not public.is_guest()
    and public.can_use_asset(asset_id)
  );
