begin;

/*
 * Clips.
 *
 * Staw's idea four: the Launcher can already draw the World, so it can keep
 * the last thirty seconds of it, and a clip landing on a profile, on a
 * World's page and in a chat is how a platform markets itself without
 * paying anybody.
 *
 * The recording is the Launcher's half and none of it is here. This is
 * where one lands: a bucket, a row, who may see it, and the places it can
 * be asked for. Nothing on the website pretends to record - a control that
 * implies something the runtime does not do is worse than no control.
 */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clips', 'clips', true, 134217728,
  array['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/*
 * Anybody may read one. The bucket is public because a clip is a thing you
 * send somebody, and a signed address that dies in an hour is not that.
 *
 * Which clips are *findable* is the table's business, below: the file sits
 * at an unguessable path and the row is what carries it onto a page.
 *
 * Writing is your own folder only, so a clip can never be put against
 * somebody else's name.
 */
drop policy if exists clips_read on storage.objects;
create policy clips_read on storage.objects for select
  using (bucket_id = 'clips');

drop policy if exists clips_write on storage.objects;
create policy clips_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists clips_replace on storage.objects;
create policy clips_replace on storage.objects for update to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists clips_remove on storage.objects;
create policy clips_remove on storage.objects for delete to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------- the row

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  /* The number in its link, off the same sequence as everything else that
     has a page. */
  content_id bigint not null default nextval('public.content_id_seq'),
  owner_id uuid not null references public.profiles on delete cascade,
  /* The World it was taken in. Null is allowed and means the World is gone,
     not that the clip is. */
  world_id uuid references public.worlds on delete set null,
  title text check (char_length(title) between 1 and 80),
  /* Both in the clips bucket, both under the owner's own folder. */
  path text not null,
  poster_path text,
  seconds integer not null default 0 check (seconds between 0 and 60),
  /*
   * Who may find it. The same two words the rest of the platform's privacy
   * uses, so there is one vocabulary. Everyone by default, because reach is
   * the entire point of the feature; the owner can narrow it.
   */
  privacy text not null default 'everyone' check (privacy in ('everyone', 'friends')),
  view_count bigint not null default 0,
  is_removed boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists clips_content_idx on public.clips (content_id);
create index if not exists clips_owner_idx on public.clips (owner_id, created_at desc);
create index if not exists clips_world_idx on public.clips (world_id, created_at desc);

/*
 * Grants in the same file as the table. A policy decides which rows a role
 * may see; a grant decides whether it may touch the table at all.
 *
 * Select only. Every write goes through the functions below, so the path a
 * row carries is always one the caller was allowed to write to.
 */
alter table public.clips enable row level security;
grant select on public.clips to anon, authenticated;

drop policy if exists clips_readable on public.clips;
create policy clips_readable on public.clips for select
  using (
    not is_removed
    and (
      owner_id = auth.uid()
      or privacy = 'everyone'
      or public.are_friends(auth.uid(), owner_id)
    )
  );

-- -------------------------------------------------- making and unmaking

/**
 * Record a clip that has already been uploaded.
 *
 * The Launcher puts the file in the clips bucket under its own folder - the
 * storage policy is what allows that and nothing else - and then says so
 * here. Both paths are checked against the caller's own folder again,
 * because a path is a string somebody sent us.
 */
create or replace function public.make_clip(
  world uuid,
  file text,
  poster text default null,
  title text default null,
  how_long integer default 0,
  who_sees text default 'everyone'
)
returns public.clips
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made public.clips;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not public.may_play(me) then
    raise exception 'This account cannot post right now.';
  end if;

  if file is null or (storage.foldername(file))[1] is distinct from me::text then
    raise exception 'That file is not yours.';
  end if;
  if poster is not null and (storage.foldername(poster))[1] is distinct from me::text then
    raise exception 'That picture is not yours.';
  end if;
  if who_sees not in ('everyone', 'friends') then
    raise exception 'Who sees it is everyone or friends.';
  end if;

  insert into public.clips (owner_id, world_id, path, poster_path, title, seconds, privacy)
  values (me, world, file, poster, nullif(btrim(coalesce(title, '')), ''),
          greatest(0, least(60, coalesce(how_long, 0))), who_sees)
  returning * into made;

  return made;
end;
$$;

/** Take one down. The owner, or staff. The file goes with it. */
create or replace function public.remove_clip(which uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  select owner_id into owner from public.clips where id = which;
  if owner is null then raise exception 'No such clip.'; end if;
  if owner is distinct from me and not public.is_admin() then
    raise exception 'That is not yours.';
  end if;

  update public.clips set is_removed = true where id = which;
end;
$$;

/** Change who may see one. */
create or replace function public.set_clip_privacy(which uuid, who_sees text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if who_sees not in ('everyone', 'friends') then
    raise exception 'Who sees it is everyone or friends.';
  end if;
  update public.clips set privacy = who_sees
   where id = which and owner_id = auth.uid();
  if not found then raise exception 'That is not yours.'; end if;
end;
$$;

/** Somebody watched it. Counted once per call, by anybody, signed in or not. */
create or replace function public.watched_clip(which uuid)
returns void
language sql security definer set search_path = public, extensions as $$
  update public.clips set view_count = view_count + 1
   where id = which and not is_removed;
$$;

-- ---------------------------------------------------------- asking for them

/*
 * One shape for every list of clips, so the website has one card to draw.
 *
 * Each of these is `security definer` and does its own deciding, because a
 * definer function does not see the table's policy: `privacy` is spelled
 * out in the `where` of every one of them.
 */

create or replace function public.clips_of(target uuid, limit_count int default 12)
returns table (
  id uuid, content_id bigint, title text, path text, poster_path text,
  seconds integer, privacy text, view_count bigint, created_at timestamptz,
  owner_id uuid, owner_username text, owner_display_name text, owner_avatar_url text,
  world_id uuid, world_name text, world_slug text, world_content_id bigint
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.content_id, c.title, c.path, c.poster_path,
         c.seconds, c.privacy, c.view_count, c.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         w.id, w.name, w.slug, w.content_id
    from public.clips c
    join public.profiles p on p.id = c.owner_id
    left join public.worlds w on w.id = c.world_id
   where c.owner_id = target
     and not c.is_removed
     and (c.owner_id = auth.uid()
          or c.privacy = 'everyone'
          or public.are_friends(auth.uid(), c.owner_id))
   order by c.created_at desc
   limit least(greatest(limit_count, 1), 50);
$$;

/** The clips taken in one World. Its own trailer, made by the people in it. */
create or replace function public.clips_in_world(wanted uuid, limit_count int default 12)
returns table (
  id uuid, content_id bigint, title text, path text, poster_path text,
  seconds integer, privacy text, view_count bigint, created_at timestamptz,
  owner_id uuid, owner_username text, owner_display_name text, owner_avatar_url text,
  world_id uuid, world_name text, world_slug text, world_content_id bigint
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.content_id, c.title, c.path, c.poster_path,
         c.seconds, c.privacy, c.view_count, c.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         w.id, w.name, w.slug, w.content_id
    from public.clips c
    join public.profiles p on p.id = c.owner_id
    join public.worlds w on w.id = c.world_id
   where c.world_id = wanted
     and not c.is_removed
     and c.privacy = 'everyone'
     and not p.is_suspended
   order by c.created_at desc
   limit least(greatest(limit_count, 1), 50);
$$;

/**
 * What your friends have kept lately.
 *
 * This is the nearest thing to a feed the platform has, and it is
 * deliberately only friends and the people you follow - Staw's own line on
 * what not to build is "not a feed of strangers".
 */
create or replace function public.clips_from_friends(limit_count int default 12)
returns table (
  id uuid, content_id bigint, title text, path text, poster_path text,
  seconds integer, privacy text, view_count bigint, created_at timestamptz,
  owner_id uuid, owner_username text, owner_display_name text, owner_avatar_url text,
  world_id uuid, world_name text, world_slug text, world_content_id bigint
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.content_id, c.title, c.path, c.poster_path,
         c.seconds, c.privacy, c.view_count, c.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         w.id, w.name, w.slug, w.content_id
    from public.clips c
    join public.profiles p on p.id = c.owner_id
    left join public.worlds w on w.id = c.world_id
   where not c.is_removed
     and c.owner_id <> auth.uid()
     and not p.is_suspended
     and (
       public.are_friends(auth.uid(), c.owner_id)
       or (c.privacy = 'everyone' and exists (
             select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = c.owner_id))
     )
   order by c.created_at desc
   limit least(greatest(limit_count, 1), 50);
$$;

/** One clip, by the number in its link. */
create or replace function public.clip_by_number(wanted bigint)
returns table (
  id uuid, content_id bigint, title text, path text, poster_path text,
  seconds integer, privacy text, view_count bigint, created_at timestamptz,
  owner_id uuid, owner_username text, owner_display_name text, owner_avatar_url text,
  world_id uuid, world_name text, world_slug text, world_content_id bigint
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.content_id, c.title, c.path, c.poster_path,
         c.seconds, c.privacy, c.view_count, c.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         w.id, w.name, w.slug, w.content_id
    from public.clips c
    join public.profiles p on p.id = c.owner_id
    left join public.worlds w on w.id = c.world_id
   where c.content_id = wanted
     and not c.is_removed
     and (c.owner_id = auth.uid()
          or c.privacy = 'everyone'
          or public.are_friends(auth.uid(), c.owner_id));
$$;

grant execute on function public.make_clip(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.remove_clip(uuid) to authenticated;
grant execute on function public.set_clip_privacy(uuid, text) to authenticated;
grant execute on function public.watched_clip(uuid) to anon, authenticated;
grant execute on function public.clips_of(uuid, int) to anon, authenticated;
grant execute on function public.clips_in_world(uuid, int) to anon, authenticated;
grant execute on function public.clips_from_friends(int) to authenticated;
grant execute on function public.clip_by_number(bigint) to anon, authenticated;

commit;
