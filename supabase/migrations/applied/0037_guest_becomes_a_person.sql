-- A guest who decides to stay keeps what they did. Supabase links the email
-- and password to the same account; this turns the throwaway profile into a
-- real one, with the same checks a fresh signup goes through. Safe to run
-- again.

create or replace function public.claim_guest_account(
  new_username text,
  new_display_name text,
  new_birth_date date,
  new_gender text default null,
  new_avatar_url text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  verdict record;
begin
  if me is null then raise exception 'Not signed in.'; end if;

  if not exists (select 1 from public.profiles where id = me and is_guest) then
    raise exception 'This account is not a guest.';
  end if;

  if new_birth_date is null then raise exception 'A birthday is needed.'; end if;
  if new_birth_date > current_date - interval '15 years' then
    raise exception 'You need to be 15 or over to use Kobbleston.';
  end if;

  -- The same name check the signup form runs, applied where it cannot be
  -- skipped by talking to the database directly.
  select * into verdict from public.check_username(new_username);
  if not verdict.ok then raise exception '%', coalesce(verdict.reason, 'Pick a different username.'); end if;

  -- A username is normally locked behind change_username, which charges for
  -- it. Taking a name for the first time is not a rename, so the guard is
  -- lifted for this one statement.
  perform set_config('kobbleston.renaming', 'on', true);

  update public.profiles
     set username = new_username,
         display_name = coalesce(nullif(trim(new_display_name), ''), new_username),
         birth_date = new_birth_date,
         gender = nullif(new_gender, ''),
         avatar_url = coalesce(nullif(new_avatar_url, ''), avatar_url),
         is_guest = false
   where id = me;

  perform set_config('kobbleston.renaming', 'off', true);

  -- What a new account is given on the way in, given now instead, since the
  -- guest was skipped the first time.
  perform public.move_pixels(me, 100, 'signup_grant', 'Welcome to Kobbleston');

  insert into public.activity_events (kind, actor_id) values ('user_joined', me);
end;
$$;

grant execute on function public.claim_guest_account to authenticated;
