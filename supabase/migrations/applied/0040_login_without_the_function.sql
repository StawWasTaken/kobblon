-- Logging in with a username, without needing an edge function deployed.
--
-- Supabase signs people in with an email, so a username has to be turned into
-- one first. The login function does that behind the service role key. This
-- is the same lookup for sites where that function is not deployed: it checks
-- the password here, and only hands back the email when the password is
-- right, so it cannot be used to find out which names exist or to collect
-- addresses.
--
-- The password travels to the database over the same TLS as everything else,
-- and is compared against the stored hash by pgcrypto; nothing is stored or
-- logged by this. Guessing is bounded by a counter per name, because unlike
-- the auth endpoint this has no rate limit of its own. Safe to run again.

-- pgcrypto lives in the extensions schema on Supabase and in public on a
-- plain Postgres, so it is never named here: the search path below covers
-- both and is pinned, which is what makes an unqualified call safe.
create extension if not exists pgcrypto;

create table if not exists public.login_attempts (
  name text primary key,
  tries integer not null default 0,
  since timestamptz not null default now()
);

alter table public.login_attempts enable row level security;
-- Nothing reads this but the function below, which runs as its owner.
revoke all on public.login_attempts from anon, authenticated;

drop function if exists public.login_email_for(text, text);
create function public.login_email_for(account_name text, secret text)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  key text := lower(trim(account_name));
  record_row public.login_attempts%rowtype;
  who uuid;
  guest boolean;
  stored text;
  address text;
begin
  if key = '' or coalesce(secret, '') = '' then return null; end if;

  -- Ten tries in a quarter of an hour, then a wait. The window restarts once
  -- it has passed, and a correct password clears the count.
  select * into record_row from public.login_attempts where login_attempts.name = key for update;

  if found and record_row.since < now() - interval '15 minutes' then
    update public.login_attempts set tries = 0, since = now() where login_attempts.name = key;
    record_row.tries := 0;
  end if;

  if found and record_row.tries >= 10 then
    raise exception 'Too many attempts. Wait a few minutes and try again.';
  end if;

  select p.id, p.is_guest into who, guest
    from public.profiles p
   where lower(p.username) = key;

  if who is not null and not guest then
    select u.email, u.encrypted_password into address, stored
      from auth.users u
     where u.id = who;
  end if;

  if stored is not null and address is not null
     and stored = crypt(secret, stored) then
    delete from public.login_attempts where login_attempts.name = key;
    return address;
  end if;

  insert into public.login_attempts as a (name, tries, since)
  values (key, 1, now())
  on conflict (name) do update set tries = a.tries + 1;

  -- The same answer whether the name is unknown or the password is wrong.
  return null;
end;
$$;

grant execute on function public.login_email_for to anon, authenticated;
