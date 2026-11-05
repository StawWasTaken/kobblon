-- Presence, actually kept up to date, and with a fourth thing it can say.
--
-- There has been a touch_presence function since the beginning and nothing
-- ever called it, so "online" meant whatever the last sign in happened to
-- set, and stayed that way for good. The page now says so every minute, and
-- says what somebody is doing while it is at it: looking around, or building
-- something.
--
-- Being inside a Space is already recorded when they enter one, so the four
-- states are: in a Space, building, around, and gone. Anybody whose last
-- word was more than a few minutes ago is treated as gone, whatever the flag
-- says, so a browser closed mid-sentence does not leave somebody online for
-- ever. Safe to run again.

alter table public.profiles add column if not exists activity text;

alter table public.profiles drop constraint if exists profiles_activity_check;
alter table public.profiles add constraint profiles_activity_check
  check (activity is null or activity in ('around', 'building'));

-- The one argument shape is replaced by the two argument one.
drop function if exists public.touch_presence(boolean);

create or replace function public.touch_presence(
  online boolean default true,
  doing text default null
)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set is_online = online,
         last_seen_at = now(),
         activity = case
           when not online then null
           when doing in ('around', 'building') then doing
           else 'around'
         end
   where id = auth.uid();
$$;

grant execute on function public.touch_presence(boolean, text) to authenticated;

/** How long somebody can be quiet before they count as gone. */
create or replace function public.presence_window() returns interval
language sql immutable as $$ select interval '3 minutes' $$;

grant execute on function public.presence_window to anon, authenticated;

-- Anybody who stopped saying anything is no longer online, whatever their
-- flag says. Called when presence is read rather than on a timer, because
-- there is nothing here to run a timer.
create or replace function public.sweep_presence()
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set is_online = false, activity = null, in_space_id = null
   where is_online and last_seen_at < now() - public.presence_window();
$$;

grant execute on function public.sweep_presence to anon, authenticated;
