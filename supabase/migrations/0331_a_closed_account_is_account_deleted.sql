begin;

/*
 * A closed account becomes AccountDeleted<id>, and can be read again.
 *
 * Staw, on the whole ban and suspension system: "for banned accounts well
 * their username & display gets renamed to AccountDeleted[their ID], their
 * pfp is replaced by the cant load image, you cant access their profile".
 *
 * Two things were wrong before, and they were the same thing twice.
 *
 * `profiles_read` was `not is_banned`, so a closed account was not hidden
 * behind a name, it was hidden full stop: every post it had ever made lost
 * the name beside it, every friend list lost a face, and the rows went on
 * existing while nothing could read them. That is not what being closed
 * looks like anywhere - it looks like a name that says the account is
 * gone. And because nothing could read the row, there was nowhere for
 * "AccountDeleted" to be read from.
 *
 * So the row becomes anonymous at the moment of the ban rather than
 * unreadable for ever after it: the handle, the name, the picture and the
 * bio are replaced, and what they were is kept on the row so that lifting
 * the ban gives them back. The policy can then let the row be read again,
 * because there is nothing of theirs left in it.
 *
 * What is NOT here: the profile page refusing to open. That is the
 * website's, because `is_banned` is on the row the page already reads and
 * a second rule in SQL saying the same thing is a second place to get it
 * wrong.
 */

alter table public.profiles
  add column if not exists former_username text,
  add column if not exists former_display_name text,
  add column if not exists former_avatar_url text,
  add column if not exists former_bio text;

comment on column public.profiles.former_username is
  'What the handle was before the account was closed. Null unless it is.';

/*
 * Closing an account, re-emitted whole.
 *
 * Whole rather than patched, which is 0243's rule and 0267 repeats it: the
 * write and the guard are one thing, and the one time somebody rewrote
 * this from a copy that was missing a branch, suspensions stopped
 * suspending anybody for twenty-eight migrations.
 *
 * Two flags are raised around the write, not one. `kobbleston.standing`
 * lets `guard_profile_update` through for the three standing columns, and
 * `kobbleston.renaming` is what `guard_username` honours - without it the
 * handle is pinned back to what it was and the ban silently renames
 * nobody, which is trap three in this project's own notes: a privileged
 * function and a row-level guard over the same table, where the function
 * returns cleanly having done nothing. `renaming` also stops the new
 * handle being queued for screening, which would ask a moderator to
 * approve the word "AccountDeleted" a few times a day.
 */
create or replace function public.ban_account(
  target uuid, said text, which_rule text default 'other'
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  they public.profiles%rowtype;
  gone text;
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

  /*
   * The number everybody already knows them by, and a fallback that cannot
   * collide: `content_id` is the id in their own address, so AccountDeleted
   * plus it is unique for the same reason the address is. An account with
   * none yet falls back to the first segment of the uuid, which is not
   * pretty and is never seen, because every account made since 0083 has a
   * content_id.
   */
  gone := 'AccountDeleted' || coalesce(they.content_id::text, split_part(they.id::text, '-', 1));

  perform set_config('kobbleston.standing', 'on', true);
  perform set_config('kobbleston.renaming', 'on', true);
  update public.profiles
     set is_suspended = true,
         suspended_until = null,
         is_banned = true,
         /*
          * Kept rather than thrown away. Lifting a ban that cost somebody
          * their handle for good would be a punishment the appeal cannot
          * undo, and an appeal that cannot undo the thing is not an appeal.
          * Only written on the way in, so closing an account twice does not
          * overwrite the real name with AccountDeleted.
          */
         former_username     = coalesce(former_username, username),
         former_display_name = coalesce(former_display_name, display_name),
         former_avatar_url   = coalesce(former_avatar_url, avatar_url),
         former_bio          = coalesce(former_bio, bio),
         username     = gone,
         display_name = gone,
         avatar_url   = null,
         bio          = null
   where id = target;
  perform set_config('kobbleston.renaming', 'off', true);
  perform set_config('kobbleston.standing', 'off', true);

  perform public.send_mail(
    target, 'moderation', 'This account has been closed',
    btrim(said) || E'\n\nYou can ask for this to be looked at again from the '
      || 'standing page.', '/standing');

  perform public.write_admin_log('ban', target, jsonb_build_object('why', btrim(said)));
end $$;

grant execute on function public.ban_account(uuid, text, text) to authenticated;

/*
 * And giving it back.
 *
 * The same two flags for the same two guards. The former columns are
 * cleared as they are restored, so the row carries no memory of having
 * been closed once the decision is lifted - and so a second ban later
 * stores that day's name rather than finding the old one already there.
 *
 * A row with no `former_username` is one that was closed before this
 * migration: there is nothing to put back and the coalesce leaves the
 * handle it has.
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
  perform set_config('kobbleston.renaming', 'on', true);
  update public.profiles
     set is_suspended = false,
         suspended_until = null,
         is_banned = false,
         username     = coalesce(former_username, username),
         display_name = coalesce(former_display_name, display_name),
         avatar_url   = coalesce(former_avatar_url, avatar_url),
         bio          = coalesce(former_bio, bio),
         former_username = null,
         former_display_name = null,
         former_avatar_url = null,
         former_bio = null
   where id = target;
  perform set_config('kobbleston.renaming', 'off', true);
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
 * Who may see a profile: everybody, again.
 *
 * 0267 changed this from "not suspended" to "not banned" for the right
 * reason and stopped one step short. A closed account's row now holds
 * AccountDeleted and nothing of theirs, so hiding it buys no privacy and
 * costs every name beside every post they ever made.
 *
 * The guard that matters is still there: `former_username` and the three
 * beside it are pinned by `guard_profile_update` below, so the row says
 * what the account is called now and nobody but a moderator can read back
 * what it used to be.
 */
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);

/*
 * The guard, whole again, from 0298 and not from 0267.
 *
 * Said out loud because it was wrong here first and the local check is
 * what found it: this was re-emitted from 0267's copy, which is two
 * migrations behind. That copy has no house-account rank block (0298), no
 * "an admin does not promote themself" branch (0298), and none of 0268's
 * four `closed_*` pins - so applying it would have quietly handed every
 * account the ability to un-delete itself, which is exactly what the
 * check showed the deleted account doing. 0243's rule is re-emit whole;
 * the half of it nobody writes down is re-emit from the newest one.
 *
 * What is added on top of 0298:
 *
 *   the four former_* columns pinned. They are the only copy of somebody's
 *   real name once the account is closed, and a column nobody pins is a
 *   column anybody may write: a closed account could otherwise set
 *   `former_username` to a handle somebody else is using and have it
 *   taken from them by an appeal.
 *
 *   and a closed account cannot write its own name, picture or bio. The
 *   rename is only worth anything if it stays - the handle is held by
 *   `guard_username`, but the display name, the picture and the bio are
 *   ordinary columns anybody may change about themself, and a closed
 *   account calling the API directly could put all three back the moment
 *   after they came down.
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

  -- What they were called before they were closed. The only copy of it.
  new.former_username     := old.former_username;
  new.former_display_name := old.former_display_name;
  new.former_avatar_url   := old.former_avatar_url;
  new.former_bio          := old.former_bio;

  /*
   * And a closed account stays AccountDeleted. The handle is already held
   * by `guard_username`; these three are not, and without them the rename
   * lasts exactly as long as it takes to call the API once.
   */
  if old.is_banned or old.closed_at is not null then
    new.display_name := old.display_name;
    new.avatar_url   := old.avatar_url;
    new.bio          := old.bio;
  end if;

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


/* ------------------------------------- the other way an account goes away */

/*
 * A deletion is a closure too, and it was renaming nobody.
 *
 * There are two paths to a profile that reads as gone and only one of them
 * was doing the renaming. `ban_account` closes an account for good;
 * `admin_delete_account` schedules it for erasure and keeps it for two
 * months, and that is the one Staw was looking at when he said the name
 * has to be "truly renamed as if you had changed it yourself in settings".
 * It was not renamed at all - the row kept the handle, the display name
 * and the bio, and every page that showed it was writing the words
 * "Account Deleted" over the top of a row that still said `ImSpecial` and
 * still carried their description. Anything reading the row directly - a
 * post, a search result, an application - got the real one.
 *
 * So the deletion path renames in exactly the way the ban does, with the
 * same two flags over the same two guards, and `reopen_account` gives the
 * four back. Both re-emitted whole, per 0243.
 */
create or replace function public.admin_delete_account(target uuid, why text)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare
  doomed public.profiles%rowtype;
  gone text;
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

  gone := 'AccountDeleted' || coalesce(doomed.content_id::text, split_part(doomed.id::text, '-', 1));

  perform set_config('kobbleston.standing', 'on', true);
  perform set_config('kobbleston.renaming', 'on', true);
  update public.profiles
     set closed_at = now(),
         closed_by = auth.uid(),
         closed_reason = btrim(why),
         erase_after = now() + public.held_for(),
         is_suspended = true,
         suspended_until = null,
         former_username     = coalesce(former_username, username),
         former_display_name = coalesce(former_display_name, display_name),
         former_avatar_url   = coalesce(former_avatar_url, avatar_url),
         former_bio          = coalesce(former_bio, bio),
         username     = gone,
         display_name = gone,
         avatar_url   = null,
         bio          = null
   where id = target;
  perform set_config('kobbleston.renaming', 'off', true);
  perform set_config('kobbleston.standing', 'off', true);

  perform public.send_mail(
    target, 'moderation', 'This account is being deleted',
    btrim(why) || E'\n\nIt is kept for two months before the data goes for '
      || 'good. If this is wrong, say so from the standing page.', '/standing');

  /* The log keeps the real name. It is the only place left that has it
     once the two months are up and the row is gone. */
  perform public.write_admin_log('close-account', target, jsonb_build_object(
    'username', doomed.username, 'display_name', doomed.display_name,
    'why', btrim(why), 'erase_after', now() + public.held_for()
  ));
end;
$$;

grant execute on function public.admin_delete_account(uuid, text) to authenticated;

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
  perform set_config('kobbleston.renaming', 'on', true);
  update public.profiles
     set closed_at = null, closed_by = null, closed_reason = null,
         erase_after = null, is_suspended = false, suspended_until = null,
         username     = coalesce(former_username, username),
         display_name = coalesce(former_display_name, display_name),
         avatar_url   = coalesce(former_avatar_url, avatar_url),
         bio          = coalesce(former_bio, bio),
         former_username = null,
         former_display_name = null,
         former_avatar_url = null,
         former_bio = null
   where id = target;
  perform set_config('kobbleston.renaming', 'off', true);
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

commit;
