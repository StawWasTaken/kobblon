begin;

-- The economy, in one place, and a quest that is only a claim.
--
-- Staw: "in the staff console i want to turn the sale category into economy
-- page where we can regulate the brix in circulation, get stats with
-- graphics, evolution of the limited items, we can stil put promotions on
-- the whole catalog, we can also create quests that is a brix claim (no need
-- to do anything else)".
--
-- The console already has the two levers: `admin_move_brix` gives and takes
-- from one account, and `start_catalog_sale` discounts everything. What it
-- has never had is the *reading* - how much Brix exists, where it came from
-- this month, where it went, and what the limiteds are doing. A lever with
-- no gauge beside it is somebody guessing, which with a currency is how a
-- platform ends up with ten million Brix and nothing to spend them on.
--
-- Four reads here, all `require_admin()`, all `security definer` because
-- `pixel_transactions` is readable only by the person it belongs to and
-- that policy stays exactly as it is. None of them can write.

-- ------------------------------------------------- a quest that is a claim

-- A quest with nothing to do: accept it and claim the Brix.
--
-- Staw asked for it from the Economy page - "quests that is a brix claim (no
-- need to do anything else)" - and it does not fit any of the counted kinds,
-- because every one of them counts something. `by_hand` is the near miss and
-- is wrong: nothing credits it, so the quest would sit at zero for ever.
--
-- So `claim` is its own kind, and `quest_done` answers the goal the moment
-- somebody has started it. The row in `quest_progress` is still what makes
-- it claimable, and `claim_quest` still refuses a second claim, so "one
-- each" holds the same way it does for every other quest.
alter table public.quests
  drop constraint if exists quests_counted_check;

alter table public.quests
  add constraint quests_counted_check
  check (counted in ('world_time', 'friends_made', 'worlds_played', 'by_hand', 'claim'));

create or replace function public.quest_done(quest uuid, who uuid default auth.uid())
returns integer
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  q record;
  p record;
begin
  select * into q from public.quests where id = quest;
  if not found then return 0; end if;

  select * into p from public.quest_progress
   where quest_id = quest and user_id = who;
  if not found then return 0; end if;

  if q.counted = 'claim' then
    return q.goal;
  elsif q.counted = 'world_time' then
    return p.seconds;
  elsif q.counted = 'by_hand' then
    return p.by_hand;
  elsif q.counted = 'friends_made' then
    return greatest(0, (
      select count(*) from public.friendships f
       where f.status = 'accepted'
         and (f.requester_id = who or f.addressee_id = who)
    )::integer - p.baseline);
  elsif q.counted = 'worlds_played' then
    return greatest(0, (
      select count(distinct world_id) from public.world_visits where user_id = who
    )::integer - p.baseline);
  end if;

  return 0;
end;
$$;

-- --------------------------------------------------------- what there is

-- The state of the currency, now.
--
-- `in_circulation` is the sum of what people are holding, which is the only
-- honest answer: Brix are not minted into a treasury, they are written onto
-- an account, so what exists is what is held.
--
-- The thirty-day numbers come off the ledger and are deliberately separate
-- rather than netted: "two million in, one and a half million out" says
-- something that "half a million net" does not.
create or replace function public.economy_now()
returns table (
  in_circulation bigint,
  holders integer,
  richest integer,
  average integer,
  minted bigint,
  burned bigint,
  movements bigint,
  limiteds integer,
  resold bigint
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();

  return query
  select
    (select coalesce(sum(pixels), 0)::bigint from public.profiles),
    (select count(*)::integer from public.profiles where pixels > 0),
    (select coalesce(max(pixels), 0)::integer from public.profiles),
    (select coalesce(avg(pixels), 0)::integer from public.profiles),
    (select coalesce(sum(amount), 0)::bigint from public.pixel_transactions
      where amount > 0 and created_at > now() - interval '30 days'),
    (select coalesce(-sum(amount), 0)::bigint from public.pixel_transactions
      where amount < 0 and created_at > now() - interval '30 days'),
    (select count(*)::bigint from public.pixel_transactions
      where created_at > now() - interval '30 days'),
    (select count(*)::integer from public.avatar_items where sells_until is not null),
    (select coalesce(sum(price), 0)::bigint from public.avatar_resales
      where sold_at is not null and sold_at > now() - interval '30 days');
end;
$$;

-- A day a row, for the graph. Days with no movement are still rows, because
-- a line with a hole in it reads as a quiet week rather than as no data.
create or replace function public.economy_flow(days integer default 30)
returns table (day date, minted bigint, burned bigint, net bigint, held bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();

  return query
  with span as (
    select generate_series(
      (current_date - (greatest(1, least(days, 180)) - 1))::date,
      current_date,
      interval '1 day'
    )::date as day
  ),
  moved as (
    select created_at::date as day,
           sum(amount) filter (where amount > 0) as up,
           -sum(amount) filter (where amount < 0) as down
      from public.pixel_transactions
     where created_at >= current_date - (greatest(1, least(days, 180)) - 1)
     group by 1
  )
  select s.day,
         coalesce(m.up, 0)::bigint,
         coalesce(m.down, 0)::bigint,
         (coalesce(m.up, 0) - coalesce(m.down, 0))::bigint,
         -- What was held at the end of that day: today's total, with every
         -- movement since walked back off it.
         ((select coalesce(sum(pixels), 0) from public.profiles)
           - coalesce((select sum(amount) from public.pixel_transactions
                        where created_at::date > s.day), 0))::bigint
    from span s
    left join moved m on m.day = s.day
   order by s.day;
end;
$$;

-- Where it came from and where it went, by the ledger's own reason.
create or replace function public.economy_by_kind(days integer default 30)
returns table (kind text, came bigint, went bigint, movements bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();

  return query
  select t.kind,
         coalesce(sum(t.amount) filter (where t.amount > 0), 0)::bigint,
         coalesce(-sum(t.amount) filter (where t.amount < 0), 0)::bigint,
         count(*)::bigint
    from public.pixel_transactions t
   where t.created_at > now() - make_interval(days => greatest(1, least(days, 180)))
   group by t.kind
   order by 4 desc;
end;
$$;

-- What the limiteds are doing.
--
-- "Evolution of the limited items" is a price that moved, so each row
-- carries two averages: what it has gone for inside the window, and what it
-- went for before it. The difference between them is the whole point of the
-- row, and it is left as two numbers rather than a percentage because an
-- item with one sale either side should not be shown as "up 300%".
drop function if exists public.limited_market(integer);

create function public.limited_market(days integer default 30)
returns table (
  item_id uuid,
  content_id bigint,
  name text,
  price integer,
  sells_until timestamptz,
  closed boolean,
  sold_total integer,
  sold_window integer,
  average_window integer,
  average_before integer,
  cheapest integer,
  offers integer
)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  window_days integer := greatest(1, least(days, 180));
begin
  perform public.require_admin();

  return query
  select i.id,
         i.content_id,
         i.name,
         i.price,
         i.sells_until,
         i.sells_until <= now(),
         (select count(*)::integer from public.avatar_resales r
           where r.item_id = i.id and r.sold_at is not null),
         (select count(*)::integer from public.avatar_resales r
           where r.item_id = i.id and r.sold_at is not null
             and r.sold_at > now() - make_interval(days => window_days)),
         (select coalesce(avg(r.price), 0)::integer from public.avatar_resales r
           where r.item_id = i.id and r.sold_at is not null
             and r.sold_at > now() - make_interval(days => window_days)),
         (select coalesce(avg(r.price), 0)::integer from public.avatar_resales r
           where r.item_id = i.id and r.sold_at is not null
             and r.sold_at <= now() - make_interval(days => window_days)),
         (select min(r.price)::integer from public.avatar_resales r
           where r.item_id = i.id and r.sold_at is null),
         (select count(*)::integer from public.avatar_resales r
           where r.item_id = i.id and r.sold_at is null)
    from public.avatar_items i
   where i.sells_until is not null
   order by i.sells_until desc
   limit 60;
end;
$$;

revoke all on function public.economy_now() from public;
revoke all on function public.economy_flow(integer) from public;
revoke all on function public.economy_by_kind(integer) from public;
revoke all on function public.limited_market(integer) from public;

grant execute on function public.economy_now() to authenticated;
grant execute on function public.economy_flow(integer) to authenticated;
grant execute on function public.economy_by_kind(integer) to authenticated;
grant execute on function public.limited_market(integer) to authenticated;

commit;
