begin;

/*
 * You can only rate a World you have been in.
 *
 * Staw: "make that you can only rate worlds after youve visited them."
 *
 * The record of having been somewhere already exists: `world_visits`, one
 * row per person per World per day, written by `join_world_server` when
 * somebody actually turns up in a server. Nothing else writes it and
 * nothing client-side can, which is what makes it worth checking - a page
 * that greys the thumbs out is a suggestion, and the vote has to be
 * refused where the vote is written.
 *
 * Taking a rating back is still allowed whatever the history says. Somebody
 * who rated a World and later had their visit rows go (a World deleted and
 * remade, a tidy-up) should not be left holding a vote they cannot remove.
 *
 * `my_world_standing` gains `visited` so the page can say why the thumbs
 * are not pressable, rather than letting somebody press and read an error.
 * It is a convenience and not the check; the check is below it.
 */

/*
 * Dropped rather than replaced: `create or replace` cannot change a
 * function's return type, and this one gains a column. Postgres refuses
 * with "cannot change return type of existing function", which is the
 * kind of thing that passes review and fails in the SQL editor.
 */
drop function if exists public.my_world_standing(uuid);

create function public.my_world_standing(which uuid)
returns table (opinion boolean, favourited boolean, visited boolean)
language sql stable security definer set search_path = public, extensions as $$
  select (select o.likes from public.world_opinions o
           where o.world_id = which and o.user_id = auth.uid()),
         exists (select 1 from public.world_favourites f
                  where f.world_id = which and f.user_id = auth.uid()),
         exists (select 1 from public.world_visits v
                  where v.world_id = which and v.user_id = auth.uid())
$$;

grant execute on function public.my_world_standing(uuid) to anon, authenticated;

create or replace function public.set_world_opinion(which uuid, think boolean)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  if not exists (select 1 from public.worlds w
                  where w.id = which and w.is_published and not w.is_removed) then
    raise exception 'There is no World with that number.';
  end if;

  /* Taking it back needs no visit - see the note at the top. */
  if think is null then
    delete from public.world_opinions where world_id = which and user_id = me;
    return;
  end if;

  if not exists (select 1 from public.world_visits v
                  where v.world_id = which and v.user_id = me) then
    raise exception 'Play this World before rating it.';
  end if;

  insert into public.world_opinions (world_id, user_id, likes)
  values (which, me, think)
  on conflict (world_id, user_id) do update set likes = excluded.likes
  where public.world_opinions.likes is distinct from excluded.likes;
end $$;

revoke all on function public.set_world_opinion(uuid, boolean) from public, anon;
grant execute on function public.set_world_opinion(uuid, boolean) to authenticated;

commit;
