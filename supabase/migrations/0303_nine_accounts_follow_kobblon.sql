begin;

/*
 * Nine accounts follow Kobblon.
 *
 * Staw handed over nine profile links and asked that each of them follow
 * the kobblon account. They are the people who were around first, and the
 * platform account having nobody behind it reads as nobody being here.
 *
 * Matched on the number in the link - `profiles.content_id`, the 1397 in
 * /u/1397/Eggz - rather than on the name, because a username is a thing
 * somebody can change and a number is not. The name is carried along
 * anyway and checked against the row: if the two disagree the file stops
 * rather than following somebody else's account on their behalf, which is
 * not a mistake anybody would notice afterwards.
 *
 * Nothing is undone here. A follow is a thing a person owns, and anybody
 * on this list can unfollow from the profile page the moment they want to.
 *
 * Applying it twice is a no-op: the primary key is the pair, and the
 * insert passes over what is already there.
 */

set search_path = public, extensions;

do $$
declare
  kobblon uuid;
  wanted  record;
  who     record;
  made    integer := 0;
begin
  select id into kobblon
    from public.profiles
   where lower(username) = 'kobblon'
   limit 1;

  if kobblon is null then
    raise exception 'There is no account called kobblon to follow.';
  end if;

  for wanted in
    select * from (values
      (1397, 'Eggz'),
      (1396, 'Bab_Vytnr'),
      (1394, 'NaTtY'),
      (1378, 'singhplayz777'),
      (1416, 'kai'),
      (1181, 'Foolish'),
      (1313, 'Ryko'),
      (1326, 'imCooki3'),
      (1401, 'LeonThive_New')
    ) as t (number, name)
  loop
    select id, username into who
      from public.profiles
     where content_id = wanted.number
     limit 1;

    if who.id is null then
      raise exception 'There is no account numbered % (%).', wanted.number, wanted.name;
    end if;

    if lower(who.username) <> lower(wanted.name) then
      raise exception 'Account % is called %, not %. Nothing was changed.',
        wanted.number, who.username, wanted.name;
    end if;

    if who.id = kobblon then
      continue;  -- an account cannot follow itself, and the table says so
    end if;

    insert into public.follows (follower_id, following_id)
    values (who.id, kobblon)
    on conflict do nothing;

    made := made + 1;
  end loop;

  raise notice '% of nine were looked at; kobblon now has % followers.',
    made,
    (select count(*) from public.follows where following_id = kobblon);
end;
$$;

commit;
