-- Group chats. A conversation is a group once it has a name and more than
-- two people in it.

alter table public.conversations
  add column title text check (char_length(title) <= 48),
  add column is_group boolean not null default false,
  add column created_by uuid references public.profiles on delete set null;

-- Up to five friends plus whoever starts it. Everyone added has to already be
-- a friend, so a group cannot be used to message strangers.
create or replace function public.create_group_conversation(title text, members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
  conv uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_guest() then raise exception 'Guests cannot start a chat.'; end if;
  if coalesce(array_length(members, 1), 0) < 1 then
    raise exception 'Pick at least one friend.';
  end if;
  if array_length(members, 1) > 5 then
    raise exception 'A group holds five friends at most.';
  end if;

  foreach other in array members loop
    if other = me then raise exception 'You are already in it.'; end if;
    if not public.are_friends(me, other) then
      raise exception 'You can only add friends to a group.';
    end if;
  end loop;

  insert into public.conversations (title, is_group, created_by)
  values (nullif(trim(title), ''), true, me)
  returning id into conv;

  insert into public.conversation_members (conversation_id, user_id)
  values (conv, me);

  insert into public.conversation_members (conversation_id, user_id)
  select conv, unnest(members)
  on conflict do nothing;

  return conv;
end;
$$;

grant execute on function public.create_group_conversation to authenticated;

/**
 * Everything the chat dock needs about a conversation in one read: who is in
 * it, what it is called, and the last thing said.
 */
create or replace function public.my_conversations()
returns table (
  id uuid,
  title text,
  is_group boolean,
  last_message_at timestamptz,
  last_message text,
  unread_count bigint,
  members jsonb
)
language sql stable security definer set search_path = public as $$
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
              'in_space_id', p.in_space_id
            )), '[]'::jsonb)
       from public.conversation_members om
       join public.profiles p on p.id = om.user_id
      where om.conversation_id = c.id and om.user_id <> auth.uid())
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  order by c.last_message_at desc
  limit 40;
$$;

grant execute on function public.my_conversations to authenticated;
