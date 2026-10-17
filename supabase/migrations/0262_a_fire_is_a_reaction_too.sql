begin;

/*
 * One more thing somebody can say about a post, and one list instead of two.
 *
 * Staw: "you shall a fire reaction".
 *
 * Adding it turned out to be two edits rather than one, which is the part
 * worth writing down. `reactions.face` had a check constraint listing the
 * ten, and `react` had the same ten written out again in an `if ... not
 * in`. Changing the constraint alone left the function refusing the new
 * one with "That is not one of the faces" - a list that is written twice is
 * a list that is right twice and then right once.
 *
 * So the list lives in one place now. `reaction_faces()` is `immutable`,
 * which is what lets a check constraint call it at all, and both the
 * constraint and the function ask it. The next face is one line.
 *
 * The constraint is replaced rather than widened, because Postgres has no
 * "add a value" for a check. Every existing row satisfies the new one: it
 * is the old list with `fire` in it.
 */

create or replace function public.reaction_faces()
returns text[]
language sql immutable set search_path = public as $$
  select array[
    'angry', 'fire', 'happy-grin', 'heart-eyes', 'laugh', 'sad',
    'shocked', 'skull', 'smile', 'sunglasses', 'winky-grin'
  ]
$$;

grant execute on function public.reaction_faces() to authenticated, anon;

alter table public.reactions
  drop constraint if exists reactions_face_check;
alter table public.reactions
  add constraint reactions_face_check check (face = any (public.reaction_faces()));

/*
 * `react`, unchanged apart from where it gets the list. Written out in full
 * rather than altered in place: `create or replace function` resets a
 * function's attributes, so a version of this that did not say
 * `security definer` would quietly stop being one.
 */
create or replace function public.react(what text, which text, face text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  had boolean;
  how_many integer;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  if what not in ('post', 'world') then
    raise exception 'You can react to a post or a World.';
  end if;

  if face is null or not (face = any (public.reaction_faces())) then
    raise exception 'That is not one of the faces.';
  end if;

  if what = 'world' and not public.in_the_klub(me, 'lite') then
    raise exception 'Reacting to a World is a Kobblon Klub thing.';
  end if;

  select true into had from public.reactions
   where target_type = what and target_id = which
     and user_id = me and reactions.face = react.face;

  if had then
    delete from public.reactions
     where target_type = what and target_id = which
       and user_id = me and reactions.face = react.face;
    return 'off';
  end if;

  select count(*) into how_many from public.reactions
   where target_type = what and target_id = which and user_id = me;

  if how_many >= 3 then
    raise exception 'Three faces is as much as anybody can say about one thing.';
  end if;

  insert into public.reactions (target_type, target_id, user_id, face)
  values (what, which, me, react.face);

  return 'on';
end $$;

grant execute on function public.react(text, text, text) to authenticated;

commit;
