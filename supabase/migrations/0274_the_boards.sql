begin;

-- The boards: who is top of Kobblon, at each of the things it counts.
--
-- imCooki3 asked on the Discord for one of them - "i want a brix leaderboard
-- so we can see the richest player on kobblon. like most spent, most brix
-- currently, and brix networth (not account progress)" - and Staw asked for
-- the rest beside it: World visits, catalog sales, assets made, and Worlds by
-- likes, each with a switch between players and Communities.
--
-- One function for all of them, because seven boards written seven times is
-- seven places for the same rule to drift. Every board returns the same row,
-- whatever it is a board of: a thing with a name, a picture, a handle and a
-- number. A row is a player, a Community or a World, and it says which.
--
-- Where a side has no honest answer it returns nothing, and the page says
-- why rather than drawing an empty board:
--
--  * A World belongs to a person. Nothing in the schema lets a Community own
--    one, so the Communities side of the two World boards is empty until
--    that exists. Inventing it here - counting the Worlds of a Community's
--    members, say - would be a number nobody could check.
--  * `worth` on the Communities side is the same as `brix`, because a
--    Community has funds and owns no avatar items, so it is left out rather
--    than shown as a second copy of the first board.
--
-- What this makes public, said plainly because it cannot be taken back once
-- somebody has read it: `pixel_transactions` stays readable only by the
-- person it belongs to, and that policy does not change here. A total built
-- from it is still a new disclosure - "most spent" tells everybody roughly
-- how much the top accounts have put through the economy. It is a
-- leaderboard; that is what it is for. Fifty rows, so it is a podium rather
-- than a census, no movement or date or reason is ever exposed, and guests,
-- suspended accounts and accounts on their way out are left off entirely.

create or replace function public.leaderboard(
  board text default 'brix',
  side text default 'players'
)
returns table (
  place integer,
  kind text,
  subject_id uuid,
  content_id bigint,
  name text,
  handle text,
  image_url text,
  is_verified boolean,
  amount bigint
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if side not in ('players', 'communities') then
    raise exception 'no such side';
  end if;

  -- ------------------------------------------------------------- players
  if side = 'players' then
    return query
    with them as (
      select p.id, p.content_id, p.display_name, p.username, p.avatar_url, p.is_verified,
             case board
               when 'brix' then p.pixels::bigint
               when 'spent' then coalesce((select -sum(t.amount) from public.pixel_transactions t
                                            where t.user_id = p.id and t.amount < 0), 0)::bigint
               when 'worth' then (p.pixels + coalesce((select sum(i.price)
                                                         from public.avatar_owned o
                                                         join public.avatar_items i on i.id = o.item_id
                                                        where o.user_id = p.id), 0))::bigint
               when 'visits' then coalesce((select sum(w.visit_count) from public.worlds w
                                             where w.owner_id = p.id
                                               and w.is_published and not w.is_removed
                                               and w.archived_at is null), 0)::bigint
               when 'sales' then coalesce((select count(*) from public.avatar_owned o
                                             join public.avatar_items i on i.id = o.item_id
                                            where i.creator_id = p.id and i.community_id is null), 0)::bigint
               when 'assets' then coalesce((select count(*) from public.assets a
                                             where a.creator_id = p.id and a.community_id is null
                                               and a.is_public and a.status = 'approved'), 0)::bigint
               else 0::bigint
             end as amount
        from public.profiles p
       where not p.is_guest
         and not p.is_suspended
         and p.closed_at is null
         and board in ('brix', 'spent', 'worth', 'visits', 'sales', 'assets')
    )
    select (row_number() over (order by t.amount desc, t.username))::integer,
           'player', t.id, t.content_id, t.display_name, t.username,
           t.avatar_url, t.is_verified, t.amount
      from them t
     where t.amount > 0
     order by t.amount desc, t.username
     limit 50;

  -- --------------------------------------------------------- communities
  else
    return query
    with them as (
      select c.id, null::bigint as content_id, c.name, c.slug, c.icon_url, c.is_verified,
             case board
               when 'brix' then c.funds::bigint
               when 'spent' then coalesce((select -sum(t.amount) from public.community_transactions t
                                            where t.community_id = c.id and t.amount < 0), 0)::bigint
               when 'sales' then coalesce((select count(*) from public.avatar_owned o
                                             join public.avatar_items i on i.id = o.item_id
                                            where i.community_id = c.id), 0)::bigint
               when 'assets' then coalesce((select count(*) from public.assets a
                                             where a.community_id = c.id
                                               and a.is_public and a.status = 'approved'), 0)::bigint
               else 0::bigint
             end as amount
        from public.communities c
       where c.is_public and not c.is_removed and c.closed_at is null
         and board in ('brix', 'spent', 'sales', 'assets')
    )
    select (row_number() over (order by t.amount desc, t.slug))::integer,
           'community', t.id, t.content_id, t.name, t.slug,
           t.icon_url, t.is_verified, t.amount
      from them t
     where t.amount > 0
     order by t.amount desc, t.slug
     limit 50;
  end if;
end;
$$;

-- The two World boards are a board *of Worlds*, so they are their own read:
-- the row is a World with its cover and its owner's name on it, rather than
-- a person with a total.
create or replace function public.world_leaderboard(board text default 'likes')
returns table (
  place integer,
  world_id uuid,
  content_id bigint,
  slug text,
  name text,
  cover_url text,
  owner_name text,
  owner_username text,
  owner_verified boolean,
  amount bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with them as (
    select w.id, w.content_id, w.slug, w.name, coalesce(w.cover_url, w.emblem_url) as cover,
           p.display_name, p.username, coalesce(p.is_verified, false) as ticked,
           case when board = 'visits' then w.visit_count else w.like_count::bigint end as amount
      from public.worlds w
      left join public.profiles p on p.id = w.owner_id
     where w.is_published and not w.is_removed and w.archived_at is null
  )
  select (row_number() over (order by t.amount desc, t.name))::integer,
         t.id, t.content_id, t.slug, t.name, t.cover,
         t.display_name, t.username, t.ticked, t.amount
    from them t
   where t.amount > 0
   order by t.amount desc, t.name
   limit 50;
$$;

-- Where one account stands on each of the player boards.
--
-- It is the question the page is actually asked, and the fifty above will
-- not answer it for almost anybody. It is also what the profile shows: the
-- same totals, read for somebody else, which is why it takes a person
-- rather than always reading `auth.uid()`.
create or replace function public.person_places(who uuid default auth.uid())
returns table (board text, amount bigint, place integer, of_how_many integer)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  one text;
begin
  if who is null then return; end if;

  foreach one in array array['brix', 'spent', 'worth', 'visits', 'sales', 'assets'] loop
    return query
    with ranked as (
      select b.subject_id, b.amount,
             (row_number() over (order by b.amount desc))::integer as place
        from public.everybody_at(one) b
       where b.amount > 0
    )
    select one,
           coalesce((select r.amount from ranked r where r.subject_id = who), 0),
           (select r.place from ranked r where r.subject_id = who),
           (select count(*)::integer from ranked);
  end loop;
end;
$$;

-- Every player's number on one board, with no cut-off. `leaderboard` stops
-- at fifty, and a place is only a place if everybody below it was counted.
create or replace function public.everybody_at(board text)
returns table (subject_id uuid, amount bigint)
language sql stable security definer set search_path = public, extensions as $$
  select p.id,
         case board
           when 'brix' then p.pixels::bigint
           when 'spent' then coalesce((select -sum(t.amount) from public.pixel_transactions t
                                        where t.user_id = p.id and t.amount < 0), 0)::bigint
           when 'worth' then (p.pixels + coalesce((select sum(i.price)
                                                     from public.avatar_owned o
                                                     join public.avatar_items i on i.id = o.item_id
                                                    where o.user_id = p.id), 0))::bigint
           when 'visits' then coalesce((select sum(w.visit_count) from public.worlds w
                                         where w.owner_id = p.id
                                           and w.is_published and not w.is_removed
                                           and w.archived_at is null), 0)::bigint
           when 'sales' then coalesce((select count(*) from public.avatar_owned o
                                         join public.avatar_items i on i.id = o.item_id
                                        where i.creator_id = p.id and i.community_id is null), 0)::bigint
           when 'assets' then coalesce((select count(*) from public.assets a
                                         where a.creator_id = p.id and a.community_id is null
                                           and a.is_public and a.status = 'approved'), 0)::bigint
           else 0::bigint
         end
    from public.profiles p
   where not p.is_guest and not p.is_suspended and p.closed_at is null;
$$;

grant execute on function public.leaderboard(text, text) to authenticated, anon;
grant execute on function public.world_leaderboard(text) to authenticated, anon;
grant execute on function public.person_places(uuid) to authenticated, anon;
-- `everybody_at` is the inside of the two above and is not a page's to call:
-- it is every account's number on a board, with no limit on it.
revoke execute on function public.everybody_at(text) from authenticated, anon, public;

-- ------------------------------------- a quest board that says what is new

-- The board has never said when a quest appeared, so nothing reading it can
-- tell a quest that went up this morning from one that has been there a
-- fortnight. The blue dot on the Brix menu is exactly that question, so
-- `created_at` is added as a last column. Everything before it is unchanged
-- and in the same order, so anything already reading this keeps working.
drop function if exists public.quest_board();

create function public.quest_board()
returns table (
  id uuid,
  counted text,
  title text,
  lead text,
  goal integer,
  reward integer,
  world_tag text,
  custom_tag text,
  background_url text,
  world_id uuid,
  world_content_id bigint,
  world_slug text,
  world_name text,
  world_emblem text,
  author_name text,
  ends_at timestamptz,
  done integer,
  started timestamptz,
  claimed_at timestamptz,
  author_verified boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select q.id, q.counted, q.title, q.lead,
         q.goal, q.reward,
         q.world_tag,
         case when q.custom_tag_approved then q.custom_tag end,
         coalesce(q.background_url, w.cover_url),
         q.world_id, w.content_id, w.slug, w.name, coalesce(w.emblem_url, w.cover_url),
         coalesce(c.display_name, a.display_name),
         q.ends_at,
         public.quest_done(q.id),
         p.started_at, p.claimed_at,
         coalesce(c.is_verified, a.is_verified, false),
         q.created_at
    from public.quests q
    left join public.worlds w on w.id = q.world_id
    left join public.profiles c on c.id = w.owner_id
    left join public.profiles a on a.id = q.author_id
    left join public.quest_progress p
           on p.quest_id = q.id and p.user_id = auth.uid()
   where q.status = 'live'
     and q.starts_at <= now()
     and (q.ends_at is null or q.ends_at > now())
     and (q.world_id is null or (w.is_published and not w.is_removed and w.archived_at is null))
   order by (p.claimed_at is not null), q.created_at desc;
$$;

grant execute on function public.quest_board() to authenticated;

commit;
