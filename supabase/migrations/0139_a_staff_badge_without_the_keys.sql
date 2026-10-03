begin;

-- The Kobblon k, handed out on its own.
--
-- Staw: the staff badge can be given to somebody and gives them nothing -
-- it is a mark, not a permission. Being an admin or a moderator is power,
-- and the badge comes with that automatically.
--
-- So the badge is a column of its own rather than something read off
-- `is_moderator`. The two were the same fact until now, which is fine while
-- the only people wearing a k are the people holding keys and wrong the
-- moment somebody is one without the other - and the direction it fails in
-- matters: a badge that implies power would be a lie, and power that implies
-- a badge is the truth.

alter table public.profiles
  add column if not exists has_staff_badge boolean not null default false;

comment on column public.profiles.has_staff_badge is
  'Wears the Kobblon k. A mark and nothing else - it grants no permission. '
  'An admin or a moderator wears it whether or not this is set.';

/**
 * Whether somebody's name carries the k.
 *
 * One function so the badge cannot drift from the two things that imply it.
 * Every reader asks this rather than naming three columns, which is how the
 * answer stays the same everywhere.
 */
create or replace function public.wears_staff_badge(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select coalesce(
    (select has_staff_badge or is_admin or is_moderator
       from public.profiles where id = who),
    false
  );
$$;

grant execute on function public.wears_staff_badge to anon, authenticated;

-- The panel can give it and take it away.
--
-- Added to `admin_set_standing` rather than given a function of its own,
-- because it is one more thing about where somebody stands and it belongs in
-- the same log line as the rest.
--
-- What has not changed: this cannot make an admin. Staff with keys are made
-- in the database by somebody who has them, deliberately, and a panel that
-- can promote is a panel that only has to be stolen once.

-- Dropped, not replaced. Adding a parameter with a default **overloads**:
-- the old five-argument version stays, the call the panel makes matches
-- both, and Postgres refuses it with "function name is not unique". That is
-- the same trap `list_avatar_item` fell into, and here it would have broken
-- the staff console for every call the moment this applied - the grant
-- failing is what caught it.
drop function if exists public.admin_set_standing(uuid, boolean, boolean, boolean, text);

create or replace function public.admin_set_standing(
  target uuid,
  verified boolean default null,
  moderator boolean default null,
  suspended boolean default null,
  why text default null,
  staff_badge boolean default null
) returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare before public.profiles%rowtype;
begin
  perform public.require_admin();

  select * into before from public.profiles where id = target;
  if before.id is null then raise exception 'No such account.'; end if;

  if before.is_admin and suspended is true then
    raise exception 'An admin cannot be suspended from here.';
  end if;

  update public.profiles
     set is_verified     = coalesce(verified,  is_verified),
         is_moderator    = coalesce(moderator, is_moderator),
         is_suspended    = coalesce(suspended, is_suspended),
         has_staff_badge = coalesce(staff_badge, has_staff_badge)
   where id = target;

  perform public.write_admin_log('standing', target, jsonb_build_object(
    'verified', verified, 'moderator', moderator, 'suspended', suspended,
    'staff_badge', staff_badge, 'why', why
  ));
end;
$$;

grant execute on function public.admin_set_standing to authenticated;

commit;
