-- What a World is made of, what a World looks like, and who says so.
--
-- Three things Creator is finished and waiting on, and one that only looks
-- like the same thing and is not.
--
--  1. A model is a fifth kind of Marketplace upload. The enum already had it
--     and the pages already draw it; nothing could be uploaded because the
--     bucket refused the file.
--  2. A World's emblem and its thumbnails are NOT Marketplace items. They
--     belong to the World rather than to anybody who might reuse them, so
--     they live in the World's own folder and in a table of their own.
--  3. Configuring a World is one function with one signature, because two
--     clients are about to call it and a second signature is a second set of
--     rules about who may do what.

-- --------------------------------------------------------------- 1. models

/*
 * A model is Kobblon's own .kbfl, which is JSON:
 *
 *   {"kobblon":"kobblon.part","format":1,"name":…,"part":{…}}
 *
 * No new format and no new bucket. The file is a piece of Marketplace
 * content like any other: it is screened, it gets a content id, and it is
 * used by that id rather than by an address. It is MDL- for the same reason
 * a picture is IMG-.
 *
 * The file is still user content and is still not trusted. Nothing here
 * parses it; the runtime that reads it is the thing that refuses what it
 * cannot make sense of.
 */
update storage.buckets
   set allowed_mime_types = array(
     select distinct unnest(allowed_mime_types || array['application/json', 'text/plain'])
   )
 where id = 'uploads';

-- ---------------------------------------------------- 2. a World's own media

/*
 * The emblem is cover_url and stays where it is: one World, one emblem.
 *
 * Everything else a World shows of itself is a row here. Ordered, because a
 * World decides what is first; typed, because one of them is a video and a
 * page has to know that before it draws an <img>; and pointing at a path in
 * the worlds bucket rather than an address, because the policies on that
 * bucket already say only the owner writes inside their own World's folder.
 */
create table if not exists public.world_media (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds on delete cascade,
  /** What order the World shows them in. */
  position smallint not null default 0 check (position between 0 and 20),
  kind text not null check (kind in ('image', 'video')),
  /** A path inside the worlds bucket. Never a URL: a URL can name any host. */
  path text not null check (
    char_length(path) between 3 and 400
    and path !~ '[[:space:]]'
    and path !~ '\.\.'
  ),
  created_at timestamptz not null default now()
);

create index if not exists world_media_world_idx
  on public.world_media (world_id, position);

/* A World shows at most a dozen of itself. */
create or replace function public.world_media_is_not_endless()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if (select count(*) from public.world_media where world_id = new.world_id) >= 12 then
    raise exception 'That World already has as many pictures as it can show.';
  end if;
  return new;
end $$;

drop trigger if exists world_media_capped on public.world_media;
create trigger world_media_capped before insert on public.world_media
  for each row execute function public.world_media_is_not_endless();

alter table public.world_media enable row level security;

/* Anybody may see the media of a World they can see. */
drop policy if exists world_media_read on public.world_media;
create policy world_media_read on public.world_media for select
  using (
    exists (
      select 1 from public.worlds w
       where w.id = world_media.world_id
         and not w.is_removed
         and (w.is_published or w.owner_id = auth.uid() or public.is_moderator())
    )
  );

/* Only the owner of the World writes its media, and only in that World. */
drop policy if exists world_media_write on public.world_media;
create policy world_media_write on public.world_media for insert to authenticated
  with check (
    exists (
      select 1 from public.worlds w
       where w.id = world_media.world_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists world_media_change on public.world_media;
create policy world_media_change on public.world_media for update to authenticated
  using (
    exists (
      select 1 from public.worlds w
       where w.id = world_media.world_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists world_media_remove on public.world_media;
create policy world_media_remove on public.world_media for delete to authenticated
  using (
    exists (
      select 1 from public.worlds w
       where w.id = world_media.world_id and w.owner_id = auth.uid()
    )
  );

grant select on public.world_media to anon, authenticated;
grant insert, update, delete on public.world_media to authenticated;

-- ----------------------------------------------------------- 3. the genres

/*
 * A list, in the database, so that the website and Creator cannot each
 * invent their own and end up with "Obby" and "obstacle course" being two
 * different genres nobody can search across.
 */
create table if not exists public.world_genres (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$'),
  label text not null,
  position smallint not null default 0
);

insert into public.world_genres (id, label, position) values
  ('adventure',  'Adventure',        1),
  ('obby',       'Obby',             2),
  ('roleplay',   'Roleplay',         3),
  ('simulator',  'Simulator',        4),
  ('tycoon',     'Tycoon',           5),
  ('fighting',   'Fighting',         6),
  ('shooter',    'Shooter',          7),
  ('racing',     'Racing',           8),
  ('puzzle',     'Puzzle',           9),
  ('horror',     'Horror',          10),
  ('survival',   'Survival',        11),
  ('sports',     'Sports',          12),
  ('building',   'Building',        13),
  ('social',     'Hangout',         14),
  ('showcase',   'Showcase',        15),
  ('other',      'Something else',  99)
on conflict (id) do update set label = excluded.label, position = excluded.position;

alter table public.world_genres enable row level security;
drop policy if exists world_genres_read on public.world_genres;
create policy world_genres_read on public.world_genres for select using (true);
grant select on public.world_genres to anon, authenticated;

alter table public.worlds add column if not exists genre text
  references public.world_genres on delete set null;

/*
 * How grown up a World is. The same four words the rest of the site uses, so
 * a person setting this has seen them before.
 */
alter table public.worlds add column if not exists maturity text not null default 'everyone';
alter table public.worlds drop constraint if exists worlds_maturity_check;
alter table public.worlds add constraint worlds_maturity_check
  check (maturity in ('everyone', 'mild', 'moderate', 'strong'));

-- ------------------------------------------------------- 4. configure_world

/**
 * Everything about a World that is not its scene, set in one place.
 *
 * One signature, called by the Create pages and by Creator alike. Null means
 * leave it alone, so a client that only knows about three of these fields
 * does not wipe the other four by not knowing them.
 *
 * Publishing is not here. It has its own rules and its own function, and
 * lumping the two together makes a name change and putting a World in front
 * of people into the same action.
 */
create or replace function public.configure_world(
  which uuid,
  called text default null,
  about text default null,
  genre text default null,
  maturity text default null,
  cover text default null
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
         updated_at  = now()
   where id = which
  returning * into mine;

  return mine;
end $$;

-- A new function is executable by everybody until it is told otherwise.
revoke all on function public.configure_world(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.configure_world(uuid, text, text, text, text, text) to authenticated;

/** The genres, in the order they are shown. */
create or replace function public.world_genre_list()
returns setof public.world_genres
language sql stable set search_path = public, extensions as $$
  select * from public.world_genres order by position, label
$$;

grant execute on function public.world_genre_list() to anon, authenticated;
