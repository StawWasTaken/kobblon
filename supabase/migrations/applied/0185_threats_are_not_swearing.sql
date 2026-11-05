begin;

-- Telling somebody to kill themselves is not swearing
-- -----------------------------------------------------------------------
--
-- Staw, from his own test account to his own real one:
--
--     go die IRL plz
--     suicide yourself
--
-- Both went through. The filter is a list of *words*, and neither of those
-- is a word - they are ordinary words in an order that means something
-- unacceptable. The guidelines are clear about where the line is: common
-- swearing is allowed, and serious insults, real-life threats and telling
-- somebody to end their life are not.
--
-- So this adds the line the guidelines already drew, and it treats it as
-- what it is rather than as a ruder "fuck":
--
--   * the phrase is masked, like anything else on the list
--   * **it counts as a suspension on its own**, not as one strike of three.
--     Somebody who tells another person to kill themselves does not get two
--     more goes at it.
--   * **it opens a report**, so a person or the machine looks at the
--     account rather than only at the message. A chat suspension is five
--     minutes; what that account needs deciding about is not.
--
-- What is deliberately NOT on this list, because the guidelines allow it
-- and because a filter that cannot tell the difference is a filter nobody
-- trusts:
--
--   * `suicide`, `depressed`, `self harm` on their own. Somebody saying
--     they are struggling must not be silenced by the thing that is
--     supposed to protect them. Only the directed forms are here - the
--     ones with "yourself" in them.
--   * `die` on its own. "go die in the lava" is how people talk about a
--     World, and "I died" is a sentence about a game.

alter table public.moderation_terms drop constraint if exists moderation_terms_scope_check;
alter table public.moderation_terms add constraint moderation_terms_scope_check
  check (scope = any (array['all', 'identity', 'say', 'spaced', 'serious']));

insert into public.moderation_terms (pattern, decision, reason, scope) values
  -- Telling somebody to end their life. Every one of these is directed:
  -- it has "yourself" in it, or it says "irl", which is the word people
  -- reach for precisely to make clear they do not mean in the game.
  ('(^|[^a-z])(go\s*)?(kill|end|neck|unalive|off|hang|kms|suicide)\s*(your|ur)\s*self',
   'block', 'Telling somebody to end their life', 'serious'),
  ('(^|[^a-z])(go\s*)?die\s*(irl|in\s*real\s*life)',
   'block', 'Telling somebody to end their life', 'serious'),
  ('(^|[^a-z])go\s*(and\s*)?die(?![a-z])',
   'block', 'Telling somebody to end their life', 'serious'),
  ('(^|[^a-z])(drink|go\s*drink)\s*bleach',
   'block', 'Telling somebody to end their life', 'serious'),
  ('(^|[^a-z])slit\s*(your|ur)\s*(wrist|throat)',
   'block', 'Telling somebody to end their life', 'serious'),
  ('(^|[^a-z])(the\s*world|everyone)\s*(would|will)\s*be\s*better\s*without\s*(you|u)(?![a-z])',
   'block', 'Telling somebody to end their life', 'serious'),
  ('(^|[^a-z])(nobody|no\s*one)\s*(would|will)\s*miss\s*(you|u)(?![a-z])',
   'block', 'Telling somebody to end their life', 'serious'),

  -- Real-life threats. "I will find you" and "I know where you live" are
  -- the two that do not need a weapon named to be a threat.
  ('(^|[^a-z])(i|im|i\s*am|ill|i\s*will|im\s*gonna|i\s*am\s*going\s*to)\s*(going\s*to\s*)?(kill|murder|stab|shoot|beat|hurt|rape|end)\s*(you|u|ur\s*family)(?![a-z])',
   'block', 'A real-life threat', 'serious'),
  ('(^|[^a-z])i\s*know\s*where\s*(you|u)\s*live',
   'block', 'A real-life threat', 'serious'),
  ('(^|[^a-z])(i\s*will|ill|im\s*gonna|im\s*going\s*to)\s*find\s*(you|u)(?![a-z])',
   'block', 'A real-life threat', 'serious'),
  ('(^|[^a-z])(dox+|swat)\s*(you|u|ing\s*you)(?![a-z])',
   'block', 'A real-life threat', 'serious'),
  ('(^|[^a-z])watch\s*(your|ur)\s*back(?![a-z])',
   'block', 'A real-life threat', 'serious')
on conflict (pattern, scope) do nothing;

/**
 * Whether a line crosses the line, rather than merely being rude.
 *
 * Read against the plain letters, so the accents and the alternate
 * alphabets from 0182 do not get somebody past it.
 */
create or replace function public.is_serious(input text)
returns boolean
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  folded text;
  hit record;
begin
  if coalesce(trim(input), '') = '' then return false; end if;
  folded := public.plain_letters(input);

  for hit in select t.pattern from public.moderation_terms t where t.scope = 'serious' loop
    begin
      if folded ~* hit.pattern then return true; end if;
    exception when others then
      null;  -- a pattern that will not run screens nothing
    end;
  end loop;
  return false;
end $$;

grant execute on function public.is_serious(text) to authenticated;

commit;
