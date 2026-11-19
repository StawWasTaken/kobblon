/*
 * A thought changes while you are looking at it.
 *
 * The website keeps one copy of what people are thinking for the whole tab
 * and hears about changes rather than asking again, the same way presence
 * works. For that the table has to be in the realtime publication, and the
 * row has to carry enough of itself on a delete to say whose it was.
 *
 * Row-level security still decides who is sent what: a thought set to
 * friends is not broadcast to anybody else, so this widens nothing.
 */
begin;

alter table public.thoughts replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'thoughts'
  ) then
    alter publication supabase_realtime add table public.thoughts;
  end if;
end $$;

commit;
