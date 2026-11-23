begin;

/*
 * Klub Kobblon, as a thing somebody can actually get.
 *
 * 0235 built what a membership **is** - the tier on `profiles`, `klub_of`,
 * `in_the_klub` - and said plainly that there was no way to buy one. This
 * is that way, and the two offers Staw wants the launch to carry.
 *
 * What is here:
 *
 *   `klub_plans`   what a length of Klub costs, in Brix and in cents. Rows,
 *                  not constants in a function, because a price changes and
 *                  a price that changes by migration is a price nobody ever
 *                  changes.
 *   `klub_offers`  the two free windows, by date, for the same reason.
 *   `klub_events`  what happened to one account's membership and why. The
 *                  table 0235 said would exist the day there was a payment.
 *   `buy_klub`     paying for one, in Brix.
 *   `claim_klub_offer`  taking a free one, if the window is open and this
 *                  account has not had it.
 *   `my_klub`      everything a page needs to draw itself, in one call.
 *
 * What is deliberately **not** here: cards. There is no card processor
 * connected, so nothing in this file pretends to take one. The page says
 * cards are paused and offers Brix, which is a thing the platform can
 * genuinely do today.
 *
 * Money and the third trap: every one of these functions writes to
 * `profiles`, and `guard_profile_update` pins what an ordinary person may
 * not set. Until this migration it did **not** pin `membership`, which
 * means anybody could have given themselves Klub with one update against
 * their own row. So the guard learns the Klub columns here, and these
 * functions raise `kobbleston.klub` around their writes the way
 * `move_pixels` raises `kobbleston.money`.
 */

/* ----------------------------------------------------------- the columns */

alter table public.profiles
  /* A trial is a membership with a date on it that nobody paid for. The
     tier cannot say so - a trial of Klub is Klub while it runs - and the
     page has to be able to say "your free year" rather than "your
     subscription". */
  add column if not exists klub_is_trial boolean not null default false;

/* ------------------------------------------------------------- the plans */

create table if not exists public.klub_plans (
  code       text primary key,
  months     integer not null check (months > 0),
  /* What it costs in Brix. The canonical price: Brix is the thing the
     platform can actually take today. */
  brix       integer not null check (brix >= 0),
  /* What it would cost in cents of euro, for the day cards are unpaused.
     A hundred Brix to the euro, which is Staw's own example: ten euros a
     month is a thousand Brix a month. */
  cents      integer not null check (cents >= 0),
  label      text not null,
  /* Written on the one that should catch the eye. Null on the rest. */
  flag       text,
  sort       integer not null default 0,
  is_offered boolean not null default true
);

grant select on public.klub_plans to anon, authenticated;
alter table public.klub_plans enable row level security;
drop policy if exists klub_plans_are_public on public.klub_plans;
create policy klub_plans_are_public on public.klub_plans
  for select using (true);

/*
 * The prices, and the thing that makes a longer one worth taking: every
 * step down the list is cheaper by the month than the step above it.
 *
 *   3 months   500 Brix a month
 *   6 months   467
 *   1 year     417
 *   2 years    375
 *
 * `on conflict do update` rather than `do nothing`: a second apply of this
 * file should leave the prices as the file says, not as whatever is in the
 * table.
 */
insert into public.klub_plans (code, months, brix, cents, label, flag, sort)
values
  ('3m',  3,  1500, 1499, 'Three months', null,          1),
  ('6m',  6,  2800, 2799, 'Six months',   null,          2),
  ('1y',  12, 5000, 4999, 'One year',     'Best liked',  3),
  ('2y',  24, 9000, 8999, 'Two years',    'Cheapest by the month', 4)
on conflict (code) do update
  set months = excluded.months, brix = excluded.brix, cents = excluded.cents,
      label = excluded.label, flag = excluded.flag, sort = excluded.sort;

/* ------------------------------------------------------------ the offers */

create table if not exists public.klub_offers (
  code     text primary key,
  months   integer not null check (months > 0),
  opens    timestamptz not null,
  closes   timestamptz not null,
  /*
   * 'fresh'   for somebody with no membership running. The launch year.
   * 'running' for somebody who already has one. The festive three months,
   *           which Staw asked to add to whatever is left rather than
   *           replace it - "then it adds to how much of ur subscription is
   *           left, but if you have a free trial ... then it also adds up".
   */
  wants    text not null check (wants in ('fresh', 'running')),
  /* A trial of a year is a trial. Three months bolted onto a subscription
     somebody is paying for does not turn it into a trial, so this says
     which, rather than every reader guessing from the months. */
  as_trial boolean not null default false,
  title    text not null,
  says     text not null
);

grant select on public.klub_offers to anon, authenticated;
alter table public.klub_offers enable row level security;
drop policy if exists klub_offers_are_public on public.klub_offers;
create policy klub_offers_are_public on public.klub_offers
  for select using (true);

insert into public.klub_offers (code, months, opens, closes, wants, as_trial, title, says)
values
  ('launch', 12,
   timestamptz '2026-11-23 00:00:00+00', timestamptz '2027-01-01 00:00:00+00',
   'fresh', true,
   'A free year, for turning up early',
   'Everybody who opens this page before the first of January 2027 gets a year of Klub Kobblon, free. No card, nothing to cancel.'),
  ('festive', 3,
   timestamptz '2026-12-25 00:00:00+00', timestamptz '2027-01-06 00:00:00+00',
   'running', false,
   'Three months on the house',
   'Between Christmas Day and the fifth of January, anybody whose Klub is already running gets three months added to the end of it. Paid or free, it adds to what you have left.')
on conflict (code) do update
  set months = excluded.months, opens = excluded.opens, closes = excluded.closes,
      wants = excluded.wants, as_trial = excluded.as_trial,
      title = excluded.title, says = excluded.says;

/* ------------------------------------------------------------ the ledger */

create table if not exists public.klub_events (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.profiles(id) on delete cascade,
  kind     text not null check (kind in ('offer', 'purchase', 'admin')),
  /* Which offer or which plan. Null for a tier set by hand. */
  code     text,
  months   integer not null default 0,
  brix     integer not null default 0,
  /* Where the membership ran to once this was applied, so the ledger can
     be read without replaying it. */
  until    timestamptz,
  at       timestamptz not null default now()
);

create index if not exists klub_events_for_one_person
  on public.klub_events (user_id, at desc);

/* An offer is once per account, and this is what makes that true rather
   than a check somebody has to remember to write. */
create unique index if not exists klub_events_one_offer_each
  on public.klub_events (user_id, code) where kind = 'offer';

grant select on public.klub_events to authenticated;
alter table public.klub_events enable row level security;
drop policy if exists klub_events_are_mine on public.klub_events;
create policy klub_events_are_mine on public.klub_events
  for select using (user_id = auth.uid() or public.is_admin());

/* Paying for Klub is a movement of Brix like any other, and the list of
   kinds is a check constraint rather than an enum, so this is one file. */
alter table public.pixel_transactions
  drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions
  add constraint pixel_transactions_kind_check check (kind = any (array[
    'signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
    'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning',
    'listing_fee', 'listing_refund', 'platform_fee', 'burn', 'code',
    'item_edit', 'gift_sent', 'gift_received', 'quest', 'quest_tag',
    'stock_income', 'stock_deficit', 'stock_repaid',
    -- Klub Kobblon, bought.
    'klub'
  ])) not valid;

/* ------------------------------------------------------- the one writer */

/**
 * Adding time to somebody's Klub.
 *
 * The only thing in this schema that moves `klub_until`, so the rule about
 * adding to what is left rather than replacing it is written once.
 *
 * It extends from whichever is later: now, or where the membership runs to.
 * A membership that lapsed three months ago starts again from today; one
 * with two months left gets the new time on the end of those two months.
 * `life` is untouched - a membership for life with a date on it is two
 * things disagreeing.
 *
 * Not callable from the outside: every door into it checks something
 * first.
 */
create or replace function public.klub_add_months(
  target uuid, how_many integer, trial boolean
)
returns timestamptz
language plpgsql security definer
set search_path = public, extensions as $$
declare
  now_tier text;
  runs_to  timestamptz;
begin
  select public.klub_of(target) into now_tier;
  if now_tier = 'life' then
    return null;
  end if;

  /* Later of the two: a membership that lapsed starts again from today,
     one with time left gets this on the end of what is left. */
  select greatest(now(), coalesce(p.klub_until, now()))
    into runs_to
    from public.profiles p
   where p.id = target;

  if runs_to is null then
    raise exception 'There is no account with that number.';
  end if;

  runs_to := runs_to + make_interval(months => how_many);

  /*
   * The guard over `profiles` asks `auth.uid()` who is doing this, and
   * `auth.uid()` is whoever called the RPC - `security definer` changes
   * what a function may do, not who it reports as. Without this flag the
   * guard below pins every column back and the membership silently does
   * not move.
   */
  perform set_config('kobbleston.klub', 'on', true);

  update public.profiles
     set membership   = case when membership in ('none', 'lite') then 'klub' else membership end,
         klub_until    = runs_to,
         klub_since    = coalesce(klub_since, now()),
         /* True sets it, false clears it, and null leaves it alone: the
            festive three months are neither a trial nor a purchase, so
            bolting them onto a free year must not turn that year into a
            subscription, nor a subscription into a trial. */
         klub_is_trial = coalesce(trial, klub_is_trial)
   where id = target;

  perform set_config('kobbleston.klub', 'off', true);

  return runs_to;
end $$;

revoke all on function public.klub_add_months(uuid, integer, boolean) from public, anon, authenticated;

/* ---------------------------------------------------------- the offers */

/**
 * Taking a free offer.
 *
 * Everything that decides is read here, at the moment it is asked, and
 * none of it comes from the page: the window, whether this account already
 * had this offer, and whether it is the kind of account the offer is for.
 * The page calls this when somebody opens it, which is what "everybody who
 * turns up gets it" means.
 *
 * Returns a word rather than raising, because none of the refusals are
 * errors - a visitor who already has their year is not a fault, and a page
 * that shows a red box to somebody for turning up twice is worse than one
 * that says nothing.
 *
 *   'given'   it has just been applied.
 *   'had'     this account has already had it.
 *   'shut'    the window is not open.
 *   'wrong'   the offer is not for an account in this state.
 *   'gone'    there is no offer by that name.
 */
create or replace function public.claim_klub_offer(which text)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me    uuid := auth.uid();
  offer public.klub_offers%rowtype;
  tier  text;
  ends  timestamptz;
begin
  if me is null then return 'wrong'; end if;

  select * into offer from public.klub_offers where code = which;
  if offer.code is null then return 'gone'; end if;

  if now() < offer.opens or now() >= offer.closes then return 'shut'; end if;

  if exists (
    select 1 from public.klub_events e
     where e.user_id = me and e.kind = 'offer' and e.code = offer.code
  ) then
    return 'had';
  end if;

  /* A suspended or closed account is not handed anything. */
  if exists (
    select 1 from public.profiles p
     where p.id = me and (p.is_banned or p.is_suspended or p.closed_at is not null or p.is_guest)
  ) then
    return 'wrong';
  end if;

  tier := public.klub_of(me);

  if offer.wants = 'fresh' and tier <> 'none' then return 'wrong'; end if;
  if offer.wants = 'running' and tier in ('none', 'life') then return 'wrong'; end if;

  ends := public.klub_add_months(
    me, offer.months, case when offer.as_trial then true end);

  insert into public.klub_events (user_id, kind, code, months, until)
  values (me, 'offer', offer.code, offer.months, ends);

  insert into public.notifications (user_id, kind, body)
  values (me, 'system',
          case when offer.wants = 'fresh'
            then 'You are in Klub Kobblon until '
                 || to_char(ends, 'DD Mon YYYY') || ', on the house.'
            else 'Three months of Klub Kobblon added. Yours runs to '
                 || to_char(ends, 'DD Mon YYYY') || '.'
          end);

  return 'given';
end $$;

grant execute on function public.claim_klub_offer(text) to authenticated;

/* ---------------------------------------------------------- the paying */

/**
 * Buying Klub with Brix.
 *
 * The price is read from the table, never from the page - the whole reason
 * the plans are a table a visitor may only select from. A page that sent
 * its own number would be a page that sets its own price.
 */
create or replace function public.buy_klub(plan text)
returns timestamptz
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me   uuid := auth.uid();
  one  public.klub_plans%rowtype;
  have integer;
  ends timestamptz;
begin
  if me is null then
    raise exception 'Log in first.';
  end if;

  select * into one from public.klub_plans where code = plan and is_offered;
  if one.code is null then
    raise exception 'There is no plan by that name.';
  end if;

  if exists (
    select 1 from public.profiles p
     where p.id = me and (p.is_banned or p.is_suspended or p.closed_at is not null or p.is_guest)
  ) then
    raise exception 'This account cannot buy Klub right now.';
  end if;

  if public.klub_of(me) = 'life' then
    raise exception 'You have Klub for life. There is nothing to buy.';
  end if;

  select pixels into have from public.profiles where id = me;
  if have < one.brix then
    raise exception 'That is % Brix and you have %.', one.brix, have;
  end if;

  perform public.move_pixels(me, -one.brix, 'klub',
    'Klub Kobblon, ' || one.label);

  ends := public.klub_add_months(me, one.months, false);

  insert into public.klub_events (user_id, kind, code, months, brix, until)
  values (me, 'purchase', one.code, one.months, one.brix, ends);

  return ends;
end $$;

grant execute on function public.buy_klub(text) to authenticated;

/* ------------------------------------------------------- what a page asks */

/**
 * Everything the Klub page needs about whoever is reading it.
 *
 * One call rather than five, and every answer worked out here: whether an
 * offer is open **to this person** is not something a page can decide, and
 * a page that decides it is a page that shows a free year to somebody who
 * cannot have one.
 */
create or replace function public.my_klub()
returns table (
  tier     text,
  until    timestamptz,
  is_trial boolean,
  since    timestamptz,
  brix     integer,
  /* The offers this account could take right now, by code. */
  offers   text[]
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    public.klub_of(auth.uid()),
    case when public.klub_of(auth.uid()) = 'life' then null else p.klub_until end,
    coalesce(p.klub_is_trial, false),
    p.klub_since,
    p.pixels,
    coalesce((
      select array_agg(o.code order by o.opens)
        from public.klub_offers o
       where now() >= o.opens and now() < o.closes
         and not exists (
           select 1 from public.klub_events e
            where e.user_id = p.id and e.kind = 'offer' and e.code = o.code)
         and case o.wants
               when 'fresh'   then public.klub_of(p.id) = 'none'
               else public.klub_of(p.id) not in ('none', 'life')
             end
    ), '{}'::text[])
  from public.profiles p
 where p.id = auth.uid()
$$;

grant execute on function public.my_klub() to authenticated;

/* ------------------------------------------------- the guard learns these */

/**
 * `guard_profile_update`, with the Klub columns pinned.
 *
 * The rest of this is 0350 unchanged. What is new is at the foot: a
 * membership, when it runs out, when it started and whether it was paid for
 * are not things an account may set about itself. They were, until this
 * migration - `profiles` is updatable by its owner and nothing pinned
 * `membership`, so one update against your own row was a free Klub Life.
 *
 * `kobbleston.klub` is raised by `klub_add_months` and nothing else;
 * `set_klub` from 0235 goes through the admin branch above.
 */
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if lower(coalesce(new.username, '')) in ('stawrer', 'kobblon', 'kobbleston') then
    new.is_superadmin := true;
    new.is_admin      := true;
    new.is_moderator  := true;
  end if;

  if auth.uid() is null then return new; end if;

  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.standing', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.community', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.appearance', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.numbering', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.klub', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then
    if new.id = auth.uid() then
      new.is_superadmin := old.is_superadmin;
      new.is_admin      := old.is_admin;
      new.is_moderator  := old.is_moderator;
    end if;
    return new;
  end if;

  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;
  new.is_banned     := old.is_banned;

  new.suspended_until := old.suspended_until;

  new.closed_at     := old.closed_at;
  new.closed_by     := old.closed_by;
  new.closed_reason := old.closed_reason;
  new.erase_after   := old.erase_after;

  new.former_username     := old.former_username;
  new.former_display_name := old.former_display_name;
  new.former_avatar_url   := old.former_avatar_url;
  new.former_bio          := old.former_bio;

  if old.is_banned or old.closed_at is not null then
    new.display_name := old.display_name;
    new.avatar_url   := old.avatar_url;
    new.bio          := old.bio;
  end if;

  new.pixels := old.pixels;

  new.content_id        := old.content_id;
  new.legacy_content_id := old.legacy_content_id;
  new.created_at        := old.created_at;

  new.has_email         := old.has_email;
  new.must_set_password := old.must_set_password;

  new.primary_community := old.primary_community;

  new.appearance := old.appearance;

  new.membership    := old.membership;
  new.klub_until    := old.klub_until;
  new.klub_since    := old.klub_since;
  new.klub_is_trial := old.klub_is_trial;

  return new;
end;
$$;

commit;
