begin;

/*
 * Taking a sanction back gives the behaviour points back.
 *
 * Staw: "when we take back sanctions from your account we give you back
 * your behaviour points". Half of that was already true and half of it
 * silently was not, which is the worst of the three possible states.
 *
 * `behaviour_score` adds up two things: violations, and chat timeouts. The
 * violations half reads `not v.is_void`, so voiding one - which is what
 * upholding an appeal does - stops it counting and the bar goes back up on
 * its own. The timeouts half had no such test. A timeout lifted by
 * `decide_appeal` or by `judge_appeal` stopped muting the person
 * immediately and went on pressing on their bar for the full three weeks,
 * so an upheld appeal gave somebody their chat back and left the mark that
 * decides how hard the next thing hits them.
 *
 * It is the shape this project keeps finding: two halves of one rule, one
 * of them corrected and the other not, and nothing failing in between.
 * Nobody would have found it by reading the function - the test that
 * catches it is "lift one and look at the number".
 */
create or replace function public.behaviour_score(target uuid)
returns integer
language sql stable security definer
set search_path = public, extensions as $$
  with cleared as (
    select coalesce(
      (select max(r.created_at) from public.behaviour_resets r where r.who = target),
      '-infinity'::timestamptz
    ) as at
  ),
  weighed as (
    select public.violation_weight(v.action, v.created_at) as w
      from public.violations v, cleared c
     where v.user_id = target
       and not v.is_void
       and v.created_at > c.at
    union all
    select greatest(
             0::numeric,
             (4 + least(t.minutes, 1440)::numeric / 240)
             * (1 - least(1::numeric,
                 (extract(epoch from (now() - t.started_at)) / 86400)::numeric / 21))
           )
      from public.chat_timeouts t, cleared c
     where t.who = target
       /*
        * A lifted one weighs nothing. This is the line that was missing:
        * `lifted_at` is set when an appeal is upheld, and a sanction taken
        * back has to stop counting the moment it is taken back rather
        * than three weeks later.
        */
       and t.lifted_at is null
       and t.started_at > c.at
  )
  select greatest(0, least(100,
    100 - round(coalesce((select sum(w) from weighed), 0))::integer
  ))
$$;

grant execute on function public.behaviour_score(uuid) to authenticated, service_role;

commit;
