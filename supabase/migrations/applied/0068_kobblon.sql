-- The platform is Kobblon.
--
-- The names in here were written when it was called something else. The old
-- ones stay as thin wrappers rather than being dropped, because policies and
-- functions across every earlier migration call them by name and a rename
-- alone would leave those pointing at nothing. New work uses the Kobblon
-- names; the old pair can go in a later pass once nothing calls them.

/*
 * The house account. Whichever name it is under, this finds it: the account
 * is being renamed to kobblon, and anything already written against the old
 * name keeps working while that happens.
 */
create or replace function public.kobblon_account()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
   where lower(p.username) in ('kobblon', 'kobbleston')
   order by (lower(p.username) = 'kobblon') desc
   limit 1;
$$;

create or replace function public.kobbleston_account()
returns uuid language sql stable security definer set search_path = public as $$
  select public.kobblon_account();
$$;

create or replace function public.is_kobblon(who uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = who and lower(p.username) in ('kobblon', 'kobbleston')
  );
$$;

create or replace function public.is_kobbleston(who uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_kobblon(who);
$$;

grant execute on function public.kobblon_account, public.is_kobblon to authenticated;

-- The house account takes the new name, and its old one is kept the way any
-- other name change is.
do $$
declare house uuid;
begin
  select id into house from public.profiles where lower(username) = 'kobbleston';
  if house is null then return; end if;
  if exists (select 1 from public.profiles where lower(username) = 'kobblon') then return; end if;

  insert into public.username_history (user_id, username)
  values (house, 'kobbleston')
  on conflict do nothing;

  update public.profiles
     set username = 'kobblon',
         display_name = case when display_name = 'Kobbleston' then 'Kobblon' else display_name end
   where id = house;
end $$;

-- Anything written in a row that people read, said the way it is said now.
update public.profiles
   set bio = replace(replace(bio, 'Kobbleston', 'Kobblon'), 'kobbleston', 'kobblon')
 where bio like '%obbleston%';

update public.pixel_transactions
   set note = replace(replace(note, 'Kobbleston', 'Kobblon'), 'kobbleston', 'kobblon')
 where note like '%obbleston%';

update public.promo_codes
   set note = replace(note, 'Kobbleston', 'Kobblon')
 where note like '%Kobbleston%';

update public.notifications
   set body = replace(body, 'Kobbleston', 'Kobblon')
 where body like '%Kobbleston%';
