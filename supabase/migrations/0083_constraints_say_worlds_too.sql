-- Renaming a table does not rename what hangs off it.
--
-- 0074 turned experiences into worlds. The table, the indexes and the
-- functions were all brought across; the foreign keys were not, because
-- `alter table ... rename` leaves constraint names exactly as they were.
--
-- That is not cosmetic. PostgREST names relationships after the constraint,
-- so asking for a World and whoever built it in one request failed with
-- "could not find a relationship between 'worlds' and 'profiles'". The
-- relationship was there. Its name was two words out of date.

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.worlds'::regclass
       and conname = 'experiences_owner_id_fkey'
  ) then
    alter table public.worlds
      rename constraint experiences_owner_id_fkey to worlds_owner_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.worlds'::regclass
       and conname = 'experiences_space_id_fkey'
  ) then
    alter table public.worlds
      rename constraint experiences_space_id_fkey to worlds_space_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.worlds'::regclass
       and conname = 'experiences_pkey'
  ) then
    alter table public.worlds rename constraint experiences_pkey to worlds_pkey;
  end if;
end $$;

/*
 * The checks as well. Nothing reads these by name, but a schema where half
 * the constraints say experiences is a schema that makes somebody wonder
 * which of the two tables they are looking at.
 */
do $$
declare old text;
begin
  for old in
    select conname from pg_constraint
     where conrelid = 'public.worlds'::regclass
       and conname like 'experiences\_%'
  loop
    execute format(
      'alter table public.worlds rename constraint %I to %I',
      old, 'worlds_' || right(old, -length('experiences_'))
    );
  end loop;
end $$;

/*
 * PostgREST keeps the shape of the schema in memory and only looks again
 * when it is told to. Without this the rename above lands in the database
 * and the API carries on answering from the old picture of it.
 */
notify pgrst, 'reload schema';
