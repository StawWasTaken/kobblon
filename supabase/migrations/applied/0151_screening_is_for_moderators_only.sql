begin;

-- Anybody at all could approve a Marketplace upload.
--
-- Found while putting screening into the staff console, which is the only
-- reason it was found: nothing in the website has ever called
-- `review_asset`, so the hole sat behind a door nobody opened.
--
-- Two mistakes lining up, and neither is visible from the other's side:
--
--   1. **The guard exempts nobody-in-particular.** It reads
--      `if auth.uid() is not null and not is_moderator() then refuse`, so a
--      caller with no identity at all passes it. That was meant for a
--      worker running without a session - the comment in 0006 says as much -
--      and "has no session" is not the same claim as "is our worker".
--   2. **The revoke did not revoke.** 0006 says
--      `revoke execute on function review_asset from anon, authenticated`,
--      and a function is created with `execute` granted to `public`. Taking
--      it away from two roles that are members of `public` leaves the
--      `public` grant standing, and the ACL still reads `=X/postgres`.
--      Both roles could still call it, through the grant nobody revoked.
--
-- What stopped it being a live hole is luck, and is worth writing down
-- rather than leaning on: `guard_asset_update` pins `status`, `review_note`
-- and `reviewed_at` for anybody who is not a moderator, so the write got
-- through the function and was quietly undone by the trigger. That is the
-- third trap in CLAUDE.md working in our favour for once - a privileged
-- write undone by a row guard - and it means the door was open onto a wall.
-- One edit to that trigger and it is a hole, so it is closed at the door as
-- well.
--
-- The fix is the plain sentence: a moderator, or the service role, and
-- nobody else. The service role is named rather than inferred from the
-- absence of a session.

create or replace function public.review_asset(
  target uuid, decision moderation_status, note text default null
)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not (
    public.is_moderator()
    /*
     * Or a worker holding a service-role key, which PostgREST puts in the
     * verified JWT. Read from the claim and not from `current_user`: this
     * function is `security definer`, so inside it `current_user` is its
     * owner for *every* caller - a first go tested that and let an ordinary
     * account straight through. A check on who the caller is has to read
     * something the caller brought with them.
     */
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  ) then
    raise exception 'Only staff can screen an upload.';
  end if;

  update public.assets
     set status = decision,
         review_note = note,
         reviewed_at = now()
   where id = target;
end;
$$;

revoke execute on function public.review_asset(uuid, moderation_status, text) from public;
revoke execute on function public.review_asset(uuid, moderation_status, text) from anon;
grant execute on function public.review_asset(uuid, moderation_status, text) to authenticated;

-- The queue beside it, for the same reason. It already asks `is_moderator()`
-- in its own `where`, so it hands an anonymous caller nothing - but a reader
-- that anybody may call and that returns nothing is one edit away from being
-- a reader that returns everything.
revoke execute on function public.review_queue(integer) from public;
revoke execute on function public.review_queue(integer) from anon;
grant execute on function public.review_queue(integer) to authenticated;

-- And the avatar pair, which were written with the right guard and the same
-- grant nobody noticed.
revoke execute on function public.review_avatar_item(uuid, moderation_status, text) from public;
revoke execute on function public.review_avatar_item(uuid, moderation_status, text) from anon;
grant execute on function public.review_avatar_item(uuid, moderation_status, text) to authenticated;

revoke execute on function public.avatar_review_queue(integer) from public;
revoke execute on function public.avatar_review_queue(integer) from anon;
grant execute on function public.avatar_review_queue(integer) to authenticated;

/**
 * What is waiting to be screened, with the maker's name on it.
 *
 * `review_queue` hands back bare `assets` rows, so a console using it shows
 * a title and a uuid and asks somebody to judge it. Screening is looking at
 * the thing and at who made it, so this carries both - and the picture,
 * which is the whole of the job for a Decal.
 *
 * Empty for anybody who may not screen, decided here rather than by what the
 * page asks for.
 */
create or replace function public.screening_queue(how_many integer default 50)
returns table (
  id uuid, kind asset_kind, name text, description text,
  file_path text, preview_path text, thumbnail_path text,
  byte_size bigint, created_at timestamptz,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_suspended boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  select a.id, a.kind, a.name, a.description,
         a.file_path, a.preview_path, a.thumbnail_path,
         a.byte_size, a.created_at,
         p.id, p.username, p.display_name, p.is_suspended
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.status = 'pending' and public.is_moderator()
   order by a.created_at
   limit least(greatest(coalesce(how_many, 50), 1), 200);
$$;

revoke execute on function public.screening_queue(integer) from public;
revoke execute on function public.screening_queue(integer) from anon;
grant execute on function public.screening_queue(integer) to authenticated;

commit;
