-- A sign in code that cannot work should say so.
--
-- claim_app_code returned (user_id, email), and the sign in function only
-- looked at the email. An account with no address on it -- a guest -- came
-- back with a row, no email, and the application was told the link was no
-- longer good. It was good. It was never going to work, and nothing said
-- why, which is the worst of both.
--
-- The claim now says what it found. Whether an application can be signed in
-- is the caller's decision to make and the caller's message to write.

-- A third column means a new shape, and Postgres will not reshape a function
-- in place.
drop function if exists public.claim_app_code(text, text);

create function public.claim_app_code(given text, which text)
returns table (user_id uuid, email text, is_guest boolean)
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
    select found,
           nullif(u.email::text, ''),
           coalesce(p.is_guest, false)
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = found;
end $$;

/*
 * Still nothing a browser may call. The service role holds this because what
 * it returns decides who somebody is.
 */
revoke all on function public.claim_app_code(text, text) from public, anon, authenticated;
