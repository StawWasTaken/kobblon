begin;

/*
 * Chat is screened, and it is censored rather than refused.
 *
 * Two things were wrong, and Staw found both in a sentence: "in the
 * chatdocks it shouldnt be possible to say 'fack you'".
 *
 * The first is that the words were wrong, not the plumbing. `messages`
 * has had a trigger on it since 0011 and it works: it raises on a hit and
 * the message never lands. "fack" simply matched nothing, because the
 * patterns matched *spellings* rather than words, and a vowel swap is the
 * first thing anybody tries.
 *
 * The second is the shape of the answer. 0168 refused a line outright, and
 * the reasoning — that a censored line still says the thing — is not the
 * call I get to make. Staw: "IT CENSORS WORDS OR SENTENCES JUST LIKE
 * ROBLOX DID WITH HASHTAGS BUT US ITS ••••". He is right about the
 * behaviour people expect, and it is kinder besides: a message that half
 * arrives tells you what happened, where a message that vanishes reads as
 * the site being broken.
 *
 * And "fack" is the real lesson. The patterns matched spellings rather
 * than words, so every vowel swap was a way through — which is most of
 * what anybody tries.
 */

/*
 * Words rather than spellings.
 *
 * `normalize_for_screening` already undoes digit-for-letter tricks and
 * collapses runs, so `f4ck` and `fuuuuck` were caught. A vowel swap was
 * not: `fack`, `fick`, `feck`, `fok`. These patterns take the consonants
 * as the word and let the vowels be anything.
 *
 * The lookahead is what keeps this from eating English. `f[uaeio]{1,2}c*k`
 * matches the `fak` inside `fake`, `faking` and `faked`, and a filter that
 * censors "fake" is a filter people route around rather than accept — so
 * each one refuses to match when a letter follows.
 */
insert into public.moderation_terms (pattern, decision, reason, scope)
select v.pattern, 'block'::public.screen_decision, v.reason, 'all'
  from (values
    ('(^|[^a-z])f[uaeio]{1,2}c*k+(?![a-z])', 'Strong language'),
    -- No `e` in here, and that is not an oversight: `sh` + `ee` + `t` is
    -- "sheet", which a filter must not eat. Caught by writing the cases
    -- down and running them rather than by reading the pattern.
    ('(^|[^a-z])sh[ia1y]{1,2}t+(?![a-z])', 'Strong language'),
    ('(^|[^a-z])b[iy1]+t?ch', 'Strong language'),
    ('(^|[^a-z])c+u+n+t+(?![a-z])', 'Strong language'),
    ('(^|[^a-z])a+s+h+[o0]+l+e', 'Strong language'),
    ('(^|[^a-z])d[iy1]+c*k+h[e3a]+d', 'Strong language'),
    ('(^|[^a-z])n+[i1y]+g+[aeu3]*r*(?![a-z])', 'A slur'),
    ('(^|[^a-z])f+[a4@]+g+[oi]*t*(?![a-z])', 'A slur'),
    ('(^|[^a-z])k+y+s+(?![a-z])', 'Telling someone to hurt themselves')
  ) as v(pattern, reason)
 where not exists (
   select 1 from public.moderation_terms t where t.pattern = v.pattern and t.scope = 'all'
 );

/**
 * The same sentence with the bad words taken out of it.
 *
 * Word by word, because that is the only pass that works on what somebody
 * actually typed. The patterns match *normalised* text — vowels undone,
 * runs collapsed, punctuation stripped — so running one over the original
 * finds nothing the moment anybody writes `f4ck`. Testing each word
 * separately and replacing the whole word keeps the original intact
 * everywhere else, and it is what Roblox's hashes did: the word goes, the
 * sentence stays.
 *
 * Then a second pass for the phrases, since "kill your self" is three
 * words that are each harmless.
 *
 * It never returns null and never raises. This runs inside a trigger on
 * every message anybody sends, and a filter that can refuse to answer is a
 * chat that can refuse to work.
 */
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
begin
  if coalesce(trim(input), '') = '' then return input; end if;

  words := string_to_array(input, ' ');

  foreach word in array words loop
    -- The word without what is hanging off it, so "fuck!" and "(fuck)"
    -- are tested as the word they are.
    bare := regexp_replace(word, '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g');
    if bare = '' then
      out := out || word;
      continue;
    end if;

    select s.decision into verdict from public.screen_text(bare, check_scope) s;
    out := out || case when verdict = 'ok' then word else mask end;
  end loop;

  input := array_to_string(out, ' ');

  /*
   * The phrases. Only the terms that span words need this, and they are
   * matched against the original text rather than the normalised one, so
   * this catches the plain spelling and the word pass above catches the
   * rest.
   */
  for hit in
    select t.pattern from public.moderation_terms t
     where (t.scope = 'all' or t.scope = check_scope)
       and t.pattern like '%\s%'
  loop
    begin
      input := case
        when hit.pattern like '(^|[^a-z])%'
          then regexp_replace(input, hit.pattern, '\1' || mask, 'gi')
        else regexp_replace(input, hit.pattern, mask, 'gi')
      end;
    exception when others then
      -- A term somebody typed into the table wrongly is not a reason for
      -- nobody to be able to talk.
      null;
    end;
  end loop;

  return input;
end $$;

grant execute on function public.censor_text(text, text) to authenticated;

/*
 * `screen_say` hands back the censored line as well as the verdict.
 *
 * The return type changes, so it is dropped rather than replaced. A caller
 * that only wants to know whether it was clean reads `allowed`; a chat
 * window sends `clean` and nobody is left wondering where their message
 * went.
 */
drop function if exists public.screen_say(text);

create function public.screen_say(words text)
returns table (allowed boolean, clean text, reason text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  masked text := public.censor_text(words, 'say');
begin
  return query select
    masked is not distinct from words,
    masked,
    case when masked is not distinct from words then null
         else 'Some of that cannot be said here.' end;
end $$;

grant execute on function public.screen_say(text) to authenticated;

/*
 * What happens to a line that has something in it.
 *
 * Three tables where people talk - private messages, Space chat, and
 * posts in a Community - censor rather than refuse. Everything else keeps
 * refusing, and that split is deliberate: a username or the name of a
 * World is a label that has to be *chosen* again, and "••••" is not a
 * name. A sentence can lose a word and still be the sentence.
 *
 * The old blocking triggers on those three come off rather than being
 * left to run after this one. Two triggers deciding the same question
 * where one has already rewritten the answer is a thing that works by the
 * alphabet, and the next person to add a trigger named `aaa_` finds out.
 */
create or replace function public.words_are_censored()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  new.body := public.censor_text(new.body, 'say');
  return new;
end $$;

drop trigger if exists messages_screen on public.messages;
drop trigger if exists messages_screen_edit on public.messages;
drop trigger if exists messages_are_screened on public.messages;
drop trigger if exists messages_are_censored on public.messages;
create trigger messages_are_censored before insert or update of body on public.messages
  for each row execute function public.words_are_censored();

drop trigger if exists space_messages_screen on public.space_messages;
drop trigger if exists space_messages_are_censored on public.space_messages;
create trigger space_messages_are_censored before insert or update of body on public.space_messages
  for each row execute function public.words_are_censored();

drop trigger if exists community_posts_screen on public.community_posts;
drop trigger if exists community_posts_are_censored on public.community_posts;
create trigger community_posts_are_censored before insert or update of body on public.community_posts
  for each row execute function public.words_are_censored();

commit;
