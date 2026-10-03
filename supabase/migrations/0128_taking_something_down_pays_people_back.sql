begin;

-- What somebody actually paid, kept on the row.
--
-- A refund of "40% of the original price" needs the original price, and the
-- item's current price is not it: a maker can change what something sells
-- for, and refunding against today's number would pay the wrong amount to
-- everybody who bought it before the change. So the price goes on the row at
-- the moment of the sale.
--
-- Rows bought before this column existed have null, and the refund falls
-- back to the item's price for those. Said out loud rather than backfilled
-- with a guess: for those rows the two numbers are the best information
-- there is.

alter table public.avatar_owned
  add column if not exists paid integer;

comment on column public.avatar_owned.paid is
  'What this person actually paid, in Brix, at the moment they bought it. '
  'Null for rows from before the column existed.';

commit;
