begin;

/*
 * Three moderation states somebody can actually read, and answer.
 *
 * Staw, on what was wrong with all three: nobody is to be signed out for a
 * warning, a suspension or a ban - they stay signed in so they can reach
 * their record, support and the appeal, which are the only doors that
 * matter once a decision has landed. And a warning had no answer to it at
 * all: it sat on the record, the account carried on as normal, and the
 * person was never once asked to say they had read it.
 *
 * What this adds:
 *
 *   is_banned            a closed account, as a column rather than a search
 *   acknowledged_at      the moment somebody said they had read a decision
 *   acknowledge_my_standing  a warning cleared by answering it, and a
 *                        suspension that has run out let go of the same way
 *
 * And what it takes away, which is the part Staw asked for by name: a
 * suspended profile stops being invisible to everybody else. A suspension
 * is a decision about what somebody may do, not a reason to pretend they
 * were never here. A closed account still goes dark.
 */

/*
 * Why a column and not a subquery on `violations`.
 *
 * `profiles_read` is on the read path of nearly every page on this site,
 * and the only thing that distinguishes a ban from a suspension today is
 * "has a termination that is not void" - which is a join, from inside a
 * row-level policy, on every row of every profile read anybody ever does.
 * The flag is written by the two functions that decide it and by nothing
 * else, and the guard below pins it for everybody who is not one of them.
 */
alter table public.profiles
  add column if not exists is_banned boolean not null default false;

update public.profiles p
   set is_banned = true
 where not p.is_banned
   and exists (
     select 1 from public.violations v
      where v.user_id = p.id and v.action = 'termination' and not v.is_void
   );

/* When somebody said they had read it. Null until they do. */
alter table public.violations
  add column if not exists acknowledged_at timestamptz;

/*
 * The guard, re-emitted whole with the new column in the pinned list.
 *
 * 0243 is the migration that explains why it is re-emitted whole and never
 * patched in the head: the one time somebody rewrote this function from a
 * copy that was missing a branch, suspensions silently stopped suspending
 * anybody for twenty-eight migrations.
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

  -- Closed for good. Written by ban_account and lift_account_ban, which
  -- raise the standing flag above, and by nothing else at all.
  new.is_banned := old.is_banned;

  new.suspended_until := old.suspended_until;

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
 * Who may see a profile.
 *
 * Was `not is_suspended`, which hid a suspended account from everybody for
 * as long as the suspension lasted - their page, their name beside their
 * posts, their face in a friend list. Staw: suspended and warned profiles
 * are to be viewable normally; a banned one still says the account is
 * closed. So the test is the ban, and the ban only.
 */
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (not is_banned or public.is_moderator());

/*
 * Closing an account, now writing the flag the policy reads.
 *
 * Re-emitted from 0243 with two lines changed, for the reason that
 * migration gives in its own first paragraph: the write and the guard are
 * one thing, and a function that sets a column the guard does not know
 * about returns cleanly having done nothing.
 */
create or replace function public.ban_account(
  target uuid, said text, which_rule text default 'other'
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare they public.profiles%rowtype;
begin
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
     set is_suspended = true, suspended_until = null, is_banned = true
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.send_mail(
    target, 'moderation', 'This account has been closed',
    btrim(said) || E'\n\nYou can ask for this to be looked at again from the '
      || 'standing page.', '/standing');

  perform public.write_admin_log('ban', target, jsonb_build_object('why', btrim(said)));
end $$;

grant execute on function public.ban_account(uuid, text, text) to authenticated;

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
     set is_suspended = false, suspended_until = null, is_banned = false
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

/*
 * Everything the card has to say, with the warning finally in it.
 *
 * Before this the function answered 'clear' to somebody who had just been
 * warned, because a warning sets no flag - so the one state the product
 * wanted a card and a checkbox for was the one state the server reported as
 * nothing at all. A warning that has not been acknowledged is a state.
 *
 * The return type changes, so the old one goes first: `create or replace`
 * cannot widen a `returns table`.
 */
drop function if exists public.my_account_standing();

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
  can_return boolean,
  can_acknowledge boolean,
  acknowledged boolean,
  is_banned boolean
)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  suspended boolean;
  closed boolean;
  ends timestamptz;
  shut record;
  held record;
  warned record;
  appeal record;
  ran_out boolean;
begin
  if me is null then return; end if;

  select coalesce(p.is_suspended, false), coalesce(p.is_banned, false),
         p.suspended_until
    into suspended, closed, ends
    from public.profiles p where p.id = me;

  select v.id, v.reason, v.rule, v.created_at into shut
    from public.violations v
   where v.user_id = me and v.action = 'termination' and not v.is_void
   order by v.created_at desc limit 1;

  select v.id, v.reason, v.rule, v.created_at, v.expires_at, v.acknowledged_at
    into held
    from public.violations v
   where v.user_id = me and not v.is_void
     and v.action in ('suspension', 'feature_block')
     and (v.expires_at is null or v.expires_at > now())
   order by v.created_at desc limit 1;

  -- The newest warning nobody has answered yet. A warning that has been
  -- acknowledged is over, and is not a state the card has anything to say
  -- about - it is history, and the standing page holds the history.
  select v.id, v.reason, v.rule, v.created_at into warned
    from public.violations v
   where v.user_id = me and not v.is_void
     and v.action = 'warning' and v.acknowledged_at is null
   order by v.created_at desc limit 1;

  select a.status into appeal from public.appeals a
   where a.violation_id = coalesce(shut.id, held.id, warned.id)
     and a.user_id = me;

  ran_out := suspended and not closed and ends is not null and ends <= now();

  return query select
    case
      when closed or shut.id is not null then 'banned'
      when suspended then 'suspended'
      when held.id is not null then 'limited'
      when warned.id is not null then 'warned'
      else 'clear'
    end,
    case
      when closed or shut.id is not null then 'This account has been closed.'
      when ran_out then 'Your suspension has run out.'
      when suspended then 'This account is suspended.'
      when held.id is not null then 'Some things are switched off on this account.'
      when warned.id is not null then 'You have been given a warning.'
      else 'Nothing on record. Carry on.'
    end,
    coalesce(shut.reason, held.reason, warned.reason),
    coalesce(shut.rule, held.rule, warned.rule),
    coalesce(shut.created_at, held.created_at, warned.created_at),
    case
      when closed or shut.id is not null then null
      else coalesce(ends, held.expires_at)
    end,
    coalesce(shut.id, held.id, warned.id),
    appeal.status,
    coalesce(shut.id, held.id, warned.id) is not null and appeal.status is null,
    ran_out,
    /*
     * What the checkbox is allowed to do. A warning is answerable the
     * moment it lands; a suspension only once the time on it is over; a
     * closed account never - that one is lifted by a person or not at all.
     */
    case
      when closed or shut.id is not null then false
      when suspended then ran_out
      else warned.id is not null
    end,
    /*
     * Whether the decision in front of them has already been answered.
     * Reported rather than inferred from the absence of a button, because
     * the card says "you acknowledged this on" and would otherwise have to
     * guess at it.
     */
    case
      when closed or shut.id is not null then false
      when warned.id is not null then false
      when held.id is not null then held.acknowledged_at is not null
      else false
    end,
    closed or shut.id is not null;
end $$;

grant execute on function public.my_account_standing() to authenticated;

/**
 * Saying you have read it.
 *
 * One door for both answerable states, because to the person pressing it
 * they are the same sentence - "I understand, and I will not do it again" -
 * and what it costs them is the only difference: a warning clears the
 * moment they say it, a suspension clears only if the time on it is
 * already spent.
 *
 * It returns which thing happened rather than a boolean, so the page can
 * say "welcome back" to one and "that is cleared" to the other instead of
 * reloading and hoping.
 */
create or replace function public.acknowledge_my_standing()
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  suspended boolean;
  closed boolean;
  ends timestamptz;
  how_many integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select coalesce(p.is_suspended, false), coalesce(p.is_banned, false),
         p.suspended_until
    into suspended, closed, ends
    from public.profiles p where p.id = me;

  if closed or exists (
    select 1 from public.violations v
     where v.user_id = me and v.action = 'termination' and not v.is_void
  ) then
    raise exception 'This account has been closed. Ask for it to be looked at again.';
  end if;

  if suspended then
    if ends is null then
      raise exception 'This suspension does not have an end on it. Ask for it to be looked at again.';
    end if;
    if ends > now() then
      raise exception 'This suspension has not run out yet.';
    end if;

    update public.violations
       set acknowledged_at = now()
     where user_id = me and not is_void
       and action in ('suspension', 'feature_block', 'warning')
       and acknowledged_at is null;

    perform set_config('kobbleston.standing', 'on', true);
    update public.profiles
       set is_suspended = false, suspended_until = null
     where id = me;
    perform set_config('kobbleston.standing', 'off', true);

    perform public.write_admin_log('reactivate', me,
      jsonb_build_object('ran_out', ends, 'acknowledged', true));
    return 'back';
  end if;

  update public.violations
     set acknowledged_at = now()
   where user_id = me and not is_void
     and action = 'warning' and acknowledged_at is null;
  get diagnostics how_many = row_count;

  if how_many = 0 then return 'nothing'; end if;

  perform public.write_admin_log('acknowledge', me,
    jsonb_build_object('warnings', how_many));
  return 'warning_cleared';
end $$;

revoke all on function public.acknowledge_my_standing() from public;
grant execute on function public.acknowledge_my_standing() to authenticated;

commit;
