begin;

/*
 * Voice.
 *
 * Text is screened on the way into the table: there is no path into a
 * message that skips the trigger, which is why "censored, not refused"
 * could be promised at all. Voice has no equivalent and cannot have one -
 * a word is in somebody's ears before anything could look at it. So voice
 * moderation is the same clothes on a different thing:
 *
 *   * it is after the fact, from a report, never a filter in the path;
 *   * the sanction is the one that already exists, `chat_timeouts`, whose
 *     `channels` column has carried `'voice'` since it was written;
 *   * the ladder is the same ladder. Somebody told to stop who moves from
 *     typing it to saying it has not improved, so a voice suspension
 *     counts on `next_timeout_minutes` with everything else.
 *
 * Nothing here records anybody. A pass over a recording is a policy
 * decision before it is a feature, and the Guidelines do not say it yet.
 *
 * What was missing was never the table. It was that every road to it
 * stopped short: `what_kobby_may_do` could return `quieted_voice` and
 * `apply_ai_verdict` refused the word; `take_report` had no voice action,
 * so the one rung a report could reach landed as a chat suspension; and
 * `mute_chat` returned early when somebody was already quiet, which would
 * have made a voice suspension on top of a chat one do nothing at all and
 * report success.
 */

-- ------------------------------------------------- what the rows may say

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile','space','message','ad','asset','community',
                         'style','avatar_item','voice'));

alter table public.reports drop constraint if exists reports_outcome_check;
alter table public.reports add constraint reports_outcome_check
  check (outcome is null or outcome in ('none','warning','content_removed',
                                        'chat_suspension','voice_suspension',
                                        'suspension','termination'));

-- The violation points back at what the report was about, so the same word
-- has to be allowed here. Caught by taking a real voice report in testing,
-- not by reading: the insert is three functions deep.
alter table public.violations drop constraint if exists violations_target_type_check;
alter table public.violations add constraint violations_target_type_check
  check (target_type is null or target_type in
         ('profile','space','message','asset','style_item','comment','world',
          'community','avatar_item','ad','style','voice'));

alter table public.violations drop constraint if exists violations_action_check;
alter table public.violations add constraint violations_action_check
  check (action in ('warning','content_removed','feature_block',
                    'chat_suspension','voice_suspension','suspension',
                    'termination'));

-- ------------------------------------------- quieting somebody for real

/**
 * Quiet somebody, in the channels asked for.
 *
 * The early return was right for what it was for - two reports about the
 * same hour should not stack two timeouts - and wrong the moment the
 * channels differ. Somebody chat-quieted who is then reported for voice
 * would have had the existing row handed back and their microphone left
 * live, and the caller would have been told a time as though it had
 * worked.
 *
 * So a live timeout that does not cover what is being asked for is
 * widened rather than replaced: the clock it is already serving is not
 * restarted, which would be a second punishment for the first thing.
 */
create or replace function public.mute_chat(
  target uuid,
  why text default 'Language that goes against the Kobblon guidelines.',
  by_whom text default 'machine',
  evidence text default null,
  rule text default null,
  gravity integer default null,
  channels text[] default array['chat']
) returns timestamptz
language plpgsql security definer
set search_path = public, extensions as $$
declare
  how_long integer;
  ends timestamptz;
  live public.chat_timeouts;
  wanted text[] := coalesce(nullif(channels, '{}'), array['chat']);
begin
  if by_whom = 'staff' and not public.is_moderator() then
    raise exception 'Only a moderator does that.';
  end if;

  select * into live from public.chat_timeouts t
   where t.who = target and t.until > now()
   order by t.until desc limit 1;

  if live.id is not null then
    if not (wanted <@ live.channels) then
      update public.chat_timeouts
         set channels = (
               select array_agg(distinct c order by c)
                 from unnest(live.channels || wanted) as c
             ),
             -- Re-shown, because the card they were given said chat and
             -- the truth now says more than that.
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
    (target, ends, how_long, left(coalesce(why, ''), 300), by_whom,
     left(evidence, 500), rule, gravity, wanted);

  return ends;
end $$;

/**
 * What the client asks before it opens a microphone.
 *
 * A browser deciding this for itself is a browser that can decide the
 * other way, so the application asks and the answer is the row. It is
 * cheap enough to ask on joining and again when a timeout is said to be
 * over.
 */
create or replace function public.may_i_speak()
returns table (chat boolean, voice boolean, until timestamptz, why text)
language sql stable security definer
set search_path = public, extensions as $$
  select
    not coalesce(bool_or('chat' = any (t.channels)), false),
    not coalesce(bool_or('voice' = any (t.channels)), false),
    max(t.until),
    max(t.reason)
    from public.chat_timeouts t
   where t.who = auth.uid() and t.until > now()
$$;

revoke all on function public.may_i_speak() from public;
grant execute on function public.may_i_speak() to authenticated;

-- -------------------------------------------- a report about what was said

/**
 * `report_subject`, which now knows what a voice report is about.
 *
 * A voice report names the person, because there is nothing else to name:
 * no row, no file, no line to quote. The label says so rather than
 * reading like a profile report, since the two take different actions.
 */
create or replace function public.report_subject(kind text, which text)
returns table (owner_id uuid, label text, link text, gone boolean)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare id_as_uuid uuid;
begin
  begin
    id_as_uuid := which::uuid;
  exception when others then
    id_as_uuid := null;
  end;

  if kind = 'profile' then
    return query select p.id, p.username, '/u/' || p.username, false
                   from public.profiles p where p.id = id_as_uuid;
  elsif kind = 'voice' then
    return query select p.id, p.username || ', in voice', '/u/' || p.username, false
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
    return query select d.buyer_id, 'An advert', d.target_path, not d.is_active
                   from public.ads d where d.id = id_as_uuid;
  end if;

  if not found then
    return query select null::uuid, 'This has been deleted', null::text, true;
  end if;
end $$;

commit;
