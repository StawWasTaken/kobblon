begin;

/**
 * Saves what somebody is wearing as an outfit, or writes over one of theirs.
 *
 * Taken from `avatar_worn` rather than from a list the page sends: an outfit
 * is "what I look like now", and a page that assembles its own idea of that
 * is a page that can be wrong about it. The same reason the profile picture
 * is drawn from the database.
 */
create or replace function public.save_outfit(
  outfit_name text,
  into_folder uuid default null,
  over_outfit uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made uuid;
  how_many integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot save outfits. Make an account and you can.';
  end if;
  if coalesce(btrim(outfit_name), '') = '' then
    raise exception 'Give it a name.';
  end if;

  if into_folder is not null and not exists (
    select 1 from public.outfit_folders where id = into_folder and owner_id = me
  ) then
    raise exception 'That folder is not yours.';
  end if;

  select count(*) into how_many from public.avatar_worn where user_id = me;
  if how_many = 0 then
    raise exception 'You are not wearing anything to save.';
  end if;

  if over_outfit is not null then
    if not exists (select 1 from public.outfits where id = over_outfit and owner_id = me) then
      raise exception 'That outfit is not yours.';
    end if;
    made := over_outfit;
    update public.outfits
       set name = btrim(outfit_name),
           folder_id = into_folder,
           body = (select body from public.profiles where id = me),
           updated_at = now()
     where id = made;
    delete from public.outfit_items where outfit_id = made;
  else
    if (select count(*) from public.outfits where owner_id = me and not is_removed) >= 100 then
      raise exception 'A hundred outfits is the limit.';
    end if;
    insert into public.outfits (owner_id, folder_id, name, body)
    values (me, into_folder, btrim(outfit_name),
            (select body from public.profiles where id = me))
    returning id into made;
  end if;

  insert into public.outfit_items (outfit_id, slot, item_id)
  select made, w.slot, w.item_id from public.avatar_worn w where w.user_id = me;

  return made;
end;
$$;

/**
 * Puts an outfit on.
 *
 * Only the parts somebody owns. An outfit can name something they have not
 * bought - their own, after they sold nothing and simply never owned it, or
 * somebody else's listed outfit being tried - and the honest behaviour is to
 * wear what they have rather than to refuse the whole thing or, worse, to
 * quietly dress them in something they do not own.
 *
 * Returns how many pieces went on, so the page can say "four of six" rather
 * than claiming it all worked.
 */
create or replace function public.wear_outfit(target uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  outfit record;
  put_on integer := 0;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into outfit from public.outfits
   where id = target and not is_removed
     and (owner_id = me or is_public);
  if outfit.id is null then raise exception 'There is no such outfit.'; end if;

  -- Its colours, where it saved some and where they are allowed.
  if outfit.body is not null then
    begin
      perform public.set_body_colours(outfit.body);
    exception when others then
      -- A saved body that today's rules refuse - one colour all over, saved
      -- before trousers were taken off - is skipped rather than failing the
      -- whole change. The clothes are the outfit; the colours are a bonus.
      null;
    end;
  end if;

  for outfit in
    select oi.slot, oi.item_id
      from public.outfit_items oi
      join public.avatar_owned o on o.item_id = oi.item_id and o.user_id = me
      join public.avatar_items i on i.id = oi.item_id and not i.is_removed
     where oi.outfit_id = target
  loop
    insert into public.avatar_worn (user_id, slot, item_id)
    values (me, outfit.slot, outfit.item_id)
    on conflict (user_id, slot) do update set item_id = excluded.item_id;
    put_on := put_on + 1;
  end loop;

  return put_on;
end;
$$;

/**
 * Buys everything in an outfit that the buyer does not already own.
 *
 * Staw's rule: buying an outfit buys each item it contains, the platform
 * takes its cut, and the person who made the outfit takes theirs on every
 * purchase. Three things follow that are worth saying out loud:
 *
 *   * **Each item is bought through `buy_avatar_item`.** The outfit does not
 *     restate what buying is, so limiteds, suspended makers, guests and the
 *     platform's own cut keep working without a second copy that drifts.
 *   * **Everything or nothing.** One function, one transaction. Somebody
 *     left owning three of a five-piece outfit with no idea which three is
 *     the thing a set purchase must never do.
 *   * **The outfit's maker is paid separately**, out of Kobblon's cut rather
 *     than out of the item makers' - the people who made the clothes are owed
 *     exactly what they would have been owed if the pieces were bought one
 *     by one. Assembling a set is worth something; it is not worth taking it
 *     from the person who drew the shirt.
 *
 * Returns how many items were actually bought.
 */
create or replace function public.buy_outfit(target uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  outfit record;
  one record;
  bought integer := 0;
  spent integer := 0;
  cut integer;
  house uuid := public.kobbleston_account();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot buy. Make an account and you can.';
  end if;

  select * into outfit from public.outfits
   where id = target and is_public and not is_removed;
  if outfit.id is null then raise exception 'That outfit is not for sale.'; end if;
  if outfit.owner_id = me then raise exception 'That one is already yours.'; end if;

  for one in
    select i.id, i.price
      from public.outfit_items oi
      join public.avatar_items i on i.id = oi.item_id
     where oi.outfit_id = target
       and not i.is_removed
       and i.status = 'approved'
       and not exists (
         select 1 from public.avatar_owned o
          where o.item_id = i.id and o.user_id = me
       )
  loop
    perform public.buy_avatar_item(one.id);
    bought := bought + 1;
    spent := spent + one.price;
  end loop;

  if bought = 0 then
    raise exception 'You already own everything in it.';
  end if;

  /*
   * The maker's share, out of the house's cut rather than on top of the
   * price. Rounded down, and skipped when it rounds to nothing: moving zero
   * Brix writes a ledger line that says nothing happened.
   */
  if outfit.maker_share > 0 and spent > 0 and house is not null then
    cut := floor(spent * outfit.maker_share / 100.0)::integer;
    if cut > 0 and outfit.owner_id <> house then
      perform public.move_pixels(house, -cut, 'sale', 'Outfit share: ' || outfit.name);
      perform public.move_pixels(outfit.owner_id, cut, 'sale', 'Outfit sold: ' || outfit.name);
    end if;
  end if;

  return bought;
end;
$$;

grant execute on function public.save_outfit to authenticated;
grant execute on function public.wear_outfit to authenticated;
grant execute on function public.buy_outfit  to authenticated;

commit;
