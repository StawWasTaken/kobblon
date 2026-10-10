begin;

-- The refusal said a timestamp at somebody
-- -----------------------------------------------------------------------
--
-- Staw caught this in the dock. A suspended send came back with
--
--     Chat is suspended until 2026-10-10 09:16:28.180809+00.
--
-- which is the row printed at a person. A sanction is the one moment a
-- platform has to sound like it was written by somebody, and that is a
-- database being overheard.
--
-- Two changes here, and both are about what the window can do with it:
--
--   * the message is in minutes, rounded up, with a plural that reads
--   * `errcode` stays `check_violation`, which is how the window knows this
--     particular refusal from any other and can go and re-ask where the
--     person stands rather than guessing from the text
--
-- The second is the one that matters. A suspension given while somebody is
-- sitting in the dock was only ever caught by the send failing, and nothing
-- then told the window - so the box stayed typable and the card never came
-- up. Matching on a code is how that gets fixed without parsing English.

create or replace function public.words_are_censored()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  masked text;
  recent integer;
  quiet timestamptz;
  mins integer;
begin
  -- Quiet already? Then nothing lands at all. The window should have
  -- stopped them, and a window is not where this is decided.
  select t.until into quiet from public.chat_timeouts t
   where t.who = auth.uid() and t.until > now()
   order by t.until desc limit 1;
  if quiet is not null then
    mins := greatest(1, ceil(extract(epoch from quiet - now()) / 60)::integer);
    raise exception 'Chat is suspended for another % minute%.',
      mins, case when mins = 1 then '' else 's' end
      using errcode = 'check_violation';
  end if;

  masked := public.censor_text(new.body, 'say');

  if masked is distinct from new.body and auth.uid() is not null then
    insert into public.chat_strikes (who) values (auth.uid());

    select count(*) into recent from public.chat_strikes s
     where s.who = auth.uid() and s.at > now() - interval '10 minutes';

    if recent >= 3 then
      perform public.mute_chat(auth.uid());
    end if;
  end if;

  new.body := masked;
  return new;
end $$;

commit;
