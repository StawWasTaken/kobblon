-- Newbie, and nothing in the pocket.
--
-- Two of Staw's, and they are both about what the first minute on Kobblon
-- looks like.
--
-- **Newbie.** "for every new player, the default avatar must be these
-- colours, with the kobblon tdecal & default smile ... the default avatar is
-- called Newbie". Until now a new account had `body` null, which is not a
-- colour scheme - it is the absence of one, and what it actually drew was
-- whatever colour the rig was exported in. So a new person was not grey on
-- purpose, they were undecided, and it looked it.
--
-- Newbie is six colours: an off-white head and arms, a Kobblon-green torso,
-- Kobblon-blue legs. The t-decal and the free face were already in
-- `starting_kit` since 0131, so the shirt and the smile need nothing here;
-- this is the part that was missing.
--
-- Everybody still sitting on a null body gets it too. That is not a change
-- to anybody's avatar: null was never a choice somebody made, it was the
-- hole this fills, and a person who has picked colours is left alone.
--
-- **No welcome Brix.** "i want that when people arrive on kobblon they dont
-- have a starter 100 free brix welcome to kobbleston cuz we already have
-- redeem codes for that". Three places handed out the hundred - the trigger
-- on a new profile, a guest claiming their account, and staff making a guest
-- real - and all three stop. A code is the way in now, which is the thing
-- that can be turned off, timed, and counted.
--
-- The `signup_grant` kind stays in the transaction kinds on purpose: rows
-- written before today still say that, and narrowing the check would make
-- the ledger fail its own constraint.

begin;

set search_path = public, extensions;

-- ---------------------------------------------------------------- Newbie

/**
 * The colours a new account arrives in.
 *
 * A function rather than six literals in three places, so "what is Newbie"
 * has one answer and a later change to it is one line. Stable and callable
 * by anybody: it is a constant, and the website draws a Newbie on the
 * signup screen.
 */
create or replace function public.newbie_body()
returns jsonb
language sql immutable
set search_path = public, extensions as $$
  select jsonb_build_object(
    'Head',     '#f0f4fa',
    'Torso',    '#1cae71',
    'LeftArm',  '#f0f4fa',
    'RightArm', '#f0f4fa',
    'LeftLeg',  '#3a50ff',
    'RightLeg', '#3a50ff'
  );
$$;

grant execute on function public.newbie_body() to anon, authenticated;

comment on function public.newbie_body() is
  'Newbie: the body every account starts in. Off-white head and arms, '
  'Kobblon green torso, Kobblon blue legs.';

/**
 * Paint a new profile Newbie.
 *
 * `before insert` rather than after, so the row is written once with its
 * colours on it instead of being written and then updated - and so nothing
 * that reads the row from an `after insert` trigger ever sees it blank.
 *
 * It only fills a hole. A row that arrives with colours already on it keeps
 * them, which is what makes this safe to leave in place when something
 * later creates a profile that is not a new person.
 */
create or replace function public.paint_newbie()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  if new.body is null then
    new.body := public.newbie_body();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_before_insert_newbie on public.profiles;
create trigger profiles_before_insert_newbie
  before insert on public.profiles
  for each row execute function public.paint_newbie();

-- Everybody who never had colours at all. Not a repaint: `body is null` is
-- the hole, and anybody who chose something is untouched.
update public.profiles set body = public.newbie_body() where body is null;

-- --------------------------------------------------- no welcome Brix

-- The trigger first, then the function it called. Dropped rather than
-- emptied, so nothing is left looking like it still does something.
drop trigger if exists profiles_after_insert_pixels on public.profiles;
drop function if exists public.grant_signup_pixels();

/*
 * 0037's `claim_guest_account`, unchanged except that the hundred is gone.
 *
 * Repeated in full rather than patched, because there is no way to patch the
 * body of a function - and a copy that drifts is worse than a copy. If this
 * is ever genuinely changed again, it changes here.
 */
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
    raise exception 'You need to be 15 or over to use Kobblon.';
  end if;

  -- The same name check the signup form runs, applied where it cannot be
  -- skipped by talking to the database directly.
  select * into verdict from public.check_username(new_username);
  if not verdict.ok then
    raise exception '%', coalesce(verdict.reason, 'Pick a different username.');
  end if;

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

  insert into public.activity_events (kind, actor_id) values ('user_joined', me);
end;
$$;

grant execute on function public.claim_guest_account to authenticated;

/*
 * 0257's `admin_make_real`, likewise, minus the hundred.
 */
create or replace function public.admin_make_real(target uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare they public.profiles%rowtype;
begin
  perform public.require_superadmin();

  select * into they from public.profiles where id = target;
  if they.id is null then raise exception 'No such account.'; end if;
  if not they.is_guest then raise exception 'That account is already a real one.'; end if;

  update public.profiles
     set is_guest = false,
         must_set_password = true
   where id = target;

  insert into public.activity_events (kind, actor_id) values ('user_joined', target);
  perform public.write_admin_log('made_real', target, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_make_real(uuid) from public;
grant execute on function public.admin_make_real(uuid) to authenticated;

commit;
