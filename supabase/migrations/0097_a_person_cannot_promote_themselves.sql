begin;

-- A person cannot promote themselves.
--
-- Found while building the admin panel, by asking the question the roadmap
-- says to ask: is there anything we decide in JavaScript that the database
-- does not also decide.
--
-- `profiles_update_self` allows a person to update their own row and names
-- no columns, so every column was theirs to set. One PostgREST call, no
-- exploit, nothing clever:
--
--   update profiles
--      set is_admin = true, is_moderator = true, is_verified = true,
--          pixels = 999999
--    where id = auth.uid()
--
-- and it worked - proved against this schema before writing this, all four.
-- Anybody with an account was one request from being staff, from wearing the
-- verified badge, and from printing themselves unlimited Brix. Nothing in
-- the website offers those fields, which is exactly why it went unseen: the
-- browser never asks for them, and the browser was never the thing that
-- had to refuse.
--
-- Narrowing the policy would not have been enough on its own. A policy says
-- which rows may be written, not which columns, and `update ... set` reaches
-- every column of a row the policy allows. So the refusal is a trigger,
-- which is the same shape `guard_asset_update` already uses: the old value
-- is copied over the new one, field by field, for everything that is not the
-- person's to decide.
--
-- Copying rather than raising is deliberate and worth stating. A raise would
-- break every ordinary save that happens to send the whole row back - which
-- is what a form does - and would teach people that saving a profile is
-- flaky. Copying lets the honest update through untouched and quietly
-- discards the part that was never theirs.

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  /*
   * An admin acting through the panel goes through functions that raise
   * their own privileges deliberately; this is about what an ordinary
   * session may do to its own row. `session_user` is the database role, so a
   * migration or a service-role key is untouched by this and stays the way
   * staff tooling reaches these columns.
   */
  if auth.uid() is null then return new; end if;
  if coalesce((select is_admin from public.profiles where id = auth.uid()), false)
  then return new; end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_admin     := old.is_admin;
  new.is_moderator := old.is_moderator;
  new.is_verified  := old.is_verified;
  new.is_suspended := old.is_suspended;
  new.is_guest     := old.is_guest;

  -- Money. It moves through move_pixels, which writes a ledger row beside
  -- every change; a direct write would move the balance and leave no trace.
  new.pixels := old.pixels;

  -- Identity the site assigns rather than the person: the number on their
  -- profile, and when they arrived.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile
  before update on public.profiles
  for each row execute function public.guard_profile_update();

commit;
