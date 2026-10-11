begin;

/*
 * Appointing a moderator or an admin, from the console.
 *
 * Staw: "for the staff console superadmins should be able to make users
 * either admin either mod, and also the kobblon account should be a
 * superadmin obviously".
 *
 * There was a door onto the moderator bit already - `admin_set_standing`
 * takes a `moderator` boolean among five other things - and no door at all
 * onto admin. This is one function that does the one job, so a panel asks
 * for a rank by name instead of setting booleans and hoping the
 * precedence works out.
 *
 * What it will not do, and why each one:
 *
 *   * **It cannot make a superadmin.** 0172 said it when the rank was
 *     added: granted in the database by somebody who already has it, never
 *     from a panel, because a panel that can promote only has to be stolen
 *     once. That has not changed because there is now a nicer screen.
 *   * **It cannot touch a superadmin's row.** Otherwise an admin bit set
 *     to false on somebody who outranks you is a demotion by the back
 *     door.
 *   * **It cannot touch the house account**, which is a superadmin from
 *     the bottom of this file onwards and should stay one.
 *   * **It cannot be used on yourself.** Nobody promotes themself, and
 *     nobody locks themself out either.
 *
 * Every use is written to the admin log and the person is told, because a
 * rank that changes silently is a rank nobody can audit.
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

  if public.is_kobblon(target) then
    raise exception 'The house account is not something a panel changes.';
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

-- ------------------------------------------------------- the house account

/*
 * Kobblon holds the top rank.
 *
 * It answers support tickets, it is the sender on every piece of staff
 * mail, and it owns the starting kit - and it has been sitting at 'none'
 * this whole time, which means every one of those worked only because the
 * functions behind them are `security definer`. The first page that reads
 * a table directly as that account would have found out the hard way.
 *
 * `is_moderator` and `is_admin` come with it: they are storage, and 0172's
 * implication only runs one way through the helper functions, not through
 * anything reading the column.
 */
update public.profiles
   set is_superadmin = true, is_admin = true, is_moderator = true
 where id = public.kobblon_account();

commit;
