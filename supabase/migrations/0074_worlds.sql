-- Experiences become Worlds.
--
-- Kobblon does not make Spaces any more, and "experience" is the word another
-- platform uses. A World is what somebody builds and what the engine runs.
-- The name is settled here, in the database, so the website, the Launcher and
-- Creator cannot each pick their own.
--
-- The old name keeps working for a while: the Launcher was handed
-- experience_to_play days ago and should not break the moment this lands.

alter table if exists public.experiences rename to worlds;

alter index if exists experiences_content_id_idx rename to worlds_content_id_idx;
alter index if exists experiences_published_idx rename to worlds_published_idx;
alter index if exists experiences_owner_idx rename to worlds_owner_idx;

-- The address book learns the new word, and keeps the old one so links that
-- were already written still resolve.
alter table public.slug_history drop constraint if exists slug_history_kind_check;
alter table public.slug_history add constraint slug_history_kind_check
  check (kind in ('space', 'community', 'experience', 'world'));

update public.slug_history set kind = 'world' where kind = 'experience';

create or replace function public.world_gets_an_address()
returns trigger language plpgsql security definer set search_path = public as $$
declare wanted text;
begin
  if new.content_id is null then
    new.content_id := nextval('public.content_id_seq');
  end if;

  if tg_op = 'INSERT' then
    new.slug := public.free_slug(new.name, 'world', null, new.id);
    return new;
  end if;

  new.updated_at := now();
  if new.name is not distinct from old.name then return new; end if;

  wanted := public.free_slug(new.name, 'world', null, new.id);
  if wanted = old.slug then return new; end if;

  insert into public.slug_history (kind, slug, target)
  values ('world', old.slug, new.id)
  on conflict (kind, slug) do update set target = excluded.target, changed_at = now();

  new.slug := wanted;
  return new;
end $$;

drop trigger if exists experiences_address on public.worlds;
drop trigger if exists worlds_address on public.worlds;
create trigger worlds_address before insert or update on public.worlds
  for each row execute function public.world_gets_an_address();

drop function if exists public.experience_gets_an_address();
drop function if exists public.experience_slug_follows_name();

drop policy if exists experiences_read on public.worlds;
drop policy if exists experiences_write on public.worlds;
drop policy if exists worlds_read on public.worlds;
drop policy if exists worlds_write on public.worlds;

create policy worlds_read on public.worlds for select
  using ((is_published and not is_removed) or owner_id = auth.uid() or public.is_moderator());

create policy worlds_write on public.worlds for update
  using (owner_id = auth.uid() or public.is_moderator())
  with check (owner_id = auth.uid() or public.is_moderator());

grant select on public.worlds to anon, authenticated;
grant update on public.worlds to authenticated;

/**
 * What the player asks for, by id. Published Worlds only, and six fields:
 * the runtime has no business with the rest of the row.
 */
create or replace function public.world_to_play(wanted uuid)
returns table (
  id uuid,
  name text,
  creator_name text,
  cover_url text,
  manifest_url text,
  runtime_version integer
)
language sql security definer set search_path = public stable as $$
  select w.id, w.name, w.creator_name, w.cover_url, w.manifest_url, w.runtime_version
    from public.worlds w
   where w.id = wanted
     and w.is_published
     and not w.is_removed
$$;

create or replace function public.world_started(wanted uuid)
returns void
language sql security definer set search_path = public as $$
  update public.worlds set visit_count = visit_count + 1
   where id = wanted and is_published and not is_removed
$$;

grant execute on function public.world_to_play(uuid) to anon, authenticated;
grant execute on function public.world_started(uuid) to anon, authenticated;

/*
 * The old names, kept pointing at the new ones so the Launcher keeps working
 * while it is updated. Delete these once it calls the new pair; they are a
 * courtesy, not an interface.
 */
create or replace function public.experience_to_play(wanted uuid)
returns table (
  id uuid,
  name text,
  creator_name text,
  cover_url text,
  manifest_url text,
  runtime_version integer
)
language sql security definer set search_path = public stable as $$
  select * from public.world_to_play(wanted)
$$;

create or replace function public.experience_started(wanted uuid)
returns void
language sql security definer set search_path = public as $$
  select public.world_started(wanted)
$$;

grant execute on function public.experience_to_play(uuid) to anon, authenticated;
grant execute on function public.experience_started(uuid) to anon, authenticated;
