begin;

/*
 * A guest's name is its own account id, not a number out of a hat.
 *
 * Staw: it should be "Guest[user-id]". The old name was
 * `'Guest' || lpad(floor(random() * 100000), 5, '0')` - five random digits
 * out of a hundred thousand, in a loop that re-rolled whenever the name was
 * already taken. Two things were wrong with that and only one of them is
 * cosmetic:
 *
 *   * **It says nothing.** Guest50929 cannot be matched to the account
 *     behind it, so a report naming a guest is a report about nobody. The
 *     account id is the one thing about a throwaway account that is true
 *     and stable, and putting it in the name means support can go straight
 *     from the name on a screenshot to the row.
 *   * **A hundred thousand names is not many.** By the birthday bound a
 *     collision is likelier than not somewhere around four hundred guests,
 *     and every collision was another re-roll against `who_holds_name`,
 *     which also reads the retired-name table. It worked; it just got
 *     slower for the worst possible reason.
 *
 * Twelve hex of the uuid is 'Guest' plus 12 = 17 characters, inside the
 * 3-20 the username check allows, and 2^48 wide. The loop stays anyway,
 * taking another four hex each time: a name somebody retired could in
 * principle collide with this, and a guest who cannot be named is a guest
 * who cannot sign in.
 *
 * Existing guests keep the names they have. A guest account is thrown away
 * by design and renaming live ones would break every link and screenshot
 * pointing at them for no gain.
 */
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
    candidate := 'Guest' || substr(flat, 1, 12);
    while public.who_holds_name(candidate) is not null loop
      n := n + 1;
      exit when n > 5;
      candidate := 'Guest' || substr(flat, 1, 12 + n);
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

commit;
