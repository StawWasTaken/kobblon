begin;

-- Five stons was not enough reach either, and hair is why.
--
-- Staw: "make that we can make the hair go lower (in stons) and larger range
-- when setting up hair basically". A haircut is placed by pulling it down
-- over the head, and five stons each way was written for an accessory that
-- is nudged rather than one that is fitted.
--
-- Ten, and the resize goes to six. Still a bound and for the same reason as
-- ever - the server trusting whatever number a page sends is how an
-- accessory ends up a mile from its owner - but ten stons is roughly a whole
-- body, which is as far as a thing can be and still read as worn.
--
-- The slider moves with it in the same push, as it did at five: a page
-- offering a reach the server refuses is a control that fails on save.

create or replace function public.sane_fit(fit jsonb)
returns boolean
language sql immutable
set search_path = public, extensions as $$
  -- `coalesce(..., false)` because `jsonb_typeof` of a missing key is null,
  -- not a mismatch, and `if not null` is not true - so without it an object
  -- with no `p` at all sails through a guard that looks like it checks
  -- everything. A guard that answers "I don't know" answers yes.
  select coalesce(fit is null or (
    jsonb_typeof(fit) = 'object'
    and jsonb_typeof(fit->'p') = 'array' and jsonb_array_length(fit->'p') = 3
    and jsonb_typeof(fit->'r') = 'array' and jsonb_array_length(fit->'r') = 3
    and jsonb_typeof(fit->'s') = 'number'
    and (select bool_and(abs(v::numeric) <= 10)
           from jsonb_array_elements_text(fit->'p') as t(v))
    and (select bool_and(abs(v::numeric) <= 360)
           from jsonb_array_elements_text(fit->'r') as t(v))
    and (fit->>'s')::numeric between 0.1 and 6
  ), false);
$$;

commit;
