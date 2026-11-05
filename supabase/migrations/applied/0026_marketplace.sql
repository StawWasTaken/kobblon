-- Kobbleston Create grows up: things can be sold for Pixels, searching
-- actually finds things, and a guest can follow somebody.

-- ------------------------------------------------------------- following

/*
 * A guest may follow. It costs nobody anything, it does not put a message in
 * front of anyone, and it is how somebody passing through keeps track of a
 * Space they liked. Friend requests and messages stay shut to guests,
 * because those land in someone else's lap.
 */
drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows for insert
  with check (follower_id = auth.uid());

-- --------------------------------------------------------------- selling

/*
 * What a creator may charge, by kind. The ceilings keep the marketplace
 * sane: nobody sells a picture for a fortune, and everything can still be
 * given away by leaving the price at zero.
 */
create or replace function public.price_ceiling(kind public.asset_kind)
returns integer language sql immutable as $$
  select case kind
    when 'image' then 100
    when 'audio' then 250
    when 'video' then 500
    when 'font'  then 300
    when 'model' then 750
  end;
$$;

grant execute on function public.price_ceiling to anon, authenticated;

alter table public.assets add column if not exists price integer not null default 0
  check (price >= 0);

-- A price cannot be pushed past its ceiling, and the guard already pins
-- everything else a creator must not touch.
create or replace function public.guard_asset_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare verdict public.screen_decision;
begin
  if public.is_moderator()
     or current_setting('kobbleston.counting', true) = 'on' then
    new.updated_at := now();
    return new;
  end if;

  new.creator_id     := old.creator_id;
  new.kind           := old.kind;
  new.file_path      := old.file_path;
  new.thumbnail_path := old.thumbnail_path;
  new.byte_size      := old.byte_size;
  new.content_id     := old.content_id;
  new.download_count := old.download_count;
  new.created_at     := old.created_at;
  new.status         := old.status;
  new.review_note    := old.review_note;
  new.reviewed_at    := old.reviewed_at;

  if new.price > public.price_ceiling(new.kind) then
    raise exception 'The most you can charge for % is % Pixels.',
      new.kind, public.price_ceiling(new.kind);
  end if;

  if new.name is distinct from old.name
     or new.description is distinct from old.description then
    verdict := (public.screen_text(
      coalesce(new.name, '') || ' ' || coalesce(new.description, ''))).decision;
    if verdict = 'block' then
      raise exception 'That name or description is not allowed here.';
    elsif verdict = 'review' then
      new.status := 'pending';
      new.review_note := null;
      new.reviewed_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

alter table public.pixel_transactions drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions add constraint pixel_transactions_kind_check
  check (kind in ('signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
                  'username_change'));

/*
 * Buying the right to use something. The Pixels move, the grant is written,
 * and both happen in the same statement or neither does. There is no
 * platform cut today; if one is ever taken it belongs here, in the open,
 * rather than hidden in the number the creator sees.
 */
create or replace function public.buy_asset(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot buy.'; end if;

  select a.id, a.creator_id, a.price, a.name, a.status, a.is_public
    into item
    from public.assets a
   where a.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.status <> 'approved' or not item.is_public then
    raise exception 'That is not on sale.';
  end if;
  if item.creator_id = me then raise exception 'That is already yours.'; end if;
  if item.price = 0 then raise exception 'That one is free. Ask its creator instead.'; end if;
  if public.can_use_asset(target, me) then raise exception 'You can already use it.'; end if;

  select pixels into balance from public.profiles where id = me;
  if balance < item.price then
    raise exception 'That costs % Pixels and you have %.', item.price, balance;
  end if;

  perform public.move_pixels(me, -item.price, 'purchase', 'Bought ' || item.name);
  perform public.move_pixels(item.creator_id, item.price, 'sale', 'Sold ' || item.name);

  insert into public.asset_grants (asset_id, user_id, state, answered_at)
  values (target, me, 'granted', now())
  on conflict (asset_id, user_id) do update set state = 'granted', answered_at = now();
end;
$$;

grant execute on function public.buy_asset to authenticated;

-- ---------------------------------------------------------------- finding

/*
 * Searching Create looks at the name, the description and who made it, so
 * "kobbleston", "banner" and "cartoon" all find the same picture, and
 * "by:someone" finds everything that person has published.
 */
drop function if exists public.list_assets(text, text, integer);
drop function if exists public.list_assets(text, text, integer, text, text);
create function public.list_assets(
  kind_filter text default null,
  search text default null,
  limit_count int default 24,
  sort text default 'new',
  creator text default null
)
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
  creator_is_admin boolean
)
language sql stable security definer set search_path = public as $$
  with needle as (select nullif(trim(coalesce(search, '')), '') as q)
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.download_count, a.content_id, a.price,
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         a.created_at,
         p.username, p.display_name, p.avatar_url, p.is_admin
    from public.assets a
    join public.profiles p on p.id = a.creator_id and not p.is_suspended
   cross join needle n
   where a.status = 'approved'
     and a.is_public
     and (kind_filter is null or a.kind::text = kind_filter)
     and (creator is null or lower(p.username) = lower(creator))
     and (
       n.q is null
       or a.name ilike '%' || n.q || '%'
       or a.description ilike '%' || n.q || '%'
       or p.username ilike '%' || n.q || '%'
       or p.display_name ilike '%' || n.q || '%'
       or ('SND-' || a.content_id) ilike n.q
       or ('IMG-' || a.content_id) ilike n.q
       or a.content_id::text = n.q
     )
   order by
     case when sort = 'used' then a.download_count end desc nulls last,
     case when sort = 'rated' then
       (select count(*) filter (where r.up) from public.asset_ratings r where r.asset_id = a.id)
     end desc nulls last,
     case when sort = 'cheap' then a.price end asc nulls last,
     p.is_admin desc,
     a.created_at desc
   limit least(greatest(limit_count, 1), 60);
$$;

grant execute on function public.list_assets to anon, authenticated;

-- The item page carries its price and whether it is for sale.
drop function if exists public.get_asset(bigint);
create function public.get_asset(target_content_id bigint)
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  description text,
  file_path text,
  thumbnail_path text,
  byte_size bigint,
  download_count integer,
  content_id bigint,
  status public.moderation_status,
  is_public boolean,
  review_note text,
  price integer,
  created_at timestamptz,
  updated_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  creator_is_admin boolean,
  i_can_use boolean,
  i_asked boolean,
  votes bigint,
  score integer,
  review_count bigint,
  my_vote boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.byte_size, a.download_count, a.content_id, a.status, a.is_public,
         case when a.creator_id = auth.uid() or public.is_moderator()
              then a.review_note end,
         a.price,
         a.created_at, a.updated_at,
         p.id, p.username, p.display_name, p.avatar_url, p.is_admin,
         public.can_use_asset(a.id),
         exists (select 1 from public.asset_grants g
                  where g.asset_id = a.id and g.user_id = auth.uid()),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_reviews v where v.asset_id = a.id),
         (select r.up from public.asset_ratings r
           where r.asset_id = a.id and r.user_id = auth.uid())
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.content_id = target_content_id
     and (
       (a.status = 'approved' and a.is_public and not p.is_suspended)
       or a.creator_id = auth.uid()
       or public.is_moderator()
     );
$$;

grant execute on function public.get_asset to anon, authenticated;

-- What somebody has published, for their page in the marketplace.
drop function if exists public.creator_page(text);
create function public.creator_page(target text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_admin boolean,
  content_id bigint,
  items bigint,
  uses bigint,
  joined timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.is_admin, p.content_id,
         (select count(*) from public.assets a
           where a.creator_id = p.id and a.status = 'approved' and a.is_public),
         (select coalesce(sum(a.download_count), 0) from public.assets a
           where a.creator_id = p.id and a.status = 'approved' and a.is_public),
         p.created_at
    from public.profiles p
   where lower(p.username) = lower(target) and not p.is_suspended;
$$;

grant execute on function public.creator_page to anon, authenticated;
