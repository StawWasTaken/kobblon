begin;

/*
 * One picture of a person, everywhere that person appears.
 *
 * Staw: "i want the same PFP to be used everywhere you see your pfp or
 * someones PFP, i dont want to have to retake the pfp everytime and
 * differently, it must be taken once then used everywhere, unless the user
 * changes their avatar then we gotta retake it, cuz on some other pfp areas
 * we use the old versions and some ppl get bald because of that issue".
 *
 * The website already has the rule: a stored portrait is named
 * `portrait-<when>.webp`, `profiles.avatar_changed_at` says when the avatar
 * last changed, and anything older than that is of who somebody used to be
 * and is redrawn instead of shown. `useHeadshot` applies it.
 *
 * It can only apply it when it knows **whose face it is**. Three readers
 * hand over an avatar address with no id beside it:
 *
 *   * `recent_activity` - the feed on the front page
 *   * `community_audit_log` - who did what in a Community
 *   * `forum_boards` - the latest poster beside each board
 *
 * So those three faces were taken on trust, and a picture saved before
 * somebody put their hair on is exactly the bald one he is describing. The
 * id is the whole fix: with it the page asks when that avatar changed and
 * draws the current face, the same drawing every other place on the site
 * is showing.
 *
 * Each is dropped before being created: a `returns table` cannot gain a
 * column in place.
 */

-- ------------------------------------------------------- the activity feed

drop function if exists public.recent_activity(int);

create function public.recent_activity(limit_count int default 12)
returns table (
  id bigint,
  kind text,
  created_at timestamptz,
  /* Whose face this is. Everything else here is unchanged. */
  actor_id uuid,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text,
  space_id uuid,
  space_name text,
  space_slug text
)
language sql stable security definer set search_path = public, extensions as $$
  select e.id, e.kind, e.created_at,
         p.id, p.username, p.display_name, p.avatar_url,
         s.id, s.name, s.slug
    from public.activity_events e
    join public.profiles p on p.id = e.actor_id and not p.is_suspended and not p.is_guest
    left join public.spaces s on s.id = e.space_id
   where (e.space_id is null or (s.is_published and not s.is_removed))
   order by e.created_at desc
   limit least(greatest(limit_count, 1), 50);
$$;

grant execute on function public.recent_activity(int) to anon, authenticated;

-- ---------------------------------------------------- a Community's log

drop function if exists public.community_audit_log(uuid, int);

create function public.community_audit_log(community uuid, limit_count int default 50)
returns table (
  id bigint,
  action text,
  detail text,
  created_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_display_name text,
  actor_avatar_url text
)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, a.action, a.detail, a.created_at,
         p.id, p.username, p.display_name, p.avatar_url
    from public.community_audit a
    left join public.profiles p on p.id = a.actor_id
   where a.community_id = community
     and public.community_can(community, 'can_manage_members')
   order by a.created_at desc
   limit least(greatest(limit_count, 1), 200);
$$;

grant execute on function public.community_audit_log(uuid, int) to anon, authenticated;

-- ------------------------------------------- the forum's list of boards

drop function if exists public.forum_boards();

create function public.forum_boards()
returns table (
  slug text, name text, blurb text, kind text, staff_only boolean,
  topic_count integer, post_count integer, last_post_at timestamptz,
  last_title text, last_topic_id bigint,
  last_author text, last_author_avatar text, last_author_username text,
  last_author_id uuid
)
language sql stable security definer
set search_path = public, extensions as $$
  select c.slug, c.name, c.blurb, c.kind, c.staff_only,
         coalesce(n.topics, 0)::integer,
         coalesce(n.posts, 0)::integer,
         n.last_at, n.last_title, n.last_id,
         n.last_author, n.last_avatar, n.last_username, n.last_author_id
    from public.forum_categories c
    left join lateral (
      select count(*)::integer as topics,
             (coalesce(sum(t.reply_count), 0) + count(*))::integer as posts,
             max(t.last_post_at) as last_at,
             (array_agg(t.title order by t.last_post_at desc))[1] as last_title,
             (array_agg(t.id order by t.last_post_at desc))[1] as last_id,
             (array_agg(coalesce(p.display_name, p.username) order by t.last_post_at desc))[1] as last_author,
             (array_agg(p.avatar_url order by t.last_post_at desc))[1] as last_avatar,
             (array_agg(p.username order by t.last_post_at desc))[1] as last_username,
             (array_agg(p.id order by t.last_post_at desc))[1] as last_author_id
        from public.forum_topics t
        join public.profiles p on p.id = t.author_id
       where t.category = c.slug and not t.is_removed
    ) n on true
   where not c.is_hidden
   order by c.position, c.name;
$$;

grant execute on function public.forum_boards to anon, authenticated;

commit;
