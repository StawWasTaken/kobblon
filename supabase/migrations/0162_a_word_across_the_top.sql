begin;

-- A notice across the top of the site, which Kobblon writes and anybody can
-- close.
--
-- Staw: "you can actually write announcements that display as a green topbar
-- under the actual real topbar (that you can close if u want) ... and ONLY
-- THE KOBBLON ACC".
--
-- Not a notification: a notification is for one person and waits in a list.
-- This is the shop putting a sign in the window - everybody sees the same
-- one, it is there until it is taken down or runs out, and closing it is a
-- fact about one browser rather than about the notice. So the closing is
-- remembered in the browser and not here: a table of who dismissed what is a
-- row per person per notice, which is a lot of writing to record something
-- nobody will ever ask about.

create table if not exists public.site_notices (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body)) between 1 and 300),
  /* Where it points, if anywhere. An address on this site, or an outside
     one: the page decides how to draw it, and nothing here is rendered as
     markup, ever. A notice is text and an address, never HTML. */
  link text,
  link_words text,
  tone text not null default 'good' check (tone in ('good', 'warn', 'plain')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  written_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists site_notices_live on public.site_notices (starts_at desc);

alter table public.site_notices enable row level security;

drop policy if exists site_notices_read on public.site_notices;
create policy site_notices_read on public.site_notices for select using (true);

grant select on public.site_notices to anon, authenticated;

/** Whatever notice is up, or nothing. The newest one wins. */
create or replace function public.notice_now()
returns table (id uuid, body text, link text, link_words text, tone text, ends_at timestamptz)
language sql stable
set search_path = public, extensions as $$
  select n.id, n.body, n.link, n.link_words, n.tone, n.ends_at
    from public.site_notices n
   where n.starts_at <= now() and (n.ends_at is null or n.ends_at > now())
   order by n.starts_at desc
   limit 1;
$$;

grant execute on function public.notice_now to anon, authenticated;

/**
 * Putting one up. Kobblon only - not a moderator, Kobblon.
 *
 * A notice is the platform speaking in its own voice to everybody at once,
 * which is a different thing from moderating, and the account that may do it
 * is the house.
 */
create or replace function public.put_up_notice(
  words text, where_to text default null, link_label text default null,
  mood text default 'good', until timestamptz default null
)
returns uuid
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  made uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not coalesce((select is_admin from public.profiles where id = me), false) then
    raise exception 'Only Kobblon writes a notice.';
  end if;
  if coalesce(btrim(words), '') = '' then
    raise exception 'A notice needs something in it.';
  end if;

  /*
   * An address, and only the two schemes a browser should follow from a
   * line of text somebody else wrote. `javascript:` is the one that matters:
   * a notice is written by the house today and this function is the only
   * thing standing between that and a link that runs something.
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
    coalesce(nullif(btrim(coalesce(mood, '')), ''), 'good'),
    until,
    me
  )
  returning id into made;

  perform public.write_admin_log('notice', null, jsonb_build_object(
    'body', left(btrim(words), 300), 'link', where_to
  ));

  return made;
end;
$$;

grant execute on function public.put_up_notice to authenticated;

/** Taking it down now. Kobblon only. */
create or replace function public.take_down_notice()
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
   where starts_at <= now() and (ends_at is null or ends_at > now());
end;
$$;

grant execute on function public.take_down_notice to authenticated;

commit;

begin;

/**
 * The house account, so a word from Kobblon wears Kobblon's face.
 *
 * Staw: "when u send a notification to someone it actually displays the pfp
 * of the kobblon account, not a 'k'". A system notification has no actor -
 * nobody sent it, the platform did - so the picture has to come from
 * somewhere, and the honest somewhere is the account that is the platform.
 *
 * Public, because everything it hands back is already on a profile anybody
 * can open.
 */
create or replace function public.house_account()
returns table (id uuid, username text, display_name text, avatar_url text, avatar_changed_at timestamptz)
language sql stable
set search_path = public, extensions as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.avatar_changed_at
    from public.profiles p
   where p.id = public.kobbleston_account();
$$;

grant execute on function public.house_account to anon, authenticated;

commit;
