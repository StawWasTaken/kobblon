-- Signing in to a Kobblon application, from the browser.
--
-- No Kobblon application ever asks for a password. A desktop window is the
-- easiest thing in the world to forge, and teaching people to type their
-- password into one that is not a browser is teaching them the habit that
-- makes forgery work. The website signs in, and hands the application a code
-- that is worth one exchange and nothing else.
--
-- The code is not a session and not a refresh token. It goes through a
-- protocol link, and a protocol link ends up in shell history, process lists
-- and crash logs, so what travels there has to be worthless two minutes later.

create table if not exists public.app_sign_in_codes (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{32,128}$'),
  user_id uuid not null references public.profiles on delete cascade,
  /** Which application asked, so a code for one cannot be spent on another. */
  client text not null check (client in ('launcher', 'creator')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  claimed_at timestamptz
);

create index if not exists app_sign_in_codes_user_idx
  on public.app_sign_in_codes (user_id, created_at desc);

alter table public.app_sign_in_codes enable row level security;

/*
 * Nobody reads this table. A list of live codes is a list of live sessions,
 * and the two functions below are the only way in or out.
 */
drop policy if exists app_sign_in_codes_read on public.app_sign_in_codes;
create policy app_sign_in_codes_read on public.app_sign_in_codes for select
  using (false);

/**
 * A code, for the signed-in browser to hand over.
 *
 * Rate limited by counting what this account has minted recently, because a
 * page that can mint without limit is a page that can fill the table.
 */
create or replace function public.mint_app_code(which text)
returns text
language plpgsql security definer set search_path = public as $$
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

  -- 32 bytes of randomness, written in the alphabet the link allows.
  made := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.app_sign_in_codes (code, user_id, client)
  values (made, me, which);

  -- Old codes are rubbish, and rubbish that can be spent is worse.
  delete from public.app_sign_in_codes
   where expires_at < now() - interval '1 hour';

  return made;
end $$;

grant execute on function public.mint_app_code(text) to authenticated;

/**
 * Spending a code, exactly once.
 *
 * The claim is one statement on purpose: two applications racing on the same
 * code must not both win, and a check followed by an update is how they both
 * win. Only the server calls this, holding the service role, because what it
 * returns decides who somebody is.
 */
create or replace function public.claim_app_code(given text, which text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = public as $$
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
