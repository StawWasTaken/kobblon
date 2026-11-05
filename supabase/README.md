# Kobbleston database

Supabase project: `https://sdnjdgeqrhzkyfyohcsz.supabase.co`

Apply the migrations in order from the SQL editor. They are re-runnable:
every step checks for itself first, so a run that fails part way can simply
be run again once the cause is fixed.

**Not `supabase db push` as things stand.** The ones up to `0299` are filed
under `migrations/applied/` so that the recent ones are not at the bottom of
three hundred files, and the CLI reads only the top folder - it would push
`0300` onwards and believe the rest had never happened, which against an
empty database builds a schema with nothing underneath it. The live database
has had all of them, applied by hand in the SQL editor, which is how this
project has always done it. Anybody who wants the CLI back moves the folder
back up first; `npm run check:migrations` reads both either way.

1. `0001_init.sql` - tables and indexes
2. `0002_policies.sql` - row level security
3. `0003_functions.sql` - triggers and RPCs
4. `0004_realtime.sql` - realtime publication
5. `0005_accounts_and_create.sql` - signup fields and the Create marketplace
6. `0006_storage_and_review.sql` - the uploads bucket and the review pipeline
7. `0007_avatars.sql` - the profile picture bucket
8. `0008_badges_communities_pixels.sql` - badges, Communities, follows, favourites, Pixels
9. `0009_guests_and_views.sql` - guest accounts and the profile and Space reads
10. `0010_fix_publish_event.sql` - fixes the publish announcement
11. `0011_automated_review.sql` - the automated content filter
12. `0012_space_chat.sql` - the chat that comes with every Space
13. `0013_guest_limits.sql` - what a guest may and may not do
14. `0014_group_chats.sql` - named group conversations
15. `0015_communities.sql` - Communities, ranks and moderation
16. `0016_community_policies.sql` - their row level security and page reads
17. `0017_review_fix_and_ids.sql` - the review fix and content IDs
18. `0018_message_edits.sql` - editing messages, and blocking
19. `0019_space_presentation.sql` - emblems, dislikes, notify and stats
20. `0020_affiliates.sql` - allies and enemies between Communities

Notes:

- Profiles are created automatically by the `on_auth_user_created` trigger, so
  the client never inserts one.
- Visit counts only move through `enter_space()`, which records at most one
  visit per person per space per hour. There is no client-writable counter.
- `platform_stats()` and `recent_activity()` are the only things the
  logged-out landing page reads, and both are exposed to `anon`.
- Only the publishable key belongs in the frontend. The service role key must
  never leave the Supabase dashboard.

## The Kobbleston account

Kobbleston's own uploads show a verified mark in Create. After signing that
account up normally, mark it once:

```sql
update public.profiles set is_admin = true, is_moderator = true
 where lower(username) = 'kobbleston';
```

`list_assets()` sorts admin uploads first and returns `creator_is_admin`, which
is what the verified mark reads.

## Reviewing uploads

Uploads land in `public.assets` with `status = 'pending'`. Nothing reachable
from the browser can change a status: `assets_update_own_metadata` only lets a
creator rename their own row while it is still pending, and `review_asset()`
has execute revoked from `anon` and `authenticated`. Until something approves
an upload, only its creator can see it.

Approving happens outside the database, from a worker holding the service
role key, which is the only place that key may ever live:

```sql
select public.review_asset('<asset id>', 'approved');
select public.review_asset('<asset id>', 'rejected', 'Not your artwork.');
```

Point that worker at whatever automated check you want to run first, and have
it call `review_asset` with the outcome. A signed-in moderator (a profile with
`is_moderator`) can read the backlog through `review_queue()` and make the same
calls by hand. Until a worker is deployed, uploads simply stay pending and
invisible, which is the safe failure.

## The Kobbleston account

Kobbleston's own uploads show a verified mark in Create. After signing that
account up normally, mark it once:

```sql
update public.profiles set is_admin = true, is_moderator = true
 where lower(username) = 'kobbleston';
```

`list_assets()` sorts admin uploads first and returns `creator_is_admin`, which
is what the verified mark reads.

## Automated review

`0011_automated_review.sql` decides things as they are submitted, so nothing
waits in a queue for a worker that may not exist. To be clear about what it
is: a deterministic filter, not a model. It is a term list in
`public.moderation_terms` plus pattern rules, run against text that has first
been flattened by `normalize_for_screening()`, which undoes letter for number
substitutions, collapses repeated letters and strips padding characters, so
`f&u.c.k` and `fuuuuck` are caught alongside the plain spelling.

`screen_text()` returns `ok`, `review` or `block` and the reason. It runs on:

- **usernames, display names and bios**, through the `profiles_screen`
  trigger. `check_username()` gives the signup form the same answer while
  someone is still typing, including whether the name is taken.
- **Space names and descriptions**, through `spaces_screen`.
- **uploads**, through `assets_review`, which also checks the file extension
  matches the kind claimed. Admin uploads skip the check entirely and go
  straight to approved. Everything else is approved, rejected with a reason,
  or left pending when the filter is unsure, which is the only case a person
  sees.
- **messages**, both direct and in a Space.

Tune it by editing the table, not the code:

```sql
insert into public.moderation_terms (pattern, decision, reason)
values ('(^|[^a-z])sometermhere', 'block', 'Why it is blocked');
```

A signed-in moderator can still read the backlog through `review_queue()` and
decide by hand with `review_asset()`, which remains revoked from `anon` and
`authenticated` and is meant for a worker holding the service role key.

## Logging in with a username

Supabase signs people in with an email, so `supabase/functions/login` turns a
username into one behind the service role key. Doing that lookup in the
browser would hand anyone who knows a username the address behind it, so it
does not happen there. Deploy it before anyone tries to log in:

```bash
supabase functions deploy login
```

It answers the same way whether a username does not exist or the password is
wrong, so it cannot be used to find out which names are real. An email typed
into the username box still works.

## Guests

Guest mode uses Supabase anonymous sign-in, so turn on
**Authentication -> Sign In / Providers -> Anonymous sign-ins**. Without it the
"Play as Guest" button reports that guest mode is not switched on, rather than
pretending to work.

A guest is a real account with `is_guest` set, so presence, entering a Space
and looking around behave normally. What a guest cannot do is enforced by
policy in `0013_guest_limits.sql`, not by hiding buttons: no making Spaces,
Communities or uploads, no likes, favourites, follows or friend requests, no
messages anywhere, and no renaming itself into something that looks like a
real account. Guests get no Pixels and stay out of the public counts.

Two more caps on churn: no more than 200 guests may join in an hour, and
`sweep_guests()` deletes guests not seen for a day. Point a scheduled job at
that function, or run it by hand:

```sql
select public.sweep_guests();
```

## Pixels

Pixels are the platform currency. A balance on `profiles` is never written
from the browser: `move_pixels()` is the only way it changes, it has execute
revoked from `anon` and `authenticated`, and every movement writes a row to
`pixel_transactions`, so the ledger and the balance cannot disagree. New
accounts are granted 100 by trigger.

To hand out Pixels from a worker holding the service role key:

```sql
select public.move_pixels('<user id>', 500, 'admin', 'Contest prize');
```

## Badges

A Space owner creates badges on their own Space. Awarding goes through
`award_badge()`, which checks the caller owns the Space, refuses duplicates,
and keeps `awarded_count` in step with the awards. Nothing writes
`badge_awards` directly. Automatic awarding from inside a Space arrives with
the editor; until then an owner awards them deliberately.

## Space chat

Every Space has a chat. Its owner sets `chat_enabled`, `chat_greeting` and
`chat_slowmode_seconds` on the Space itself. Sending is gated by policy on
those columns, and `space_messages_screen` enforces slow mode and runs the
same filter as everything else before a message is stored. The owner can
clear anything said in their Space.

## Group chats

`create_group_conversation(title, members)` makes a named conversation with up
to five friends. Everyone added has to already be a friend, checked in the
function, so a group cannot be used to reach strangers. `my_conversations()`
returns everything the chat dock shows, including unread counts and who is in
each conversation, in one read.
