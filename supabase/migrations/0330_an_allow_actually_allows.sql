begin;

/*
 * "Allow" did nothing.
 *
 * The Machine panel has offered three decisions since 0011 - block, review
 * and `ok`, which the panel words as "Allow - an exception to another
 * pattern". The first two are real. The third never was: `screen_text`
 * picks one matching row with
 *
 *     order by (t.decision = 'block') desc limit 1
 *
 * so a `block` row beats an `ok` row and an `ok` row that matched on its
 * own was returned as `ok`, which is what the text would have been anyway
 * with no row at all. An exception that cannot except anything is the
 * thing the ethos calls fake functionality, and it was sitting in a
 * dropdown for staff to choose.
 *
 * Now an allow is checked first and wins: if any `ok` row in scope matches
 * the text, the text passes and the term list is not consulted further.
 * That is what an exception means, and it is what makes "let people say
 * stuff about pixels and kubes" something somebody can actually write.
 *
 * What an allow deliberately cannot do: it does not reach the link rule
 * above it. `offsite_link` refuses addresses, and a word-level exception
 * letting a blocked link through because the same message said an allowed
 * word would be an exception doing something nobody asked it for. Links
 * stay the business of 0238's list.
 *
 * Everything else is 0254 unchanged - the three readings of the text, the
 * spelled-out squashing, the guard-dropping - and `security definer` is
 * said again, because replacing a function does not keep it.
 */
create or replace function public.screen_text(input text, check_scope text default 'all')
returns table (decision public.screen_decision, reason text)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  flattened text := public.normalize_for_screening(input);
  raw text := lower(coalesce(input, ''));
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

  /* The exception, asked before the list it is an exception to. */
  if exists (
    select 1
      from public.moderation_terms t
     where t.decision = 'ok'
       and (t.scope = 'all' or t.scope = check_scope)
       and (
         flattened ~* t.pattern
         or raw ~* t.pattern
         or (squashed is not null and squashed ~* t.pattern)
         or (squashed is not null and spelled
               and squashed ~* public.pattern_core(t.pattern))
       )
  ) then
    return query select 'ok'::public.screen_decision, null::text;
    return;
  end if;

  for hit in
    select t.decision, t.reason
      from public.moderation_terms t
     where t.decision <> 'ok'
       and (t.scope = 'all' or t.scope = check_scope)
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

grant execute on function public.screen_text(text, text) to anon, authenticated;

commit;
