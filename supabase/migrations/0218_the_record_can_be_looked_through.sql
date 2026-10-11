begin;

/*
 * Looking through what staff have done.
 *
 * The console read `admin_log` straight and showed the newest sixty rows,
 * which is a record nobody can answer a question with: "what did this admin
 * do on Tuesday" means scrolling. Filtering it in the browser would have
 * been quicker to write and wrong for the same reason every other filter
 * here lives in the database: rows a browser never asked for are rows it
 * cannot be trusted to hide, and sixty is not the whole log.
 *
 * It also answers who did it. `admin_log.admin_id` is a uuid and the panel
 * had no way to turn it into a name, so the one column a record most needs
 * was the one it did not show.
 */

create or replace function public.staff_record(
  what text default null,
  term text default null,
  since_hours integer default null,
  how_many integer default 60
) returns table (
  id bigint,
  action text,
  by_id uuid,
  by_username text,
  subject_id uuid,
  subject_label text,
  detail jsonb,
  created_at timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select l.id, l.action, l.admin_id, p.username, l.subject_id, l.subject_label,
         l.detail, l.created_at
    from public.admin_log l
    left join public.profiles p on p.id = l.admin_id
   where public.is_admin()
     and (nullif(btrim(coalesce(what, '')), '') is null or l.action = what)
     and (since_hours is null
          or l.created_at > now() - make_interval(hours => since_hours))
     and (nullif(btrim(coalesce(term, '')), '') is null
          or l.subject_label ilike '%' || btrim(term) || '%'
          or p.username ilike '%' || btrim(term) || '%'
          or l.detail::text ilike '%' || btrim(term) || '%')
   order by l.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 500);
$$;

revoke all on function public.staff_record(text, text, integer, integer) from public;
grant execute on function public.staff_record(text, text, integer, integer) to authenticated;

/**
 * Which actions are actually in the record, newest first.
 *
 * The filter's options are read rather than listed: a hard-coded list goes
 * stale the first time something new writes to the log, and a filter that
 * cannot name an action is a filter that hides it.
 */
create or replace function public.staff_record_kinds()
returns table (action text, how_many bigint)
language sql stable security definer
set search_path = public, extensions as $$
  select l.action, count(*)
    from public.admin_log l
   where public.is_admin()
   group by l.action
   order by count(*) desc;
$$;

revoke all on function public.staff_record_kinds() from public;
grant execute on function public.staff_record_kinds() to authenticated;

commit;
