begin;

-- A link to a mesh shows the mesh.
--
-- Staw: the previews of 3D meshes and Builds do not appear in embeds.
--
-- `link_preview` returned `null` for the picture of anything on the
-- Marketplace, and the comment above it says why: the file itself is in a
-- private bucket, so a preview "says what it is and who made it, and shows
-- nothing of it". That was correct when it was written. There was nothing
-- public to point a robot at.
--
-- There is now. A card is drawn in the browser at upload and kept in the
-- `previews` bucket, which is public precisely so that something with no
-- account can fetch it - a robot in Discord being the whole reason it is
-- public. Pointing at it gives away nothing the item's own page does not
-- already show to anybody who opens it, and the file it was drawn from stays
-- exactly as private as it was.
--
-- `wide` is false for a mesh. A mesh card is square and transparent, and a
-- square picture in a wide card is letterboxed with bars down both sides; a
-- Decal keeps the shape it was drawn in and is better off wide.
--
-- The column is the **storage path**, not an address. Building the address
-- needs the project's own host, which this function has no business knowing;
-- the edge function has it and does that part.
--
-- A Build still has no picture and still gets the Kobblon card, because
-- nothing draws one yet. That is not fixed here and is not pretended to be.

create or replace function public.link_preview(path text)
 RETURNS TABLE(kind text, title text, description text, image text, wide boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
             a.preview_path,
             a.kind::text <> 'mesh'
        from public.assets a
        join public.profiles p on p.id = a.creator_id
       where a.content_id = (split_part(key, '-', 2))::bigint
         and a.status = 'approved' and a.is_public;
    return;
  end if;

  return;
end;
$function$;

grant execute on function public.link_preview to anon, authenticated, service_role;

commit;
