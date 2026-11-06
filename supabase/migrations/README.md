# Migrations

Three hundred-odd files, applied in order, and the record of what the live
database has actually had done to it.

## Where they live

Two folders, one list:

- **here** - the ones written since the last time Staw applied a batch, and
  nothing else. It is empty whenever the live database is caught up, which
  is the normal state;
- **`applied/`** - everything Staw has run, `0001` up to `0325`.

Staw: "can we also make a folder in migrations for older migrations so i
dont have to scroll all the way down for the new ones". That is the whole
reason, and it is a filing decision and nothing else. **The folder a
migration sits in means nothing to the database.** Both folders are history,
both are applied in one sequence by number, and a file in `applied/` is no
more squashed, retired or safe to change than one up here.

Two things follow:

- **A new migration is written here**, never in `applied/`, with the next
  number after the highest one in either folder.
- **`npm run check:migrations` reads both** and treats them as one list.
  That is not a convenience: the rule it exists to enforce - that two
  migrations never share a number - would be worthless if half the numbers
  were in a folder it did not look in. There is a check for exactly that.

Moving a file between the two is the one kind of move that is allowed,
because the name does not change and nothing reads the path: `known.json`
is keyed by the bare filename, and Staw applies these by hand in the SQL
editor. Do not move anything while doing something else to it.

## The one rule

**A migration that has been applied is history. Do not edit it, rename it,
renumber it or delete it.** Supabase tracks what it has run by version, so a
file that changes after it ran is a file that no longer describes the
database, and a file that disappears is one Supabase may try to run again.

Everything else follows from that: a mistake in an applied migration is fixed
by writing the next one, never by going back.

## Writing a new one

Name it `NNNN_what_it_does.sql`, next number, no gaps, in this folder and
not in `applied/`.

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
