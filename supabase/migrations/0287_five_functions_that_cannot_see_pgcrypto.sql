begin;

-- Five functions that cannot see pgcrypto
-- -----------------------------------------------------------------------
--
-- `npm run check:migrations` has reported these every run for about forty
-- rounds and nothing was ever done about them, which is its own problem: a
-- check nobody acts on is a check nobody reads, and the one real finding in
-- the next batch would have gone past unnoticed in the same list.
--
-- All five are `security definer` with `set search_path = public`, and none
-- of them has `extensions` on the path. On Supabase that is where pgcrypto
-- lives - `gen_random_uuid`, `digest`, `crypt` - and a definer function
-- cannot reach it. None of these five calls one *today*, which is exactly
-- why it has never broken: it is a trap set for whoever edits one of them
-- next and reaches for a uuid, and the error they get - `function
-- gen_random_uuid() does not exist` - says nothing about search paths.
--
-- `alter function ... set` rather than five `create or replace` with the
-- bodies copied out. The bodies are long, one of them is sixty lines, and
-- copying a body to change a setting beside it is how a body gets subtly
-- changed in passing. This touches only the setting, and it is idempotent
-- by nature: setting it twice sets it.
--
--  reply_ticket            0260
--  member_communities      0261
--  claim_appearance        0263
--  set_appearance          0263
--  my_appearances          0263
--
-- `guard_profile_update` in 0263 is not here: it was already on
-- `public, extensions` and the checker was right not to name it.

alter function public.reply_ticket(bigint, text, boolean)
  set search_path = public, extensions;

alter function public.member_communities(uuid)
  set search_path = public, extensions;

alter function public.claim_appearance(text)
  set search_path = public, extensions;

alter function public.set_appearance(text)
  set search_path = public, extensions;

alter function public.my_appearances()
  set search_path = public, extensions;

commit;
