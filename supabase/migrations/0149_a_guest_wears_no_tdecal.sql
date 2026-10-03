begin;

-- A guest does not get the Kobblon t-decal.
--
-- Staw, reversing 0131's second row: everybody who signs up owns and wears
-- it, and a guest does not get it at all. Not "gets it and may take it off"
-- - a guest's kit is locked, so that would be a guest who cannot ever
-- remove it, which is the opposite of what was asked.
--
-- `who` grew a third value rather than the t-decal moving out of the table,
-- because "everybody except guests" is a thing a kit row needs to be able to
-- say and the shirt will want it next. The three values now read:
--
--   'everybody' - signed up or passing through
--   'members'   - signed-up accounts only
--   'guest'     - guests only
--
-- The check constraint is replaced before the row is updated, in that order:
-- the other way round the update fails against the old constraint.

alter table public.starting_kit drop constraint if exists starting_kit_who_check;
alter table public.starting_kit
  add constraint starting_kit_who_check
  check (who in ('everybody', 'members', 'guest'));

update public.starting_kit
   set who = 'members',
       note = 'The Kobblon t-decal. Members only; anybody may take it off.',
       locked_for_guests = false
 where content_id = 1196;

/**
 * Gives somebody their starting kit, and puts it on.
 *
 * Taken from 0131 with one line changed - the `where` now understands
 * 'members'. Retyped nothing else: the ownership insert, the one-per-slot
 * rule and the idempotence are all 0131's.
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

    insert into public.avatar_worn (user_id, slot, item_id)
    values (target, item.slot, item.id)
    on conflict (user_id, slot) do nothing;

    given := given + 1;
  end loop;

  return given;
end;
$$;

revoke execute on function public.give_starting_kit from anon, authenticated;

-- The guests who already have one, because the rule changing does not
-- undress anybody by itself. Taken off and un-owned: a guest account is not
-- a collection and keeping a row nobody can see is keeping a mystery.
delete from public.avatar_worn w
 using public.profiles p, public.avatar_items i
 where w.user_id = p.id and w.item_id = i.id
   and p.is_guest and i.content_id = 1196;

delete from public.avatar_owned o
 using public.profiles p, public.avatar_items i
 where o.user_id = p.id and o.item_id = i.id
   and p.is_guest and i.content_id = 1196;

commit;
