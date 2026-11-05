begin;

-- Where an accessory actually sits, as the maker placed it.
--
-- `fitToSocket` puts a model the right size and in the right place for a
-- model that is roughly the shape of the thing it is: it measures the model,
-- centres it on the socket and rests it against the part. That is the right
-- default and it is not always right - a hat modelled with a brim hanging
-- off one side, a pair of horns meant to sit forward, a fringe that should
-- overlap the face. Only the person who made it knows.
--
-- So an item carries an adjustment: a nudge, a turn and a resize, applied
-- **after** the automatic fit rather than instead of it. That ordering is
-- the whole design. Replacing the fit would mean every maker has to work out
-- where a socket is in stons; adjusting it means the numbers are small, they
-- are all zero by default, and an item that is never touched looks exactly
-- as it does today.
--
--   {"p": [x, y, z], "r": [x, y, z], "s": 1}
--
-- `p` in stons, `r` in degrees, `s` a multiplier on the fitted size. Null
-- means untouched, which is not the same as all zeroes and is worth keeping
-- apart: it says nobody has had an opinion yet.

alter table public.avatar_items
  add column if not exists fit jsonb;

comment on column public.avatar_items.fit is
  'How the maker placed it, applied after the automatic fit: '
  '{"p":[x,y,z] in stons, "r":[x,y,z] in degrees, "s": multiplier}. '
  'Null means untouched.';

/**
 * Checks an adjustment is the shape it claims to be, and within reason.
 *
 * The limits are not arbitrary and they are not security - the server
 * trusting a number a page sent is how an accessory ends up a mile from the
 * body or the size of a world. Two stons in any direction covers the whole
 * body; a tenth to four times the fitted size covers a brooch and a cape.
 */
create or replace function public.sane_fit(fit jsonb)
returns boolean
language sql immutable
set search_path = public, extensions as $$
  -- `coalesce(..., false)`, and that is not belt and braces.
  --
  -- `jsonb_typeof(fit->'p')` on an object with no `p` is **null**, not a
  -- mismatch, so the whole conjunction came out null - and `if not null`
  -- is not true, so `{"nonsense": true}` sailed through a guard that looks
  -- like it checks everything. A guard that answers "I don't know" is a
  -- guard that answers yes.
  select coalesce(fit is null or (
    jsonb_typeof(fit) = 'object'
    and jsonb_typeof(fit->'p') = 'array' and jsonb_array_length(fit->'p') = 3
    and jsonb_typeof(fit->'r') = 'array' and jsonb_array_length(fit->'r') = 3
    and jsonb_typeof(fit->'s') = 'number'
    and (select bool_and(abs(v::numeric) <= 2)
           from jsonb_array_elements_text(fit->'p') as t(v))
    and (select bool_and(abs(v::numeric) <= 360)
           from jsonb_array_elements_text(fit->'r') as t(v))
    and (fit->>'s')::numeric between 0.1 and 4
  ), false);
$$;

/**
 * Places an item, which only the person who made it may do.
 *
 * Allowed after it is listed and after people have bought it, deliberately:
 * this changes how a thing sits, not what it is, and a maker noticing a hat
 * floats a week after somebody bought it should be able to fix it for them
 * rather than having to make a second one.
 */
create or replace function public.set_avatar_fit(target uuid, fit jsonb)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  mine boolean;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select (creator_id = me) into mine from public.avatar_items where id = target;
  if mine is null then raise exception 'There is no such item.'; end if;
  if not mine then raise exception 'That is not yours to place.'; end if;

  if not public.sane_fit(fit) then
    raise exception 'That placement is not one this accepts.';
  end if;

  update public.avatar_items
     set fit = set_avatar_fit.fit, updated_at = now()
   where id = target;
end;
$$;

grant execute on function public.set_avatar_fit to authenticated;

commit;
