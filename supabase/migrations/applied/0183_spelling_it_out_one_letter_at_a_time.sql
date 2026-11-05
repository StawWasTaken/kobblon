begin;

-- "f c k you"
-- -----------------------------------------------------------------------
--
-- The other half of what Staw reported, and the half that can do real harm
-- if it is done carelessly.
--
-- Spacing a word out defeats the filter because the filter tests words, and
-- "f", "c" and "k" are not words. The obvious fix - throw away the spaces
-- and test what is left - is also the obvious way to start censoring
-- innocent people, because once the spaces are gone **"miss hit" contains
-- "sshit"** and "traffic k" contains "fick". A filter that masks those is
-- worse than one that misses "f c k", because the person it accuses did
-- nothing and has no idea what they did.
--
-- So the squeezed text is only ever consulted under a structural rule:
--
--   **a match counts only if it is spread across two or more pieces and no
--   single piece gave it more than two characters.**
--
-- That is the shape of somebody spelling a word out, and it is not the
-- shape of two ordinary words sitting next to each other. "f c k" gives one
-- character per piece. "miss hit" gives three from "hit", so it is left
-- alone. The rule is deliberately on the cautious side: "shi t" gets
-- through it, and that is the right way to be wrong.
--
-- These patterns are their own scope and are **never** used on ordinary
-- text. They have no vowels in them and would be far too loose if they
-- were - which is exactly why they only run where the structure already
-- says somebody was spelling something out.

alter table public.moderation_terms drop constraint if exists moderation_terms_scope_check;
alter table public.moderation_terms add constraint moderation_terms_scope_check
  check (scope = any (array['all', 'identity', 'say', 'spaced']));

/**
 * The spans of a line where somebody spelled something out.
 *
 * Returns positions in the original string, so the caller masks exactly
 * what was written rather than its own idea of it.
 */
create or replace function public.spelled_out_spans(input text)
returns table (starts_at integer, ends_at integer)
language plpgsql stable
set search_path = public, extensions as $$
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

      if pieces >= 2 and worst <= 2 then
        starts_at := came_from[from_here];
        ends_at := came_from[to_here];
        return next;
      end if;

      at := from_here + 1;
    end loop;
  end loop;
end $$;

grant execute on function public.spelled_out_spans(text) to authenticated;

/*
 * The skeletons. No vowels, because somebody spelling a word out usually
 * drops them - and because the structural rule above is what keeps them
 * safe, not the patterns themselves.
 *
 * Nothing is added to what Kobblon considers unacceptable here. Every one
 * of these is a word already on the list, written without its vowels.
 */
insert into public.moderation_terms (pattern, decision, reason, scope) values
  ('f+[uaeio]*c*k+',        'block', 'Spelled out', 'spaced'),
  ('s+h+[iaeyu]*t+',        'block', 'Spelled out', 'spaced'),
  ('b+[iaey]*t+c+h+',       'block', 'Spelled out', 'spaced'),
  ('c+u*n+t+',              'block', 'Spelled out', 'spaced'),
  ('d+[iy]*c+k+h+[ae]*d+',  'block', 'Spelled out', 'spaced'),
  ('n+[i1]*g+g+[aeu]*r*',   'block', 'Spelled out', 'spaced'),
  ('f+[a4]*g+g*[oi]*t*',    'block', 'Spelled out', 'spaced'),
  ('r+[e3]*t+[a4]*r+d+',    'block', 'Spelled out', 'spaced'),
  ('k+y+s+',                'block', 'Spelled out', 'spaced'),
  ('w+h+[o0]*r+[e3]*',      'block', 'Spelled out', 'spaced')
on conflict (pattern, scope) do nothing;

commit;
