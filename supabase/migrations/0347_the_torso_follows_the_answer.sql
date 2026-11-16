begin;

/*
 * A new account that said it is a girl starts in the girl torso.
 *
 * Staw: "when you choose that youre a girl on the signup page (you can also
 * edit it in the settings page) then your newbie avatar will wear the girl
 * torso". The torso is 0248's `torso-girl` - BODY-1352, the Waisted Torso -
 * and Newbie is what everybody else keeps.
 *
 * Three things this is careful about, and they are the whole of it:
 *
 *   * **It is a default, not a rule.** It dresses somebody who has not
 *     dressed themselves. A torso slot with something in it already is left
 *     exactly as it is, which is 0131's rule for the starting kit and the
 *     same rule here: nothing undresses a person who has been choosing.
 *   * **It is given, not sold.** The torso costs five Brix and a new account
 *     has none, so wearing it has to come with owning it. `paid = 0`, which
 *     is what the kit does and what makes the next part possible.
 *   * **Changing the answer changes the torso back**, but only where it was
 *     this that put it on: a torso somebody *bought* stays bought and stays
 *     on. Ownership is never taken away either - a thing that was given is
 *     given.
 *
 * It hangs off the profile rather than off signup, because the answer can be
 * changed later and a feature that only works on the way in is a feature
 * half the people never see.
 */

/**
 * The girl torso, by the shape it is rather than by its number.
 *
 * 0248 wrote the row by shape and nothing else in the schema names it, so
 * the shape is the identifier; a content id would be a number copied into
 * a second place and wrong on any database where the item was made in a
 * different order.
 */
create or replace function public.girl_torso()
returns uuid
language sql stable
set search_path = public, extensions as $$
  select id from public.avatar_items
   where shape = 'torso-girl' and kind = 'bodypart' and not is_removed
   limit 1;
$$;

grant execute on function public.girl_torso() to anon, authenticated;

/**
 * Put the right torso on somebody, or take the given one off again.
 *
 * Safe to call at any time and on anybody: it reads the answer on the row
 * and does nothing where there is nothing to do.
 */
create or replace function public.dress_for_gender(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  said text := (select gender from public.profiles where id = target);
  torso uuid := public.girl_torso();
  bought boolean;
begin
  if torso is null or target is null then return; end if;

  if said = 'female' then
    /* Owned before worn: wearing something nobody owns is a row the
       Catalog would have to explain. */
    insert into public.avatar_owned (item_id, user_id, paid)
    values (torso, target, 0)
    on conflict do nothing;

    /* Only into an empty slot. Anything already on the torso was chosen. */
    if not exists (
      select 1 from public.avatar_worn
       where user_id = target and slot = 'torso'
    ) then
      insert into public.avatar_worn (user_id, slot, item_id)
      values (target, 'torso', torso)
      on conflict do nothing;
    end if;

    return;
  end if;

  /*
   * Not a girl any more, or never was. The torso comes off only where this
   * is what put it on, and "this put it on" is readable from the ledger:
   * `paid = 0` is a grant, anything else is a purchase. Somebody who bought
   * it and then changed their answer keeps wearing what they paid for.
   */
  select coalesce(paid, 0) > 0 into bought
    from public.avatar_owned where item_id = torso and user_id = target;

  if coalesce(bought, false) then return; end if;

  delete from public.avatar_worn
   where user_id = target and item_id = torso;
end;
$$;

revoke execute on function public.dress_for_gender(uuid) from anon, authenticated;

/**
 * The answer changing is what does it.
 *
 * `after`, because the row has to be readable: the function asks the
 * profile what it says rather than being handed it, so the same function
 * works when it is called by hand on an account that was made before this.
 *
 * `of gender` on the update, so the ordinary profile write - a bio, a
 * colour, a presence ping every minute - does not go anywhere near the
 * wardrobe.
 */
create or replace function public.gender_dresses_the_torso()
returns trigger language plpgsql
security definer set search_path = public, extensions as $$
begin
  perform public.dress_for_gender(new.id);
  return null;
end;
$$;

drop trigger if exists profiles_gender_torso on public.profiles;
create trigger profiles_gender_torso
  after insert or update of gender on public.profiles
  for each row execute function public.gender_dresses_the_torso();

/*
 * The ones already here who said female on the way in.
 *
 * They signed up before this existed, nothing has been put in their torso
 * slot, and the answer on their row is the same answer a new account would
 * give today. Anybody wearing anything there is untouched by the function
 * itself, so this is the same door, walked for people already inside.
 */
do $$
declare one record;
begin
  for one in select id from public.profiles where gender = 'female' loop
    perform public.dress_for_gender(one.id);
  end loop;
end $$;

commit;
