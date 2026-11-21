begin;

/*
 * The friends dock said everybody was online, for ever.
 *
 * `presenceOf` on the website believes `is_online` only while
 * `last_seen_at` is fresh - a flag set when somebody signed in and never
 * cleared, because a browser that is closed says nothing on its way out,
 * is not a fact about now. Everything else on the site reads rows that
 * carry that column, so the home strip drew grey dots for the same people
 * the dock listed under ONLINE.
 *
 * `my_conversations` was handing out `is_online` with nothing to date it
 * by, so the one list that could not tell stale from true was the chat
 * list. The members payload carries `last_seen_at` now.
 *
 * `create or replace`: the columns and their types are unchanged - the
 * members json gains a key, which is not a return type.
 */
create or replace function public.my_conversations()
returns table (
  id uuid,
  title text,
  is_group boolean,
  last_message_at timestamptz,
  last_message text,
  unread_count bigint,
  members jsonb,
  ignored boolean,
  party_id uuid
)
language sql stable security definer set search_path = public, extensions as $$
  select
    c.id,
    c.title,
    c.is_group,
    c.last_message_at,
    (select m.body from public.messages m
      where m.conversation_id = c.id and not m.is_removed
      order by m.created_at desc limit 1),
    (select count(*) from public.messages m
      where m.conversation_id = c.id and not m.is_removed
        and m.sender_id <> auth.uid() and m.created_at > mine.last_read_at),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id,
              'username', p.username,
              'display_name', p.display_name,
              'avatar_url', p.avatar_url,
              'is_online', p.is_online,
              'last_seen_at', p.last_seen_at,
              'in_space_id', p.in_space_id,
              'closed_at', p.closed_at,
              'is_banned', coalesce(p.is_banned, false)
            )), '[]'::jsonb)
       from public.conversation_members om
       join public.profiles p on p.id = om.user_id
      where om.conversation_id = c.id and om.user_id <> auth.uid()),
    exists (
      select 1 from public.conversation_members om
       join public.ignores i on i.ignored_id = om.user_id
      where om.conversation_id = c.id and om.user_id <> auth.uid()
        and i.ignorer_id = auth.uid()
    ),
    c.party_id
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
 where c.is_group
    or exists (
      select 1 from public.conversation_members om
       where om.conversation_id = c.id and om.user_id <> auth.uid()
         and public.friends_with(auth.uid(), om.user_id)
         and not public.blocked_between(auth.uid(), om.user_id)
    )
 order by c.last_message_at desc;
$$;

grant execute on function public.my_conversations() to authenticated;

commit;
