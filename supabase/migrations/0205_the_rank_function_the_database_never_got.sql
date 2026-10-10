begin;

/*
 * The rank function the database never got.
 *
 * 0203 would not apply: `function public.staff_rank(uuid) does not exist`.
 * And the staff console, asking `my_staff_rank()`, sent a superadmin home.
 * One cause behind both: 0172 - the migration that added the third rank -
 * is not on the live database. Nothing in this repository drops those
 * functions, and they are defined nowhere else, so the only way they can be
 * missing is that the file was never applied.
 *
 * It hid for weeks because every caller masked it. `ReportTriage` was handed
 * `rank.data ?? 'moderator'`, so a failed call looked exactly like a
 * moderator; the console gated on `profiles.is_admin` and never asked. The
 * first thing to ask the question and believe the answer was the new console,
 * which is how a superadmin ended up locked out of their own panel.
 *
 * So this re-asserts 0172's core, idempotently, and is safe to run whatever
 * state the database is in: if 0172 did land, every statement here is a
 * no-op replacement with the same text.
 *
 * Run this BEFORE re-running 0203.
 *
 * The lesson, and it is the second trap again from a new angle: a guard that
 * is there, is checked, and answers from a failed call. `?? 'moderator'` is
 * not a default, it is a silent demotion - and the one direction a rank
 * should never fail in is quietly.
 */

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

comment on column public.profiles.is_superadmin is
  'The top rank. Granted in the database by somebody who already has it - '
  'never from a panel, because a panel that can promote only has to be '
  'stolen once. Implies admin and moderator everywhere.';

-- --------------------------------------------- the three, and what they imply

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

-- ---------------------------------------------------------------- the rank

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
 * My own rank, never null. `staff_rank` returns null for an id with no row -
 * signed out, or an account that has gone - and a caller that treats null as
 * "not staff" is correct where one that forgets is wrong in the dangerous
 * direction, so this answers 'none' rather than nothing.
 */
create or replace function public.my_staff_rank()
returns text
language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(public.staff_rank(auth.uid()), 'none')
$$;

grant execute on function public.my_staff_rank to anon, authenticated;

/**
 * Deleting an account is the one action with no way back, so it is the one
 * action an admin loses. Re-asserted here because it is the point of 0172:
 * if that file never landed, **any admin can still delete any account**, and
 * a rule the database does not hold is not a rule.
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
  if doomed.is_admin then
    raise exception 'An admin cannot be deleted from here.';
  end if;

  perform public.write_admin_log('delete_account', target,
    jsonb_build_object('why', why, 'username', doomed.username));

  delete from auth.users where id = target;
end;
$$;

commit;
