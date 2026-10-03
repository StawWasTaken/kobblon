begin;

-- Nobody starts naked, and nobody ends up faceless.
--
-- Staw's rules, and they are three separate ones that happen to arrive
-- together:
--
--   1. A new account owns and wears a starting kit.
--   2. A guest's kit is fixed: they keep it on.
--   3. A face is not optional. Taking one off puts the free one back, so
--      "wearing no face" is a state that cannot be reached rather than one
--      the renderer has to cope with.
--
-- What is in the kit lives in a table rather than in the function, because
-- the list is still being decided - the shirt, the trousers and the cap do
-- not exist yet. A row each when they do, and nothing here changes.

create table if not exists public.starting_kit (
  content_id bigint primary key,
  -- 'everybody' or 'guest': the second is for things only a guest is given.
  who text not null default 'everybody' check (who in ('everybody', 'guest')),
  -- Whether a guest may take it off. Everybody else always may.
  locked_for_guests boolean not null default false,
  note text
);

comment on table public.starting_kit is
  'What a new account is given, by Catalog number. Rows are added as the '
  'items are made; the code that reads this does not change.';

alter table public.starting_kit enable row level security;

drop policy if exists starting_kit_read on public.starting_kit;
create policy starting_kit_read on public.starting_kit for select using (true);

-- The two that exist today. The shirt, the trousers and the cap go in as
-- they are made - and `insert ... on conflict do nothing` means this file
-- can be applied again after they have been added without undoing anything.
insert into public.starting_kit (content_id, who, locked_for_guests, note) values
  (1119, 'everybody', true,  'The free face. Everybody wears it until they choose another.'),
  (1196, 'everybody', true,  'The Kobblon t-decal. Anybody may take it off; a guest may not.')
on conflict (content_id) do nothing;

/**
 * The face everybody falls back to.
 *
 * Its own function so that "which face is the floor" is answered in one
 * place. Null if that item does not exist on this database, and every caller
 * copes with null rather than failing - a missing row in a reference table
 * should not stop somebody getting dressed.
 */
create or replace function public.floor_face()
returns uuid
language sql stable
set search_path = public, extensions as $$
  select i.id from public.avatar_items i
    join public.starting_kit k on k.content_id = i.content_id
   where i.kind = 'face'
   order by k.content_id
   limit 1;
$$;

/**
 * Gives somebody their starting kit, and puts it on.
 *
 * Owning and wearing in one go: a kit somebody owns but is not wearing is a
 * kit that did nothing. Idempotent, so running it again on an account that
 * has it changes nothing.
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
       and (k.who = 'everybody' or (k.who = 'guest' and guest))
  loop
    insert into public.avatar_owned (item_id, user_id, paid)
    values (item.id, target, 0)
    on conflict do nothing;

    -- One thing per slot, and the kit wins over nothing. A slot somebody has
    -- already filled is left alone, so this is safe to run on an account
    -- that has been dressing itself.
    insert into public.avatar_worn (user_id, slot, item_id)
    values (target, item.slot, item.id)
    on conflict (user_id, slot) do nothing;

    given := given + 1;
  end loop;

  return given;
end;
$$;

revoke execute on function public.give_starting_kit from anon, authenticated;

commit;
