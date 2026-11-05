-- Turning a username into the account behind it, for the login function.
--
-- This used to be a pattern match, which meant a name containing an
-- underscore matched the wrong thing, or nothing at all, because an
-- underscore stands for "any character" in a pattern. A name is not a
-- pattern: it is matched whole, ignoring case, and nothing else.
--
-- Only the service role may call it, so nothing reachable from a browser can
-- use it to find out which usernames exist. Safe to run again.

create or replace function public.account_by_username(name text)
returns table (id uuid, is_guest boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.is_guest
    from public.profiles p
   where lower(p.username) = lower(trim(name))
   limit 1;
$$;

revoke execute on function public.account_by_username(text) from public, anon, authenticated;
grant execute on function public.account_by_username(text) to service_role;
