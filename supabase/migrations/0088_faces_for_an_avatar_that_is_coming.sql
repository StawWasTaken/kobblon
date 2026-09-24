-- Faces.
--
-- Flat pictures worn on K6's head, the way the first brick-toy avatars wore
-- theirs. Not a Marketplace upload and not a Style item: a Style item
-- decorates the picture on somebody's profile, and a face is a thing an
-- avatar wears in a World.
--
-- Only Kobblon publishes these. That is the whole point of them: they are
-- the platform's own set, the way a platform's first faces always are, and
-- a face anybody could upload is a Decal with extra steps.
--
-- There is no avatar rig yet and no page to dress one on. This is built
-- anyway, because the alternative is a catalogue with nothing in it on the
-- day the rig lands. What it does today is exist, be listed, and be bought.
-- Wearing waits.

/*
 * `is_kobblon()` already exists and already means the right thing: it asks
 * whether the account is the one named kobblon, rather than whether
 * somebody carries an admin flag. Faces are published by Kobblon the
 * account, so that is the question to ask.
 */

create table if not exists public.faces (
  id uuid primary key default gen_random_uuid(),
  content_id bigint default nextval('public.content_id_seq'),
  name text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 300),
  /** A path in the faces bucket. Never an address. */
  image_path text not null check (
    char_length(image_path) between 3 and 400
    and image_path !~ '[[:space:]]'
    and image_path !~ '\.\.'
  ),
  /** In Brix. Nought is free, which most of the first ones will be. */
  price integer not null default 0 check (price >= 0 and price <= 1000000),
  is_public boolean not null default true,
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists faces_content_idx on public.faces (content_id);
create index if not exists faces_shelf_idx
  on public.faces (created_at desc) where is_public and not is_removed;

create table if not exists public.face_owners (
  face_id uuid not null references public.faces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  paid integer not null default 0,
  acquired_at timestamptz not null default now(),
  primary key (face_id, user_id)
);

create index if not exists face_owners_user_idx
  on public.face_owners (user_id, acquired_at desc);

/*
 * What somebody is wearing. Null is the face K6 is drawn with when nobody
 * has chosen: a default is a face too, it just is not one anybody owns.
 *
 * Nothing reads this yet. It is here because the engine will, and because a
 * choice with nowhere to be stored is a choice nobody can make.
 */
alter table public.profiles
  add column if not exists face_id uuid references public.faces on delete set null;

-- ------------------------------------------------------------- the bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('faces', 'faces', true, 4194304,
        array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/* Anybody may see a face. Only Kobblon puts one there. */
drop policy if exists faces_files_read on storage.objects;
create policy faces_files_read on storage.objects for select
  using (bucket_id = 'faces');

drop policy if exists faces_files_write on storage.objects;
create policy faces_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'faces' and public.is_kobblon());

drop policy if exists faces_files_change on storage.objects;
create policy faces_files_change on storage.objects for update to authenticated
  using (bucket_id = 'faces' and public.is_kobblon());

drop policy if exists faces_files_remove on storage.objects;
create policy faces_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'faces' and public.is_kobblon());

-- --------------------------------------------------------------- the rules

alter table public.faces enable row level security;
alter table public.face_owners enable row level security;

drop policy if exists faces_read on public.faces;
create policy faces_read on public.faces for select
  using ((is_public and not is_removed) or public.is_kobblon());

/*
 * Writing is Kobblon's alone, and that is enforced here rather than by the
 * pages: a policy is the only thing a browser cannot talk its way past.
 */
drop policy if exists faces_write on public.faces;
create policy faces_write on public.faces for insert to authenticated
  with check (public.is_kobblon());

drop policy if exists faces_change on public.faces;
create policy faces_change on public.faces for update to authenticated
  using (public.is_kobblon()) with check (public.is_kobblon());

drop policy if exists face_owners_read on public.face_owners;
create policy face_owners_read on public.face_owners for select using (true);

/*
 * Nobody grants themselves a face. Buying goes through the function below,
 * which is the only thing that may write here.
 */
revoke insert, update, delete on public.face_owners from authenticated, anon;

grant select on public.faces, public.face_owners to anon, authenticated;
grant insert, update on public.faces to authenticated;

-- ------------------------------------------------------------- the catalogue

/** Faces to look through, with whether this person already owns each one. */
create or replace function public.face_catalogue(search text default null, wanted integer default 60)
returns table (
  id uuid,
  content_id bigint,
  name text,
  description text,
  image_path text,
  price integer,
  owned boolean,
  created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select f.id, f.content_id, f.name, f.description, f.image_path, f.price,
         exists (
           select 1 from public.face_owners o
            where o.face_id = f.id and o.user_id = auth.uid()
         ),
         f.created_at
    from public.faces f
   where f.is_public and not f.is_removed
     and (search is null or f.name ilike '%' || search || '%')
   order by f.price, f.created_at desc
   limit greatest(least(coalesce(wanted, 60), 200), 1)
$$;

grant execute on function public.face_catalogue(text, integer) to anon, authenticated;

/**
 * Buying a face.
 *
 * One statement moves the Brix and records what was bought, or neither
 * happens. A free face is still bought, because owning it is what lets
 * somebody wear it later and "free" is a price, not an exception.
 */
create or replace function public.buy_face(which uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item public.faces;
  purse integer;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  select * into item from public.faces
   where id = which and is_public and not is_removed;
  if item.id is null then
    raise exception 'That face is not for sale.';
  end if;

  if exists (select 1 from public.face_owners where face_id = which and user_id = me) then
    return; -- already owned, and buying it twice is not an error worth raising
  end if;

  if item.price > 0 then
    select pixels into purse from public.profiles where id = me for update;
    if coalesce(purse, 0) < item.price then
      raise exception 'Not enough Brix.';
    end if;
    update public.profiles set pixels = pixels - item.price where id = me;
  end if;

  insert into public.face_owners (face_id, user_id, paid) values (which, me, item.price);
end $$;

revoke all on function public.buy_face(uuid) from public, anon;
grant execute on function public.buy_face(uuid) to authenticated;

/** What somebody owns, for the Avatar page when there is one. */
create or replace function public.my_faces()
returns setof public.faces
language sql stable security definer set search_path = public, extensions as $$
  select f.* from public.faces f
    join public.face_owners o on o.face_id = f.id
   where o.user_id = auth.uid() and not f.is_removed
   order by o.acquired_at desc
$$;

grant execute on function public.my_faces() to authenticated;

/**
 * Wearing one.
 *
 * Refuses a face nobody owns, because the point of buying one is that not
 * everybody has it. Null takes it off and puts K6 back to its own face.
 */
create or replace function public.wear_face(which uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  if which is not null
     and not exists (select 1 from public.face_owners where face_id = which and user_id = me) then
    raise exception 'That is not one of yours.';
  end if;

  update public.profiles set face_id = which where id = me;
end $$;

revoke all on function public.wear_face(uuid) from public, anon;
grant execute on function public.wear_face(uuid) to authenticated;
