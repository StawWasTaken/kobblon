begin;

/*
 * The rules, as rows, because Kobby has never had them
 * -----------------------------------------------------------------------
 *
 * Staw: "if it looks through our community guidelines and sees, for
 * example, that at the line 5 we sanction people who use our chats to
 * speak sexually, then Kobby will not look at individual words but look at
 * the sentences we send, and then looks at the rule again, and wonders if
 * the sentence breaks the rules".
 *
 * Two things were in the way of that, and both are in this file and the
 * two after it.
 *
 * The first: **there were no rules to read.** The guidelines live in
 * `src/content/policies.ts` as prose for a web page, and the one list of
 * what is not allowed that any machine has ever seen is a paragraph
 * hard-coded in the worker's prompt, written for screening uploads. So a
 * line somebody typed was being judged against "reject nudity, gore,
 * slurs ..." and answered with `approved` or `rejected` - neither of which
 * `apply_ai_verdict` does anything with for a message. Kobblon's chat
 * moderation has been the regular expressions and nothing else, exactly as
 * it was before 0189 said it would not be.
 *
 * So the rules become rows: numbered, worded for a reader rather than for
 * a page, each with how grave breaking it is. The worker reads them out of
 * here and puts them in front of the model, which means changing what
 * Kobblon sanctions is an update statement rather than a redeploy - and
 * the numbers are stable, so "rule 5" means one thing on the status page,
 * in the console, and in what the model was shown.
 *
 * `code` is deliberately the same vocabulary as `violations.rule`, which
 * has had its check constraint since 0072. A judgement can become a
 * violation row without a translation table in the middle, and nothing
 * here widens what may be written there.
 *
 * Gravity, 1 to 4, is the rule's own seriousness and not the sentence's.
 * What actually happens to somebody is gravity *and* their behaviour bar
 * together, and that sum is in 0209 where it can be read in one place.
 * Four is reserved for the things the guidelines already say get no
 * warning first.
 */

create table if not exists public.moderation_rules (
  /** The same vocabulary `violations.rule` has taken since 0072. */
  code text primary key,
  /** Its number. This is what "rule 5" means, so it does not get reused. */
  ord integer not null unique,
  title text not null,
  /** What the rule says, worded to be read by a model and by a person. */
  body text not null,
  gravity integer not null check (gravity between 1 and 4),
  /** Where it applies. Voice is here because a rule is not about typing. */
  channels text[] not null default array['chat', 'voice', 'post'],
  is_on boolean not null default true,
  updated_at timestamptz not null default now()
);

/*
 * The grants, in the same file as the table. A policy says which rows a
 * role may see; a grant says whether it may touch the table at all, and a
 * new table has none. That is the fourth trap in CLAUDE.md and it has cost
 * this project a fortnight twice.
 *
 * Everyone may read these, signed in or not. They are the house rules: a
 * rule somebody cannot read is a rule nobody agreed to.
 */
alter table public.moderation_rules enable row level security;
grant select on public.moderation_rules to anon, authenticated;

drop policy if exists moderation_rules_read on public.moderation_rules;
create policy moderation_rules_read on public.moderation_rules
  for select using (true);

insert into public.moderation_rules (code, ord, title, body, gravity, channels) values
  ('harassment', 1, 'Leave people alone when they ask',
   'Do not follow somebody around, pile on, insult them, or keep talking at them after they have asked you to stop. Arguing is fine. Being weird is encouraged. Making one person miserable on purpose is not.',
   2, array['chat', 'voice', 'post']),

  ('hate', 2, 'Nothing aimed at who somebody is',
   'No slurs and nothing aimed at a person or a group because of their race, religion, where they are from, their disability, their gender or who they love.',
   3, array['chat', 'voice', 'post']),

  ('violence', 3, 'No threats and no real violence',
   'Do not threaten anybody, tell anybody to hurt themselves, or wish harm on them. Toy weapons in a World are a game; saying it to a person is not.',
   3, array['chat', 'voice', 'post']),

  ('illegal', 4, 'Nothing illegal, and nobody''s private details',
   'No selling or buying illegal things, no drugs, no malware, and no posting somebody''s address, school, phone number or real name where they have not.',
   4, array['chat', 'voice', 'post']),

  ('sexual', 5, 'Kobblon chat is not for sex',
   'Do not use Kobblon to talk about sex, describe sexual acts, ask anybody for anything sexual, or proposition anybody. This is judged by what the sentence means, not by which words are in it: an innuendo everybody present understands breaks this rule and a medical word in an ordinary sentence does not.',
   3, array['chat', 'voice', 'post']),

  ('age', 6, 'Nothing sexual involving a child, ever',
   'Anything sexualising somebody under eighteen, in any form, including asking a child for anything sexual or describing one that way. This is reported, not just removed, and it never gets a warning first.',
   4, array['chat', 'voice', 'post']),

  ('spam', 7, 'Do not flood, and do not advertise',
   'No repeating the same line, no walls of nonsense to push a conversation off the screen, no "free Brix", and no sending people to other sites.',
   1, array['chat', 'voice', 'post']),

  ('impersonation', 8, 'Be yourself',
   'Do not claim to be Kobblon, Kobblon staff, Kobby, or another person, and do not pretend a message came from us.',
   2, array['chat', 'voice', 'post']),

  ('cheating', 9, 'No exploiting and no account trading',
   'Do not share exploits, sell or buy accounts, beg for or trade passwords, or ask anybody to get round how Kobblon works.',
   1, array['chat', 'voice', 'post']),

  ('copyright', 10, 'Do not pass off what somebody else made',
   'Do not upload or share other people''s work with your name on it.',
   1, array['post']),

  ('other', 11, 'Anything else the guidelines say',
   'The written guidelines in full. Use this only when something is plainly against them and no rule above fits.',
   1, array['chat', 'voice', 'post'])
on conflict (code) do update set
  ord = excluded.ord, title = excluded.title, body = excluded.body,
  gravity = excluded.gravity, channels = excluded.channels, updated_at = now();

/**
 * The rules, numbered, for whoever is about to judge something.
 *
 * The worker reads this rather than carrying a list of its own. A rule
 * switched off here stops being judged on the next run with no deploy -
 * which is the point of the rules being rows.
 */
create or replace function public.the_rules(channel text default 'chat')
returns table (ord integer, code text, title text, body text, gravity integer)
language sql stable security definer
set search_path = public, extensions as $$
  select r.ord, r.code, r.title, r.body, r.gravity
    from public.moderation_rules r
   where r.is_on and (channel is null or channel = any (r.channels))
   order by r.ord
$$;

grant execute on function public.the_rules(text) to anon, authenticated;

commit;
