begin;

/*
 * A party of one is not a party.
 *
 * Staw: "make that if theres only one person left in a party then you
 * automatically leave it in 5 minutes (you can stay in a group chat
 * indefinitely alone tho)".
 *
 * The difference is right: a group chat is a room with a history in it, and
 * sitting in one alone is a thing people do. A party is an intention to go
 * somewhere together, and one person holding one for a week is a Play
 * button pointed at nobody.
 *
 * There is no scheduler here, so this does not wait for one. The party
 * records the moment it became lonely, and the next time anybody asks for
 * their party - which is every client that has one, on every party
 * change - the lonely ones that are out of time are swept. Self-healing on
 * read: the party is gone the next time anybody looks, and it was already
 * gone in every sense that matters before that.
 */

alter table public.parties
  add column if not exists alone_since timestamptz;

create index if not exists parties_lonely_idx
  on public.parties (alone_since) where alone_since is not null;

/** How long one person may hold a party open. */
create or replace function public.party_alone_for()
returns interval language sql immutable as $$ select interval '5 minutes' $$;

/**
 * The clock starts when the second-to-last person leaves, and stops the
 * moment somebody arrives.
 *
 * On the table rather than in `leave_party` and `remove_from_party`,
 * because those are two of the four places membership moves and a fifth
 * would be a fifth place to forget.
 */
create or replace function public.a_party_counts_itself()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  party uuid := coalesce(new.party_id, old.party_id);
  how_many integer;
begin
  select count(*) into how_many from public.party_members where party_id = party;

  if how_many = 1 then
    update public.parties
       set alone_since = coalesce(alone_since, now())
     where id = party;
  else
    update public.parties
       set alone_since = null
     where id = party and alone_since is not null;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists party_counts_itself_in on public.party_members;
create trigger party_counts_itself_in
  after insert on public.party_members
  for each row execute function public.a_party_counts_itself();

drop trigger if exists party_counts_itself_out on public.party_members;
create trigger party_counts_itself_out
  after delete on public.party_members
  for each row execute function public.a_party_counts_itself();

/**
 * Let go of the ones that are out of time.
 *
 * Deleting the party takes its members, its invites and its chat with it -
 * the chat because `conversations.party_id` cascades, which is what 0363
 * set up.
 */
create or replace function public.sweep_lonely_parties()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  gone integer;
begin
  delete from public.parties
   where alone_since is not null
     and alone_since < now() - public.party_alone_for();
  get diagnostics gone = row_count;
  return gone;
end $$;

/**
 * Your party, in one ask - and the sweep, on the way past.
 *
 * It was `stable sql`, which cannot delete. It is volatile now because it
 * does one thing before it answers: anything that has run out of time goes
 * first, so nobody is ever handed a party that should not exist. The shape
 * of what comes back is unchanged.
 */
create or replace function public.my_party()
returns table (
  party_id uuid,
  leader_id uuid,
  world_id uuid,
  world_name text,
  world_content_id bigint,
  server_id uuid,
  going_at timestamptz,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  avatar_changed_at timestamptz,
  is_guest boolean,
  joined_at timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.sweep_lonely_parties();

  return query
  select p.id, p.leader_id, p.world_id, w.name, w.content_id, p.server_id, p.going_at,
         m.user_id, pr.username, pr.display_name, pr.avatar_url, pr.avatar_changed_at,
         pr.is_guest, m.joined_at
    from public.party_members mine
    join public.parties p on p.id = mine.party_id
    join public.party_members m on m.party_id = p.id
    join public.profiles pr on pr.id = m.user_id
    left join public.worlds w on w.id = p.world_id
   where mine.user_id = auth.uid()
   order by m.joined_at;
end $$;

/** When your party gives up, so a client can come back and watch it go. */
create or replace function public.my_party_alone_since()
returns timestamptz
language sql stable security definer set search_path = public, extensions as $$
  select p.alone_since
    from public.party_members m
    join public.parties p on p.id = m.party_id
   where m.user_id = auth.uid();
$$;

/* Parties that were already lonely when this landed have their clock
   started now rather than at some moment nobody recorded. */
update public.parties p
   set alone_since = now()
 where alone_since is null
   and (select count(*) from public.party_members m where m.party_id = p.id) = 1;

grant execute on function public.party_alone_for() to anon, authenticated;
grant execute on function public.sweep_lonely_parties() to authenticated;
grant execute on function public.my_party_alone_since() to authenticated;

commit;
