begin;

/*
 * Two live errors Staw hit in the console, and they are the same kind of
 * error: a thing the repository says exists, and the database does not
 * agree.
 *
 *   new row for relation "mail" violates check constraint "mail_body_check"
 *   function public.suspend_account(uuid, timestamp with time zone, text)
 *     does not exist
 */

/* --------------------------------------------------- the letter that fails */

/*
 * `mail.body` is `check (char_length(body) between 1 and 4000)` and
 * `send_mail` inserts whatever it is handed. So any moderation action
 * whose note is empty takes the whole transaction down with it - the
 * suspension, the ban, the lift - and what the person pressing the button
 * sees is a constraint name.
 *
 * It is `''` rather than null that does it, which is why the `coalesce`
 * every caller already has does not help: `coalesce('', 'something')` is
 * `''`. There are thirty-two callers and the fault is in none of them in
 * particular, so it is fixed in the one place they all go through.
 *
 * Nothing is refused here. A letter is the end of a decision that has
 * already been made, and raising on a blank note would mean a moderator
 * who left a box empty undoing a ban they had correctly made. A blank
 * body falls back to the subject, which is always there and always says
 * what happened.
 */
create or replace function public.send_mail(
  who uuid, kind text, subject text, body text, link text default null
) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  made bigint;
  the_subject text := nullif(btrim(coalesce(subject, '')), '');
  the_body text := nullif(btrim(coalesce(body, '')), '');
  the_link text := link;
begin
  if the_subject is null then the_subject := 'A message from Kobblon'; end if;
  if the_body is null then the_body := the_subject; end if;

  if char_length(the_subject) > 160 then
    the_subject := left(the_subject, 157) || '...';
  end if;
  if char_length(the_body) > 4000 then
    the_body := left(the_body, 3997) || '...';
  end if;

  /* The link check is `null or like '/%'`, so an empty string is the same
     trap one column along. */
  if the_link is not null and the_link not like '/%' then the_link := null; end if;

  insert into public.mail (user_id, kind, subject, body, link)
  values (who, kind, the_subject, the_body, the_link)
  returning id into made;
  return made;
end $$;

revoke all on function public.send_mail(uuid, text, text, text, text)
  from public, anon, authenticated;

/* ---------------------------------------------- the function that is not there */

/*
 * `suspend_account` is called by `sanction_account` (0252), by the two
 * voice-suspension roads (0220, 0294) and by the report console, and it is
 * not in the live database. 0210 is the migration that defines it and its
 * own name is "the report console the live database never got", so this is
 * the rest of that: the file was written, and whatever was run against the
 * live database was not all of it.
 *
 * Re-emitted exactly as 0210 has it, which is still the newest copy -
 * nothing since has changed what a suspension does. The rank ceiling is
 * part of it and not an afterthought: nobody suspends sideways or upwards,
 * and the moderation worker suspends no member of staff at all.
 */
create or replace function public.suspend_account(
  target uuid, until_when timestamptz, said text
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare they public.profiles%rowtype;
begin
  if not (public.is_the_worker() or public.is_moderator()) then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  select * into they from public.profiles where id = target;
  if they.id is null then raise exception 'No such account.'; end if;

  if they.is_superadmin then
    raise exception 'A superadmin cannot be suspended.';
  end if;
  if (they.is_admin or they.is_moderator)
     and not public.is_superadmin() then
    raise exception 'Only a superadmin suspends staff.';
  end if;

  /* The flag `guard_profile_update` honours. Without it this function has
     the rights to write the two columns and writes neither, which is this
     project's third trap and the reason 0243 exists. */
  perform set_config('kobbleston.standing', 'on', true);
  update public.profiles
     set is_suspended = true, suspended_until = until_when
   where id = target;
  perform set_config('kobbleston.standing', 'off', true);

  perform public.write_admin_log('suspend', target, jsonb_build_object(
    'until', until_when, 'why', said,
    'by', case when public.is_the_worker() then 'machine' else 'staff' end));
end $$;

grant execute on function public.suspend_account(uuid, timestamptz, text) to authenticated;

commit;
