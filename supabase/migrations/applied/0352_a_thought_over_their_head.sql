/*
 * A thought: the line somebody has over their head.
 *
 * Discord has a status, TikTok has one on the profile picture; ours is a
 * thinking bubble over the avatar on their own profile, and a quiet line
 * with no bubble anywhere else they are listed. One sentence, theirs, and
 * they can take it down whenever they like.
 *
 * It is writing on a profile page, so it goes past Kobby exactly as a bio
 * does - the same queue, the same rules, the same remedy of taking it away
 * rather than taking the account. `thought_at` is stamped by a trigger and
 * not by whoever is writing, because the client is not the clock.
 *
 * And a defect found while fitting this in, which is the reason the whole
 * of `judge_profile_text` is retyped below. `names_to_read.kind` gained
 * `forum_bio` in 0282, but the judgement still reads
 *
 *     if kind = 'bio' ... elsif kind = 'display_name' ... else <rename>
 *
 * so a forum bio that broke a rule reset the account's **handle** to
 * `player<id>`, wrote that into their name history, and told them their
 * "bio" was taken down. Nothing threw; the wrong thing was taken. Every
 * kind is named now and an unknown one takes nothing, which is the safe
 * way round for the next kind somebody adds.
 */
begin;

alter table public.profiles add column if not exists thought text;
alter table public.profiles add column if not exists thought_at timestamptz;

alter table public.profiles drop constraint if exists profiles_thought_check;
alter table public.profiles add constraint profiles_thought_check
  check (thought is null or char_length(thought) <= 120);

/* The clock is ours, not the caller's. */
create or replace function public.stamp_thought()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  if new.thought is distinct from old.thought then
    new.thought_at := case when new.thought is null then null else now() end;
  end if;
  return new;
end $$;

drop trigger if exists a_thought_is_stamped on public.profiles;
create trigger a_thought_is_stamped before update of thought on public.profiles
  for each row execute function public.stamp_thought();

/* Kobby reads it, the same as a bio. */
alter table public.names_to_read drop constraint if exists names_to_read_kind_check;
alter table public.names_to_read add constraint names_to_read_kind_check
  check (kind in ('username', 'display_name', 'bio', 'forum_bio', 'thought'));

create or replace function public.watch_profile_text()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if coalesce(current_setting('kobbleston.renaming', true), 'off') = 'on' then
    return null;
  end if;

  if coalesce(new.is_guest, false)
     or coalesce(new.is_admin, false)
     or coalesce(new.is_moderator, false)
     or coalesce(new.is_superadmin, false) then
    return null;
  end if;

  if tg_op = 'INSERT' or new.username is distinct from old.username then
    insert into public.names_to_read (who, kind, body) values (new.id, 'username', new.username);
  end if;

  if (tg_op = 'INSERT' or new.display_name is distinct from old.display_name)
     and coalesce(trim(new.display_name), '') <> ''
     and lower(trim(new.display_name)) <> lower(new.username) then
    insert into public.names_to_read (who, kind, body) values (new.id, 'display_name', new.display_name);
  end if;

  if (tg_op = 'INSERT' or new.bio is distinct from old.bio)
     and coalesce(trim(new.bio), '') <> '' then
    insert into public.names_to_read (who, kind, body) values (new.id, 'bio', new.bio);
  end if;

  if (tg_op = 'INSERT' or new.thought is distinct from old.thought)
     and coalesce(trim(new.thought), '') <> '' then
    insert into public.names_to_read (who, kind, body) values (new.id, 'thought', new.thought);
  end if;

  return null;
end $$;

drop trigger if exists read_what_they_wrote_about_themselves on public.profiles;
create trigger read_what_they_wrote_about_themselves
  after insert or update of username, display_name, bio, thought on public.profiles
  for each row execute function public.watch_profile_text();

create or replace function public.judge_profile_text(
  entry bigint,
  breaks boolean,
  rule_code text default null,
  reason text default null,
  model text default null
) returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  item record;
  they record;
  rule record;
  band text;
  rung text;
  why text;
  wrote text;
  field text;
  fresh text;
begin
  if not (public.is_the_worker()
          or coalesce((select is_admin from public.profiles where id = auth.uid()), false)) then
    raise exception 'Only the moderation worker may do that.';
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then raise exception 'AI moderation is off.'; end if;

  select * into item from public.names_to_read where id = entry;
  if item is null then return 'gone'; end if;

  -- Read, before anything below can return early.
  update public.names_to_read set read_at = now() where id = entry;

  wrote := left(coalesce(item.body, ''), 200);
  field := case item.kind
             when 'username'     then 'handle'
             when 'display_name' then 'display name'
             when 'forum_bio'    then 'forum bio'
             when 'thought'      then 'thought'
             else 'bio'
           end;

  if not coalesce(breaks, false) or rule_code is null then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('profile_text', entry::text, 'nothing',
            left(coalesce(reason, 'Nothing against the rules.'), 500), model, wrote);
    return 'nothing';
  end if;

  select * into rule from public.moderation_rules where code = rule_code and is_on;
  if rule is null then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('profile_text', entry::text, 'unsure',
            left('Named a rule that does not exist: ' || rule_code, 500), model, wrote);
    return 'unsure';
  end if;

  select username, content_id, is_admin, is_moderator, is_superadmin into they
    from public.profiles where id = item.who;
  if they is null then return 'nothing'; end if;

  /*
   * The same hands-off rule as chat, and the one Staw was actually hit by:
   * "its sending warnings to our actual mods and staff and admins cuz they
   * write it in bios". A moderator's bio saying they are a moderator is a
   * fact, and the model is told so now - but this check is what makes it a
   * database rule rather than a prompt one. A prompt can be argued with; a
   * renamed moderator cannot be un-renamed by explaining.
   */
  if public.kobby_hands_off(item.who) then
    insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
    values ('profile_text', entry::text, 'staff',
            left('Rule ' || rule.ord || ' (' || rule.code || '), their ' || field
                 || ', but this account is Kobblon''s own, the founder''s or a member '
                 || 'of staff. Left for a person. ' || coalesce(reason, ''), 500),
            model, wrote);
    return 'staff';
  end if;

  band := public.behaviour_band(public.behaviour_score(item.who));
  rung := public.what_kobby_may_do(rule.gravity, band);

  -- Chat rungs do not apply to a name; see the note at the top.
  if rung in ('quieted', 'quieted_voice') then rung := 'warned'; end if;

  why := left(coalesce(nullif(reason, ''), rule.title), 300);

  insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
  values ('profile_text', entry::text, rung,
          left('Rule ' || rule.ord || ' (' || rule.code || '), ' || band
               || ', their ' || field || ': ' || why, 500),
          model, wrote);

  if rung = 'nothing' then return 'nothing'; end if;
  if not rules.may_warn then return 'blocked'; end if;

  /*
   * The name goes, at every rung above nothing, and this is the remedy
   * rather than the punishment: leaving a slur on a profile page while a
   * warning sits on the record would be answering the wrong question.
   *
   * `kobbleston.renaming` is raised for the handle because `guard_username`
   * pins a changed handle back otherwise, and `kobbleston.standing` for the
   * suspension because `guard_profile_update` pins `is_suspended` back.
   * Both are transaction-local and both are lowered immediately. This is
   * the trap that cost this platform a week: a `security definer` function
   * is trusted for its rights, not for who it reports as, and the guards
   * ask who.
   */
  if item.kind = 'bio' then
    update public.profiles set bio = null where id = item.who;
  elsif item.kind = 'thought' then
    update public.profiles set thought = null, thought_at = null where id = item.who;
  elsif item.kind = 'forum_bio' then
    update public.forum_profiles set bio = null where user_id = item.who;
  elsif item.kind = 'display_name' then
    update public.profiles set display_name = they.username where id = item.who;
  elsif item.kind = 'username' then
    fresh := 'player' || coalesce(they.content_id, 0)::text;
    -- Taken by somebody already, which the id makes unlikely and not
    -- impossible: a few more digits rather than a failed judgement.
    if exists (select 1 from public.profiles where lower(username) = lower(fresh)) then
      fresh := fresh || floor(random() * 900 + 100)::text;
    end if;
    insert into public.username_history (user_id, username) values (item.who, they.username);
    perform set_config('kobbleston.renaming', 'on', true);
    update public.profiles set username = fresh where id = item.who;
    perform set_config('kobbleston.renaming', 'off', true);
  end if;

  insert into public.violations
    (user_id, rule, action, reason, target_type, target_id, evidence)
  values (item.who, rule.code,
          case when rung = 'suspended' then 'suspension' else 'warning' end,
          'Rule ' || rule.ord || ': ' || rule.title || '. ' || why,
          'profile', item.who::text, wrote);

  if rung = 'suspended' then
    if not rules.may_suspend then
      insert into public.notifications (user_id, kind, body)
      values (item.who, 'system',
              left('Your ' || field || ' was taken down over rule ' || rule.ord
                   || ': ' || rule.title || '. You can set a new one.', 300));
      return 'blocked';
    end if;

    perform set_config('kobbleston.standing', 'on', true);
    update public.profiles set is_suspended = true where id = item.who;
    perform set_config('kobbleston.standing', 'off', true);

    perform public.flag_account(
      item.who,
      'Kobby judged their ' || field || ' serious enough to suspend. Rule '
        || rule.ord || ': ' || rule.title || '.',
      wrote);

    insert into public.notifications (user_id, kind, body)
    values (item.who, 'system',
            left('Your account has been suspended over your ' || field
                 || ', rule ' || rule.ord || ': ' || rule.title
                 || '. A person reads every appeal.', 300));
    return 'suspended';
  end if;

  insert into public.notifications (user_id, kind, body)
  values (item.who, 'system',
          left('Your ' || field || ' was taken down over rule ' || rule.ord
               || ': ' || rule.title || '. You can set a new one.', 300));
  return 'warned';
end $$;

commit;
