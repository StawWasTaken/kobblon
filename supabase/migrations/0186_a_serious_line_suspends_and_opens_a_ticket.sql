begin;

-- What happens when somebody crosses the line
-- -----------------------------------------------------------------------
--
-- 0185 wrote down where the line is. This is the response, and the reason
-- it is its own file is that the response is the part with a judgement in
-- it rather than a pattern.
--
--   * the phrase is masked, which needs `censor_text` to read the new
--     scope - it was only reading 'all' and the caller's own
--   * **a chat suspension immediately**, not a strike. Three goes is right
--     for swearing, where the first one may be a slip. Telling somebody to
--     kill themselves is not a slip.
--   * **a report is opened about the account.** This is the part that
--     matters most: five minutes of quiet is not the answer to somebody
--     who says that to another person, and the only thing that can decide
--     what is are the people - or the machine - reading the queue. The
--     filter's job is to stop the message and raise a hand, not to decide.
--
-- The report is filed as Kobblon rather than as the person who received
-- it, because the person who received it has not asked for anything and
-- may not even have read it yet. One an hour per account, so a bad evening
-- is one ticket rather than forty.

create or replace function public.censor_text(input text, check_scope text default 'say')
returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  mask constant text := '••••';
  words text[];
  word text;
  bare text;
  out text[] := '{}';
  verdict public.screen_decision;
  hit record;
  spans int[][] := '{}';
  span record;
  folded text;
  at integer;
  from_here integer;
  to_here integer;
  starts int[] := '{}';
  ends int[] := '{}';
begin
  if coalesce(trim(input), '') = '' then return input; end if;

  for span in select * from public.spelled_out_spans(input) order by starts_at loop
    if array_length(spans, 1) is null
       or span.starts_at > spans[array_length(spans, 1)][2] then
      spans := spans || array[array[span.starts_at, span.ends_at]];
    end if;
  end loop;
  input := public.mask_spans(input, spans);

  words := string_to_array(input, ' ');

  foreach word in array words loop
    bare := regexp_replace(word, '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g');
    if bare = '' then
      out := out || word;
      continue;
    end if;
    select s.decision into verdict from public.screen_text(public.plain_letters(bare), check_scope) s;
    out := out || case when verdict = 'ok' then word else mask end;
  end loop;

  input := array_to_string(out, ' ');

  /*
   * The phrases, now including the serious ones. 'serious' is not a scope
   * a caller passes - it applies wherever anybody is writing to anybody,
   * which is every scope there is.
   */
  folded := public.plain_letters(input);
  for hit in
    select t.pattern from public.moderation_terms t
     where (t.scope = 'all' or t.scope = 'serious' or t.scope = check_scope)
       and (t.pattern like '%\s%' or t.scope = 'serious')
  loop
    begin
      at := 1;
      loop
        exit when at > length(folded);
        from_here := regexp_instr(folded, hit.pattern, at, 1, 0, 'i');
        exit when from_here = 0;
        to_here := regexp_instr(folded, hit.pattern, at, 1, 1, 'i') - 1;
        exit when to_here < from_here;

        if hit.pattern like '(^|[^a-z])%' and from_here < to_here
           and substr(folded, from_here, 1) !~ '[a-z]' then
          from_here := from_here + 1;
        end if;

        starts := starts || from_here;
        ends := ends || to_here;
        at := to_here + 1;
      end loop;
    exception when others then
      null;
    end;
  end loop;

  if array_length(starts, 1) is not null then
    spans := '{}';
    for span in
      select s as starts_at, e as ends_at
        from unnest(starts, ends) as t(s, e)
       order by s
    loop
      if array_length(spans, 1) is null
         or span.starts_at > spans[array_length(spans, 1)][2] then
        spans := spans || array[array[span.starts_at, span.ends_at]];
      end if;
    end loop;
    input := public.mask_spans(input, spans);
  end if;

  return input;
end $$;

grant execute on function public.censor_text(text, text) to authenticated;

/**
 * Raising a hand about an account, rather than only stopping a message.
 *
 * One an hour per account: a filter that opens a ticket per message turns
 * the queue into the thing nobody reads.
 */
create or replace function public.flag_account(target uuid, why text, said text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare kobblon uuid;
begin
  if target is null then return; end if;

  select id into kobblon from public.profiles where username = 'kobblon' limit 1;
  -- Filed as Kobblon rather than as whoever received it: they have not
  -- asked for anything and may not have read it yet. With no Kobblon
  -- account there is nobody to file as, and a report with no reporter is
  -- not a row this table will take.
  if kobblon is null then return; end if;

  if exists (
    select 1 from public.reports r
     where r.target_type = 'profile' and r.target_id = target::text
       and r.reporter_id = kobblon and r.status = 'open'
       and r.created_at > now() - interval '1 hour'
  ) then return; end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (kobblon, 'profile', target::text, 'harassment',
          left(why || E'\n\nWhat was written: ' || coalesce(said, ''), 1000));
end $$;

grant execute on function public.flag_account(uuid, text, text) to authenticated;

create or replace function public.words_are_censored()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  masked text;
  recent integer;
  quiet timestamptz;
  mins integer;
  me uuid := auth.uid();
begin
  select t.until into quiet from public.chat_timeouts t
   where t.who = me and t.until > now()
   order by t.until desc limit 1;
  if quiet is not null then
    mins := greatest(1, ceil(extract(epoch from quiet - now()) / 60)::integer);
    raise exception 'Chat is suspended for another % minute%.',
      mins, case when mins = 1 then '' else 's' end
      using errcode = 'check_violation';
  end if;

  /*
   * The serious ones first, and they do not wait for a third go. Read off
   * the original rather than the masked line: by the time it is masked the
   * phrase is bullets and there is nothing left to recognise.
   */
  if me is not null and public.is_serious(new.body) then
    perform public.mute_chat(
      me, 'Telling somebody to harm themselves, or threatening them, is not allowed here.',
      'machine');
    perform public.flag_account(
      me, 'The filter stopped a threat or an instruction to self-harm.', new.body);
    new.body := public.censor_text(new.body, 'say');
    return new;
  end if;

  masked := public.censor_text(new.body, 'say');

  if masked is distinct from new.body and me is not null then
    insert into public.chat_strikes (who) values (me);

    select count(*) into recent from public.chat_strikes s
     where s.who = me and s.at > now() - interval '10 minutes';

    if recent >= 3 then
      perform public.mute_chat(me);
    end if;
  end if;

  new.body := masked;
  return new;
end $$;

commit;
