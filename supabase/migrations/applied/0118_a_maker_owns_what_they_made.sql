begin;

-- Kobblon cannot take its own faces, and nor can anybody who made a thing
-- before owning it was written down.
--
-- `create_avatar_item` gives the maker a row in `avatar_owned`, so a maker
-- always has their own work. 0115 carried the faces across from Style and
-- copied `face_owners` - which never had a row for Kobblon, because in Style
-- a face was not something its maker owned.
--
-- So Kobblon has faces it made, listed in its own Catalog, that it does not
-- own. Pressing the button asks to buy one, and `buy_avatar_item` refuses
-- with "That is already yours" - which is true, and is not a reason to
-- refuse. It should have handed it over.
--
-- Two fixes, because either alone leaves half of it broken:

/*
 * One: a maker taking their own thing gets it, rather than being told off.
 *
 * The old branch read "if it costs something and you made it, refuse",
 * which is right about not charging somebody for their own work and wrong
 * about what to do instead. Nobody is charged and the row is written, which
 * is what the person pressing the button wanted.
 */
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
    return;  -- Already theirs. Taking it twice is a no-op, not an error.
  end if;

  /*
   * Your own work is yours, whatever it is listed at and whether or not it
   * is listed at all. A maker looking at their own unlisted thing and being
   * told it is not for sale would be the shop talking to its owner.
   */
  if item.creator_id = me then
    insert into public.avatar_owned (item_id, user_id) values (target, me)
    on conflict do nothing;
    return;
  end if;

  if not item.is_public or item.status <> 'approved' or item.maker_suspended then
    raise exception 'That is not for sale.';
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
      perform public.move_pixels(house, cut, 'platform_fee', 'Share of ' || item.name);
    end if;
  end if;

  insert into public.avatar_owned (item_id, user_id) values (target, me)
  on conflict do nothing;
end;
$$;

/*
 * Two: every maker is given what they already made.
 *
 * Fixing the function alone would leave Kobblon having to press a button on
 * every face it has ever made. This is the one-off that should have been
 * part of 0115.
 */
insert into public.avatar_owned (item_id, user_id, got_at)
select i.id, i.creator_id, i.created_at
  from public.avatar_items i
on conflict do nothing;

commit;
