begin;

-- The guard has to learn every column that means something
-- -----------------------------------------------------------------------
--
-- `profiles_update_self` lets a person write their own row, and
-- `guard_profile_update` (0097, 0105) is the only thing that stops that from
-- being a promotion. It pins the columns that were standing when it was
-- written: `is_admin`, `is_moderator`, `is_verified`, `is_suspended`,
-- `is_guest`, `pixels`, `content_id`, `created_at`.
--
-- 0172 added `is_superadmin` and 0173 added `suspended_until`, and the guard
-- knew about neither. Two holes, both opened by my own migrations an hour
-- ago:
--
--   * **`is_superadmin` was not pinned**, so any signed-in person could grant
--     themselves the top rank with an update to their own row - the exact
--     thing 0097 exists to prevent, reopened by adding a rank above the ones
--     it names.
--   * **`suspended_until` was not pinned.** `is_suspended` is pinned, so a
--     suspended person cannot clear it directly - but they could set their
--     own end time into the past, and then the next staff view calling
--     `lift_expired_suspensions` would clear the suspension for them. A guard
--     that pins the flag and not its expiry pins nothing.
--
-- The lesson, which is the third trap in `CLAUDE.md` wearing a fourth
-- disguise: **a guard that lists columns is a guard that goes stale every
-- time a column is added.** Nothing here can make it list itself, so the rule
-- is that a column added to `profiles` is pinned in the same migration or
-- deliberately named as the person's own.
--
-- The admin exemption also moves to `public.is_admin()`, which since 0172
-- answers yes for a superadmin too. Reading the column directly would have
-- pinned a superadmin's own writes if their `is_admin` column were ever
-- false.

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

  if public.is_admin() then return new; end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;

  -- The end of a suspension decides when `lift_expired_suspensions` lets go
  -- of it, so it is as much a part of the sanction as the flag is.
  new.suspended_until := old.suspended_until;

  -- Money. It moves through move_pixels, which writes a ledger row beside
  -- every change; a direct write would move the balance and leave no trace.
  new.pixels := old.pixels;

  -- Identity the site assigns rather than the person.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

commit;
