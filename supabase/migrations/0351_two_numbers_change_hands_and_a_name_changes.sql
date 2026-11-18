/*
 * Three things Staw asked for by hand, on named accounts.
 *
 * - berryhop takes the number 29, JohnDoe takes 3.
 * - JaneDoe is called Malicia from now on.
 *
 * Worth saying once, because it is the system I built yesterday: a player's
 * number is the order they arrived in, and after this those two numbers no
 * longer say that. Nothing breaks - the number is only an address - but the
 * meaning is now "the order they arrived in, except these two". Staw's call,
 * and this is the record of it.
 *
 * Both writes go past a guard that would otherwise undo them without
 * erroring: `guard_profile_update` pins `content_id`, `guard_username` pins
 * `username`. Each gets its transaction-local flag, the same ones the
 * renumbering and the paid rename use.
 *
 * Nothing here is a silent no-op. A missing account, a taken name or a
 * number held by somebody who was not named raises, so a failed apply is
 * read in the SQL editor rather than discovered later.
 *
 * It runs once. Applied twice, the second pass sees the work already done
 * and says so.
 */
begin;

do $$
declare
  berry uuid;
  john  uuid;
  holder uuid;
begin
  select id into berry from public.profiles where lower(username) = 'berryhop';
  select id into john  from public.profiles where lower(username) = 'johndoe';

  if berry is null then raise exception 'No account called berryhop.'; end if;
  if john  is null then raise exception 'No account called JohnDoe.'; end if;

  if (select content_id from public.profiles where id = berry) = 29
     and (select content_id from public.profiles where id = john) = 3 then
    raise notice 'The numbers are already 29 and 3. Nothing to do.';
  else
    /* 3 and 29 may only be held by these two, or by nobody. */
    select id into holder from public.profiles
     where content_id in (3, 29) and id not in (berry, john);
    if holder is not null then
      raise exception 'The number 3 or 29 belongs to %, who was not named.',
        (select username from public.profiles where id = holder);
    end if;

    perform set_config('kobbleston.numbering', 'on', true);

    /* Out of the way first: the column is unique and checked row by row. */
    update public.profiles set content_id = -29 where id = berry;
    update public.profiles set content_id = -3  where id = john;
    update public.profiles set content_id = - content_id where content_id < 0;

    perform set_config('kobbleston.numbering', 'off', true);
  end if;
end $$;

do $$
declare
  jane uuid;
  was  text;
begin
  select id, username into jane, was from public.profiles
   where lower(username) = 'janedoe';

  if jane is null then
    if exists (select 1 from public.profiles where lower(username) = 'malicia') then
      raise notice 'Already called Malicia. Nothing to do.';
      return;
    end if;
    raise exception 'No account called JaneDoe.';
  end if;

  if exists (select 1 from public.profiles where lower(username) = 'malicia') then
    raise exception 'Somebody already has the name Malicia.';
  end if;

  perform set_config('kobbleston.renaming', 'on', true);
  update public.profiles set username = 'Malicia' where id = jane;
  perform set_config('kobbleston.renaming', 'off', true);

  /*
   * The name they used to have, written the way a paid rename writes it, so
   * /u/JaneDoe still lands on them and the profile still lists it.
   */
  insert into public.username_history (user_id, username) values (jane, was);
end $$;

commit;
