begin;

/*
 * A World's pictures point at a host that does not exist.
 *
 * `storage_base()` answers `app.settings.storage_url` when that is set on
 * the database and otherwise falls back to
 * `https://kobblon.supabase.co/storage/v1/object/public`. That fallback was
 * a guess made when the project was named rather than looked up, and this
 * project is `sdnjdgeqrhzkyfyohcsz`. So unless the setting happens to be
 * set, every emblem and every thumbnail the database writes points at a
 * host nobody owns: the upload works, the row is written, and the picture
 * never loads.
 *
 * The browser never noticed because the one place the website builds a
 * storage address itself - `worldFileUrl` - reads `VITE_SUPABASE_URL` and
 * is correct. Only the addresses written by the database are wrong, which
 * is exactly the set a person sees as "I uploaded it and nothing appeared".
 *
 * This is not a secret: a storage host is public, it is in every picture
 * address the site serves. The setting still wins where it is set, so a
 * project that has one keeps it.
 */

create or replace function public.storage_base()
returns text
language sql immutable set search_path = public as $$
  select coalesce(
    nullif(current_setting('app.settings.storage_url', true), ''),
    'https://sdnjdgeqrhzkyfyohcsz.supabase.co/storage/v1/object/public'
  )
$$;

/*
 * And the rows already written with the host that does not exist. Only the
 * prefix is replaced, so a World keeps the picture it chose; a row that
 * never carried that host is untouched, which is why this is safe to run
 * on a database whose setting was right all along.
 */
update public.worlds
   set cover_url = replace(
         cover_url,
         'https://kobblon.supabase.co/storage/v1/object/public',
         public.storage_base()
       )
 where cover_url like 'https://kobblon.supabase.co/storage/v1/object/public%';

update public.worlds
   set emblem_url = replace(
         emblem_url,
         'https://kobblon.supabase.co/storage/v1/object/public',
         public.storage_base()
       )
 where emblem_url like 'https://kobblon.supabase.co/storage/v1/object/public%';

update public.worlds
   set manifest_url = replace(
         manifest_url,
         'https://kobblon.supabase.co/storage/v1/object/public',
         public.storage_base()
       )
 where manifest_url like 'https://kobblon.supabase.co/storage/v1/object/public%';

commit;
