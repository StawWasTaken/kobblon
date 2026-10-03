begin;

-- Two stons was not enough reach.
--
-- Staw, placing a pumpkin head: the nudge stopped at two stons in each
-- direction and he wanted five. The old bound came from "two covers the
-- whole body", which is true of a hat and wrong about everything that is
-- meant to float beside somebody - a halo, a pet, a sword held out, a prop
-- at arm's length.
--
-- Five is still a bound rather than no bound, because the reason the check
-- exists is unchanged: the server trusting whatever number a page sends is
-- how an accessory ends up a mile from its owner. Five stons is half a body
-- again past the fingertips, which is as far as a thing can be and still
-- read as worn.
--
-- **The slider moves with it in the same push.** A page offering a reach the
-- server refuses is a control that fails on save, which is worse than one
-- that stops where the rule stops.

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
    and (select bool_and(abs(v::numeric) <= 5)
           from jsonb_array_elements_text(fit->'p') as t(v))
    and (select bool_and(abs(v::numeric) <= 360)
           from jsonb_array_elements_text(fit->'r') as t(v))
    and (fit->>'s')::numeric between 0.1 and 4
  ), false);
$$;

commit;
