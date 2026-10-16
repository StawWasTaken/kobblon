begin;

/*
 * Shops: the things somebody sells, under their own name or a Community's.
 *
 * Staw: "basically its like when you create stuff that you sell in the
 * create tab (either as you or as a community) then if its published then
 * itll appear on your personal shop or community shop and on the catalog too
 * ofc, and you gotta always wait for your asset to be moderated before using
 * it, if it was approved then u can use it, if it was rejected then you
 * cant".
 *
 * Three things follow and they are the whole of this file.
 *
 * **A Community can make avatar items.** Assets have been able to belong to
 * a Community since 0029 - `assets.community_id`, and what one sells fills
 * that Community's funds. Avatar items never could, so a Community could
 * sell Decals and models and not a single shirt. One column, and the money
 * goes where the same money already goes for an asset.
 *
 * **A shop is a shelf with an owner.** One function rather than two, because
 * a personal shelf and a Community's differ in one line of their where
 * clause and nothing else; two copies of this drift the day one of them
 * learns about sales and the other does not.
 *
 * **Nothing unapproved can be worn.** This is the real bug of the three.
 * `buy_avatar_item` has always refused anything not approved - and it hands
 * a maker their own item for nothing without going near that check, which is
 * right, it is theirs. Then `wear_avatar_item` asked only whether they owned
 * it. So a maker could upload anything at all and wear it immediately, for
 * as long as it took somebody to look at it, and keep wearing it after it
 * was turned down. Everybody on the platform saw it on them the whole time.
 */

-- ---------------------------------------------- an item a Community sells

alter table public.avatar_items
  add column if not exists community_id uuid references public.communities (id)
    on delete set null;

create index if not exists avatar_items_community_idx
  on public.avatar_items (community_id) where community_id is not null;

/*
 * The eight-argument one goes first.
 *
 * A new argument with a default overloads rather than replaces, and then a
 * call naming the first eight matches both and Postgres refuses to choose:
 * "function is not unique". 0121 learned this the same way.
 */
drop function if exists public.create_avatar_item(text, text, text, text, integer, text, uuid, uuid);

/**
 * Making something to wear, as yourself or as a Community.
 *
 * `maker` is the Community it belongs to, and leaving it out means you. A
 * Community item is still made *by* a person - `creator_id` is who pressed
 * the button, which is what the audit log and every takedown needs - but it
 * is sold under the Community's name and its money goes to the Community.
 *
 * Which also decides who pays to make it: whoever gets the sale pays the
 * fee. A Community whose funds cannot cover it is told so rather than the
 * person quietly paying out of their own Brix for something they will never
 * be paid for.
 */
create or replace function public.create_avatar_item(
  item_kind text,
  item_slot text,
  item_name text,
  about text,
  cost integer default null,
  picture text default null,
  model uuid default null,
  texture uuid default null,
  maker uuid default null
) returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  rule record;
  verdict record;
  made uuid;
  mine record;
  balance integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot make things. Make an account and you can.';
  end if;

  if maker is not null and not public.community_can(maker, 'can_manage_community') then
    raise exception 'You cannot make things for that Community.';
  end if;

  select * into rule from public.avatar_rules() where kind = item_kind;
  if rule.kind is null then raise exception 'There is no such kind of item.'; end if;

  select is_verified, is_admin, is_suspended into mine
    from public.profiles where id = me;

  if mine.is_suspended then raise exception 'Suspended accounts cannot make things.'; end if;

  if rule.kobblon_only and not coalesce(mine.is_admin, false) then
    raise exception 'Only Kobblon makes those.';
  end if;

  if rule.needs_verified
     and not (coalesce(mine.is_verified, false) or coalesce(mine.is_admin, false)) then
    raise exception 'Only verified accounts can make a %.', item_kind;
  end if;

  if item_kind = 'accessory' then
    if item_slot not in ('hat', 'front', 'back', 'neck', 'waist', 'leftHand', 'rightHand') then
      raise exception 'An accessory does not go there.';
    end if;
  elsif item_slot is distinct from item_kind then
    raise exception 'A % is always worn as a %.', item_kind, item_kind;
  end if;

  if cost is not null and cost < rule.least_price then
    raise exception 'A % sells for at least % Brix.', item_kind, rule.least_price;
  end if;

  select * into verdict from public.screen_text(
    coalesce(item_name, '') || ' ' || coalesce(about, ''));
  if verdict.decision = 'block' then
    raise exception 'That name or description is not allowed here.';
  end if;

  if model is not null and not exists (
    select 1 from public.assets a
     where a.id = model
       and (a.creator_id = me
            or (maker is not null and a.community_id = maker))
  ) then
    raise exception 'That model is not yours to use.';
  end if;

  if rule.upload_cost > 0 then
    if maker is null then
      select pixels into balance from public.profiles where id = me;
      if balance < rule.upload_cost then
        raise exception 'Making a % costs % Brix and you have %.',
          item_kind, rule.upload_cost, balance;
      end if;
      perform public.move_pixels(me, -rule.upload_cost, 'listing_fee',
        'Made a ' || item_kind);
    else
      select funds into balance from public.communities where id = maker for update;
      if coalesce(balance, 0) < rule.upload_cost then
        raise exception 'Making a % costs % Brix and this Community has %.',
          item_kind, rule.upload_cost, coalesce(balance, 0);
      end if;
      update public.communities set funds = funds - rule.upload_cost where id = maker;
      perform public.log_community(maker, 'made', item_name);
    end if;

    if house is not null and house <> me then
      perform public.move_pixels(house, rule.upload_cost, 'platform_fee',
        'Upload fee for a ' || item_kind);
    end if;
  end if;

  insert into public.avatar_items (
    creator_id, community_id, kind, slot, name, description, price,
    image_path, mesh_id, texture_id, status, is_public
  ) values (
    me, maker, item_kind, item_slot, btrim(item_name), nullif(btrim(coalesce(about, '')), ''),
    coalesce(cost, 0), picture, model, texture, 'pending', false
  ) returning id into made;

  /*
   * Yours the moment it exists, as before. Wearing it is a different
   * question and `wear_avatar_item` now asks it: owning something that has
   * not been looked at yet is fine, walking around in it is not.
   */
  insert into public.avatar_owned (item_id, user_id) values (made, me)
  on conflict do nothing;

  return made;
end;
$$;

revoke all on function public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid) from public;
grant execute on function public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid) to authenticated;

/**
 * Putting it up or taking it down.
 *
 * Widened by exactly one thing: somebody who runs the Community an item
 * belongs to may list it. Without this a Community item could be made and
 * never sold by anybody but the one person who pressed the button, which is
 * the whole reason a Community owns it rather than them.
 */
create or replace function public.list_avatar_item(
  target uuid, listed boolean, cost integer default null
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  rule record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into item from public.avatar_items
   where id = target and not is_removed
     and (creator_id = me
          or (community_id is not null
              and public.community_can(community_id, 'can_manage_community')));
  if item.id is null then raise exception 'That is not yours.'; end if;

  select * into rule from public.avatar_rules() where kind = item.kind;

  if listed then
    if coalesce(cost, item.price) < rule.least_price then
      raise exception 'A % sells for at least % Brix.', item.kind, rule.least_price;
    end if;
    if item.status <> 'approved' then
      raise exception 'It has to be looked at before it can go up for sale.';
    end if;
  end if;

  update public.avatar_items
     set is_public = listed,
         price = coalesce(cost, price),
         updated_at = now()
   where id = target;
end;
$$;

revoke all on function public.list_avatar_item(uuid, boolean, integer) from public;
grant execute on function public.list_avatar_item(uuid, boolean, integer) to authenticated;

-- -------------------------------------------- the money follows the owner

/**
 * Buying something to wear.
 *
 * One line's difference from 0156: where an item belongs to a Community, the
 * maker's share fills that Community's funds instead of the person's purse,
 * which is what `buy_asset` has done for a Community's assets since 0033.
 * Kobblon's cut is unchanged and comes off the same way.
 */
create or replace function public.buy_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  keeps integer;
  cut integer;
  costs integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot take things. Make an account and you can.';
  end if;

  select i.*, p.is_suspended as maker_suspended into item
    from public.avatar_items i
    join public.profiles p on p.id = i.creator_id
   where i.id = target;

  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if exists (select 1 from public.avatar_owned o
              where o.item_id = target and o.user_id = me) then
    return;
  end if;

  if item.creator_id = me then
    insert into public.avatar_owned (item_id, user_id, paid) values (target, me, 0)
    on conflict do nothing;
    return;
  end if;

  if not item.is_public or item.status <> 'approved' or item.maker_suspended then
    raise exception 'That is not for sale.';
  end if;

  if item.sells_until is not null and item.sells_until <= now() then
    raise exception 'That was limited, and the time to take it has passed.';
  end if;

  costs := public.sale_price(item.price, item.sells_until);

  if costs > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < costs then
      raise exception 'That costs % Brix and you have %.', costs, balance;
    end if;

    cut := round(costs * public.platform_share() / 100.0)::integer;
    keeps := costs - cut;

    perform public.move_pixels(me, -costs, 'purchase', 'Bought ' || item.name);

    if item.community_id is not null then
      update public.communities set funds = funds + keeps where id = item.community_id;
      perform public.log_community(item.community_id, 'sale', item.name);
    else
      perform public.move_pixels(item.creator_id, keeps, 'sale', 'Sold ' || item.name);
    end if;

    if cut > 0 and house is not null and house <> item.creator_id then
      perform public.move_pixels(house, cut, 'platform_fee', 'Cut of ' || item.name);
    end if;
  end if;

  insert into public.avatar_owned (item_id, user_id, paid)
  values (target, me, costs)
  on conflict do nothing;
end;
$$;

revoke all on function public.buy_avatar_item(uuid) from public;
grant execute on function public.buy_avatar_item(uuid) to authenticated;

-- ------------------------------------- nothing unapproved goes on a body

/**
 * Wearing something.
 *
 * The check that was missing. Owning and wearing were one question here, and
 * they are two: a maker owns what they made the moment they make it, and
 * that is the one person who can be holding something nobody has looked at
 * yet. Until 0244 they could wear it - and keep wearing it after it was
 * turned down, which is exactly the case the moderation queue exists for.
 *
 * Said in two sentences rather than one, because "you cannot wear that"
 * without a reason reads as a broken button. Waiting is a wait; turned down
 * is an answer.
 */
create or replace function public.wear_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into item from public.avatar_items where id = target;
  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if item.status = 'pending' then
    raise exception 'That is still being looked at. You can wear it once it is approved.';
  elsif item.status = 'rejected' then
    raise exception 'That was turned down, so it cannot be worn.';
  end if;

  if not exists (select 1 from public.avatar_owned o
                  where o.item_id = target and o.user_id = me) then
    raise exception 'You do not have that.';
  end if;

  if public.one_at_a_time(item.slot) then
    delete from public.avatar_worn w
     where w.user_id = me and w.slot = item.slot and w.item_id <> target;
  elsif (select count(*) from public.avatar_worn w
          where w.user_id = me and w.slot = item.slot and w.item_id <> target) >= 8 then
    raise exception 'Eight in one place is as many as this draws. Take one off first.';
  end if;

  insert into public.avatar_worn (user_id, slot, item_id)
  values (me, item.slot, target)
  on conflict (user_id, item_id) do nothing;
end;
$$;

revoke all on function public.wear_avatar_item(uuid) from public;
grant execute on function public.wear_avatar_item(uuid) to authenticated;

-- ------------------------------------------------------------- the shelf

/**
 * What somebody sells, or what a Community sells.
 *
 * One function with two owners rather than two functions: they differ by one
 * line of the where clause, and two copies of this is one of them learning
 * about sales a month before the other.
 *
 * Only what is actually on sale: approved, listed, not taken down. A shop is
 * a shelf, not a workshop - what somebody is still making belongs in the
 * Create tab, where its own page says what it is waiting for.
 *
 * An item that belongs to a Community is on that Community's shelf and not
 * on its maker's, which is the point of it belonging to the Community.
 */
/* Dropped first: a column was added to it after it first shipped, and a
   `returns table` cannot grow one in place. */
drop function if exists public.shop_shelf(uuid, uuid, integer);

create function public.shop_shelf(
  owner_user uuid default null,
  owner_community uuid default null,
  how_many integer default 60
)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text, description text,
  price integer, image_path text, image_bucket text, preview_path text,
  sells_until timestamptz, mesh_path text, texture_path text,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_verified boolean, creator_is_staff boolean,
  created_at timestamptz, owned boolean, taken integer,
  community_id uuid, community_slug text, community_name text
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, i.sells_until,
         m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         coalesce(c.is_admin, false) or coalesce(c.is_moderator, false),
         i.created_at,
         exists (select 1 from public.avatar_owned o
                  where o.item_id = i.id and o.user_id = auth.uid()),
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id),
         g.id, g.slug, g.name
    from public.avatar_items i
    join public.profiles c on c.id = i.creator_id and not c.is_suspended
    left join public.communities g on g.id = i.community_id
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.status = 'approved' and i.is_public and not i.is_removed
     and case
           when owner_community is not null then i.community_id = owner_community
           when owner_user is not null then i.creator_id = owner_user and i.community_id is null
           else false
         end
   order by i.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 120);
$$;

grant execute on function public.shop_shelf(uuid, uuid, integer) to anon, authenticated;

/**
 * How many things are on a shelf, for the tab that has to say so before the
 * shelf itself is asked for.
 */
create or replace function public.shop_size(
  owner_user uuid default null,
  owner_community uuid default null
)
returns integer
language sql stable security definer
set search_path = public, extensions as $$
  select count(*)::integer
    from public.avatar_items i
    join public.profiles c on c.id = i.creator_id and not c.is_suspended
   where i.status = 'approved' and i.is_public and not i.is_removed
     and case
           when owner_community is not null then i.community_id = owner_community
           when owner_user is not null then i.creator_id = owner_user and i.community_id is null
           else false
         end;
$$;

grant execute on function public.shop_size(uuid, uuid) to anon, authenticated;

-- ------------------------------------------------ whose name it sells under

/*
 * A Community's item says the Community made it.
 *
 * Staw: "i want it to be said to be 'by [community]' rather by the guy who
 * uploaded it". He is right, and it is not only a label: the person who
 * pressed the button is an employee, and a shop that credits them is a shop
 * where the staff rota is public.
 *
 * The maker is carried **beside** the creator rather than written over it.
 * Overwriting `creator_display_name` with the Community's name would make
 * every byline correct and every takedown, audit entry and suspension look
 * at the wrong account - the person is still who made it, and the moderation
 * side of this platform reads these same rows. So three more columns, null
 * for anything a person made themselves, and the byline prefers them.
 *
 * Both of these are `returns table`, and a column cannot be added to one in
 * place: Postgres refuses "cannot change return type of existing function",
 * so each is dropped and written again.
 */
drop function if exists public.avatar_shelf(
  text, text, integer, text, text, integer, integer, boolean, boolean);

create function public.avatar_shelf(
  of_kind text default null, term text default null, how_many integer default 60,
  made_by text default null, sort_by text default 'newest',
  least_price integer default null, most_price integer default null,
  only_limited boolean default false, only_free boolean default false
)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text, description text,
  price integer, image_path text, image_bucket text, preview_path text,
  mesh_preview_path text, sells_until timestamptz, mesh_path text, texture_path text,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_verified boolean, creator_is_staff boolean,
  created_at timestamptz, owned boolean, taken integer, stars integer, starred boolean,
  community_id uuid, community_slug text, community_name text
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.sells_until,
         m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         coalesce(c.is_admin, false) or coalesce(c.is_moderator, false),
         i.created_at,
         exists (select 1 from public.avatar_owned o
                  where o.item_id = i.id and o.user_id = auth.uid()),
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id),
         (select count(*)::int from public.avatar_favourites f where f.item_id = i.id),
         exists (select 1 from public.avatar_favourites f
                  where f.item_id = i.id and f.user_id = auth.uid()),
         g.id, g.slug, g.name
    from public.avatar_items i
    join public.profiles c on c.id = i.creator_id and not c.is_suspended
    left join public.communities g on g.id = i.community_id
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.status = 'approved' and i.is_public and not i.is_removed
     and (of_kind is null or i.kind = of_kind)
     and (term is null or btrim(term) = '' or i.name ilike '%' || btrim(term) || '%')
     and (least_price is null or i.price >= least_price)
     and (most_price is null or i.price <= most_price)
     and (not coalesce(only_free, false) or i.price = 0)
     and (not coalesce(only_limited, false) or i.sells_until is not null)
     and (
       made_by is null or made_by = 'anybody'
       or (made_by = 'kobblon' and coalesce(c.is_admin, false))
       or lower(c.username) = lower(ltrim(made_by, '@'))
       or lower(coalesce(g.slug, '')) = lower(ltrim(made_by, '@'))
     )
   order by
     case when sort_by = 'cheapest' then i.price end asc nulls last,
     case when sort_by = 'dearest'  then i.price end desc nulls last,
     case when sort_by = 'oldest'   then i.created_at end asc nulls last,
     case when sort_by = 'taken' then
       (select count(*) from public.avatar_owned o
         where o.item_id = i.id and o.user_id <> i.creator_id) end desc nulls last,
     i.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 120);
$$;

grant execute on function public.avatar_shelf(
  text, text, integer, text, text, integer, integer, boolean, boolean)
  to anon, authenticated;

drop function if exists public.avatar_item_page(bigint);

create function public.avatar_item_page(wanted bigint)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text, description text,
  price integer, image_path text, image_bucket text, preview_path text,
  mesh_preview_path text, fit jsonb, sells_until timestamptz,
  mesh_path text, mesh_format text, texture_path text,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_verified boolean, creator_is_staff boolean, created_at timestamptz,
  owned boolean, worn boolean, mine boolean, is_public boolean, taken integer,
  stars integer, starred boolean,
  community_id uuid, community_slug text, community_name text
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    i.id, i.content_id, i.kind, i.slot, i.name,
    i.description, i.price,
    i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.fit,
    i.sells_until,
    m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    c.id, c.username, c.display_name,
    coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
    coalesce(c.is_admin, false) or coalesce(c.is_moderator, false),
    i.created_at,
    exists (select 1 from public.avatar_owned o
             where o.item_id = i.id and o.user_id = auth.uid()),
    exists (select 1 from public.avatar_worn w
             where w.item_id = i.id and w.user_id = auth.uid()),
    i.creator_id = auth.uid()
      or (i.community_id is not null
          and public.community_can(i.community_id, 'can_manage_community')),
    i.is_public,
    (select count(*)::int from public.avatar_owned o
      where o.item_id = i.id and o.user_id <> i.creator_id),
    (select count(*)::int from public.avatar_favourites f where f.item_id = i.id),
    exists (select 1 from public.avatar_favourites f
             where f.item_id = i.id and f.user_id = auth.uid()),
    g.id, g.slug, g.name
  from public.avatar_items i
  join public.profiles c on c.id = i.creator_id and not c.is_suspended
  left join public.communities g on g.id = i.community_id
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where i.content_id = wanted
    and not i.is_removed
    and (i.status = 'approved' or i.creator_id = auth.uid());
$$;

grant execute on function public.avatar_item_page(bigint) to anon, authenticated;

/*
 * And the Create tab's own list says which Community a thing is for.
 *
 * Without it somebody who makes for three Communities sees one list of
 * shirts with no way to tell whose is whose - and the first time they notice
 * is when the money lands somewhere they did not expect.
 */
drop function if exists public.my_made_avatar_items();

create function public.my_made_avatar_items()
returns table (
  id uuid, content_id bigint, kind text, slot text, name text, description text,
  price integer, image_path text, image_bucket text, preview_path text,
  mesh_preview_path text, fit jsonb, sells_until timestamptz,
  mesh_path text, texture_path text, status moderation_status, review_note text,
  is_public boolean, created_at timestamptz, taken integer,
  community_id uuid, community_slug text, community_name text
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.fit,
         i.sells_until, m.file_path, t.file_path, i.status, i.review_note,
         i.is_public, i.created_at,
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id),
         g.id, g.slug, g.name
    from public.avatar_items i
    left join public.communities g on g.id = i.community_id
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.creator_id = auth.uid() and not i.is_removed
   order by i.created_at desc;
$$;

grant execute on function public.my_made_avatar_items() to authenticated;

commit;
