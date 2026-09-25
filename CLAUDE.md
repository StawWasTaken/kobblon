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

## Ethos

`docs/neoclassic.md` holds it. The working rules that come out of it: copy the
system, not the look; build only what a week-old platform needs; nothing
sterile; and no fake functionality — a control that implies something the
runtime does not do is worse than no control. Blue is Kobblon, green is yes.
