-- What a Kobbleston address says when it is pasted somewhere else.
--
-- The old cards said the name twice and little else: "Kobbleston -
-- Kobbleston", then one line. A card should say what the thing is in a
-- sentence, the way Roblox's do: what it is, whose it is, how many people are
-- in it or have been, and then whatever its owner wrote about it.
--
-- It also says which shape the picture is, because a wide banner makes the
-- big card and a square emblem makes the small one, and a square stretched
-- into a wide card is cut into a stripe.
--
-- It still only ever returns what is already public. Safe to run again.

drop function if exists public.link_preview(text);

create function public.link_preview(path text)
returns table (kind text, title text, description text, image text, wide boolean)
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
             concat_ws(' ',
               'A Space on Kobbleston by @' || p.username || '.',
               to_char(s.visit_count, 'FM999,999,999')
                 || case when s.visit_count = 1 then ' visit' else ' visits' end
                 || case
                      when s.like_count + s.dislike_count > 0
                      then ', ' || round(100.0 * s.like_count / (s.like_count + s.dislike_count))
                           || '% liked.'
                      else '.'
                    end,
               nullif(s.description, '')
             ),
             coalesce(s.cover_url, s.emblem_url),
             s.cover_url is not null
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
             concat_ws(' ',
               c.name || ' is a community on Kobbleston, run by @' || p.username
                 || ', with ' || to_char(c.member_count, 'FM999,999,999')
                 || case when c.member_count = 1 then ' member.' else ' members.' end,
               nullif(c.description, '')
             ),
             coalesce(c.banner_url, c.icon_url),
             c.banner_url is not null
        from public.communities c
        join public.profiles p on p.id = c.owner_id
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
               concat_ws(' ',
                 'A Space on Kobbleston by @' || p.username || '.',
                 nullif(s.description, '')
               ),
               coalesce(s.cover_url, s.emblem_url),
               s.cover_url is not null
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
             concat_ws(' ',
               p.display_name || ' is on Kobbleston, here since '
                 || to_char(p.created_at, 'FMMonth YYYY') || '.',
               (select case when count(*) > 0
                         then to_char(count(*), 'FM999,999')
                              || case when count(*) = 1 then ' Space.' else ' Spaces.' end
                       end
                  from public.spaces s
                 where s.owner_id = p.id and s.is_published and not s.is_removed),
               nullif(p.bio, '')
             ),
             p.avatar_url,
             false
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
             concat_ws(' ',
               'An event in ' || c.name || ' on Kobbleston, '
                 || to_char(e.starts_at, 'FMDay FMDDth FMMonth') || '.',
               case when e.attending_count > 0
                    then to_char(e.attending_count, 'FM999,999')
                         || case when e.attending_count = 1 then ' person going.'
                                 else ' people going.' end
               end,
               nullif(e.subtitle, ''),
               nullif(e.description, '')
             ),
             coalesce(e.cover_url, c.banner_url, c.icon_url),
             coalesce(e.cover_url, c.banner_url) is not null
        from public.community_events e
        join public.communities c on c.id = e.community_id
       where e.content_id = number and not e.is_cancelled
         and c.is_public and not c.is_removed;
    return;
  end if;

  -- Something on the Marketplace: /create/IMG-1042. The file itself is
  -- protected, so a preview says what it is and who made it, and shows
  -- nothing of it.
  if head = 'create' and key ~* '^[a-z]{3}-\d+$' then
    return query
      select 'asset',
             a.name,
             concat_ws(' ',
               case a.kind
                 when 'image' then 'A decal' when 'audio' then 'A sound'
                 when 'video' then 'A video' when 'font' then 'A font'
                 else 'A model'
               end
               || ' by @' || p.username || ' on the Kobbleston Marketplace, '
               || upper(key) || '.',
               case when a.download_count > 0
                    then to_char(a.download_count, 'FM999,999,999')
                         || case when a.download_count = 1 then ' use.' else ' uses.' end
               end,
               nullif(a.description, '')
             ),
             null::text,
             false
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
