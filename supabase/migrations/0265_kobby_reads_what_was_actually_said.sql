begin;

/*
 * Kobby reads what was actually said, and Kobby is the one who suspends.
 *
 * Staw, looking at a chat suspension card: "i want to know if the chat
 * suspend was our own automated stuff or if it was kobby who did this bc i
 * want this to be done by kobby only, and kobby analyzes the original
 * messages not the ones sent".
 *
 * Both halves of that were wrong, and the first half is the answer to his
 * question: **it was not Kobby.** Nothing a model said has ever given out
 * a chat suspension. `words_are_censored` (0171, last rewritten in 0199)
 * counts how many times the regular expressions objected to somebody in
 * ten minutes, and at three it calls `mute_chat` itself. The card said
 * `source = 'machine'`, which has meant the pattern list since 0171 and
 * reads, to anybody looking at it, like the AI.
 *
 * And Kobby has only ever been shown the masked line. `queue_for_the_machine`
 * is an `after insert` trigger, so `new.body` by then is whatever the
 * `before` trigger left behind - bullets. The model has been asked to judge
 * "•••• off you ••••••" and decide whether it broke a rule, which is a
 * question nobody can answer. It is why `was_masked` had to be handed over
 * as a hint at all: the hint was standing in for the evidence.
 *
 * So, three changes.
 *
 * **One: the original reaches Kobby.** The censoring trigger runs `before`
 * and holds the real line; the queueing trigger runs `after` and does not.
 * The one carries it to the other in a transaction-local setting, which is
 * the pattern this schema already uses for `kobbleston.money` and cannot
 * leak out of the statement that set it. `chat_to_read.said` keeps it, and
 * `ai_work` hands that over instead of `body`.
 *
 * **Two: what is shown to people stays censored.** 0208 decided that
 * deliberately and it was right - "showing somebody a slur back,
 * uncensored, because they typed it is not evidence, it is the platform
 * saying it too". `judge_chat_line` now runs the model's own quote back
 * through `censor_text` before it becomes evidence, because the model is
 * now reading the uncensored line and would otherwise quote it onto a card
 * a person reads.
 *
 * **Three: suspending is Kobby's.** The strike counter stops calling
 * `mute_chat`. The strikes are still recorded - they are what Kobby weighs
 * through `behaviour_score`, and they are the record of somebody trying it
 * repeatedly - but the decision is the model's, through the ladder in 0209
 * that already weighs the rule against the standing.
 *
 * There is one exception and it is not a hedge, it is the alternative to
 * suspension quietly ceasing to exist: **when Kobby is switched off, or is
 * not allowed to suspend, the patterns go back to doing it.** Somebody
 * turning the AI off in the console should not be silently turning chat
 * enforcement off with it. Which of the two acted is now written on the row
 * rather than guessed at from one word meaning both: `source` is 'kobby',
 * 'filter' or 'staff', so the next time Staw looks at a card he can tell
 * without reading this file.
 */

-- -------------------------------------------------- the line, as it was

alter table public.chat_to_read add column if not exists said text;

comment on column public.chat_to_read.said is
  'What was typed, before the patterns masked it. The model reads this; '
  'nothing shown to a person does. Null on rows queued before 0265 and on '
  'anything that was never masked, where `body` is already the original.';

/**
 * The censoring trigger, handing the original forward.
 *
 * Identical to 0199 but for two things: it puts the line it was given into
 * a transaction-local setting before it masks anything, and it no longer
 * decides a suspension unless Kobby is not there to.
 */
create or replace function public.words_are_censored()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  masked text;
  recent integer;
  me uuid := auth.uid();
  quiet timestamptz;
  mins integer;
  run text;
  bits integer;
  kobby_has_it boolean;
begin
  /*
   * Carried to `queue_for_the_machine`, which runs after this and sees only
   * what this leaves behind. Set with `true` so it is transaction-local: it
   * cannot survive into another request, and the next statement in this one
   * sets it again before anything reads it.
   */
  perform set_config('kobbleston.said', coalesce(new.body, ''), true);

  /*
   * Whether the decision is Kobby's at all. Off, or not allowed to suspend,
   * and the count below goes back to being what enforces chat - otherwise
   * switching the AI off switches this off with it, without saying so.
   */
  select coalesce(is_on, false) and coalesce(may_suspend, false)
    into kobby_has_it from public.ai_settings where id;
  kobby_has_it := coalesce(kobby_has_it, false);

  select t.until into quiet from public.chat_timeouts t
   where t.who = me and t.until > now()
   order by t.until desc limit 1;
  if quiet is not null then
    mins := greatest(1, ceil(extract(epoch from quiet - now()) / 60)::integer);
    raise exception 'Chat is suspended for another % minute%.',
      mins, case when mins = 1 then '' else 's' end
      using errcode = 'check_violation';
  end if;

  -- Spelling it out one letter at a time is still saying it (0199).
  if me is not null and tg_table_name = 'messages'
     and length(regexp_replace(coalesce(new.body, ''), '[^[:alnum:]]', '', 'g')) between 1 and 3 then
    select count(*), string_agg(b.body, ' ' order by b.created_at)
      into bits, run
      from (select m.body, m.created_at from public.messages m
             where m.conversation_id = new.conversation_id
               and m.sender_id = me
               and m.created_at > now() - interval '3 minutes'
               and length(regexp_replace(m.body, '[^[:alnum:]]', '', 'g')) between 1 and 3
             order by m.created_at desc limit 11) b;

    if coalesce(bits, 0) > 0 then
      run := run || ' ' || new.body;
      if public.censor_text(run, 'say') is distinct from run then
        insert into public.chat_strikes (who) values (me);
        if not kobby_has_it then
          select count(*) into recent from public.chat_strikes s
           where s.who = me and s.at > now() - interval '10 minutes';
          if recent >= 3 then perform public.mute_chat(me, null::text, 'filter'::text); end if;
        end if;
        raise exception
          'That message was not sent: spelling a word out one letter at a time is still saying it.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  /*
   * The serious ones - telling somebody to harm themselves, a threat - do
   * not wait, and this one is still the filter's even when Kobby is on.
   * Kobby reads the line seconds later and the ladder may lengthen it; what
   * it must not do is leave the next minute of that conversation to a model
   * that has not answered yet. The account is flagged either way, which is
   * what puts a person in front of it.
   */
  if me is not null and public.is_serious(new.body) then
    perform public.mute_chat(
      me, 'Telling somebody to harm themselves, or threatening them, is not allowed here.',
      'filter');
    perform public.flag_account(
      me, 'The filter stopped a threat or an instruction to self-harm.', new.body);
    new.body := public.censor_text(new.body, 'say');
    return new;
  end if;

  masked := public.censor_text(new.body, 'say');

  if masked is distinct from new.body and me is not null then
    insert into public.chat_strikes (who) values (me);

    if not kobby_has_it then
      select count(*) into recent from public.chat_strikes s
       where s.who = me and s.at > now() - interval '10 minutes';
      if recent >= 3 then perform public.mute_chat(me, null::text, 'filter'::text); end if;
    end if;
  end if;

  new.body := masked;
  return new;
end $$;

/** The queue, now keeping the original beside the masked line. */
create or replace function public.queue_for_the_machine()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  author uuid;
  kind text;
  original text;
begin
  /* One branch per table shape - see 0191, and the note in
   * `words_are_censored` above. */
  if tg_table_name = 'community_posts' then
    kind := 'community_post';
    author := new.author_id;
  elsif tg_table_name = 'space_messages' then
    kind := 'space_message';
    author := new.sender_id;
  elsif tg_table_name = 'messages' then
    kind := 'message';
    author := new.sender_id;
  else
    return null;
  end if;

  /*
   * What the censoring trigger was handed, a moment ago, in this same
   * statement. Falling back to the stored line rather than to nothing: a
   * path that inserts without going through that trigger should still put
   * the best text it has in front of the model.
   */
  original := nullif(current_setting('kobbleston.said', true), '');

  insert into public.chat_to_read (kind, ref, who, body, said, was_masked)
  values (kind, new.id::text, author, new.body,
          coalesce(original, new.body), new.body like '%••••%');

  return null;
end $$;

-- ------------------------------------------------------ a spoken line

/**
 * Voice, the same way. `heard_in_voice` holds both halves already - it
 * censors into `clean` and still has `said` - and was storing only the
 * censored one.
 */
create or replace function public.heard_in_voice(said text, where_at text default null)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  clean text;
  made bigint;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  said := btrim(coalesce(said, ''));
  if said = '' then return null; end if;
  if char_length(said) > 2000 then
    said := left(said, 2000);
  end if;

  if (select count(*) from public.chat_to_read c
       where c.who = me and c.kind = 'voice'
         and c.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'That is more than anybody says in a minute.';
  end if;

  clean := public.censor_text(said, 'chat');

  insert into public.chat_to_read (kind, ref, who, body, said, was_masked)
  values ('voice', left(coalesce(where_at, 'voice'), 200), me, clean, said, clean <> said)
  returning id into made;

  return made;
end $$;

grant execute on function public.heard_in_voice(text, text) to authenticated;

-- ------------------------------------------- what the model is handed

/**
 * The work list, with the real line in it.
 *
 * Every branch but the message one is exactly as 0256 left it. That branch
 * now sends `said` - the original - and keeps `(already masked)` on the
 * name, because whether the patterns objected is still a useful thing for
 * the model to know about a line it is now reading in full.
 */
create or replace function public.ai_work(how_many integer default 20)
returns table (subject text, subject_id text, kind text, name text,
               words text, picture text, waiting_minutes integer)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  rules record;
  waiting integer;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    return;
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then return; end if;

  select w.total into waiting from public.ai_work_waiting() w;

  if rules.mode = 'busy' and waiting <= rules.when_over then return; end if;

  return query
    select 'avatar_item', i.id::text, i.kind, i.name,
           coalesce(i.description, ''),
           i.image_path,
           (extract(epoch from now() - i.created_at) / 60)::integer
      from public.avatar_items i
     where i.status = 'pending'
       and (rules.mode <> 'slow' or i.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'asset', a.id::text, a.kind::text, a.name,
           coalesce(a.description, ''),
           a.preview_path,
           (extract(epoch from now() - a.created_at) / 60)::integer
      from public.assets a
     where a.status = 'pending'
       and (rules.mode <> 'slow' or a.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'report', r.id::text, r.reason,
           coalesce(s.label, r.target_type),
           coalesce(r.details, ''),
           null::text,
           (extract(epoch from now() - r.created_at) / 60)::integer
      from public.reports r
      cross join lateral public.report_subject(r.target_type, r.target_id) s
     where r.status = 'open'
       and (rules.mode <> 'slow' or r.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'ticket', t.id::text, t.topic, t.subject,
           coalesce((select m.body from public.support_messages m
                      where m.ticket_id = t.id and not m.from_staff
                      order by m.created_at limit 1), ''),
           null::text,
           (extract(epoch from now() - t.created_at) / 60)::integer
      from public.support_tickets t
     where t.status = 'open' and not t.wants_human
       and (rules.mode <> 'slow' or t.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'appeal', ap.id::text, v.action, coalesce(v.reason, v.rule),
           ap.body,
           null::text,
           (extract(epoch from now() - ap.created_at) / 60)::integer
      from public.appeals ap
      join public.violations v on v.id = ap.violation_id
     where ap.status = 'open' and v.moderator_id is null
       and (rules.mode <> 'slow' or ap.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'message', c.id::text, c.kind,
           coalesce(p.username, 'somebody')
             || case when c.was_masked then ' (already masked)' else '' end,
           coalesce(c.said, c.body),
           null::text,
           (extract(epoch from now() - c.created_at) / 60)::integer
      from public.chat_to_read c
      left join public.profiles p on p.id = c.who
     where c.read_at is null
       and (rules.mode <> 'slow' or c.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'profile_text', n.id::text, n.kind,
           coalesce(p.username, 'somebody'),
           n.body,
           null::text,
           (extract(epoch from now() - n.created_at) / 60)::integer
      from public.names_to_read n
      left join public.profiles p on p.id = n.who
     where n.read_at is null
       and (rules.mode <> 'slow' or n.created_at < now() - make_interval(mins => rules.after_minutes))
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end $$;

grant execute on function public.ai_work(integer) to authenticated, service_role;

-- --------------------------------------- who the card says did it

/*
 * 'machine' meant the pattern list and read like the AI. Both now have
 * their own word, and the rows already written keep theirs rather than
 * being relabelled as something nobody can check - every one of them was
 * the filter, but saying so by rewriting history is how a record stops
 * being one.
 */
alter table public.chat_timeouts drop constraint if exists chat_timeouts_source_check;
alter table public.chat_timeouts add constraint chat_timeouts_source_check
  check (source in ('machine', 'filter', 'kobby', 'staff'));

/*
 * `mute_chat`, with the one word that was doing two jobs.
 *
 * Otherwise exactly as 0226 left it. `by_whom = 'machine'` has meant "not
 * a person" since 0171, and the only thing that ever passed it was the
 * pattern counter - which now passes 'filter' and is the one caller that
 * does. So every remaining 'machine' is Kobby, by construction: the
 * ladder in 0209, `apply_ai_verdict` in 0220, the spoken line in 0225.
 * Mapped here rather than edited into three large functions, because the
 * mapping is a statement about who the callers are and belongs in one
 * place where it can be read.
 *
 * It keeps the seven argument shape. 0208 dropped the three argument one
 * deliberately, and putting it back would make every three argument call
 * ambiguous.
 */
create or replace function public.mute_chat(
  target uuid,
  why text default 'Language that goes against the Kobblon guidelines.',
  by_whom text default 'kobby',
  evidence text default null,
  rule text default null,
  gravity integer default null,
  channels text[] default array['chat']
)
returns timestamptz
language plpgsql security definer
set search_path = public, extensions as $$
declare
  how_long integer;
  ends timestamptz;
  live public.chat_timeouts;
  wanted text[] := coalesce(nullif(channels, '{}'), array['chat']);
  who_did text := case when by_whom = 'machine' then 'kobby' else by_whom end;
begin
  if who_did = 'staff' and not public.is_moderator() then
    raise exception 'Only a moderator does that.';
  end if;

  select * into live from public.chat_timeouts t
   where t.who = target and t.until > now() and t.lifted_at is null
   order by t.until desc limit 1;

  if live.id is not null then
    if not (wanted <@ live.channels) then
      update public.chat_timeouts
         set channels = (
               select array_agg(distinct c order by c)
                 from unnest(live.channels || wanted) as c
             ),
             seen_at = null
       where id = live.id;
    end if;
    return live.until;
  end if;

  how_long := public.next_timeout_minutes(target);
  ends := now() + make_interval(mins => how_long);

  insert into public.chat_timeouts
    (who, until, minutes, reason, source, evidence, rule, gravity, channels)
  values
    (target, ends, how_long,
     left(coalesce(nullif(btrim(coalesce(why, '')), ''),
                   'Language that goes against the Kobblon guidelines.'), 300),
     who_did, left(evidence, 500), rule, gravity, wanted);

  return ends;
end $$;


-- ------------------------------------ evidence stays censored, whoever wrote it

/*
 * The model now reads the uncensored line, so it can now quote one.
 *
 * `judge_chat_line` takes the model's own `quote` and stores it as the
 * evidence on `ai_reviews`, and `mute_chat` stores one on the row the
 * person is shown. 0208 settled what belongs there and was right:
 * "showing somebody a slur back, uncensored, because they typed it is not
 * evidence, it is the platform saying it too". Until today that held for
 * free, because nothing that wrote evidence had ever seen the real line.
 *
 * So it is made to hold on purpose, at the two places evidence is stored
 * rather than in the four functions that store it. A guard in one place
 * cannot be the one somebody forgets to add to a fifth caller - and these
 * are columns people read, so the rule is about the column.
 */
create or replace function public.evidence_is_censored()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
begin
  if tg_table_name = 'ai_reviews' then
    if new.looked_at is not null then
      new.looked_at := public.censor_text(new.looked_at, 'say');
    end if;
  else
    if new.evidence is not null then
      new.evidence := public.censor_text(new.evidence, 'say');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ai_reviews_evidence_censored on public.ai_reviews;
create trigger ai_reviews_evidence_censored
  before insert or update on public.ai_reviews
  for each row execute function public.evidence_is_censored();

drop trigger if exists chat_timeouts_evidence_censored on public.chat_timeouts;
create trigger chat_timeouts_evidence_censored
  before insert or update on public.chat_timeouts
  for each row execute function public.evidence_is_censored();

commit;
