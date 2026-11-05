begin;

-- Three letters at a time is still spelling it out
-- -----------------------------------------------------------------------
--
-- 0183 only counted a match when no single piece gave more than two
-- characters, which is what keeps "miss hit" and "traffic k" from being
-- read as one word. It also meant the commonest split bypass went
-- through: "f uck", "shi t", "bit ch", "fuc k" all have a piece of three.
--
-- Three is still far short of a word. The pieces that cause false
-- positives in English - "miss", "hit", "the", "rapist", "pea", "cock" -
-- are four or more, so they stay excluded, and "the rapist" is still read
-- as two words.
CREATE OR REPLACE FUNCTION public.spelled_out_spans(input text)
 RETURNS TABLE(starts_at integer, ends_at integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  folded text;
  squeezed text := '';
  -- Where each squeezed character came from, and which piece it was in.
  came_from integer[] := '{}';
  piece_of integer[] := '{}';
  piece integer := 0;
  was_letter boolean := false;
  ch text;
  is_letter boolean;
  term record;
  at integer;
  found text;
  from_here integer;
  to_here integer;
  counts integer[];
  worst integer;
  pieces integer;
  i integer;
begin
  if coalesce(trim(input), '') = '' then return; end if;

  folded := public.plain_letters(input);

  for i in 1..length(folded) loop
    ch := substr(folded, i, 1);
    is_letter := ch ~ '[a-z0-9]';
    if is_letter then
      if not was_letter then piece := piece + 1; end if;
      squeezed := squeezed || ch;
      came_from := came_from || i;
      piece_of := piece_of || piece;
    end if;
    was_letter := is_letter;
  end loop;

  -- One piece in the whole line means nothing was spelled out, and the
  -- ordinary word pass has already read it.
  if piece < 2 or squeezed = '' then return; end if;

  for term in
    select t.pattern from public.moderation_terms t where t.scope = 'spaced'
  loop
    at := 1;
    loop
      exit when at > length(squeezed);
      found := substring(squeezed from at for length(squeezed)) ~ term.pattern;
      exit when found is null or found = 'false';

      from_here := at - 1 + (regexp_instr(substring(squeezed from at), term.pattern, 1, 1, 0));
      exit when from_here < at;
      to_here := at - 2 + (regexp_instr(substring(squeezed from at), term.pattern, 1, 1, 1));
      exit when to_here < from_here;

      -- How much each piece contributed to this match.
      counts := '{}';
      pieces := 0;
      worst := 0;
      declare
        seen integer[] := '{}';
        which integer;
        n integer;
      begin
        for i in from_here..to_here loop
          which := piece_of[i];
          if not (which = any (seen)) then
            seen := seen || which;
            pieces := pieces + 1;
          end if;
        end loop;
        foreach which in array seen loop
          n := 0;
          for i in from_here..to_here loop
            if piece_of[i] = which then n := n + 1; end if;
          end loop;
          if n > worst then worst := n; end if;
        end loop;
      end;

      /*
       * Three characters, AND the match has to begin where a piece begins
       * and end where a piece ends. The cap alone is not enough: "miss
       * hit" gives "ss"+"hit" and "traffic k" gives "ffic"+"k", both
       * within three, and both read as a word nobody wrote. Somebody
       * splitting a word types the whole of each piece.
       */
      if pieces >= 2 and worst <= 3
         and (from_here = 1 or piece_of[from_here - 1] <> piece_of[from_here])
         and (to_here = array_length(piece_of, 1)
              or piece_of[to_here + 1] <> piece_of[to_here]) then
        starts_at := came_from[from_here];
        ends_at := came_from[to_here];
        return next;
      end if;

      at := from_here + 1;
    end loop;
  end loop;
end $function$;

commit;
