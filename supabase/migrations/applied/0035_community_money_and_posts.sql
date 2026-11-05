-- Three things: a Community keeps a ledger and can hand Kubes to its people,
-- a post can be pinned from the post itself, and a Community says one thing
-- at a time.

-- ------------------------------------------------------------ the ledger

create table if not exists public.community_transactions (
  id bigserial primary key,
  community_id uuid not null references public.communities on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('sale', 'grant', 'adjustment')),
  note text check (char_length(note) <= 200),
  actor_id uuid references public.profiles on delete set null,
  target_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists community_transactions_idx
  on public.community_transactions (community_id, created_at desc);

alter table public.community_transactions enable row level security;

-- The people who run a Community can read its books. Nobody writes to them
-- except the functions below.
drop policy if exists community_transactions_read on public.community_transactions;
create policy community_transactions_read on public.community_transactions for select
  using (public.community_can(community_id, 'can_manage_community'));

revoke insert, update, delete on public.community_transactions from anon, authenticated;

create or replace function public.log_community_money(
  community uuid, amount integer, kind text, note text default null, target uuid default null
)
returns void language sql security definer set search_path = public as $$
  insert into public.community_transactions (community_id, amount, kind, note, actor_id, target_id)
  values (community, amount, kind, note, auth.uid(), target);
$$;

/*
 * Handing Kubes from a Community's funds to one of its people. Only somebody
 * who can manage the Community may do it, only to a member, and only what
 * the Community actually has. Both sides move in one statement.
 */
create or replace function public.grant_community_kubes(
  community uuid, target uuid, amount integer, note text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare available integer;
begin
  if not public.community_can(community, 'can_manage_community') then
    raise exception 'You cannot spend this Community''s funds.';
  end if;
  if amount is null or amount < 1 then raise exception 'Give at least 1 Kube.'; end if;

  if not exists (select 1 from public.community_members m
                  where m.community_id = community and m.user_id = target) then
    raise exception 'They are not in this Community.';
  end if;

  select funds into available from public.communities where id = community for update;
  if available < amount then
    raise exception 'That would spend % Kubes and the Community has %.', amount, available;
  end if;

  update public.communities set funds = funds - amount where id = community;
  perform public.move_pixels(target, amount, 'admin', coalesce(note, 'From a Community'));
  perform public.log_community_money(community, -amount, 'grant', note, target);
  perform public.log_community(community, 'granted_kubes', target::text);
end;
$$;

grant execute on function public.grant_community_kubes to authenticated;

-- A sale writes a line in the books as well as filling the balance.
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
      perform public.log_community_money(item.community_id, item.price, 'sale', item.name);
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

drop function if exists public.community_money(uuid, integer);
create function public.community_money(community uuid, limit_count integer default 50)
returns table (
  id bigint,
  amount integer,
  kind text,
  note text,
  created_at timestamptz,
  actor_username text,
  target_username text,
  target_display_name text
)
language sql stable security definer set search_path = public as $$
  select t.id, t.amount, t.kind, t.note, t.created_at, a.username, p.username, p.display_name
    from public.community_transactions t
    left join public.profiles a on a.id = t.actor_id
    left join public.profiles p on p.id = t.target_id
   where t.community_id = community
     and public.community_can(community, 'can_manage_community')
   order by t.created_at desc
   limit least(greatest(limit_count, 1), 200);
$$;

grant execute on function public.community_money to authenticated;

-- ---------------------------------------------------------------- posting

alter table public.community_posts add column if not exists like_count integer not null default 0;
alter table public.community_posts add column if not exists is_pinned boolean not null default false;

create table if not exists public.post_likes (
  post_id bigint not null references public.community_posts on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;

drop policy if exists post_likes_read on public.post_likes;
create policy post_likes_read on public.post_likes for select using (true);

drop policy if exists post_likes_add on public.post_likes;
create policy post_likes_add on public.post_likes for insert
  with check (user_id = auth.uid() and not public.is_guest());

drop policy if exists post_likes_remove on public.post_likes;
create policy post_likes_remove on public.post_likes for delete using (user_id = auth.uid());

create or replace function public.on_post_like_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.community_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_post_like_change on public.post_likes;
create trigger on_post_like_change after insert or delete on public.post_likes
  for each row execute function public.on_post_like_change();

/*
 * One announcement at a time. A Community saying five things at once is
 * saying nothing, so a new announcement retires the one before it. The old
 * ones are kept, not destroyed, and never reappear on the wall.
 */
create or replace function public.retire_old_announcements()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_announcement then
    update public.community_posts
       set is_removed = true
     where community_id = new.community_id
       and is_announcement
       and id <> new.id
       and not is_removed;
  end if;
  return null;
end;
$$;

drop trigger if exists retire_old_announcements on public.community_posts;
create trigger retire_old_announcements after insert on public.community_posts
  for each row execute function public.retire_old_announcements();

-- Pinning, from the post itself rather than from a box you tick beforehand.
create or replace function public.set_post_pinned(target bigint, pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare owner_community uuid;
begin
  select community_id into owner_community from public.community_posts where id = target;
  if owner_community is null then raise exception 'No such post.'; end if;

  if not public.community_can(owner_community, 'can_moderate_wall') then
    raise exception 'You cannot pin here.';
  end if;

  if pinned then
    update public.community_posts set is_pinned = false
     where community_id = owner_community and is_pinned and id <> target;
  end if;

  update public.community_posts set is_pinned = pinned where id = target;
end;
$$;

grant execute on function public.set_post_pinned to authenticated;

-- The wall lists pinned first, then newest, and carries the likes.
drop function if exists public.community_posts_list(uuid, boolean, integer);
create function public.community_posts_list(
  target uuid, announcements boolean default false, limit_count integer default 50
)
returns table (
  id bigint,
  community_id uuid,
  author_id uuid,
  title text,
  body text,
  media_url text,
  media_kind text,
  is_announcement boolean,
  is_pinned boolean,
  like_count integer,
  i_like boolean,
  created_at timestamptz,
  edited_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  author_is_guest boolean,
  author_is_verified boolean,
  author_content_id bigint,
  author_rank text,
  i_can_remove boolean,
  i_can_pin boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.community_id, p.author_id, p.title, p.body, p.media_url, p.media_kind,
         p.is_announcement, p.is_pinned, p.like_count,
         exists (select 1 from public.post_likes l
                  where l.post_id = p.id and l.user_id = auth.uid()),
         p.created_at, p.edited_at,
         a.username, a.display_name, a.avatar_url, a.is_guest,
         a.is_verified or a.is_admin, a.content_id,
         r.name,
         p.author_id = auth.uid()
           or public.community_can(p.community_id, 'can_moderate_wall')
           or (p.is_announcement and public.community_can(p.community_id, 'can_manage_community')),
         public.community_can(p.community_id, 'can_moderate_wall')
    from public.community_posts p
    join public.profiles a on a.id = p.author_id
    left join public.community_members m
      on m.community_id = p.community_id and m.user_id = p.author_id
    left join public.community_ranks r on r.id = m.rank_id
   where p.community_id = target
     and not p.is_removed
     and p.is_announcement = announcements
   order by p.is_pinned desc, p.created_at desc, p.id desc
   limit least(greatest(limit_count, 1), 100);
$$;

grant execute on function public.community_posts_list to anon, authenticated;

-- Affiliates carry their number, so a link from one Community to another is
-- the same numbered link as everywhere else rather than a name-only one.
drop function if exists public.community_relations_list(uuid, public.relation_kind, boolean);
create function public.community_relations_list(
  community uuid, want public.relation_kind, only_pending boolean default false
)
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  member_count integer,
  content_id bigint,
  accepted boolean,
  incoming boolean
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.icon_url, c.member_count, c.content_id, r.accepted, false
    from public.community_relations r
    join public.communities c on c.id = r.other_id
   where r.community_id = community and r.relation = want
     and r.accepted = (not only_pending)
     and c.is_public and not c.is_removed
  union all
  select c.id, c.slug, c.name, c.icon_url, c.member_count, c.content_id, r.accepted, true
    from public.community_relations r
    join public.communities c on c.id = r.community_id
   where r.other_id = community and r.relation = want
     and only_pending and not r.accepted
     and c.is_public and not c.is_removed;
$$;

grant execute on function public.community_relations_list to anon, authenticated;
