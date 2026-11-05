-- Addresses follow names from 0067 onwards, which left everything renamed
-- before that with the name it had when it was made: /c/1003/kobbleston for
-- a Community called Kobblon.
--
-- This walks through what is there once and brings each address into line.
-- Nothing is lost: every slug that changes is kept the way a rename keeps it,
-- so the links people have already sent still land.

do $$
declare
  row record;
  wanted text;
begin
  for row in
    select id, owner_id, slug, name from public.spaces
     where slug is distinct from public.slugify(name)
  loop
    wanted := public.free_slug(row.name, 'space', row.owner_id, row.id);
    continue when wanted = row.slug;

    insert into public.slug_history (kind, slug, target)
    values ('space', row.slug, row.id)
    on conflict (kind, slug) do update set target = excluded.target, changed_at = now();

    update public.spaces set slug = wanted where id = row.id;
  end loop;

  for row in
    select id, slug, name from public.communities
     where slug is distinct from public.slugify(name)
  loop
    wanted := public.free_slug(row.name, 'community', null, row.id);
    continue when wanted = row.slug;

    insert into public.slug_history (kind, slug, target)
    values ('community', row.slug, row.id)
    on conflict (kind, slug) do update set target = excluded.target, changed_at = now();

    update public.communities set slug = wanted where id = row.id;
  end loop;
end $$;
