begin;

/*
 * A suspension nobody feels, and a ban nothing could hand out.
 *
 * `suspend_account` has set `is_suspended` since 0178 and the website has
 * never once looked at it: a suspended account signed in, posted, bought
 * things and chatted exactly as before. A sanction that only exists in a
 * table is not a sanction, it is a note.
 *
 * Three things here, and the third is the one that matters:
 *
 *   ban_account          closing an account for good, by a human only
 *   my_account_standing  everything the lockout card has to say, in one row
 *   reactivate_my_account coming back the moment a suspension has run out
 *
 * **The machine may not ban.** Staw, in capitals: "ONLY WARNINGS AND
 * SUSPENSIONS, AI CANNOT DELETE AN ACCOUNT". `is_the_worker()` is refused
 * here by name rather than left to the staff check, because the worker holds
 * a key that passes a staff check - that is the whole reason it has one.
 */

/*
 * First, the reason none of this would have worked: **a suspension has not
 * actually suspended anybody since migration 0215.**
 *
 * 0178 added a second trusted flag to `guard_profile_update` -
 * `kobbleston.standing` - so that `suspend_account`, which is security
 * definer and whose caller is a moderator rather than an admin, could write
 * `is_suspended` without the guard pinning it back. 0215 rewrote the whole
 * guard to teach it one new column and wrote it out from the version that
 * did not have that branch. Nothing failed. `suspend_account` went on
 * returning cleanly, the violation row went on being written, the admin log
 * went on saying "suspend", and the flag went on being whatever it was.
 *
 * CLAUDE.md's third trap exactly, and it got back in through a rewrite of
 * the guard rather than through the function - which is worth saying,
 * because the check that catches it is reading the row back under a real
 * identity, and nobody re-runs that check when they add a column.
 */
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

  /*
   * The same promise for a sanction. Separate from the money flag so that a
   * function allowed to move Brix is not thereby allowed to suspend
   * somebody: one flag for two unrelated powers is one flag too few.
   */
  if current_setting('kobbleston.standing', true) = 'on' then
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

create or replace function public.ban_account(
  target uuid, said text, which_rule text default 'other'
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare they public.profiles%rowtype;
begin
  /*
   * The machine first, and on its own line. A ban is forever and the thing
   * that cannot be allowed to hand one out is the thing that never sleeps.
   */
  if public.is_the_worker() then
    raise exception 'The moderation worker cannot close an account. A person decides that.'
      using errcode = '42501';
  end if;
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;
  if said is null or char_length(btrim(said)) < 10 then
    raise exception 'Say why, in a sentence the account is allowed to read.';
  end if;

  select * into they from public.profiles where id = target;
  if they.id is null then raise exception 'No such account.'; end if;
  if they.is_superadmin then
    raise exception 'A superadmin cannot be closed.';
  end if;
  if (they.is_admin or they.is_moderator) and not public.is_superadmin() then
    raise exception 'Only a superadmin closes a staff account.';
  end if;

  insert into public.violations (user_id, rule, action, reason, moderator_id)
  values (target, which_rule, 'termination', btrim(said), auth.uid());

  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set is_suspended = true, suspended_until = null
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.send_mail(
    target, 'moderation', 'This account has been closed',
    btrim(said) || E'\n\nYou can ask for this to be looked at again from the '
      || 'standing page.', '/standing');

  perform public.write_admin_log('ban', target, jsonb_build_object('why', btrim(said)));
end $$;

grant execute on function public.ban_account(uuid, text, text) to authenticated;

/*
 * Undoing one. Named `lift_account_ban` and not `lift_ban`, which has meant
 * lifting a Community's ban on somebody since long before this - two
 * functions with one name and different jobs is the kind of thing that gets
 * called correctly for a year and then once by the wrong page.
 *
 * A termination is voided rather than deleted - the record of
 * what was decided stays, and `my_standing` works out where somebody stands
 * from what is still standing, so voiding is what putting them back means.
 */
create or replace function public.lift_account_ban(target uuid, said text)
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare how_many integer;
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  update public.violations
     set is_void = true, void_reason = left(coalesce(said, 'Lifted.'), 400)
   where user_id = target and action = 'termination' and not is_void;
  get diagnostics how_many = row_count;

  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set is_suspended = false, suspended_until = null
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  if how_many > 0 then
    perform public.send_mail(
      target, 'moderation', 'Your account is open again',
      coalesce(said, 'The decision to close this account has been lifted.'),
      '/standing');
  end if;

  perform public.write_admin_log('unban', target, jsonb_build_object('why', said));
  return how_many;
end $$;

grant execute on function public.lift_account_ban(uuid, text) to authenticated;

/**
 * Everything the card that locks somebody out has to say, in one row.
 *
 * `my_standing` answers where an account stands; this answers what it is
 * being told and what it can do about it, which is a different question and
 * was being assembled out of three calls and a guess. One row: the level,
 * the decision behind it in the words the account is allowed to read, when
 * it ends, whether an appeal has been made already, and whether the thing
 * has simply run out and they can let themselves back in.
 */
create or replace function public.my_account_standing()
returns table (
  level text,
  headline text,
  why text,
  rule text,
  decided_at timestamptz,
  until timestamptz,
  violation_id bigint,
  appeal_status text,
  can_appeal boolean,
  can_return boolean
)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  suspended boolean;
  ends timestamptz;
  shut record;
  held record;
  appeal record;
begin
  if me is null then return; end if;

  select coalesce(p.is_suspended, false), p.suspended_until
    into suspended, ends
    from public.profiles p where p.id = me;

  -- The closure, if there is one. It outranks everything else there is.
  select v.id, v.reason, v.rule, v.created_at into shut
    from public.violations v
   where v.user_id = me and v.action = 'termination' and not v.is_void
   order by v.created_at desc limit 1;

  -- Otherwise the decision the suspension came from, newest first.
  select v.id, v.reason, v.rule, v.created_at, v.expires_at into held
    from public.violations v
   where v.user_id = me and not v.is_void
     and v.action in ('suspension', 'feature_block')
     and (v.expires_at is null or v.expires_at > now())
   order by v.created_at desc limit 1;

  select a.status into appeal from public.appeals a
   where a.violation_id = coalesce(shut.id, held.id) and a.user_id = me;

  return query select
    case
      when shut.id is not null then 'banned'
      when suspended then 'suspended'
      when held.id is not null then 'limited'
      else 'clear'
    end,
    case
      when shut.id is not null then 'This account has been closed.'
      when suspended and ends is not null and ends <= now()
        then 'Your suspension has run out.'
      when suspended then 'This account is suspended.'
      when held.id is not null then 'Some things are switched off on this account.'
      else 'Nothing on record. Carry on.'
    end,
    coalesce(shut.reason, held.reason),
    coalesce(shut.rule, held.rule),
    coalesce(shut.created_at, held.created_at),
    case when shut.id is not null then null else coalesce(ends, held.expires_at) end,
    coalesce(shut.id, held.id),
    appeal.status,
    /*
     * One appeal per decision, which is the unique index on `appeals` and
     * not a rule this invents. Nothing to appeal against is not the same
     * answer as having appealed already, so both are reported.
     */
    coalesce(shut.id, held.id) is not null and appeal.status is null,
    suspended and shut.id is null and ends is not null and ends <= now();
end $$;

grant execute on function public.my_account_standing() to authenticated;

/**
 * Letting yourself back in when the suspension has run out.
 *
 * A suspension with an end on it ends by itself, and before this it ended
 * only if a moderator happened to look. Refused while it is still running,
 * refused outright on a closed account, and it says which - a door that
 * does nothing and does not say why is worse than a locked one.
 */
create or replace function public.reactivate_my_account()
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  suspended boolean;
  ends timestamptz;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if exists (
    select 1 from public.violations v
     where v.user_id = me and v.action = 'termination' and not v.is_void
  ) then
    raise exception 'This account has been closed. Ask for it to be looked at again.';
  end if;

  select coalesce(p.is_suspended, false), p.suspended_until
    into suspended, ends
    from public.profiles p where p.id = me;

  if not suspended then return false; end if;
  if ends is null then
    raise exception 'This suspension does not have an end on it. Ask for it to be looked at again.';
  end if;
  if ends > now() then
    raise exception 'This suspension has not run out yet.';
  end if;

  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set is_suspended = false, suspended_until = null
   where id = me;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.write_admin_log('reactivate', me, jsonb_build_object('ran_out', ends));
  return true;
end $$;

grant execute on function public.reactivate_my_account() to authenticated;

commit;
