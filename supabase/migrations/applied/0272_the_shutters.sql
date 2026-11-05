begin;

/*
 * The shutters.
 *
 * One switch that puts the whole website behind a maintenance screen, and
 * two ranks that can still walk past it: admin and superadmin. A moderator
 * is kept out with everybody else - Staw, asked directly: "mods are still
 * affected tho". The people who can turn it off are the people it does not
 * apply to, which is the only arrangement that cannot lock the house.
 *
 * What this is and is not, said plainly because it will be read later by
 * somebody deciding whether to lean on it:
 *
 *   It is a curtain, not a lock. The website stops drawing itself and shows
 *   the notice instead. Every table and every function carries on exactly as
 *   before, and anybody holding an access token can still reach the API
 *   while this is on. Maintenance is for "do not use the site while I move
 *   something", not for "nobody may touch the data". If a window ever needs
 *   the second thing, it is `revoke` on the tables in question and nothing
 *   less, and it is a different migration written for the one occasion.
 *
 * One row, for ever. `only_row` is a boolean that may only be true and is
 * the primary key, so a second row cannot be inserted - there is exactly one
 * state of the site and no way to end up with two disagreeing about it.
 */
create table if not exists public.site_state (
  only_row boolean primary key default true check (only_row),
  maintenance boolean not null default false,
  /* Shown on the notice. Null falls back to the words the page carries. */
  note text check (note is null or char_length(note) <= 300),
  /* Who last touched the switch, and when. The record matters more here
     than almost anywhere else on the platform: this one takes the site
     down for everybody. */
  set_by uuid references public.profiles on delete set null,
  set_at timestamptz not null default now()
);

insert into public.site_state (only_row) values (true) on conflict do nothing;

alter table public.site_state enable row level security;

/*
 * The grants, in the same file as the table, which this project has now
 * forgotten twice: a policy says which rows a role may see and a grant says
 * whether the role may touch the table at all. A new table has no grants,
 * so a carefully written policy over one is a door nobody can reach.
 *
 * Select only, and to everybody including the signed out, because the first
 * thing the website does is ask whether the shutters are down - before
 * anybody has signed in. Nobody gets insert, update or delete: the switch is
 * thrown through the function below or not at all.
 */
grant select on public.site_state to anon, authenticated;

drop policy if exists site_state_everybody_reads on public.site_state;
create policy site_state_everybody_reads on public.site_state
  for select using (true);

/**
 * Throw the switch.
 *
 * `security definer` because nobody has write on the table. The rank is
 * checked inside, against `my_staff_rank()` rather than against
 * `is_admin()`, because `is_admin()` answers yes for a superadmin and
 * nothing else needs to be true here: the two ranks are named.
 *
 * It returns the row it wrote, so the console shows what is actually stored
 * rather than what it hoped it had sent.
 */
create or replace function public.set_maintenance(shut boolean, words text default null)
returns public.site_state
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rank text := public.my_staff_rank();
  answer public.site_state;
begin
  if rank not in ('admin', 'superadmin') then
    raise exception 'Only an admin can put the site into maintenance.';
  end if;

  if words is not null and char_length(words) > 300 then
    raise exception 'That notice is too long.';
  end if;

  update public.site_state
     set maintenance = shut,
         note = nullif(btrim(coalesce(words, '')), ''),
         set_by = auth.uid(),
         set_at = now()
   where only_row
  returning * into answer;

  return answer;
end;
$$;

revoke all on function public.set_maintenance(boolean, text) from public;
grant execute on function public.set_maintenance(boolean, text) to authenticated;

commit;
