begin;

-- Nobody walks around as one flat colour.
--
-- Staw's rule, in his words: Kobblon is less strict than the place it grew
-- up beside, and that is not the same as letting somebody be naked. One
-- colour from head to foot is the one body that reads as bare skin whatever
-- the colour is, so it is refused.
--
-- Said in the page as well, where somebody hears it in the moment. It is
-- said here because that is where it is a rule: a check a page keeps is a
-- check anybody with a console does not have, and this function is callable
-- directly by every signed-in person.
--
-- Only the whole body counts. Six parts that are all `#f2d08a` is the case;
-- five of them plus a different head is somebody with a hat problem, not a
-- naked person, and this does not have an opinion about that.

create or replace function public.set_body_colours(colours jsonb)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  part text;
  value text;
  seen text[] := '{}';
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if colours is not null then
    if jsonb_typeof(colours) <> 'object' then
      raise exception 'Colours come as an object.';
    end if;
    for part, value in select * from jsonb_each_text(colours) loop
      if part not in ('Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg') then
        raise exception 'There is no body part called %.', part;
      end if;
      if value !~* '^#[0-9a-f]{6}$' then
        raise exception 'A colour looks like #1b34e8.';
      end if;
      seen := seen || lower(value);
    end loop;

    -- Every one of the six, and all the same: that is the refusal. A body
    -- that only names some of its parts is leaving the rest at whatever they
    -- were, which cannot be judged from here.
    if array_length(seen, 1) = 6 and array_length(array(select distinct unnest(seen)), 1) = 1 then
      raise exception 'One colour from head to foot reads as wearing nothing. Keep a part different.';
    end if;
  end if;

  update public.profiles set body = colours where id = me;
end;
$$;

grant execute on function public.set_body_colours to authenticated;

commit;
