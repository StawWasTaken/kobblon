begin;

/*
 * Body parts, sold like anything else in the Catalog.
 *
 * Staw: "we want to be able to sell bodyparts too (kobblon only can upload
 * some)". A body part is a seventh kind of avatar item and the first one
 * that is neither a picture nor a model: it is a *shape*, named, and the
 * engine knows how to build it. `src/engine/bodyshapes.ts` holds the names
 * and what each one does, and the row here carries the name and nothing
 * else.
 *
 * Why a name rather than a mesh. A part of the body is skinned to a bone and
 * measured against the box the clothing coordinates are laid out on; a mesh
 * somebody uploads is neither, so a shirt worn over it would land anywhere.
 * A shape built by the engine keeps the box and keeps the bone, which is why
 * only Kobblon can make one - the shape has to exist in the engine first.
 *
 * `kobblon_only`, like a face, and for the same reason said twice: the rule
 * is in `avatar_rules` so the Create page can grey the tile out, and
 * `create_avatar_item` has refused a `kobblon_only` kind to anybody but an
 * admin since 0113. The client's half is the courtesy; the server's half is
 * the rule.
 */

-- ------------------------------------------------------- the kind and the slot

/*
 * Text with a check, as 0112 put it, precisely so this is a three-line
 * migration rather than a failed deploy. Dropped and re-added rather than
 * `alter ... add constraint` on top: two checks over one column both pass or
 * the row is refused, and the old one does not know about `bodypart`.
 */
alter table public.avatar_items drop constraint if exists avatar_items_kind_check;
alter table public.avatar_items add constraint avatar_items_kind_check
  check (kind in ('shirt', 'trousers', 'tdecal', 'accessory', 'hair', 'face', 'bodypart'));

alter table public.avatar_items drop constraint if exists avatar_items_slot_check;
alter table public.avatar_items add constraint avatar_items_slot_check
  check (slot in (
    'shirt', 'trousers', 'tdecal', 'face', 'hair',
    'hat', 'front', 'back', 'neck', 'waist', 'leftHand', 'rightHand',
    /*
     * Where a body part goes. One slot per part of the body, and only the
     * torso today because only the torso has a shape to wear - the rest are
     * added here when the engine grows them, which is the same order
     * everything else in this schema was added in.
     */
    'torso'
  ));

/*
 * And the same list on what is worn. `avatar_worn` carries its own copy of
 * the slots - it has since 0112 - so widening only the items table leaves a
 * torso that can be made, bought and owned and refused the moment somebody
 * puts it on, which is `avatar_worn_slot_check` failing inside
 * `wear_avatar_item` with nothing on the page to explain it.
 */
alter table public.avatar_worn drop constraint if exists avatar_worn_slot_check;
alter table public.avatar_worn add constraint avatar_worn_slot_check
  check (slot in (
    'shirt', 'trousers', 'tdecal', 'face', 'hair',
    'hat', 'front', 'back', 'neck', 'waist', 'leftHand', 'rightHand',
    'torso'
  ));

/** Which shape in the engine this is. Null for everything that is not a part. */
alter table public.avatar_items add column if not exists shape text
  check (shape is null or length(btrim(shape)) between 1 and 40);

comment on column public.avatar_items.shape is
  'The name of a shape in the engine''s own list, for a bodypart. Not a '
  'file: the engine builds the geometry, so a part keeps the bone and the '
  'clothing box that a mesh would not.';

/*
 * A picture kind needs a picture, a model kind needs a model, and a part
 * needs a shape. 0112's constraint said "else mesh_id is not null", which
 * made a body part impossible to insert - the one case the `else` was never
 * written for.
 */
alter table public.avatar_items drop constraint if exists avatar_item_has_its_thing;
alter table public.avatar_items add constraint avatar_item_has_its_thing check (
  case kind
    when 'bodypart' then shape is not null
    else case when kind in ('shirt', 'trousers', 'tdecal', 'face')
              then image_path is not null
              else mesh_id is not null end
  end
);

-- ------------------------------------------------------------------ the rules

/*
 * 0112's table with a seventh row. Free to make, free to price: Kobblon's
 * own, like a face, and what one sells for is set when it is listed.
 */
create or replace function public.avatar_rules()
returns table(
  kind text, upload_cost integer, least_price integer,
  needs_verified boolean, kobblon_only boolean
)
language sql immutable
set search_path = public, extensions as $$
  select * from (values
    ('shirt',     10,  5, false, false),
    ('trousers',  10,  5, false, false),
    ('tdecal',     2,  0, false, false),
    ('accessory', 40, 30, true,  false),
    ('hair',      40, 30, true,  false),
    ('face',       0,  0, false, true),
    -- A shape the engine has to know how to build, so the house's own.
    ('bodypart',   0,  0, false, true)
  ) as rules(kind, upload_cost, least_price, needs_verified, kobblon_only);
$$;

grant execute on function public.avatar_rules to anon, authenticated;

-- --------------------------------------------------------- one torso at a time

/*
 * A body part is one of the things that physically can only be one, in
 * 0150's words: two torsos on one body is not ugly, it is undefined.
 */
create or replace function public.one_at_a_time(slot text)
returns boolean
language sql immutable
set search_path = public, extensions as $$
  select slot in ('shirt', 'trousers', 'tdecal', 'face', 'hair', 'torso');
$$;

grant execute on function public.one_at_a_time to anon, authenticated;

/*
 * And the index that enforces it, which carries its own copy of the list
 * because a partial index cannot call a function that is only `immutable`
 * by promise. Dropped and rebuilt: `create ... if not exists` would leave
 * the old list in place and the rule would hold for five slots out of six.
 */
drop index if exists public.avatar_worn_one_per_slot;
create unique index avatar_worn_one_per_slot
  on public.avatar_worn (user_id, slot)
  where slot in ('shirt', 'trousers', 'tdecal', 'face', 'hair', 'torso');

comment on index public.avatar_worn_one_per_slot is
  'The slots that can only hold one thing: what is laid on the body, the '
  'head, and a part of the body itself. The sockets may hold several.';

-- ------------------------------------------------------- the readers say so

/*
 * Both readers hand the shape over, the way 0240 added `sells_until` to
 * both at once. A renderer that has to look the shape up separately is a
 * renderer that draws the plain body first and the right one a moment
 * later, and the portrait is taken in that moment.
 *
 * Dropped first: a `returns table` cannot gain a column in place.
 */
drop function if exists public.avatar_of(uuid);
create or replace function public.avatar_of(target uuid)
returns table(
  body jsonb, slot text, kind text, item_id uuid, content_id bigint,
  item_name text, price integer, image_path text, image_bucket text,
  preview_path text, mesh_preview_path text, fit jsonb,
  mesh_path text, mesh_format text, texture_path text,
  sells_until timestamptz,
  /* Which shape in the engine, for a body part. Null for everything else. */
  shape text
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    p.body, w.slot, i.kind, i.id, i.content_id, i.name, i.price,
    i.image_path, i.image_bucket, i.preview_path,
    m.preview_path, i.fit, m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    i.sells_until,
    i.shape
  from public.profiles p
  left join public.avatar_worn w on w.user_id = p.id
  left join public.avatar_items i on i.id = w.item_id and not i.is_removed
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where p.id = target and not p.is_suspended;
$$;

grant execute on function public.avatar_of(uuid) to anon, authenticated;

drop function if exists public.outfit_look(uuid);
create or replace function public.outfit_look(outfit uuid)
returns table(
  body jsonb, slot text, kind text, item_id uuid, content_id bigint,
  item_name text, price integer, image_path text, image_bucket text,
  preview_path text, mesh_preview_path text, fit jsonb,
  mesh_path text, mesh_format text, texture_path text,
  sells_until timestamptz, shape text
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    o.body, oi.slot, i.kind, i.id, i.content_id, i.name, i.price,
    i.image_path, i.image_bucket, i.preview_path,
    m.preview_path, i.fit, m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    i.sells_until,
    i.shape
  from public.outfits o
  left join public.outfit_items oi on oi.outfit_id = o.id
  left join public.avatar_items i on i.id = oi.item_id and not i.is_removed
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where o.id = outfit
    and not o.is_removed
    and (o.owner_id = auth.uid() or o.is_public);
$$;

grant execute on function public.outfit_look(uuid) to anon, authenticated;

/*
 * And the item's own page, which is the one other place a body part has to
 * be drawn *worn* rather than from its card: 0244's, with the shape on the
 * end.
 */
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
  community_id uuid, community_slug text, community_name text,
  shape text
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
    g.id, g.slug, g.name,
    i.shape
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
 * And the wardrobe, which is where somebody puts one on. A tile whose row
 * does not carry the shape cannot be drawn from the shape, so it falls back
 * to the saved card - and a body part made before the card drawing worked
 * would be a torn mark in the one drawer it belongs to.
 */
drop function if exists public.my_avatar_items();
create function public.my_avatar_items()
returns table (
  id uuid, content_id bigint, kind text, slot text, name text, price integer,
  image_path text, image_bucket text, preview_path text, mesh_preview_path text,
  fit jsonb, sells_until timestamptz, mesh_path text, texture_path text,
  creator_username text, worn boolean, status public.moderation_status,
  is_public boolean, mine boolean, shape text
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path,
         i.fit, i.sells_until,
         m.file_path, t.file_path, c.username,
         exists (select 1 from public.avatar_worn w
                  where w.user_id = auth.uid() and w.item_id = i.id),
         i.status, i.is_public, i.creator_id = auth.uid(),
         i.shape
    from public.avatar_owned o
    join public.avatar_items i on i.id = o.item_id and not i.is_removed
    join public.profiles c on c.id = i.creator_id
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where o.user_id = auth.uid()
   order by o.got_at desc;
$$;

grant execute on function public.my_avatar_items() to authenticated;

/*
 * And the shelf, which is where one is bought. 0244's body, unchanged, with
 * the shape on the end: the Catalog is the one page where a card that did
 * not draw is the difference between a thing being on sale and a torn mark
 * being on sale.
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
  community_id uuid, community_slug text, community_name text,
  shape text
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
         g.id, g.slug, g.name,
         i.shape
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

/*
 * And the maker's own list, 0245's with the shape on the end. Kobblon is
 * the only account that will ever see a body part here, which is not a
 * reason to leave it out: it is the page the house looks at its own things
 * on, and a card that failed to draw would be a torn mark there and nowhere
 * else.
 */
drop function if exists public.my_made_avatar_items(uuid);
create function public.my_made_avatar_items(for_community uuid default null)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text, description text,
  price integer, image_path text, image_bucket text, preview_path text,
  mesh_preview_path text, fit jsonb, sells_until timestamptz,
  mesh_path text, texture_path text, status moderation_status, review_note text,
  is_public boolean, created_at timestamptz, taken integer,
  community_id uuid, community_slug text, community_name text,
  creator_id uuid, shape text
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, m.preview_path, i.fit,
         i.sells_until, m.file_path, t.file_path, i.status, i.review_note,
         i.is_public, i.created_at,
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id),
         g.id, g.slug, g.name, i.creator_id, i.shape
    from public.avatar_items i
    left join public.communities g on g.id = i.community_id
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where not i.is_removed
     and case
           when for_community is not null
             then i.community_id = for_community
              and public.community_can(for_community, 'can_manage_community')
           else i.creator_id = auth.uid() and i.community_id is null
         end
   order by i.created_at desc;
$$;

grant execute on function public.my_made_avatar_items(uuid) to authenticated;

-- -------------------------------------------------------------- making one

/*
 * 0244's, with a shape on the end.
 *
 * Both arities are dropped before the create. A defaulted argument added to
 * a function *overloads* it rather than replacing it, so without this the
 * old nine-argument version stays callable and keeps refusing `bodypart`
 * for want of its thing - and which one answers depends on how the caller
 * spells the arguments, which is the worst kind of bug to read.
 */
drop function if exists public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid);
drop function if exists public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid, text);

create function public.create_avatar_item(
  item_kind text,
  item_slot text,
  item_name text,
  about text,
  cost integer default null,
  picture text default null,
  model uuid default null,
  texture uuid default null,
  maker uuid default null,
  form text default null
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
  elsif item_kind = 'bodypart' then
    -- A part goes where that part of the body is, and nowhere else.
    if item_slot not in ('torso') then
      raise exception 'There is no part of the body there yet.';
    end if;
    if coalesce(btrim(coalesce(form, '')), '') = '' then
      raise exception 'A body part is a shape, and no shape was given.';
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
    image_path, mesh_id, texture_id, shape, status, is_public
  ) values (
    me, maker, item_kind, item_slot, btrim(item_name), nullif(btrim(coalesce(about, '')), ''),
    coalesce(cost, 0), picture, model, texture,
    case when item_kind = 'bodypart' then btrim(form) else null end,
    'pending', false
  ) returning id into made;

  insert into public.avatar_owned (item_id, user_id) values (made, me)
  on conflict do nothing;

  return made;
end;
$$;

revoke all on function public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid, text) from public;
grant execute on function public.create_avatar_item(
  text, text, text, text, integer, text, uuid, uuid, uuid, text) to authenticated;

commit;
