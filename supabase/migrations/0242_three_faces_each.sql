begin;

/*
 * Three faces each, not one.
 *
 * Staw: "make that we can actually add up to 3 reactions as a single user
 * instead of 1 max". The one-per-person rule was in the primary key, which
 * was the right place for a rule that was going to be kept and the reason
 * this is a migration rather than a change to a function: the key said a
 * person has at most one feeling about a thing, and a key cannot be argued
 * with from a page.
 *
 * Three rather than all ten. Ten is a row of every face on every post,
 * which says nothing about the post and costs the same to read as something
 * that does; three is enough to be funny and few enough that pressing one
 * more means giving one up.
 */

alter table public.reactions drop constraint if exists reactions_pkey;
alter table public.reactions
  add constraint reactions_pkey primary key (target_type, target_id, user_id, face);

create or replace function public.react(
  what text, which text, face text
)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
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

  if face is null or face not in (
    'angry', 'happy-grin', 'heart-eyes', 'laugh', 'sad',
    'shocked', 'skull', 'smile', 'sunglasses', 'winky-grin'
  ) then
    raise exception 'That is not one of the faces.';
  end if;

  if what = 'world' and not public.in_the_klub(me, 'lite') then
    raise exception 'Reacting to a World is a Kobblon Klub thing.';
  end if;

  if what = 'post' then
    if which !~ '^[0-9]+$' then
      raise exception 'There is no post with that number.';
    end if;
    if not exists (
      select 1 from public.community_posts p
       where p.id = which::bigint and not p.is_removed
    ) then
      raise exception 'There is no post with that number.';
    end if;
  else
    if not exists (
      select 1 from public.worlds w
       where w.id::text = which and not w.is_removed
    ) then
      raise exception 'There is no World with that number.';
    end if;
  end if;

  select exists (
    select 1 from public.reactions r
     where r.target_type = what and r.target_id = which
       and r.user_id = me and r.face = react.face
  ) into had;

  -- The same one again takes it off, which is still how a press undoes.
  if had then
    delete from public.reactions r
     where r.target_type = what and r.target_id = which
       and r.user_id = me and r.face = react.face;
    return null;
  end if;

  select count(*) into how_many from public.reactions r
   where r.target_type = what and r.target_id = which and r.user_id = me;

  if how_many >= 3 then
    raise exception 'Three faces is as much as anybody can say about one thing. Take one off first.';
  end if;

  /*
   * No conflict target named, deliberately: `face` in a conflict clause is
   * read as the parameter and not the column, and plpgsql says so - the
   * same ambiguity this project has now hit three times. The bare form
   * means the same thing here, since the only key it can collide with is
   * the one being inserted.
   */
  insert into public.reactions (target_type, target_id, user_id, face)
  values (what, which, me, react.face)
  on conflict do nothing;

  return face;
end $$;

revoke all on function public.react(text, text, text) from public;
grant execute on function public.react(text, text, text) to authenticated;

commit;
