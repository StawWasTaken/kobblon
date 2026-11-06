begin;

/*
 * The version and the portraits are a superadmin's.
 *
 * Staw: "in the staff console make the version SUPERADMIN only (and for
 * portraits too)". The panel is gated in the page as well, but a panel is
 * a drawing: the rule is this file, because a rank the page hides is a
 * rank anybody can call past with the same RPC. The console's `needs` is
 * only ever the honest version of what the database already refuses.
 *
 * Why these two in particular, now that they have moved:
 *
 *   * `set_platform_release` decides the number the website, the Launcher
 *     and the Workspace all call themselves, and the Launcher updates
 *     against it. A wrong date here is every machine on the platform told
 *     it is out of date.
 *   * `refresh_every_portrait` tells every browser on Kobblon that every
 *     stored face is stale, so every one of them is drawn again. It is one
 *     statement and a day of redrawing.
 *
 * Replaced rather than dropped: no signature changes, so every caller
 * keeps working and the only difference is who gets a refusal.
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
  perform public.require_superadmin();

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

create or replace function public.drop_platform_release(release text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  today text;
begin
  perform public.require_superadmin();
  select name into today from public.platform_version();
  if today = trim(release) then
    raise exception 'That is the version Kobblon is on right now. Date another one ahead of it instead.';
  end if;
  delete from public.platform_releases where name = trim(release);
end;
$$;

create or replace function public.refresh_every_portrait()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  touched integer;
begin
  perform public.require_superadmin();

  update public.profiles
     set avatar_changed_at = clock_timestamp()
   where avatar_url like '%portrait-%.webp';

  get diagnostics touched = row_count;
  return touched;
end;
$$;

/*
 * The grants do not change and are re-issued anyway. `create or replace`
 * keeps them, but a file that is read later should not have to know that,
 * and a function reachable by nobody is this project's fourth trap.
 */
grant execute on function public.set_platform_release(text, date, text) to authenticated;
grant execute on function public.drop_platform_release(text) to authenticated;
grant execute on function public.refresh_every_portrait() to authenticated;

commit;
