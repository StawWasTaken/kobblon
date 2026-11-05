-- Style: things to wear on your picture, and the shop they come from.
--
-- An accessory is an image and a place to put it. Whoever makes one stands in
-- front of a sample picture, drags the thing where it belongs, sizes it and
-- turns it, and that placement is saved with it. Everybody who wears it wears
-- it exactly there, on their own picture, at whatever size that picture is
-- being drawn, because the placement is kept in fractions of the picture
-- rather than in pixels.
--
-- For now only verified accounts may put anything in the shop. Anybody may
-- buy, and buying works the way buying anything on Kobbleston works: the
-- house takes its share and the rest reaches whoever made it.

-- ----------------------------------------------------------------- the shop

create table if not exists public.style_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles on delete cascade,
  content_id bigint default nextval('public.content_id_seq'),
  name text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 300),
  slot text not null default 'accessory'
    check (slot in ('hat', 'hair', 'face', 'accessory', 'frame')),
  image_path text not null,
  /*
   * Where it sits, as fractions of the picture it is worn on. x and y are
   * the middle of the thing, width is how much of the picture it covers, and
   * a little room is left outside the edges so a hat can sit proud of the
   * top.
   */
  x real not null default 0.5 check (x between -0.5 and 1.5),
  y real not null default 0.5 check (y between -0.5 and 1.5),
  width real not null default 0.5 check (width between 0.02 and 3),
  rotation real not null default 0 check (rotation between -180 and 180),
  flipped boolean not null default false,
  /** 0 sits behind the picture, 1 in front of it. */
  layer smallint not null default 1 check (layer in (0, 1)),
  price integer not null default 0 check (price >= 0 and price <= 100000),
  is_public boolean not null default true,
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists style_items_shop_idx
  on public.style_items (created_at desc) where is_public and not is_removed;
create index if not exists style_items_creator_idx
  on public.style_items (creator_id, created_at desc);
create unique index if not exists style_items_content_idx
  on public.style_items (content_id);

create table if not exists public.style_owners (
  item_id uuid not null references public.style_items on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  paid integer not null default 0,
  acquired_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create table if not exists public.style_worn (
  user_id uuid not null references public.profiles on delete cascade,
  item_id uuid not null references public.style_items on delete cascade,
  worn_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

/*
 * What somebody is wearing, kept on their own row as well.
 *
 * Every list on Kobbleston draws pictures, and none of them is going to ask
 * after six accessories per person. The trigger below keeps this in step, so
 * a picture anywhere is drawn from the row that was already being read.
 */
alter table public.profiles add column if not exists style jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------------- rights

alter table public.style_items enable row level security;
alter table public.style_owners enable row level security;
alter table public.style_worn enable row level security;

/** In the shop, or yours, or a moderator's business. */
drop policy if exists style_items_read on public.style_items;
create policy style_items_read on public.style_items for select
  using (
    (is_public and not is_removed)
    or creator_id = auth.uid()
    or public.is_moderator()
  );

/*
 * Only a verified account may put something in the shop. That is the whole
 * gate for now, and it is checked here rather than in a form, so it holds.
 */
drop policy if exists style_items_write on public.style_items;
create policy style_items_write on public.style_items for insert to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and (p.is_verified or p.is_admin) and not p.is_suspended
    )
  );

drop policy if exists style_items_edit on public.style_items;
create policy style_items_edit on public.style_items for update to authenticated
  using (creator_id = auth.uid() or public.is_moderator());

drop policy if exists style_owners_read on public.style_owners;
create policy style_owners_read on public.style_owners for select
  using (user_id = auth.uid() or public.is_moderator());

/** What somebody is wearing is on show, so anybody may read it. */
drop policy if exists style_worn_read on public.style_worn;
create policy style_worn_read on public.style_worn for select using (true);

/*
 * Reading is open to anybody, because a shop nobody can look in is not a
 * shop, and because a picture with something on it has to be drawable by a
 * page that nobody has logged into. Writing goes through the policies above.
 */
grant select on public.style_items, public.style_worn to anon, authenticated;
grant select on public.style_owners to authenticated;
grant insert, update on public.style_items to authenticated;

-- ------------------------------------------------------- keeping the snapshot

create or replace function public.style_of(target uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id,
           'name', i.name,
           'url', i.image_path,
           'x', i.x,
           'y', i.y,
           'width', i.width,
           'rotation', i.rotation,
           'flipped', i.flipped,
           'layer', i.layer
         ) order by i.layer, w.worn_at), '[]'::jsonb)
    from public.style_worn w
    join public.style_items i on i.id = w.item_id
   where w.user_id = target and not i.is_removed;
$$;

create or replace function public.refresh_style(target uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles set style = public.style_of(target) where id = target;
$$;

create or replace function public.style_worn_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_style(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists style_worn_sync on public.style_worn;
create trigger style_worn_sync after insert or delete on public.style_worn
  for each row execute function public.style_worn_changed();

/** An item that changes shape changes it on everybody wearing it. */
create or replace function public.style_item_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p
     set style = public.style_of(p.id)
   where p.id in (select w.user_id from public.style_worn w where w.item_id = new.id);
  return new;
end;
$$;

drop trigger if exists style_items_sync on public.style_items;
create trigger style_items_sync after update on public.style_items
  for each row execute function public.style_item_changed();

-- ------------------------------------------------------------- putting it up

/**
 * Making something. The placement comes in with it, because a thing with no
 * place to sit is not finished.
 */
create or replace function public.publish_style_item(
  item_name text,
  about text,
  slot_name text,
  image text,
  place jsonb,
  cost integer
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  made uuid;
  verdict record;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = me and (p.is_verified or p.is_admin) and not p.is_suspended
  ) then
    raise exception 'Only verified accounts can put things in the Style shop.';
  end if;

  select * into verdict from public.screen_text(coalesce(item_name, '') || ' ' || coalesce(about, ''));
  if verdict.decision = 'block' then
    raise exception 'That name or description is not allowed here.';
  end if;

  insert into public.style_items (
    creator_id, name, description, slot, image_path,
    x, y, width, rotation, flipped, layer, price
  )
  values (
    me, item_name, nullif(about, ''), coalesce(slot_name, 'accessory'), image,
    coalesce((place->>'x')::real, 0.5),
    coalesce((place->>'y')::real, 0.5),
    coalesce((place->>'width')::real, 0.5),
    coalesce((place->>'rotation')::real, 0),
    coalesce((place->>'flipped')::boolean, false),
    coalesce((place->>'layer')::smallint, 1),
    greatest(0, coalesce(cost, 0))
  )
  returning id into made;

  -- Whoever made it has it.
  insert into public.style_owners (item_id, user_id) values (made, me)
  on conflict do nothing;

  return made;
end;
$$;

/** Moving something after the fact, which moves it on everybody wearing it. */
create or replace function public.place_style_item(target uuid, place jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.style_items
     set x = coalesce((place->>'x')::real, x),
         y = coalesce((place->>'y')::real, y),
         width = coalesce((place->>'width')::real, width),
         rotation = coalesce((place->>'rotation')::real, rotation),
         flipped = coalesce((place->>'flipped')::boolean, flipped),
         layer = coalesce((place->>'layer')::smallint, layer),
         updated_at = now()
   where id = target
     and (creator_id = auth.uid() or public.is_moderator());

  if not found then raise exception 'That is not yours to move.'; end if;
end;
$$;

create or replace function public.retire_style_item(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.style_items set is_public = false, updated_at = now()
   where id = target and (creator_id = auth.uid() or public.is_moderator());
  if not found then raise exception 'That is not yours to take down.'; end if;
end;
$$;

-- -------------------------------------------------------------- buying it

/**
 * Getting something. A free one is simply taken; a paid one moves Kubes the
 * same way every other purchase on Kobbleston does, the house keeping its
 * share and the rest reaching whoever made it.
 */
create or replace function public.buy_style_item(target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  house uuid := public.kobbleston_account();
  cut integer;
  earned integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot buy.'; end if;

  select s.id, s.creator_id, s.price, s.name, s.is_public, s.is_removed
    into item
    from public.style_items s where s.id = target;

  if item.id is null then raise exception 'No such item.'; end if;
  if item.is_removed or not item.is_public then raise exception 'That is not on sale.'; end if;

  if exists (select 1 from public.style_owners o
              where o.item_id = target and o.user_id = me) then
    raise exception 'You have that already.';
  end if;

  if item.price > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < item.price then
      raise exception 'That costs % Kubes and you have %.', item.price, balance;
    end if;

    cut := round(item.price * public.platform_share() / 100.0)::integer;
    earned := item.price - cut;

    perform public.move_pixels(me, -item.price, 'purchase', 'Bought ' || item.name);
    perform public.move_pixels(item.creator_id, earned, 'sale', 'Sold ' || item.name);

    if cut > 0 and house is not null and house <> item.creator_id then
      perform public.move_pixels(house, cut, 'platform_fee', 'Share of ' || item.name);
    end if;
  end if;

  insert into public.style_owners (item_id, user_id, paid)
  values (target, me, item.price)
  on conflict do nothing;
end;
$$;

/** Putting something on, or taking it off. One of each slot at a time. */
create or replace function public.wear_style_item(target uuid, on_me boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mine record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if not on_me then
    delete from public.style_worn where user_id = me and item_id = target;
    return;
  end if;

  select s.id, s.slot into mine from public.style_items s
   where s.id = target and not s.is_removed;
  if mine.id is null then raise exception 'No such item.'; end if;

  if not exists (select 1 from public.style_owners o
                  where o.item_id = target and o.user_id = me) then
    raise exception 'You do not own that yet.';
  end if;

  -- A hat takes the place of the hat you had on.
  delete from public.style_worn w
   using public.style_items s
   where w.user_id = me and s.id = w.item_id and s.slot = mine.slot;

  insert into public.style_worn (user_id, item_id) values (me, target)
  on conflict do nothing;
end;
$$;

-- --------------------------------------------------------------- the lists

drop function if exists public.style_shop(text, text, integer);
create or replace function public.style_shop(
  search text default null,
  slot_name text default null,
  wanted integer default 60
)
returns table (
  id uuid,
  content_id bigint,
  name text,
  description text,
  slot text,
  image_path text,
  x real,
  y real,
  width real,
  rotation real,
  flipped boolean,
  layer smallint,
  price integer,
  created_at timestamptz,
  creator_id uuid,
  creator_name text,
  creator_username text,
  owned boolean,
  worn boolean,
  owners bigint
)
language sql stable security definer set search_path = public as $$
  select s.id, s.content_id, s.name, s.description, s.slot, s.image_path,
         s.x, s.y, s.width, s.rotation, s.flipped, s.layer, s.price, s.created_at,
         p.id, p.display_name, p.username,
         exists (select 1 from public.style_owners o
                  where o.item_id = s.id and o.user_id = auth.uid()),
         exists (select 1 from public.style_worn w
                  where w.item_id = s.id and w.user_id = auth.uid()),
         (select count(*) from public.style_owners o where o.item_id = s.id)
    from public.style_items s
    join public.profiles p on p.id = s.creator_id
   where s.is_public and not s.is_removed
     and (slot_name is null or s.slot = slot_name)
     and (
       search is null or search = ''
       or s.name ilike '%' || search || '%'
       or coalesce(s.description, '') ilike '%' || search || '%'
       or p.username ilike '%' || search || '%'
     )
   order by s.created_at desc
   limit greatest(1, least(coalesce(wanted, 60), 200));
$$;

/** What you have, whether you are wearing it, and what you paid. */
drop function if exists public.my_style();
create or replace function public.my_style()
returns table (
  id uuid,
  content_id bigint,
  name text,
  slot text,
  image_path text,
  x real,
  y real,
  width real,
  rotation real,
  flipped boolean,
  layer smallint,
  price integer,
  paid integer,
  worn boolean,
  mine boolean,
  is_public boolean,
  creator_username text
)
language sql stable security definer set search_path = public as $$
  select s.id, s.content_id, s.name, s.slot, s.image_path,
         s.x, s.y, s.width, s.rotation, s.flipped, s.layer, s.price,
         o.paid,
         exists (select 1 from public.style_worn w
                  where w.item_id = s.id and w.user_id = auth.uid()),
         s.creator_id = auth.uid(),
         s.is_public,
         p.username
    from public.style_owners o
    join public.style_items s on s.id = o.item_id
    join public.profiles p on p.id = s.creator_id
   where o.user_id = auth.uid() and not s.is_removed
   order by o.acquired_at desc;
$$;

grant execute on function public.publish_style_item, public.place_style_item,
  public.retire_style_item, public.buy_style_item, public.wear_style_item,
  public.style_shop, public.my_style, public.style_of to authenticated;

grant execute on function public.style_shop to anon;


-- ------------------------------------------------- wearing it in the lists

/*
 * The lists carry what somebody has on, for the same reason the row does:
 * a page drawing forty pictures is not going to ask after each one's hat.
 */
drop function if exists public.people_list(uuid, text);
create or replace function public.people_list(target uuid, which text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_online boolean,
  in_space_id uuid,
  activity text,
  last_seen_at timestamptz,
  is_verified boolean,
  is_guest boolean,
  style jsonb,
  is_admin boolean,
  content_id bigint,
  since timestamptz,
  link_id uuid,
  i_ignore boolean
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  chosen as (
    -- Friends of whoever is being looked at.
    select f.id as link_id,
           case when f.requester_id = target then f.addressee_id else f.requester_id end as person,
           coalesce(f.responded_at, f.created_at) as since
      from public.friendships f
     where which = 'friends' and f.status = 'accepted'
       and (f.requester_id = target or f.addressee_id = target)

    union all

    -- Requests waiting on you, which only ever means your own.
    select f.id, f.requester_id, f.created_at
      from public.friendships f
     where which = 'requests' and f.status = 'pending'
       and f.addressee_id = target and target = (select id from me)

    union all

    -- Requests you sent and nobody has answered.
    select f.id, f.addressee_id, f.created_at
      from public.friendships f
     where which = 'sent' and f.status = 'pending'
       and f.requester_id = target and target = (select id from me)

    union all

    select null::uuid, x.follower_id, x.created_at
      from public.follows x
     where which = 'followers' and x.following_id = target

    union all

    select null::uuid, x.following_id, x.created_at
      from public.follows x
     where which = 'following' and x.follower_id = target

    union all

    select null::uuid, b.blocked_id, b.created_at
      from public.blocks b
     where which = 'blocked' and b.blocker_id = target and target = (select id from me)

    union all

    select null::uuid, i.ignored_id, i.created_at
      from public.ignores i
     where which = 'ignored' and i.ignorer_id = target and target = (select id from me)
  )
  select p.id, p.username, p.display_name, p.avatar_url, p.bio,
         p.is_online, p.in_space_id, p.activity::text, p.last_seen_at,
         p.is_verified or p.is_admin, p.is_guest, p.style, p.is_admin, p.content_id,
         chosen.since, chosen.link_id,
         exists (select 1 from public.ignores i
                  where i.ignorer_id = (select id from me) and i.ignored_id = p.id)
    from chosen
    join public.profiles p on p.id = chosen.person
   where not p.is_suspended
     and (which in ('blocked', 'ignored') or not public.blocked_between((select id from me), p.id))
   order by chosen.since desc;
$$;

grant execute on function public.people_list to authenticated;
