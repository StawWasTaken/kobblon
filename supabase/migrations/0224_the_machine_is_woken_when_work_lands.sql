begin;

/*
 * Waking the worker the moment something lands, instead of waiting.
 *
 * Staw: "are we sure that everytime theres a new thing (if the modifier is
 * toggled) the AI will answer immediately? cuz thats what i want".
 *
 * It was not. Nothing in this database has ever called the worker. There
 * were two ways in and both are clocks: the button in the console, and a
 * GitHub schedule that does not keep time on a quiet repository - runs have
 * landed five hours apart. "Immediately" needs the database itself to knock
 * on the door when a row appears, and that is what this is.
 *
 * How it works, and the parts worth arguing with:
 *
 *   * `pg_net` posts to the edge function and does not wait for an answer.
 *     An insert that waits on an HTTP call is an insert that fails when the
 *     function is slow, so nothing here blocks and nothing here can fail
 *     the write that triggered it.
 *   * **The extension may not be there**, and this migration must apply
 *     either way - it is tested against a plain Postgres with no `pg_net`
 *     in it. So the call is looked up by name at the moment of use and
 *     skipped if it is absent. That is the shape this project keeps getting
 *     wrong in reverse: a value read once at install time, when the thing
 *     that decides it arrives later.
 *   * **A debounce**, because a hundred rows landing in a minute is one
 *     piece of work, not a hundred. Twenty seconds between knocks, kept on
 *     the row rather than in memory, so it holds across connections.
 *   * **The mode is honoured.** 'always' knocks. 'busy' knocks only once
 *     there is more waiting than its threshold. 'slow' never knocks, which
 *     is the whole point of 'slow' - it is the setting that says wait.
 *
 * On the key this needs. The worker refuses anybody who is not an admin or
 * the service role, so a knock has to carry the service key, and that means
 * the key sits in a table in this database. It is reachable by nothing:
 * `ai_poke` has row level security on and **no grants to any role**, so
 * `authenticated`, `anon` and `service_role` alike get "permission denied"
 * reading it. Only the definer functions below touch it.
 *
 * And it is deliberately not settable from the console. Typing a
 * service-role key into a web page sends it through a browser, and that is
 * the one place this project has said it will never go. The superadmin
 * pastes one statement into the Supabase SQL editor; the console only ever
 * says whether it is set and when the last knock went out.
 */

create table if not exists public.ai_poke (
  id boolean primary key default true check (id),
  /* The function's address: https://<ref>.supabase.co/functions/v1/moderate */
  url text,
  /* The service-role key. Never read back by anything but the function below. */
  key text,
  /* When the last knock went out, for the debounce and for the console. */
  last_at timestamptz
);

insert into public.ai_poke (id) values (true) on conflict (id) do nothing;

alter table public.ai_poke enable row level security;

/*
 * No grants, and that is the security.
 *
 * Said out loud because this project has twice shipped a table with a
 * careful policy and no grant and called it protected. Here the absence is
 * the intent: there is no policy either, and nothing but the owner and the
 * `security definer` functions below may read a single column.
 */
revoke all on public.ai_poke from public, authenticated, anon, service_role;

-- ------------------------------------------------------------- the knock

/**
 * Knock on the worker's door, if there is a door and anything to say.
 *
 * Returns true when a request was actually queued, which is what the
 * console's check reports. Everything that stops it short returns false
 * rather than raising: this is called from triggers, and a knock that
 * cannot go out must never take somebody's upload down with it.
 */
create or replace function public.poke_the_worker()
returns boolean
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  door public.ai_poke;
  waiting integer;
  post regprocedure;
begin
  select * into rules from public.ai_settings where id;
  if not found or not rules.is_on then return false; end if;

  -- 'slow' is the setting that says wait, so it is not woken.
  if rules.mode = 'slow' then return false; end if;

  select * into door from public.ai_poke where id;
  if door.url is null or door.key is null then return false; end if;

  if door.last_at is not null and door.last_at > now() - interval '20 seconds' then
    return false;
  end if;

  if rules.mode = 'busy' then
    select
      (select count(*) from public.avatar_items where status = 'pending')
      + (select count(*) from public.assets where status = 'pending')
      + (select count(*) from public.reports where status = 'open')
      + (select count(*) from public.support_tickets
          where status = 'open' and not wants_human)
      + (select count(*) from public.appeals where status = 'open')
      + (select count(*) from public.chat_to_read where read_at is null)
     into waiting;
    if waiting <= rules.when_over then return false; end if;
  end if;

  -- Looked up now, not when this file was applied: the extension can be
  -- turned on after this, and a plain Postgres has never heard of it.
  post := to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)');
  if post is null then return false; end if;

  update public.ai_poke set last_at = now() where id;

  execute format(
    'select %s($1, $2, $3, $4, $5)', post::regproc::text
  ) using
    door.url,
    '{}'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || door.key
    ),
    5000;

  return true;
end $$;

revoke all on function public.poke_the_worker() from public;
grant execute on function public.poke_the_worker() to authenticated, service_role;

-- ------------------------------------------------------- what the triggers do

/**
 * The trigger side of it.
 *
 * Wrapped in its own exception block on purpose. A knock is housekeeping;
 * an upload, a report and an appeal are somebody's day. If the knock throws
 * for any reason at all, the row still lands and the clock picks the work
 * up as it always did.
 */
create or replace function public.poke_on_new_work()
returns trigger
language plpgsql security definer
set search_path = public, extensions as $$
begin
  begin
    perform public.poke_the_worker();
  exception when others then
    null;
  end;
  return null;
end $$;

drop trigger if exists poke_on_new_avatar_item on public.avatar_items;
create trigger poke_on_new_avatar_item
  after insert on public.avatar_items
  for each row when (new.status = 'pending')
  execute function public.poke_on_new_work();

drop trigger if exists poke_on_new_asset on public.assets;
create trigger poke_on_new_asset
  after insert on public.assets
  for each row when (new.status = 'pending')
  execute function public.poke_on_new_work();

drop trigger if exists poke_on_new_report on public.reports;
create trigger poke_on_new_report
  after insert on public.reports
  for each row when (new.status = 'open')
  execute function public.poke_on_new_work();

drop trigger if exists poke_on_new_ticket on public.support_tickets;
create trigger poke_on_new_ticket
  after insert on public.support_tickets
  for each row when (new.status = 'open' and not new.wants_human)
  execute function public.poke_on_new_work();

drop trigger if exists poke_on_new_appeal on public.appeals;
create trigger poke_on_new_appeal
  after insert on public.appeals
  for each row when (new.status = 'open')
  execute function public.poke_on_new_work();

drop trigger if exists poke_on_new_line on public.chat_to_read;
create trigger poke_on_new_line
  after insert on public.chat_to_read
  for each row when (new.read_at is null)
  execute function public.poke_on_new_work();

-- ------------------------------------------------- what the console may see

/**
 * Whether the door is wired, and when it was last knocked on.
 *
 * Never the url and never the key. A console that can show a secret is a
 * console that has put the secret in a browser.
 */
create or replace function public.poke_state()
returns table (wired boolean, net_ready boolean, last_at timestamptz)
language sql stable security definer
set search_path = public, extensions as $$
  select
    (p.url is not null and p.key is not null),
    to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null,
    p.last_at
    from public.ai_poke p
   where public.is_moderator() or public.is_the_worker()
$$;

grant execute on function public.poke_state() to authenticated, service_role;

commit;
