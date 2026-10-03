begin;

-- The console reads the badge it is now able to give.
--
-- A button whose label depends on a column the page never receives shows
-- the same label whatever is true, which is a control that lies. Its own
-- file because `admin_find_people` returns a row that grows, and a returned
-- row that grows means a drop and a create rather than a replace.

drop function if exists public.admin_find_people(text);

create function public.admin_find_people(search text)
 RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, content_id bigint, pixels integer, is_verified boolean, is_moderator boolean, is_suspended boolean, is_admin boolean, has_staff_badge boolean, is_guest boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  perform public.require_admin();
  return query
    select p.id, p.username, p.display_name, p.avatar_url, p.content_id,
           p.pixels, p.is_verified, p.is_moderator, p.is_suspended,
           p.is_admin, p.has_staff_badge, p.is_guest, p.created_at
      from public.profiles p
     where coalesce(btrim(search), '') = ''
        or p.username ilike '%' || btrim(search) || '%'
        or p.display_name ilike '%' || btrim(search) || '%'
        or p.content_id::text = btrim(search)
     order by p.is_admin desc, p.is_moderator desc, p.created_at desc
     limit 50;
end;
$function$;

grant execute on function public.admin_find_people to authenticated;

commit;
