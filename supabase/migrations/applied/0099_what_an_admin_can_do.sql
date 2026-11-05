begin;

-- What an admin can actually do.
--
-- Split from 0098 because that one creates `require_admin` and these call
-- it, and a function body is resolved when it runs rather than when it is
-- written - but `admin_log` is a table, and a table referenced by a function
-- in the same transaction that created it is the same shape of trouble as
-- the enum. One file makes the thing, the next one uses it.

-- ------------------------------------------------------- standing and badges

/*
 * The verified badge, staff, and suspension. One function because they are
 * one decision - what this account is to Kobblon - and three functions would
 * be three places to forget the log.
 *
 * `null` leaves a flag alone, so the panel can toggle one without having to
 * send the other two back and race with another admin doing the same.
 */
create or replace function public.admin_set_standing(
  target uuid,
  verified boolean default null,
  moderator boolean default null,
  suspended boolean default null,
  why text default null
) returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare before public.profiles%rowtype;
begin
  perform public.require_admin();

  select * into before from public.profiles where id = target;
  if before.id is null then raise exception 'No such account.'; end if;

  /*
   * An admin is not something this panel can hand out or take away. Staff
   * are made in the database by somebody with the keys, deliberately, and a
   * panel that can promote is a panel that only has to be stolen once.
   */
  if before.is_admin and suspended is true then
    raise exception 'An admin cannot be suspended from here.';
  end if;

  update public.profiles
     set is_verified  = coalesce(verified,  is_verified),
         is_moderator = coalesce(moderator, is_moderator),
         is_suspended = coalesce(suspended, is_suspended)
   where id = target;

  perform public.write_admin_log('standing', target, jsonb_build_object(
    'verified', verified, 'moderator', moderator, 'suspended', suspended,
    'why', why
  ));
end;
$$;

-- ------------------------------------------------------------------- Brix

/*
 * Giving and taking Brix. One function with a sign, because "remove" is
 * "give a negative number" and two functions would be two places for the
 * ledger to be forgotten.
 *
 * Taking more than somebody has takes what they have. A balance below zero
 * is a debt, Kobblon has no notion of one, and the first thing it would do
 * is make every price check in the product read strangely.
 */
create or replace function public.admin_move_brix(
  target uuid, amount integer, why text default null
) returns integer language plpgsql security definer
  set search_path = public, extensions as $$
declare
  held integer;
  moved integer;
begin
  perform public.require_admin();
  if amount = 0 then raise exception 'That would move nothing.'; end if;

  select pixels into held from public.profiles where id = target;
  if held is null then raise exception 'No such account.'; end if;

  moved := greatest(amount, -held);

  perform public.move_pixels(target, moved, 'admin', why);
  perform public.write_admin_log('brix', target, jsonb_build_object(
    'asked', amount, 'moved', moved, 'why', why
  ));

  return held + moved;
end;
$$;

-- ---------------------------------------------------------- saying something

/*
 * A notification from Kobblon itself.
 *
 * `actor_id` is left null rather than set to the admin who sent it: this is
 * the platform speaking, and putting a staff member's face on a warning
 * points every reply at a person rather than at support. The log knows who
 * sent it, which is where that belongs.
 */
create or replace function public.admin_notify(target uuid, message text)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
begin
  perform public.require_admin();
  if coalesce(btrim(message), '') = '' then
    raise exception 'A notification needs something in it.';
  end if;

  -- `system`, which the table already allows and the Inbox already knows
  -- how to draw. A new kind would have been a new case to add in three
  -- places and a check constraint to widen, for a thing that is exactly
  -- what `system` already means.
  insert into public.notifications (user_id, kind, body)
  values (target, 'system', left(btrim(message), 500));

  perform public.write_admin_log('notify', target,
    jsonb_build_object('body', left(btrim(message), 500)));
end;
$$;

/*
 * The same, to everybody. Guests are left out: a guest account lives in one
 * browser and is often gone by the time anybody would read it, and counting
 * them makes every "how many people saw this" wrong afterwards.
 *
 * Returns how many it reached, because sending to everybody with no idea
 * how many that was is the sort of thing somebody does twice.
 */
create or replace function public.admin_notify_everyone(message text)
returns integer language plpgsql security definer
  set search_path = public, extensions as $$
declare reached integer;
begin
  perform public.require_admin();
  if coalesce(btrim(message), '') = '' then
    raise exception 'A notification needs something in it.';
  end if;

  insert into public.notifications (user_id, kind, body)
  select p.id, 'system', left(btrim(message), 500)
    from public.profiles p
   where not p.is_guest and not p.is_suspended;

  get diagnostics reached = row_count;

  perform public.write_admin_log('notify-everyone', null, jsonb_build_object(
    'body', left(btrim(message), 500), 'reached', reached
  ));

  return reached;
end;
$$;

-- ------------------------------------------------------------ deleting a person

/*
 * Deleting an account, which is the one thing here that cannot be undone.
 *
 * Deleting the auth user is what actually removes somebody; the profile and
 * everything hanging off it follow by cascade. So this does that, and does
 * not pretend a flag somewhere is a deletion.
 *
 * Two refusals, both about the same fear. An admin cannot be deleted from
 * the panel, for the reason `admin_set_standing` will not suspend one: a
 * stolen staff session must not be able to remove the people who could undo
 * it. And an admin cannot delete themselves, because the account doing the
 * deleting is the one that would have to fix any mistake.
 */
create or replace function public.admin_delete_account(target uuid, why text)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare doomed public.profiles%rowtype;
begin
  perform public.require_admin();

  select * into doomed from public.profiles where id = target;
  if doomed.id is null then raise exception 'No such account.'; end if;
  if doomed.is_admin then raise exception 'An admin cannot be deleted from here.'; end if;
  if target = auth.uid() then raise exception 'You cannot delete yourself.'; end if;
  if coalesce(btrim(why), '') = '' then
    raise exception 'Say why. This cannot be undone.';
  end if;

  -- Written before the deletion, not after: the reference goes null the
  -- moment the row is gone, and the name is the only thing left to say who
  -- this was.
  perform public.write_admin_log('delete-account', target, jsonb_build_object(
    'username', doomed.username, 'display_name', doomed.display_name, 'why', why
  ));

  delete from auth.users where id = target;
end;
$$;

-- ------------------------------------------------------------- flagged words

/*
 * The words the whole moderation system reads.
 *
 * `moderation_terms` has existed since 0017 and nothing could edit it
 * without a migration, so the flagged-word list was a thing only a deploy
 * could change - which is not a moderation tool, it is a build step.
 *
 * `pattern` is a regular expression, and a bad one is a real hazard: it is
 * run against everything anybody types, so one that cannot compile takes
 * screening down and one that is catastrophically greedy hangs it. So it is
 * compiled here before it is stored, against a harmless string, and a
 * pattern that will not compile is refused with the message Postgres gave.
 */
create or replace function public.admin_save_term(
  term_id bigint,
  pattern text,
  decision public.screen_decision,
  reason text,
  scope text default 'all'
) returns bigint language plpgsql security definer
  set search_path = public, extensions as $$
declare saved bigint;
begin
  perform public.require_admin();

  if coalesce(btrim(pattern), '') = '' then
    raise exception 'A term needs a pattern.';
  end if;

  begin
    perform 'kobblon' ~* pattern;
  exception when others then
    raise exception 'That pattern is not a valid expression: %', sqlerrm;
  end;

  if term_id is null then
    insert into public.moderation_terms (pattern, decision, reason, scope)
    values (btrim(pattern), decision, reason, coalesce(scope, 'all'))
    returning id into saved;
  else
    update public.moderation_terms
       set pattern = btrim(pattern), decision = admin_save_term.decision,
           reason = admin_save_term.reason, scope = coalesce(admin_save_term.scope, 'all')
     where id = term_id
    returning id into saved;
    if saved is null then raise exception 'No such term.'; end if;
  end if;

  perform public.write_admin_log('term', null, jsonb_build_object(
    'id', saved, 'pattern', btrim(pattern), 'decision', decision, 'scope', scope
  ));

  return saved;
end;
$$;

create or replace function public.admin_delete_term(term_id bigint)
returns void language plpgsql security definer
  set search_path = public, extensions as $$
declare gone public.moderation_terms%rowtype;
begin
  perform public.require_admin();

  delete from public.moderation_terms where id = term_id returning * into gone;
  if gone.id is null then raise exception 'No such term.'; end if;

  perform public.write_admin_log('term-removed', null, jsonb_build_object(
    'id', term_id, 'pattern', gone.pattern
  ));
end;
$$;

/*
 * Reading the list. A plain select would need a policy letting staff read
 * the table, and a function keeps the refusal in the same place as every
 * other one here rather than in a second mechanism.
 */
create or replace function public.admin_terms()
returns setof public.moderation_terms language plpgsql stable security definer
  set search_path = public, extensions as $$
begin
  perform public.require_admin();
  return query select * from public.moderation_terms order by decision, id;
end;
$$;

/*
 * Trying a pattern against a piece of text before storing it, so somebody
 * writing one can see what it catches rather than finding out from the
 * people it wrongly blocks.
 */
create or replace function public.admin_try_term(pattern text, sample text)
returns boolean language plpgsql stable security definer
  set search_path = public, extensions as $$
declare hit boolean;
begin
  perform public.require_admin();
  begin
    select sample ~* pattern into hit;
  exception when others then
    raise exception 'That pattern is not a valid expression: %', sqlerrm;
  end;
  return hit;
end;
$$;

-- ------------------------------------------------------------------- people

/*
 * Finding somebody. By name, by handle, or by the number on their profile,
 * because a report says one and a person says another.
 */
create or replace function public.admin_find_people(search text)
returns table(
  id uuid, username text, display_name text, avatar_url text,
  content_id bigint, pixels integer, is_verified boolean, is_moderator boolean,
  is_suspended boolean, is_admin boolean, is_guest boolean, created_at timestamptz
) language plpgsql stable security definer
  set search_path = public, extensions as $$
begin
  perform public.require_admin();
  return query
    select p.id, p.username, p.display_name, p.avatar_url, p.content_id,
           p.pixels, p.is_verified, p.is_moderator, p.is_suspended,
           p.is_admin, p.is_guest, p.created_at
      from public.profiles p
     where coalesce(btrim(search), '') = ''
        or p.username ilike '%' || btrim(search) || '%'
        or p.display_name ilike '%' || btrim(search) || '%'
        or p.content_id::text = btrim(search)
     order by p.is_admin desc, p.is_moderator desc, p.created_at desc
     limit 50;
end;
$$;

grant execute on function public.admin_set_standing to authenticated;
grant execute on function public.admin_move_brix to authenticated;
grant execute on function public.admin_notify to authenticated;
grant execute on function public.admin_notify_everyone to authenticated;
grant execute on function public.admin_delete_account to authenticated;
grant execute on function public.admin_save_term to authenticated;
grant execute on function public.admin_delete_term to authenticated;
grant execute on function public.admin_terms to authenticated;
grant execute on function public.admin_try_term to authenticated;
grant execute on function public.admin_find_people to authenticated;

commit;
