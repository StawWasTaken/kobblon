-- Two names come back from Discord, and they are not the same thing.
--
-- The display name is what somebody calls themselves and is shown on their
-- Kobblon profile. The handle is how you find them in Discord, which is
-- closer to a phone number: shown to whoever they choose and nobody else.
--
-- The handle therefore cannot live on the profile row, because that row is
-- readable by anybody. It has a table of its own, and who may read a row of
-- it is decided in the database rather than by a page remembering to hide it.

do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'discord_username'
  ) then
    alter table public.profiles rename column discord_username to discord_display;
  end if;
end $$;

alter table public.profiles add column if not exists discord_visibility text
  not null default 'friends'
  check (discord_visibility in ('everyone', 'friends', 'nobody'));

create or replace function public.guard_discord()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('kobblon.linking', true) = 'on' then return new; end if;

  new.discord_id := old.discord_id;
  new.discord_display := old.discord_display;
  new.discord_linked_at := old.discord_linked_at;
  new.discord_visibility := old.discord_visibility;
  return new;
end;
$$;

create table if not exists public.discord_handles (
  user_id uuid primary key references public.profiles on delete cascade,
  handle text not null,
  linked_at timestamptz not null default now()
);

alter table public.discord_handles enable row level security;

/*
 * Yours, a moderator's, or whoever the person said could see it. A friend
 * counts as a friend both ways round, which is what friends_with answers.
 */
drop policy if exists discord_handles_read on public.discord_handles;
create policy discord_handles_read on public.discord_handles for select
  using (
    user_id = auth.uid()
    or public.is_moderator()
    or exists (
      select 1 from public.profiles p
       where p.id = discord_handles.user_id
         and (
           p.discord_visibility = 'everyone'
           or (p.discord_visibility = 'friends'
               and public.friends_with(auth.uid(), p.id))
         )
    )
  );

grant select on public.discord_handles to anon, authenticated;

-- Whatever was stored as the username is the handle; the display name is
-- filled in again the next time somebody connects.
insert into public.discord_handles (user_id, handle, linked_at)
select p.id, p.discord_display, coalesce(p.discord_linked_at, now())
  from public.profiles p
 where p.discord_display is not null
on conflict (user_id) do nothing;

/**
 * Writing the tie, now with both names. Still only reachable with the
 * service role, and still the only thing that lifts the guard on the row.
 */
drop function if exists public.link_discord(uuid, text, text);
drop function if exists public.link_discord(uuid, text, text, text);
create or replace function public.link_discord(
  who uuid, discord text, shown text, handle text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if discord is null or btrim(discord) = '' then
    raise exception 'No Discord account came back.';
  end if;

  perform set_config('kobblon.linking', 'on', true);

  update public.profiles
     set discord_id = null, discord_display = null, discord_linked_at = null
   where discord_id = discord and id <> who;

  delete from public.discord_handles h
   using public.profiles p
   where h.user_id = p.id and p.discord_id is null and h.user_id <> who;

  update public.profiles
     set discord_id = discord,
         discord_display = nullif(btrim(shown), ''),
         discord_linked_at = now()
   where id = who;

  insert into public.discord_handles (user_id, handle, linked_at)
  values (who, coalesce(nullif(btrim(link_discord.handle), ''), shown, discord), now())
  on conflict (user_id) do update
    set handle = excluded.handle, linked_at = excluded.linked_at;

  perform set_config('kobblon.linking', 'off', true);
end;
$$;

revoke execute on function public.link_discord(uuid, text, text, text) from anon, authenticated;

create or replace function public.unlink_discord()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;

  perform set_config('kobblon.linking', 'on', true);

  update public.profiles
     set discord_id = null, discord_display = null, discord_linked_at = null
   where id = auth.uid();

  delete from public.discord_handles where user_id = auth.uid();

  perform set_config('kobblon.linking', 'off', true);
end;
$$;

/** Who may see your handle: everyone, your friends, or nobody. */
create or replace function public.set_discord_visibility(who_sees text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if who_sees not in ('everyone', 'friends', 'nobody') then
    raise exception 'That is not one of the choices.';
  end if;

  perform set_config('kobblon.linking', 'on', true);
  update public.profiles set discord_visibility = who_sees where id = auth.uid();
  perform set_config('kobblon.linking', 'off', true);
end;
$$;

grant execute on function public.set_discord_visibility to authenticated;

/**
 * Somebody's Discord handle, if you are allowed it. Says nothing rather than
 * refusing, because whether somebody has a Discord account is not a secret
 * and who may see the handle is theirs to decide.
 */
create or replace function public.discord_handle_of(target uuid)
returns text language sql stable security definer set search_path = public as $$
  select h.handle
    from public.discord_handles h
    join public.profiles p on p.id = h.user_id
   where h.user_id = target
     and (
       target = auth.uid()
       or public.is_moderator()
       or p.discord_visibility = 'everyone'
       or (p.discord_visibility = 'friends' and public.friends_with(auth.uid(), target))
     );
$$;

grant execute on function public.discord_handle_of to anon, authenticated;
