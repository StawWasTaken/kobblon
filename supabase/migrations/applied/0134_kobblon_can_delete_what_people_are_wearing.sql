begin;

-- Kobblon can take down something people own. Nobody else can.
--
-- Staw: an item people are wearing cannot be deleted - except by Kobblon,
-- and then everybody who bought it gets the 40% back, same as any takedown.
--
-- Two different acts behind one word, and they stay different here:
--
--   * **Nobody else owns it** - a true delete. The row goes, because there
--     is nothing to be a record of.
--   * **Somebody owns it** - a takedown, through `remove_avatar_item`: the
--     row stays, marked removed, it comes off everybody wearing it, and each
--     buyer is paid 40% of what they paid out of Kobblon's account.
--
-- The row has to stay in the second case and that is not a detail. Deleting
-- it would cascade `avatar_owned` away, and then the refund in somebody's
-- ledger points at nothing - a payment nobody can explain is worse than a
-- row marked removed. "Deleted" is what the button says; what happens is
-- what is honest.
--
-- A maker still cannot do this to their own buyers. Taking something back
-- off people is a moderator's act whoever made it.

create or replace function public.delete_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  mine boolean;
  staff boolean := public.screens_avatar_items();
  others integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select (creator_id = me) into mine from public.avatar_items where id = target;
  if mine is null then raise exception 'There is no such item.'; end if;

  if not mine and not staff then
    raise exception 'That is not yours.';
  end if;

  select count(*) into others from public.avatar_owned o
    join public.avatar_items i on i.id = o.item_id
   where o.item_id = target and o.user_id <> i.creator_id;

  if others = 0 then
    delete from public.avatar_items where id = target;
    return;
  end if;

  if not staff then
    -- "1 person already have this" is what counting without conjugating
    -- gives you. Both halves move together or neither should.
    raise exception
      '% % this, so it cannot be deleted. Archive it instead, and they keep it.',
      others,
      case when others = 1 then 'person already has' else 'people already have' end;
  end if;

  perform public.remove_avatar_item(target, 'Deleted by Kobblon.');
end;
$$;

grant execute on function public.delete_avatar_item to authenticated;

-- While we are here: `avatar_owned_read` said `is_moderator()`, and every
-- other decision about who may moderate now says moderator **or** admin.
-- The functions are `security definer` so nothing was behaving wrongly, but
-- an admin reading the table directly saw nobody's rows but their own - and
-- a policy that disagrees with the functions beside it is a bug waiting for
-- somebody to write a query instead of calling one.
drop policy if exists avatar_owned_read on public.avatar_owned;
create policy avatar_owned_read on public.avatar_owned
  for select using (user_id = auth.uid() or public.screens_avatar_items());

commit;
