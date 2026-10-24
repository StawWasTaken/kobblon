begin;

/*
 * A name you had is still yours.
 *
 * Staw: "if you change usernames, you still own the previous usernames you
 * had, so if someone tries to create an account with a previous username of
 * yours then they cant, and if you wanna change your username again you can
 * always use a previous username of yours".
 *
 * `username_history` has existed since 0022, but only as a record: it was
 * written when somebody renamed and read by the profile page, and nothing
 * ever consulted it when a name was being claimed. So a name you left was
 * free the moment you left it, and the person who took it inherited every
 * link, every mention and every memory anybody had of you under it. That is
 * the whole reason to keep a history in the first place.
 *
 * Three things change:
 *
 *   * a retired name belongs to the account that retired it, and nobody
 *     else may take it - at signup or at a rename;
 *   * you may always take your own back, and taking it back frees nothing:
 *     the name you are leaving goes into the history in its place;
 *   * the charset is one rule in one place rather than three that disagreed
 *     - `check_username` said 3 to 20, `change_username` said 3 to 16, and
 *     the column said 3 to 20, so a sixteen-character name could be signed
 *     up with and never changed to.
 *
 * And display names get the charset too, which they never had: the column
 * only ever said "1 to 32 characters" and the rest was screening. Staw:
 * "no spaces, no '-', only normal text, numbers, '_' allowed and thats it".
 */

-- ------------------------------------------------------- one rule, one place
--
-- Letters, numbers and underscores. No spaces, no hyphens, nothing else.
-- Used by every check below so the four of them cannot drift apart again.

create or replace function public.name_shape()
returns text language sql immutable as $$ select '^[A-Za-z0-9_]{3,20}$' $$;

create or replace function public.name_shape_said()
returns text language sql immutable as $$
  select 'Letters, numbers and underscores. 3 to 20 characters.'
$$;

grant execute on function public.name_shape to anon, authenticated;
grant execute on function public.name_shape_said to anon, authenticated;

-- ------------------------------------------------- a retired name has an owner
--
-- Before the index can exist, the rows have to be able to satisfy it. Two
-- things could be in the way of that, both of them made by the old rule that
-- a left name was free:
--
--   * the same name sitting in two people's history, because one left it and
--     the other took it and left it too;
--   * a name in somebody's history that somebody else is using right now.
--
-- The newest claim wins in both cases, because it is the one that matches
-- what anybody looking at the platform today would see. The older rows are
-- deleted rather than kept, since a history row that may not be acted on is
-- a record of a promise this migration is making and then breaking.

delete from public.username_history h
 where exists (
   select 1 from public.username_history later
    where lower(later.username) = lower(h.username)
      and (later.changed_at, later.id) > (h.changed_at, h.id)
 );

delete from public.username_history h
 where exists (
   select 1 from public.profiles p where lower(p.username) = lower(h.username)
 );

create unique index if not exists username_history_one_owner_idx
  on public.username_history (lower(username));

-- ------------------------------------------------------------- who holds a name
--
-- The one question every check below asks: is this name free, and if it is
-- not, whose is it. Null means nobody has it. Answering in one place is what
-- stops signup and renaming disagreeing about a name.

create or replace function public.who_holds_name(candidate text)
returns uuid language sql stable security definer set search_path = public, extensions as $$
  select id from public.profiles where lower(username) = lower(candidate)
  union all
  select user_id from public.username_history where lower(username) = lower(candidate)
  limit 1;
$$;

grant execute on function public.who_holds_name to anon, authenticated;

-- ----------------------------------------------------------------- at the door
--
-- What signup asks on every keystroke, debounced. Kobby is the `screen_text`
-- call at the end of it: the name is read and judged before an account
-- exists, not after.

create or replace function public.check_username(candidate text)
returns table (ok boolean, reason text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  verdict record;
  holder uuid;
begin
  candidate := trim(coalesce(candidate, ''));

  if candidate !~ public.name_shape() then
    return query select false, public.name_shape_said();
    return;
  end if;

  holder := public.who_holds_name(candidate);
  if holder is not null then
    /*
     * The same sentence whether the name is in use or retired. Saying "that
     * one is somebody's old name" tells a stranger that the account exists
     * and what it used to be called, which is a thing to know about somebody
     * who did not offer it.
     */
    return query select false, 'That name is taken.';
    return;
  end if;

  select * into verdict from public.screen_text(candidate, 'identity');
  if verdict.decision <> 'ok' then
    return query select false, coalesce(verdict.reason, 'That name is not allowed.');
    return;
  end if;

  return query select true, null::text;
end;
$$;

grant execute on function public.check_username to anon, authenticated;

-- -------------------------------------------------------------- changing it
--
-- Same rules as the door, plus the one thing the door cannot have: a name
-- held in your *own* history is yours to take back, and taking it back puts
-- the name you are leaving where it was.

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
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot change their name.'; end if;

  new_name := trim(coalesce(new_name, ''));

  if new_name !~ public.name_shape() then
    raise exception '%', public.name_shape_said();
  end if;

  select username, pixels into current_name, balance from public.profiles where id = me;
  if not found then raise exception 'Sign in first.'; end if;

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
  update public.profiles set username = new_name where id = me;
  perform set_config('kobbleston.renaming', 'off', true);

  perform public.move_pixels(me, -cost, 'username_change', 'Changed name to ' || new_name);

  /*
   * Read back under the caller's own identity rather than trusting the
   * update - `move_pixels` and `guard_profile_update` taught this platform
   * that a privileged write and a row guard over the same table both return
   * successfully while the row does not move.
   */
  select username into current_name from public.profiles where id = me;
  if current_name is distinct from new_name then
    raise exception 'The rename did not hold. Nothing was charged.';
  end if;

  return new_name;
end;
$$;

grant execute on function public.change_username to authenticated;

-- ------------------------------------------------------- the names you had
--
-- Already public since 0022. It now also says whether a name is free to
-- take back, which is the only thing the settings page needs to offer it.

drop function if exists public.username_history_of(uuid);
create function public.username_history_of(target uuid)
returns table (username text, changed_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select h.username, h.changed_at
    from public.username_history h
   where h.user_id = target
   order by h.changed_at desc
   limit 20;
$$;

grant execute on function public.username_history_of to anon, authenticated;

-- -------------------------------------------------------------- display names
--
-- The charset applies here too. Existing rows have to be made to fit before
-- the constraint can exist, and the only honest way to do that is to take
-- out what is no longer allowed rather than to refuse to apply: a display
-- name is not an identifier and nothing links to it, so a name losing its
-- spaces is a cosmetic loss and a migration that will not apply is not.
--
-- Anything left empty by that falls back to the username, which is the same
-- thing 0255 does when Kobby takes a display name away.

update public.profiles
   set display_name = coalesce(
         nullif(left(regexp_replace(display_name, '[^A-Za-z0-9_]', '', 'g'), 32), ''),
         username)
 where display_name is null
    or display_name !~ '^[A-Za-z0-9_]{1,32}$';

alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (display_name ~ '^[A-Za-z0-9_]{1,32}$');

-- --------------------------------------------------- a new account lands
--
-- Taken from 0257 as it stands, with two changes, and retyped in full
-- because rewriting one of these from memory is how a check quietly goes
-- missing for a week.
--
--   * the free-name loop asks `who_holds_name` instead of `profiles`, so a
--     new account cannot be opened on a name somebody retired. This is the
--     actual door Staw described: `check_username` is what the signup form
--     asks, and a form is not a rule - the account is made by this trigger,
--     and until now it only knew about names in use.
--   * the display name coming in from the signup metadata is put through
--     the charset before it is written. Without that, the constraint added
--     above turns a display name with a space in it into a failed signup,
--     which is a far worse thing than a display name losing its space.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, extensions as $$

declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  guest boolean := coalesce(new.is_anonymous, false);
  base text;
  candidate text;
  wanted text;
  n int := 0;
begin
  if guest then
    candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    while public.who_holds_name(candidate) is not null loop
      candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    end loop;

    insert into public.profiles (id, username, display_name, avatar_url, is_guest, has_email, body)
    values (
      new.id, candidate, candidate, nullif(meta->>'avatar_url', ''), true, false,
      '{"Head":"#ffffff","Torso":"#ffffff","LeftArm":"#ffffff",
        "RightArm":"#ffffff","LeftLeg":"#ffffff","RightLeg":"#ffffff"}'::jsonb
    );
    perform public.give_starting_kit(new.id);
    return new;
  end if;

  base := regexp_replace(coalesce(meta->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'kobbler' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base := substr(base, 1, 16);
  candidate := base;
  while public.who_holds_name(candidate) is not null loop
    n := n + 1;
    candidate := substr(base, 1, 16) || n::text;
  end loop;

  wanted := left(regexp_replace(coalesce(meta->>'display_name', ''), '[^A-Za-z0-9_]', '', 'g'), 32);

  insert into public.profiles (id, username, display_name, avatar_url, birth_date, gender, has_email)
  values (
    new.id,
    candidate,
    coalesce(nullif(wanted, ''), candidate),
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'birth_date', '')::date,
    nullif(meta->>'gender', ''),
    not public.email_is_a_stand_in(new.email)
  );

  perform public.give_starting_kit(new.id);

  insert into public.activity_events (kind, actor_id) values ('user_joined', new.id);
  return new;
end;
$$;

commit;
