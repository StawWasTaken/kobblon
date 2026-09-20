# Migrations

Seventy-odd files, applied in order, and the record of what the live database
has actually had done to it.

## The one rule

**A migration that has been applied is history. Do not edit it, rename it,
renumber it or delete it.** Supabase tracks what it has run by version, so a
file that changes after it ran is a file that no longer describes the
database, and a file that disappears is one Supabase may try to run again.

Everything else follows from that: a mistake in an applied migration is fixed
by writing the next one, never by going back.

## Writing a new one

Name it `NNNN_what_it_does.sql`, next number, no gaps.

Then, before pushing:

```
npm run check:migrations
```

That enforces the four things this project has got wrong at least once:

1. **`security definer` functions say `set search_path = public, extensions`.**
   Supabase keeps pgcrypto in `extensions`. A function pinned to `public`
   alone works on a development database that is arranged differently and
   fails on the real one with "function gen_random_bytes(integer) does not
   exist". That happened, in production, to the sign-in code.
2. **Everything is idempotent.** `create table if not exists`,
   `create index if not exists`, `create or replace function`.
3. **A policy or trigger is dropped before it is created.** `create policy`
   has no `if not exists`, so the second run fails without the drop.
4. **The filename is the pattern above.**

The script forgives what the already applied migrations do, recorded in
`scripts/migrations-known.json`, because those cannot be changed. Anything new
is held to the rules.

## Testing one

Apply it **twice** against a real PostgreSQL, then exercise it with SQL that
tries to do the wrong thing as the wrong person. Every migration in this
repository has been through that, and the ones that were not caught this way
were caught by a person in production instead, which is slower and more
expensive.

The pattern:

```sql
begin;
-- make a couple of people, one of them a moderator
-- set local role authenticated, with request.jwt.claim.sub
-- then: can a stranger read it? write it? call the function?
rollback;
```

A test that only proves the happy path proves very little. The useful ones
are the refusals.

## Why there are so many

Because none of them can be squashed while the database they describe is
live. Squashing means writing a single baseline that reproduces the current
schema, telling Supabase it has already been applied, and archiving the rest.
That is a real operation with a real risk of a mismatch, it needs the
production database in hand, and it buys tidiness rather than capability.
Worth doing one day, deliberately, in a quiet week. Not worth doing on the
way past.
