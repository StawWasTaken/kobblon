-- Announcements grow up: a title, a picture or a video, and the ability to
-- fix a mistake after posting. The wall stays what it is, a wall.

alter table public.community_posts add column if not exists title text
  check (title is null or char_length(title) between 1 and 80);
alter table public.community_posts add column if not exists media_url text;
alter table public.community_posts add column if not exists media_kind text
  check (media_kind is null or media_kind in ('image', 'video'));
alter table public.community_posts add column if not exists edited_at timestamptz;

-- A longer body for an announcement than for a line on the wall.
alter table public.community_posts drop constraint if exists community_posts_body_check;
alter table public.community_posts add constraint community_posts_body_check
  check (char_length(body) between 1 and 4000);

/*
 * Editing. The author may fix their own post; anyone who can manage the
 * Community may fix an announcement, because an announcement speaks for the
 * Community rather than for the person who typed it.
 */
drop policy if exists community_posts_edit on public.community_posts;
create policy community_posts_edit on public.community_posts for update
  using (
    author_id = auth.uid()
    or (is_announcement and public.community_can(community_id, 'can_manage_community'))
  )
  with check (
    author_id = auth.uid()
    or (is_announcement and public.community_can(community_id, 'can_manage_community'))
  );

-- An edit is stamped rather than hidden, and what a post is cannot change
-- underneath people: a wall post does not become an announcement by editing.
create or replace function public.stamp_post_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare verdict public.screen_decision;
begin
  new.author_id := old.author_id;
  new.community_id := old.community_id;
  new.is_announcement := old.is_announcement;
  new.created_at := old.created_at;

  if new.body is distinct from old.body or new.title is distinct from old.title then
    verdict := (public.screen_text(
      coalesce(new.title, '') || ' ' || coalesce(new.body, ''))).decision;
    if verdict = 'block' then
      raise exception 'That is not allowed here.';
    end if;
    new.edited_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_post_edit on public.community_posts;
create trigger stamp_post_edit before update on public.community_posts
  for each row execute function public.stamp_post_edit();

/*
 * The wall and the announcements are two different lists, so they are asked
 * for separately rather than sorted apart afterwards. Both are newest first.
 */
drop function if exists public.community_posts_list(uuid, boolean, integer);
create function public.community_posts_list(
  target uuid, announcements boolean default false, limit_count integer default 50
)
returns table (
  id bigint,
  community_id uuid,
  author_id uuid,
  title text,
  body text,
  media_url text,
  media_kind text,
  is_announcement boolean,
  created_at timestamptz,
  edited_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  author_is_guest boolean,
  author_is_verified boolean,
  author_content_id bigint,
  author_rank text,
  i_can_remove boolean
)
language sql stable security definer set search_path = public as $$
  select p.id, p.community_id, p.author_id, p.title, p.body, p.media_url, p.media_kind,
         p.is_announcement, p.created_at, p.edited_at,
         a.username, a.display_name, a.avatar_url, a.is_guest,
         a.is_verified or a.is_admin, a.content_id,
         r.name,
         p.author_id = auth.uid()
           or public.community_can(p.community_id, 'can_moderate_wall')
           or (p.is_announcement and public.community_can(p.community_id, 'can_manage_community'))
    from public.community_posts p
    join public.profiles a on a.id = p.author_id
    left join public.community_members m
      on m.community_id = p.community_id and m.user_id = p.author_id
    left join public.community_ranks r on r.id = m.rank_id
   where p.community_id = target
     and not p.is_removed
     and p.is_announcement = announcements
   -- id breaks a tie, so two posts made in the same second still come back
   -- newest first rather than in whatever order the planner fancies.
   order by p.created_at desc, p.id desc
   limit least(greatest(limit_count, 1), 100);
$$;

grant execute on function public.community_posts_list to anon, authenticated;
