begin;

/*
 * A party is a group chat.
 *
 * Staw: "i meant for the party to be displayed like a groupchat (make that
 * you can also chat inside of a party, and parties also have their docks
 * too on the website)".
 *
 * So rather than a party growing messages of its own - a second message
 * table, a second unread count, a second realtime channel, a second window
 * - a party *has* a conversation, and it is an ordinary group conversation.
 * Everything the chat already does works at once: the dock window, unread
 * counts, the list, ignoring somebody, taking a message down, the staff
 * tools.
 *
 * The conversation points at the party rather than the other way round, so
 * it dies with it and there is no cycle between the two tables.
 */

alter table public.conversations
  add column if not exists party_id uuid references public.parties on delete cascade;

create unique index if not exists conversations_party_idx
  on public.conversations (party_id) where party_id is not null;

/**
 * The conversation for a party, made the first time it is asked for.
 *
 * Lazily rather than inside `make_party`, because parties already existed
 * when this landed and a party with no chat would simply never get one.
 */
create or replace function public.party_chat(party uuid)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  chat uuid;
  boss uuid;
begin
  select id into chat from public.conversations where party_id = party;
  if chat is not null then return chat; end if;

  select leader_id into boss from public.parties where id = party;
  if boss is null then return null; end if;

  insert into public.conversations (title, is_group, created_by, party_id)
  values ('Party', true, boss, party)
  returning id into chat;

  /* Everybody already in it. A conversation somebody is not a member of is
     one they cannot read, which would be a party chat with nobody in it. */
  insert into public.conversation_members (conversation_id, user_id)
  select chat, m.user_id from public.party_members m where m.party_id = party
  on conflict do nothing;

  return chat;
end $$;

/*
 * Membership, kept in step by the table rather than by the four functions
 * that write it.
 *
 * `make_party`, `accept_party_invite`, `leave_party` and
 * `remove_from_party` all move rows in `party_members`, and a fifth way in
 * would be a fifth place to forget. A trigger on the table itself cannot be
 * forgotten.
 */
create or replace function public.party_member_joins_the_chat()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  chat uuid;
begin
  chat := public.party_chat(new.party_id);
  if chat is not null then
    insert into public.conversation_members (conversation_id, user_id)
    values (chat, new.user_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function public.party_member_leaves_the_chat()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  chat uuid;
begin
  select id into chat from public.conversations where party_id = old.party_id;
  if chat is not null then
    delete from public.conversation_members
     where conversation_id = chat and user_id = old.user_id;
  end if;
  return old;
end $$;

drop trigger if exists party_member_joined on public.party_members;
create trigger party_member_joined
  after insert on public.party_members
  for each row execute function public.party_member_joins_the_chat();

drop trigger if exists party_member_left on public.party_members;
create trigger party_member_left
  after delete on public.party_members
  for each row execute function public.party_member_leaves_the_chat();

/* Parties that were already running when this landed. */
do $$
declare one uuid;
begin
  for one in select id from public.parties loop
    perform public.party_chat(one);
  end loop;
end $$;

/**
 * The chat list, which now says which row is a party.
 *
 * The return type changes, so it goes first - Postgres will not replace a
 * function with a different one.
 */
drop function if exists public.my_conversations();
create function public.my_conversations()
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

/** Your party's chat, for the window that opens on it. */
create or replace function public.my_party_chat()
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  party uuid;
begin
  select party_id into party from public.party_members where user_id = auth.uid();
  if party is null then return null; end if;
  return public.party_chat(party);
end $$;

grant execute on function public.my_conversations() to authenticated;
grant execute on function public.my_party_chat() to authenticated;

commit;
