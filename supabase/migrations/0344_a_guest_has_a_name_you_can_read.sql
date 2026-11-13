begin;

/*
 * A guest is called Guest482913, not Gueste2f83217ddcf.
 *
 * Staw, with a screenshot of the Launcher's player: "the other session
 * doesnt know how to make guest accounts properly, wrong username &
 * displayname". The applications do not name guests - this trigger does -
 * so the name on that screenshot is ours, and it came out of 0338.
 *
 * 0338 put twelve hex of the account id in the name because a guest called
 * Guest50929 could not be matched to the row behind it. That reasoning
 * still holds and the id is still what the name is made of. What was wrong
 * was the alphabet: `Gueste2f83217ddcf` is seventeen characters of hex that
 * nobody can read out loud, remember, or type into a report, and it was the
 * *display* name as well as the handle, so it is what everybody looking at
 * a guest sees.
 *
 * So the same idea in digits: six of them, derived from the first eight hex
 * of the account id rather than from a random number, which keeps the one
 * property 0338 was after - the name follows from the account and support
 * can go from a screenshot to the row.
 *
 * Six digits is nine hundred thousand names, and unlike 0338's random five
 * these are not drawn at random: two guests collide only where their ids
 * collide in the same 2^32 slice, and the loop under it covers that. The
 * handle and the display name are the same string, so `@Guest482913` and
 * `Guest482913` are the same name rather than two.
 */
create or replace function public.guest_name_for(who uuid)
returns text
language sql immutable
set search_path = public, extensions as $$
  /*
   * 100000-999999, from the id. `bit(32)` of eight hex is unsigned-safe
   * here because the modulo is taken on the bigint, and no leading zero
   * means the name is always the same length.
   */
  select 'Guest' || (
    (('x' || substr(replace(who::text, '-', ''), 1, 8))::bit(32)::bigint % 900000) + 100000
  )::text;
$$;

comment on function public.guest_name_for is
  'The readable name a guest account is given, derived from its own id.';

grant execute on function public.guest_name_for to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, extensions as $$

declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  guest boolean := coalesce(new.is_anonymous, false);
  flat text := replace(new.id::text, '-', '');
  base text;
  candidate text;
  wanted text;
  n int := 0;
begin
  if guest then
    base := public.guest_name_for(new.id);
    candidate := base;
    /*
     * Taken, somehow: another guest whose id starts the same way, or a name
     * somebody retired. Count up rather than re-roll, so the name stays
     * near the one the id asked for, and fall back to the hex form after
     * ten tries rather than loop on a database where something is wrong.
     */
    while public.who_holds_name(candidate) is not null loop
      n := n + 1;
      candidate := base || n::text;
      if n > 10 then
        candidate := 'Guest' || substr(flat, 1, 12);
        exit;
      end if;
    end loop;

    insert into public.profiles (id, username, display_name, avatar_url, is_guest, has_email, body)
    values (
      new.id, candidate, candidate, nullif(meta->>'avatar_url', ''), true, false,
      '{"Head":"#ffffff","Torso":"#ffffff","LeftArm":"#ffffff",
        "RightArm":"#ffffff","LeftLeg":"#ffffff","RightLeg":"#ffffff"}'::jsonb
    );
    perform public.give_starting_kit(new.id);
    return new;
  end if;

  n := 0;
  base := regexp_replace(coalesce(meta->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'kobbler' || substr(flat, 1, 6);
  end if;
  base := substr(base, 1, 16);
  candidate := base;
  while public.who_holds_name(candidate) is not null loop
    n := n + 1;
    candidate := substr(base, 1, 16) || n::text;
  end loop;

  wanted := left(regexp_replace(coalesce(meta->>'display_name', ''), '[^A-Za-z0-9_]', '', 'g'), 32);

  insert into public.profiles (id, username, display_name, avatar_url, birth_date, gender, has_email)
  values (
    new.id,
    candidate,
    coalesce(nullif(wanted, ''), candidate),
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'birth_date', '')::date,
    nullif(meta->>'gender', ''),
    not public.email_is_a_stand_in(new.email)
  );

  perform public.give_starting_kit(new.id);

  insert into public.activity_events (kind, actor_id) values ('user_joined', new.id);
  return new;
end;
$$;

/*
 * The guests already carrying a hex name get the readable one.
 *
 * 0338 deliberately left existing guests alone. This does not, and the
 * reason the two differ is that 0338 was changing one unreadable name for
 * another: there was nothing to gain. Here the live accounts are the whole
 * complaint, a guest account is thrown away by design, and nothing links to
 * a guest by name - `username_history` is written by the rename calls, not
 * by a trigger, so this takes no name out of circulation and retires
 * nothing.
 *
 * Only the ones that still look machine-made, and only where the readable
 * name is free. A guest who claimed their account is `is_guest = false` by
 * then and is not touched.
 *
 * The flag is not optional and the first version of this did not have it.
 * `guard_username` pins `username` back to the old value on any write that
 * has not raised `kobbleston.renaming`, and - unlike `guard_profile_update`
 * next to it - it does not exempt a caller with no JWT. So the update ran,
 * reported the row, changed the display name, and left the handle exactly
 * as it was. No error, no warning. Found by reading the row back rather
 * than by reading the statement.
 */
do $$ begin perform set_config('kobbleston.renaming', 'on', true); end $$;

update public.profiles p
   set username = public.guest_name_for(p.id),
       display_name = public.guest_name_for(p.id)
 where p.is_guest
   and p.username ~ '^Guest[0-9a-f]{12,}$'
   and public.who_holds_name(public.guest_name_for(p.id)) is null;

do $$ begin perform set_config('kobbleston.renaming', 'off', true); end $$;

commit;
