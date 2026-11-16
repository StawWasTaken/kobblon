begin;

/*
 * A World says who made it by handle, not by display name.
 *
 * Staw: all creations should say "by [username] [badges]". A display name
 * is a label somebody can change twice a day and two people can share; the
 * handle is the one that is theirs, is unique, and is what you would type
 * to find them. Catalog items have carried `creator_username` since 0102
 * and Worlds never did, so this is the column that was missing.
 *
 * It is denormalised, like `creator_name` beside it, because a shelf of
 * Worlds would otherwise be a join per card - and kept in step by trigger
 * rather than by whoever remembers, because the first copy of it already
 * went stale: `create_world` wrote `creator_name` once at creation and
 * nothing ever updated it, so a World published before a rename still
 * credits a name nobody has.
 */

alter table public.worlds add column if not exists creator_username text;

comment on column public.worlds.creator_username is
  'The owner''s handle, kept in step by trigger. What a card credits.';

/**
 * Both copies of who made it, read from the owner.
 *
 * One function, called from two triggers: when a World arrives or changes
 * hands, and when the person changes their handle. The alternative is
 * every writer of `public.worlds` remembering two columns, which is the
 * thing that already failed once.
 */
create or replace function public.world_credits_its_owner()
returns trigger language plpgsql
security definer set search_path = public, extensions as $$
begin
  select p.display_name, p.username
    into new.creator_name, new.creator_username
    from public.profiles p where p.id = new.owner_id;

  /* A World made before its owner had a profile row keeps whatever it
     came in with rather than losing the name it had. */
  if new.creator_username is null then
    new.creator_name := coalesce(new.creator_name, old.creator_name);
  end if;
  return new;
end;
$$;

drop trigger if exists worlds_credit_owner on public.worlds;
create trigger worlds_credit_owner
  before insert or update of owner_id on public.worlds
  for each row execute function public.world_credits_its_owner();

/**
 * A rename reaches everything they have published.
 *
 * `of username, display_name`, so an ordinary profile write - a bio, a
 * colour, the presence ping every minute - does not touch the Worlds
 * table.
 */
create or replace function public.rename_reaches_worlds()
returns trigger language plpgsql
security definer set search_path = public, extensions as $$
begin
  update public.worlds
     set creator_username = new.username,
         creator_name = new.display_name
   where owner_id = new.id
     and (creator_username is distinct from new.username
          or creator_name is distinct from new.display_name);
  return null;
end;
$$;

drop trigger if exists profiles_rename_reaches_worlds on public.profiles;
create trigger profiles_rename_reaches_worlds
  after update of username, display_name on public.profiles
  for each row execute function public.rename_reaches_worlds();

/* Everything already published, including the ones whose credited name
   went stale at a rename. */
update public.worlds w
   set creator_username = p.username,
       creator_name = p.display_name
  from public.profiles p
 where p.id = w.owner_id
   and (w.creator_username is distinct from p.username
        or w.creator_name is distinct from p.display_name);

commit;
