begin;

/*
 * A username costs five hundred Brix and may be changed once a day.
 *
 * Staw: "make that to change username you need to wait 1 day, and pay 500
 * brix". It was two hundred and fifty and as often as you liked, and the
 * second half is the part that was actually a problem: a name is how
 * everybody else finds you, and somebody who changes it four times in an
 * evening is unfindable by everybody who knew them. The price alone did
 * not stop that - it only decided who could afford to do it.
 *
 * The wait is measured from the last **change**, not from the account's
 * first name. `username_history` holds the name you signed up with, so
 * reading the newest row there would make every new account wait a day
 * before its first rename, which is not what was asked for and would read
 * as a bug. So the day it last changed is a column of its own, null on an
 * account that has never changed it.
 */

set search_path = public, extensions;

-- --------------------------------------------------------- the price

create or replace function public.username_change_cost()
returns integer language sql immutable as $$ select 500 $$;

grant execute on function public.username_change_cost to anon, authenticated;

-- ---------------------------------------------------------- the wait

alter table public.profiles
  add column if not exists username_changed_at timestamptz;

comment on column public.profiles.username_changed_at is
  'When the username was last changed. Null on an account still using the '
  'name it signed up with, which is why this is not read off username_history.';

/**
 * How long the wait is. One function so the number is in one place and the
 * page, the error and the countdown cannot disagree about it.
 */
create or replace function public.username_change_wait()
returns interval language sql immutable as $$ select interval '1 day' $$;

grant execute on function public.username_change_wait to anon, authenticated;

/**
 * When you may change your name next, and what it costs.
 *
 * One call, because the dialog needs all of it at once and asking three
 * times to draw one button is three round trips. `next_at` is null when
 * there is nothing to wait for - a page should read that as "now" rather
 * than hiding the button on a null.
 */
create or replace function public.username_change_state()
returns table (cost integer, next_at timestamptz, waiting boolean)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    public.username_change_cost(),
    p.username_changed_at + public.username_change_wait(),
    coalesce(p.username_changed_at + public.username_change_wait() > now(), false)
  from public.profiles p
  where p.id = auth.uid();
$$;

grant execute on function public.username_change_state() to authenticated;

-- ------------------------------------------- the rename, with both of them

/*
 * The whole function again rather than a patch, because this is the one
 * place the price and the wait are actually enforced and a reader should
 * be able to see all of it without opening 0277 as well.
 *
 * The two things that have not changed and must not: the rename is written
 * under the transaction-local `kobbleston.renaming` flag, and the row is
 * **read back under the caller's own identity** afterwards. A privileged
 * function and a row-level guard over the same table both return
 * successfully while the row does not move; that cost this platform its
 * worst week.
 */
create or replace function public.change_username(new_name text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  current_name text;
  cost integer := public.username_change_cost();
  balance integer;
  holder uuid;
  verdict public.screen_decision;
  coming_back boolean;
  last_changed timestamptz;
  free_at timestamptz;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot change their name.'; end if;

  new_name := trim(coalesce(new_name, ''));

  if new_name !~ public.name_shape() then
    raise exception '%', public.name_shape_said();
  end if;

  select username, pixels, username_changed_at
    into current_name, balance, last_changed
    from public.profiles where id = me;
  if not found then raise exception 'Sign in first.'; end if;

  /*
   * The wait, checked before anything is written and before the name is
   * screened. Somebody who cannot rename today should be told that rather
   * than told their chosen name is unavailable.
   */
  free_at := last_changed + public.username_change_wait();
  if free_at is not null and free_at > now() then
    raise exception 'You changed your name less than a day ago. You can change it again %.',
      to_char(free_at at time zone 'UTC', 'on DD Mon at HH24:MI') || ' UTC';
  end if;

  if lower(new_name) = lower(current_name) then
    raise exception 'That is already your name.';
  end if;

  holder := public.who_holds_name(new_name);
  coming_back := holder = me;

  if holder is not null and not coming_back then
    raise exception 'Somebody already has that name.';
  end if;

  /*
   * A name you already had has been past Kobby once and was yours for as
   * long as you held it, so taking it back is not a new name to judge. It
   * also cannot be screened again honestly: the word list moves, and a name
   * that is fine today failing tomorrow would strand somebody halfway
   * through a rename they have already paid for.
   */
  if not coming_back then
    verdict := (public.screen_text(new_name, 'identity')).decision;
    if verdict <> 'ok' then
      raise exception 'That name is not allowed here.';
    end if;
  end if;

  if balance < cost then
    raise exception 'Changing your name costs % Brix and you have %.', cost, balance;
  end if;

  -- The name being left is kept; the name being taken back stops being past.
  if coming_back then
    delete from public.username_history
     where user_id = me and lower(username) = lower(new_name);
  end if;

  insert into public.username_history (user_id, username) values (me, current_name);

  perform set_config('kobbleston.renaming', 'on', true);
  update public.profiles
     set username = new_name,
         username_changed_at = now()
   where id = me;
  perform set_config('kobbleston.renaming', 'off', true);

  perform public.move_pixels(me, -cost, 'username_change', 'Changed name to ' || new_name);

  /*
   * Read back under the caller's own identity rather than trusting the
   * update - `move_pixels` and `guard_profile_update` taught this platform
   * that a privileged write and a row guard over the same table both return
   * successfully while the row does not move.
   *
   * The stamp is read back with it. If the guard pinned that column the
   * rename would succeed and the wait would never start, which is the whole
   * feature silently absent.
   */
  select username, username_changed_at into current_name, last_changed
    from public.profiles where id = me;
  if current_name is distinct from new_name then
    raise exception 'The rename did not hold. Nothing was charged.';
  end if;
  if last_changed is null then
    raise exception 'The rename did not record when it happened. Nothing was charged.';
  end if;

  return new_name;
end;
$$;

grant execute on function public.change_username to authenticated;

commit;
