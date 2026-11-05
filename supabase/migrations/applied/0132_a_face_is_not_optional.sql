begin;

-- Three rules about taking something off, in the one function that does it.
--
--   * A face taken off is replaced by the free one, not removed. Staw: if
--     you are not wearing a face you have to be wearing FACE-1119, which is
--     why it is free. So "no face" is a state nobody can reach rather than
--     one the renderer has to have an opinion about.
--   * A guest cannot take off what their kit locks. A guest is an advert for
--     the platform walking around inside it.
--   * Trousers stay on a body that is one colour all over - 0127's rule,
--     kept here because this is the only door out of it.
--
-- All three in `take_off_slot` because that is the one way anything comes
-- off. A rule about taking things off that lives anywhere else is a rule
-- with a way round it.

create or replace function public.take_off_slot(which text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  guest boolean;
  wearing uuid;
  floor_one uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select is_guest into guest from public.profiles where id = me;

  select item_id into wearing
    from public.avatar_worn w where w.user_id = me and w.slot = which;
  if wearing is null then return; end if;

  if coalesce(guest, false) and exists (
    select 1 from public.starting_kit k
      join public.avatar_items i on i.content_id = k.content_id
     where i.id = wearing and k.locked_for_guests
  ) then
    raise exception 'Guests keep what they start with. Make an account and you can change it.';
  end if;

  if which = 'trousers'
     and public.one_colour_all_over((select body from public.profiles where id = me))
  then
    raise exception 'Your body is one colour all over, so the trousers stay on. Change a colour first.';
  end if;

  if which = 'face' then
    floor_one := public.floor_face();
    -- Already the floor one: there is nothing underneath to go back to, so
    -- taking it off does nothing rather than leaving a face-shaped hole.
    if floor_one is not null and wearing = floor_one then
      return;
    end if;
    if floor_one is not null then
      insert into public.avatar_owned (item_id, user_id, paid)
      values (floor_one, me, 0) on conflict do nothing;

      update public.avatar_worn
         set item_id = floor_one
       where user_id = me and slot = 'face';
      return;
    end if;
  end if;

  delete from public.avatar_worn w where w.user_id = me and w.slot = which;
end;
$$;

grant execute on function public.take_off_slot to authenticated;

commit;
