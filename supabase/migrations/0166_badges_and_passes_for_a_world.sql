begin;

/*
 * Badges a World hands out, and things it sells.
 *
 * Both tabs have been empty states since they were written, and the empty
 * state was honest: a World could not have either. Communities have
 * `space_badges`; Worlds had nothing, and nothing anywhere was a pass.
 *
 * Staw asked for the owner to see an add tile on both tabs that leads
 * somewhere real, and - the part that decides the shape of this - to be
 * able to **copy an id out of it to use in a script**. That is the whole
 * point of the feature: a badge nobody can name from inside a World cannot
 * be awarded by it.
 *
 * So the id is `content_id`, off the sequence the rest of the site uses for
 * the numbers in its links. It is short, it is stable, and it is already
 * what a person sees everywhere else. The uuid stays the key.
 */

create table if not exists public.world_badges (
  id uuid primary key default gen_random_uuid(),
  content_id bigint not null default nextval('public.content_id_seq'),
  world_id uuid not null references public.worlds on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  description text check (char_length(description) <= 600),
  icon_url text,
  is_enabled boolean not null default true,
  awarded_count integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists world_badges_content_idx on public.world_badges (content_id);
create index if not exists world_badges_world_idx on public.world_badges (world_id);

create table if not exists public.world_passes (
  id uuid primary key default gen_random_uuid(),
  content_id bigint not null default nextval('public.content_id_seq'),
  world_id uuid not null references public.worlds on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  description text check (char_length(description) <= 600),
  icon_url text,
  /* In Brix. Free is allowed; a pass can be a key rather than a purchase. */
  price integer not null default 0 check (price between 0 and 1000000),
  is_for_sale boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists world_passes_content_idx on public.world_passes (content_id);
create index if not exists world_passes_world_idx on public.world_passes (world_id);

/*
 * Who holds what. One row per person per pass: a pass is held or it is not,
 * so buying one twice is not a thing that should be possible to record.
 */
create table if not exists public.pass_holders (
  pass_id uuid not null references public.world_passes on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  got_at timestamptz not null default now(),
  primary key (pass_id, user_id)
);

/*
 * Grants beside the tables, in the same file. A policy says which rows a
 * role may see; a grant says whether it may touch the table at all, and a
 * new table has none. This project has shipped a carefully-protected
 * unreachable table twice.
 *
 * Reading is open - what a World hands out and what it sells is part of its
 * page. Writing is through the functions below and nowhere else.
 */
alter table public.world_badges enable row level security;
alter table public.world_passes enable row level security;
alter table public.pass_holders enable row level security;

grant select on public.world_badges to anon, authenticated;
grant select on public.world_passes to anon, authenticated;
grant select on public.pass_holders to authenticated;

drop policy if exists world_badges_readable on public.world_badges;
create policy world_badges_readable on public.world_badges for select using (true);

drop policy if exists world_passes_readable on public.world_passes;
create policy world_passes_readable on public.world_passes for select using (true);

/* Who holds a pass is between them and the World's owner. */
drop policy if exists pass_holders_mine on public.pass_holders;
create policy pass_holders_mine on public.pass_holders
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.world_passes p
      join public.worlds w on w.id = p.world_id
      where p.id = pass_id and w.owner_id = auth.uid()
    )
  );

/** Whether this account may change this World. One answer, used by both. */
create or replace function public.i_own_world(wanted uuid)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.worlds
     where id = wanted and owner_id = auth.uid() and auth.uid() is not null
  );
$$;

/**
 * Make a badge. Returns its number, which is what goes in a script.
 *
 * Capped at fifty. Not a business rule - a World with nine hundred badges
 * is a page nobody can read and a list nothing can page through, and the
 * limit is far above anything real.
 */
create or replace function public.make_world_badge(
  wanted uuid, called text, about text default null, picture text default null
)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  made bigint;
begin
  if not public.i_own_world(wanted) then
    raise exception 'That is not your world.';
  end if;
  if (select count(*) from public.world_badges where world_id = wanted) >= 50 then
    raise exception 'That world already has fifty badges.';
  end if;

  insert into public.world_badges (world_id, name, description, icon_url)
  values (wanted, called, about, picture)
  returning content_id into made;

  return made;
end;
$$;

/** Make a pass. Same shape, and the price is checked by the column. */
create or replace function public.make_world_pass(
  wanted uuid, called text, about text default null,
  costs integer default 0, picture text default null
)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  made bigint;
begin
  if not public.i_own_world(wanted) then
    raise exception 'That is not your world.';
  end if;
  if (select count(*) from public.world_passes where world_id = wanted) >= 50 then
    raise exception 'That world already has fifty passes.';
  end if;

  insert into public.world_passes (world_id, name, description, price, icon_url)
  values (wanted, called, about, greatest(0, costs), picture)
  returning content_id into made;

  return made;
end;
$$;

/** Changing one. Null leaves a field alone. */
create or replace function public.edit_world_badge(
  badge uuid, called text default null, about text default null, enabled boolean default null
)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  owns boolean;
begin
  select public.i_own_world(world_id) into owns from public.world_badges where id = badge;
  if owns is not true then
    raise exception 'That is not your badge.';
  end if;

  update public.world_badges
     set name = coalesce(called, name),
         description = coalesce(about, description),
         is_enabled = coalesce(enabled, is_enabled)
   where id = badge;
end;
$$;

create or replace function public.edit_world_pass(
  pass uuid, called text default null, about text default null,
  costs integer default null, selling boolean default null
)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  owns boolean;
begin
  select public.i_own_world(world_id) into owns from public.world_passes where id = pass;
  if owns is not true then
    raise exception 'That is not your pass.';
  end if;

  update public.world_passes
     set name = coalesce(called, name),
         description = coalesce(about, description),
         price = coalesce(greatest(0, costs), price),
         is_for_sale = coalesce(selling, is_for_sale)
   where id = pass;
end;
$$;

/** What a World hands out, and what it sells. Both public. */
create or replace function public.badges_of(wanted uuid)
returns setof public.world_badges
language sql stable set search_path = public, extensions as $$
  select * from public.world_badges where world_id = wanted order by created_at;
$$;

create or replace function public.passes_of(wanted uuid)
returns setof public.world_passes
language sql stable set search_path = public, extensions as $$
  select * from public.world_passes where world_id = wanted order by created_at;
$$;

grant execute on function public.i_own_world(uuid) to authenticated;
grant execute on function public.make_world_badge(uuid, text, text, text) to authenticated;
grant execute on function public.make_world_pass(uuid, text, text, integer, text) to authenticated;
grant execute on function public.edit_world_badge(uuid, text, text, boolean) to authenticated;
grant execute on function public.edit_world_pass(uuid, text, text, integer, boolean) to authenticated;
grant execute on function public.badges_of(uuid) to anon, authenticated;
grant execute on function public.passes_of(uuid) to anon, authenticated;

commit;
