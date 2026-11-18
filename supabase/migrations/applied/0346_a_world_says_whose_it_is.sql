begin;

/*
 * `world_to_play` says who the creator is, not only what they are called.
 *
 * The apps session, round 98: Staw wants the marks beside a creator's name
 * on the Launcher's loading screen - the tick, the staff k, the Klub mark -
 * and they cannot draw them, because the only thing this function hands
 * back about the person is `creator_name`, which is free text on the row.
 * 0165 put it plainly: it was inserted with `creator_name = 'Kobblon'`, a
 * piece of text and not an account. It can name somebody; it cannot
 * identify them.
 *
 * `NameMarks` needs an id or a username to ask `name_marks` about, and it
 * draws nothing and throws nothing when handed a row with neither - which
 * is how the website lost its badges for a day. They are right not to look
 * the name up themselves: a mark is a claim about a person, and a client
 * that guesses at one is a client deciding somebody is staff.
 *
 * So `owner_id` goes in the payload. It is the account, not the text, and
 * it is already what every other `name_marks` call on the platform asks
 * with.
 *
 * The return type changes, so both functions are dropped and rebuilt in
 * this transaction rather than replaced: Postgres will not replace a
 * function with a different output, and a `create or replace` beside the
 * old one is two functions of the same name with different shapes, which
 * is the ambiguity trap 0342 and 0343 both had to avoid.
 *
 * Six fields became seven and nothing else moved: the runtime still has no
 * business with the rest of the row.
 */

drop function if exists public.experience_to_play(uuid);
drop function if exists public.world_to_play(uuid);

create function public.world_to_play(wanted uuid)
returns table (
  id uuid,
  name text,
  creator_name text,
  owner_id uuid,
  cover_url text,
  manifest_url text,
  runtime_version integer
)
language sql security definer set search_path = public, extensions stable as $$
  select w.id, w.name, w.creator_name, w.owner_id, w.cover_url,
         w.manifest_url, w.runtime_version
    from public.worlds w
   where w.id = wanted
     and w.is_published
     and not w.is_removed
$$;

comment on function public.world_to_play is
  'What the player needs to open a World, including the account behind the '
  'creator name so a client can ask name_marks about them.';

create function public.experience_to_play(wanted uuid)
returns table (
  id uuid,
  name text,
  creator_name text,
  owner_id uuid,
  cover_url text,
  manifest_url text,
  runtime_version integer
)
language sql security definer set search_path = public, extensions stable as $$
  select * from public.world_to_play(wanted)
$$;

grant execute on function public.world_to_play(uuid) to anon, authenticated;
grant execute on function public.experience_to_play(uuid) to anon, authenticated;

commit;
