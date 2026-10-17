begin;

/*
 * The notice across the top, in the colour whoever wrote it chose, and two
 * of them at a time.
 *
 * Staw: "we want the announcement banner to look better, be plain
 * green/blue/red/orange/white (the person who writes the announcement
 * decides of that) and make that we can add up to 2 announcements".
 *
 * `tone` was three moods - good, warn, plain - and a mood is the website
 * deciding what a colour means. These are five colours and they mean what
 * the person writing picked them to mean. The three old names stay
 * readable so that a notice written last week does not become a notice
 * with no colour, and the rows that exist are moved over.
 *
 * Two at a time, and the second is a limit rather than a feature: a third
 * is refused here rather than quietly pushing the oldest off the top,
 * because a notice that vanishes without anybody taking it down is a
 * notice nobody can trust.
 */

alter table public.site_notices drop constraint if exists site_notices_tone_check;

update public.site_notices set tone = case tone
  when 'good'  then 'green'
  when 'warn'  then 'orange'
  when 'plain' then 'white'
  else tone
end;

alter table public.site_notices
  add constraint site_notices_tone_check
  check (tone in ('green', 'blue', 'red', 'orange', 'white'));

alter table public.site_notices alter column tone set default 'blue';

-- ------------------------------------------------------------ reading them

/* Whatever is up, newest first, and never more than the two allowed. */
create or replace function public.notice_now()
returns table (id uuid, body text, link text, link_words text, tone text, ends_at timestamptz)
language sql stable
set search_path = public, extensions as $$
  select n.id, n.body, n.link, n.link_words, n.tone, n.ends_at
    from public.site_notices n
   where n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
   order by n.starts_at desc
   limit 2;
$$;

grant execute on function public.notice_now to anon, authenticated;

-- ------------------------------------------------------------ putting one up

create or replace function public.put_up_notice(
  words text, where_to text default null, link_label text default null,
  mood text default 'blue', until timestamptz default null
)
returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made uuid;
  colour text := lower(nullif(btrim(coalesce(mood, '')), ''));
  up integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon writes a notice.';
  end if;
  if coalesce(btrim(words), '') = '' then
    raise exception 'A notice needs something in it.';
  end if;

  -- The old three still answer to something, so a caller that has not been
  -- rebuilt yet writes a colour rather than a refusal.
  colour := case colour
    when 'good'  then 'green'
    when 'warn'  then 'orange'
    when 'plain' then 'white'
    else coalesce(colour, 'blue')
  end;
  if colour not in ('green', 'blue', 'red', 'orange', 'white') then
    raise exception 'A notice is green, blue, red, orange or white.';
  end if;

  select count(*) into up
    from public.site_notices
   where starts_at <= now() and (ends_at is null or ends_at > now());
  if up >= 2 then
    raise exception 'Two notices is the most that can be up. Take one down first.';
  end if;

  /*
   * An address, and only the two schemes a browser should follow from a
   * line of text somebody else wrote. `javascript:` is the one that matters.
   */
  if where_to is not null and btrim(where_to) <> ''
     and btrim(where_to) !~ '^(/|https://)' then
    raise exception 'A link is a path on this site or an https address.';
  end if;

  insert into public.site_notices (body, link, link_words, tone, ends_at, written_by)
  values (
    left(btrim(words), 300),
    nullif(btrim(coalesce(where_to, '')), ''),
    nullif(btrim(coalesce(link_label, '')), ''),
    colour,
    until,
    me
  )
  returning id into made;

  perform public.write_admin_log('notice', null, jsonb_build_object(
    'body', left(btrim(words), 300), 'link', where_to, 'tone', colour
  ));

  return made;
end;
$$;

grant execute on function public.put_up_notice to authenticated;

-- ---------------------------------------------------------- taking one down

/*
 * One of them, or all of them.
 *
 * With two up, "take down the notice" is no longer a question with one
 * answer, so the id of the one meant is the argument. Nothing passed still
 * means all of them, which is what the old call did and what the button
 * beside an empty list should still do.
 */
-- The old one took no argument, and leaving it beside this one makes
-- `take_down_notice()` ambiguous rather than compatible.
drop function if exists public.take_down_notice();

create or replace function public.take_down_notice(which uuid default null)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon takes a notice down.';
  end if;

  update public.site_notices
     set ends_at = now()
   where starts_at <= now() and (ends_at is null or ends_at > now())
     and (which is null or id = which);
end;
$$;

grant execute on function public.take_down_notice(uuid) to authenticated;

commit;
