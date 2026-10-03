begin;

-- A best friend request somebody can actually see.
--
-- Staw: "make that the best friend also sends a notification". Quite - 0158
-- put the asking in the database and nowhere else, so the only way to find
-- out somebody had asked was to open their profile and notice a button had
-- changed. An ask nobody is told about is an ask nobody answers.
--
-- Two kinds, because they are two different pieces of news: being asked
-- needs an answer, and being accepted is good news about something you
-- already did.
--
-- `notifications.kind` is a text column with a check, not an enum, so this
-- is a constraint swap rather than the enum trap - no new value is being
-- used in the transaction that adds it.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind = any (array[
    'friend_request', 'friend_accepted',
    'best_friend_request', 'best_friend_accepted',
    'space_like', 'space_visit', 'message', 'system',
    'event_started', 'world_updated', 'content_removed'
  ]));

/**
 * Asking, and telling them.
 *
 * 0158's, with the telling added. Asking somebody who has already asked you
 * still accepts - it is the same answer said the long way round - and then
 * it is *them* who gets the good news, which is why the two notifications
 * sit on opposite sides of that branch.
 */
create or replace function public.ask_best_friend(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  bond record;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if target = me then raise exception 'You are already stuck with yourself.'; end if;

  select * into bond from public.friendships f
   where f.status = 'accepted'
     and ((f.requester_id = me and f.addressee_id = target)
       or (f.requester_id = target and f.addressee_id = me));

  if bond.id is null then
    raise exception 'You have to be friends first.';
  end if;
  if bond.best then
    raise exception 'You already are.';
  end if;

  if bond.best_asked_by = target then
    update public.friendships
       set best = true, best_asked_by = null, best_since = now()
     where id = bond.id;

    -- They asked; this is them being told it is yes.
    insert into public.notifications (user_id, kind, actor_id)
    values (target, 'best_friend_accepted', me);
    return;
  end if;

  update public.friendships set best_asked_by = me where id = bond.id;

  /*
   * One asking, one telling. Asking again after taking it back would tell
   * them twice, which is the right behaviour: the second one is a new ask,
   * and a silent re-ask is an ask nobody sees.
   */
  insert into public.notifications (user_id, kind, actor_id)
  values (target, 'best_friend_request', me);
end;
$$;

grant execute on function public.ask_best_friend to authenticated;

/**
 * Answering, and telling them when it is yes.
 *
 * A no tells nobody. 0158 already says why the refusal is not recorded - a
 * no that is kept is something somebody has to look at for ever - and
 * sending it as news would be worse: it is a notification whose whole
 * content is that somebody does not want to.
 */
create or replace function public.answer_best_friend(target uuid, yes boolean)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  bond record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into bond from public.friendships f
   where f.status = 'accepted'
     and ((f.requester_id = me and f.addressee_id = target)
       or (f.requester_id = target and f.addressee_id = me));

  if bond.id is null or bond.best_asked_by is null then
    raise exception 'There is nothing to answer.';
  end if;
  if bond.best_asked_by <> target then
    raise exception 'That is your own asking. Take it back instead.';
  end if;

  if yes then
    update public.friendships
       set best = true, best_asked_by = null, best_since = now()
     where id = bond.id;

    insert into public.notifications (user_id, kind, actor_id)
    values (target, 'best_friend_accepted', me);
  else
    update public.friendships set best_asked_by = null where id = bond.id;
  end if;
end;
$$;

grant execute on function public.answer_best_friend to authenticated;

commit;
