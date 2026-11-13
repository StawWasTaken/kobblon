/*
 * A creator says what their World runs on.
 *
 * 0341 gave a World the column and Discover the filter; this is the end of
 * it nobody can use without: the Creator Hub's own settings. Same function
 * as everything else about a World, because two ways to change a World is
 * two sets of rules about who may change what.
 *
 * The six-argument version is dropped rather than left beside this one: a
 * default on the new parameter would make a six-argument call ambiguous,
 * and that is an error at the call site rather than at deploy time.
 */
begin;

drop function if exists public.configure_world(uuid, text, text, text, text, text);

create or replace function public.configure_world(
  which uuid,
  called text default null,
  about text default null,
  genre text default null,
  maturity text default null,
  cover text default null,
  runs_on text[] default null
)
returns public.worlds
language plpgsql security definer set search_path = public, extensions as $$
declare mine public.worlds;
begin
  select * into mine from public.worlds where id = which and not is_removed;

  if mine.id is null then
    raise exception 'There is no World with that number.';
  end if;

  if mine.owner_id <> auth.uid() and not public.is_moderator() then
    raise exception 'That is not your World.';
  end if;

  if called is not null and char_length(btrim(called)) = 0 then
    raise exception 'A World needs a name.';
  end if;

  if genre is not null and not exists (select 1 from public.world_genres g where g.id = genre) then
    raise exception 'That is not one of the genres.';
  end if;

  /*
   * The emblem is a path in this World's own folder, never an address. A
   * World that could name any host is a World that makes every player fetch
   * whatever it likes.
   */
  if cover is not null and cover <> '' then
    if cover !~ ('^' || which::text || '/[A-Za-z0-9._/-]{1,200}$') then
      raise exception 'An emblem lives in that World''s own folder.';
    end if;
  end if;

  /*
   * The devices are a closed list of four, checked here as well as by the
   * constraint, so the message is a sentence rather than a constraint name.
   * An empty list is refused for the same reason 0341 refuses it: a World
   * that runs on nothing can never be found.
   */
  if runs_on is not null then
    if coalesce(array_length(runs_on, 1), 0) = 0 then
      raise exception 'A World has to run on something.';
    end if;
    if not (runs_on <@ array['computer', 'phone', 'tablet', 'console']::text[]) then
      raise exception 'A World runs on a computer, a phone, a tablet or a console.';
    end if;
  end if;

  update public.worlds
     set name        = coalesce(nullif(btrim(called), ''), name),
         description = coalesce(about, description),
         genre       = coalesce(configure_world.genre, worlds.genre),
         maturity    = coalesce(configure_world.maturity, worlds.maturity),
         cover_url   = case
                         when cover is null then cover_url
                         when cover = '' then null
                         else public.storage_base() || '/worlds/' || cover
                       end,
         devices     = coalesce(runs_on, worlds.devices),
         updated_at  = now()
   where id = which
  returning * into mine;

  return mine;
end $$;

-- A new function is executable by everybody until it is told otherwise.
revoke all on function public.configure_world(uuid, text, text, text, text, text, text[])
  from public, anon;
grant execute on function public.configure_world(uuid, text, text, text, text, text, text[])
  to authenticated;

commit;
