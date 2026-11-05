-- A Space is built out of blocks, so nothing it holds is anybody's script.
--
-- The editor writes page.json and compiles it into the markup and styles; the
-- markup it writes has no scripts in it, and the words people type are
-- escaped on the way in. Making that a rule of the table as well means a page
-- cannot carry a script even if something else were to write one, which is
-- what lets the served page refuse every script but ours. Safe to run again.

create or replace function public.save_space_file(space uuid, file_path text, body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  clean text := lower(trim(both '/' from coalesce(file_path, '')));
  count_now integer;
begin
  if not public.can_edit_space(space) then
    raise exception 'You cannot edit this Space.';
  end if;
  if clean !~ '^[a-z0-9][a-z0-9._/-]{0,59}$' or clean like '%..%' then
    raise exception 'A file name is letters, numbers, dots, dashes and slashes.';
  end if;
  if clean like '%.js' or clean like '%.mjs' then
    raise exception 'Spaces are built out of blocks, so they hold no scripts.';
  end if;
  if char_length(coalesce(body, '')) > 200000 then
    raise exception 'That file is too big. 200 KB is the limit.';
  end if;
  if body ~* '<\s*script' or body ~* 'javascript\s*:' then
    raise exception 'Spaces are built out of blocks, so they hold no scripts.';
  end if;

  select count(*) into count_now
    from public.space_files f
   where f.space_id = space and f.channel = 'draft' and f.path <> clean;

  if count_now >= public.space_file_limit() then
    raise exception 'A Space can have % files.', public.space_file_limit();
  end if;

  insert into public.space_files (space_id, channel, path, content)
  values (space, 'draft', clean, coalesce(body, ''))
  on conflict (space_id, channel, path)
  do update set content = excluded.content, updated_at = now();
end;
$$;

-- Anything written before this rule existed is no longer served.
delete from public.space_files
 where path like '%.js' or path like '%.mjs' or content ~* '<\s*script';
