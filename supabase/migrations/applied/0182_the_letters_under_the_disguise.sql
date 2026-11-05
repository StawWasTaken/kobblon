begin;

-- Reading what somebody actually wrote
-- -----------------------------------------------------------------------
--
-- Staw: people are getting past the filter with "f c k you", with accents -
-- î û ã - and with the alternate alphabets, 𝕥𝕙𝕖𝕤𝕖 𝕗𝕠𝕟𝕥𝕤. All three are the
-- same trick: write the word in characters that are not the characters the
-- pattern is looking for.
--
-- **This does not make Kobblon stricter and it must not.** No word is added
-- to the list, no decision changes, and a line that was fine yesterday is
-- fine today. What changes is only that the filter reads the letters
-- underneath the disguise before it decides.
--
-- This file does the reading. 0183 does the spacing, which is a different
-- problem and a much more dangerous one.
--
-- The rule the whole thing is built on: **every mapping is one character to
-- one character.** `plain_letters` returns a string the same length as the
-- one it was given, so a position in the answer is a position in the
-- original, and the censoring can put bullets over exactly the right
-- characters. A fold that deletes anything loses that and starts masking
-- the wrong part of the line.

/**
 * The plain letters under whatever somebody typed.
 *
 * Alternate alphabets, accents and the invisible characters, folded down to
 * lowercase ASCII, one character for one character.
 *
 * The alphabets are arithmetic rather than a table: every mathematical
 * alphabet is 26 letters in a row, so the block is found and the offset
 * taken. The exceptions are the handful of letters Unicode did not repeat
 * in those blocks because they already existed in Letterlike Symbols -
 * italic h, script B, fraktur C and so on - which are listed by hand
 * because there is nothing to compute.
 */
create or replace function public.plain_letters(input text)
returns text
language plpgsql immutable
set search_path = public, extensions as $$
declare
  out text := '';
  ch text;
  code integer;
  base integer;
  -- The start of each run of 26, in the order A-Z then a-z.
  letters constant integer[] := array[
    119808 /* U+1D400 */, 119834 /* U+1D41A */,  -- bold
    119860 /* U+1D434 */, 119886 /* U+1D44E */,  -- italic
    119912 /* U+1D468 */, 119938 /* U+1D482 */,  -- bold italic
    119964 /* U+1D49C */, 119990 /* U+1D4B6 */,  -- script
    120016 /* U+1D4D0 */, 120042 /* U+1D4EA */,  -- bold script
    120068 /* U+1D504 */, 120094 /* U+1D51E */,  -- fraktur
    120120 /* U+1D538 */, 120146 /* U+1D552 */,  -- double struck
    120172 /* U+1D56C */, 120198 /* U+1D586 */,  -- bold fraktur
    120224 /* U+1D5A0 */, 120250 /* U+1D5BA */,  -- sans serif
    120276 /* U+1D5D4 */, 120302 /* U+1D5EE */,  -- sans serif bold
    120328 /* U+1D608 */, 120354 /* U+1D622 */,  -- sans serif italic
    120380 /* U+1D63C */, 120406 /* U+1D656 */,  -- sans serif bold italic
    120432 /* U+1D670 */, 120458 /* U+1D68A */   -- monospace
  ];
  -- The same for digits, which come in five flavours of ten.
  digits constant integer[] := array[
    120782 /* U+1D7CE */, 120792 /* U+1D7D8 */, 120802 /* U+1D7E2 */, 120812 /* U+1D7EC */, 120822 /* U+1D7F6 */
  ];
  start integer;
  done boolean;
begin
  if input is null then return null; end if;

  for i in 1..length(input) loop
    ch := substr(input, i, 1);
    code := ascii(ch);
    done := false;

    -- The alternate alphabets, by arithmetic.
    foreach start in array letters loop
      if code >= start and code < start + 26 then
        out := out || chr(ascii('a') + (code - start));
        done := true;
        exit;
      end if;
    end loop;

    if not done then
      foreach start in array digits loop
        if code >= start and code < start + 10 then
          out := out || chr(ascii('0') + (code - start));
          done := true;
          exit;
        end if;
      end loop;
    end if;

    if not done then
      out := out || case
        -- The letters Unicode had already put in Letterlike Symbols, so the
        -- blocks above have holes where they would have been.
        when code = 8462 /* U+210E */ then 'h'   -- italic h
        when code in (8492 /* U+212C */, 119991 /* U+1D4B7 */) then 'b'
        when code in (8496 /* U+2130 */, 8455 /* U+2107 */) then 'e'
        when code = 8497 /* U+2131 */ then 'f'
        when code in (8459 /* U+210B */, 8460 /* U+210C */, 8461 /* U+210D */) then 'h'
        when code in (8464 /* U+2110 */, 8465 /* U+2111 */, 8505 /* U+2139 */) then 'i'
        when code = 8466 /* U+2112 */ then 'l'
        when code = 8499 /* U+2133 */ then 'm'
        when code = 8469 /* U+2115 */ then 'n'
        when code in (8473 /* U+2119 */, 8472 /* U+2118 */) then 'p'
        when code = 8474 /* U+211A */ then 'q'
        when code in (8475 /* U+211B */, 8476 /* U+211C */, 8477 /* U+211D */) then 'r'
        when code = 8484 /* U+2124 */ then 'z'
        when code = 8488 /* U+2128 */ then 'z'
        when code in (8450 /* U+2102 */, 8493 /* U+212D */) then 'c'
        when code = 8517 /* U+2145 */ then 'd'
        when code in (8518 /* U+2146 */, 8519 /* U+2147 */) then 'd'

        -- Fullwidth, which is its own block and also 26 in a row.
        when code between 65313 /* U+FF21 */ and 65338 /* U+FF3A */ then chr(ascii('a') + code - 65313 /* U+FF21 */)
        when code between 65345 /* U+FF41 */ and 65370 /* U+FF5A */ then chr(ascii('a') + code - 65345 /* U+FF41 */)
        when code between 65296 /* U+FF10 */ and 65305 /* U+FF19 */ then chr(ascii('0') + code - 65296 /* U+FF10 */)

        -- Circled and parenthesised letters.
        when code between 9398 /* U+24B6 */ and 9423 /* U+24CF */ then chr(ascii('a') + code - 9398 /* U+24B6 */)
        when code between 9424 /* U+24D0 */ and 9449 /* U+24E9 */ then chr(ascii('a') + code - 9424 /* U+24D0 */)

        /*
         * A combining mark is a second character sitting on the first, so
         * deleting it would shorten the string and move every position
         * after it. It becomes a full stop instead - a separator, which is
         * what the spacing pass in 0183 throws away anyway.
         */
        when code between 768 /* U+0300 */ and 879 /* U+036F */ then '.'
        when code in (8203 /* U+200B */, 8204 /* U+200C */, 8205 /* U+200D */, 65279 /* U+FEFF */, 173 /* U+00AD */) then '.'

        else lower(
          -- The accents. `translate` is one character for one character,
          -- which is the whole requirement.
          translate(ch,
            'àáâãäåāăąÀÁÂÃÄÅĀĂĄ' ||
            'èéêëēĕėęěÈÉÊËĒĔĖĘĚ' ||
            'ìíîïĩīĭįÌÍÎÏĨĪĬĮ' ||
            'òóôõöøōŏőÒÓÔÕÖØŌŎŐ' ||
            'ùúûüũūŭůűÙÚÛÜŨŪŬŮŰ' ||
            'çćĉċčÇĆĈĊČñńņňÑŃŅŇ' ||
            'ýÿŷÝŸŶšśŝşŠŚŜŞžźżŽŹŻ' ||
            'ţťŧŢŤŦłľĺļŁĽĹĻŕŗřŔŖŘ' ||
            'ďđĎĐģğĝġĢĞĜĠ',
            'aaaaaaaaaaaaaaaaaa' ||
            'eeeeeeeeeeeeeeeeee' ||
            'iiiiiiiiiiiiiiii' ||
            'oooooooooooooooooo' ||
            'uuuuuuuuuuuuuuuuuu' ||
            'cccccccccccnnnnnnnn' ||
            'yyyyyysssssssssszzzzzz' ||
            'ttttttlllllllllrrrrrr' ||
            'ddddgggggggg'
          )
        )
      end;
    end if;
  end loop;

  return out;
end $$;

grant execute on function public.plain_letters(text) to anon, authenticated;

commit;
