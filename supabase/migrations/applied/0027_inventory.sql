-- Everything in the marketplace is got the same way: you take it, free or
-- paid, and it lands in your inventory. Asking permission and waiting for an
-- answer is gone; a creator sets a price, or sets none, and that is the
-- whole conversation.

/*
 * Free items are had for nothing rather than refused. The Kubes only move
 * when there are Kubes to move.
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

  select a.id, a.creator_id, a.price, a.name, a.status, a.is_public
    into item
    from public.assets a
   where a.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.status <> 'approved' or not item.is_public then
    raise exception 'That is not in the marketplace.';
  end if;
  if item.creator_id = me then raise exception 'That is already yours.'; end if;

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
    perform public.move_pixels(item.creator_id, item.price, 'sale', 'Sold ' || item.name);
  end if;

  insert into public.asset_grants (asset_id, user_id, state, answered_at)
  values (target, me, 'granted', now())
  on conflict (asset_id, user_id) do update set state = 'granted', answered_at = now();
end;
$$;

grant execute on function public.buy_asset to authenticated;

/*
 * Your inventory: your own uploads, anything Kobbleston publishes, and
 * everything you have taken. This is what an editor would offer you.
 */
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
         case when a.creator_id = auth.uid() then 'yours'
              when p.is_admin then 'verified'
              else 'collected' end
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.status = 'approved'
     and (kind_filter is null or a.kind::text = kind_filter)
     and (
       a.creator_id = auth.uid()
       or p.is_admin
       or exists (select 1 from public.asset_grants g
                   where g.asset_id = a.id and g.user_id = auth.uid() and g.state = 'granted')
     )
   order by a.created_at desc;
$$;

grant execute on function public.my_inventory to authenticated;

-- assets_i_can_use said the same thing in fewer words; the inventory replaces
-- it so there is one answer to "what may I build with".
drop function if exists public.assets_i_can_use();
