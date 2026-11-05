-- Making things as a Community rather than as yourself. You pick who you are
-- working for in Create; what you make belongs to that Community, and what it
-- earns goes into its funds.

alter table public.assets add column if not exists community_id uuid
  references public.communities on delete set null;

create index if not exists assets_community_idx on public.assets (community_id)
  where community_id is not null;

-- Uploading on behalf of a Community needs the permission to do so there.
-- The row still records who actually pressed the button.
drop policy if exists assets_insert_own on public.assets;
create policy assets_insert_own on public.assets for insert
  with check (
    creator_id = auth.uid()
    and not public.is_guest()
    and (
      community_id is null
      or public.community_can(community_id, 'can_manage_spaces')
    )
  );

-- The guard keeps the Community on an item fixed once it is set, so an
-- upload cannot be quietly moved out of a Community after the fact.
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
  new.community_id   := old.community_id;
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
    raise exception 'The most you can charge for % is % Kubes.',
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

-- Editing an item a Community published is for people who can manage it,
-- not only for whoever happened to upload it.
drop policy if exists assets_update_own_metadata on public.assets;
create policy assets_update_own_metadata on public.assets for update
  using (
    creator_id = auth.uid()
    or (community_id is not null and public.community_can(community_id, 'can_manage_spaces'))
  )
  with check (
    creator_id = auth.uid()
    or (community_id is not null and public.community_can(community_id, 'can_manage_spaces'))
  );

/*
 * Money from a Community's work goes to the Community. Nothing else about
 * buying changes: the Kubes move, the grant is written, both or neither.
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

-- Everything that lists items carries who published it, so a Community can
-- be shown as the maker instead of the person who pressed upload.
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
  creator_is_admin boolean,
  community_id uuid,
  community_slug text,
  community_name text,
  community_icon text
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
         p.username, p.display_name, p.avatar_url, p.is_admin,
         c.id, c.slug, c.name, c.icon_url
    from public.assets a
    join public.profiles p on p.id = a.creator_id and not p.is_suspended
    left join public.communities c on c.id = a.community_id
   cross join needle n
   where a.status = 'approved'
     and a.is_public
     and (kind_filter is null or a.kind::text = kind_filter)
     and (
       creator is null
       or lower(p.username) = lower(creator)
       or lower(c.slug) = lower(creator)
     )
     and (
       n.q is null
       or a.name ilike '%' || n.q || '%'
       or a.description ilike '%' || n.q || '%'
       or p.username ilike '%' || n.q || '%'
       or p.display_name ilike '%' || n.q || '%'
       or c.name ilike '%' || n.q || '%'
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
  community_id uuid,
  community_slug text,
  community_name text,
  community_icon text,
  i_can_use boolean,
  i_asked boolean,
  votes bigint,
  score integer,
  review_count bigint,
  my_vote boolean,
  i_can_edit boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.byte_size, a.download_count, a.content_id, a.status, a.is_public,
         case when a.creator_id = auth.uid() or public.is_moderator()
              then a.review_note end,
         a.price,
         a.created_at, a.updated_at,
         p.id, p.username, p.display_name, p.avatar_url, p.is_admin,
         c.id, c.slug, c.name, c.icon_url,
         public.can_use_asset(a.id),
         exists (select 1 from public.asset_grants g
                  where g.asset_id = a.id and g.user_id = auth.uid()),
         (select count(*) from public.asset_ratings r where r.asset_id = a.id),
         (select case when count(*) = 0 then null
                      else round(100.0 * count(*) filter (where r.up) / count(*))::int end
            from public.asset_ratings r where r.asset_id = a.id),
         (select count(*) from public.asset_reviews v where v.asset_id = a.id),
         (select r.up from public.asset_ratings r
           where r.asset_id = a.id and r.user_id = auth.uid()),
         a.creator_id = auth.uid()
           or (a.community_id is not null
               and public.community_can(a.community_id, 'can_manage_spaces'))
    from public.assets a
    join public.profiles p on p.id = a.creator_id
    left join public.communities c on c.id = a.community_id
   where a.content_id = target_content_id
     and (
       (a.status = 'approved' and a.is_public and not p.is_suspended)
       or a.creator_id = auth.uid()
       or public.is_moderator()
     );
$$;

grant execute on function public.get_asset to anon, authenticated;

/*
 * The Communities you may work for. Create asks this to fill the "working as"
 * menu: yourself, then anywhere you are allowed to make things.
 */
drop function if exists public.communities_i_build_for();
create function public.communities_i_build_for()
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  content_id bigint,
  funds integer
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.icon_url, c.content_id, c.funds
    from public.communities c
    join public.community_members m on m.community_id = c.id and m.user_id = auth.uid()
   where not c.is_removed
     and public.community_can(c.id, 'can_manage_spaces')
   order by c.name;
$$;

grant execute on function public.communities_i_build_for to authenticated;

-- A Space made for a Community is linked to it as it is made.
create or replace function public.link_space_to_community(space uuid, community uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.community_can(community, 'can_manage_spaces') then
    raise exception 'You cannot make Spaces for that Community.';
  end if;
  if not exists (select 1 from public.spaces s where s.id = space and s.owner_id = auth.uid()) then
    raise exception 'That is not your Space.';
  end if;

  insert into public.community_spaces (community_id, space_id)
  values (community, space) on conflict do nothing;

  perform public.log_community(community, 'space_linked', space::text);
end;
$$;

grant execute on function public.link_space_to_community to authenticated;

-- What a Community has published, for its own shelf.
drop function if exists public.community_assets(uuid, integer);
create function public.community_assets(target uuid, limit_count integer default 24)
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
  community_id uuid,
  community_slug text,
  community_name text,
  community_icon text
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
         c.id, c.slug, c.name, c.icon_url
    from public.assets a
    join public.profiles p on p.id = a.creator_id
    join public.communities c on c.id = a.community_id
   where a.community_id = target and a.status = 'approved' and a.is_public
   order by a.created_at desc
   limit least(greatest(limit_count, 1), 60);
$$;

grant execute on function public.community_assets to anon, authenticated;
