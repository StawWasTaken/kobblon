# Working on Kobblon

## The standing rule about the other session

A second Claude Code session builds the desktop applications (Kobblon
Workspace, the Launcher). Messages pass between us through Staw, by hand.

**At the end of every batch of changes, write the handoff text. Always,
without being asked.** Append it to `docs/for-the-apps.md` as the next
numbered round, commit it, and also give it in the reply so Staw can paste it
straight across.

What a round is for: the other session cannot read this repository's diffs.
Anything it must know to build against — a changed signature, a new field, a
flipped direction, a limit it should display, a thing that is deliberately not
built — exists for it only if the round says so. Write what changed, why, what
it means for the applications, and what is still missing. Name the things that
are not done as plainly as the things that are.

## How work is verified here

- Every engine change: `npm run engine:check` must pass, and anything visual
  is rendered and looked at. The dev server for it is
  `npm run engine:dev` on 5320; the check needs it running.
- Every migration: applied twice against the local Postgres, with behavioural
  SQL proving the refusals, not just that it applies.
- Every UI change: built and screenshotted, and actually looked at.
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

## Ethos

`docs/neoclassic.md` holds it. The working rules that come out of it: copy the
system, not the look; build only what a week-old platform needs; nothing
sterile; and no fake functionality — a control that implies something the
runtime does not do is worse than no control. Blue is Kobblon, green is yes.
