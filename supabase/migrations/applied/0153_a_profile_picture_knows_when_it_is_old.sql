begin;

-- When somebody last changed how they look.
--
-- Staw, for the third or fourth time: "make that the Pfp is a picture
-- centered around the face and around of the actual avatar, so everytime you
-- change avatars, it updates". It is drawn from the avatar already - that
-- part is done - and it still goes stale, because *drawing it again* happens
-- in one place: the account's own avatar page, after a change it watched.
--
-- Anything that misses that moment leaves a picture of who somebody used to
-- be, and there is no way to tell: a URL in `avatar_url` looks exactly as
-- current as it did the day it was written.
--
-- So the database says when the avatar last changed, and a picture carries
-- when it was taken (its filename is `portrait-<ms>.webp`). Older than the
-- avatar means stale, and a page that knows that can draw a fresh one rather
-- than showing a face that is not theirs any more.
--
-- `clock_timestamp()` and not `now()`, which is a difference worth knowing:
-- `now()` is when the *transaction* began, so two changes in one transaction
-- stamp the same instant and a check inside one transaction cannot tell them
-- apart. It read as the trigger not firing, and it was the clock standing
-- still. What is being recorded here is a real moment, not a transaction.
--
-- Deliberately a *timestamp* and not a flag: a flag has to be cleared by
-- whoever draws, which means every reader is a writer, and most of them are
-- looking at somebody else's account and may not write to it at all.

alter table public.profiles
  add column if not exists avatar_changed_at timestamptz not null default now();

comment on column public.profiles.avatar_changed_at is
  'When this account last changed how its avatar looks: something worn, '
  'taken off, or a body colour. A profile picture drawn before this is out '
  'of date.';

/**
 * Marks somebody's look as changed.
 *
 * `security definer` because it is fired by a trigger on `avatar_worn`,
 * whose own writes come through `security definer` functions under the
 * caller's identity - and `guard_profile_update` is watching `profiles`.
 * It leaves this column alone (it pins a named list and this is not on it),
 * which is the one bit of luck here and is why this is a column rather than
 * a change to the guard.
 */
create or replace function public.mark_avatar_changed()
returns trigger
language plpgsql security definer
set search_path = public, extensions as $$
begin
  update public.profiles
     set avatar_changed_at = clock_timestamp()
   where id = coalesce(new.user_id, old.user_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists avatar_worn_marks_the_profile on public.avatar_worn;
create trigger avatar_worn_marks_the_profile
  after insert or delete on public.avatar_worn
  for each row execute function public.mark_avatar_changed();

/**
 * And a colour change, which is the other half of how somebody looks.
 *
 * On `profiles` itself, so it is a `before update` that writes to the row
 * being written rather than a second statement - an `after update` that
 * updates `profiles` from a trigger on `profiles` is a loop.
 *
 * It reads `new.body`, which is what the row will actually hold: if
 * `guard_profile_update` has pinned the colours back because this was not
 * the owner editing, then nothing changed and nothing is marked. Trigger
 * order is alphabetical for the same timing, and `guard_profile_update`
 * sorts before this, so that is the order it runs in.
 */
create or replace function public.mark_body_changed()
returns trigger
language plpgsql
set search_path = public, extensions as $$
begin
  if new.body is distinct from old.body then
    new.avatar_changed_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists zz_body_marks_the_profile on public.profiles;
create trigger zz_body_marks_the_profile
  before update on public.profiles
  for each row execute function public.mark_body_changed();

commit;
