begin;

/*
 * The appeals queue
 * -----------------------------------------------------------------------
 *
 * `decide_appeal` has existed since 0072 and **nothing has ever called
 * it.** Every appeal written from the standing page since then is a row
 * sitting at `open`, and the person who wrote it was told a human would
 * read it. That is the worst promise on the platform to be quietly not
 * keeping, and it is the one thing this console owed that no amount of
 * redesign fixes.
 *
 * The queue needs what the table cannot give on its own: the decision
 * being appealed, who it is about, how their bar stands now, and **which
 * rank decided it rather than who** - the same rule the status page has
 * followed since 0203, because handing a browser the id of the moderator
 * who suspended somebody is how a moderator gets harassed.
 *
 * `decide_appeal` itself is not touched. It upholds or declines, voids the
 * violation, lifts a suspension when nothing else is holding it, and
 * writes the letter. All of that was right; it just had no door.
 */

create index if not exists appeals_open_idx
  on public.appeals (created_at) where status = 'open';

/**
 * Everything one screen needs to answer an appeal, in one row.
 *
 * `which` is 'open' by default because that is the work. 'all' is for
 * looking something up afterwards, which is what an appeal queue is asked
 * for the day after a decision somebody disagrees with.
 */
create or replace function public.appeal_queue(
  which text default 'open', how_many integer default 200
)
returns table (
  id bigint, status text, body text, created_at timestamptz,
  decision_note text, decided_at timestamptz, decided_rank text,
  user_id uuid, username text, display_name text, avatar_url text,
  score integer, band text,
  violation_id bigint, action text, rule text, rule_ord integer,
  rule_title text, gravity integer, reason text, evidence text,
  target_type text, target_id text, blocks text[],
  is_void boolean, expires_at timestamptz, decided_on timestamptz,
  by_rank text, waiting_hours integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select a.id, a.status, a.body, a.created_at,
         a.decision_note, a.decided_at,
         case when a.decided_by is null then null
              else coalesce(public.staff_rank(a.decided_by), 'staff') end,
         a.user_id, p.username, p.display_name, p.avatar_url,
         public.behaviour_score(a.user_id),
         public.behaviour_band(public.behaviour_score(a.user_id)),
         v.id, v.action, v.rule, r.ord, r.title, r.gravity,
         v.reason, v.evidence, v.target_type, v.target_id, v.blocks,
         v.is_void, v.expires_at, v.created_at,
         case when v.moderator_id is null then 'kobby'
              else coalesce(public.staff_rank(v.moderator_id), 'staff') end,
         (extract(epoch from now() - a.created_at) / 3600)::integer
    from public.appeals a
    join public.violations v on v.id = a.violation_id
    left join public.profiles p on p.id = a.user_id
    left join public.moderation_rules r on r.code = v.rule
   where public.is_moderator()
     and case which
           when 'all' then true
           when 'answered' then a.status <> 'open'
           else a.status = 'open'
         end
   order by (a.status = 'open') desc, a.created_at
   limit least(greatest(coalesce(how_many, 200), 1), 500)
$$;

grant execute on function public.appeal_queue(text, integer) to authenticated;

/** How many are waiting, and how long the oldest has been. */
create or replace function public.appeal_counts()
returns table (waiting integer, oldest_hours integer, upheld_30d integer, declined_30d integer)
language sql stable security definer
set search_path = public, extensions as $$
  select
    count(*) filter (where a.status = 'open')::integer,
    coalesce(max(extract(epoch from now() - a.created_at) / 3600)
             filter (where a.status = 'open'), 0)::integer,
    count(*) filter (where a.status = 'upheld' and a.decided_at > now() - interval '30 days')::integer,
    count(*) filter (where a.status = 'declined' and a.decided_at > now() - interval '30 days')::integer
    from public.appeals a
   where public.is_moderator()
$$;

grant execute on function public.appeal_counts() to authenticated;

commit;
