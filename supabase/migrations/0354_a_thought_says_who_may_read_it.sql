/*
 * A thought is its own row, and it says who may read it.
 *
 * Staw wants a privacy setting on it - everyone, or friends only, and
 * friends only by default. A column on `profiles` cannot carry that: the
 * table is readable by anybody, every page asks it for `*`, and a rule
 * that lives in the website is not a rule. Postgres can refuse a column,
 * but refusing one on `profiles` breaks every `select *` on the site.
 *
 * So the thought moves to a table of its own, where row-level security can
 * answer the question properly: you, your friends, or everybody, decided by
 * the row itself, in the database, for every caller - the website, the
 * Launcher, the Workspace, a token somebody found.
 *
 * `profiles.thought`, `thought_at` and `thought_face` go. They were three
 * days old and nothing outside this repository had been built on them yet;
 * the applications are told in the round that goes with this.
 */
begin;

create table if not exists public.thoughts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 120),
  face text check (face is null or face in (
    'smile', 'laugh', 'happy-grin', 'winky-grin', 'heart-eyes',
    'sunglasses', 'shocked', 'sad', 'angry', 'skull', 'fire'
  )),
  at timestamptz not null default now()
);

/*
 * Who may read it is a setting on the account, not a column on the row:
 * somebody can choose it before they have ever written a thought, and a
 * control in Settings that only works once you have written one is a
 * control that lies. Friends only unless they say otherwise.
 */
alter table public.profiles add column if not exists thought_privacy text not null default 'friends';
alter table public.profiles drop constraint if exists profiles_thought_privacy_check;
alter table public.profiles add constraint profiles_thought_privacy_check
  check (thought_privacy in ('everyone', 'friends'));

/*
 * Asked by the policy below. `security definer` so the policy does not
 * depend on what the reader may select from `profiles`, and stable so it
 * is asked once per row rather than once per column.
 */
create or replace function public.thought_is_open(who uuid)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select coalesce((select thought_privacy = 'everyone' from public.profiles where id = who), false);
$$;

grant execute on function public.thought_is_open(uuid) to anon, authenticated;

alter table public.thoughts enable row level security;

/*
 * The grants, in the same file as the table. A policy without them is a
 * table nobody can reach, which this project has built twice.
 */
grant select on public.thoughts to anon, authenticated;
grant insert, update, delete on public.thoughts to authenticated;

/*
 * Reading. A signed-out reader has no friends, so `auth.uid()` is null and
 * only the ones set to everyone come back - which is the right answer for
 * a page anybody can open.
 */
drop policy if exists thoughts_read on public.thoughts;
create policy thoughts_read on public.thoughts for select using (
  user_id = auth.uid()
  or public.are_friends(auth.uid(), user_id)
  or public.thought_is_open(user_id)
);

/* Writing: your own row, and only yours. */
drop policy if exists thoughts_write on public.thoughts;
create policy thoughts_write on public.thoughts for insert with check (user_id = auth.uid());

drop policy if exists thoughts_change on public.thoughts;
create policy thoughts_change on public.thoughts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists thoughts_remove on public.thoughts;
create policy thoughts_remove on public.thoughts for delete using (user_id = auth.uid());

/* The clock is ours, not the caller's. */
create or replace function public.stamp_thought()
returns trigger language plpgsql
set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' or new.body is distinct from old.body or new.face is distinct from old.face then
    new.at := now();
  end if;
  return new;
end $$;

drop trigger if exists a_thought_is_stamped on public.thoughts;
create trigger a_thought_is_stamped before insert or update on public.thoughts
  for each row execute function public.stamp_thought();

/* Kobby reads it here now, not on the profile. */
create or replace function public.watch_a_thought()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare they record;
begin
  select is_guest, is_admin, is_moderator, is_superadmin into they
    from public.profiles where id = new.user_id;

  if coalesce(they.is_guest, false) or coalesce(they.is_admin, false)
     or coalesce(they.is_moderator, false) or coalesce(they.is_superadmin, false) then
    return null;
  end if;

  if tg_op = 'INSERT' or new.body is distinct from old.body then
    insert into public.names_to_read (who, kind, body) values (new.user_id, 'thought', new.body);
  end if;

  return null;
end $$;

drop trigger if exists a_thought_is_read on public.thoughts;
create trigger a_thought_is_read after insert or update of body on public.thoughts
  for each row execute function public.watch_a_thought();

/*
 * What was written on the profiles table in the last three days. Guarded
 * on the column still being there, so a second apply is a no-op rather
 * than an error about a column this file itself removed.
 */
do $move$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'thought'
  ) then
    execute $sql$
      insert into public.thoughts (user_id, body, face, at)
      select id, thought, thought_face, coalesce(thought_at, now())
        from public.profiles
       where coalesce(trim(thought), '') <> ''
      on conflict (user_id) do nothing
    $sql$;
  end if;
end $move$;

/*
 * The watcher goes back to the three it had before: the thought is no
 * longer a column here, and leaving it named would leave a trigger reading
 * a column that is about to be dropped.
 */
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

  return null;
end $$;

drop trigger if exists read_what_they_wrote_about_themselves on public.profiles;
create trigger read_what_they_wrote_about_themselves
  after insert or update of username, display_name, bio on public.profiles
  for each row execute function public.watch_profile_text();

/* The old stamp trigger watched these columns; it goes before they do. */
drop trigger if exists a_thought_is_stamped on public.profiles;

alter table public.profiles drop column if exists thought;
alter table public.profiles drop column if exists thought_at;
alter table public.profiles drop column if exists thought_face;

/* And the judgement empties the row rather than three columns. */
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
    delete from public.thoughts where user_id = item.who;
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
