begin;

/*
 * Acting on a person, which the console could not do.
 *
 * Everything a sanction is made of - the rule it is under, the reason the
 * account is allowed to read, the violation row the standing page counts,
 * the mail, the appeal - is written by `take_report`, and `take_report`
 * needs a report. Staff looking at somebody they already know about had one
 * control: a `Suspend` button that flipped `is_suspended` through
 * `admin_set_standing`. No reason, no end, no violation and no mail, so the
 * person saw a locked account and a standing page saying nothing is wrong
 * with their account, which is the worst version of a sanction: felt, and
 * unappealable, because there is nothing on the record to appeal.
 *
 * `sanction_account` is `take_report`'s second half with the report taken
 * out. Same violation row, same mail, same admin log, same ranks.
 *
 * **The machine does not come through this door.** It is refused by name
 * rather than by rank, because the worker holds a key that passes a staff
 * check - that is the whole reason it has one - and the machine acting on a
 * person nobody reported is the machine deciding who to look at. Staw's
 * line stands: warnings and suspensions, through a report, and no door at
 * all for closing an account.
 */
create or replace function public.sanction_account(
  target uuid,
  action text,
  why text,
  which_rule text default 'other',
  days integer default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  they public.profiles%rowtype;
  said text := btrim(coalesce(why, ''));
  ends timestamptz;
  made bigint;
begin
  if public.is_the_worker() then
    raise exception
      'The moderation worker acts on reports, not on people. This is a person''s.'
      using errcode = '42501';
  end if;
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  if action not in ('warning', 'chat_suspension', 'suspension') then
    raise exception 'That is not a sanction this hands out.';
  end if;

  -- Ten characters, not three. A sanction nobody reported has no report
  -- behind it explaining itself, so the reason is the whole of what the
  -- person is told and the whole of what an appeal argues with.
  if char_length(said) < 10 then
    raise exception 'Say why, in a sentence the account is allowed to read.';
  end if;

  select * into they from public.profiles where id = target;
  if they.id is null then raise exception 'No such account.'; end if;
  if they.id = me then raise exception 'You cannot sanction yourself.'; end if;

  -- The same ranks `suspend_account` keeps, said here as well because this
  -- hands out a warning and a chat suspension too, and neither of those
  -- goes anywhere near that function.
  if they.is_superadmin then
    raise exception 'A superadmin cannot be sanctioned.';
  end if;
  if (they.is_admin or they.is_moderator) and not public.is_superadmin() then
    raise exception 'Only a superadmin sanctions staff.';
  end if;

  if action = 'chat_suspension' then
    ends := public.mute_chat(target, said, 'staff');
  elsif action = 'suspension' then
    ends := case when days is not null then now() + make_interval(days => days) end;
    perform public.suspend_account(target, ends, said);
  end if;

  insert into public.violations
    (user_id, rule, action, reason, moderator_id, expires_at)
  values
    (target,
     case when which_rule in ('harassment','spam','sexual','violence','impersonation',
                              'illegal','hate','cheating','copyright','age','other')
          then which_rule else 'other' end,
     action, left(said, 1000), me, ends)
  returning id into made;

  perform public.send_mail(
    target, 'moderation',
    case action
      when 'warning' then 'A warning about your account'
      when 'chat_suspension' then 'Chat has been suspended on your account'
      else 'Your account has been suspended'
    end,
    said || E'\n\nYou can see where your account stands, and appeal this, '
         || 'from your account standing.',
    '/standing');

  perform public.write_admin_log('sanction-' || action, target,
    jsonb_build_object('why', said, 'rule', which_rule, 'until', ends,
                       'violation', made, 'by', 'staff'));

  return jsonb_build_object(
    'action', action, 'violation', made, 'until', ends, 'about', target);
end $$;

revoke all on function public.sanction_account(uuid, text, text, text, integer) from public;
grant execute on function public.sanction_account(uuid, text, text, text, integer)
  to authenticated;

/*
 * And the row the console draws a person from, which could not say whether
 * they were banned, when a suspension ends, or what is already on their
 * record.
 *
 * Three columns, and each one is a control that was lying without it: a
 * `Suspend` button on somebody already banned, an `Unsuspend` that would
 * quietly undo a termination, and no way to see that this is somebody's
 * fourth warning while deciding the fifth.
 *
 * `require_admin` becomes `is_moderator` as well. The People section says it
 * is a moderator's, the card draws them a read-only panel on purpose, and
 * the listing behind it refused them - so the one rank the panel was written
 * for could not open the page. The writes are unchanged and still refuse
 * them; this is the read.
 */
drop function if exists public.admin_find_people(text);

create function public.admin_find_people(search text)
returns table(
  id uuid, username text, display_name text, avatar_url text,
  content_id bigint, pixels integer, is_verified boolean, is_moderator boolean,
  is_suspended boolean, is_admin boolean, has_staff_badge boolean,
  is_guest boolean, created_at timestamptz,
  /* Closed for good: a termination still standing on the record. */
  is_banned boolean,
  /* When a suspension runs out. Null on a ban, which never does. */
  suspended_until timestamptz,
  /* What is already on the record, so the next decision knows the last. */
  past_sanctions integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
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
             where v.user_id = p.id and not v.is_void)
      from public.profiles p
     where coalesce(btrim(search), '') = ''
        or p.username ilike '%' || btrim(search) || '%'
        or p.display_name ilike '%' || btrim(search) || '%'
        or p.content_id::text = btrim(search)
     order by p.is_admin desc, p.is_moderator desc, p.created_at desc
     limit 50;
end $$;

grant execute on function public.admin_find_people(text) to authenticated;

commit;
