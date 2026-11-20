begin;

/*
 * A clip is a thing people say something about.
 *
 * Rather than a second like table with its own counting, clips join the
 * reaction system every post and every World already uses - the same eleven
 * faces, the same three-at-most rule, the same heart added in 0357. One
 * vocabulary for "I liked this", in one table.
 *
 * `reactions.target_type` is a check constraint rather than an enum, so the
 * value and the thing that uses it can go in one file. The rule in this
 * project about splitting those is about `create type ... as enum`, where
 * Postgres refuses to use a new value in the transaction that added it.
 */
alter table public.reactions drop constraint if exists reactions_target_type_check;
alter table public.reactions add constraint reactions_target_type_check
  check (target_type in ('post', 'world', 'clip'));

/**
 * React, change your mind, or take it back.
 *
 * Unchanged except for the list of things there are to react to. Reacting
 * to a World is still a Klub thing; reacting to a clip is not, because the
 * point of a clip is that it travels.
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

  if what not in ('post', 'world', 'clip') then
    raise exception 'You can react to a post, a World or a clip.';
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

commit;
