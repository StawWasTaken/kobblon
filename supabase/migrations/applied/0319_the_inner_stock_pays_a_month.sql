begin;

/*
 * The Inner Stock pays a month.
 *
 * Staw, 31 October: "make sure that every staff members actually do profit
 * off of the Inner Stock too, its basically their salary. every month they
 * receive an interest on the Inner Stock price and the % of what they get
 * depends on their status" - Kobblon and stawrer at 100%, superadmins 90%,
 * admins 70%, moderators 50%, and investors "who got a deal with staw" at
 * 100%. "stuff cannot be accumulated tho, so if you have a high status then
 * its the heighest status pay that gets sent to you". And: "of course if the
 * inner stock isnt profitable then your salary/profit wont be profitable
 * either.. and you can even lose brix if you are an investor because
 * kobblon will have to basically repay the deficit".
 *
 * So one month is one decision, and it is written here rather than in a
 * page:
 *
 *   * **The basis is the price**, in Brix. 100 Brix is a euro and the price
 *     is in euro cents, so the Brix figure *is* the cents figure - at 10,00
 *     € one full share is 1000 Brix, which is Staw's own sentence ("if the
 *     stock price is at 10€ then it will get 10€ in brix") and the reason
 *     there is no second rate constant anywhere near this file.
 *   * **A month that did not fall pays.** `round(close * share / 100)` onto
 *     every eligible account.
 *   * **A month that fell pays nobody.** Staff get nothing - that is the
 *     salary not being profitable. Investors are charged the fall,
 *     `round((open - close) * share / 100)`, and those Brix go to the
 *     Kobblon account, because Kobblon is the one repaying the deficit.
 *     Staff are never charged: Staw said investors can lose Brix and said
 *     staff lose their salary, which are two different sentences.
 *   * **Nothing accumulates.** One standing per account, the highest, so an
 *     investor who is also a moderator is paid 100% once and not 150%.
 *
 * And the part that is deliberately not built: **nothing pays itself.** A
 * superadmin presses the month in the console. There is no `pg_cron` on this
 * database yet (0224 and 0253 are still waiting on it), and a function that
 * claims to run monthly while nothing calls it is worse than a button -
 * every account would be told it had been paid by a schedule that does not
 * exist. The run is idempotent per month, so the button is safe to press
 * twice and the day there is a scheduler it calls this and nothing else
 * changes.
 */

-- -------------------------------------------------------------- the kinds

/*
 * Three reasons a Brix movement can now carry. Added to the list rather
 * than replacing it, `not valid` for the same reason 0264 gave: rows
 * written under an older rule are not this file's to re-judge.
 */
alter table public.pixel_transactions
  drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions
  add constraint pixel_transactions_kind_check check (kind = any (array[
    'signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
    'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning',
    'listing_fee', 'listing_refund', 'platform_fee', 'burn', 'code',
    'item_edit', 'gift_sent', 'gift_received', 'quest', 'quest_tag',
    -- A month the Inner Stock held or rose: the share onto the account.
    'stock_income',
    -- A month it fell: what an investor repaid, and what Kobblon took in.
    'stock_deficit', 'stock_repaid'
  ])) not valid;

-- ---------------------------------------------------------- the investors

/**
 * Who has a deal with Staw.
 *
 * Set by a superadmin in the console and given up by the person themself on
 * the Inner Stock page. A row is kept after somebody leaves rather than
 * deleted - `left_at` is how a page can say "you stopped on the 4th" and
 * how a month that already paid somebody still has a row to point at.
 *
 * It holds no amount and no stake. A column saying how much somebody put in
 * would make this a register of investors, which 0318 refused to build for
 * the same reason: that is a thing with laws around it and a website table
 * is not where it lives. What is here is one bit - this account is paid as
 * an investor - and the agreement itself is Staw's and off the platform.
 */
create table if not exists public.stock_investors (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  /** Staw's own line about the deal, for the console. Never shown publicly. */
  note text check (char_length(btrim(note)) between 1 and 200),
  /** When they stopped, and whose doing it was. Null while they are one. */
  left_at timestamptz,
  left_reason text check (left_reason in ('themself', 'staff'))
);

create index if not exists stock_investors_live
  on public.stock_investors (added_at desc) where left_at is null;

/**
 * A month that has been paid, and what the price did across it.
 *
 * The primary key is the month, which is what makes the run idempotent:
 * pressing the button twice is an `insert` that fails on the key rather
 * than a second month's salary.
 */
create table if not exists public.stock_months (
  /** The first day of the month, as a date. */
  month date primary key,
  /** The price in euro cents at the month's start, and at its close. */
  opened integer not null,
  closed integer not null,
  /** How many accounts were paid, and the Brix in each direction. */
  paid_accounts integer not null default 0,
  paid_brix bigint not null default 0,
  taken_brix bigint not null default 0,
  run_at timestamptz not null default now(),
  run_by uuid references public.profiles(id) on delete set null
);

/** One account's share of one month. Signed: negative is a deficit repaid. */
create table if not exists public.stock_payouts (
  month date not null references public.stock_months(month) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  /** What they were paid as: house, investor, superadmin, admin, moderator. */
  standing text not null,
  /** The percentage that standing carries, written down as it was on the day. */
  share integer not null,
  /** Brix. Positive onto the account, negative off it. */
  brix integer not null,
  primary key (month, user_id)
);

create index if not exists stock_payouts_for_person
  on public.stock_payouts (user_id, month desc);

/*
 * Grants in the same file as the tables, and a policy for each.
 *
 * This project has twice shipped a table with a careful policy and no grant,
 * which is a table nobody can reach. Reading:
 *
 *   * `stock_months` is open to everybody including signed-out visitors. It
 *     says what the price did and what the platform paid out in total, which
 *     is the same kind of fact as the price itself.
 *   * `stock_payouts` is yours, or a superadmin's. What one person earns is
 *     not the public's.
 *   * `stock_investors` is a superadmin's alone, and your own row. Who has a
 *     deal with Kobblon is nobody else's business.
 *
 * Nothing is granted insert, update or delete to anybody. Every write goes
 * through the functions below.
 */
alter table public.stock_investors enable row level security;
alter table public.stock_months enable row level security;
alter table public.stock_payouts enable row level security;

grant select on public.stock_months to anon, authenticated;
grant select on public.stock_payouts to authenticated;
grant select on public.stock_investors to authenticated;

drop policy if exists stock_months_readable on public.stock_months;
create policy stock_months_readable on public.stock_months
  for select using (true);

drop policy if exists stock_payouts_mine on public.stock_payouts;
create policy stock_payouts_mine on public.stock_payouts
  for select using (user_id = auth.uid() or public.is_superadmin());

drop policy if exists stock_investors_mine on public.stock_investors;
create policy stock_investors_mine on public.stock_investors
  for select using (user_id = auth.uid() or public.is_superadmin());

-- ------------------------------------------------------- what you are paid as

/**
 * One account's standing and the share it carries. The highest one, once.
 *
 * Written as a list of (standing, share, does this hold) with
 * `order by share desc limit 1` over it, rather than a chain of `case
 * when`, because the rule Staw gave is "the highest status pay" and that is
 * what this says out loud. A new standing is a row in the list.
 *
 * `is_house_account` rather than a username test: 0193's lesson is that
 * asking the table a question a function already answers is a second answer
 * that will disagree one day.
 */
create or replace function public.stock_standing(who uuid)
returns table (standing text, share integer)
language sql stable security definer
set search_path = public, extensions as $$
  select best.standing, best.share
    from public.profiles p
    cross join lateral (
      select v.standing, v.share
        from (values
          ('house'::text, 100, public.is_house_account(p.id)),
          ('investor', 100, exists (
            select 1 from public.stock_investors i
             where i.user_id = p.id and i.left_at is null)),
          ('superadmin', 90, p.is_superadmin),
          ('admin', 70, p.is_admin),
          ('moderator', 50, p.is_moderator)
        ) as v(standing, share, holds)
       where v.holds
       order by v.share desc, v.standing
       limit 1
    ) best
   where p.id = who
     and not coalesce(p.is_banned, false)
     and p.closed_at is null;
$$;

grant execute on function public.stock_standing(uuid) to authenticated;

/**
 * The price at a moment: the last mark written at or before it.
 *
 * Before the first mark there is no price, and the answer is the first mark
 * there is rather than nothing - a month that started before Kobblon wrote
 * its first mark opened at that mark, which is the only honest reading and
 * keeps the first month from paying against a null.
 */
create or replace function public.stock_price_at(moment timestamptz)
returns integer language sql stable
set search_path = public, extensions as $$
  select coalesce(
    (select cents from public.inner_stock where at <= moment order by at desc limit 1),
    (select cents from public.inner_stock order by at asc limit 1)
  );
$$;

grant execute on function public.stock_price_at(timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------- the month

/**
 * What a month would pay, per account, without writing anything.
 *
 * The console draws this before the button is pressed, and `pay_stock_month`
 * computes the same thing again inside its own transaction rather than
 * trusting this - a preview read a minute ago is exactly the value-captured
 * -before-the-thing-that-decides-it trap this project keeps falling into.
 */
create or replace function public.stock_payroll(month_start date default null)
returns table (
  user_id uuid, username text, display_name text,
  standing text, share integer, brix integer, held integer
)
language sql stable security definer
set search_path = public, extensions as $$
  with m as (
    select date_trunc('month',
             coalesce(month_start, current_date))::date as first
  ),
  span as (
    select m.first,
           public.stock_price_at(m.first::timestamptz) as opened,
           public.stock_price_at(
             least((m.first + interval '1 month')::timestamptz, now())) as closed
      from m
  )
  select p.id, p.username, p.display_name, s.standing, s.share,
         case
           when span.closed >= span.opened
             then round(span.closed * s.share / 100.0)::integer
           when s.standing = 'investor'
             then -least(
               round((span.opened - span.closed) * s.share / 100.0)::integer,
               greatest(p.pixels, 0))
           else 0
         end,
         p.pixels
    from public.profiles p
    cross join span
    cross join lateral public.stock_standing(p.id) s
   where (public.is_superadmin() or p.id = auth.uid())
   order by s.share desc, p.username;
$$;

grant execute on function public.stock_payroll(date) to authenticated;

/**
 * Pay a month. A superadmin presses it; it may only be pressed once.
 *
 * The whole month is one statement set in one transaction, so a run that
 * fails half way through has paid nobody. `insert into stock_months` goes
 * first on purpose: it is the lock. Two superadmins pressing the button in
 * the same second means one run and one unique-violation, rather than two
 * salaries.
 */
create or replace function public.pay_stock_month(month_start date default null)
returns public.stock_months
language plpgsql security definer
set search_path = public, extensions as $$
declare
  first date;
  opened integer;
  closed integer;
  house uuid;
  one record;
  amount integer;
  answer public.stock_months;
  count_paid integer := 0;
  sum_paid bigint := 0;
  sum_taken bigint := 0;
begin
  perform public.require_superadmin();

  first := date_trunc('month', coalesce(month_start, current_date))::date;

  if first > current_date then
    raise exception 'That month has not started.';
  end if;

  if exists (select 1 from public.stock_months where month = first) then
    raise exception 'That month has already been paid.';
  end if;

  opened := public.stock_price_at(first::timestamptz);
  closed := public.stock_price_at(
    least((first + interval '1 month')::timestamptz, now()));

  if opened is null or closed is null then
    raise exception 'There is no Inner Stock price to pay against yet.';
  end if;

  house := public.kobblon_account();

  insert into public.stock_months (month, opened, closed, run_by)
  values (first, opened, closed, auth.uid())
  returning * into answer;

  for one in
    select p.id, s.standing, s.share, p.pixels
      from public.profiles p
      cross join lateral public.stock_standing(p.id) s
     order by p.id
  loop
    if closed >= opened then
      amount := round(closed * one.share / 100.0)::integer;
    elsif one.standing = 'investor' then
      /*
       * The deficit, and never more than they hold. A balance cannot go
       * below nothing on this platform and an investor who spent their Brix
       * is not a debt the database carries - Kobblon takes what is there.
       */
      amount := -least(
        round((opened - closed) * one.share / 100.0)::integer,
        greatest(one.pixels, 0));
    else
      -- The stock fell and this is a salary. It is simply not profitable.
      amount := 0;
    end if;

    if amount = 0 then continue; end if;

    insert into public.stock_payouts (month, user_id, standing, share, brix)
    values (first, one.id, one.standing, one.share, amount);

    perform public.move_pixels(one.id, amount,
      case when amount > 0 then 'stock_income' else 'stock_deficit' end,
      'Inner Stock, ' || to_char(first, 'FMMonth YYYY'));

    /*
     * The other side of a deficit. Staw's words: Kobblon "will have to
     * basically repay the deficit", so the Brix an investor gives back are
     * Kobblon's and not burned - and they are moved rather than conjured,
     * which is what keeps the Economy panel's two columns honest.
     */
    if amount < 0 and house is not null and house <> one.id then
      perform public.move_pixels(house, -amount, 'stock_repaid',
        'Inner Stock deficit repaid, ' || to_char(first, 'FMMonth YYYY'));
    end if;

    count_paid := count_paid + 1;
    if amount > 0 then
      sum_paid := sum_paid + amount;
    else
      sum_taken := sum_taken - amount;
    end if;

    insert into public.notifications (user_id, kind, body)
    values (one.id, 'system',
      case when amount > 0
        then 'Inner Stock, ' || to_char(first, 'FMMonth YYYY') || ': '
             || amount || ' Brix at ' || one.share || '% of '
             || replace(to_char(closed / 100.0, 'FM999999990.00'), '.', ',') || ' €.'
        else 'Inner Stock, ' || to_char(first, 'FMMonth YYYY')
             || ': the price fell, and ' || (-amount)
             || ' Brix went back to Kobblon.'
      end);
  end loop;

  update public.stock_months
     set paid_accounts = count_paid, paid_brix = sum_paid, taken_brix = sum_taken
   where month = first
  returning * into answer;

  perform public.write_admin_log('stock_month', null, jsonb_build_object(
    'month', first, 'opened', opened, 'closed', closed,
    'accounts', count_paid, 'paid', sum_paid, 'taken', sum_taken));

  return answer;
end $$;

revoke all on function public.pay_stock_month(date) from public;
grant execute on function public.pay_stock_month(date) to authenticated;

-- ------------------------------------------------------- what somebody sees

/**
 * Your own standing, for the Inner Stock page.
 *
 * `can_leave` is the one bit the page needs that is not obvious: an investor
 * may stop, and a staff member may not, because a staff member's share is
 * their salary and it ends when the rank does. A page that drew the button
 * for everybody and was refused by the database would be a page that lies.
 */
create or replace function public.my_inner_stock()
returns table (
  standing text, share integer, can_leave boolean,
  months integer, earned bigint, repaid bigint,
  last_month date, last_brix integer, since timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select s.standing, s.share,
         s.standing = 'investor',
         (select count(*)::integer from public.stock_payouts o where o.user_id = auth.uid()),
         (select coalesce(sum(o.brix), 0) from public.stock_payouts o
           where o.user_id = auth.uid() and o.brix > 0),
         (select coalesce(-sum(o.brix), 0) from public.stock_payouts o
           where o.user_id = auth.uid() and o.brix < 0),
         (select o.month from public.stock_payouts o
           where o.user_id = auth.uid() order by o.month desc limit 1),
         (select o.brix from public.stock_payouts o
           where o.user_id = auth.uid() order by o.month desc limit 1),
         (select i.added_at from public.stock_investors i
           where i.user_id = auth.uid() and i.left_at is null)
    from public.stock_standing(auth.uid()) s;
$$;

grant execute on function public.my_inner_stock() to authenticated;

/**
 * Stop being an investor. Yours to do, and nobody else's.
 *
 * Staw: "if you are an investor then you can, through the inner stock page,
 * stop being one". A staff member cannot, and is told why rather than being
 * refused with a permission error - the share is a salary and it is the rank
 * that ends it.
 */
create or replace function public.leave_inner_stock()
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.stock_investors
     where user_id = auth.uid() and left_at is null
  ) then
    raise exception 'You are not an investor. A staff share ends with the rank, not from here.';
  end if;

  update public.stock_investors
     set left_at = now(), left_reason = 'themself'
   where user_id = auth.uid() and left_at is null;
end $$;

revoke all on function public.leave_inner_stock() from public;
grant execute on function public.leave_inner_stock() to authenticated;

-- ------------------------------------------------------------ the console

/** Who is an investor, who was one, and what they have been paid. */
create or replace function public.stock_investors_list(include_past boolean default true)
returns table (
  user_id uuid, username text, display_name text, is_staff boolean,
  note text, added_at timestamptz, added_by_name text,
  left_at timestamptz, left_reason text,
  earned bigint, months integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.user_id, p.username, p.display_name,
         (p.is_moderator or p.is_admin or p.is_superadmin),
         i.note, i.added_at,
         (select a.username from public.profiles a where a.id = i.added_by),
         i.left_at, i.left_reason,
         (select coalesce(sum(o.brix), 0) from public.stock_payouts o where o.user_id = i.user_id),
         (select count(*)::integer from public.stock_payouts o where o.user_id = i.user_id)
    from public.stock_investors i
    join public.profiles p on p.id = i.user_id
   where public.is_superadmin()
     and (include_past or i.left_at is null)
   order by (i.left_at is null) desc, i.added_at desc;
$$;

grant execute on function public.stock_investors_list(boolean) to authenticated;

/** Make somebody an investor, or stop them being one. A superadmin's. */
create or replace function public.set_stock_investor(
  target uuid, becomes boolean, why text default null
) returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare them record;
begin
  perform public.require_superadmin();

  select id, username into them from public.profiles where id = target;
  if them.id is null then raise exception 'No such account.'; end if;

  if becomes then
    insert into public.stock_investors (user_id, added_by, note)
    values (target, auth.uid(), nullif(btrim(coalesce(why, '')), ''))
    on conflict (user_id) do update
       set left_at = null, left_reason = null,
           added_at = now(), added_by = auth.uid(),
           note = coalesce(nullif(btrim(coalesce(why, '')), ''), stock_investors.note);

    insert into public.notifications (user_id, kind, body)
    values (target, 'system',
      'You are a Kobblon investor. Your Inner Stock share is on the Inner Stock page.');
  else
    update public.stock_investors
       set left_at = now(), left_reason = 'staff'
     where user_id = target and left_at is null;
  end if;

  perform public.write_admin_log('stock_investor', target,
    jsonb_build_object('investor', becomes,
                       'why', nullif(btrim(coalesce(why, '')), '')));

  return becomes;
end $$;

revoke all on function public.set_stock_investor(uuid, boolean, text) from public;
grant execute on function public.set_stock_investor(uuid, boolean, text) to authenticated;

/** Every month that has been paid, newest first. */
create or replace function public.stock_months_list(most integer default 24)
returns table (
  month date, opened integer, closed integer,
  paid_accounts integer, paid_brix bigint, taken_brix bigint,
  run_at timestamptz, run_by_name text
)
language sql stable security definer
set search_path = public, extensions as $$
  select m.month, m.opened, m.closed, m.paid_accounts, m.paid_brix, m.taken_brix,
         m.run_at,
         (select p.username from public.profiles p where p.id = m.run_by)
    from public.stock_months m
   order by m.month desc
   limit greatest(coalesce(most, 24), 1);
$$;

grant execute on function public.stock_months_list(integer) to anon, authenticated;

commit;
