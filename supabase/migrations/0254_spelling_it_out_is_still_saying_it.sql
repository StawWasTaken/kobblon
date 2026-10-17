begin;

/*
 * `f_u_c_k` went through the handle check, and so did every other word
 * anybody cared to space out.
 *
 * Reported to Staw on Discord by somebody who tried it: "anything with _
 * works". It is not a hole in the list - the list has the word - it is the
 * flattening in front of it. `normalize_for_screening` turns every
 * character that is not a letter or a digit into a **space**, so `f_u_c_k`
 * arrives at the patterns as `f u c k`, which no pattern for `fuck` can
 * match. The screening was reading the evasion and looking up the evasion.
 *
 * Two new readings of the same text, and the care is in which one is used
 * where:
 *
 *   * `squash_for_screening` removes every separator rather than replacing
 *     it: `f_u_c_k` and `f.u.c.k` and `F U C K` all become `fuck`.
 *   * It is applied to **everything** in `identity` scope, because a handle
 *     or a display name is a short string with no sentence in it, and
 *     joining it up cannot run two innocent words together into a third.
 *   * In chat it is applied **only when the text is actually spelled out** -
 *     three or more single letters in a row, each on its own. That is the
 *     evasion and nothing else: an ordinary sentence is left alone, so
 *     "a class act" cannot be squashed into something that matches.
 *
 * And the patterns. Nearly every one is written `(^|[^a-z])(word|other)` -
 * a guard so `ass` does not catch `class` - which still works on a squashed
 * string when the word lands at the front, and cannot match when the
 * squashing has put a letter in front of it: `my_f_u_c_k` squashes to
 * `myfuck`. So the guard is dropped - and only that guard, nothing else the
 * pattern says - but **only for text that is actually spelled out**. That
 * matters: dropping it for every handle would make `classy` an `ass`, which
 * is exactly the false positive the guard was written for.
 */

/** Every separator gone, rather than turned into a space. */
create or replace function public.squash_for_screening(input text)
returns text language sql immutable as $$
  select regexp_replace(
           translate(lower(coalesce(input, '')), '0134578@$!|', 'oleastbasi'),
           '[^a-z0-9]+', '', 'g');
$$;

/**
 * Whether this text is somebody spelling a word out.
 *
 * Three or more single letters each standing alone. `f u c k` and `f_u_c_k`
 * and `f-u-c-k` are this; "I am a cat" is not, because `am`, `cat` are not
 * single letters.
 */
create or replace function public.is_spelled_out(input text)
returns boolean language sql immutable as $$
  select coalesce(input, '') ~* '(^|[^a-z0-9])[a-z]([^a-z0-9]+[a-z]){2,}([^a-z0-9]|$)';
$$;

/** A pattern with its leading word-boundary guard removed, and nothing else. */
create or replace function public.pattern_core(pattern text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(pattern, ''), '^\(\^\|\[\^a-z\]\)', '');
$$;

grant execute on function public.screen_text(text, text) to anon, authenticated;
grant execute on function public.squash_for_screening(text) to anon, authenticated;
grant execute on function public.is_spelled_out(text) to anon, authenticated;
grant execute on function public.pattern_core(text) to anon, authenticated;

/*
 * `security definer` is back on it, and that is a fix of its own. The term
 * list is not readable by `authenticated` - no grant, by design, it is
 * staff-shaped data - and `screen_text` had been rewritten with
 * `create or replace` in 0238 without saying `security definer` again,
 * which resets it. Replacing a function does not keep the attributes the
 * old one had. Anything reaching the screening through another
 * `security definer` function carried on working, which is most of the
 * platform and is why nobody saw it; a page calling `screen_text` itself as
 * a signed-in person got `permission denied for table moderation_terms`.
 */
create or replace function public.screen_text(input text, check_scope text default 'all')
returns table (decision public.screen_decision, reason text)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  flattened text := public.normalize_for_screening(input);
  raw text := lower(coalesce(input, ''));
  /*
   * Null when there is nothing to gain by reading it this way, which is
   * most chat. A null is never matched, so the third reading simply is not
   * used rather than being used against an empty string.
   */
  spelled boolean := public.is_spelled_out(input);
  squashed text := case
    when check_scope in ('identity', 'name') or spelled
      then public.squash_for_screening(input)
    else null
  end;
  offsite text;
  hit record;
begin
  if coalesce(trim(input), '') = '' then
    return query select 'ok'::public.screen_decision, null::text;
    return;
  end if;

  /*
   * Asked first, because a blocked link should be said as a link rather
   * than as whatever word in the address happened to be on the term list.
   */
  offsite := public.offsite_link(input);
  if offsite is not null then
    if check_scope = 'say' or check_scope = 'chat' then
      return query select 'block'::public.screen_decision,
        ('Links to ' || offsite || ' cannot be posted. YouTube, TikTok, '
         || 'Discord, Spotify and Kobblon links are fine.')::text;
    else
      return query select 'review'::public.screen_decision,
        ('Contains a link to ' || offsite)::text;
    end if;
    return;
  end if;

  for hit in
    select t.decision, t.reason
      from public.moderation_terms t
     where (t.scope = 'all' or t.scope = check_scope)
       and (
         flattened ~* t.pattern
         or raw ~* t.pattern
         or (squashed is not null and squashed ~* t.pattern)
         or (squashed is not null and spelled
               and squashed ~* public.pattern_core(t.pattern))
       )
     order by (t.decision = 'block') desc
     limit 1
  loop
    return query select hit.decision, hit.reason;
    return;
  end loop;

  return query select 'ok'::public.screen_decision, null::text;
end $$;

commit;
