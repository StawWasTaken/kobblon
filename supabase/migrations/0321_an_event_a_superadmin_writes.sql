begin;

/*
 * The header across the top of Home becomes a row somebody can write.
 *
 * Staw: "keep the design avatar contest header in the homepage but make it
 * so superadmins can make their own in the staff command and make it if it
 * appears or not". So the band stays exactly as it is drawn; what changes
 * is where it gets its words.
 *
 * `src/lib/event.ts` said this would happen: "When there are several at
 * once, or somebody other than Staw sets them, it becomes a table and this
 * file becomes the fallback." Somebody other than Staw sets them now, so
 * this is the table - and the file keeps no fallback at all, because a
 * hardcoded event that reappears the moment a superadmin switches theirs
 * off is the switch not working.
 *
 * One shows at a time. `showing` is the switch Staw asked for and it is
 * kept separate from `until`: `until` is the day the thing ends and the
 * band goes on its own, `showing` is somebody deciding. A row can be
 * written, looked at in the panel, and put up later - which is the whole
 * point of a draft.
 *
 * The art is a named theme and not an address, because a text field asking
 * for a path to a picture is a field that can name a picture that is not
 * there, and the band would then draw a broken image over the homepage.
 * The three themes are the three mark sets this build actually ships.
 */

create table if not exists public.platform_events (
  id          uuid primary key default gen_random_uuid(),
  tag         text not null,
  name        text not null,
  blurb       text not null default '',
  link        text not null,
  action      text not null,
  theme       text not null default 'kobblon',
  prizes      jsonb not null default '[]'::jsonb,
  until       date,
  showing     boolean not null default false,
  written_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.platform_events
  drop constraint if exists platform_events_theme_check;
alter table public.platform_events
  add constraint platform_events_theme_check
  check (theme in ('kobblon', 'halloween', 'christmas'));

create index if not exists platform_events_showing_idx
  on public.platform_events (showing, created_at desc);

/*
 * The grants, in the same file as the table, because this project has twice
 * shipped a table with a careful policy and no grant and found out days
 * later that nobody could touch it at all.
 *
 * Reading is through `platform_event_showing()`, which is `security definer`, so
 * nobody needs select on the table itself - and a draft nobody has put up
 * is not something a visitor should be able to read. So: no grants to
 * `anon` or `authenticated`, and the panel reads through its own function
 * too.
 */
revoke all on public.platform_events from anon, authenticated;

alter table public.platform_events enable row level security;

/* Belt and braces: with no grants there is no door, and with no policy
 * there is no row either. Both, so that a later `grant` by hand does not
 * quietly open the table up. */
drop policy if exists "events are read through functions" on public.platform_events;

-- ------------------------------------------------------------- what is up

/*
 * The one event the homepage draws, or nothing.
 *
 * `showing` and the date, both here rather than in the page: a band that
 * outlives the thing it is about is worse than no band, and the page is
 * the one place that cannot be trusted to know what day it is.
 */
create or replace function public.platform_event_showing()
returns table (
  id uuid, tag text, name text, blurb text, link text,
  action text, theme text, prizes jsonb, until date
)
language sql stable security definer
set search_path = public, extensions as $$
  select e.id, e.tag, e.name, e.blurb, e.link, e.action, e.theme, e.prizes, e.until
    from public.platform_events e
   where e.showing
     and (e.until is null or e.until > (now() at time zone 'utc')::date)
   order by e.created_at desc
   limit 1;
$$;

grant execute on function public.platform_event_showing to anon, authenticated;

/* Everything written, for the panel. A superadmin's, including the drafts. */
create or replace function public.platform_events_all()
returns table (
  id uuid, tag text, name text, blurb text, link text, action text,
  theme text, prizes jsonb, until date, showing boolean,
  written_by uuid, created_at timestamptz
)
language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  perform public.require_superadmin();
  return query
    select e.id, e.tag, e.name, e.blurb, e.link, e.action, e.theme,
           e.prizes, e.until, e.showing, e.written_by, e.created_at
      from public.platform_events e
     order by e.showing desc, e.created_at desc
     limit 50;
end;
$$;

grant execute on function public.platform_events_all to authenticated;

-- -------------------------------------------------------------- writing one

/*
 * Write a new one or change one that exists, by id.
 *
 * `platform_` in the name and not just `event_`: a Community's event is
 * already `event_by_id` and `event_attendees` on this schema, and two
 * different things called the same thing is how a caller ends up writing a
 * contest banner when it meant to write a meet-up.
 *
 * The link is checked the same way a notice's is - a path on this site or
 * an https address, and nothing else. `javascript:` is the one that
 * matters, and the band is an anchor built from this value.
 *
 * The prizes are read apart and built again rather than stored as handed
 * in: whatever arrives is somebody's JSON and the band draws it, so a
 * place is 12 characters of text and a prize is a non-negative number of
 * Brix. Three at most, which is what the band has room for.
 */
create or replace function public.save_platform_event(
  which uuid default null,
  tag text default 'Event',
  name text default '',
  blurb text default '',
  link text default '/',
  action text default 'Have a look',
  theme text default 'kobblon',
  prizes jsonb default '[]'::jsonb,
  until date default null,
  showing boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made uuid;
  look text := lower(nullif(btrim(coalesce(theme, '')), ''));
  tidy jsonb := '[]'::jsonb;
  one jsonb;
begin
  perform public.require_superadmin();

  if coalesce(btrim(save_platform_event.name), '') = '' then
    raise exception 'An event needs a name.';
  end if;
  if coalesce(btrim(save_platform_event.tag), '') = '' then
    raise exception 'An event needs the small word over its name.';
  end if;
  if coalesce(btrim(save_platform_event.action), '') = '' then
    raise exception 'An event needs something written on its button.';
  end if;
  if coalesce(btrim(save_platform_event.link), '') = '' or btrim(save_platform_event.link) !~ '^(/|https://)' then
    raise exception 'A link is a path on this site or an https address.';
  end if;

  look := coalesce(look, 'kobblon');
  if look not in ('kobblon', 'halloween', 'christmas') then
    raise exception 'The art is Kobblon, Halloween or Christmas.';
  end if;

  if jsonb_typeof(coalesce(save_platform_event.prizes, '[]'::jsonb)) <> 'array' then
    raise exception 'The prizes are a list.';
  end if;
  for one in
    select value from jsonb_array_elements(coalesce(save_platform_event.prizes, '[]'::jsonb))
  loop
    /* Three at most, counted after the empty ones are dropped rather than
     * before - a blank row left in the form should not spend one of them. */
    exit when jsonb_array_length(tidy) >= 3;
    if coalesce(btrim(one ->> 'place'), '') = '' then continue; end if;
    tidy := tidy || jsonb_build_array(jsonb_build_object(
      'place', left(btrim(one ->> 'place'), 12),
      'brix', greatest(0, floor(coalesce((one ->> 'brix')::numeric, 0))::bigint)
    ));
  end loop;

  if which is null then
    insert into public.platform_events
      (tag, name, blurb, link, action, theme, prizes, until, showing, written_by)
    values (
      left(btrim(save_platform_event.tag), 40), left(btrim(save_platform_event.name), 80),
      left(btrim(coalesce(save_platform_event.blurb, '')), 240),
      btrim(save_platform_event.link), left(btrim(save_platform_event.action), 40), look, tidy,
      save_platform_event.until, coalesce(save_platform_event.showing, false), me
    )
    returning id into made;
  else
    /*
     * Every argument qualified with the function's own name. Unqualified,
     * `tag = left(btrim(tag), 40)` is ambiguous between the parameter and
     * the column, and Postgres refuses the whole statement - which the
     * behavioural check found, on the update path only, because the insert
     * above names its columns in a list and has no such ambiguity.
     */
    update public.platform_events set
      tag = left(btrim(save_platform_event.tag), 40),
      name = left(btrim(save_platform_event.name), 80),
      blurb = left(btrim(coalesce(save_platform_event.blurb, '')), 240),
      link = btrim(save_platform_event.link),
      action = left(btrim(save_platform_event.action), 40),
      theme = look,
      prizes = tidy,
      until = save_platform_event.until,
      showing = coalesce(save_platform_event.showing, false),
      updated_at = now()
    where id = which
    returning id into made;
    if made is null then raise exception 'There is no such event.'; end if;
  end if;

  /* One shows at a time: putting this one up takes the others down, here
   * rather than by the reading function picking a winner, so the panel
   * tells the truth about which one is up. */
  if coalesce(save_platform_event.showing, false) then
    update public.platform_events e set showing = false, updated_at = now()
     where e.id <> made and e.showing;
  end if;

  perform public.write_admin_log('event', null, jsonb_build_object(
    'event', made, 'name', left(btrim(save_platform_event.name), 80),
    'showing', coalesce(save_platform_event.showing, false)
  ));

  return made;
end;
$$;

grant execute on function public.save_platform_event to authenticated;

-- ------------------------------------------------------------- the switch

/* Put one up or take it down, on its own, which is the thing a switch is. */
create or replace function public.show_platform_event(which uuid, shown boolean)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare touched uuid;
begin
  perform public.require_superadmin();

  update public.platform_events
     set showing = coalesce(shown, false), updated_at = now()
   where id = which
  returning id into touched;
  if touched is null then raise exception 'There is no such event.'; end if;

  if coalesce(shown, false) then
    update public.platform_events set showing = false, updated_at = now()
     where id <> which and showing;
  end if;

  perform public.write_admin_log('event', null, jsonb_build_object(
    'event', which, 'showing', coalesce(shown, false)
  ));
end;
$$;

grant execute on function public.show_platform_event to authenticated;

create or replace function public.delete_platform_event(which uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare touched uuid;
begin
  perform public.require_superadmin();
  delete from public.platform_events where id = which returning id into touched;
  if touched is null then raise exception 'There is no such event.'; end if;
  perform public.write_admin_log('event', null, jsonb_build_object('removed', which));
end;
$$;

grant execute on function public.delete_platform_event to authenticated;

-- ------------------------------------------------------ the one that is up

/*
 * Halloween 2026, as the row it used to be as a constant, so that the
 * homepage keeps the header it has today rather than losing it the moment
 * this applies. The same words, the same link, the same three prizes and
 * the same end date.
 *
 * Written only if the table is empty, so applying this twice does not put
 * a second one in - and so that a superadmin who has taken it down does
 * not find it back up after the next migration runs.
 */
insert into public.platform_events (tag, name, blurb, link, action, theme, prizes, until, showing)
select
  'Avatar contest',
  'Halloween 2026',
  'Put together the best Halloween avatar you can and post it. The three best take Brix.',
  '/forum/c/avatar-contest-halloween-2026',
  'Enter the contest',
  'halloween',
  '[{"place":"1st","brix":10000},{"place":"2nd","brix":5000},{"place":"3rd","brix":2500}]'::jsonb,
  '2026-11-10'::date,
  true
where not exists (select 1 from public.platform_events);

commit;
