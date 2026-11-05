begin;

/*
 * The board, and a superadmin who is not told what kind of quest to write.
 *
 * Two things, both small, both asked for by name.
 *
 * `add_quest` refused `world_time` outright - "a quest about time in a
 * World is requested against that World" - which is the right rule for a
 * creator asking for one about their own World and the wrong rule for Staw,
 * who owns the board. A superadmin writes any kind of quest about any
 * World. The function takes the World now, and keeps the refusal for the
 * one case that is actually impossible: counting time in a World without
 * naming one.
 *
 * And the board says who is promoting a quest and whether that name carries
 * the tick, because the card Staw drew leads with it.
 */

/*
 * Arguments change rather than widen, so the old one goes: a ninth
 * parameter with a default would leave every eight-argument call
 * ambiguous against the signature it already matches.
 */
drop function if exists public.add_quest(
  text, text, integer, integer, text, text, text, timestamptz);

create or replace function public.add_quest(
  title text, counted text, goal integer, reward integer,
  lead text default null, tag text default null,
  background text default null, until timestamptz default null,
  world uuid default null
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  made uuid;
  about public.worlds%rowtype;
begin
  perform public.require_superadmin();

  if world is not null then
    select * into about from public.worlds where id = world;
    if about.id is null then raise exception 'No such World.'; end if;
  end if;

  if counted = 'world_time' and world is null then
    raise exception 'A quest about time in a World has to name the World.';
  end if;

  insert into public.quests (
    counted, title, lead, goal, reward,
    world_id, world_tag, custom_tag, custom_tag_approved, background_url,
    author_id, status, ends_at, decided_by, decided_at
  ) values (
    counted, btrim(title), nullif(btrim(lead), ''), goal, reward,
    world, coalesce(about.name, 'Kobblon'),
    nullif(btrim(tag), ''), tag is not null, nullif(btrim(background), ''),
    auth.uid(), 'live', until, auth.uid(), clock_timestamp()
  ) returning id into made;

  return made;
end;
$$;

grant execute on function public.add_quest(
  text, text, integer, integer, text, text, text, timestamptz, uuid
) to authenticated;

/*
 * The board, with the promoter on it.
 *
 * Who is promoting a quest is the World's creator where there is a World
 * and the author otherwise, which is Kobblon itself for the ones Staw
 * writes. The tick comes with the name, because a name with nothing beside
 * it on a card that elsewhere shows one reads as "not verified".
 *
 * The return type widens, so the old one is dropped first.
 */
drop function if exists public.quest_board();

create or replace function public.quest_board()
returns table (
  id uuid, counted text, title text, lead text,
  goal integer, reward integer,
  world_tag text, custom_tag text, background_url text,
  world_id uuid, world_content_id bigint, world_slug text, world_name text, world_emblem text,
  author_name text, ends_at timestamptz,
  done integer, started timestamptz, claimed_at timestamptz,
  author_verified boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select q.id, q.counted, q.title, q.lead,
         q.goal, q.reward,
         q.world_tag,
         case when q.custom_tag_approved then q.custom_tag end,
         coalesce(q.background_url, w.cover_url),
         q.world_id, w.content_id, w.slug, w.name, coalesce(w.emblem_url, w.cover_url),
         coalesce(c.display_name, a.display_name),
         q.ends_at,
         public.quest_done(q.id),
         p.started_at, p.claimed_at,
         coalesce(c.is_verified, a.is_verified, false)
    from public.quests q
    left join public.worlds w on w.id = q.world_id
    left join public.profiles c on c.id = w.owner_id
    left join public.profiles a on a.id = q.author_id
    left join public.quest_progress p
           on p.quest_id = q.id and p.user_id = auth.uid()
   where q.status = 'live'
     and q.starts_at <= now()
     and (q.ends_at is null or q.ends_at > now())
     and (q.world_id is null or (w.is_published and not w.is_removed and w.archived_at is null))
   order by (p.claimed_at is not null), q.created_at desc;
$$;

grant execute on function public.quest_board() to authenticated;

commit;
