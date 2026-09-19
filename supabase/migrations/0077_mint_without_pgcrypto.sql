-- Minting a sign-in code without pgcrypto.
--
-- `gen_random_bytes` belongs to pgcrypto, which Supabase installs into the
-- `extensions` schema rather than `public`. The function pinned its
-- search_path to `public` alone, so it worked on a database with pgcrypto in
-- public and failed on the real one with "function gen_random_bytes(integer)
-- does not exist". The rest of this repository already says
-- `search_path = public, extensions` for exactly that reason.
--
-- Rather than only fixing the path, this stops needing the extension at all.
-- `gen_random_uuid` is part of PostgreSQL itself and draws on the same strong
-- random source, so two of them are 244 bits of randomness that cannot go
-- missing because of where an extension was installed.

create or replace function public.mint_app_code(which text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made text;
  recent integer;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  select count(*) into recent from public.app_sign_in_codes
   where user_id = me and created_at > now() - interval '5 minutes';
  if recent >= 10 then
    raise exception 'That is enough sign in attempts for now. Wait a few minutes.';
  end if;

  -- 64 characters of hex, in the alphabet the protocol link allows.
  made := replace(gen_random_uuid()::text, '-', '')
       || replace(gen_random_uuid()::text, '-', '');

  insert into public.app_sign_in_codes (code, user_id, client)
  values (made, me, which);

  delete from public.app_sign_in_codes
   where expires_at < now() - interval '1 hour';

  return made;
end $$;

grant execute on function public.mint_app_code(text) to authenticated;

-- The claim runs as the server and touches auth.users, so it wants the same
-- treatment rather than being the next one to fail in production only.
create or replace function public.claim_app_code(given text, which text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = public, extensions as $$
declare found uuid;
begin
  update public.app_sign_in_codes
     set claimed_at = now()
   where code = given
     and client = which
     and claimed_at is null
     and expires_at > now()
  returning app_sign_in_codes.user_id into found;

  if found is null then
    return;
  end if;

  return query
    select found, u.email::text from auth.users u where u.id = found;
end $$;

revoke all on function public.claim_app_code(text, text) from public, anon, authenticated;
