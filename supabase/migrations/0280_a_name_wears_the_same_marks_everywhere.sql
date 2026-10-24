begin;

-- A name wears the same marks everywhere
-- -----------------------------------------------------------------------
--
-- Staw: "i dont see all of the badges ... sometimes its just the staff
-- badge, sometimes just the verified badge, sometimes NEITHER, so fix that
-- (even in the forums too)".
--
-- All three were true and none of them were a bug in the drawing. The marks
-- were decided by whichever columns a list happened to select: the Catalog
-- had `creator_is_verified` and no staff column reaching the card, so a
-- moderator wore nothing; the forum had three flags and not
-- `has_staff_badge`, so somebody given the k by hand did not wear it; a
-- quest had one boolean for the tick and no way to ask about anything else.
--
-- `name_marks` has been the single answer since 0180 and the website never
-- called it once. It does now, and this adds the one thing it was missing:
-- a way to ask by username, because five large Catalog functions select
-- `creator_username` and not `creator_id`, and rewriting all five to carry
-- an id is a much larger change than this is, with much more to break.
--
-- Also here, because the same batch builds the button that makes it
-- matter: an edited forum post was never read by Kobby. The queue trigger
-- was `after insert` only. Post something clean, edit it to anything - and
-- the edit button is new in this batch, so this is a hole being opened and
-- closed in the same round rather than one being left.

set search_path = public, extensions;

-- ------------------------------------------------ the answer itself, again

/*
 * `name_marks` and the two questions under it, repeated here verbatim from
 * 0180.
 *
 * Not because they changed - they have not - but because this file and 0282
 * both call `name_marks(uuid)` and the live database answered
 * `function public.name_marks(uuid) does not exist`. 0180 never reached it.
 * A migration that assumes an older one landed is a migration that works
 * here and fails there, which is the whole reason these are written to be
 * applied twice and to stand on their own.
 *
 * `create or replace` with the same body is a no-op where 0180 did land, so
 * this costs a database that has them nothing and repairs one that has not.
 * If they are ever genuinely changed, they change in 0180's successor and
 * this copy goes with it - which is why the bodies are identical rather than
 * improved in passing.
 */

create or replace function public.wears_staff_badge(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select coalesce(
    (select has_staff_badge or is_admin or is_moderator or is_superadmin
       from public.profiles where id = who),
    false
  );
$$;

grant execute on function public.wears_staff_badge(uuid) to anon, authenticated;

create or replace function public.is_name_verified(who uuid)
returns boolean
language sql stable
set search_path = public, extensions as $$
  select coalesce(
    (select is_verified or is_admin or is_superadmin
       from public.profiles where id = who),
    false
  );
$$;

grant execute on function public.is_name_verified(uuid) to anon, authenticated;

create or replace function public.name_marks(who uuid)
returns text[]
language sql stable
set search_path = public, extensions as $$
  select array_remove(array[
    case when public.is_name_verified(who) then 'verified' end,
    case when public.wears_staff_badge(who) then 'staff' end
  ], null)
$$;

grant execute on function public.name_marks(uuid) to anon, authenticated;

create or replace function public.name_marks_for(who uuid[])
returns table (id uuid, marks text[])
language sql stable
set search_path = public, extensions as $$
  select p.id, public.name_marks(p.id)
    from public.profiles p
   where p.id = any(who)
     and (public.is_name_verified(p.id) or public.wears_staff_badge(p.id))
$$;

grant execute on function public.name_marks_for(uuid[]) to anon, authenticated;

-- --------------------------------------------------- marks, by username

/**
 * The marks beside a set of names, found by username.
 *
 * The same `name_marks` as `name_marks_for`, keyed differently. Only
 * people who wear something come back; a username absent from the answer
 * wears nothing, which is most people.
 *
 * Case-insensitive on the way in and the real username on the way out, so
 * a caller matching the answer back to its rows matches on what it sent.
 */
create or replace function public.name_marks_by_name(names text[])
returns table (username text, marks text[])
language sql stable
set search_path = public, extensions as $$
  select p.username, public.name_marks(p.id)
    from public.profiles p
   where lower(p.username) = any (select lower(n) from unnest(names) n)
     and (public.is_name_verified(p.id) or public.wears_staff_badge(p.id))
$$;

grant execute on function public.name_marks_by_name(text[]) to anon, authenticated;

-- ------------------------------------------------- a quest says who, by id

/*
 * `quest_board` returned the promoter's display name and one boolean for
 * the tick. A name on this platform wears up to two marks and the board
 * could only ever draw one of them, so it gains the id and the page asks.
 *
 * Dropped and recreated rather than replaced: the return table changes,
 * which `create or replace function` will not do. The body is otherwise
 * 0274's, unchanged.
 */
drop function if exists public.quest_board();

create function public.quest_board()
returns table (
  id uuid,
  counted text,
  title text,
  lead text,
  goal integer,
  reward integer,
  world_tag text,
  custom_tag text,
  background_url text,
  world_id uuid,
  world_content_id bigint,
  world_slug text,
  world_name text,
  world_emblem text,
  author_name text,
  ends_at timestamptz,
  done integer,
  started timestamptz,
  claimed_at timestamptz,
  author_verified boolean,
  created_at timestamptz,
  author_id uuid
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
         coalesce(c.is_verified, a.is_verified, false),
         q.created_at,
         /* Whichever of the two the displayed name came from, so the marks
            and the name are about the same person. */
         coalesce(c.id, a.id)
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

-- ------------------------------------------------ Kobby reads edits too

/*
 * The word censor already ran on update - `before insert or update of
 * body, title`. The machine's queue did not: `after insert` and nothing
 * else. So the automatic read, which is the thing that catches what a word
 * list cannot, was skipped by anybody who posted and then edited.
 *
 * Queued only when the words actually changed. `forum_edit` sets
 * `edited_at` on every call, so an update that changed nothing else would
 * otherwise be a second read of the same text and a second verdict on it.
 */
create or replace function public.queue_the_edit()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  kind text;
  said text;
  before text;
begin
  if tg_table_name = 'forum_topics' then
    kind := 'forum_topic';
    said := new.title || E'\n\n' || new.body;
    before := old.title || E'\n\n' || old.body;
  elsif tg_table_name = 'forum_posts' then
    kind := 'forum_post';
    said := new.body;
    before := old.body;
  else
    return null;
  end if;

  if said is not distinct from before then return null; end if;

  insert into public.chat_to_read (kind, ref, who, body, was_masked)
  values (kind, new.id::text, new.author_id, said, said like '%••••%');

  return null;
end $$;

drop trigger if exists forum_topics_edits_go_to_the_machine on public.forum_topics;
create trigger forum_topics_edits_go_to_the_machine
  after update of body, title on public.forum_topics
  for each row execute function public.queue_the_edit();

drop trigger if exists forum_posts_edits_go_to_the_machine on public.forum_posts;
create trigger forum_posts_edits_go_to_the_machine
  after update of body on public.forum_posts
  for each row execute function public.queue_the_edit();

commit;
