begin;

-- The columns the report console stands on
-- -----------------------------------------------------------------------
--
-- "column r.handled_by does not exist", from a moderator pressing the one
-- button this console is for.
--
-- 0210 re-asserted the report functions because 0176, 0177 and 0178 had
-- never reached the live database. It did not re-assert the **schema** those
-- functions stand on, which is 0173 - and 0173 had not reached it either. A
-- plpgsql body is not checked when it is created, only when it runs, so
-- every one of those functions was created perfectly and then failed the
-- first time somebody called it. That is the whole bug: a migration that
-- applies cleanly and a console that cannot take a single report.
--
-- So this is 0173 again, and 0175 with it, written to be applied to a
-- database that has some of it, none of it, or all of it. Nothing here
-- drops data.
--
-- What was missing, named plainly, because "re-asserted" hides it:
--
--   * `reports.handled_by`, `handled_at`, `outcome`, `handled_note` -
--     without these a report has no record of who answered it or how
--   * `profiles.suspended_until` - without it a suspension cannot end
--   * `report_subject` - the one function that resolves what a report points
--     at, used by the queue, the card and the action alike
--   * `lift_expired_suspensions` - so a lapsed suspension actually lifts
--   * the widened `violations.action` and `violations.target_type` checks -
--     without them a chat suspension or a decision about a community is
--     refused by a constraint
--   * `guard_profile_update` knowing about `suspended_until`, or an
--     ordinary account could set its own suspension end date
--
-- 0214 carries the enum value `removed` that `take_down` writes, in its own
-- file, because Postgres will not let this one use it in the same
-- transaction that adds it. Apply 0214 first.

-- ------------------------------------------------- what a ticket remembers

alter table public.reports
  add column if not exists handled_by uuid references public.profiles on delete set null,
  add column if not exists handled_at timestamptz,
  add column if not exists outcome text,
  add column if not exists handled_note text check (char_length(handled_note) <= 1000);

comment on column public.reports.outcome is
  'The action taken, in `violations.action`''s words, or ''none'' when a '
  'moderator looked and decided there was nothing in it.';

alter table public.reports drop constraint if exists reports_outcome_check;
alter table public.reports add constraint reports_outcome_check
  check (outcome is null or outcome in
    ('none','warning','content_removed','chat_suspension','suspension','termination'));

-- A chat suspension is a decision about an account and belongs in the same
-- ledger as the rest of them, or an account's standing page cannot say why it
-- cannot talk.
alter table public.violations drop constraint if exists violations_action_check;
alter table public.violations add constraint violations_action_check
  check (action in
    ('warning','content_removed','feature_block','chat_suspension',
     'suspension','termination'));

-- The ledger could not name most of what Kobblon now holds, so a decision
-- about a community or a Catalog item had nowhere to point.
alter table public.violations drop constraint if exists violations_target_type_check;
alter table public.violations add constraint violations_target_type_check
  check (target_type is null or target_type in
    ('profile','space','message','asset','style_item','comment',
     'world','community','avatar_item','ad','style'));

-- A suspension that says it ends and then does not is worse than one that
-- never claimed to. `is_suspended` is a boolean read in dozens of places, so
-- the end time goes beside it rather than replacing it.
alter table public.profiles
  add column if not exists suspended_until timestamptz;

comment on column public.profiles.suspended_until is
  'When the suspension lifts. Null while `is_suspended` means indefinite - '
  'a human decides. Nothing reads this to decide access: '
  '`lift_expired_suspensions` clears `is_suspended` and that stays the one '
  'question every reader asks.';

/**
 * Let go of the suspensions whose time is up.
 *
 * Needs calling. It is called at the top of the staff queue and by the
 * worker, so in practice any staff view or any moderation pass heals it -
 * but nothing here is a scheduler, and a Kobblon with nobody looking would
 * hold a lapsed suspension open. Said plainly rather than left to be
 * discovered.
 */
create or replace function public.lift_expired_suspensions()
returns integer
language plpgsql security definer
set search_path = public, extensions as $$
declare freed integer;
begin
  update public.profiles
     set is_suspended = false, suspended_until = null
   where is_suspended and suspended_until is not null and suspended_until <= now();
  get diagnostics freed = row_count;
  return freed;
end $$;

grant execute on function public.lift_expired_suspensions to authenticated;

-- -------------------------------------------------- what a report is about

/**
 * The thing a report points at: who owns it, what it is called, where it is.
 *
 * One function so the card, the queue and the action all resolve a target the
 * same way. A target that has since been deleted comes back with a null owner
 * and a label saying so, rather than vanishing from the queue - a report about
 * something somebody removed themselves is still a report about the person.
 */
create or replace function public.report_subject(kind text, which text)
returns table (owner_id uuid, label text, link text, gone boolean)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare id_as_uuid uuid;
begin
  -- The asset's removed state is compared as text on purpose:
  -- `moderation_status` has no 'removed' until the next migration adds it,
  -- and an enum comparison against a value the type does not hold raises
  -- rather than returning false. Text is correct before and after.
  --
  -- `reports.target_id` is text because a message id is a bigint and
  -- everything else is a uuid. A malformed id is a missing target, not an
  -- error that takes the whole queue down with it.
  begin
    id_as_uuid := which::uuid;
  exception when others then
    id_as_uuid := null;
  end;

  if kind = 'profile' then
    return query select p.id, p.username, '/u/' || p.username, false
                   from public.profiles p where p.id = id_as_uuid;
  elsif kind = 'message' then
    return query select m.sender_id, 'A message', null::text, false
                   from public.messages m where m.id = (nullif(which, '')::bigint);
  elsif kind = 'space' then
    return query select s.owner_id, s.name, '/s/' || s.id::text, s.is_removed
                   from public.spaces s where s.id = id_as_uuid;
  elsif kind = 'world' then
    return query select w.owner_id, w.name, '/w/' || w.id::text, w.is_removed
                   from public.worlds w where w.id = id_as_uuid;
  elsif kind = 'asset' then
    return query select a.creator_id, a.name, '/create/asset/' || a.id::text,
                        a.status::text = 'removed'
                   from public.assets a where a.id = id_as_uuid;
  elsif kind = 'community' then
    return query select c.owner_id, c.name, '/c/' || c.id::text, c.is_removed
                   from public.communities c where c.id = id_as_uuid;
  elsif kind in ('style', 'style_item') then
    return query select t.creator_id, t.name, '/style/' || t.id::text, t.is_removed
                   from public.style_items t where t.id = id_as_uuid;
  elsif kind = 'avatar_item' then
    return query select i.creator_id, i.name, '/catalog/' || i.id::text, i.is_removed
                   from public.avatar_items i where i.id = id_as_uuid;
  elsif kind = 'ad' then
    -- An advert is bought, not owned: `buyer_id` is the account answerable
    -- for it, and `is_active` is the nearest thing it has to being removed.
    return query select d.buyer_id, 'An advert', d.target_path, not d.is_active
                   from public.ads d where d.id = id_as_uuid;
  end if;

  if not found then
    return query select null::uuid, 'This has been deleted', null::text, true;
  end if;
end $$;

grant execute on function public.report_subject(text, text) to authenticated;


-- ------------------------- and the guard learns the column that came with it

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if auth.uid() is null then return new; end if;

  /*
   * A function Kobblon trusts, in the middle of its own deliberate write.
   * Set with `true`, so it is transaction-local and cannot leak into
   * another request, and each of them turns it off again immediately.
   */
  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then return new; end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;

  -- The end of a suspension decides when `lift_expired_suspensions` lets go
  -- of it, so it is as much a part of the sanction as the flag is.
  new.suspended_until := old.suspended_until;

  -- Money. It moves through move_pixels, which writes a ledger row beside
  -- every change; a direct write would move the balance and leave no trace.
  new.pixels := old.pixels;

  -- Identity the site assigns rather than the person.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  return new;
end;
$$;


commit;
