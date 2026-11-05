begin;

-- Brix could not move. My fault, and it was live.
--
-- 0097 closed a real hole - anybody could make themselves an admin and print
-- themselves Brix - by pinning `pixels`, `is_admin` and the rest back to
-- their old values on any update by somebody who is not staff.
--
-- `move_pixels` is `security definer`, but that changes the *rights* a
-- function runs with, not who `auth.uid()` says is asking. So when an
-- ordinary person bought something, the function moved their balance and the
-- guard put it straight back. Buying, selling, a creator being paid, ad
-- spend, a username change: every one of them reported success and moved
-- nothing at all.
--
-- The check in 0097 that was supposed to catch this passed for the wrong
-- reason. It ran with nobody signed in, so `auth.uid()` was null, so the
-- guard exempted it - the one case where the bug cannot happen. That is the
-- second time in this session a check has passed by coincidence, and both
-- times the fix was to make the check describe the real situation rather
-- than a convenient one.
--
-- The fix is the pattern this schema already uses in three places: a
-- transaction-local flag that a trusted function raises around its own
-- write. `guard_asset_update` has done exactly this with
-- `kobbleston.counting` since 0021. A person editing their own row through
-- PostgREST never sets it, so nothing is given away.

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if auth.uid() is null then return new; end if;

  /*
   * A function Kobblon trusts, in the middle of its own deliberate write.
   * Set with `true`, so it is transaction-local and cannot leak into
   * another request, and each of them turns it off again immediately.
   */
  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

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

  -- Identity the site assigns rather than the person.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

/*
 * The one door money goes through, saying so while it goes.
 *
 * The flag is lowered in the same breath it is raised, rather than left for
 * the transaction to end: a buy and a direct profile update can happen in
 * one request, and the second must not inherit the first's permission.
 */
create or replace function public.move_pixels(
  target uuid, delta integer, movement text, memo text default null
) returns integer language plpgsql security definer
  set search_path = public, extensions as $$
declare
  balance integer;
begin
  perform set_config('kobbleston.money', 'on', true);

  update public.profiles
     set pixels = pixels + delta
   where id = target
  returning pixels into balance;

  perform set_config('kobbleston.money', 'off', true);

  if balance is null then raise exception 'no such account'; end if;

  insert into public.pixel_transactions (user_id, amount, kind, note)
  values (target, delta, movement, memo);

  return balance;
end;
$$;

commit;
