-- Experiences: the things the engine runs.
--
-- A Space is what somebody built on the website, and what the website has
-- always meant by a Space is a 2D site. An experience is different content
-- with a different runtime, so it is its own table rather than a flag on that
-- one. They can be related, and a Space is not required.
--
-- The Launcher reads six fields and nothing else: id, name, creator_name,
-- cover_url, manifest_url and runtime_version. Everything else here is the
-- website's business.

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  /** Optional, for an experience that belongs to something on the site. */
  space_id uuid references public.spaces on delete set null,
  owner_id uuid references public.profiles on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  description text check (char_length(description) <= 600),
  /** Denormalised so a loading screen needs one row and no joins. */
  creator_name text check (char_length(creator_name) <= 48),
  cover_url text,

  /*
   * Where the engine fetches the manifest. Kobblon's own addresses only: an
   * experience that could point the runtime at any host on the internet is a
   * way to make every player fetch anything.
   */
  manifest_url text not null check (
    manifest_url ~ '^https://([a-z0-9-]+\.)*kobblon\.com/[^[:space:]]*$'
    or manifest_url ~ '^https://[a-z0-9-]+\.supabase\.co/[^[:space:]]*$'
  ),

  /*
   * One number. An experience made for a newer runtime says so rather than
   * failing strangely. Not a compatibility matrix and not to become one.
   */
  runtime_version integer not null default 1 check (runtime_version between 1 and 999),

  is_published boolean not null default false,
  is_removed boolean not null default false,
  visit_count bigint not null default 0,
  like_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The website addresses everything by a number and a name, and an experience
-- is not an exception: /e/1042/first-ground.
alter table public.experiences add column if not exists content_id bigint;
alter table public.experiences add column if not exists slug text;

create unique index if not exists experiences_content_id_idx
  on public.experiences (content_id);
create index if not exists experiences_published_idx
  on public.experiences (is_published, published_at desc)
  where is_published and not is_removed;
create index if not exists experiences_owner_idx on public.experiences (owner_id);

-- The address book already knows about Spaces and Communities. It knows
-- about experiences now too, so a renamed one keeps its old link working the
-- same way everything else does.
alter table public.slug_history drop constraint if exists slug_history_kind_check;
alter table public.slug_history add constraint slug_history_kind_check
  check (kind in ('space', 'community', 'experience'));

/**
 * A number and an address, given on the way in, and kept in step with the
 * name after that. Written as one trigger because the slug and the history
 * entry have to agree, and two triggers is how they stop agreeing.
 */
create or replace function public.experience_gets_an_address()
returns trigger language plpgsql security definer set search_path = public as $$
declare wanted text;
begin
  if new.content_id is null then
    new.content_id := nextval('public.content_id_seq');
  end if;

  if tg_op = 'INSERT' then
    new.slug := public.free_slug(new.name, 'experience', null, new.id);
    return new;
  end if;

  new.updated_at := now();
  if new.name is not distinct from old.name then return new; end if;

  wanted := public.free_slug(new.name, 'experience', null, new.id);
  if wanted = old.slug then return new; end if;

  insert into public.slug_history (kind, slug, target)
  values ('experience', old.slug, new.id)
  on conflict (kind, slug) do update set target = excluded.target, changed_at = now();

  new.slug := wanted;
  return new;
end $$;

drop trigger if exists experiences_address on public.experiences;
drop trigger if exists experiences_slug_history on public.experiences;
create trigger experiences_address before insert or update on public.experiences
  for each row execute function public.experience_gets_an_address();

alter table public.experiences enable row level security;

/*
 * Anybody may read a published experience, including somebody with no
 * account: the Launcher reads this before anybody has signed in, and a shared
 * link has to answer in a browser.
 */
drop policy if exists experiences_read on public.experiences;
create policy experiences_read on public.experiences for select
  using ((is_published and not is_removed) or owner_id = auth.uid() or public.is_moderator());

drop policy if exists experiences_write on public.experiences;
create policy experiences_write on public.experiences for update
  using (owner_id = auth.uid() or public.is_moderator())
  with check (owner_id = auth.uid() or public.is_moderator());

grant select on public.experiences to anon, authenticated;
grant update on public.experiences to authenticated;

/**
 * What the player asks for, by id, and the only way it gets told.
 *
 * A function rather than a table read so the Launcher's request is one
 * round trip that cannot be widened, and so an unpublished or removed
 * experience is a plain "no" rather than a row somebody can probe for.
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
  select e.id, e.name, e.creator_name, e.cover_url, e.manifest_url, e.runtime_version
    from public.experiences e
   where e.id = wanted
     and e.is_published
     and not e.is_removed
$$;

grant execute on function public.experience_to_play(uuid) to anon, authenticated;

/** A visit, counted once the runtime actually has the thing. */
create or replace function public.experience_started(wanted uuid)
returns void
language sql security definer set search_path = public as $$
  update public.experiences set visit_count = visit_count + 1
   where id = wanted and is_published and not is_removed
$$;

grant execute on function public.experience_started(uuid) to anon, authenticated;

/**
 * The first one, so the Launcher has something real to open.
 *
 * It points at the manifest published with the site, which is the same file
 * the engine harness runs against. Kobblon owns it, so there is no question
 * about what a player is fetching.
 */
insert into public.experiences (
  id, name, description, creator_name, manifest_url, runtime_version,
  cover_url, is_published, published_at
)
values (
  'e0000000-0000-4000-8000-000000000001',
  'First Ground',
  'The first thing the Kobblon Engine ever ran. A floor, some stairs, a gateway and somewhere to jump off.',
  'Kobblon',
  'https://kobblon.com/experiences/first-ground.json',
  1,
  'https://kobblon.com/brand/og.png',
  true,
  now()
)
on conflict (id) do update
  set manifest_url = excluded.manifest_url,
      is_published = excluded.is_published;
