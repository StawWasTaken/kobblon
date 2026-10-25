begin;

/*
 * What a rank may reach, and two accounts that cannot be demoted.
 *
 * Staw, 25 October: "for the staff panel, theres multiple ranks; mods,
 * admins, superadmins, make that everything restricted to admins right now
 * are restricted to superadmins, and add more pages restrictions for only
 * admins+, ofc make sure that by default and its not possible to modify it,
 * the accounts stawrer and kobblon (usernames) are superadmins".
 *
 * Three bands, and the console draws the same three:
 *
 *   * **Moderator** - casework. Reports, appeals, support, screening, the
 *     forum, somebody's standing. Work that arrives.
 *   * **Admin** - the rules themselves. What the word filter catches, and
 *     what happens to a Community. Both of those were already refused to a
 *     moderator by the database while the console drew them for one, which
 *     is the console lying; the panel moves up to meet the function rather
 *     than the function moving down to meet the panel.
 *   * **Superadmin** - anything that moves Brix, speaks to everybody,
 *     changes what the machine is allowed to do, or changes the state of
 *     the site itself. None of it is undone by apologising afterwards.
 *
 * How the re-gating is done is worth reading before judging it. Every
 * function below is rewritten from `pg_get_functiondef` rather than from a
 * body copied into this file, because several of them - `admin_set_standing`
 * most of all - have been replaced three times since they were written, and
 * pasting any one of those versions here would quietly revert the other
 * two. This changes the gate and nothing else, and it fails loudly on a
 * function whose gate it cannot find instead of leaving it open.
 */

-- ----------------------------------------------------- the two house names

/**
 * The accounts that hold the top rank and cannot be moved off it.
 *
 * `is_kobblon` already did this for the house account alone. This is the
 * same idea with Staw's own account in it, and it is by username on
 * purpose: the ids differ between the live database and any copy of it, and
 * a migration that hard-codes a uuid is a migration that protects nobody on
 * the second database it is run against.
 */
create or replace function public.is_house_account(who uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select exists (
    select 1 from public.profiles p
     where p.id = who
       and lower(p.username) in ('stawrer', 'kobblon', 'kobbleston')
  );
$$;

grant execute on function public.is_house_account(uuid) to authenticated;

-- They hold it from here on, whatever they held before.
update public.profiles
   set is_superadmin = true, is_admin = true, is_moderator = true
 where lower(username) in ('stawrer', 'kobblon', 'kobbleston')
   and not (is_superadmin and is_admin and is_moderator);

/*
 * And they keep holding it.
 *
 * The guard is where this belongs rather than a policy: `set_staff_rank`,
 * `admin_set_standing` and anything else reaching for `profiles` all write
 * through this one trigger, so a row that cannot be demoted here cannot be
 * demoted at all - including by the service role, which is why the house
 * rows are pinned above the `auth.uid() is null` exit rather than below it.
 *
 * The second half is a hole that was open until today and has nothing to do
 * with the ask: the guard returned early for any admin, on any row, and the
 * only row an admin can update directly is their own - so **an admin could
 * make themself a superadmin** by writing to their own profile. 0172 said
 * the top rank is granted in the database and never from a panel; it was
 * true of the panel and not of the table. Rank is now pinned on your own
 * row whatever you are, and `set_staff_rank` - which writes to somebody
 * else's row, never your own - is unaffected.
 */
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  /*
   * The name on the row being written, not the one in the table: a rename
   * into one of these is the row's first chance to hold the rank, and
   * `is_house_account` would still be reading the old name at this point.
   */
  if lower(coalesce(new.username, '')) in ('stawrer', 'kobblon', 'kobbleston') then
    new.is_superadmin := true;
    new.is_admin      := true;
    new.is_moderator  := true;
  end if;

  if auth.uid() is null then return new; end if;

  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.standing', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.community', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.appearance', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then
    -- Nobody promotes themself by editing their own row.
    if new.id = auth.uid() then
      new.is_superadmin := old.is_superadmin;
      new.is_admin      := old.is_admin;
      new.is_moderator  := old.is_moderator;
    end if;
    return new;
  end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;
  new.is_banned     := old.is_banned;

  new.suspended_until := old.suspended_until;

  -- On its way out, and when. Written by the closing functions only.
  new.closed_at     := old.closed_at;
  new.closed_by     := old.closed_by;
  new.closed_reason := old.closed_reason;
  new.erase_after   := old.erase_after;

  new.pixels := old.pixels;

  new.content_id := old.content_id;
  new.created_at := old.created_at;

  new.has_email         := old.has_email;
  new.must_set_password := old.must_set_password;

  new.primary_community := old.primary_community;

  new.appearance := old.appearance;

  return new;
end;
$$;

/*
 * The appointing panel refuses both of them by name.
 *
 * 0229 refused the house account through `is_kobblon`. The same sentence,
 * now covering Staw's account too - the guard above would put the rank back
 * anyway, but a panel that reports success and changes nothing is worse
 * than one that says no.
 */
create or replace function public.set_staff_rank(target uuid, rank text)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  was text;
  them record;
begin
  perform public.require_superadmin();

  if rank not in ('none', 'moderator', 'admin') then
    raise exception 'A rank set from here is none, moderator or admin.';
  end if;

  if target = auth.uid() then
    raise exception 'Somebody else has to do that one.';
  end if;

  select id, username, is_superadmin into them
    from public.profiles where id = target;

  if them.id is null then
    raise exception 'There is no account with that number.';
  end if;

  if them.is_superadmin then
    raise exception 'That account is a superadmin. That rank is granted in the database, not here.';
  end if;

  if public.is_house_account(target) then
    raise exception 'That account is not something a panel changes.';
  end if;

  was := public.staff_rank(target);
  if was = rank then
    return was;
  end if;

  update public.profiles
     set is_admin = (rank = 'admin'),
         is_moderator = (rank in ('admin', 'moderator'))
   where id = target;

  perform public.write_admin_log('staff_rank', target,
    jsonb_build_object('was', was, 'now', rank));

  insert into public.notifications (user_id, kind, body)
  values (target, 'system',
    case rank
      when 'none' then 'Your staff access has been removed.'
      when 'moderator' then 'You are a Kobblon moderator. The staff console is on your account menu.'
      else 'You are a Kobblon admin. The staff console is on your account menu.'
    end);

  return rank;
end $$;

revoke all on function public.set_staff_rank(uuid, text) from public;
grant execute on function public.set_staff_rank(uuid, text) to authenticated;

-- ------------------------------------------- what used to be an admin's job

/*
 * Every function behind a panel that is now a superadmin's, re-gated.
 *
 * Four shapes of gate are in use across the migrations that wrote these -
 * `require_admin()`, `is_admin()`, and two spellings of reading the column
 * by hand - so all four are replaced. A function whose definition carries
 * none of them stops this migration rather than being skipped, because a
 * gate that was not found is a gate that is still open; a function that
 * already says superadmin is left alone, which is what makes this safe to
 * run twice.
 */
do $$
declare
  wanted text[] := array[
    -- Economy: Brix in circulation, handouts, limiteds.
    'admin_move_brix', 'economy_now', 'economy_flow', 'economy_by_kind',
    'limited_market', 'set_limited',
    -- Announce and Notice: speaking to one person, or to everybody.
    'admin_notify', 'admin_notify_everyone', 'put_up_notice', 'take_down_notice',
    -- Machine: what Kobby is allowed to decide.
    'set_ai_settings',
    -- Record: what staff have done.
    'staff_record', 'staff_record_kinds',
    -- People: standing, and an account on its way back.
    'admin_set_standing', 'reopen_account'
  ];
  one record;
  source text;
  changed text;
begin
  for one in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any (wanted)
  loop
    source := one.def;

    /*
     * Already done - and what "already" is asked carefully, because the
     * first version of this asked whether the definition mentioned
     * `is_superadmin` anywhere and `admin_set_standing` mentions it in its
     * ceiling checks three lines below a `require_admin()` gate. It was
     * skipped, silently, by a test that was there and looked at the wrong
     * thing. The question is whether an admin-level gate is still in it.
     */
    if source not like '%public.require_admin()%'
       and source not like '%public.is_admin()%'
       and source not like '%(select is_admin from public.profiles%' then
      continue;
    end if;

    changed := replace(source, 'public.require_admin()', 'public.require_superadmin()');
    changed := replace(changed, 'public.is_admin()', 'public.is_superadmin()');
    changed := replace(changed,
      'coalesce((select is_admin from public.profiles where id = me), false)',
      'public.is_superadmin()');
    changed := replace(changed,
      'coalesce((select is_admin from public.profiles where id = auth.uid()), false)',
      'public.is_superadmin()');

    if changed = source then
      raise exception
        'public.% has no gate this migration knows how to raise. Look at it by hand.',
        one.proname;
    end if;

    execute changed;
  end loop;
end $$;

/*
 * The shutters name their two ranks rather than calling a helper, so they
 * are done by hand. 0272 wrote `rank not in ('admin', 'superadmin')`
 * deliberately, to say the ranks out loud; this says one of them.
 */
create or replace function public.set_maintenance(shut boolean, words text default null)
returns public.site_state
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rank text := public.my_staff_rank();
  answer public.site_state;
begin
  if rank <> 'superadmin' then
    raise exception 'Only a superadmin can put the site into maintenance.';
  end if;

  if words is not null and char_length(words) > 300 then
    raise exception 'That notice is too long.';
  end if;

  update public.site_state
     set maintenance = shut,
         note = nullif(btrim(coalesce(words, '')), ''),
         set_by = auth.uid(),
         set_at = now()
   where only_row
  returning * into answer;

  return answer;
end;
$$;

revoke all on function public.set_maintenance(boolean, text) from public;
grant execute on function public.set_maintenance(boolean, text) to authenticated;

/*
 * The machine's settings are read by every moderator and written by nobody
 * below a superadmin. The read policy stays where it is: a moderator seeing
 * that the machine is off explains a queue that is not moving.
 */

/*
 * Lifting a suspension, which is a moderator's.
 *
 * It has to be its own function now. The console drew "Lift the suspension"
 * for a moderator and called `admin_set_standing` behind it, which has been
 * an admin's since 0099 and is a superadmin's from this file - so the button
 * has been telling moderators no for as long as it has existed, and moving
 * the function up without this would have made that permanent.
 *
 * `suspend_account` is a moderator's and this is its other half, with the
 * same ceiling: you cannot reach sideways or upwards. The machine is not
 * given it at all - ONLY WARNINGS AND SUSPENSIONS, and an AI that can lift
 * what it imposed is an AI that moderates nobody.
 */
create or replace function public.lift_suspension(target uuid, why text default null)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare they public.profiles%rowtype;
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into they from public.profiles where id = target;
  if they.id is null then raise exception 'No such account.'; end if;

  if (they.is_moderator or they.is_admin or they.is_superadmin)
     and not public.is_superadmin() then
    raise exception 'Only a superadmin lifts a suspension on staff.';
  end if;

  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set is_suspended = false, suspended_until = null
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.write_admin_log('lift_suspension', target,
    jsonb_build_object('why', nullif(btrim(coalesce(why, '')), '')));
end $$;

revoke all on function public.lift_suspension(uuid, text) from public;
grant execute on function public.lift_suspension(uuid, text) to authenticated;

-- ------------------------------------------------- a code worth ten minutes

/*
 * A sign-in code lives ten minutes, not two.
 *
 * Staw: pressing Play should be the whole of signing in. Two minutes is
 * long enough for a window that is already open and not long enough for one
 * that has to start cold, update itself and ask Windows for a protocol
 * handler - and what the person sees when it runs out is a sign-in page,
 * which is the one thing this was built to avoid. The page has said ten
 * minutes since it was written; the table said two.
 *
 * It is still single-use, still tied to one application, and still worth
 * nothing once claimed, which is what makes it safe to put in a link.
 */
alter table public.app_sign_in_codes
  alter column expires_at set default now() + interval '10 minutes';

commit;
