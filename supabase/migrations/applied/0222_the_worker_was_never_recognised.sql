begin;

/*
 * The door the machine could not open.
 *
 * `is_the_worker()` asked `current_setting('request.jwt.claim.role')`.
 * That is the **old** spelling. PostgREST set one GUC per claim years
 * ago; it now sets a single JSON `request.jwt.claims`, and Supabase's
 * current version does not set the per-claim ones at all. So the setting
 * read back empty, `is_the_worker()` was false for the real worker, and
 * every door it has was shut:
 *
 *   * `ai_work` returned no rows, so a run read "looked at 0" with
 *     sixty-one things waiting - which is exactly what the console has
 *     been showing;
 *   * `apply_ai_verdict` would have refused the verdict anyway;
 *   * `take_report`, `answer_ticket` and `judge_appeal` the same.
 *
 * Nothing was wrong with the key, the deployment or Groq. The worker
 * arrived, was not recognised, and was handed an empty queue - which from
 * outside is indistinguishable from an empty queue.
 *
 * This is the trap in CLAUDE.md with a different hat on: a value read
 * from a place the thing that sets it has moved on from. The check that
 * catches it is not "is the guard there" - it is "show the guard saying
 * yes to the real caller", and no test here had ever set the claims the
 * way PostgREST actually sets them.
 *
 * Both spellings are read now, because a project may be on either and a
 * database that only understands the newer one breaks the day somebody
 * pins an older gateway.
 */
create or replace function public.is_the_worker()
returns boolean
language sql stable
set search_path = public, extensions as $$
  select coalesce(
    -- The spelling PostgREST uses today: one JSON blob.
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    -- The spelling it used before that, still set by older gateways.
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) = 'service_role';
$$;

-- ------------------------------------------------ the other place it is read

/**
 * Screening an upload, which read the claim itself and had the same bug.
 *
 * Only this one line changed. The rest is as it was.
 */
CREATE OR REPLACE FUNCTION public.review_asset(target uuid, decision moderation_status, note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    -- Same stale spelling as `is_the_worker` had, and the same effect:
    -- the worker could not screen an upload either. Asked through the
    -- function now, so there is one place that knows how a claim is spelt.
    or public.is_the_worker()
  ) then
    raise exception 'Only staff can screen an upload.';
  end if;

  update public.assets
     set status = decision,
         review_note = note,
         reviewed_at = now()
   where id = target;
end;
$function$;

/*
 * And the grant to go with it. The service-role branch inside
 * `review_asset` has never been reachable: the function is granted to
 * `authenticated` only, so the worker was refused at the door before the
 * branch could be read. A check written for a caller who cannot call is
 * the fourth trap in CLAUDE.md with the function's name on it.
 */
grant execute on function public.review_asset(uuid, public.moderation_status, text)
  to service_role;
grant execute on function public.review_avatar_item(uuid, public.moderation_status, text)
  to service_role;

commit;
