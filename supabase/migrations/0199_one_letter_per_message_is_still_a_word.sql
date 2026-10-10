begin;

-- One letter per message
-- -----------------------------------------------------------------------
--
-- Staw sent four bubbles reading f, u, c, k, y, o, u. Every check this
-- platform has reads one line at a time, and there is nothing wrong with
-- the letter "f". The line was never the unit people say things in; it is
-- only the unit the database happens to store.
--
-- A very short line now joins the recent run of very short lines from the
-- same person in the same conversation, and the run is read as one line
-- by the machinery 0183 already built for "f u c k" typed in one go. A
-- real sentence is not short, so it does not join the run, and the run
-- ages out after three minutes.
--
-- The refusal is on the letter that completes the word, which is the only
-- one that can be stopped - the ones before it are already sent. The
-- strike is recorded the same as for a whole word, so three of these in
-- ten minutes is still a suspension.

CREATE OR REPLACE FUNCTION public.words_are_censored()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  masked text;
  recent integer;
  quiet timestamptz;
  mins integer;
  me uuid := auth.uid();
  run text;
  bits integer;
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
   * One letter per message.
   *
   * Every check so far reads one line at a time, so somebody sending
   * "f", "u", "c", "k" sends four lines with nothing wrong with any of
   * them. The line is not the unit people actually say things in.
   *
   * So when a very short line arrives, the recent run of very short lines
   * from the same person in the same place is read as one line. Only
   * short ones join the run - a real sentence ends it - and the joining
   * is what `spelled_out_spans` was already built to read.
   */
  if me is not null
     and length(regexp_replace(coalesce(new.body, ''), '[^[:alnum:]]', '', 'g')) between 1 and 3
  then
    if tg_table_name = 'messages' then
      select string_agg(b.body, ' ' order by b.created_at), count(*)
        into run, bits
        from (select m.body, m.created_at from public.messages m
               where m.conversation_id = new.conversation_id
                 and m.sender_id = me
                 and m.created_at > now() - interval '3 minutes'
                 and length(regexp_replace(m.body, '[^[:alnum:]]', '', 'g')) between 1 and 3
               order by m.created_at desc limit 11) b;
    elsif tg_table_name = 'space_messages' then
      select string_agg(b.body, ' ' order by b.created_at), count(*)
        into run, bits
        from (select m.body, m.created_at from public.space_messages m
               where m.space_id = new.space_id
                 and m.sender_id = me
                 and m.created_at > now() - interval '3 minutes'
                 and length(regexp_replace(m.body, '[^[:alnum:]]', '', 'g')) between 1 and 3
               order by m.created_at desc limit 11) b;
    elsif tg_table_name = 'community_posts' then
      select string_agg(b.body, ' ' order by b.created_at), count(*)
        into run, bits
        from (select p.body, p.created_at from public.community_posts p
               where p.community_id = new.community_id
                 and p.author_id = me
                 and p.created_at > now() - interval '3 minutes'
                 and length(regexp_replace(p.body, '[^[:alnum:]]', '', 'g')) between 1 and 3
               order by p.created_at desc limit 11) b;
    end if;

    if coalesce(bits, 0) > 0 then
      run := run || ' ' || new.body;
      if public.censor_text(run, 'say') is distinct from run then
        /*
         * The letters before this one are already sent and already read,
         * so there is nothing to mask retroactively that would help. What
         * stops it is this one not landing and the strike being recorded,
         * which is the same answer a whole word would have got.
         */
        insert into public.chat_strikes (who) values (me);
        select count(*) into recent from public.chat_strikes s
         where s.who = me and s.at > now() - interval '10 minutes';
        if recent >= 3 then perform public.mute_chat(me); end if;

        raise exception
          'That message was not sent: spelling a word out one letter at a time is still saying it.'
          using errcode = 'check_violation';
      end if;
    end if;
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
end $function$;

commit;
