/*
 * A player's number is the order they arrived in.
 *
 * Until now every numbered thing on Kobblon drew from one sequence,
 * `content_id_seq`: people, Worlds, catalog items, communities, events and
 * badges all took their number out of the same pot. So the first account
 * ever made is not /u/1, it is /u/1397, because the catalog had been
 * uploading all week. The number says nothing to the person holding it.
 *
 * From here a person's number comes out of its own sequence and counts the
 * people only: the first account is 1, the hundredth is 100. Guests count,
 * because a guest is an account - and when a guest claims it, the number
 * they already had is the number they keep.
 *
 * The old number is not thrown away. It moves to `legacy_content_id` and
 * `username_by_id` answers to it as well, so /u/1397/stawrer in a forum post
 * from last week still lands on the right person, and the page then rewrites
 * the address to the new one. New numbers win a tie; nothing is kept alive
 * beyond that lookup.
 *
 * Worlds, catalog items, communities and ads are deliberately untouched.
 * They keep drawing from `content_id_seq` exactly as before.
 *
 * The write below is the third trap in CLAUDE.md: `guard_profile_update`
 * pins `content_id` back to its old value, and it only exempts a caller
 * with no JWT. A migration applied in the SQL editor has no JWT, so the
 * renumbering would have passed its own check and then been undone the day
 * anybody signed in ran it. It gets a transaction-local flag instead, like
 * money and standing have, and the check below runs under an identity.
 */
begin;

create sequence if not exists public.player_number_seq as bigint start with 1 minvalue 1;

alter table public.profiles add column if not exists legacy_content_id bigint;
create unique index if not exists profiles_legacy_content_id_idx
  on public.profiles (legacy_content_id);

-- The guard learns one more flag. Everything else about it is unchanged.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if lower(coalesce(new.username, '')) in ('stawrer', 'kobblon', 'kobbleston') then
    new.is_superadmin := true;
    new.is_admin      := true;
    new.is_moderator  := true;
  end if;

  if auth.uid() is null then return new; end if;

  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.standing', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.community', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.appearance', true) = 'on' then
    return new;
  end if;

  /* Renumbering the people. Nothing but this migration raises it. */
  if current_setting('kobbleston.numbering', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then
    if new.id = auth.uid() then
      new.is_superadmin := old.is_superadmin;
      new.is_admin      := old.is_admin;
      new.is_moderator  := old.is_moderator;
    end if;
    return new;
  end if;

  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;
  new.is_banned     := old.is_banned;

  new.suspended_until := old.suspended_until;

  new.closed_at     := old.closed_at;
  new.closed_by     := old.closed_by;
  new.closed_reason := old.closed_reason;
  new.erase_after   := old.erase_after;

  new.former_username     := old.former_username;
  new.former_display_name := old.former_display_name;
  new.former_avatar_url   := old.former_avatar_url;
  new.former_bio          := old.former_bio;

  if old.is_banned or old.closed_at is not null then
    new.display_name := old.display_name;
    new.avatar_url   := old.avatar_url;
    new.bio          := old.bio;
  end if;

  new.pixels := old.pixels;

  new.content_id        := old.content_id;
  new.legacy_content_id := old.legacy_content_id;
  new.created_at        := old.created_at;

  new.has_email         := old.has_email;
  new.must_set_password := old.must_set_password;

  new.primary_community := old.primary_community;

  new.appearance := old.appearance;

  return new;
end;
$$;

/*
 * The renumbering itself, and it only ever runs once: the moment any row
 * holds an old number, this has run, and a second apply does nothing.
 *
 * Three passes, because `profiles_content_id_idx` is unique and checked as
 * each row is written. Handing out 1, 2, 3 straight away would collide with
 * whichever row is still holding 3 from the old pot. So the new number is
 * written negative first, and the signs are flipped in one statement once
 * no positive number is left in the column.
 */
do $$
declare item record;
begin
  if not exists (select 1 from public.profiles where legacy_content_id is not null) then
    perform set_config('kobbleston.numbering', 'on', true);

    update public.profiles
       set legacy_content_id = content_id
     where legacy_content_id is null and content_id is not null;

    for item in
      select id from public.profiles order by created_at, id
    loop
      update public.profiles
         set content_id = - nextval('public.player_number_seq')
       where id = item.id;
    end loop;

    update public.profiles set content_id = - content_id where content_id < 0;

    perform set_config('kobbleston.numbering', 'off', true);
  end if;
end $$;

-- Whoever signs up next carries on from the last person, not from the pot.
alter table public.profiles alter column content_id set default nextval('public.player_number_seq');

select setval(
  'public.player_number_seq',
  greatest(coalesce((select max(content_id) from public.profiles), 0), 1),
  (select count(*) > 0 from public.profiles)
);

/*
 * The one door a numbered profile link goes through. New number first, the
 * number they used to have second.
 */
create or replace function public.username_by_id(target bigint)
returns text language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select username from public.profiles where content_id = target),
    (select username from public.profiles where legacy_content_id = target)
  );
$$;

commit;
