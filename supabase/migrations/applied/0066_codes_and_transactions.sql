-- Codes, and a place to read your own money.
--
-- A code is a row rather than a string in the application: it can be turned
-- off, given a limit, given an end date, and counted, and none of that is
-- decided by a browser. Redeeming is one function, so a code cannot be taken
-- twice, cannot be taken by a guest, and cannot pay out anything the row does
-- not say.

alter table public.pixel_transactions drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions add constraint pixel_transactions_kind_check
  check (kind in ('signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
                  'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning',
                  'listing_fee', 'listing_refund', 'platform_fee', 'burn', 'code'));

create table if not exists public.promo_codes (
  code text primary key check (code = lower(code) and char_length(code) between 3 and 40),
  reward integer not null check (reward >= 0 and reward <= 100000),
  note text check (char_length(note) <= 120),
  /** Null means as many as people can find. */
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_redemptions (
  code text not null references public.promo_codes on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  reward integer not null,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

/*
 * Nobody reads the table of codes. A code is something you are given, not
 * something you browse, and a list of every live code is a list of free
 * money. The function below is the only way in.
 */
drop policy if exists promo_codes_read on public.promo_codes;
create policy promo_codes_read on public.promo_codes for select
  using (public.is_moderator());

drop policy if exists promo_redemptions_read on public.promo_redemptions;
create policy promo_redemptions_read on public.promo_redemptions for select
  using (user_id = auth.uid() or public.is_moderator());

grant select on public.promo_redemptions to authenticated;

/**
 * Taking a code. Says what happened in words, because "false" tells nobody
 * whether they mistyped it, already have it, or came too late.
 */
create or replace function public.redeem_code(entered text)
returns table (reward integer, message text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  tidy text := lower(btrim(coalesce(entered, '')));
  row public.promo_codes%rowtype;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then raise exception 'Guests cannot redeem codes.'; end if;
  if tidy = '' then raise exception 'Type a code first.'; end if;

  select * into row from public.promo_codes c where c.code = tidy;

  if row.code is null then raise exception 'That code does not work.'; end if;
  if not row.is_active then raise exception 'That code is no longer going.'; end if;
  if row.starts_at is not null and now() < row.starts_at then
    raise exception 'That code is not going yet.';
  end if;
  if row.expires_at is not null and now() > row.expires_at then
    raise exception 'That code has run out of time.';
  end if;
  if row.max_uses is not null and row.used_count >= row.max_uses then
    raise exception 'That code has been taken as many times as it can be.';
  end if;

  if exists (select 1 from public.promo_redemptions r
              where r.code = tidy and r.user_id = me) then
    raise exception 'You have taken that one already.';
  end if;

  insert into public.promo_redemptions (code, user_id, reward)
  values (tidy, me, row.reward);

  update public.promo_codes c
     set used_count = c.used_count + 1
   where c.code = tidy;

  if row.reward > 0 then
    perform public.move_pixels(me, row.reward, 'code', coalesce(row.note, 'Code: ' || tidy));
  end if;

  return query select row.reward, coalesce(row.note, 'Code accepted.');
end;
$$;

grant execute on function public.redeem_code to authenticated;

/**
 * Your own money, as far back as you ask for it, with the kinds you ask for.
 * Reading somebody else's is not possible: the function only ever looks at
 * whoever is calling it.
 */
drop function if exists public.my_transactions(integer, text[]);
create or replace function public.my_transactions(
  days integer default 30,
  kinds text[] default null
)
returns table (
  id bigint,
  amount integer,
  kind text,
  note text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select t.id, t.amount, t.kind, t.note, t.created_at
    from public.pixel_transactions t
   where t.user_id = auth.uid()
     and (days is null or days <= 0 or t.created_at > now() - make_interval(days => days))
     and (kinds is null or t.kind = any (kinds))
   order by t.created_at desc
   limit 500;
$$;

grant execute on function public.my_transactions to authenticated;

-- The first code.
insert into public.promo_codes (code, reward, note)
values ('welcome26', 100, 'Welcome to Kobbleston')
on conflict (code) do nothing;
