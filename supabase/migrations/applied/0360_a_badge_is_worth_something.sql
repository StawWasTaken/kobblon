begin;

/*
 * The score.
 *
 * Worlds have been able to define badges since 0166 and nobody could ever
 * earn one: there was a table of badges, a table of passes, holders for the
 * passes, and no awards. A badge nobody can hold is a shelf with nothing on
 * it, and it is why Staw's note said badges "add up to nothing".
 *
 * Two things here. Awards for World badges, mirroring exactly what Spaces
 * have had since 0008 - only the owner may award, only through the
 * function, so the count and the awards cannot disagree. And one number
 * made of both kinds, which is the thing a profile is worth coming back to.
 */

create table if not exists public.world_badge_awards (
  badge_id uuid not null references public.world_badges on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (badge_id, user_id)
);

create index if not exists world_badge_awards_user_idx
  on public.world_badge_awards (user_id, awarded_at desc);

/* Grants with the table, as ever. Read by anybody - a badge is worn in
   public. Written by nothing but the function below. */
alter table public.world_badge_awards enable row level security;
grant select on public.world_badge_awards to anon, authenticated;

drop policy if exists world_badge_awards_read on public.world_badge_awards;
create policy world_badge_awards_read on public.world_badge_awards
  for select using (true);

/*
 * Two grants that were never written, found on the way past.
 *
 * `space_badges` and `badge_awards` have had row-level security and a
 * policy saying "anybody may read this" since 0008, and no grant of their
 * own. Supabase's own bootstrap grants the public schema to `anon` and
 * `authenticated`, so whether they have been reachable on the live
 * database depends on that rather than on anything in this repository -
 * which is the part worth not relying on. These say it here, where the
 * policies are, and they are a no-op where the bootstrap already said it.
 */
grant select on public.space_badges to anon, authenticated;
grant select on public.badge_awards to anon, authenticated;

/**
 * What one badge is worth.
 *
 * Flat, and in one place, so that the day it stops being flat there is one
 * thing to change. Ten, because a round number people can add up in their
 * head is the point of a score.
 */
create or replace function public.badge_points()
returns integer language sql immutable as $$ select 10 $$;

/**
 * Hand a World's badge to somebody.
 *
 * The World's owner only, which is who the Workspace is signed in as. The
 * awarded count moves with the award because both happen here.
 */
create or replace function public.award_world_badge(badge uuid, recipient uuid)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  owner uuid;
  fresh boolean;
begin
  select w.owner_id into owner
    from public.world_badges b
    join public.worlds w on w.id = b.world_id
   where b.id = badge and b.is_enabled;

  if owner is null then raise exception 'No such badge.'; end if;
  if owner is distinct from auth.uid() then
    raise exception 'Only the owner of this World can award its badges.';
  end if;

  insert into public.world_badge_awards (badge_id, user_id)
  values (badge, recipient)
  on conflict do nothing;

  get diagnostics fresh = row_count;
  if fresh then
    update public.world_badges set awarded_count = awarded_count + 1 where id = badge;
    insert into public.notifications (user_id, kind, actor_id, body)
    select recipient, 'system', owner, 'You earned a badge: ' || b.name
      from public.world_badges b where b.id = badge;
  end if;

  return fresh;
end;
$$;

/**
 * Somebody's score: every badge they hold, of either kind, times what a
 * badge is worth.
 *
 * Badges from Worlds that were taken down still count. They earned it, and
 * a number that drops because somebody else unpublished something is a
 * number nobody trusts.
 */
create or replace function public.player_score(target uuid)
returns integer
language sql stable security definer set search_path = public, extensions as $$
  select (public.badge_points() * (
    (select count(*) from public.badge_awards where user_id = target)
    + (select count(*) from public.world_badge_awards where user_id = target)
  ))::integer;
$$;

/** The World badges somebody holds, newest first. */
create or replace function public.earned_world_badges(target uuid, limit_count int default 24)
returns table (
  id uuid,
  name text,
  description text,
  icon_url text,
  awarded_at timestamptz,
  world_name text,
  world_slug text,
  world_content_id bigint,
  world_creator text
)
language sql stable security definer set search_path = public, extensions as $$
  select b.id, b.name, b.description, b.icon_url, a.awarded_at,
         w.name, w.slug, w.content_id, w.creator_username
    from public.world_badge_awards a
    join public.world_badges b on b.id = a.badge_id
    join public.worlds w on w.id = b.world_id
   where a.user_id = target
   order by a.awarded_at desc
   limit least(greatest(limit_count, 1), 60);
$$;

/** Which of a World's badges you hold, for the World's own page. */
create or replace function public.my_world_badges(wanted uuid)
returns table (badge_id uuid)
language sql stable security definer set search_path = public, extensions as $$
  select a.badge_id
    from public.world_badge_awards a
    join public.world_badges b on b.id = a.badge_id
   where b.world_id = wanted and a.user_id = auth.uid();
$$;

grant execute on function public.badge_points() to anon, authenticated;
grant execute on function public.award_world_badge(uuid, uuid) to authenticated;
grant execute on function public.player_score(uuid) to anon, authenticated;
grant execute on function public.earned_world_badges(uuid, int) to anon, authenticated;
grant execute on function public.my_world_badges(uuid) to authenticated;

commit;
