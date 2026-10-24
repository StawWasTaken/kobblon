begin;

-- Previously known as
-- -----------------------------------------------------------------------
--
-- Staw: "for previous usernames its really the history, like if u signed up
-- as stawrer, then you change to staw, then to stawrer again, then to
-- someguystaw (usernames) then the previous username lists will show all of
-- these (same thing for communities)".
--
-- The set was already right. 0277 keeps a name you let go of, hands it back
-- on a take-back, and puts the one you were wearing in its place, so the
-- list after that sequence is both of them and the one in use is not in it.
-- A check walking that exact sequence is in this round.
--
-- The *order* was not right, and the way it was wrong is worth writing
-- down because nothing about it was visible: both lists ordered by
-- `changed_at`, and `now()` is the transaction's clock, not the
-- statement's. Two names changed in one transaction carry the same
-- timestamp to the microsecond, and Postgres is then free to return them
-- in either order - the same list, twice, differently. In ordinary use the
-- changes are minutes apart and it never showed; the check that walks
-- Staw's four names in one transaction found it immediately.
--
-- Both tables have had a `bigserial` since they were made, which is the
-- real order things happened in. That is what they are ordered by now.
--
-- And the ceiling goes. A limit of twenty on a list called "previously
-- known as" is a list that quietly stops being the history, which is the
-- one thing Staw asked it to be.

set search_path = public, extensions;

drop function if exists public.username_history_of(uuid);
create function public.username_history_of(target uuid)
returns table (username text, changed_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select h.username, h.changed_at
    from public.username_history h
   where h.user_id = target
   order by h.id desc;
$$;

grant execute on function public.username_history_of to anon, authenticated;

create or replace function public.community_name_history_of(target uuid)
returns table (name text, changed_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select h.name, h.changed_at
    from public.community_name_history h
   where h.community_id = target
   order by h.id desc;
$$;

grant execute on function public.community_name_history_of to anon, authenticated;

commit;
