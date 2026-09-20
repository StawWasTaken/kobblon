-- Putting a World away, and getting rid of it.
--
-- Two different things that get muddled into one button everywhere:
--
--   Archived is "I am done with this, stop showing it to me." It is still
--   there, it still opens, its files are untouched, and it comes back.
--   Deleted is "this should not exist." That one is not undone.
--
-- Unpublishing is a third thing again and already exists: a World can be
-- unpublished and still be one you work on every day.

alter table public.worlds add column if not exists archived_at timestamptz;

/*
 * Archiving takes it out of the shelf it was on and off the front of the
 * site. It does not unpublish: a link somebody already has still opens, and
 * that is deliberate, because a World vanishing for everybody is deletion
 * and deletion has its own function.
 */
create or replace function public.archive_world(which uuid, away boolean default true)
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

  update public.worlds
     set archived_at = case when away then now() else null end,
         updated_at = now()
   where id = which
  returning * into mine;

  return mine;
end $$;

revoke all on function public.archive_world(uuid, boolean) from public, anon;
grant execute on function public.archive_world(uuid, boolean) to authenticated;

/**
 * Getting rid of a World.
 *
 * Marked removed rather than deleted from the table, because a row that
 * vanishes takes its likes, its watchers and somebody's notifications with
 * it, and because a moderator looking into a report needs the thing the
 * report is about to still exist. It stops being published, stops being
 * listed, stops answering, and its name is freed.
 *
 * The files go. Those are the part that costs money to keep and the part
 * nobody is going to want back.
 */
create or replace function public.delete_world(which uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare mine public.worlds;
begin
  select * into mine from public.worlds where id = which;
  if mine.id is null then
    raise exception 'There is no World with that number.';
  end if;
  if mine.owner_id <> auth.uid() and not public.is_moderator() then
    raise exception 'That is not your World.';
  end if;

  update public.worlds
     set is_removed = true,
         is_published = false,
         archived_at = null,
         updated_at = now()
   where id = which;

  -- The rows that only mean something while the World is somewhere people
  -- can reach. What people thought of it is kept, for moderation.
  delete from public.world_watchers where world_id = which;
  delete from public.world_media where world_id = which;
  delete from storage.objects
   where bucket_id = 'worlds' and (storage.foldername(name))[1] = which::text;
end $$;

revoke all on function public.delete_world(uuid) from public, anon;
grant execute on function public.delete_world(uuid) to authenticated;

/*
 * The old shape has to go rather than be replaced: a default argument does
 * not overload the no-argument version, it sits beside it, and then neither
 * Postgres nor PostgREST can tell which one was meant.
 */
drop function if exists public.my_worlds();

/**
 * What somebody has built.
 *
 * `shelf` says which pile: everything, what is out, what is put away, what
 * has not been published. Archived Worlds stay out of the default list,
 * because putting something away should mean not seeing it.
 */
create or replace function public.my_worlds(shelf text default 'active')
returns setof public.worlds
language sql security definer set search_path = public, extensions stable as $$
  select * from public.worlds
   where owner_id = auth.uid()
     and not is_removed
     and case shelf
           when 'archived' then archived_at is not null
           when 'published' then is_published and archived_at is null
           when 'drafts' then not is_published and archived_at is null
           when 'all' then true
           else archived_at is null
         end
   order by updated_at desc
$$;

grant execute on function public.my_worlds(text) to authenticated;

/* A World that is put away is not on the front of the site. */
create or replace function public.world_to_play(wanted uuid)
returns table (
  id uuid,
  name text,
  creator_name text,
  cover_url text,
  manifest_url text,
  runtime_version integer
)
language sql security definer set search_path = public, extensions stable as $$
  select w.id, w.name, w.creator_name, w.cover_url, w.manifest_url, w.runtime_version
    from public.worlds w
   where w.id = wanted and w.is_published and not w.is_removed
$$;

grant execute on function public.world_to_play(uuid) to anon, authenticated;
