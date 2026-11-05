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
 * The art started as a named theme and nothing else, because a text field
 * asking for a path to a picture is a field that can name a picture that is
 * not there. Staw: "for the art i want it to be an image i can upload. same
 * thing for the background (keep normal+customize it or upload one)" - so
 * the theme stays and is still what a band wears by default, and a
 * superadmin may put their own picture over the mark, their own picture
 * behind the whole band, or their own colour under it.
 *
 * Uploaded and not typed, which is the same guard by another route: the
 * address in the row is one storage handed back for a file that is now in
 * the bucket, rather than a path somebody wrote from memory.
 *
 * And the band is not always a contest. Staw: "the event header isnt always
 * for prize winnings yk" - so the corner that holds what there is to win
 * holds a line of small print instead when there is nothing to win.
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
  /* The picture over the mark, the picture behind the band, and the colour
     under it. All three null is the theme drawn exactly as it ships. */
  art_url     text,
  back_url    text,
  back_colour text,
  /* The small print in the corner where the prizes go, for a band that is
     not giving anything away. */
  note        text not null default '',
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

/* The three that came later, for a table that already exists. */
alter table public.platform_events add column if not exists art_url text;
alter table public.platform_events add column if not exists back_url text;
alter table public.platform_events add column if not exists back_colour text;
alter table public.platform_events add column if not exists note text not null default '';

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
/* Dropped first, both of them: the returned shape gained four columns, and
   `create or replace` cannot change a function's result type. */
drop function if exists public.platform_event_showing();
create function public.platform_event_showing()
returns table (
  id uuid, tag text, name text, blurb text, link text,
  action text, theme text, prizes jsonb, until date,
  art_url text, back_url text, back_colour text, note text
)
language sql stable security definer
set search_path = public, extensions as $$
  select e.id, e.tag, e.name, e.blurb, e.link, e.action, e.theme, e.prizes, e.until,
         e.art_url, e.back_url, e.back_colour, e.note
    from public.platform_events e
   where e.showing
     and (e.until is null or e.until > (now() at time zone 'utc')::date)
   order by e.created_at desc
   limit 1;
$$;

grant execute on function public.platform_event_showing to anon, authenticated;

/* Everything written, for the panel. A superadmin's, including the drafts. */
drop function if exists public.platform_events_all();
create function public.platform_events_all()
returns table (
  id uuid, tag text, name text, blurb text, link text, action text,
  theme text, prizes jsonb, until date, showing boolean,
  art_url text, back_url text, back_colour text, note text,
  written_by uuid, created_at timestamptz
)
language plpgsql stable security definer
set search_path = public, extensions as $$
begin
  perform public.require_superadmin();
  return query
    select e.id, e.tag, e.name, e.blurb, e.link, e.action, e.theme,
           e.prizes, e.until, e.showing,
           e.art_url, e.back_url, e.back_colour, e.note,
           e.written_by, e.created_at
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
/* Dropped by its old shape before it is written: adding a parameter to a
   function with defaults does not replace it, it writes a second one beside
   it, and a four-argument call then matches both and resolves to neither. */
drop function if exists public.save_platform_event(uuid, text, text, text, text, text, text, jsonb, date, boolean);

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
  showing boolean default false,
  art_url text default null,
  back_url text default null,
  back_colour text default null,
  note text default ''
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
  art text := nullif(btrim(coalesce(save_platform_event.art_url, '')), '');
  back text := nullif(btrim(coalesce(save_platform_event.back_url, '')), '');
  paint text := nullif(btrim(lower(coalesce(save_platform_event.back_colour, ''))), '');
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

  /*
   * The two pictures are addresses the bucket handed back, so https and
   * nothing else - and checked here rather than trusted, because this
   * function is what stands between a superadmin's panel and the first
   * thing on the homepage. A `javascript:` in an `img` does nothing, but
   * the same field will be read by the Workspace one day and the rule is
   * cheaper to keep than to remember.
   */
  if art is not null and art !~ '^https://' then
    raise exception 'The art is a picture that has been uploaded.';
  end if;
  if back is not null and back !~ '^https://' then
    raise exception 'The background is a picture that has been uploaded.';
  end if;
  if paint is not null and paint !~ '^#[0-9a-f]{6}$' then
    raise exception 'A background colour is six hex digits after a hash.';
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
      (tag, name, blurb, link, action, theme, prizes, until, showing,
       art_url, back_url, back_colour, note, written_by)
    values (
      left(btrim(save_platform_event.tag), 40), left(btrim(save_platform_event.name), 80),
      left(btrim(coalesce(save_platform_event.blurb, '')), 240),
      btrim(save_platform_event.link), left(btrim(save_platform_event.action), 40), look, tidy,
      save_platform_event.until, coalesce(save_platform_event.showing, false),
      art, back, paint, left(btrim(coalesce(save_platform_event.note, '')), 80), me
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
      art_url = art,
      back_url = back,
      back_colour = paint,
      note = left(btrim(coalesce(save_platform_event.note, '')), 80),
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

-- ------------------------------------------------------------- the bucket

/*
 * Where the uploaded art and backgrounds live.
 *
 * Public to read, because the band is the first thing on the homepage and a
 * signed link that expires is a band that goes blank on its own. Written by
 * superadmins and nobody else: this is the one bucket whose contents are
 * drawn across the top of the site to everybody who arrives, so the write
 * rule is the same rule the panel has rather than the usual own-folder one.
 *
 * Four megabytes and pictures only, which is more than the two a forum post
 * gets because this is a band two thousand pixels wide rather than a
 * thumbnail in a thread.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'events', 'events', true, 4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
   set public = true,
       file_size_limit = 4194304,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists event_files_read on storage.objects;
create policy event_files_read on storage.objects for select
  using (bucket_id = 'events');

drop policy if exists event_files_write on storage.objects;
create policy event_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'events' and public.is_superadmin());

drop policy if exists event_files_remove on storage.objects;
create policy event_files_remove on storage.objects for delete to authenticated
  using (bucket_id = 'events' and public.is_superadmin());

commit;
