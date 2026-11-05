begin;

-- Putting the two passes together
-- -----------------------------------------------------------------------
--
-- 0182 reads the letters under the disguise; 0183 finds the words somebody
-- spelled out. This is where `censor_text` uses both, and it is also where
-- the phrase pass stops being blind to accents.
--
-- The order matters and it is not arbitrary. The spelled-out spans are
-- found **first**, against the untouched line, because they are positions -
-- and every mask after that changes the length of the string. Masking from
-- the end backwards is the other half of the same point.
--
-- Still not stricter: no word is added here, and a line with nothing on the
-- list in it comes back exactly as it was written.

/**
 * Bullets over the given spans, back to front.
 *
 * Front to back would be a bug that looks like it works: the first mask is
 * right, and every one after it is off by the difference between what it
 * covered and the four characters that replaced it.
 */
create or replace function public.mask_spans(input text, spans int[][])
returns text
language plpgsql immutable
set search_path = public, extensions as $$
declare
  mask constant text := '••••';
  out text := input;
  i integer;
begin
  if spans is null or array_length(spans, 1) is null then return input; end if;
  for i in reverse array_length(spans, 1)..1 loop
    out := left(out, spans[i][1] - 1) || mask || substr(out, spans[i][2] + 1);
  end loop;
  return out;
end $$;

grant execute on function public.mask_spans(text, int[][]) to authenticated;

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

  /*
   * Spelled out, first, while the positions still mean something. The rule
   * that keeps this from masking "miss hit" is in `spelled_out_spans` and
   * not here.
   */
  for span in select * from public.spelled_out_spans(input) order by starts_at loop
    -- Overlapping spans would mask the same characters twice and shift the
    -- later one onto the wrong place, so a span inside one already taken
    -- is dropped.
    if array_length(spans, 1) is null
       or span.starts_at > spans[array_length(spans, 1)][2] then
      spans := spans || array[array[span.starts_at, span.ends_at]];
    end if;
  end loop;
  input := public.mask_spans(input, spans);

  words := string_to_array(input, ' ');

  foreach word in array words loop
    -- The word without what is hanging off it, so "fuck!" and "(fuck)"
    -- are tested as the word they are.
    bare := regexp_replace(word, '^[^[:alnum:]]+|[^[:alnum:]]+$', '', 'g');
    if bare = '' then
      out := out || word;
      continue;
    end if;

    /*
     * Tested as its plain letters, so "fûck" and the alternate alphabets
     * are read as the word they are - and shown back exactly as typed if
     * there is nothing wrong with it.
     */
    select s.decision into verdict from public.screen_text(public.plain_letters(bare), check_scope) s;
    out := out || case when verdict = 'ok' then word else mask end;
  end loop;

  input := array_to_string(out, ' ');

  /*
   * The phrases - the terms that span words.
   *
   * Matched against the plain letters rather than the raw line, so a
   * phrase in accents is caught too, and then masked by position in the
   * original. The old version ran `regexp_replace` straight over the raw
   * text, which meant every phrase on the list was one accent away from
   * being invisible.
   */
  folded := public.plain_letters(input);
  for hit in
    select t.pattern from public.moderation_terms t
     where (t.scope = 'all' or t.scope = check_scope)
       and t.pattern like '%\s%'
  loop
    begin
      at := 1;
      loop
        exit when at > length(folded);
        from_here := regexp_instr(folded, hit.pattern, at, 1, 0, 'i');
        exit when from_here = 0;
        to_here := regexp_instr(folded, hit.pattern, at, 1, 1, 'i') - 1;
        exit when to_here < from_here;

        /*
         * The patterns that start `(^|[^a-z])` have eaten the character in
         * front of the phrase, which is usually a space. Masking it too
         * would glue the phrase's mask onto the word before it.
         */
        if hit.pattern like '(^|[^a-z])%' and from_here < to_here
           and substr(folded, from_here, 1) !~ '[a-z]' then
          from_here := from_here + 1;
        end if;

        starts := starts || from_here;
        ends := ends || to_here;
        at := to_here + 1;
      end loop;
    exception when others then
      -- A pattern that will not run is a pattern that screens nothing; it
      -- must not take the line down with it.
      null;
    end;
  end loop;

  /*
   * Two patterns can find things in any order, and `mask_spans` works back
   * to front - which needs them sorted, and needs the overlaps gone, or one
   * mask lands inside another's hole.
   */
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

commit;
