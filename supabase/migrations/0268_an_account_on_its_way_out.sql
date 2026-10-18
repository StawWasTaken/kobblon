begin;

/*
 * An account that is on its way out, and a Community that says it is shut.
 *
 * Two loose ends from the round before.
 *
 * The first is the one named in that round's own handoff as missing:
 * **accounts still deleted immediately.** `admin_delete_account` dropped the
 * `auth.users` row there and then, so a mistake, a compromised staff
 * account or a decision somebody wanted back had nothing to come back to.
 * Communities got two months in 0266 and `held_for()` was written generic
 * so that accounts could take the same wait. They take it here.
 *
 * The second is what the pages show. Staw sent two pictures: a closed
 * Community reading "This community has been locked", and a closed account
 * reading "Account Deleted" with a picture that could not load. Neither was
 * possible, for the same reason in both cases - the row was hidden, so the
 * page had nothing to say it with and fell through to "no such thing".
 * A thing that was here and is going says so; only a ban goes dark.
 */

/* ------------------------------------------------- a Community that is shut */

/*
 * A closed Community stays readable.
 *
 * `is_removed` has always meant invisible, and 0266's close set it, so the
 * two months were served behind a 404: members who wondered where it had
 * gone were told it had never existed. Closed is a different thing from
 * removed and now reads differently - the row comes back, carrying
 * `closed_at`, and the page shows the one sentence and nothing else.
 */
drop policy if exists communities_read on public.communities;
create policy communities_read on public.communities
  for select using (
    (is_public and not is_removed)
    or closed_at is not null
    or owner_id = auth.uid()
    or public.is_moderator()
  );

/* --------------------------------------------- an account that is on its way */

alter table public.profiles
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_reason text,
  add column if not exists erase_after timestamptz;

/*
 * The guard again, whole, with the four new columns pinned.
 *
 * Nobody schedules their own deletion and nobody calls it off, which is the
 * entire point of a wait: an account taken by somebody who should not have
 * it must not be able to erase it, and an account closed in error must not
 * be able to erase itself before anybody notices.
 */
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
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

  if public.is_admin() then return new; end if;

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

/**
 * Deleting an account, which now means scheduling it.
 *
 * The name and the arguments are unchanged on purpose: the console calls
 * this, the admin log already has a word for it, and renaming it would have
 * meant a console that still pointed at the old immediate one. What changed
 * is underneath - the row stays, flagged, locked out and dated, and the
 * `auth.users` row goes only when `erase_account` or the sweep says so.
 *
 * It does not set `is_banned`. A ban hides a profile; this does not hide
 * it, it marks it - the page reads "Account Deleted" with a picture that
 * will not load, which is what somebody looking for a friend who is gone
 * needs to see instead of a 404.
 */
create or replace function public.admin_delete_account(target uuid, why text)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare doomed public.profiles%rowtype;
begin
  perform public.require_admin();

  select * into doomed from public.profiles where id = target;
  if doomed.id is null then raise exception 'No such account.'; end if;
  if doomed.is_admin then raise exception 'An admin cannot be deleted from here.'; end if;
  if target = auth.uid() then raise exception 'You cannot delete yourself.'; end if;
  if coalesce(btrim(why), '') = '' then
    raise exception 'Say why.';
  end if;
  if doomed.closed_at is not null then
    raise exception 'That account is already on its way out.';
  end if;

  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set closed_at = now(),
         closed_by = auth.uid(),
         closed_reason = btrim(why),
         erase_after = now() + public.held_for(),
         is_suspended = true,
         suspended_until = null
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.send_mail(
    target, 'moderation', 'This account is being deleted',
    btrim(why) || E'\n\nIt is kept for two months before the data goes for '
      || 'good. If this is wrong, say so from the standing page.', '/standing');

  perform public.write_admin_log('close-account', target, jsonb_build_object(
    'username', doomed.username, 'display_name', doomed.display_name,
    'why', btrim(why), 'erase_after', now() + public.held_for()
  ));
end;
$$;

grant execute on function public.admin_delete_account(uuid, text) to authenticated;

/** Calling it off, while there is still something to call off. */
create or replace function public.reopen_account(target uuid, why text default null)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare it public.profiles%rowtype;
begin
  perform public.require_admin();

  select * into it from public.profiles where id = target;
  if it.id is null then raise exception 'No such account.'; end if;
  if it.closed_at is null then raise exception 'That account is not on its way out.'; end if;

  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set closed_at = null, closed_by = null, closed_reason = null,
         erase_after = null, is_suspended = false, suspended_until = null
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.send_mail(
    target, 'moderation', 'Your account is staying',
    coalesce(btrim(why), 'The decision to delete this account has been called off.'),
    '/standing');

  perform public.write_admin_log('reopen-account', target,
    jsonb_build_object('why', why, 'was_closed_at', it.closed_at));
end;
$$;

grant execute on function public.reopen_account(uuid, text) to authenticated;

/**
 * The real one, and the sentence is deliberately 0266's own.
 *
 * Superadmin, and only on something already closed, because the two months
 * are the whole of what makes a deletion recoverable and a door that skips
 * them is the door that gets pressed by mistake at two in the morning.
 */
create or replace function public.erase_account(target uuid)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare it public.profiles%rowtype;
begin
  perform public.require_superadmin();

  select * into it from public.profiles where id = target;
  if it.id is null then raise exception 'No such account.'; end if;
  if it.closed_at is null then
    raise exception 'Close it first. The two months are what makes this undoable.';
  end if;

  perform public.write_admin_log('erase-account', target, jsonb_build_object(
    'username', it.username, 'display_name', it.display_name,
    'closed_at', it.closed_at, 'why', it.closed_reason
  ));

  delete from auth.users where id = target;
end;
$$;

grant execute on function public.erase_account(uuid) to authenticated;

/**
 * The two months coming up, for accounts.
 *
 * Same shape as `sweep_closed_communities` and same reason for not calling
 * `erase_account`: that one asks who is calling, and a schedule is nobody.
 */
create or replace function public.sweep_closed_accounts()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  gone integer := 0;
  one public.profiles%rowtype;
begin
  for one in
    select * from public.profiles
     where closed_at is not null and erase_after is not null and erase_after <= now()
  loop
    insert into public.admin_log (admin_id, action, subject_id, subject_label, detail)
    values (null, 'account_erased_on_time', null, one.username,
            jsonb_build_object('account', one.id, 'display_name', one.display_name,
                               'closed_at', one.closed_at, 'why', one.closed_reason));
    delete from auth.users where id = one.id;
    gone := gone + 1;
  end loop;
  return gone;
end $$;

revoke execute on function public.sweep_closed_accounts() from anon, authenticated;

/* --------------------------------------------- the console can see it coming */

/*
 * The People panel, told about the wait.
 *
 * Two columns and one filter. Without them a staff member pressing delete
 * saw the row stay exactly where it was, with no sign anything had
 * happened - which is how somebody presses it a second time.
 *
 * `create or replace` cannot widen a `returns table`, so the old one goes
 * first and every grant on it is re-made below.
 */
drop function if exists public.admin_find_people(
  text, text, integer, integer, timestamptz, timestamptz, text, integer);

create function public.admin_find_people(
  search text default null,
  only_kind text default null,       -- staff | admin | moderator | verified
                                     -- guest | suspended | banned | klub
                                     -- no_email | real
  min_pixels integer default null,
  max_pixels integer default null,
  joined_since timestamptz default null,
  joined_before timestamptz default null,
  order_by text default 'rank',      -- rank | new | old | rich | poor | name
  how_many integer default 50
)
returns table(
  id uuid, username text, display_name text, avatar_url text,
  content_id bigint, pixels integer, is_verified boolean, is_moderator boolean,
  is_suspended boolean, is_admin boolean, has_staff_badge boolean,
  is_guest boolean, created_at timestamptz,
  is_banned boolean,
  suspended_until timestamptz,
  past_sanctions integer,
  /* New here: both answer a question the panel could not ask before. */
  is_superadmin boolean,
  has_email boolean,
  must_set_password boolean,
  /* On its way out, and the day the data actually goes. */
  closed_at timestamptz,
  erase_after timestamptz
)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  term text := nullif(btrim(coalesce(search, '')), '');
  kind text := nullif(btrim(lower(coalesce(only_kind, ''))), '');
  take integer := least(greatest(coalesce(how_many, 50), 1), 200);
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.display_name, p.avatar_url, p.content_id,
           p.pixels, p.is_verified, p.is_moderator, p.is_suspended,
           p.is_admin, p.has_staff_badge, p.is_guest, p.created_at,
           exists (select 1 from public.violations v
                    where v.user_id = p.id and v.action = 'termination'
                      and not v.is_void),
           p.suspended_until,
           (select count(*)::integer from public.violations v
             where v.user_id = p.id and not v.is_void),
           p.is_superadmin,
           p.has_email,
           p.must_set_password,
           p.closed_at,
           p.erase_after
      from public.profiles p
     where (term is null
            or p.username ilike '%' || term || '%'
            or p.display_name ilike '%' || term || '%'
            or p.content_id::text = term)
       and (kind is null or case kind
             when 'staff'     then p.is_admin or p.is_superadmin or p.is_moderator
             when 'admin'     then p.is_admin or p.is_superadmin
             when 'moderator' then p.is_moderator
             when 'verified'  then p.is_verified
             when 'guest'     then p.is_guest
             when 'real'      then not p.is_guest
             when 'suspended' then p.is_suspended
             when 'banned'    then exists (select 1 from public.violations v
                                            where v.user_id = p.id
                                              and v.action = 'termination'
                                              and not v.is_void)
             when 'no_email'  then not p.has_email
             when 'closing'   then p.closed_at is not null
             /*
              * The Klub does not exist yet. It is named here because the
              * filter is written once and Staw said it is coming - and a
              * filter that quietly returns everybody would be worse than
              * one that returns nobody, which is at least true today.
              */
             when 'klub'      then false
             else true
           end)
       and (min_pixels is null or p.pixels >= min_pixels)
       and (max_pixels is null or p.pixels <= max_pixels)
       and (joined_since is null or p.created_at >= joined_since)
       and (joined_before is null or p.created_at < joined_before)
     order by
       case when order_by = 'rank' then 0 end,
       case when order_by = 'rank' then p.is_superadmin end desc nulls last,
       case when order_by = 'rank' then p.is_admin end desc nulls last,
       case when order_by = 'rank' then p.is_moderator end desc nulls last,
       case when order_by in ('rank', 'new') then p.created_at end desc nulls last,
       case when order_by = 'old' then p.created_at end asc nulls last,
       case when order_by = 'rich' then p.pixels end desc nulls last,
       case when order_by = 'poor' then p.pixels end asc nulls last,
       case when order_by = 'name' then lower(p.username) end asc nulls last
     limit take;
end $$;

grant execute on function public.admin_find_people(
  text, text, integer, integer, timestamptz, timestamptz, text, integer
) to authenticated;

commit;
