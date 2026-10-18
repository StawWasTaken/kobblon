begin;

/*
 * The quest tab.
 *
 * Brix has had nowhere to come from except buying, selling and the signup
 * grant. Staw asked for a reason to come back: a tab where Brix is earned,
 * holding three sorts of thing.
 *
 *   * **A quest from a World.** A verified creator asks for their World to
 *     be one - "Play WORLDNAME for 15 minutes - win 50 Brix" - and an admin
 *     or a superadmin decides.
 *   * **A quest Staw adds by hand.** Superadmin only, and arbitrary.
 *   * **The daily.** 30 Brix for a day you turned up, and it has to be
 *     claimed here. Showing up is not the thing; coming to look is.
 *
 * The honest part, and both sessions agreed the apps' version of it is the
 * better one: the Launcher gets an open session it heartbeats into and
 * nothing else. No duration in the message, no "I earned this", so there is
 * no field for anybody to lie in. Time in a World is therefore worked out
 * *here*, from the gap between two heartbeats, capped at the window a
 * heartbeat is good for - so a client that sends a hundred a second credits
 * itself nothing, and a client that sends none credits itself nothing
 * either.
 *
 * What a quest counts is a closed list, and every word in it is something
 * this database can already answer truthfully:
 *
 *   * `world_time`  - the heartbeat above.
 *   * `friends_made`, `worlds_played` - counted from `friendships` and
 *     `world_visits`, against a line drawn when the person started the
 *     quest. Without that line, everybody who has ever used Kobblon would
 *     complete "make three friends" the instant it appeared.
 *   * `by_hand`     - staff credit it, for the things nothing here can see.
 *
 * There is deliberately no `invite_friends`: nothing on this platform
 * records an invitation, so a quest for it would be a control implying
 * something the runtime does not do. When invitations exist, that word gets
 * added here and the tab needs no changes.
 */

-- ------------------------------------------------------------- the ledger

/*
 * Two words the ledger has to know before anything tries to write them.
 * `move_pixels` writes whatever word it is handed, so a reward paid under a
 * word the check does not know raises inside the function that was paying
 * it, long after every other test has passed.
 *
 * `daily` is already in the list and keeps its meaning.
 */
/*
 * The list is 0259's, with two words added. This first went out as 0231's
 * list plus the two, and 0231 is three widenings out of date: it has no
 * `gift_sent` or `gift_received`, which 0259 added and the live table has
 * rows of. Dropping a constraint and adding a narrower one does not fail
 * at the narrowing - it fails on `is violated by some row`, naming the
 * constraint and not the word, which is a long way from the mistake.
 *
 * So it is written as an addition to what is there rather than as a fresh
 * list, and `not valid` says the existing rows are not re-examined. They
 * were written under the rule of their own day and are not this migration's
 * to re-judge; every row written from here on is checked normally.
 */
alter table public.pixel_transactions
  drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions
  add constraint pixel_transactions_kind_check check (kind = any (array[
    'signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
    'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning',
    'listing_fee', 'listing_refund', 'platform_fee', 'burn', 'code',
    'item_edit', 'gift_sent', 'gift_received', 'quest', 'quest_tag'
  ])) not valid;

-- -------------------------------------------------------------- the quests

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),

  /** What the quest asks of you. A closed list; see the note above. */
  counted text not null default 'world_time'
    check (counted in ('world_time', 'friends_made', 'worlds_played', 'by_hand')),

  /** Set for a World quest, null for one Staw wrote. */
  world_id uuid references public.worlds on delete cascade,

  title text not null check (char_length(title) between 3 and 80),
  lead text check (char_length(lead) <= 200),

  /**
   * How much of the thing. Seconds for `world_time`, a plain count for the
   * rest, so one column covers both and no page has to guess which it is
   * looking at.
   */
  goal integer not null check (goal between 1 and 86400),
  reward integer not null check (reward between 1 and 5000),

  /**
   * Two tags. The first names where it came from and is written by the
   * database; the second is the creator's own, needs approving, and costs
   * 100 Brix.
   */
  world_tag text check (char_length(world_tag) <= 48),
  custom_tag text check (char_length(custom_tag) between 2 and 24),
  custom_tag_approved boolean not null default false,

  /** Official Kobblon accounts may give their own quests a picture. */
  background_url text,

  author_id uuid references public.profiles on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'live', 'refused', 'ended')),
  refusal text check (char_length(refusal) <= 300),
  decided_by uuid references public.profiles on delete set null,
  decided_at timestamptz,

  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),

  /* A World quest without a World, or a time quest without one, counts
   * nothing and would sit on the tab for ever. */
  constraint quests_world_time_has_a_world
    check (counted <> 'world_time' or world_id is not null)
);

create index if not exists quests_live_idx on public.quests (status, starts_at desc);
create index if not exists quests_world_idx on public.quests (world_id);
create index if not exists quests_author_idx on public.quests (author_id);

/*
 * What somebody has done about a quest.
 *
 * A row appears when they start it, and that is also the line the counted
 * kinds measure from. No row means no progress, which is why the heartbeat
 * below can credit cheaply: it only writes where somebody has said they are
 * doing this.
 */
create table if not exists public.quest_progress (
  quest_id uuid not null references public.quests on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  started_at timestamptz not null default now(),

  /** Seconds in the World, added up here and nowhere else. */
  seconds integer not null default 0 check (seconds >= 0),
  /** What staff have credited, for `by_hand`. */
  by_hand integer not null default 0 check (by_hand >= 0),
  /** Where the counting starts for the kinds read from other tables. */
  baseline integer not null default 0,

  claimed_at timestamptz,
  primary key (quest_id, user_id)
);

create index if not exists quest_progress_person_idx on public.quest_progress (user_id);

/** The daily. One row per person per day, and the row *is* the claim. */
create table if not exists public.daily_claims (
  user_id uuid not null references public.profiles on delete cascade,
  on_day date not null default current_date,
  amount integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, on_day)
);

/*
 * Grants in the same file as the tables. A policy decides which rows a role
 * may see; a grant decides whether the role may touch the table at all, and
 * a new table has none. This project has shipped a carefully-protected
 * unreachable table twice.
 *
 * Reading live quests is open - the tab is a public thing. Everything that
 * writes goes through the functions below, so nobody is granted insert or
 * update anywhere here: a client that could write `quest_progress` could
 * write itself a finished quest.
 */
alter table public.quests enable row level security;
alter table public.quest_progress enable row level security;
alter table public.daily_claims enable row level security;

grant select on public.quests to anon, authenticated;
grant select on public.quest_progress to authenticated;
grant select on public.daily_claims to authenticated;

drop policy if exists quests_readable on public.quests;
create policy quests_readable on public.quests
  for select using (
    status = 'live'
    or author_id = auth.uid()
    or public.is_moderator()
  );

drop policy if exists quest_progress_mine on public.quest_progress;
create policy quest_progress_mine on public.quest_progress
  for select using (user_id = auth.uid());

drop policy if exists daily_claims_mine on public.daily_claims;
create policy daily_claims_mine on public.daily_claims
  for select using (user_id = auth.uid());

-- ----------------------------------------------------------- what is done

/**
 * How far somebody is through a quest, in the same unit as its goal.
 *
 * One place, because the tab, the claim and any later badge all have to
 * agree, and three copies of this sum would eventually not.
 */
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

  if q.counted = 'world_time' then
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

/** The line the counted-from-elsewhere kinds measure against. */
create or replace function public.quest_baseline(counted text, who uuid)
returns integer
language sql stable security definer set search_path = public, extensions as $$
  select case counted
    when 'friends_made' then (
      select count(*)::integer from public.friendships f
       where f.status = 'accepted'
         and (f.requester_id = who or f.addressee_id = who))
    when 'worlds_played' then (
      select count(distinct world_id)::integer
        from public.world_visits where user_id = who)
    else 0
  end;
$$;

/**
 * Say you are doing a quest.
 *
 * Idempotent, because the page calls it on a button that can be pressed
 * twice and because re-starting would otherwise move the line and wipe out
 * the progress somebody already had.
 */
create or replace function public.start_quest(quest uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  q record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into q from public.quests where id = quest and status = 'live';
  if not found then raise exception 'That quest is not running.'; end if;
  if q.ends_at is not null and q.ends_at < now() then
    raise exception 'That quest is over.';
  end if;

  insert into public.quest_progress (quest_id, user_id, baseline)
  values (quest, me, public.quest_baseline(q.counted, me))
  on conflict (quest_id, user_id) do nothing;
end;
$$;

/**
 * The quests, with where you are in each.
 *
 * One call for the whole tab. `started` is what the button reads from, and
 * it is a timestamp rather than a boolean so the tab can say how long ago.
 */
/* `create or replace` cannot change a function's return type, so a later
 * column added to this list would fail to apply over an installation that
 * already has it. Dropped first, which costs the grant below and nothing
 * else. */
drop function if exists public.quest_board();
create or replace function public.quest_board()
returns table (
  id uuid, counted text, title text, lead text,
  goal integer, reward integer,
  world_tag text, custom_tag text, background_url text,
  world_id uuid, world_content_id bigint, world_slug text, world_name text, world_emblem text,
  author_name text, ends_at timestamptz,
  done integer, started timestamptz, claimed_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select q.id, q.counted, q.title, q.lead,
         q.goal, q.reward,
         q.world_tag,
         case when q.custom_tag_approved then q.custom_tag end,
         q.background_url,
         q.world_id, w.content_id, w.slug, w.name, coalesce(w.emblem_url, w.cover_url),
         a.display_name, q.ends_at,
         public.quest_done(q.id),
         p.started_at, p.claimed_at
    from public.quests q
    left join public.worlds w on w.id = q.world_id
    left join public.profiles a on a.id = q.author_id
    left join public.quest_progress p
           on p.quest_id = q.id and p.user_id = auth.uid()
   where q.status = 'live'
     and q.starts_at <= now()
     and (q.ends_at is null or q.ends_at > now())
     and (q.world_id is null or (w.is_published and not w.is_removed and w.archived_at is null))
   order by (p.claimed_at is not null), q.created_at desc;
$$;

-- -------------------------------------------------------------- the daily

/** Whether today's 30 Brix is still there to be had. */
create or replace function public.daily_waiting()
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select auth.uid() is not null
     and not exists (
       select 1 from public.daily_claims
        where user_id = auth.uid() and on_day = current_date
     );
$$;

/**
 * Claim it.
 *
 * The row is the claim and the primary key is the rule, so two presses in
 * the same second cannot both pay: the second insert finds the row and the
 * function refuses before any money moves.
 */
create or replace function public.claim_daily()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  amount constant integer := 30;
  got integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if coalesce((select is_suspended from public.profiles where id = me), false) then
    raise exception 'Suspended accounts cannot claim.';
  end if;

  insert into public.daily_claims (user_id, on_day, amount)
  values (me, current_date, amount)
  on conflict (user_id, on_day) do nothing;

  if not found then
    raise exception 'You have already claimed today.';
  end if;

  got := public.move_pixels(me, amount, 'daily', 'The daily claim');
  return got;
end;
$$;

-- ---------------------------------------------------------- claiming one

/**
 * Take the reward for a quest you have finished.
 *
 * The check is `quest_done` against the goal, read here rather than sent
 * here, and `claimed_at` is stamped by a conditional update so two presses
 * cannot both find it unclaimed.
 */
create or replace function public.claim_quest(quest uuid)
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  q record;
  moved integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into q from public.quests where id = quest and status = 'live';
  if not found then raise exception 'That quest is not running.'; end if;

  if coalesce((select is_suspended from public.profiles where id = me), false) then
    raise exception 'Suspended accounts cannot claim.';
  end if;

  if public.quest_done(quest, me) < q.goal then
    raise exception 'That one is not finished yet.';
  end if;

  update public.quest_progress
     set claimed_at = clock_timestamp()
   where quest_id = quest and user_id = me and claimed_at is null;

  if not found then
    raise exception 'You have already claimed that one.';
  end if;

  moved := public.move_pixels(me, q.reward, 'quest', q.title);
  return moved;
end;
$$;

-- ------------------------------------------------- a creator asks for one

/**
 * Ask for your World to be a quest.
 *
 * Verified creators only, and only for a World they own and have published -
 * a quest pointing at a draft is a quest nobody can do.
 *
 * The custom tag is the Brix sink Staw asked for: 100 Brix, charged here
 * through the ledger that already exists rather than a second path, and
 * charged whether or not the tag is later approved - it is paid for the
 * asking, which is what makes it a sink. The World's own tag is written by
 * the database from the World's name, so nobody can buy a tag by calling it
 * a World name.
 */
create or replace function public.request_world_quest(
  world uuid, minutes integer, reward integer, tag text default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  w record;
  made uuid;
  fee constant integer := 100;
  purse integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if not coalesce((select is_verified from public.profiles where id = me), false) then
    raise exception 'Quests from Worlds are for verified creators.';
  end if;

  select * into w from public.worlds
   where id = world and owner_id = me
     and is_published and not is_removed and archived_at is null;
  if not found then raise exception 'That is not a published World of yours.'; end if;

  if minutes is null or minutes < 1 or minutes > 240 then
    raise exception 'A quest asks for between one minute and four hours.';
  end if;
  if reward is null or reward < 1 or reward > 500 then
    raise exception 'A reward is between 1 and 500 Brix.';
  end if;

  if exists (
    select 1 from public.quests
     where world_id = world and status in ('pending', 'live')
  ) then
    raise exception 'That World already has a quest waiting or running.';
  end if;

  if tag is not null then
    if char_length(btrim(tag)) < 2 then
      raise exception 'A tag is at least two characters.';
    end if;
    select pixels into purse from public.profiles where id = me;
    if coalesce(purse, 0) < fee then
      raise exception 'A custom tag costs % Brix.', fee;
    end if;
  end if;

  insert into public.quests (
    counted, world_id, title, lead, goal, reward,
    world_tag, custom_tag, author_id, status
  ) values (
    'world_time', world,
    'Play ' || w.name || ' for ' || minutes || ' minute' || case when minutes = 1 then '' else 's' end,
    null,
    minutes * 60, reward,
    w.name, nullif(btrim(tag), ''), me, 'pending'
  ) returning id into made;

  if tag is not null then
    perform public.move_pixels(me, -fee, 'quest_tag', 'A custom quest tag');
  end if;

  return made;
end;
$$;

/** The ones a creator has asked for, with what became of them. */
create or replace function public.my_quest_requests()
returns table (
  id uuid, title text, goal integer, reward integer,
  world_tag text, custom_tag text, custom_tag_approved boolean,
  status text, refusal text, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select id, title, goal, reward, world_tag, custom_tag, custom_tag_approved,
         status, refusal, created_at
    from public.quests
   where author_id = auth.uid()
   order by created_at desc;
$$;

-- --------------------------------------------------------- staff decide

/** Waiting on somebody. Staff only; the policy already allows the read. */
create or replace function public.quests_waiting()
returns table (
  id uuid, title text, goal integer, reward integer,
  world_tag text, custom_tag text,
  world_id uuid, world_name text, author_name text, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select q.id, q.title, q.goal, q.reward, q.world_tag, q.custom_tag,
         q.world_id, w.name, a.username, q.created_at
    from public.quests q
    left join public.worlds w on w.id = q.world_id
    left join public.profiles a on a.id = q.author_id
   where q.status = 'pending'
     and public.is_admin()
   order by q.created_at;
$$;

/**
 * Approve or refuse one, and say what happened to the tag.
 *
 * The tag is decided separately from the quest, because "yes to the quest,
 * no to the tag you wanted to call it" is the common answer and a single
 * yes/no would force a refusal of the whole thing.
 */
create or replace function public.decide_quest(
  quest uuid, approve boolean, tag_too boolean default true, why text default null
)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  q record;
begin
  if not public.is_admin() then
    raise exception 'That is an admin''s to do.' using errcode = '42501';
  end if;

  select * into q from public.quests where id = quest;
  if not found then raise exception 'No such quest.'; end if;
  if q.status <> 'pending' then raise exception 'That one is already decided.'; end if;

  update public.quests
     set status = case when approve then 'live' else 'refused' end,
         custom_tag_approved = (approve and coalesce(tag_too, false) and custom_tag is not null),
         refusal = case when approve then null else nullif(btrim(why), '') end,
         decided_by = auth.uid(),
         decided_at = clock_timestamp()
   where id = quest;

  perform public.write_admin_log('quest_decided', q.author_id,
    jsonb_build_object('quest', quest, 'approved', approve, 'tag', tag_too));

  return case when approve then 'live' else 'refused' end;
end;
$$;

/**
 * A quest Staw writes himself. Superadmin only, and live the moment it is
 * made - there is nobody above him to approve it.
 *
 * `counted` is checked against the closed list by the table, so a word
 * nothing can answer cannot be smuggled in here.
 */
create or replace function public.add_quest(
  title text, counted text, goal integer, reward integer,
  lead text default null, tag text default null,
  background text default null, until timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  made uuid;
begin
  perform public.require_superadmin();

  if counted = 'world_time' then
    raise exception 'A quest about time in a World is requested against that World.';
  end if;

  insert into public.quests (
    counted, title, lead, goal, reward,
    world_tag, custom_tag, custom_tag_approved, background_url,
    author_id, status, ends_at, decided_by, decided_at
  ) values (
    counted, btrim(title), nullif(btrim(lead), ''), goal, reward,
    'Kobblon', nullif(btrim(tag), ''), tag is not null, nullif(btrim(background), ''),
    auth.uid(), 'live', until, auth.uid(), clock_timestamp()
  ) returning id into made;

  return made;
end;
$$;

/** Ending one without deleting what people did towards it. */
create or replace function public.end_quest(quest uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'That is an admin''s to do.' using errcode = '42501';
  end if;
  update public.quests set status = 'ended' where id = quest and status = 'live';
end;
$$;

/** Credit a `by_hand` quest for somebody. Admin only, and logged. */
create or replace function public.credit_quest(quest uuid, who uuid, amount integer)
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  now_at integer;
begin
  if not public.is_admin() then
    raise exception 'That is an admin''s to do.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.quests where id = quest and counted = 'by_hand') then
    raise exception 'That quest is not one credited by hand.';
  end if;

  insert into public.quest_progress (quest_id, user_id, by_hand)
  values (quest, who, greatest(0, amount))
  on conflict (quest_id, user_id)
    do update set by_hand = quest_progress.by_hand + greatest(0, amount)
  returning by_hand into now_at;

  perform public.write_admin_log('quest_credited', who,
    jsonb_build_object('quest', quest, 'by', amount));

  return now_at;
end;
$$;

-- ------------------------------------------- where the seconds come from

/**
 * The heartbeat, now also the only thing that counts time in a World.
 *
 * It was a one-line update. The gap between the stored `last_seen` and now
 * is how long the player has plainly been there since they last said so,
 * and it is capped at `stale_after()` - the window a claim is good for -
 * for two reasons at once. A player who was away for an hour and came back
 * gets the window, not the hour, because nothing here knows they were
 * playing in between. And a player sending a heartbeat every millisecond
 * gets the gap, which is a millisecond, so spamming it credits nothing: the
 * total can never run faster than real time.
 *
 * Progress is only written where a row already exists, so somebody who has
 * not started the quest is one `where` clause and no work.
 *
 * `last_seen` is read before it is written, in one statement, because
 * reading it afterwards would be reading the value this call just set - the
 * trap this project keeps falling into, in its plainest form.
 */
create or replace function public.still_in_world(server uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  world uuid;
  said_so timestamptz;
  gap integer;
begin
  if me is null then return; end if;

  /*
   * The old value, read and locked before anything writes it. `returning`
   * would hand back the value this call had just set, which is a gap of
   * nothing, every time, for ever - the plainest form of the trap.
   */
  select p.last_seen, s.world_id into said_so, world
    from public.world_players p
    join public.world_servers s on s.id = p.server_id
   where p.server_id = server and p.user_id = me
     for no key update of p;

  if not found then return; end if;

  update public.world_players
     set last_seen = clock_timestamp()
   where server_id = server and user_id = me;

  gap := floor(extract(epoch from
    least(clock_timestamp() - said_so, public.stale_after())))::integer;

  update public.quest_progress pr
     set seconds = least(q.goal, pr.seconds + greatest(0, gap))
    from public.quests q
   where q.id = pr.quest_id
     and pr.user_id = me
     and pr.claimed_at is null
     and q.counted = 'world_time'
     and q.status = 'live'
     and q.world_id = world
     and q.starts_at <= now()
     and (q.ends_at is null or q.ends_at > now());
end;
$$;

grant execute on function public.quest_done(uuid, uuid) to authenticated;
grant execute on function public.quest_baseline(text, uuid) to authenticated;
grant execute on function public.start_quest(uuid) to authenticated;
grant execute on function public.quest_board() to anon, authenticated;
grant execute on function public.daily_waiting() to authenticated;
grant execute on function public.claim_daily() to authenticated;
grant execute on function public.claim_quest(uuid) to authenticated;
grant execute on function public.request_world_quest(uuid, integer, integer, text) to authenticated;
grant execute on function public.my_quest_requests() to authenticated;
grant execute on function public.quests_waiting() to authenticated;
grant execute on function public.decide_quest(uuid, boolean, boolean, text) to authenticated;
grant execute on function public.add_quest(text, text, integer, integer, text, text, text, timestamptz) to authenticated;
grant execute on function public.end_quest(uuid) to authenticated;
grant execute on function public.credit_quest(uuid, uuid, integer) to authenticated;

commit;
