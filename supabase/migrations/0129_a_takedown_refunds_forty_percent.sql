begin;

-- Buying records what was paid.
--
-- One line added to a function that is otherwise unchanged, and it is here
-- rather than in 0128 because 0128 adds the column: a function that writes a
-- column added in the same file is fine, but keeping them apart means either
-- can be applied on its own without the other half being a mystery.

create or replace function public.buy_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  balance integer;
  keeps integer;
  cut integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot take things. Make an account and you can.';
  end if;

  select i.*, p.is_suspended as maker_suspended into item
    from public.avatar_items i
    join public.profiles p on p.id = i.creator_id
   where i.id = target;

  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if exists (select 1 from public.avatar_owned o
              where o.item_id = target and o.user_id = me) then
    return;
  end if;

  if item.creator_id = me then
    insert into public.avatar_owned (item_id, user_id, paid) values (target, me, 0)
    on conflict do nothing;
    return;
  end if;

  if not item.is_public or item.status <> 'approved' or item.maker_suspended then
    raise exception 'That is not for sale.';
  end if;

  if item.sells_until is not null and item.sells_until <= now() then
    raise exception 'That was limited, and the time to take it has passed.';
  end if;

  if item.price > 0 then
    select pixels into balance from public.profiles where id = me;
    if balance < item.price then
      raise exception 'That costs % Brix and you have %.', item.price, balance;
    end if;

    cut := round(item.price * public.platform_share() / 100.0)::integer;
    keeps := item.price - cut;

    perform public.move_pixels(me, -item.price, 'purchase', 'Bought ' || item.name);
    perform public.move_pixels(item.creator_id, keeps, 'sale', 'Sold ' || item.name);
    if cut > 0 and house is not null and house <> item.creator_id then
      perform public.move_pixels(house, cut, 'platform_fee', 'Cut of ' || item.name);
    end if;
  end if;

  insert into public.avatar_owned (item_id, user_id, paid)
  values (target, me, item.price)
  on conflict do nothing;
end;
$$;

grant execute on function public.buy_avatar_item to authenticated;

-- Taking something down pays everybody who bought it.
--
-- Staw's rule: 40% of what they paid, straight away, and **Kobblon pays it**
-- - not the maker. The reason that is the right way round is that a takedown
-- is usually a judgement about the maker, and a refund that empties their
-- account is a second punishment landing on the people who are owed money
-- rather than on them. So the house carries it.
--
-- Everybody keeps the thing itself. It stops being sold, it stops being
-- worn by anybody who has it on, and it stops appearing anywhere - but the
-- row saying it was theirs stays, because that is the record of a purchase
-- and deleting it would make the refund unexplainable.
--
-- Not the creator's to call. Taking something down is moderation, and the
-- same guard decides it as decides screening.

create or replace function public.remove_avatar_item(target uuid, note text default null)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  house uuid := public.kobbleston_account();
  owner record;
  back integer;
  paid_out integer := 0;
begin
  if me is not null and not public.screens_avatar_items() then
    raise exception 'That is not yours to take down.';
  end if;

  select * into item from public.avatar_items where id = target;
  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then return 0; end if;

  update public.avatar_items
     set is_removed = true,
         is_public = false,
         review_note = coalesce(note, review_note),
         updated_at = now()
   where id = target;

  -- It comes off everybody wearing it. A thing nobody may buy and nobody
  -- may see is not a thing that should still be on somebody's body.
  delete from public.avatar_worn where item_id = target;

  for owner in
    select o.user_id, coalesce(o.paid, item.price) as cost
      from public.avatar_owned o
     where o.item_id = target
       and o.user_id <> item.creator_id
  loop
    back := floor(owner.cost * 0.40)::integer;
    if back > 0 then
      perform public.move_pixels(
        owner.user_id, back, 'refund',
        'Taken down: ' || item.name
      );
      if house is not null then
        perform public.move_pixels(
          house, -back, 'refund',
          'Refund for ' || item.name
        );
      end if;
      paid_out := paid_out + back;
    end if;
  end loop;

  return paid_out;
end;
$$;

revoke execute on function public.remove_avatar_item from anon;
grant execute on function public.remove_avatar_item to authenticated;

commit;
