begin;

-- Everybody was given the wrong free face.
--
-- Staw: "u gave them this one FACE-1103" where it should be FACE-1119. The
-- number is right in `starting_kit`, so what went wrong is how the floor
-- face is *found*:
--
--   select i.id from avatar_items i
--     join starting_kit k on k.content_id = i.content_id
--    where i.kind = 'face'
--    order by k.content_id
--    limit 1;
--
-- That is not "the free face". It is "whichever kit row happens to be a
-- face, lowest number first" - a positional guess that is correct only while
-- exactly one kit row is a face and nothing else in the kit ever turns out
-- to be one. The kit has five rows now and will have more, and the answer
-- quietly changes the day one of them is a face. A rule that depends on a
-- `limit 1` over a table other people add rows to is not a rule.
--
-- So the floor face is *named* rather than found: a column that says which
-- row it is. One row may carry it, enforced, because "the face you fall back
-- to" cannot be two faces.

alter table public.starting_kit
  add column if not exists is_floor boolean not null default false;

comment on column public.starting_kit.is_floor is
  'The face everybody falls back to when they take theirs off. Exactly one '
  'row carries it, and it is read rather than guessed at.';

create unique index if not exists starting_kit_one_floor
  on public.starting_kit ((true)) where is_floor;

update public.starting_kit set is_floor = (content_id = 1119);

/**
 * The face everybody falls back to.
 *
 * Reads the flag. Null when no row carries it or the item does not exist on
 * this database, and every caller copes with null - a missing reference row
 * should not stop somebody getting dressed.
 */
create or replace function public.floor_face()
returns uuid
language sql stable
set search_path = public, extensions as $$
  select i.id
    from public.starting_kit k
    join public.avatar_items i on i.content_id = k.content_id
   where k.is_floor and i.kind = 'face' and not i.is_removed
   limit 1;
$$;

-- --------------------------------------------------- putting it right

/*
 * The accounts that were handed the wrong one.
 *
 * Only the ones who were *handed* a face: a face somebody owns is a face
 * they chose or were given on purpose, and changing that would be taking
 * somebody's face off them to fix our own bug. Wearing something you do not
 * own is the mark of a face that was put on you, which is exactly the shape
 * of this mistake.
 *
 * Nothing happens at all where the floor face does not exist on this
 * database, which is the case the `is not null` guards cover.
 */
do $$
declare
  floor_one uuid := public.floor_face();
begin
  if floor_one is null then
    raise notice 'No floor face on this database; nothing to put right.';
    return;
  end if;

  -- Everybody owns it. 0131 says so and it is what makes it free.
  insert into public.avatar_owned (item_id, user_id, paid)
  select floor_one, p.id, 0 from public.profiles p
  on conflict do nothing;

  -- A face somebody is wearing and does not own was put there by us.
  update public.avatar_worn w
     set item_id = floor_one
   where w.slot = 'face'
     and w.item_id <> floor_one
     and not exists (
       select 1 from public.avatar_owned o
        where o.user_id = w.user_id and o.item_id = w.item_id
     );

  -- And a face is not optional: anybody wearing none gets this one.
  insert into public.avatar_worn (user_id, slot, item_id)
  select p.id, 'face', floor_one
    from public.profiles p
   where not exists (
     select 1 from public.avatar_worn w where w.user_id = p.id and w.slot = 'face'
   )
  on conflict (user_id, item_id) do nothing;
end $$;

/**
 * The kit, with the same rule applied where it is handed out.
 *
 * `give_starting_kit` walks the kit and wears one thing per slot, and which
 * one wins where two rows share a slot is whichever the loop reached first -
 * which is to say, nothing decides it. With two faces in the kit that is a
 * coin toss on every new account, and a coin toss is exactly what this looks
 * like from outside: most people with the right face and some without.
 *
 * So the face slot is not left to the loop. The floor face is worn, and any
 * other face in the kit is owned without being put on.
 *
 * 0149's body otherwise, with that one clause added.
 */
create or replace function public.give_starting_kit(target uuid)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare
  guest boolean := coalesce((select is_guest from public.profiles where id = target), false);
  floor_one uuid := public.floor_face();
  item record;
  given integer := 0;
begin
  for item in
    select i.id, i.slot, i.kind
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

    given := given + 1;

    -- A face that is not the floor face is theirs to own and not theirs to
    -- be wearing before they have chosen anything.
    if item.kind = 'face' and floor_one is not null and item.id <> floor_one then
      continue;
    end if;

    -- A slot they have already filled is left alone, which is 0131's rule:
    -- the kit does not undress somebody who has been dressing themselves.
    if public.one_at_a_time(item.slot) and exists (
      select 1 from public.avatar_worn w
       where w.user_id = target and w.slot = item.slot
    ) then
      continue;
    end if;

    insert into public.avatar_worn (user_id, slot, item_id)
    values (target, item.slot, item.id)
    on conflict (user_id, item_id) do nothing;
  end loop;

  return given;
end;
$$;

revoke execute on function public.give_starting_kit from anon, authenticated;

commit;
