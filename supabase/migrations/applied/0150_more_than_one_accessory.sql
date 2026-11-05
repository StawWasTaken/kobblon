begin;

-- Two hats, if you want two hats.
--
-- 0112 wrote "one thing per slot. Two hats is a bug rather than a style" and
-- made it the primary key. Staw: "i want to be able to wear multiple
-- accessories, even if itll look ugly, its possible". So the rule was a
-- taste, not a fact, and a taste does not belong in a primary key.
--
-- What stays one-per-slot is what physically can only be one: a shirt, a
-- pair of trousers, the decal on the torso, a face, a haircut. Those are a
-- picture laid on the body or the one thing the head is, and a second of any
-- of them is not ugly, it is undefined - two shirts on one torso means the
-- renderer picks. The sockets - hat, front, back, neck, waist and the two
-- hands - may hold as many as somebody likes.
--
-- The key becomes (user_id, item_id), which also says the other thing worth
-- saying: you cannot wear the same hat twice.

alter table public.avatar_worn drop constraint avatar_worn_pkey;
alter table public.avatar_worn add primary key (user_id, item_id);

-- And the half of the old key that was a real rule, kept as what it always
-- was underneath: a uniqueness rule over some of the slots.
create unique index if not exists avatar_worn_one_per_slot
  on public.avatar_worn (user_id, slot)
  where slot in ('shirt', 'trousers', 'tdecal', 'face', 'hair');

comment on index public.avatar_worn_one_per_slot is
  'The slots that can only hold one thing: what is laid on the body, and '
  'the head. The sockets may hold several.';

/**
 * Which slots hold one thing only.
 *
 * A function rather than the list written out in each place that needs it -
 * it is already in the index above and in three function bodies, and a
 * fourth copy is how "hair" ends up multiple in one of them.
 */
create or replace function public.one_at_a_time(slot text)
returns boolean
language sql immutable
set search_path = public, extensions as $$
  select slot in ('shirt', 'trousers', 'tdecal', 'face', 'hair');
$$;

grant execute on function public.one_at_a_time to anon, authenticated;

/**
 * Putting something on.
 *
 * 0113's, with the insert changed: a one-at-a-time slot still replaces what
 * is there, and a socket adds. The ownership check, the takedown check and
 * "a page is a suggestion" are 0113's and are not retyped.
 *
 * The cap is not taste either - it is the renderer. Every accessory is a
 * mesh and a texture loaded into one WebGL context, and somebody wearing
 * forty is a profile that takes a browser down. Eight per socket is past
 * anything anybody would do on purpose.
 */
create or replace function public.wear_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into item from public.avatar_items where id = target;
  if item.id is null then raise exception 'There is no such item.'; end if;
  if item.is_removed then raise exception 'That has been taken down.'; end if;

  if not exists (select 1 from public.avatar_owned o
                  where o.item_id = target and o.user_id = me) then
    raise exception 'You do not have that.';
  end if;

  if public.one_at_a_time(item.slot) then
    delete from public.avatar_worn w
     where w.user_id = me and w.slot = item.slot and w.item_id <> target;
  elsif (select count(*) from public.avatar_worn w
          where w.user_id = me and w.slot = item.slot and w.item_id <> target) >= 8 then
    raise exception 'Eight in one place is as many as this draws. Take one off first.';
  end if;

  insert into public.avatar_worn (user_id, slot, item_id)
  values (me, item.slot, target)
  on conflict (user_id, item_id) do nothing;
end;
$$;

/**
 * Taking off one particular thing.
 *
 * The new door, and the one a page should use now: with two hats on,
 * "take off the hat slot" no longer names anything. It carries every rule
 * `take_off_slot` had - a guest keeps their kit, the trousers stay on a body
 * that is one colour all over, and a face is replaced by the free one rather
 * than leaving a hole - because those rules are about what is being taken
 * off, not about how it was asked for.
 */
create or replace function public.take_off_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  guest boolean;
  which text;
  floor_one uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select w.slot into which
    from public.avatar_worn w where w.user_id = me and w.item_id = target;
  -- Not wearing it: nothing to do. Not an error, because two clicks on the
  -- same cross is not somebody doing something wrong.
  if which is null then return; end if;

  select is_guest into guest from public.profiles where id = me;

  if coalesce(guest, false) and exists (
    select 1 from public.starting_kit k
      join public.avatar_items i on i.content_id = k.content_id
     where i.id = target and k.locked_for_guests
  ) then
    raise exception 'Guests keep what they start with. Make an account and you can change it.';
  end if;

  if which = 'trousers'
     and public.one_colour_all_over((select body from public.profiles where id = me))
  then
    raise exception 'Your body is one colour all over, so the trousers stay on. Change a colour first.';
  end if;

  if which = 'face' then
    floor_one := public.floor_face();
    -- Already the free one: nothing underneath to go back to.
    if floor_one is not null and target = floor_one then return; end if;
    if floor_one is not null then
      insert into public.avatar_owned (item_id, user_id, paid)
      values (floor_one, me, 0) on conflict do nothing;

      delete from public.avatar_worn w where w.user_id = me and w.item_id = target;
      insert into public.avatar_worn (user_id, slot, item_id)
      values (me, 'face', floor_one)
      on conflict (user_id, item_id) do nothing;
      return;
    end if;
  end if;

  delete from public.avatar_worn w where w.user_id = me and w.item_id = target;
end;
$$;

grant execute on function public.take_off_item to authenticated;

/**
 * Taking a whole slot off, which is now "everything in it".
 *
 * Kept because a slot is still a thing a page talks about - the drawer that
 * empties your hands - and it is the honest meaning of the old name. Each
 * row goes through `take_off_item`, so the guest lock and the face floor are
 * decided in one place rather than in two that drift.
 */
create or replace function public.take_off_slot(which text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  one uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  for one in
    select w.item_id from public.avatar_worn w
     where w.user_id = me and w.slot = which
  loop
    perform public.take_off_item(one);
  end loop;
end;
$$;

grant execute on function public.take_off_slot to authenticated;

/**
 * Wearing an outfit, which now has to clear before it fills.
 *
 * 0145's, with one thing added: a socket the outfit has something for is
 * emptied first. Without that, putting on an outfit no longer replaces
 * anything - it piles on top, so trying three outfits in a row leaves
 * somebody wearing all three. A slot the outfit says nothing about is left
 * alone, which is 0145's behaviour and is deliberate.
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

  if outfit.body is not null then
    begin
      perform public.set_body_colours(outfit.body);
    exception when others then
      null;
    end;
  end if;

  delete from public.avatar_worn w
   where w.user_id = me
     and not public.one_at_a_time(w.slot)
     and w.slot in (select oi.slot from public.outfit_items oi where oi.outfit_id = target);

  for outfit in
    select oi.slot, oi.item_id
      from public.outfit_items oi
      join public.avatar_owned o on o.item_id = oi.item_id and o.user_id = me
      join public.avatar_items i on i.id = oi.item_id and not i.is_removed
     where oi.outfit_id = target
  loop
    if public.one_at_a_time(outfit.slot) then
      delete from public.avatar_worn w
       where w.user_id = me and w.slot = outfit.slot and w.item_id <> outfit.item_id;
    end if;

    insert into public.avatar_worn (user_id, slot, item_id)
    values (me, outfit.slot, outfit.item_id)
    on conflict (user_id, item_id) do nothing;
    put_on := put_on + 1;
  end loop;

  return put_on;
end;
$$;

/**
 * The kit, with its insert brought along.
 *
 * `give_starting_kit` names the old key - `on conflict (user_id, slot)` -
 * and that key does not exist any more, so without this every new account
 * fails at the door with "there is no unique or exclusion constraint
 * matching the ON CONFLICT specification". It was caught by a check and not
 * by applying the file, because applying a migration does not call
 * anything: this is the fourth trap's sibling, where the thing that breaks
 * is a function body nobody re-read.
 *
 * 0149's, with the one clause changed.
 */
create or replace function public.give_starting_kit(target uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  guest boolean := coalesce((select is_guest from public.profiles where id = target), false);
  item record;
  given integer := 0;
begin
  for item in
    select i.id, i.slot
      from public.starting_kit k
      join public.avatar_items i on i.content_id = k.content_id
     where not i.is_removed
       and (k.who = 'everybody'
            or (k.who = 'guest' and guest)
            or (k.who = 'members' and not guest))
  loop
    insert into public.avatar_owned (item_id, user_id, paid)
    values (item.id, target, 0)
    on conflict do nothing;

    -- A slot they have already filled is left alone, which is 0131's rule
    -- and is why this is not a plain insert: the kit does not undress
    -- somebody who has been dressing themselves.
    if public.one_at_a_time(item.slot) and exists (
      select 1 from public.avatar_worn w
       where w.user_id = target and w.slot = item.slot
    ) then
      given := given + 1;
      continue;
    end if;

    insert into public.avatar_worn (user_id, slot, item_id)
    values (target, item.slot, item.id)
    on conflict (user_id, item_id) do nothing;

    given := given + 1;
  end loop;

  return given;
end;
$$;

revoke execute on function public.give_starting_kit from anon, authenticated;

-- An outfit can hold two hats as well, for the same reason and with the same
-- shape of key. A saved outfit whose second hat was silently dropped would
-- be an outfit that is not what you were wearing when you saved it.
alter table public.outfit_items drop constraint outfit_items_pkey;
alter table public.outfit_items add primary key (outfit_id, item_id);

create unique index if not exists outfit_items_one_per_slot
  on public.outfit_items (outfit_id, slot)
  where slot in ('shirt', 'trousers', 'tdecal', 'face', 'hair');

commit;
