begin;

-- Three panels, one rank, and the one power that stops at the top
-- -----------------------------------------------------------------------
--
-- Staw wants three staff panels: superadmin, admin, moderator. Two of those
-- ranks already exist as `profiles.is_moderator` (0001) and
-- `profiles.is_admin` (0005), and roughly a hundred places read them. So the
-- rank is not re-modelled here: the top tier is added above the two that are
-- already there, and one function names the answer so a panel never has to
-- read three columns and guess the order.
--
-- The reason this migration exists at all, rather than waiting for the panel:
-- `admin_delete_account` is gated on `require_admin()`, so **today any admin
-- can delete any account**. Staw's rule is that deletion is a superadmin's,
-- and a rule that the database does not hold is not a rule. That is fixed
-- below, before anything is drawn.

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

comment on column public.profiles.is_superadmin is
  'The top rank. Granted in the database by somebody who already has it - '
  'never from a panel, because a panel that can promote only has to be '
  'stolen once. Implies admin and moderator everywhere.';

-- ------------------------------------------------------------- the rank

/**
 * What rank somebody holds: 'superadmin', 'admin', 'moderator' or 'none'.
 *
 * The three booleans are storage; this is the meaning. A panel asks this and
 * switches on one string, so the precedence - superadmin outranks admin
 * outranks moderator - is decided in one place instead of in every reader.
 */
create or replace function public.staff_rank(who uuid default auth.uid())
returns text
language sql stable security definer
set search_path = public, extensions as $$
  select case
    when p.is_superadmin then 'superadmin'
    when p.is_admin      then 'admin'
    when p.is_moderator  then 'moderator'
    else 'none'
  end
    from public.profiles p where p.id = coalesce(who, '00000000-0000-0000-0000-000000000000'::uuid)
$$;

grant execute on function public.staff_rank(uuid) to authenticated;

/**
 * My own rank, never null.
 *
 * `staff_rank` returns null for an id with no row - signed out, or an account
 * that has gone. A caller that treats null as "not staff" is correct and a
 * caller that forgets is wrong in the dangerous direction, so the panel's
 * entry point answers 'none' rather than nothing.
 */
create or replace function public.my_staff_rank()
returns text
language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(public.staff_rank(auth.uid()), 'none')
$$;

grant execute on function public.my_staff_rank to anon, authenticated;

-- `is_admin()` and `is_moderator()` have to keep answering yes for the ranks
-- above them, or adding a tier would quietly demote the person who holds it.
-- Both are replaced to read the implication rather than the single column.
create or replace function public.is_moderator()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(
    (select is_moderator or is_admin or is_superadmin
       from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(
    (select is_admin or is_superadmin from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
$$;

grant execute on function public.is_superadmin to authenticated;

create or replace function public.require_superadmin()
returns void language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  if not public.is_superadmin() then
    raise exception 'That is a superadmin''s to do.' using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.require_superadmin to authenticated;

-- ------------------------------------------------------- deletion moves up

/*
 * Deleting an account is the one action with no way back, so it is the one
 * action an admin loses.
 *
 * Replaced rather than dropped: the signature does not change, so every
 * caller keeps working and the only difference is who gets a refusal. The
 * refusal is a distinct message from `require_admin`'s, because "This is
 * staff only" told an admin nothing about why their click did nothing.
 */
create or replace function public.admin_delete_account(target uuid, why text)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare doomed public.profiles%rowtype;
begin
  perform public.require_superadmin();

  select * into doomed from public.profiles where id = target;
  if doomed.id is null then raise exception 'No such account.'; end if;
  if doomed.is_superadmin then
    raise exception 'A superadmin cannot be deleted from here.';
  end if;
  if target = auth.uid() then raise exception 'You cannot delete yourself.'; end if;
  if coalesce(btrim(why), '') = '' then
    raise exception 'Say why. This cannot be undone.';
  end if;

  -- Written before the deletion, not after: the reference goes null the
  -- moment the row is gone, and the name is the only thing left to say who
  -- this was.
  perform public.write_admin_log('delete-account', target, jsonb_build_object(
    'username', doomed.username, 'display_name', doomed.display_name, 'why', why
  ));

  delete from auth.users where id = target;
end;
$$;

-- An admin could suspend an admin's equal before; now the ceiling is the
-- rank above. Same shape as the deletion guard: you cannot reach sideways.
create or replace function public.admin_set_standing(
  target uuid,
  verified boolean default null,
  moderator boolean default null,
  suspended boolean default null,
  why text default null,
  staff_badge boolean default null
) returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare before public.profiles%rowtype;
begin
  perform public.require_admin();

  select * into before from public.profiles where id = target;
  if before.id is null then raise exception 'No such account.'; end if;

  if suspended is true and (before.is_admin or before.is_superadmin)
     and not public.is_superadmin() then
    raise exception 'Only a superadmin suspends staff with keys.';
  end if;
  if before.is_superadmin and suspended is true then
    raise exception 'A superadmin cannot be suspended from here.';
  end if;

  update public.profiles
     set is_verified     = coalesce(verified,  is_verified),
         is_moderator    = coalesce(moderator, is_moderator),
         is_suspended    = coalesce(suspended, is_suspended),
         has_staff_badge = coalesce(staff_badge, has_staff_badge)
   where id = target;

  perform public.write_admin_log('standing', target, jsonb_build_object(
    'verified', verified, 'moderator', moderator, 'suspended', suspended,
    'staff_badge', staff_badge, 'why', why
  ));
end;
$$;

-- The two accounts Staw named. By username rather than by id because the ids
-- differ between here and production, and `where not is_superadmin` so
-- re-applying this file is not a write.
update public.profiles
   set is_superadmin = true, is_admin = true
 where username in ('kobblon', 'stawrer')
   and not is_superadmin;

commit;
