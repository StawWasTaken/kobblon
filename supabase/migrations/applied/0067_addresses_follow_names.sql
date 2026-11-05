-- Names change, so addresses follow them.
--
-- A link on Kobbleston is a number and a name: /c/1016/attic-club. The number
-- resolves and the name is for people to read, which is what keeps old links
-- working. Until now the name in the address was whatever it was when the
-- thing was made, so a Community called something else for a month still had
-- its old name in every link.
--
-- From here the stored slug follows the name, and the address a page rewrites
-- itself to is the current one. Whatever the slug used to be is kept, so the
-- addresses people have already sent each other still land in the right
-- place rather than in a 404.

create or replace function public.slugify(value text)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'),
          '(^-+|-+$)', '', 'g'
        ),
        '-'
      ),
      ''
    ),
    'untitled'
  );
$$;

create table if not exists public.slug_history (
  kind text not null check (kind in ('space', 'community')),
  slug text not null,
  target uuid not null,
  changed_at timestamptz not null default now(),
  primary key (kind, slug)
);

alter table public.slug_history enable row level security;

/*
 * Anybody may read it, because it only says which address used to point at
 * which thing, and everything it points at is already public. Nothing writes
 * to it but the triggers below.
 */
drop policy if exists slug_history_read on public.slug_history;
create policy slug_history_read on public.slug_history for select using (true);

grant select on public.slug_history to anon, authenticated;

/** A slug nobody else in the same place is using. */
create or replace function public.free_slug(
  wanted text, kind text, owner uuid, keep uuid
)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  base text := public.slugify(wanted);
  candidate text := base;
  n integer := 1;
begin
  -- The check constraint on a Space slug asks for at least three characters.
  if char_length(base) < 3 then
    base := base || '-' || kind;
    candidate := base;
  end if;

  loop
    exit when not exists (
      select 1 from public.spaces s
       where kind = 'space' and s.owner_id = owner and s.slug = candidate
         and (keep is null or s.id <> keep)
      union all
      select 1 from public.communities c
       where kind = 'community' and c.slug = candidate
         and (keep is null or c.id <> keep)
      union all
      select 1 from public.slug_history h
       where h.kind = free_slug.kind and h.slug = candidate
         and (keep is null or h.target <> keep)
    );

    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  return candidate;
end;
$$;

/** Renaming a Space moves its address with it, and keeps the old one. */
create or replace function public.space_slug_follows_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare wanted text;
begin
  if new.name is not distinct from old.name then return new; end if;

  wanted := public.free_slug(new.name, 'space', new.owner_id, new.id);
  if wanted = old.slug then return new; end if;

  insert into public.slug_history (kind, slug, target)
  values ('space', old.slug, new.id)
  on conflict (kind, slug) do update set target = excluded.target, changed_at = now();

  new.slug := wanted;
  return new;
end;
$$;

drop trigger if exists spaces_slug_follows_name on public.spaces;
create trigger spaces_slug_follows_name before update of name on public.spaces
  for each row execute function public.space_slug_follows_name();

create or replace function public.community_slug_follows_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare wanted text;
begin
  if new.name is not distinct from old.name then return new; end if;

  wanted := public.free_slug(new.name, 'community', null, new.id);
  if wanted = old.slug then return new; end if;

  insert into public.slug_history (kind, slug, target)
  values ('community', old.slug, new.id)
  on conflict (kind, slug) do update set target = excluded.target, changed_at = now();

  new.slug := wanted;
  return new;
end;
$$;

drop trigger if exists communities_slug_follows_name on public.communities;
create trigger communities_slug_follows_name before update of name on public.communities
  for each row execute function public.community_slug_follows_name();

/**
 * Where an old address goes now. Answers for a slug that has moved, for a
 * username somebody used to have, and says nothing at all about anything
 * that was never public.
 */
drop function if exists public.address_now(text, text);
create or replace function public.address_now(kind text, old_slug text)
returns text language sql stable security definer set search_path = public as $$
  select case kind
    when 'space' then (
      select s.slug from public.slug_history h
        join public.spaces s on s.id = h.target
       where h.kind = 'space' and h.slug = old_slug and not s.is_removed
    )
    when 'community' then (
      select c.slug from public.slug_history h
        join public.communities c on c.id = h.target
       where h.kind = 'community' and h.slug = old_slug and not c.is_removed
    )
    when 'person' then (
      select p.username from public.username_history u
        join public.profiles p on p.id = u.user_id
       where lower(u.username) = lower(old_slug) and not p.is_suspended
       order by u.changed_at desc
       limit 1
    )
    else null
  end;
$$;

grant execute on function public.address_now, public.slugify to anon, authenticated;
