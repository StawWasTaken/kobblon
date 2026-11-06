begin;

/*
 * Leaving a group chat, and giving one a name.
 *
 * Staw: "we also need to add a way to leave group chats, and rename group
 * chats". Neither existed: a group was made once, by one person, and
 * everybody in it was in it for good under whatever it was called that
 * day.
 *
 * Both are group-only on purpose. A chat between two people has no name of
 * its own - it is called by who is in it - and there is no leaving one,
 * because leaving would mean the other person writes into a room nobody is
 * in. Unfriending is what ends a conversation between two people, and that
 * already works.
 */

-- ----------------------------------------------------------------- renaming

/**
 * Give a group chat a name, or take its name away.
 *
 * Empty clears it, which puts the chat back to being called by who is in
 * it. That is a real thing somebody wants - a name chosen in a hurry is
 * worse than no name - and it costs nothing to allow.
 *
 * The name is screened like anything else somebody writes. A group's name
 * is seen by everybody in it, which is the same reach as a line of chat.
 */
create or replace function public.rename_conversation(conversation uuid, new_name text)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  wanted text := nullif(btrim(coalesce(new_name, '')), '');
  verdict record;
  held text;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if not exists (
    select 1 from public.conversations c
     where c.id = conversation and c.is_group
  ) then
    raise exception 'That is not a group chat.';
  end if;

  if not public.in_conversation(conversation, me) then
    raise exception 'You are not in that chat.';
  end if;

  if wanted is not null then
    if char_length(wanted) > 48 then
      raise exception 'A group name is at most 48 characters.';
    end if;

    select * into verdict from public.screen_text(wanted);
    if verdict.decision = 'block' then
      raise exception 'That name is not allowed here.';
    end if;
  end if;

  update public.conversations set title = wanted where id = conversation;

  /*
   * Read back under the caller's own identity rather than trusting the
   * update, which is this project's third trap: a `security definer`
   * function has the rights to write and still reports as the caller, so
   * a row-level guard can undo the write with nothing raised. The only
   * proof is the row afterwards.
   */
  select c.title into held from public.conversations c where c.id = conversation;
  if held is distinct from wanted then
    raise exception 'The name did not hold. Nothing was changed.';
  end if;

  return held;
end $$;

revoke all on function public.rename_conversation(uuid, text) from public;
grant execute on function public.rename_conversation(uuid, text) to authenticated;

-- ------------------------------------------------------------------ leaving

/**
 * Walk out of a group chat.
 *
 * What is left behind stays: the messages somebody wrote are part of the
 * conversation the others are still having, and deleting them on the way
 * out would rewrite it for everybody.
 *
 * The empty room is cleared up. A group whose last member leaves is a row
 * nothing can ever reach - `my_conversations` only ever returns chats you
 * are in - so it goes, and the messages go with it by cascade.
 */
create or replace function public.leave_conversation(conversation uuid)
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  left_behind integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if not exists (
    select 1 from public.conversations c
     where c.id = conversation and c.is_group
  ) then
    raise exception 'A chat between two people cannot be left. Remove them as a friend instead.';
  end if;

  if not public.in_conversation(conversation, me) then
    raise exception 'You are not in that chat.';
  end if;

  delete from public.conversation_members m
   where m.conversation_id = conversation and m.user_id = me;

  -- Read back, under the caller, rather than trusting the delete.
  if public.in_conversation(conversation, me) then
    raise exception 'You are still in that chat. Nothing was changed.';
  end if;

  select count(*)::int into left_behind
    from public.conversation_members m where m.conversation_id = conversation;

  if left_behind = 0 then
    delete from public.conversations c where c.id = conversation;
    return false;
  end if;

  return true;
end $$;

revoke all on function public.leave_conversation(uuid) from public;
grant execute on function public.leave_conversation(uuid) to authenticated;

commit;
