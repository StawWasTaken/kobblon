begin;

-- A mask the length of the word
-- -----------------------------------------------------------------------
--
-- Every masked word came back as exactly four bullets, whatever it was.
-- Staw's point: a censored word should lose its letters, not its shape -
-- "fucker" is six characters and should come back as six bullets.
--
-- It is not only cosmetic. A fixed-width mask is the same mark for every
-- word on the list, so the line reads as "something was removed here" and
-- nothing else. One bullet per letter keeps the sentence's rhythm, and
-- keeps a long word from hiding behind the same four dots as a short one.

create or replace function public.mask_spans(input text, spans int[][])
returns text
language plpgsql immutable
set search_path = public, extensions as $$
declare
  out text := input;
  i integer;
  wide integer;
begin
  if spans is null or array_length(spans, 1) is null then return input; end if;
  for i in reverse array_length(spans, 1)..1 loop
    -- As wide as what it covers, for the same reason as above.
    wide := spans[i][2] - spans[i][1] + 1;
    out := left(out, spans[i][1] - 1) || repeat('•', wide) || substr(out, spans[i][2] + 1);
  end loop;
  return out;
end $$;

grant execute on function public.mask_spans(text, int[][]) to authenticated;

CREATE OR REPLACE FUNCTION public.censor_text(input text, check_scope text DEFAULT 'say'::text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    /*
     * One bullet per letter, so the shape of what was said survives:
     * "fucker" comes back as six bullets, not four. A fixed four told
     * everybody that a word had been masked and nothing about how long it
     * was, which read as the same mask for every word on the list.
     *
     * Only the letters go. The punctuation hanging off the token is kept
     * where it was, so "(fucker)" keeps its brackets.
     */
    out := out || case when verdict = 'ok' then word
                       else replace(word, bare, repeat('•', length(bare))) end;
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
end $function$;

commit;
