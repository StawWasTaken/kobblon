-- Tying a Discord account to a Kobblon one.
--
-- The point of it is a link that works in both directions: somebody's Discord
-- carries their Kobblon profile, and anybody who has their Discord id can be
-- sent to that profile. What makes it worth anything is that it is verified:
-- the tie is written by the edge function after Discord has said who the
-- person is, and a browser cannot write it at all.

alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists discord_username text;
alter table public.profiles add column if not exists discord_linked_at timestamptz;

create unique index if not exists profiles_discord_idx on public.profiles (discord_id)
  where discord_id is not null;

/*
 * Nobody writes these to their own row. A profile update that tries carries
 * on with whatever was there before, so claiming somebody else's Discord is
 * not something the site has to remember to check for.
 */
create or replace function public.guard_discord()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('kobblon.linking', true) = 'on' then return new; end if;

  new.discord_id := old.discord_id;
  new.discord_username := old.discord_username;
  new.discord_linked_at := old.discord_linked_at;
  return new;
end;
$$;

drop trigger if exists profiles_guard_discord on public.profiles;
create trigger profiles_guard_discord before update on public.profiles
  for each row execute function public.guard_discord();

/**
 * Writing the tie. Only reachable with the service role, which lives in the
 * edge function and nowhere a browser can read, and it is the only thing that
 * lifts the guard above.
 */
create or replace function public.link_discord(who uuid, discord text, discord_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if discord is null or btrim(discord) = '' then
    raise exception 'No Discord account came back.';
  end if;

  -- The guard comes off first, or clearing the other account is undone by
  -- it and the write below collides with the row it was meant to free.
  perform set_config('kobblon.linking', 'on', true);

  -- One Discord account, one Kobblon account.
  update public.profiles
     set discord_id = null, discord_username = null, discord_linked_at = null
   where discord_id = discord and id <> who;

  update public.profiles
     set discord_id = discord,
         discord_username = nullif(btrim(discord_name), ''),
         discord_linked_at = now()
   where id = who;

  perform set_config('kobblon.linking', 'off', true);
end;
$$;

revoke execute on function public.link_discord(uuid, text, text) from anon, authenticated;

/** Letting go of it, which is yours to do. */
create or replace function public.unlink_discord()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  perform set_config('kobblon.linking', 'on', true);

  update public.profiles
     set discord_id = null, discord_username = null, discord_linked_at = null
   where id = auth.uid();

  perform set_config('kobblon.linking', 'off', true);
end;
$$;

grant execute on function public.unlink_discord to authenticated;

/**
 * Where a Discord id goes: the username and number of the Kobblon account it
 * belongs to, and nothing else about them.
 */
create or replace function public.profile_by_discord(discord text)
returns table (username text, content_id bigint)
language sql stable security definer set search_path = public as $$
  select p.username, p.content_id
    from public.profiles p
   where p.discord_id = discord and not p.is_suspended;
$$;

grant execute on function public.profile_by_discord to anon, authenticated;
