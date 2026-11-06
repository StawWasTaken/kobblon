begin;

/*
 * Inner Stock.
 *
 * Kobblon SAS is not a publicly traded company and this is not a share.
 * Staw's own words for what it is: people can put money into Kobblon, "its
 * like donating kind of, so they shouldnt expect to get something out of
 * it", and somebody holding Inner Stock who also has a Kobblon account can
 * receive Brix income depending on how the Inner Stock is doing.
 *
 * That sentence is the whole specification, and the part of it that this
 * table has to make impossible to get wrong is the middle: **nothing here
 * promises anybody a return.** So what is stored is one thing only - what
 * one Inner Stock is worth, as of a moment. No holders, no balances, no
 * payouts, no orders. A table with a `holders` column in it would be a
 * register of investors, and a register of investors is a thing with laws
 * around it that a page on a website is not the right place to keep.
 *
 * Written by hand. Staw: "dont make any system to add data into the
 * database i'll do it manually into supabase". So there is no insert
 * function, no staff screen and no grant that would let a client write one
 * - he writes a row in the SQL editor, which runs as the owner and is not
 * stopped by row level security. Anybody who could write this table from a
 * browser could move the number on the front of Kobblon.
 */

create table if not exists public.inner_stock (
  /*
   * The moment, and the key. One mark per moment: writing the same minute
   * twice is a correction rather than a second price, and `on conflict`
   * makes that an update instead of two rows the chart would draw as a
   * vertical line.
   */
  at timestamptz primary key default now(),
  /*
   * What one Inner Stock is worth at that moment, in euro cents.
   *
   * Cents rather than a float, for the same reason money is always stored
   * as a whole number of the smallest unit: 10.10 is not representable in
   * binary floating point, and a price that reads 10,09 € once a week is a
   * page nobody believes again.
   *
   * Euro, because Kobblon SAS is French and the contact form already says
   * so. There is no currency column on purpose - one would imply the
   * number might arrive in another one, and then every reader has to
   * handle a case that does not exist.
   */
  cents integer not null check (cents between 0 and 1000000000),
  /** Optional, shown beside the mark: "first mark", "after the launch". */
  note text check (char_length(btrim(note)) between 1 and 120)
);

create index if not exists inner_stock_by_time on public.inner_stock (at desc);

/*
 * Grants in the same file as the table. A policy decides which rows a role
 * may see and a grant decides whether it may touch the table at all, and
 * this project has shipped a carefully-protected unreachable table twice.
 *
 * Reading is open to everybody including signed-out visitors: the whole
 * point of the page is that the number is public. Nothing is granted
 * insert, update or delete - not even to `authenticated` - so the only way
 * a row arrives is Staw writing one.
 */
alter table public.inner_stock enable row level security;
grant select on public.inner_stock to anon, authenticated;

drop policy if exists inner_stock_readable on public.inner_stock;
create policy inner_stock_readable on public.inner_stock
  for select using (true);

/*
 * The first mark: 10,00 €, which is what Staw says one is worth right now.
 *
 * `on conflict do nothing` keyed on the moment, so re-running this file
 * never adds a second opening mark and never overwrites a real one he has
 * written since.
 */
insert into public.inner_stock (at, cents, note)
values ('2026-10-31T00:00:00Z', 1000, 'The first mark')
on conflict (at) do nothing;

commit;
