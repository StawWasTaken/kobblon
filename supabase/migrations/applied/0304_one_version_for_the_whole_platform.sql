begin;

/*
 * One version number, in one place, for all three of Kobblon.
 *
 * Staw: "i wanna make the kobblon website, kobblon launcher, and kobblon
 * workspace, all at the V3.4 (like its the whole platform that is at the
 * Version 3.4) ... i wanna make it so that we dont have to update the text
 * for the versions manually but for example when the website displays that
 * its at the V3.5 then every other thing, the website, the launcher &
 * workspace all display it at the same time - its automatic".
 *
 * `src/lib/version.ts` has carried that list in the website's bundle since
 * the 25th of October, and said in its own comment that if the three ever
 * had to be *guaranteed* identical rather than merely kept the same, it
 * moves to an RPC and both sides read that. This is that.
 *
 * Why a list of releases with a start date rather than one row holding a
 * string: both of the things Staw has asked for at different times are the
 * same table this way. "Everything says 3.4" is the row that has begun;
 * "in December it is 3.5 on its own" is a row dated ahead. Nobody has to be
 * awake on the first of December, and nobody has to deploy anything.
 *
 * The clock is **the server's**. That is the whole point of moving it here:
 * the bundled list is read against the viewer's clock, so a machine a day
 * ahead shows the new number a day early, and three applications on three
 * machines can disagree about what Kobblon is called today. One `current_date`,
 * in one place, cannot.
 */

set search_path = public, extensions;

-- --------------------------------------------------------- the releases

create table if not exists public.platform_releases (
  /* `3.4`, without the V. The V is how it is written, not what it is. */
  name text primary key,
  /* The day it starts, in UTC. A row dated ahead is a release waiting. */
  begins_on date not null,
  /* One line for the staff screen, so a row's reason survives the person
     who added it. Never shown to anybody outside the panel. */
  note text,
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles (id) on delete set null
);

create index if not exists platform_releases_begins_idx
  on public.platform_releases (begins_on desc);

alter table public.platform_releases enable row level security;

/*
 * Everybody reads this, including somebody with no account and the two
 * applications before anybody has signed in - the Launcher draws the
 * number on its window before it knows who is at the keyboard.
 *
 * And the grants, in the same file as the table, because this project has
 * shipped a carefully protected table nobody could reach twice now: a
 * policy decides which rows a role may see and a grant decides whether the
 * role may touch the table at all, and a new table has none.
 */
drop policy if exists "anybody reads the releases" on public.platform_releases;
create policy "anybody reads the releases"
  on public.platform_releases for select
  using (true);

drop policy if exists "an admin writes the releases" on public.platform_releases;
create policy "an admin writes the releases"
  on public.platform_releases for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.platform_releases to anon, authenticated;
grant insert, update, delete on public.platform_releases to authenticated;

-- ------------------------------------------------------ what it is today

/**
 * Which version Kobblon is on, and which one is next.
 *
 * One call, three answers, because every caller wants all three and a
 * Launcher splash asking three times is three round trips on a cold start.
 *
 * `stable` is a security definer so the answer does not depend on the
 * reader's policies, and it reads `current_date` on the server so all
 * three products land on the same day's answer whatever the machine in
 * front of the person thinks the date is.
 */
create or replace function public.platform_version()
returns table (
  name text,
  begins_on date,
  /* The next release and its day, or nulls when nothing is scheduled.
     The Workspace shows this as "3.5 from 1 December" in its About. */
  next_name text,
  next_on date
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    (select r.name from public.platform_releases r
      where r.begins_on <= current_date
      order by r.begins_on desc, r.name desc limit 1),
    (select r.begins_on from public.platform_releases r
      where r.begins_on <= current_date
      order by r.begins_on desc, r.name desc limit 1),
    (select r.name from public.platform_releases r
      where r.begins_on > current_date
      order by r.begins_on asc, r.name asc limit 1),
    (select r.begins_on from public.platform_releases r
      where r.begins_on > current_date
      order by r.begins_on asc, r.name asc limit 1);
$$;

grant execute on function public.platform_version() to anon, authenticated;

-- ------------------------------------------------------ setting one

/**
 * Add or move a release, from the staff panel.
 *
 * Takes the name without the V and refuses one with it rather than
 * quietly storing "V3.5" and having every product draw "VV3.5". The same
 * goes for a name that is not digits and dots: this number is compared
 * and sorted, and "3.5 (beta!)" is a string that breaks both.
 */
create or replace function public.set_platform_release(
  release text,
  starts date,
  why text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  tidy text := trim(release);
begin
  perform public.require_admin();

  if tidy ~ '^[Vv]' then
    raise exception 'Give the version without the V: 3.5, not %.', release;
  end if;
  if tidy !~ '^[0-9]+(\.[0-9]+)*$' then
    raise exception '% is not a version number. Digits and dots only.', release;
  end if;

  insert into public.platform_releases (name, begins_on, note, added_by)
  values (tidy, starts, nullif(trim(coalesce(why, '')), ''), auth.uid())
  on conflict (name) do update
    set begins_on = excluded.begins_on,
        note = coalesce(excluded.note, public.platform_releases.note),
        added_by = excluded.added_by;
end;
$$;

grant execute on function public.set_platform_release(text, date, text) to authenticated;

/** Take a release back off the list. The one in force cannot be removed. */
create or replace function public.drop_platform_release(release text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  today text;
begin
  perform public.require_admin();
  select name into today from public.platform_version();
  if today = trim(release) then
    raise exception 'That is the version Kobblon is on right now. Date another one ahead of it instead.';
  end if;
  delete from public.platform_releases where name = trim(release);
end;
$$;

grant execute on function public.drop_platform_release(text) to authenticated;

-- ---------------------------------------------------- what is there today

/*
 * The two the website's bundle already carries, so the database starts out
 * saying exactly what every deployed page says today and the move is
 * invisible. `do nothing`, not `do update`: if somebody has already set
 * these by hand, theirs wins over this file running again.
 */
insert into public.platform_releases (name, begins_on, note) values
  ('3.4', date '2026-10-01', 'Where the platform was when the number moved into the database.'),
  ('3.5', date '2026-12-01', 'Scheduled before the move; nobody has to be awake for it.')
on conflict (name) do nothing;

commit;
