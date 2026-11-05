-- People get a number too, so every link on Kobbleston can carry the id of
-- the thing it points at: /u/1042/stawrer rather than a name alone. Names
-- change; numbers do not.

alter table public.profiles add column if not exists content_id bigint;

do $$
declare item record;
begin
  for item in
    select id from public.profiles where content_id is null order by created_at
  loop
    update public.profiles set content_id = nextval('public.content_id_seq') where id = item.id;
  end loop;
end $$;

alter table public.profiles alter column content_id set default nextval('public.content_id_seq');
create unique index if not exists profiles_content_id_idx on public.profiles (content_id);

-- Badges are shown as a round picture, so one is required rather than
-- optional from here on. Existing badges without one keep working.
alter table public.space_badges alter column icon_url drop not null;

-- Looking something up by its number. The name in the link is decoration:
-- the number is what resolves.
create or replace function public.username_by_id(target bigint)
returns text language sql stable security definer set search_path = public as $$
  select username from public.profiles where content_id = target;
$$;

create or replace function public.space_by_id(target bigint)
returns table (owner_username text, slug text)
language sql stable security definer set search_path = public as $$
  select p.username, s.slug
    from public.spaces s
    join public.profiles p on p.id = s.owner_id
   where s.content_id = target and not s.is_removed;
$$;

create or replace function public.community_by_id(target bigint)
returns text language sql stable security definer set search_path = public as $$
  select slug from public.communities where content_id = target;
$$;

grant execute on function public.username_by_id, public.space_by_id, public.community_by_id
  to anon, authenticated;

-- The Communities you are in carry their number too, so a link from the rail
-- is the same link as anywhere else.
drop function if exists public.member_communities(uuid);
create function public.member_communities(target uuid)
returns table (
  id uuid,
  slug text,
  name text,
  icon_url text,
  member_count integer,
  content_id bigint,
  role public.community_role
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.icon_url, c.member_count, c.content_id, m.role
    from public.community_members m
    join public.communities c on c.id = m.community_id
   where m.user_id = target and c.is_public and not c.is_removed
   order by c.member_count desc;
$$;

grant execute on function public.member_communities to anon, authenticated;
