/*
 * One more face: a heart.
 *
 * Staw drew it and asked for it beside the other eleven, in the red the
 * heart-eyes face already uses. `reaction_faces()` is the one list - 0262
 * made it so when the flame went in - so the reactions table and `react`
 * both pick it up from here.
 *
 * A thought wears one of the same faces, and 0353 wrote the list out a
 * second time in its own check. That is the mistake 0262 is about, three
 * migrations later: the list is asked for here too now.
 */
begin;

create or replace function public.reaction_faces()
returns text[]
language sql immutable set search_path = public as $$
  select array[
    'angry', 'fire', 'happy-grin', 'heart', 'heart-eyes', 'laugh', 'sad',
    'shocked', 'skull', 'smile', 'sunglasses', 'winky-grin'
  ]
$$;

alter table public.reactions
  drop constraint if exists reactions_face_check;
alter table public.reactions
  add constraint reactions_face_check check (face = any (public.reaction_faces()));

alter table public.thoughts drop constraint if exists thoughts_face_check;
alter table public.thoughts
  add constraint thoughts_face_check check (face is null or face = any (public.reaction_faces()));

commit;
