-- Friend requests, live.
--
-- The sidebar has subscribed to `friendships` since it was written, and that
-- subscription has never once fired: the table was never added to the
-- realtime publication. The badge only ever moved when somebody reloaded the
-- page, which looked like it worked because people reload pages.
--
-- The Launcher needs the same thing and needs it more: a request that
-- arrives while somebody is in a World has to appear in the World, and there
-- is no reload to hide behind.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;

/*
 * Realtime sends a row to whoever is listening, and row level security is
 * what decides who that is. The existing policies on friendships already
 * say you may see one you are part of, so nothing is opened up here: a
 * request is delivered to the person it was sent to and to nobody else.
 *
 * The old row is wanted too, so that a client can tell an accepted request
 * from a withdrawn one rather than re-reading the table to find out what
 * just happened.
 */
alter table public.friendships replica identity full;

/**
 * Whoever sent it, for a card that has to be drawn the moment it arrives.
 *
 * Realtime hands over the row and nothing else, and a row is two ids. A
 * card needs a name and a picture, and one call for them beats every client
 * writing its own join badly.
 */
create or replace function public.request_from(which uuid)
returns table (
  request_id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_admin boolean,
  sent_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select f.id, p.id, p.username, p.display_name, p.avatar_url,
         coalesce(p.is_admin, false), f.created_at
    from public.friendships f
    join public.profiles p on p.id = f.requester_id
   where f.id = which
     and f.status = 'pending'
     -- Only the person it was sent to may look it up.
     and f.addressee_id = auth.uid()
$$;

grant execute on function public.request_from(uuid) to authenticated;
