begin;

-- Everybody arrives dressed.
--
-- `handle_new_user` is taken from the database as it stands rather than
-- retyped, with two things added: a guest gets a white body, and everybody
-- gets `give_starting_kit`. Retyping one of these is how a rewrite quietly
-- drops a check nobody notices for a week.
--
-- The kit is whatever `starting_kit` holds at the moment somebody signs up,
-- so adding the shirt, the trousers and the cap to that table is the whole
-- of making new accounts wear them. Nothing here changes again.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, extensions as $$

declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  guest boolean := coalesce(new.is_anonymous, false);
  base text;
  candidate text;
  n int := 0;
begin
  if guest then
    candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
      candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    end loop;

    insert into public.profiles (id, username, display_name, avatar_url, is_guest, body)
    values (
      new.id, candidate, candidate, nullif(meta->>'avatar_url', ''), true,
      -- Staw's guest: white from head to foot, dressed by the kit. The
      -- colours are allowed to be identical because the kit includes
      -- trousers, which is exactly the rule 0127 states.
      '{"Head":"#ffffff","Torso":"#ffffff","LeftArm":"#ffffff",
        "RightArm":"#ffffff","LeftLeg":"#ffffff","RightLeg":"#ffffff"}'::jsonb
    );
    perform public.give_starting_kit(new.id);
    return new;
  end if;

  base := regexp_replace(coalesce(meta->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'kobbler' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base := substr(base, 1, 16);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := substr(base, 1, 16) || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url, birth_date, gender)
  values (
    new.id,
    candidate,
    coalesce(nullif(meta->>'display_name', ''), candidate),
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'birth_date', '')::date,
    nullif(meta->>'gender', '')
  );

  perform public.give_starting_kit(new.id);

  insert into public.activity_events (kind, actor_id) values ('user_joined', new.id);
  return new;
end;
$$;

commit;
