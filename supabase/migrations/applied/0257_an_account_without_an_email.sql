begin;

/*
 * Three things Staw asked for in one sitting, because they are the same
 * thing seen from three sides: what an account actually needs to exist.
 *
 *   1. An email is no longer part of it. Somebody signs up with a name and
 *      a password; the address is offered and can be left empty.
 *   2. A superadmin can turn a guest into a real account. The guest is
 *      already signed in and stays signed in; the account stops being
 *      throwaway and the site asks them for a password when they come back.
 *   3. The People panel can be asked a question - who has over a thousand
 *      Brix, who joined this week, who is verified, who is staff - rather
 *      than being a search box over a name.
 *
 * Supabase still wants an address of its own for every account, so an
 * account made without one carries a stand-in at a domain that exists for
 * exactly this and receives nothing. `has_email` is the honest answer to
 * "can we write to this person", and it is decided here, from the address
 * itself, rather than taken from whatever the browser claimed.
 */

-- --------------------------------------------------------------- the columns

alter table public.profiles
  add column if not exists has_email boolean not null default true,
  add column if not exists must_set_password boolean not null default false;

comment on column public.profiles.has_email is
  'False when the account was made without one and carries a stand-in address.';
comment on column public.profiles.must_set_password is
  'Set when staff made a guest real; the site asks them for a password.';

/*
 * The one place that knows whether an address is real: the trigger that
 * sees `auth.users.email` as it is written. A browser saying "no email"
 * decides nothing; the domain does.
 */
create or replace function public.email_is_a_stand_in(address text)
returns boolean language sql immutable
set search_path = public, extensions as $$
  select coalesce(lower(address) like '%@no-email.kobblon.com', true)
$$;

-- ------------------------------------------------------- a new account lands

-- Taken from 0133 as it stands, with `has_email` added. Retyping one of
-- these is how a rewrite quietly drops a check nobody notices for a week.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, extensions as $$

declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  guest boolean := coalesce(new.is_anonymous, false);
  base text;
  candidate text;
  n int := 0;
begin
  if guest then
    candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
      candidate := 'Guest' || lpad((floor(random() * 100000))::int::text, 5, '0');
    end loop;

    insert into public.profiles (id, username, display_name, avatar_url, is_guest, has_email, body)
    values (
      new.id, candidate, candidate, nullif(meta->>'avatar_url', ''), true, false,
      '{"Head":"#ffffff","Torso":"#ffffff","LeftArm":"#ffffff",
        "RightArm":"#ffffff","LeftLeg":"#ffffff","RightLeg":"#ffffff"}'::jsonb
    );
    perform public.give_starting_kit(new.id);
    return new;
  end if;

  base := regexp_replace(coalesce(meta->>'username', split_part(new.email, '@', 1)), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'kobbler' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base := substr(base, 1, 16);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := substr(base, 1, 16) || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url, birth_date, gender, has_email)
  values (
    new.id,
    candidate,
    coalesce(nullif(meta->>'display_name', ''), candidate),
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'birth_date', '')::date,
    nullif(meta->>'gender', ''),
    not public.email_is_a_stand_in(new.email)
  );

  perform public.give_starting_kit(new.id);

  insert into public.activity_events (kind, actor_id) values ('user_joined', new.id);
  return new;
end;
$$;

-- --------------------------------------------------------------- the guard

/*
 * Two more columns nobody may set for themselves. Written out from 0243
 * rather than patched blind, and both trusted flags are still here - 0215
 * lost one of them doing exactly this and suspensions stopped working for
 * four weeks without a single error.
 */
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if auth.uid() is null then return new; end if;

  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.standing', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then return new; end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;

  new.suspended_until := old.suspended_until;

  -- Money. It moves through move_pixels, which writes a ledger row beside
  -- every change; a direct write would move the balance and leave no trace.
  new.pixels := old.pixels;

  -- Identity the site assigns rather than the person.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  /*
   * Whether there is an address behind this account, and whether the site
   * is still waiting for a password. Both are answers about the account
   * rather than opinions about it: the first comes from `auth.users`, the
   * second from a superadmin's decision, and clearing the second from the
   * browser would take the card away without a password behind it.
   */
  new.has_email         := old.has_email;
  new.must_set_password := old.must_set_password;

  return new;
end;
$$;

-- --------------------------------------------- a guest made real by staff

/*
 * The account keeps everything: the same row, the same id, the same
 * session in whatever tab they left open. What changes is that it is no
 * longer throwaway, and that the site has a password to ask for.
 *
 * The handle is left exactly as it is. `Guest48213` is a poor name and
 * renaming somebody without asking is worse, so the card that asks for a
 * password is where they get the chance to change it.
 */
create or replace function public.admin_make_real(target uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare they public.profiles%rowtype;
begin
  perform public.require_superadmin();

  select * into they from public.profiles where id = target;
  if they.id is null then raise exception 'No such account.'; end if;
  if not they.is_guest then raise exception 'That account is already a real one.'; end if;

  update public.profiles
     set is_guest = false,
         must_set_password = true
   where id = target;

  -- What a new account is given on the way in, given now instead, the same
  -- as when a guest claims the account themselves.
  perform public.move_pixels(target, 100, 'signup_grant', 'Welcome to Kobblon');

  insert into public.activity_events (kind, actor_id) values ('user_joined', target);
  perform public.write_admin_log('made_real', target, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_make_real(uuid) from public;
grant execute on function public.admin_make_real(uuid) to authenticated;

-- ------------------------------------------------------ the People panel

/*
 * A search box answers "where is this person". It does not answer any of
 * the questions staff actually open this panel with, which are all of the
 * form "show me everybody who". So the filters go in the database, where
 * the rows a browser never asked for are rows it never receives.
 *
 * Every filter is optional and null means "do not care", so the old call -
 * a term and nothing else - returns exactly what it did before.
 *
 * Dropped and recreated rather than replaced: the returned row grows, and
 * Postgres will not let a `returns table` change shape in place.
 */
drop function if exists public.admin_find_people(text);
drop function if exists public.admin_find_people(
  text, text, integer, integer, timestamptz, timestamptz, text, integer);

create function public.admin_find_people(
  search text default null,
  only_kind text default null,       -- staff | admin | moderator | verified
                                     -- guest | suspended | banned | klub
                                     -- no_email | real
  min_pixels integer default null,
  max_pixels integer default null,
  joined_since timestamptz default null,
  joined_before timestamptz default null,
  order_by text default 'rank',      -- rank | new | old | rich | poor | name
  how_many integer default 50
)
returns table(
  id uuid, username text, display_name text, avatar_url text,
  content_id bigint, pixels integer, is_verified boolean, is_moderator boolean,
  is_suspended boolean, is_admin boolean, has_staff_badge boolean,
  is_guest boolean, created_at timestamptz,
  is_banned boolean,
  suspended_until timestamptz,
  past_sanctions integer,
  /* New here: both answer a question the panel could not ask before. */
  is_superadmin boolean,
  has_email boolean,
  must_set_password boolean
)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  term text := nullif(btrim(coalesce(search, '')), '');
  kind text := nullif(btrim(lower(coalesce(only_kind, ''))), '');
  take integer := least(greatest(coalesce(how_many, 50), 1), 200);
begin
  if not public.is_moderator() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;

  return query
    select p.id, p.username, p.display_name, p.avatar_url, p.content_id,
           p.pixels, p.is_verified, p.is_moderator, p.is_suspended,
           p.is_admin, p.has_staff_badge, p.is_guest, p.created_at,
           exists (select 1 from public.violations v
                    where v.user_id = p.id and v.action = 'termination'
                      and not v.is_void),
           p.suspended_until,
           (select count(*)::integer from public.violations v
             where v.user_id = p.id and not v.is_void),
           p.is_superadmin,
           p.has_email,
           p.must_set_password
      from public.profiles p
     where (term is null
            or p.username ilike '%' || term || '%'
            or p.display_name ilike '%' || term || '%'
            or p.content_id::text = term)
       and (kind is null or case kind
             when 'staff'     then p.is_admin or p.is_superadmin or p.is_moderator
             when 'admin'     then p.is_admin or p.is_superadmin
             when 'moderator' then p.is_moderator
             when 'verified'  then p.is_verified
             when 'guest'     then p.is_guest
             when 'real'      then not p.is_guest
             when 'suspended' then p.is_suspended
             when 'banned'    then exists (select 1 from public.violations v
                                            where v.user_id = p.id
                                              and v.action = 'termination'
                                              and not v.is_void)
             when 'no_email'  then not p.has_email
             /*
              * The Klub does not exist yet. It is named here because the
              * filter is written once and Staw said it is coming - and a
              * filter that quietly returns everybody would be worse than
              * one that returns nobody, which is at least true today.
              */
             when 'klub'      then false
             else true
           end)
       and (min_pixels is null or p.pixels >= min_pixels)
       and (max_pixels is null or p.pixels <= max_pixels)
       and (joined_since is null or p.created_at >= joined_since)
       and (joined_before is null or p.created_at < joined_before)
     order by
       case when order_by = 'rank' then 0 end,
       case when order_by = 'rank' then p.is_superadmin end desc nulls last,
       case when order_by = 'rank' then p.is_admin end desc nulls last,
       case when order_by = 'rank' then p.is_moderator end desc nulls last,
       case when order_by in ('rank', 'new') then p.created_at end desc nulls last,
       case when order_by = 'old' then p.created_at end asc nulls last,
       case when order_by = 'rich' then p.pixels end desc nulls last,
       case when order_by = 'poor' then p.pixels end asc nulls last,
       case when order_by = 'name' then lower(p.username) end asc nulls last
     limit take;
end $$;

revoke all on function public.admin_find_people(
  text, text, integer, integer, timestamptz, timestamptz, text, integer) from public;
grant execute on function public.admin_find_people(
  text, text, integer, integer, timestamptz, timestamptz, text, integer) to authenticated;

commit;
