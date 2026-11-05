-- What a Kobbleston address looks like when it is pasted somewhere else.
--
-- The site is one document with a router inside it, and the robots that build
-- a link preview do not run routers. This turns an address into the few facts
-- a preview needs, so something in front of the site can answer those robots
-- with real HTML. It only ever returns things that are already public: a
-- published Space, a Community that is listed, a profile that is not
-- suspended. Marketplace files stay protected, so an upload gets its name and
-- its creator but never its picture. Safe to run again.

create or replace function public.link_preview(path text)
returns table (kind text, title text, description text, image text)
language plpgsql stable security definer set search_path = public as $$
declare
  clean text := split_part(split_part(coalesce(path, '/'), '?', 1), '#', 1);
  parts text[];
  head text;
  key text;
  number bigint;
begin
  parts := array_remove(string_to_array(trim(both '/' from clean), '/'), '');
  if array_length(parts, 1) is null then return; end if;

  head := lower(parts[1]);
  key := parts[2];
  number := case when key ~ '^\d+$' then key::bigint else null end;

  -- A Space: /s/1042/my-space
  if head = 's' and number is not null then
    return query
      select 'space',
             s.name,
             coalesce(nullif(s.description, ''), 'A Space on Kobbleston by ' || p.display_name),
             coalesce(s.cover_url, s.emblem_url)
        from public.spaces s
        join public.profiles p on p.id = s.owner_id
       where s.content_id = number and s.is_published and not s.is_removed;
    return;
  end if;

  -- A Community: /c/1016/name, or /c/name
  if head = 'c' then
    return query
      select 'community',
             c.name,
             coalesce(
               nullif(c.description, ''),
               'A Community on Kobbleston with ' || c.member_count || ' members'
             ),
             coalesce(c.icon_url, c.banner_url)
        from public.communities c
       where (case when number is not null then c.content_id = number
                   else lower(c.slug) = lower(key) end)
         and c.is_public and not c.is_removed;
    return;
  end if;

  -- A person: /u/1042/name, or /u/name. A Space of theirs is /u/name/space.
  if head = 'u' then
    if number is null and array_length(parts, 1) >= 3 then
      return query
        select 'space',
               s.name,
               coalesce(nullif(s.description, ''), 'A Space on Kobbleston by ' || p.display_name),
               coalesce(s.cover_url, s.emblem_url)
          from public.spaces s
          join public.profiles p on p.id = s.owner_id
         where lower(p.username) = lower(key)
           and lower(s.slug) = lower(parts[3])
           and s.is_published and not s.is_removed;
      return;
    end if;

    return query
      select 'person',
             p.display_name || ' (@' || p.username || ')',
             coalesce(nullif(p.bio, ''), 'On Kobbleston since ' || to_char(p.created_at, 'Mon YYYY')),
             p.avatar_url
        from public.profiles p
       where (case when number is not null then p.content_id = number
                   else lower(p.username) = lower(key) end)
         and not p.is_suspended;
    return;
  end if;

  -- An event: /e/1016/name
  if head = 'e' and number is not null then
    return query
      select 'event',
             e.title,
             coalesce(
               nullif(e.subtitle, ''),
               nullif(e.description, ''),
               'An event in ' || c.name
             ),
             coalesce(e.cover_url, c.icon_url)
        from public.community_events e
        join public.communities c on c.id = e.community_id
       where e.content_id = number and not e.is_cancelled
         and c.is_public and not c.is_removed;
    return;
  end if;

  -- Something on the Creator Marketplace: /create/IMG-1042. The file itself
  -- is protected, so a preview says what it is and who made it, and shows
  -- nothing of it.
  if head = 'create' and key ~* '^[a-z]{3}-\d+$' then
    return query
      select 'asset',
             a.name || ' - Kobbleston Create',
             'A ' || a.kind::text || ' by ' || p.display_name || ' on the Creator Marketplace',
             null::text
        from public.assets a
        join public.profiles p on p.id = a.creator_id
       where a.content_id = (split_part(key, '-', 2))::bigint
         and a.status = 'approved' and a.is_public;
    return;
  end if;

  return;
end;
$$;

grant execute on function public.link_preview to anon, authenticated, service_role;
