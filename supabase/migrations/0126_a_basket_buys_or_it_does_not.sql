begin;

-- Buying several things at once.
--
-- Staw asked for a basket, and a basket is only worth having if it is one
-- decision. The thing to avoid is the half-bought basket: four items, the
-- Brix run out on the third, and somebody is left owning two of a set with
-- no idea which two. So this is one statement - every item or none, and a
-- refusal names the one that stopped it.
--
-- It calls `buy_avatar_item` per item rather than restating what buying is.
-- That function already knows the rules about limiteds, suspended makers,
-- guests, the platform's cut and what happens when the thing is already
-- yours, and a second copy of that reasoning is a second thing to get wrong.
-- Failing inside a loop rolls the whole function back, which is exactly the
-- behaviour wanted and is why this is short.
--
-- Not a stored basket. What somebody has put aside lives in their browser
-- until they press buy; a table for it would be a row per person per item
-- for a feature whose whole life is one visit.

create or replace function public.buy_avatar_items(targets uuid[])
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  one uuid;
  bought integer := 0;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if targets is null or array_length(targets, 1) is null then
    raise exception 'There is nothing in your basket.';
  end if;
  if array_length(targets, 1) > 24 then
    raise exception 'A basket holds 24 things at most.';
  end if;

  -- `distinct` so the same item twice is not two charges for one thing. It
  -- cannot be: the second call returns quietly because it is already yours,
  -- and quietly is the one answer that would be wrong on a receipt.
  for one in select distinct unnest(targets) loop
    perform public.buy_avatar_item(one);
    bought := bought + 1;
  end loop;

  return bought;
end;
$$;

grant execute on function public.buy_avatar_items to authenticated;

commit;
