/*
 * A face beside the thought.
 *
 * Staw: the same reactions a post gets, at the left of your thought, the
 * way a status wears one. So it is one of the eleven faces by name - the
 * list `FACES` holds and `react` already takes - and not an emoji: an
 * emoji is whatever font is on the machine, and these are ours.
 *
 * The face is part of the thought rather than a thing of its own, so it
 * goes when the thought goes - including when Kobby takes a thought down,
 * which writes `thought = null` and reaches this through the same trigger
 * rather than through a second copy of the rule in the judgement.
 */
begin;

alter table public.profiles add column if not exists thought_face text;

alter table public.profiles drop constraint if exists profiles_thought_face_check;
alter table public.profiles add constraint profiles_thought_face_check
  check (thought_face is null or thought_face in (
    'smile', 'laugh', 'happy-grin', 'winky-grin', 'heart-eyes',
    'sunglasses', 'shocked', 'sad', 'angry', 'skull', 'fire'
  ));

/* No face without a thought for it to sit beside. */
alter table public.profiles drop constraint if exists profiles_thought_face_needs_thought;
alter table public.profiles add constraint profiles_thought_face_needs_thought
  check (thought_face is null or thought is not null);

create or replace function public.stamp_thought()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  if new.thought is distinct from old.thought then
    new.thought_at := case when new.thought is null then null else now() end;
    if new.thought is null then
      new.thought_face := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists a_thought_is_stamped on public.profiles;
create trigger a_thought_is_stamped before update of thought, thought_face on public.profiles
  for each row execute function public.stamp_thought();

update public.profiles set thought_face = null where thought is null and thought_face is not null;

commit;
