begin;

/*
 * What may be said, decided in one place.
 *
 * Staw asked for the Launcher's chat to go through the moderation system
 * rather than growing its own, and the other session asked the same thing
 * from its side: "two places deciding what may be said is two standards,
 * and the lenient one is the one that matters."
 *
 * So this is the one door for a line of chat, and it is `screen_text`
 * underneath - the same terms, the same patterns, the same normalisation
 * that already decide a username or the name of an upload. Nothing new is
 * being judged here; what is new is that chat asks.
 *
 * Why this rather than the `moderate` edge function. That one is the
 * machine emptying a queue: it holds the service role, it costs a call to
 * Groq, and it takes as long as a model takes. A chat line cannot wait on
 * any of that - a second of delay per message is not chat - and a model
 * asked about every message anybody types is a bill with no ceiling. The
 * patterns answer in a millisecond, in the database, and they answer the
 * same way for the website and the Launcher.
 *
 * It refuses rather than censoring. A line with the word starred out still
 * says the thing, and partial replacement with these patterns - which match
 * a boundary character before the word - eats the character in front of it.
 * Refusing is also the only one of the two that can be explained to the
 * person who typed it.
 *
 * Links are the one thing chat judges that a name does not.
 *
 * `screen_text`'s 'all' scope lets a link through, deliberately: a link in
 * the description of a shirt is somebody's YouTube and not a crime. In a
 * message to a child it is the oldest trick there is, so chat gets its own
 * scope with the link patterns in it - and not the impersonation ones,
 * because "ask an admin" is an ordinary sentence and only a *username*
 * claiming to be staff is a lie.
 *
 * 'review' is a refusal here, where it is not elsewhere. A thing somebody
 * uploaded can wait in a queue for a person to look at; a sentence cannot,
 * and "allowed for now, judged later" means it has already been said.
 */
/*
 * A pattern was unique on its own, which was true while every term meant
 * the same thing everywhere. It stops being true the moment a scope decides
 * what a pattern means: a link is a refusal in chat and an ordinary thing
 * in the description of a shirt, and that is the same regular expression
 * twice with two reasons. Unique per scope instead.
 */
alter table public.moderation_terms
  drop constraint if exists moderation_terms_pattern_key;
create unique index if not exists moderation_terms_pattern_scope_idx
  on public.moderation_terms (pattern, scope);

alter table public.moderation_terms
  drop constraint if exists moderation_terms_scope_check;
alter table public.moderation_terms
  add constraint moderation_terms_scope_check check (scope in ('all', 'identity', 'say'));

insert into public.moderation_terms (pattern, decision, reason, scope)
select v.pattern, 'block'::public.screen_decision, v.reason, 'say'
  from (values
    ('(https?://|www\.)', 'Links cannot be posted in chat'),
    ('(^|[^a-z])(discord\.gg|t\.me|bit\.ly|tinyurl)', 'Links cannot be posted in chat'),
    ('(^|[^a-z])free\s*(brix|robux)', 'That is how people get scammed')
  ) as v(pattern, reason)
 where not exists (
   select 1 from public.moderation_terms t
    where t.pattern = v.pattern and t.scope = 'say'
 );

create or replace function public.screen_say(words text)
returns table (allowed boolean, reason text)
language sql stable security definer set search_path = public, extensions as $$
  select s.decision = 'ok',
         case when s.decision = 'ok' then null
              else coalesce(s.reason, 'That cannot be said here.') end
    from public.screen_text(words, 'say') s
$$;

/*
 * Anybody signed in may ask, because everybody signed in may talk. Not
 * `anon`: there is no such thing as a line of chat from nobody, and an open
 * door here is a free way to work out what the filter catches.
 */
grant execute on function public.screen_say(text) to authenticated;

commit;
