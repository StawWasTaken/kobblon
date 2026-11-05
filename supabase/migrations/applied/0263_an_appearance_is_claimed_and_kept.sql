begin;

/*
 * Theme appearances: how Kobblon looks to one person.
 *
 * Staw: "i want more theme appearances (its still always white or our black
 * background colour but the sidebar & logomark/wordmark will change) ...
 * make that everyone gets a popup card (with the logomark/wordmark of the
 * appearance) saying that they got it and theres a claim button under which
 * claims it in their theme appearances (in settings so that they can change
 * appearances when they want) and automatically applies it, and this card
 * ONLY appears on certain periods and those who did not claim it wont be
 * able to use it, but when you claimed it you can use it whenever you want".
 *
 * Three things that decide the shape of all this:
 *
 * **An appearance is not the dark/light mode.** The mode stays where it is,
 * in the browser, because it is about the machine and the light in the room
 * - the same person wants dark at night on the same account. An appearance
 * is about the account: it is claimed, it is kept, and it follows them to
 * whatever they sign in on. So they are two settings and both apply, which
 * is also what Staw's own art says - he drew a halloween backdrop for the
 * dark interface and another for the light one.
 *
 * **The window is decided here and nowhere else.** "ONLY appears on certain
 * periods" is a rule about what somebody may have, so the page may ask what
 * is on offer but may not answer it. `claim_appearance` checks the date
 * itself and refuses outside it; a page that asked nicely gets nothing.
 *
 * **Claimed is for ever.** The row says they were there that year. Nothing
 * takes it away when the month ends, which is the whole point of claiming
 * rather than switching on.
 */

/*
 * ------------------------------------------------------------------
 * 1. Which appearances exist, and when each is given away.
 * ------------------------------------------------------------------
 *
 * One list, read by everything else, because the last migration that wrote
 * a list of names twice - the reaction faces - ended with the constraint
 * accepting a value the function refused. Immutable so a check constraint
 * may use it.
 */
create or replace function public.appearances()
returns text[] language sql immutable set search_path = public as $$
  select array['default', 'halloween', 'christmas']
$$;

grant execute on function public.appearances() to authenticated, anon;

/*
 * What is being given away on a given day, or nothing.
 *
 * Halloween is the whole of October, every year. Christmas opens in the
 * middle of November and runs to the end of the year - Staw: "for halloween
 * its every year from october first to october thirty-first - the whole
 * month ... while for christmas its from half of the month of november up
 * until the 31st of december".
 *
 * Takes the day rather than reading the clock so that it can be checked,
 * and so that a page can ask about a date it is curious about without the
 * answer depending on which machine asked.
 */
create or replace function public.appearance_on_offer(on_day date default current_date)
returns text language sql immutable set search_path = public as $$
  select case
    when extract(month from on_day) = 10 then 'halloween'
    when extract(month from on_day) = 12 then 'christmas'
    when extract(month from on_day) = 11 and extract(day from on_day) >= 15 then 'christmas'
    else null
  end
$$;

grant execute on function public.appearance_on_offer(date) to authenticated, anon;

/*
 * ------------------------------------------------------------------
 * 2. Who has claimed what.
 * ------------------------------------------------------------------
 *
 * The grants are in this file, beside the table, because a policy decides
 * which rows a role may see and a grant decides whether it may touch the
 * table at all - and a new table has no grants. This project has shipped
 * that twice: a table that looks carefully protected and answers
 * "permission denied" to everybody.
 */
create table if not exists public.appearance_claims (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  appearance text not null check (appearance = any (public.appearances())),
  claimed_at timestamptz not null default now(),
  primary key (user_id, appearance)
);

alter table public.appearance_claims enable row level security;

grant select on public.appearance_claims to authenticated;

drop policy if exists "see your own claims" on public.appearance_claims;
create policy "see your own claims" on public.appearance_claims
  for select to authenticated using (user_id = auth.uid());

/*
 * Nothing is granted for writing on purpose: claiming goes through
 * `claim_appearance`, which is where the date is checked. A person who
 * could insert their own row could have christmas in March.
 */

/*
 * ------------------------------------------------------------------
 * 3. The appearance a profile is wearing.
 * ------------------------------------------------------------------
 */
alter table public.profiles
  add column if not exists appearance text not null default 'default';

alter table public.profiles drop constraint if exists profiles_appearance_check;
alter table public.profiles
  add constraint profiles_appearance_check check (appearance = any (public.appearances()));

/*
 * ------------------------------------------------------------------
 * 4. Claiming one, and wearing one.
 * ------------------------------------------------------------------
 *
 * Both raise `kobbleston.appearance` around their write. `security definer`
 * changes a function's rights and not who it reports as, so without the
 * flag `guard_profile_update` - which asks `auth.uid()` - pins the column
 * straight back and the call returns happily having done nothing. That is
 * the bug that cost this platform its worst week, and it has now been found
 * four times.
 */
create or replace function public.claim_appearance(which text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if which is null or which = 'default' or not (which = any (public.appearances())) then
    raise exception 'That is not an appearance anybody claims.';
  end if;

  -- The window, checked here, because the page asking is not evidence.
  if public.appearance_on_offer() is distinct from which then
    raise exception 'That one is not being given away at the moment.';
  end if;

  insert into public.appearance_claims (user_id, appearance)
  values (me, which)
  on conflict (user_id, appearance) do nothing;

  -- "and automatically applies it".
  perform set_config('kobbleston.appearance', 'on', true);
  update public.profiles set appearance = which where id = me;
  perform set_config('kobbleston.appearance', 'off', true);
end $$;

revoke all on function public.claim_appearance(text) from public;
grant execute on function public.claim_appearance(text) to authenticated;

create or replace function public.set_appearance(which text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if which is null or not (which = any (public.appearances())) then
    raise exception 'There is no such appearance.';
  end if;

  -- "those who did not claim it wont be able to use it". The default is
  -- everybody's and is never claimed.
  if which <> 'default' and not exists (
    select 1 from public.appearance_claims where user_id = me and appearance = which
  ) then
    raise exception 'You have not claimed that one.';
  end if;

  perform set_config('kobbleston.appearance', 'on', true);
  update public.profiles set appearance = which where id = me;
  perform set_config('kobbleston.appearance', 'off', true);
end $$;

revoke all on function public.set_appearance(text) from public;
grant execute on function public.set_appearance(text) to authenticated;

/* What this person may wear, in one call, so Settings asks once. */
create or replace function public.my_appearances()
returns table (appearance text, claimed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'default'::text, null::timestamptz
  union all
  select c.appearance, c.claimed_at
    from public.appearance_claims c
   where c.user_id = auth.uid()
$$;

grant execute on function public.my_appearances() to authenticated;

/*
 * ------------------------------------------------------------------
 * 5. The guard, with one more column nobody may set directly.
 * ------------------------------------------------------------------
 *
 * Written out from 0259 rather than patched blind, every trusted flag still
 * here. 0215 lost one doing exactly this and suspensions stopped working
 * for four weeks with no error anywhere.
 *
 * `appearance` is pinned because `claim_appearance` is what checks the
 * date. Without the pin, anybody could wear christmas in March by writing
 * their own row, and the claim would be decoration.
 */
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if auth.uid() is null then return new; end if;

  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.standing', true) = 'on' then
    return new;
  end if;

  -- `set_primary_community` raised this, having checked that the person is
  -- actually in the Community. Without it, that function is a privileged
  -- write undone by a guard whose subject is identity.
  if current_setting('kobbleston.community', true) = 'on' then
    return new;
  end if;

  -- `claim_appearance` and `set_appearance`, same reason: they have checked
  -- the date and the claim, and this is how they say so.
  if current_setting('kobbleston.appearance', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then return new; end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;

  new.suspended_until := old.suspended_until;

  -- Money. It moves through move_pixels, which writes a ledger row beside
  -- every change; a direct write would move the balance and leave no trace.
  new.pixels := old.pixels;

  -- Identity the site assigns rather than the person.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  -- Whether there is an address behind this account, and whether the site
  -- is still waiting for a password.
  new.has_email         := old.has_email;
  new.must_set_password := old.must_set_password;

  -- Theirs to pick, through the function that checks they are in it.
  new.primary_community := old.primary_community;

  -- Theirs to pick, through the function that checks they claimed it.
  new.appearance := old.appearance;

  return new;
end;
$$;

/*
 * ------------------------------------------------------------------
 * 6. Kobblon has them all.
 * ------------------------------------------------------------------
 *
 * Staw: "make that the kobblon account actually got em all so i can do
 * testing". The house account is given every claim outright, dated now,
 * and that is the one account this is done for - everybody else goes
 * through the window like anybody else.
 */
insert into public.appearance_claims (user_id, appearance)
select public.kobbleston_account(), a
  from unnest(public.appearances()) as a
 where a <> 'default'
   and public.kobbleston_account() is not null
on conflict (user_id, appearance) do nothing;

commit;
