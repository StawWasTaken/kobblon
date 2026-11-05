begin;

/*
 * The shutters, live.
 *
 * 0272 built the switch and the website asked the table once a minute, so
 * closing the site took up to sixty seconds to reach anybody and opening it
 * again took the same. Staw, having watched it: "i want that the shutters
 * appear instantly rather than having to refresh the page".
 *
 * So the one row is published, and every open tab is told the moment it
 * changes. The poll stays in the client as the thing underneath - a dropped
 * socket must not leave somebody looking at a site that is supposed to be
 * shut - but the socket is what makes it instant.
 *
 * Nothing is opened up by this. Realtime delivers a row only to those whose
 * row level security would have let them read it, and the policy on
 * `site_state` is "everybody may read this": it is the notice on the door,
 * and the door is read before anybody has signed in.
 */
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'site_state'
     ) then
    alter publication supabase_realtime add table public.site_state;
  end if;
end $$;

/*
 * The whole row, both before and after. The client decides what to draw
 * from `maintenance` and `note`, and an update that carries only the
 * changed columns would have it asking the table again for the note it was
 * just told about.
 */
alter table public.site_state replica identity full;

commit;
