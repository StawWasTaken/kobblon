begin;

/*
 * Links: still banned, except five places.
 *
 * Staw: "make that off site links are banned like they are being right
 * now, except tiktok, youtube, discord, kobblon, and spotify links (theyre
 * allowed)".
 *
 * The rule was two rows in `moderation_terms` - one pattern matching
 * `https?://` or `www.`, blocking in chat and flagging on a profile - and
 * a pattern cannot express "unless the host is one of these". Postgres's
 * POSIX regex has no lookahead, so the version of this that tries to stay
 * a regex is a 400-character line nobody can read or edit, and the day
 * Staw adds a sixth site it is rewritten from scratch.
 *
 * So the hosts are a table and the decision is a function. Adding a site
 * is one `insert`; the pattern rows come out, because leaving them in
 * would block the allowed ones before this was ever asked.
 *
 * What counts as the host, and why it is stricter than it looks: the
 * pattern anchors the end of the name, so `youtube.com` matches
 * `youtube.com` and `www.youtube.com` and `m.youtube.com`, and does **not**
 * match `youtube.com.evil.example` - which is the whole reason this is not
 * a `like '%youtube.com%'`. That check is the only part of this file worth
 * being careful about: everything else is a list.
 */

create table if not exists public.allowed_link_hosts (
  host text primary key check (host = lower(host) and host ~ '^[a-z0-9.-]+$'),
  why text,
  added_at timestamptz not null default now()
);

alter table public.allowed_link_hosts enable row level security;

/*
 * Grants in the same file as the table - this project's fourth trap, which
 * has cost it a fortnight twice: a policy says which rows a role may see,
 * a grant says whether the role may touch the table at all, and a new
 * table has no grants.
 */
grant select on public.allowed_link_hosts to anon, authenticated;

drop policy if exists allowed_link_hosts_read on public.allowed_link_hosts;
create policy allowed_link_hosts_read on public.allowed_link_hosts
  for select using (true);

insert into public.allowed_link_hosts (host, why) values
  ('youtube.com', 'Staw'),
  ('youtu.be', 'YouTube''s own short link'),
  ('tiktok.com', 'Staw'),
  ('discord.gg', 'Discord''s invite link'),
  ('discord.com', 'Staw'),
  ('spotify.com', 'Staw'),
  ('open.spotify.com', 'Spotify''s share link'),
  ('kobblon.com', 'Ours')
on conflict (host) do nothing;

/**
 * The first host in this text that is not on the list, or null.
 *
 * Null means "nothing here to stop" - either there are no links at all, or
 * every one of them is somewhere allowed. A host back means that one is
 * the reason, which is what lets the message say *which* link rather than
 * "links are not allowed" at somebody who posted a YouTube video.
 */
create or replace function public.offsite_link(input text)
returns text
language plpgsql immutable
set search_path = public, extensions as $$
declare
  found text;
  /*
   * Not called `host`: that is also a column of `allowed_link_hosts`, and
   * Postgres cannot tell a plpgsql variable from a column of the same name
   * inside a statement that touches both. The same mistake `react` made
   * last week, caught here by running it rather than by reading it.
   */
  site text;
begin
  if coalesce(btrim(input), '') = '' then return null; end if;

  for found in
    select (regexp_matches(
              lower(input),
              '(?:https?://|www\.)([a-z0-9.-]+)',
              'g'))[1]
  loop
    site := btrim(found, '.');

    /*
     * On the list, or a sub-domain of something on it. Anchored at the
     * end of the name on purpose: `youtube.com.evil.example` ends with
     * `evil.example` and must not pass because it contains `youtube.com`.
     */
    if not exists (
      select 1 from public.allowed_link_hosts a
       where site = a.host or site like ('%.' || a.host)
    ) then
      return site;
    end if;
  end loop;

  return null;
end $$;

grant execute on function public.offsite_link(text) to anon, authenticated, service_role;

/*
 * The blanket patterns come out. They match every link including the
 * allowed ones, and they run before anything this file does.
 */
delete from public.moderation_terms
 where pattern = '(https?://|www\.)';

/*
 * And the shortener rule loses Discord.
 *
 * It lumped `discord.gg` in with `t.me`, `bit.ly` and `tinyurl`, which was
 * right when every off-site link was banned and is wrong now that Discord
 * is one of the five. The other three stay: a shortener is a link whose
 * destination nobody can see, which is a different thing from a link to
 * somewhere we have decided is fine.
 */
update public.moderation_terms
   set pattern = '(^|[^a-z])(t\.me|bit\.ly|tinyurl)'
 where pattern = '(^|[^a-z])(discord\.gg|t\.me|bit\.ly|tinyurl)';

/**
 * `screen_text`, asking about links by host rather than by pattern.
 *
 * The term list still decides everything else; this is one question asked
 * before it, because a link is the one thing on this platform whose
 * verdict depends on *where it points* rather than on what it says.
 *
 * A link somewhere not allowed is blocked in chat and flagged for review
 * anywhere a name or a description is screened - which is what the two
 * rows it replaces did, minus the five places Staw wants through.
 */
create or replace function public.screen_text(input text, check_scope text default 'all')
returns table (decision public.screen_decision, reason text)
language plpgsql stable
set search_path = public, extensions as $$
declare
  flattened text := public.normalize_for_screening(input);
  raw text := lower(coalesce(input, ''));
  offsite text;
  hit record;
begin
  if coalesce(trim(input), '') = '' then
    return query select 'ok'::public.screen_decision, null::text;
    return;
  end if;

  /*
   * Asked first, because a blocked link should be said as a link rather
   * than as whatever word in the address happened to be on the term list.
   */
  offsite := public.offsite_link(input);
  if offsite is not null then
    if check_scope = 'say' or check_scope = 'chat' then
      return query select 'block'::public.screen_decision,
        ('Links to ' || offsite || ' cannot be posted. YouTube, TikTok, '
         || 'Discord, Spotify and Kobblon links are fine.')::text;
    else
      return query select 'review'::public.screen_decision,
        ('Contains a link to ' || offsite)::text;
    end if;
    return;
  end if;

  for hit in
    select t.decision, t.reason
      from public.moderation_terms t
     where (t.scope = 'all' or t.scope = check_scope)
       and (flattened ~* t.pattern or raw ~* t.pattern)
     order by (t.decision = 'block') desc
     limit 1
  loop
    return query select hit.decision, hit.reason;
    return;
  end loop;

  return query select 'ok'::public.screen_decision, null::text;
end $$;

commit;
