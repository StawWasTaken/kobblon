-- Changing your username costs Pixels and leaves a trail, so the people who
-- knew you under the old name can still recognise you.

-- The ledger did not know about this kind of spend yet.
alter table public.pixel_transactions drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions add constraint pixel_transactions_kind_check
  check (kind in ('signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
                  'username_change'));

/*
 * "kobblestonadmin" slipped past the impersonation rule because the pattern
 * wanted the word to end on a boundary. A name that merely contains staff
 * words is exactly the case worth catching, so the boundary goes.
 */
update public.moderation_terms
   set pattern = '(^|[^a-z])(admin|moderator|staff|official|kobbleston)'
 where pattern = '(^|[^a-z])(admin|moderator|staff|official|kobbleston)([^a-z]|$)';

create table if not exists public.username_history (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  username text not null,
  changed_at timestamptz not null default now()
);

create index if not exists username_history_idx on public.username_history (user_id, changed_at desc);

alter table public.username_history enable row level security;

-- Old names are part of a public profile, the same as the current one.
drop policy if exists username_history_read on public.username_history;
create policy username_history_read on public.username_history for select using (true);

-- Nothing writes to it but the change itself.
revoke insert, update, delete on public.username_history from anon, authenticated;

-- A username is no longer something a plain update can change: it goes
-- through change_username, which takes the payment and keeps the record.
create or replace function public.guard_username()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.username is distinct from old.username
     and coalesce(current_setting('kobbleston.renaming', true), 'off') <> 'on'
     and not public.is_moderator() then
    new.username := old.username;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_username on public.profiles;
create trigger guard_username before update on public.profiles
  for each row execute function public.guard_username();

create or replace function public.username_change_cost()
returns integer language sql immutable as $$ select 250 $$;

grant execute on function public.username_change_cost to anon, authenticated;

/*
 * Takes the Pixels, keeps the old name and moves you to the new one. The
 * first name you ever had is free, because that is the one you signed up
 * with and it is already in the history.
 */
create or replace function public.change_username(new_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  current_name text;
  cost integer := public.username_change_cost();
  balance integer;
  verdict public.screen_decision;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot change their name.'; end if;

  new_name := trim(new_name);

  if new_name !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'A username is 3 to 16 letters, numbers or underscores.';
  end if;

  select username, pixels into current_name, balance from public.profiles where id = me;

  if lower(new_name) = lower(current_name) then
    raise exception 'That is already your name.';
  end if;

  if exists (select 1 from public.profiles where lower(username) = lower(new_name)) then
    raise exception 'Somebody already has that name.';
  end if;

  verdict := (public.screen_text(new_name, 'identity')).decision;
  if verdict <> 'ok' then
    raise exception 'That name is not allowed here.';
  end if;

  if balance < cost then
    raise exception 'Changing your name costs % Pixels and you have %.', cost, balance;
  end if;

  insert into public.username_history (user_id, username) values (me, current_name);

  perform set_config('kobbleston.renaming', 'on', true);
  update public.profiles set username = new_name where id = me;
  perform set_config('kobbleston.renaming', 'off', true);

  perform public.move_pixels(me, -cost, 'username_change', 'Changed name to ' || new_name);

  return new_name;
end;
$$;

grant execute on function public.change_username to authenticated;

-- The names somebody used to go by, oldest first.
drop function if exists public.username_history_of(uuid);
create function public.username_history_of(target uuid)
returns table (username text, changed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.username, h.changed_at
    from public.username_history h
   where h.user_id = target
   order by h.changed_at desc
   limit 20;
$$;

grant execute on function public.username_history_of to anon, authenticated;
