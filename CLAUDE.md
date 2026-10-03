# Working on Kobblon

## The standing rule about the other session

A second Claude Code session builds the desktop applications (Kobblon
Workspace, the Launcher). Messages pass between us through Staw, by hand.

**At the end of every batch of changes, write the handoff text. Always,
without being asked.** Append it to `docs/for-the-apps.md` as the next
numbered round, commit it, and also give it in the reply so Staw can paste it
straight across.

**A shared thing that changes *meaning* gets a line even when nothing
breaks.** `primary` going from blue to green broke no build and no type: it
compiled on both sides and quietly meant two different things in one product
until somebody looked at the two windows together. Appearance changes can
wait for the next round; meaning changes cannot, because a copy on the other
side fails silently and looks fine. Their words, and they are right.

What a round is for: the other session cannot read this repository's diffs.
Anything it must know to build against — a changed signature, a new field, a
flipped direction, a limit it should display, a thing that is deliberately not
built — exists for it only if the round says so. Write what changed, why, what
it means for the applications, and what is still missing. Name the things that
are not done as plainly as the things that are.

## Who builds what

Staw, to both sessions: **one builds the thing, the other uses the thing that
was built.** Not two sides building their own version of the same idea and
meeting in the middle — that is how "Model" here and "Mesh" there happens,
and how two upload dialogs end up needing to be fixed twice.

For anything shared, the website is where it is built and the applications
import it:

- **The design** — `design/preset.js`. Colours, type, spacing.
- **The words** — `@/lib/kinds`. Labels, icons, codes, accepted extensions.
- **The components** — `@/components/ui/*`, `UploadDialog`, `Cropper`,
  `Tooltip`, `MediaPlayer`.
- **The engine** — `@/engine`.
- **Talking to the database** — `@/lib/api`, with `setSupabaseClient` for an
  application that has its own session.

So when something shared needs to change, it changes here and the Workspace
pulls it. And the duty that comes with owning them: **they have to be
mountable outside the website.** No provider it cannot supply, no router it
does not have, no assumption that it is on a page. `tools/site/` holds bare
pages that mount them with nothing around them — if one throws there, the
Workspace finds out by a panel going blank, which is not a bug report
anybody can act on.

That has bitten three times already: `useAuth` throwing without its
provider, `supabase` deciding its session at import, and `<Link>` outside a
router. All three rendered perfectly in the website and took the panel down
in the application.

## How work is verified here

- Every engine change: `npm run engine:check` must pass, and anything visual
  is rendered and looked at. The dev server for it is
  `npm run engine:dev` on 5320; the check needs it running.
- Every migration: applied twice against the local Postgres, **each file
  wrapped in a single `begin; … commit;`**, with behavioural SQL proving the
  refusals, not just that it applies.

  The wrapping is not optional and it is not how `psql -f` behaves. `psql`
  runs each statement in its own transaction; the Supabase SQL editor, where
  Staw actually applies these, runs the whole file as one. A migration can
  pass here and fail there — it already has, with `unsafe use of new value
  "mesh" of enum type asset_kind`, because Postgres will not let a new enum
  value be used in the transaction that added it. Anything that adds an enum
  value goes in its own migration, and whatever mentions that value by name
  goes in the next one.
- Every UI change: built and screenshotted, and actually looked at.

  **Screenshot a build, not the dev server's root.** GitHub Pages deploys
  from the repository root, so `publish-to-root.mjs` leaves an `index.html`
  there pointing at the last deployed bundle — and `vite dev` serving `/`
  hands that to the browser instead of the working tree. A change can be
  correct, served correctly, and invisible in the screenshot. It cost most of
  an hour once: `npm run build`, serve `dist/`, look at that. A page mounted
  on its own under `tools/site/` imports source directly and is fine.
- Report what happened, including when it failed. A check that was corrected
  to match a behaviour change is said out loud, not quietly rewritten.

## The trap this project keeps falling into

**A value captured before the thing that decides it exists.** It has worn
three disguises here, cost four bugs between the two sessions, and every time
it presented as "renders correctly, nothing throws, and it is wrong":

- Four asynchronous passes held a `BuiltWorld` across an `await`, so a World
  somebody had already left kept writing into itself — and started its
  ambience on a sound service that had been cleared and never would be again.
- `dressSky` compared the manifest to decide whether it was stale, which is a
  value captured before the case that breaks it existed: opening the same
  World twice, which is what a reload button is.
- `export const supabase` was decided at import, before an application had
  the chance to say which session it has. The Workspace's upload popup
  mounted perfectly and would have uploaded as nobody.

The shape to watch for: anything read once and kept, where the thing that
decides it can change afterwards. The fix is always the same — ask at the
moment of use, or carry a token that says whether the answer is still wanted.

And the check that goes with it is never "is the current value right". It is
**"does a call made afterwards actually reach the new thing"**, because the
broken version passes the first question.

## The fourth trap: a policy guarding a door nobody can reach

A new table gets `enable row level security` and a policy, and no `grant`.

The policy is the part that feels like the security work, so it is the part
that gets written. But a policy decides *which rows* a role may see, and a
grant decides whether the role may touch the table **at all** - and a new
table has no grants. The result is a table that looks carefully protected
and is simply unreachable: `permission denied for table <name>`.

What makes it survive: every function that touches it is usually
`security definer`, so the feature works. Only a page reading the table
directly finds out, which is days later and reads as "the page is broken".

It has happened twice - `outfit_folders`/`outfits`/`outfit_items`, and
`starting_kit`, where the policy said "anybody may read this" for a fortnight
while nobody could. **Every `create table` in this project is followed by its
grants in the same file**, and a check that reads the table as
`authenticated` rather than as the owner.

## Ethos

`docs/neoclassic.md` holds it. The working rules that come out of it: copy the
system, not the look; build only what a week-old platform needs; nothing
sterile; and no fake functionality — a control that implies something the
runtime does not do is worse than no control. Blue is Kobblon, green is yes.

## The second trap: a guard that watches the wrong event

The one above is a value captured before the thing that decides it exists.
This is its cousin, and it is worse, because the first one at least looks
suspicious when you find it.

`SoundService.load` checked `stillWanted()` after every await. The guard was
there, it was deliberate, and it had a comment explaining exactly why it was
needed. It compared how many Worlds had been **opened** — and leaving a World
opens nothing, so after the service was cleared the guard still said yes. A
file landing then built an audio node, started it, and put it where no later
clear could reach: a sound playing for ever in a World nobody is in.

The shape: **a guard that exists, is checked, and watches the wrong event.**
Nobody looks at one twice, because the code reads as already handled.

The check that goes with it is not "is the guard there". It is **"name the
events that should invalidate this, and show the guard changes on each of
them"**. For the sound service that was three — another World opened, this
service cleared, this service disposed — and the guard moved on one.

## The third trap: a trusted write undone by a guard that only knows who asked

The second trap is a guard watching the wrong event. This is a guard watching
the right event and the wrong *subject*, and it cost the worst bug on this
platform so far.

`move_pixels` is `security definer`. It had the rights to move Brix and it
moved them. `guard_profile_update` then pinned `pixels` back to its old value,
because it asks `auth.uid()` who is doing this and `auth.uid()` is the caller
— **`security definer` changes a function's rights, not who it reports as.**
Buying, selling, creator payouts, ad spend and username changes all returned
without error and moved nothing, for every ordinary signed-in person, for
days. `guard_asset_update` was doing the same to `replace_mesh_file`.

The shape: **a privileged function and a row-level guard over the same table,
where the guard's test is identity.** Both are correct in isolation. Nothing
throws, every RPC returns successfully, and the only symptom is a number that
does not change. The fix here is always the transaction-local flag — the
function raises it, writes, lowers it, and the guard honours that and nothing
else.

The check is not "does the function have the rights". It is **"read the row
back after the statement, under a real signed-in identity, and show it holds
the new value."**

And the reason it survived its own migration's checks, which is the part to
actually learn: **a check that runs anonymously proves nothing about a guard
whose subject is identity.** With no JWT claim set, `auth.uid()` is null, the
guard exempts the write, and the one case where the bug cannot happen is the
case that was tested. Every check on a guard like this runs under at least two
identities — the owner and a stranger — and fails if either is wrong.

Related, same day, same cause: this schema's local `auth.uid()` reads
`request.jwt.claim.sub`. A harness that sets `request.jwt.claims` as JSON is
silently anonymous, and its "signed-in" assertions pass for the wrong reason.
Before trusting any identity check, `select auth.uid()` and look at it.
