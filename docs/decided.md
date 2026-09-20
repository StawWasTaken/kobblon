# What Staw decided, and what each one means to build

Five answers, written down before any of them is built, because each one
turns out to be bigger than the sentence that asked for it.

## 1. Collision: Rapier, and a part says whether it moves

My call, since it was left to me.

**Rapier** (`@dimforge/rapier3d-compat`), a WebAssembly rigid body solver.
It is small, it is deterministic given the same inputs, and it is one
decision that fixes both of the things the box-collider engine cannot do:
a wedge becomes a ramp you walk up, and a part can be knocked over.

The manifest gains one field:

```
anchored?: boolean   // true by default
```

Anchored is the default because a World full of parts that fall over the
moment somebody walks in is not what anybody meant. Unanchored parts get a
real body with a mass worked out from their size.

What that costs, honestly: about 1 MB of WebAssembly, a fixed physics step
alongside the render step, and K6's controller moving from the hand-rolled
box sweep it uses today to a character controller. The hand-rolled one is
about two hundred lines and all of them go.

What it must not become: a World deciding its own gravity for everybody,
physics that differ between one player's machine and another's, or a way for
a World to make a client do a million-body simulation. Bodies get a cap.

## 2. A World belongs to a Community

The model Staw asked for, exactly:

- A World may belong to a Community. `worlds.community_id`.
- The people who may edit it are that Community's members **with a rank that
  carries the permission** — they are its developers by virtue of their
  rank, not by a separate list.
- The moment somebody leaves the Community, or their rank changes so it no
  longer carries the permission, they lose access. **Immediately, not at
  next sign in.**

That last line is the whole difficulty, and it is a security property rather
than a nicety: somebody removed from a Community must not keep writing to
its World because their page is still open.

How it is actually enforced, in order of what matters:

1. **Row level security is the enforcement.** Every policy on a Community
   World asks the membership table at the moment of the write, so a removed
   member's next statement is refused by the database whatever their browser
   believes. This is not optional and it is not a client concern.
2. **Realtime is the courtesy.** A Postgres change feed on the membership
   row tells an open editor it has lost access so it can stop pretending, get
   out of the editor and say why. A client that misses that message is still
   refused by the database; realtime makes it graceful, never safe.
3. **Creator has to handle being told no mid-session** rather than losing
   somebody's work. That is the piece that needs designing on the desktop.

Handing a World to a Community also decides who may publish it, who gets the
Brix if it ever sells anything, and what happens to it if the Community is
deleted. Those are decisions, not code, and they want answering before the
column is added.

## 3. Badges

Earned inside a World, worn on a profile.

- `world_badges` — the badge a World defines: name, picture, description,
  and how rare it is.
- `world_badge_awards` — who has it, from which World, and when.
- Shown on a profile as "earned in *this World*", linking back to it.

The awarding is a script call: touching a part, joining, finishing
something. **That means badges wait on scripting**, and there is no way
round it: a badge that the website can hand out is a badge anybody can hand
themselves. The award has to come from a server that ran the World, which is
also why it cannot be minted by the browser.

What can be built before scripting exists: defining them, listing them on
the World page, showing them on a profile. The award path is the part that
waits.

## 4. Shop: passes, bought with Brix

Not Pixels and not Kubes. **Brix.**

- `world_passes` — what a World sells: name, picture, description, price in
  Brix, and whether it is still on sale.
- `world_pass_owners` — who bought one.
- Buying goes through the transaction ledger that already exists, so a
  purchase is one statement that moves Brix and records ownership, or does
  neither.

Two kinds of pass, and the difference matters for what has to exist first:

- **A donation.** Somebody pays because they want to. This needs nothing
  from the runtime and can be built now.
- **A pass that does something** — a sword, a door, a faster walk. The World
  asks at join time what this player owns and behaves accordingly, which
  means it waits on scripting, like badges.

So: the shop, the buying and the ownership can all be real before the
runtime can read it.

## 5. Servers

Who is playing right now, and joining the one you choose.

Needs the Launcher to host a session that other people can join, which does
not exist yet. What the website owns once it does:

- `world_servers` — a live row per running session: which World, how many
  are in it, how many it holds, and when it was last heard from.
- A server goes stale and disappears if it stops saying it is there. A list
  of servers that are not running is worse than no list.
- The Servers tab lists them with who is in each, and Play targets one.

This is last of the five for a reason: every part of it depends on the
Launcher doing something it cannot do today.

---

## Two files that keep arriving empty

`plastic` and `foil` have both come through as fully transparent PNGs —
every pixel white, nothing in them. Same as the glass one before. Whatever
is exporting them loses the very subtle textures entirely.

`smooth` did not need a file, so that one is built. `foil` still does.
