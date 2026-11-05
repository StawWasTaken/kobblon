begin;

-- Best friends, and being able to take back anything you asked for.
--
-- Staw asked for both, the first one urgently: "the 'Best Friend' feature,
-- basically you can send best friend requests to some of your friends, and
-- if they accept then you're both not friends but bestfriends (you can also
-- go from bestfriend to friends and bestfriend to not friends anymore) -
-- also when you have best friends; the people you have best-friended appear
-- in priority in your friend lists & profile & etc". And: "add that we can
-- cancel your own request to join a community, to friend request someone, to
-- best friend someone, etc".
--
-- They are one file because they are one piece of plumbing: a request is
-- something one person makes and the other answers, and every one of them
-- needs the same three doors - ask, answer, take it back.
--
-- **A column, not a new status.** `friendship_status` is an enum, and this
-- project has already been bitten by using a new enum value in the
-- transaction that added it. More than that, "best" is not a different kind
-- of friendship - it is a friendship with something extra true about it, and
-- the day it became a status every query asking "are these two friends"
-- would have had to learn a second word for yes.

alter table public.friendships
  add column if not exists best boolean not null default false,
  -- Who asked, where somebody has asked and nobody has answered. Null is the
  -- ordinary state. It names the asker rather than being a flag, because the
  -- answer may only come from the other one.
  add column if not exists best_asked_by uuid references public.profiles(id) on delete set null,
  add column if not exists best_since timestamptz;

comment on column public.friendships.best is
  'Best friends. A friendship with something extra true about it, not a '
  'different kind of friendship.';

create index if not exists friendships_best_idx
  on public.friendships (requester_id, addressee_id) where best;

/**
 * Asks somebody to be best friends.
 *
 * Only a friend may be asked, which is Staw's rule and also the only one
 * that makes sense: best friends is a step up from friends, so there has to
 * be a step to take.
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

  -- They asked you first: answering is the thing to do, and asking back is
  -- the same answer said the long way round.
  if bond.best_asked_by = target then
    update public.friendships
       set best = true, best_asked_by = null, best_since = now()
     where id = bond.id;
    return;
  end if;

  update public.friendships set best_asked_by = me where id = bond.id;
end;
$$;

grant execute on function public.ask_best_friend to authenticated;

/**
 * Answers one. Only the person who was asked may.
 *
 * Saying no clears the asking rather than recording a refusal: a no that is
 * kept is a thing somebody has to see every time they open the page.
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
  else
    update public.friendships set best_asked_by = null where id = bond.id;
  end if;
end;
$$;

grant execute on function public.answer_best_friend to authenticated;

/**
 * Back to ordinary friends, or taking back the asking.
 *
 * One door for both because they are one thought - "not best friends" - and
 * which of the two it means is a fact about the row rather than a choice the
 * page has to make correctly. Either person may do it: a friendship both
 * agreed to is one either can step back from.
 */
create or replace function public.unbest_friend(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  update public.friendships
     set best = false,
         best_since = null,
         -- Whoever asked, the asking is over. Taking back your own and
         -- refusing theirs are the same row ending up in the same state.
         best_asked_by = null
   where status = 'accepted'
     and ((requester_id = me and addressee_id = target)
       or (requester_id = target and addressee_id = me));
end;
$$;

grant execute on function public.unbest_friend to authenticated;

-- ----------------------------------------------- taking a request back

/**
 * Unsending a friend request.
 *
 * The row already allows it - the delete policy lets either side remove a
 * friendship - but "delete the row where I am the requester and it is still
 * pending" is a sentence a page should not have to write correctly, and a
 * page that gets it slightly wrong unfriends somebody instead.
 */
create or replace function public.cancel_friend_request(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  delete from public.friendships
   where status = 'pending' and requester_id = me and addressee_id = target;
end;
$$;

grant execute on function public.cancel_friend_request to authenticated;

/** Unasking to join a Community. Yours only, and only while it is waiting. */
create or replace function public.cancel_join_request(community uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  delete from public.community_join_requests
   where community_id = community and user_id = me;
end;
$$;

grant execute on function public.cancel_join_request to authenticated;

commit;
