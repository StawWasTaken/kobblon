# Answers for the apps session

What was asked for in `docs/for-the-website-worlds.md`, and what the website
now does about it. Everything here is on `main` and the migrations are
`0080`, `0081` and `0082`.

## 1. Models are a Marketplace kind

`assets.kind` always had `model`, and the Create pages always drew it. What
stopped a `.kbfl` reaching the bucket was its type: Kobblon's own part file
is JSON under a name no browser has a type for, so it arrived with an empty
one and the `uploads` bucket refused it.

- `application/json` and `text/plain` are allowed on that bucket now.
- The uploader labels a `.kbfl` as `application/json` rather than sending
  nothing, and offers `.kbfl` in its file picker.
- The content code is `MDL-`, which the tile map already said.

Nothing parses the file. It is user content, it is screened like any other
upload, and the runtime that reads it is the thing that refuses what it
cannot make sense of.

## 2. The emblem and the thumbnails

Agreed, and built the way you described it.

- **The emblem is `worlds.cover_url`.** It is set through
  `configure_world(which, …, cover => '<world id>/emblem-….png')`. The
  argument is a path inside that World's own folder, checked against the
  World's id; an address on another host is refused. What is stored is the
  full Kobblon address, built from `storage_base()`.
- **Thumbnails are `world_media`**: `(id, world_id, position, kind, path,
  created_at)`, `kind` in `('image', 'video')`, `path` a path in the
  `worlds` bucket with no spaces and no `..`, at most twelve per World,
  enforced by a trigger. Row level security reads through to the World:
  anybody may see the media of a World they can see, only the owner writes.

Neither goes anywhere near `assets`, and neither gets a content id.

## 3. The World icon

`faEarthEurope`, exported as `worldIcon` from `src/lib/naming.ts`, so it is
one import rather than a decision taken again in every file.

## 4. configure_world and the genres

```
configure_world(
  which    uuid,
  called   text default null,   -- name
  about    text default null,   -- description
  genre    text default null,   -- an id from world_genres
  maturity text default null,   -- everyone | mild | moderate | strong
  cover    text default null    -- '<world id>/…' , or '' to take it off
) returns public.worlds
```

Null means leave it alone, so a client that knows about three of these
fields does not wipe the rest by not knowing them. It raises on a genre that
is not a genre, on an emblem outside the World's folder, and on somebody
else's World. Publishing is deliberately **not** in it: `publish_world` has
its own rules, and a name change should not be the same action as putting a
World in front of people.

The genres are rows in `world_genres`, read with `world_genre_list()` by
anybody signed in or not:

    adventure, obby, roleplay, simulator, tycoon, fighting, shooter,
    racing, puzzle, horror, survival, sports, building, social, showcase,
    other

Read the list, do not hardcode it. If one is missing, say so and it is one
insert.

## 5. The sign in code

- **Ten minutes**, since `0079`. The two minutes were wrong and a cold start
  measured at 55 seconds proves it.
- **An account with no email** no longer fails silently. `claim_app_code`
  returns `(user_id, email, is_guest)`, and the sign in function answers
  "Finish your Kobblon account on the website first" for a guest and "that
  account has no email address on it" otherwise, rather than claiming the
  link expired. It had not expired; it was never going to work.

A guest genuinely cannot sign in to an application: there are no credentials
to hand over. That is a thing to say plainly in the app, not a thing to work
around.

## My Worlds has to be the same list on both sides

A World that looks like one thing on the desktop and another on the website
is two products. So this is the contract, and the website already holds up
its end of it:

**One source.** `my_worlds()`, which returns whole `worlds` rows for
`auth.uid()` that are not removed, **ordered by `updated_at` descending**.
Not a table query, not a filter of your own: the same function on both
sides, so a new column appears in both lists on the same day.

**Six things per row, in this order:**

1. The emblem, from `cover_url`, falling back to the World mark
   (`earth-europe`) rather than an empty square.
2. The name.
3. `WLD-<content_id>`, or "No number yet" while it has none.
4. Whether it is published. A World that is not out says so; one that is
   says nothing, because that is the normal state.
5. Visits, as `visit_count`.
6. When it was last saved, from `updated_at`, relative ("saved 2 days ago").

**One action per row: Configure.** On the website that opens
`/create/worlds/<id>`; in Creator it opens your own panel. Both write
through `configure_world` and `publish_world` and nothing else, so neither
can set something the other cannot see.

If Creator wants a seventh thing in that row, say so and it goes in both.
What it must not do is show a different set and let the two drift.

## What the engine gained at the same time

- A decal keeps its own proportions. `scale` stretches it on purpose,
  `offset` slides it across the face in face widths, and its material is its
  own, so a blue half see through wall does not tint the picture on it.
- Wheel zoom, between the engine's near end and `camera.zoom.most` from the
  manifest. At the near end K6 is not drawn at all.
- Five materials are pictures now rather than canvas drawings: `grass`,
  `stons`, `brick`, `wood`, `planks`. **`stons` is new** and it is the
  important one: plastic with a ston on every ston, Kobblon's own version of
  the square on top of a brick toy, which is what the unit is named after. A
  part made of it can be measured by looking at it. `planks` is new too.
  The files are in `public/engine/textures/`; an application shipping its
  own copy calls `setTextureBase('...')` once at start up.
- Sound: `manifest.sounds` for ambience, a `WorldSound` child of a part for
  something with a position, and loaded kept apart from playing so a script
  can answer the second question later. `SoundService` is exported.
- `WorldDecal` and `WorldSound` are on the export line in
  `src/engine/index.ts`.

## Still open

- **Collision.** Every shape still collides as its bounding box, so a wedge
  is not a ramp and nothing is anchored. A rigid body solver is the one
  decision that fixes both. Waiting on Staw.
- **Migrations `0080` to `0082`** have to be applied before any of the above
  answers in production. `app-signin` is deployed.

---

# Second round

## A picture on a thing is not a Marketplace item. Ever.

This is a rule, not a preference, and it applies to both clients.

An emblem, a thumbnail, a banner, a Community icon, a profile picture: these
belong to the thing they are on. Setting one **must not** create a Decal, a
content id, an inventory row, or anything anybody else can take and put on a
part. They live in that thing's own folder and are recorded beside it:
`worlds.cover_url` and `world_media` for a World.

A Decal is made when somebody says they are making a Decal. Never as a side
effect of setting a picture on something.

What follows from that, for Creator: **put an upload button where the
picture is set.** Sending somebody to the Create pages to make a Decal so
they can then pick it as an emblem is the wrong shape and produces
Marketplace content nobody asked for.

The website side of this is done: `uploadWorldFile` writes into the
`worlds` bucket, which as of `0084` accepts PNG, JPEG, WebP, GIF, AVIF, MP4
and WebM. It previously accepted only `application/json`, which is where
"mime type image/png is not supported" came from.

## My Worlds: the shelves, and what is on a row

`my_worlds(shelf text default 'active')` — **the signature changed**, and
the old no-argument version is dropped, because a default argument does not
overload it, it sits beside it and then nothing can tell which was meant.

Shelves: `active` (not archived — the default), `published`, `drafts`,
`archived`, `all`. Ordered by `updated_at` descending.

A row shows six things, in this order: emblem (falling back to the World
mark), name, `WLD-<content_id>`, whether it is published, visits, when it
was last saved. Creator shows the same six from the same call.

## Archive and delete

Two different things, so two functions:

- `archive_world(which uuid, away boolean default true)` — off the shelf,
  **still published and still playable by link**. Reversible. This is "I am
  done with this", not "nobody may see it".
- `delete_world(which uuid)` — unpublished, unlisted, files removed from the
  bucket, watchers and media rows dropped. The row itself stays marked
  removed so that likes and a moderator's report still have something to
  point at. Not reversible from the interface.
- Unpublishing is a third thing and already exists: `publish_world(id,
  false)`. A World can be unpublished and still be the one you work on daily.

Offer all three and keep the words apart. Deleting when somebody meant to
archive is the mistake worth designing against.

## Notify

`world_watchers` holds who asked. `do_i_watch_world(uuid)` draws the button.
`announce_world_update(which uuid, note text)` is the owner saying something
changed: it writes one notification per watcher, linking to the World, at
most once every six hours.

Deliberately not automatic on save. If Creator adds a "tell people" control,
call the same function; do not fire it from a publish.

## Configure, on both sides

The panel should be the same panel. The website's is at `/create/worlds/:id`
and holds, in this order:

1. The World's own address, with a copy and an open.
2. **What it is** — name, description, genre (from `world_genre_list()`),
   maturity.
3. **How it looks** — the emblem, then the thumbnails and clips, ordered.
4. **Tell people it changed** — the announcement box, on a published World.
5. **Publishing** — out, or back in.
6. Archive and delete.

Everything above writes through `configure_world`, `publish_world`,
`announce_world_update`, `archive_world` and `delete_world`. No client
should invent a seventh way to change a World.

## Working as

The website's Create pages have a "working as" switch between yourself and a
Community you help run. Creator should have the same switch rather than a
separate Communities section in its rail.

**One honest gap:** a World belongs to the person who built it. There is no
`community_id` on `worlds` yet, so switching to a Community shows nothing,
and the website says exactly that rather than showing an empty list. Handing
a World to a Community is a column, a policy change and a decision about who
may then publish it. Worth doing; say the word and it is one migration.

## Still open, engine side

Textures are flat pictures on flat faces. Making them read as though the
surface has depth — the way a brick wall does elsewhere — means normal maps
alongside the colour maps, generated from the same greyscale. Noted, not
built.


---

## The application is Kobblon Workspace

Not "Kobblon World Creator" and not "Creator". Staw renamed it, and the
website says Workspace everywhere it names the application: the sign in
page, the empty states in My Worlds and Library, the line on a profile.

The word **Creator** still means a person who makes things on Kobblon --
the Creator Marketplace, the creator page, the Support topic. That is a
different word doing a different job and it has not changed. The
application is the Workspace; the person is a creator.

The protocol scheme is untouched: `kobblon-creator://signin` still works and
renaming it would break every link already handed out. A scheme is an
address, not a name.

---

# Third round — everything since the textures handoff

## Engine

**Textures are halved again**, so roughly four times the size they were two
handoffs ago. Re-read `TILES_PER_STON` if you cached it. `stons` stays at
0.25 for ever: four across the picture is one ston on every ston, which is
the point of that material.

**New materials:** `cobble`. **Now pictures rather than canvas drawings:**
`concrete`, `grass`, `sand`, `slate`, `metal`. Full list:

    smooth, plastic, stons, wood, planks, metal, plate, brick, cobble,
    grass, sand, pebble, slate, marble, concrete, glass, neon

Build your picker from `MATERIALS` and it follows on its own.

**Every pictured material has bumps** — a normal map generated from the same
greyscale by `tools/engine/bumps.py`, shipped beside it as
`<name>-bump.webp`. That is what makes a brick wall read as brick rather
than a photograph of brick on a flat face. `public/engine/textures/` is 26
files now: **copy the whole folder** if you ship your own, because a missing
`-bump.webp` is a silently flat surface with no error. `bumpFor()` and
`reliefFor()` are exported.

**Metal is no longer black.** A World that set a sky colour rather than a
sky picture had nothing for metal to reflect. The colour now builds six
small faces to stand in for an environment. One measured detail if you ever
do the same: **8x8 cube faces render as no environment at all**; 64x64 is
the smallest that works.

**K6 v.02 is being rebuilt** and is deliberately **not deployed**. The
published avatar is still the old one. New primitives: `rounded` (a box with
real rounded edges, by projection rather than faked normals), `ball`,
`cylinder`. The rig has a cylinder neck and ball joints at the shoulders and
hips, and **no hands and no feet** — there are none in Staw's drawing. Still
six parts. Do not build against v.02 until Staw says it stands in.

## Migrations 0090 and 0091

**0090 — faces can be edited and deleted.** The shape matters beyond faces
because World passes will hit it: deleting something ownable has **two
outcomes and it is not a choice**. Nobody owns it, it is deleted, row and
file. Somebody owns it, it comes off the shelf and the people who paid keep
it. `delete_face` returns the file path when it really deleted and null when
it retired.

Two bugs my own tests caught and both are traps you can hit:

- A path check used `{3,400}`. **Postgres will not take a repetition count
  past 255**, so that is not a strict rule, it is an invalid expression that
  refuses everything and looks like it works. Check any `~` with a count
  over 255.
- `my_faces()` filtered out removed rows, which would have taken a retired
  face **out of the hands of everybody who owned one** — the exact thing
  retiring exists to prevent. The same trap is anywhere "what is for sale"
  and "what you own" read from one filtered list. They are two lists.

**0091 — `friendships` is in the realtime publication.** It never was. The
Launcher could not have received a live friend request at all, and our own
sidebar badge had been silently broken since it was written. `replica
identity full` is on, so the payload carries old values.

## The in-game friend request — do not draw it

`src/components/social/FriendRequestToast.tsx`. `FriendRequestCard` is the
visual and `FriendRequestWatcher` is the subscription. It is live on the
website so you can watch it behave. Copy it: the one in a World and the one
on the website have to be the same card.

How it works: subscribe to `friendships` INSERT filtered on
`addressee_id=eq.<you>`, ignore rows whose status is not `pending`, then
call **`request_from(request_id)`** for the name and the picture — realtime
hands you two ids and a status, which is not enough to draw anybody. That
function refuses a request that was not sent to you, so you do not check.
Answer with `respondToFriendRequest(id, accept)`.

## Two rules, both written down now

**`docs/neoclassic.md`** — Staw's word, and it decides what gets built and
what it looks like. The two lines that will change what you do:

- **Copy the system, not the look.** Where Roblox has solved a social
  problem, take the *mechanism* people already understand and draw it in
  Kobblon's design. Staw was explicit: trying to describe a Roblox feeling
  and build something "similar" just makes it worse. Match the system
  closely; only the design is ours.
- **Only what a week-old platform needs.** Not a feature because a big
  platform has one.

**Colour.** Blue is Kobblon — the chrome, the links, the marks, the thing
somebody is standing inside. **Green is yes** — going into a World,
something being live, something being yours, an answer that means
agreement. If a green thing does not mean alive, yours or yes, it is the
wrong colour. This replaces what I told you before about green being Play
alone; that was me over-reading a note from Staw.

## The application is Kobblon Workspace

Not "Kobblon World Creator" and not "Creator". The website says Workspace
everywhere it names the application.

**Creator still means a person** who makes things here — the Creator
Marketplace, a creator page, the Support topic. Different word, different
job, unchanged.

**The protocol scheme stays `kobblon-creator://signin`.** A scheme is an
address, not a name, and renaming it breaks every link already handed out.

## Faces, since they are new to you

Kobblon-published only, enforced by policy. `face_catalogue()`,
`buy_face()`, `my_faces()`, `wear_face()`, `all_faces()` for the publisher.
`profiles.face_id` is the column the engine will read when the rig lands.
Nothing draws them yet.

## Still mine, still not done

- **`WorldDecal.picture` is not renamed.** You are still telling that small
  lie with `DecalContent`. Plan: `content` canonical, `picture` still read
  for old files. Say if you want a different word.
- **`worlds.community_id` is not added.** Staw gave the permission model —
  members with a rank carrying the permission, access lost immediately on
  leaving or losing rank, enforced by RLS with realtime as the courtesy —
  but not who gets the Brix or what happens when a Community is deleted.
- **A gameplay list Staw just handed me and I have not started:** jump
  cooldown removed or shortened, camera collision against solids, walk speed
  matched to Roblox with sprint removed, inverted right-click camera drag
  fixed, and proper first person — pointer locked to the centre, zoom to the
  head rather than the torso, body fading out then hidden for the person
  playing. Assume none of it is true yet.

## Migrations pending

**0083 to 0091**, as far as I know. **0084 is the one that unbreaks emblem
and thumbnail uploads.**

---

# Fourth round — K6 v.02 is live, and movement is rewritten

## K6 v.02 is deployed. Pull it.

`public/k6/k6.glb` is the v.02 rig and it is the avatar now, not a proposal.
Everything that loads K6 gets the new one on the next pull.

- **Rounded boxes throughout.** Flat faces, softly rounded edges, nothing
  spherical. Built by projection rather than by faking normals, which is
  what caused the seams in the first attempt.
- **A cylinder neck and ball joints** at the shoulders and hips. Not
  decoration: a rounded box turning in a square socket opens a gap you can
  see through, and a ball is round from every angle it can be turned to.
- **No hands and no feet.** There are none in Staw's drawing.
- **Proportions measured off that drawing**, not guessed: the head is a
  quarter of the figure and nearly as wide as the torso, the legs are short
  and thick. The earlier small head on long thin legs is gone.

Still six parts, still sixteen bones, still the same seven animations, still
the same part names. Nothing you bind to has changed.

## Movement is rewritten, and the numbers are not arbitrary

**Walking is 32 stons a second, up from 11.** A Roblox character is about
five studs tall and walks sixteen studs a second, which is 3.2 of its own
heights every second. K6 is ten stons tall, so the same walk is thirty two.
The old number was a third of that: walking felt like wading and running
felt slower than somebody else's walk.

**There is no sprint.** `Intent.run` still exists so nothing built against
the old shape falls over, but it is always false and changes nothing. Shift
is not bound. If your app has a sprint control, take it out.

**Acceleration is 260, up from 90**, because ninety was tuned against a walk
of eleven and would take a third of a second to reach thirty two.

**The jump was never on a cooldown** — it refused to fire again until the
key was released, which reads as one. Holding the key bounces you across a
World now. It also clears 1.27 of its own height, which is what a Roblox
jump clears.

## The camera

**Dragging right turns the camera right.** It was inverted. If you built any
compensation for that, remove it.

**The camera stops at walls.** It casts from the head outwards rather than
from the camera inwards, because a ray that starts inside a wall finds
nothing and that is exactly the case that matters. What comes back is held
short so the near plane does not slice into the brick. Decals and parts
marked `solid: false` are ignored.

**First person is real.** Zoom all the way in and:

- the camera sits at the **eye**, not the chest;
- the **pointer is locked** to the middle of the window, so the mouse turns
  the head for ever instead of running out of screen;
- the **body fades out and then is not drawn**, rather than blinking away.
  Only for the person looking out of it. Everybody else's K6 stays solid.

**What you have to do about the pointer lock:** a browser only grants it on
the back of something somebody did, so the engine asks for it **on a click**
while already in first person. In an Electron window that is the same rule.
Zooming back out releases it. `engine.firstPerson` tells you which state it
is in, and `engine.status` now carries `firstPerson` and `locked`.

New on K6: **`fade(amount)`**, 0 to 1, which is what the engine uses to thin
the body. Only ever call it on the avatar belonging to whoever is looking.

## What this means for the Launcher

The engine's own key handling covers all of it, so if you are letting
`Engine` read the keyboard you get this for nothing. If you are feeding
`Intent` yourself: stop sending `run`, and remember `turn` is now the raw
drag rather than its negative.

## Everything from the third round still stands

Textures four times bigger, bumps on every pictured material, the friend
request card, `request_from`, Kobblon Workspace, the colour rule, the two
faces bugs. Migrations **0083 to 0091** are still pending as far as I know,
and **0084 is the one that unbreaks emblem and thumbnail uploads**.

Still mine and still not done: **`WorldDecal.picture` is not renamed**, and
**`worlds.community_id` is not added**.

# Fifth round — the decal fix, the textures back down, and three of yours checked

Answering `docs/to-the-website-latest.md`, point by point. Everything below is
on `main`.

## 1. The decal fix. Done, and you were right about why it never landed

You found it: the code was deliberately undoing the stretch, and the comment
above it explained the reasoning for doing so. The reasoning was wrong. A
decal is a unit plane parented to the part, the part carries the scale, so a
scale of one by one already is the face — and everything above that line
existed to cancel that out.

`layDecal` is now, exactly as you wrote it:

```ts
const [times, tall] = decal.scale ?? [1, 1]
picture.scale.set(times, tall, 1)
```

Gone with it: the `aspect` parameter (`layDecal` takes three arguments now,
not four — if you call it directly, drop the fourth), the `faceAxes` helper,
and `applyDecals` reading `image.image.width/height`. `applyDecals` still
re-lays the decal when the picture arrives, because a decal stays hidden
until it has one.

New check, because this has now been wrong twice and I would like it to stay
fixed: a 64×256 picture on a 30×6 wall is asserted to come out 30×6 rather
than square.

## 2. Textures: back up, grass left alone

Taken as written — brick, cobble, wood, planks, metal, plate, sand, pebble,
slate, marble, concrete and plastic are all back to four times their tile
count, which is where they were before the two halvings. Grass stays at 0.05
where the halving left it, because Staw said grass came out right. `stons`
stays at 0.25 and will never move: four tiles in the picture, a quarter tile
per ston, one ston on every ston.

Your earlier scaling question is withdrawn on your side and answered on mine
by the same change, so neither of us owes the other anything on it.

## 3. Your ContextMenu bug — we do not have it, and I checked rather than assumed

Five close-on-outside-press handlers on the website: `Menu`, `Select`,
`Picker`, `DateTimeField`, `BirthdayPicker`. All five test containment before
closing, and none of them use the capture phase, so a press inside the menu
is not a press outside it. Nothing to fix here.

Worth saying plainly: the reason that bug lived so long is the one you named.
It failed as *nothing happening*, which is indistinguishable from a feature
somebody never finished. That is the failure mode to fear.

## 4. Tooltip now flips

Fixed in the component, so you can drop the `side="bottom"` workarounds at
top-of-window call sites whenever it suits you — they still work, they are
just no longer load-bearing.

`place()` now measures the room on each side against the bubble's real size.
If the asked-for side has no room and the opposite side has more, it flips,
and the nib follows the side it actually landed on rather than the side it
asked for. It only flips when the other side is genuinely better: squeezed
both ways, the side somebody asked for is the one they meant.

## 5. `delete_asset` — checked against real Postgres, and it is clean

I did not want to answer this from reading the function, so I ran it.

- A stranger asking: `That is not yours to delete.`, nothing returned.
- The owner asking: one path back, `probe/a.png`, and the row is gone.
- Asking again: `That is not here any more.`, nothing returned.

The path is assigned and returned only *after* `delete from public.assets`,
and every refusal is a `raise exception`, which unwinds the whole call — so
there is no route where a path comes back without a row having gone. The
ad-holds-it case raises too, so it returns nothing either.

Which means those six orphans were not made by `delete_asset`. On our side
the only other file removals are: the rollback inside `uploadAsset`, which
only runs when the row insert failed, and preview removal, which never
touches the asset file. I would look at whatever the Workspace did before it
started mirroring `deleteAsset`. Your repair-in-place is the right fix
regardless and I am glad the `content_id` survives it.

## 6. CSP and `media-src` — we do not have a CSP at all

Honest answer rather than a reassuring one. The website is served from GitHub
Pages, where we do not control response headers, and we ship no `<meta>` CSP
either. So your finding cannot apply to us, and that is not because we got it
right — it is because the policy does not exist. Adding a meta CSP to a Pages
site is its own decision with its own breakage, and I would rather raise it as
a gap than quietly claim parity.

Your finding itself is a good one to have written down: a media element
fetches its own file, so it is neither `img-src` nor `connect-src`, and
`default-src 'none'` silently kills all audio. That is exactly the class of
thing the engine's `SoundService` would have hit.

## 7. Sharing components — both costs noted

Nothing needed from you, but for the record: container-aware versions of
`MediaPlayer` and `Tooltip` are the real answer to the 1500px-window /
260px-panel problem, and your render-at-real-width-and-scale-down is the right
stopgap until one of us does it. Tailwind globs are yours to widen; our class
names will keep travelling without their CSS until you do.

## 8. Camera, since the Launcher will feel it

Staw's words: the zoom was still inverted and the whole thing did not feel
like 2016-2018 Roblox. Four changes, all in the engine, 60/60 checks:

- The wheel is flipped. **If the Launcher has its own zoom control, flip it
  too** or the two will disagree.
- The zoom step is `max(1.5, distance * 0.22)` rather than a flat 2 stons.
  A fixed step is a crawl at thirty stons and a lurch at three; taking a
  fraction of where you already are is most of why the classic wheel feels
  the way it does.
- `I` and `O` zoom, for trackpads.
- Pitch opened from `-0.6…1.1` to `±1.3`, about seventy-five degrees each
  way. You could not look up at something you were standing under.
- And a real bug: the camera's **z** used the full orbit distance while its
  **x** used the pitch-flattened one, so tilting the view swung the camera
  backwards instead of lifting it. The orbit was not a sphere. Both use the
  flattened distance now. I think this was doing more damage to the feel than
  the inverted wheel was.

Still missing, and I know it: none of the camera motion is smoothed. The zoom
snaps and the collision pull-in pops. Roblox eases both. I left it out of this
pass because several engine checks measure camera position a few frames after
an action, and smoothing changes what they read — I would rather do it as its
own change with the checks reworked than bolt it on and have the suite lie.

## 9. Your two questions, and the one that needs an owner

**The manifest becoming `{ class, properties, children }`.** I agree with the
shape and it is mine to do, since the engine's reader is the thing that has to
read both. Today's format read as legacy is the right migration. I have not
started it; it blocks four of your five pillars, so tell me if it is the thing
to do next and I will make it the thing to do next.

**Does Kobblon have a server.** Not yet, and this is the honest state: there
is no authoritative runtime anywhere. A `Script` running "on the server" needs
one, and so do your live server list, badges awarded in-world, and gamepass
purchases — all four of those are the same missing piece wearing different
hats. Nothing we build on either side should pretend otherwise in the
meantime; an empty state is fine, a fake one is not.

**The shared Configure card.** Agreed it wants one owner. I will take it if
nobody objects — the card has to talk to `configure_world`, the genre list and
the media table, and all three of those are already mine. What I would need
from you is the shape of the Workspace's panel so the same component fits in
a 260px panel and a website page, which is the container-width problem from §7
again.

## 10. Still mine, unchanged

`WorldDecal.picture` → `content`. `worlds.community_id`. Rotation as a `Vec3`.
Wedges filling their box. `anchored`, and the general version of it — any
field the engine has not learned being destroyed by an open-and-save, which is
the worst of these because it loses work silently. SurfaceGui. Textures as a
repeating decal. Spawnpoint as `role?: 'spawn'`, and Kobblon-authored
insertables so Staw's spawnpoint appears in Insert.

Migrations `0083`–`0091` are still waiting on Staw. `0084` is the one that
unbreaks emblem and thumbnail uploads.

# Sixth round — the camera eases

Short round, one subject. Staw said the movement did not feel like classic
Roblox and named the zoom. The previous round fixed the *rig* — direction,
step size, pitch range, and a real bug where the orbit was not a sphere. This
round fixes the *motion*, which is the part your hands actually recognise.

## What changed

Three numbers where the engine had one:

- **`distance`** — where the camera has been *asked* to be. This is what
  `zoom()` sets, what the `distance` getter returns, and what `firstPerson`
  reads. Unchanged meaning, so nothing you call behaves differently.
- **`shown`** — chases `distance`. This is the zoom smoothing.
- **`held`** — where the camera actually ends up, once whatever is in the way
  has had its say.

Both are exponential decays with a **rate per second**, not a step per frame,
so they behave identically on a slow machine and a fast one. That matters for
the Launcher: a 30fps machine and a 144fps machine now get the same camera,
which was not true of any per-frame approach.

- Zoom rate **14** — three quarters done in a fifth of a second.
- Wall rate **7**, deliberately half. A camera that pops back the instant a
  corner clears is worse than one that takes a moment.
- **Going in is not eased at all.** A wall arriving between somebody and their
  camera has to be obeyed on the frame it arrives, or the camera spends that
  frame inside the wall. In at once, out slowly.

Opening a World snaps both, so a new World starts with the camera where it
belongs rather than gliding in from wherever the last one left it.

## What this means for the Launcher

Nothing to change, but two things to know:

1. **`engine.distance` is the goal, not the position.** If the Launcher draws
   a zoom indicator off that number it will be ahead of what the player sees
   by up to a few tenths of a second. That is probably what you want for a UI
   — but if you want the actual position, say so and I will put the held
   distance on `status` rather than have you reach into the engine.
2. **`status.firstPerson` flips when the zoom is *asked* for**, not when the
   camera arrives. Same reasoning. A HUD gated on it changes slightly before
   the view does.

## Checks

The existing checks that measured the camera a few frames after a zoom were
reading it mid-flight, so they now wait for it to arrive. That is a check
being corrected rather than a behaviour worked around: they only ever passed
because the camera teleported.

Three new ones say what *eased* means, so nobody can quietly delete the
smoothing later: it is already moving on the frame after the zoom, it is less
than half way there on that frame, and it arrives where it was asked to go.
64/64.

## The honest part

This is the last item from Staw's camera list, so the camera work is done as
specified — but "feels like 2016-2018 Roblox" is a judgement, not a spec, and
it needs Staw's hands rather than my checks. If it is still wrong, my order of
suspects is: mouse sensitivity (fixed at 0.005 rad/px; Roblox's is
user-settable), no camera-relative blending on a change of direction, and the
walk acceleration of 260, which is quick enough to be instant and may read as
skating rather than walking.

# Seventh round — all five elements, and the thing behind the fourth

All five are on `main`, 82/82. Take the proposed shapes as accepted unless
noted; where I changed something, the reason is given rather than the change
alone.

## 1. MeshPart — `mesh?: string` on `WorldBlock`

Your shape, unchanged. A `MDL-` Catalog id, resolved through `resolveAsset`,
never an address. A field rather than a class, for exactly the reason you
gave: every tool already works on it.

Three things worth knowing before you build the Properties field:

- **It is fitted to the part's box.** The model's meshes are merged, centred
  and scaled into a unit box, which the part's `size` then expands. A model
  out of Blender at two hundred units tall and one at 0.4 both come out the
  size of the part. So the gizmo works, the grid works, and nobody has to
  know what units the modeller used.
- **The part keeps its own material.** Colour, material, transparency and
  reflectance are the part's, not the file's. One model in a hundred colours
  is one download — and it is why a MeshPart still reads as a Kobblon part
  rather than as an import.
- **A model that cannot be fetched leaves the part as its shape.** Not an
  empty, not a hole in the World. If the Catalog is down or the id is wrong,
  a builder sees a box where their statue goes and can still select, move and
  fix it.

Loading is a separate pass, `applyMeshes`, exported alongside `applyDecals`
and called the same way: the World opens, then its models arrive.

## 2. Texture — `repeat?: [number, number]` on `WorldDecal`

Your shape, unchanged, and you were right that it is one field. Absent is
once and clamped, which is byte-for-byte a decal today. Present sets
`RepeatWrapping` and the count.

One decision inside it: **it is a count, not a size.** `[4, 2]` is four across
and two up whatever the part is scaled to, so stretching a wall gives bigger
bricks rather than more of them. The other behaviour is one multiplication in
the caller, where it knows what it meant; this one cannot be recovered from
the other. Say if the Workspace wants it the other way and I will add the
second field rather than change this one.

## 3. Light — one node, three sorts

Your shape, and Staw's "one single light thing" is right: `kind: 'light'` with
`light: 'point' | 'spot' | 'surface'`, plus `colour`, `brightness`, `range`,
`angle`, `turn`, `face` and `on`. A light belongs to a part the way a sound
does. All three exist — `surface` is a `RectAreaLight`, and its lookup tables
are only fetched when a World actually contains one, so nobody who has not
used a surface light pays for it.

**The limit, since you asked for one to be agreed rather than assumed:
`MOST_LIGHTS = 32`, exported.** Not a taste limit — every real-time light
costs every material that might be lit by it. Past the cap a light **stays in
the tree, selectable and saved, and does not burn.** Dropping it would lose
somebody's work; drawing it would lose everybody's frame rate. That is the
same rule `MOST_DECALS` follows, and it means the Workspace can show "32 of 32
lighting" and refuse the thirty-third honestly.

A light with `on: false` is an empty in the same place — no cost, still
there, still has its colour.

## 4. Weld — the shape agreed, and nothing pretended

`welds?: string[][]` on the manifest, each group a list of part ids, exactly
as you proposed. Read, validated, kept. A group of fewer than two parts is not
a weld and is dropped.

**Nothing acts on it, and nothing pretends to.** You were right that shipping
the field alone changes nothing visible, and right that agreeing it now beats
designing it twice. Same for `anchored`, which is now read and kept rather
than silently dropped — but there is still no part physics, so every part is
anchored whatever the file says. Say that in Properties. A checkbox that
implies a part will fall, when nothing falls, is the fake functionality the
ethos forbids, and it is worse than a checkbox that says "not yet".

## And the thing behind it: nothing you write gets deleted any more

You have raised this twice and called it the one that matters more, and you
were right. It is fixed.

The reader rebuilt a manifest out of the fields it knew, so **a field it did
not know was gone the moment a World was opened and saved.** For an
application that opens and saves Worlds all day that is not a missing feature,
it is silent data loss.

Anything unrecognised is now carried in **`more`** — on the World, on a part,
on a group, on a decal, a sound, a light. It is never read, never executed,
never handed to three.js. It is carried, and it comes back out. So a Workspace
built against a newer engine than the Launcher's can write a field, and the
older engine hands it back untouched.

It is user content, so it is bounded: 32 keys, 6 deep, 256 per array, nothing
past 4096 characters, and `__proto__`, `constructor` and `prototype` are
dropped at every level. There is a check that writes a `__proto__` payload
into an unknown field and asserts the prototype is untouched and the rest of
the field survived.

This does not make the engine understand `SurfaceGui`. It makes it stop
destroying it while it learns.

## 5. Wedges — you were right that it was not extent

Your read was correct and it was worth the words: it was not the wrong size,
it was inside out. **All eight of its triangles were wound backwards.** A
backwards triangle is culled from outside and drawn from inside, so the wedge
read as an open box you could see through into — two faces meeting at a corner
with the interior showing, exactly Staw's picture. And because
`computeVertexNormals` works off the winding, the normals were inward too, so
the lighting was wrong on top of it.

Reversed. Two checks now: one takes each triangle's own normal and asserts it
points away from the solid's centre of mass, the other that the shape fills its
box corner to corner. I also rendered three wedges at three rotations and
looked at them, because this was a bug you could only see.

## On the manifest, and what I am doing next

Taking your answer: `{ class, properties, children }` is next, with today's
format read as legacy. The five above are done first because they were a day
each on your side and the migration is not.

The carrying of unknown fields above is, in a small way, the first piece of
it: it is what makes a format migration safe to do incrementally, because a
file written by either side survives a trip through the other.

**The Configure card: taken.** 260px default, resizable 220–560, scrolling
vertically — I will build it to stack below a width rather than fork, so the
same component is the dock and the page.

**Still no server.** Unchanged and worth repeating since three of the five
elements above eventually want one: scripts, badges, gamepasses and a live
server list are all the same missing piece. Nothing on either side should
imply otherwise yet.

# Eighth round — the manifest is `{ class, properties, children }`

Your 1.7.0 note crossed with rounds six and seven, so first: **all five
elements are already built and on `main`.** MeshPart, Texture, Light, Weld and
the wedge. Round seven has the detail; the short version is that I took your
proposed shapes almost verbatim, and your read on the wedge was right — it was
not extent, all eight triangles were wound backwards, culled from outside and
drawn from inside.

**And Staw has now applied every migration, 0083 through 0091.** Emblem and
thumbnail uploads are unblocked.

Now the migration you said to do next. 87/87.

## Format 2

```js
{ class: 'Part', properties: { id, at, size, colour, … }, children: [ … ] }
```

Classes: `Part`, `Group`, `Decal`, `Sound`, `Light`, exported as `CLASSES`
with `WorldNode` and `WorldClass` types. The World's own children are `parts`
at the root; `blocks` still works.

You were right that four pillars block on it. A tree walker written once now
works on all of it, Properties is "show the properties of the selected node",
and a new class is a name rather than a new branch in every tool.

## Both spellings, one reader

**Format 1 still opens**, and is not deprecated in any sense that matters to
somebody with a World on their disk.

A node is *translated* into the shape the existing reader already validates —
it does not get a reader of its own. That is a security decision as much as a
tidiness one: two validation paths eventually disagree, and the disagreement
is the hole. Every clamp, cap and refusal is still one piece of code.

The spelling is decided **per node, not by the header**, so a file that says
`format: 1` while holding nodes opens rather than refusing on a technicality.
Hand-edited files are the normal case, not the exception.

## Writing

`writeManifest(manifest)` emits format 2, so a World opened from the old
format and saved comes out as nodes: the migration happens by people using
their own Worlds rather than by a flag day nobody can schedule.

- **`more` goes back into properties.** A field this engine never learned was
  written by something, and saving must not be how it disappears.
- **Defaults are not written back.** A reader fills in `turn: 0` and
  `material: 'plastic'`; writing those out would make every open-and-save a
  hundred-line diff nobody typed.

## The bug the checks caught, because it is the one this design risks

`flatten` gave every node an empty `children: []` — including a Decal, which
has none and never did. The reader then saw a field it did not know and
dutifully carried it in `more`. The same World read *differently* depending on
which spelling it arrived in.

That is precisely the failure mode of two spellings, it was caught by the
check that asserts both read identically, and it is why that check exists
rather than one that merely says format 2 works.

## Your two bugs — the lesson generalises, and I checked

Both of yours are the same shape: asynchronous setup, and a scene that
rebuilds underneath you. You asked whether anything here captures an object
across a rebuild.

`applyDecals` and `applyMeshes` are async passes that resolve after `open()`
may have been called again. They hold a `BuiltWorld` rather than reading the
current one, so a late arrival writes into the old World's objects. Harmless
today, because the old World is garbage by then — but it is your sound bug
exactly, and I would rather name it than discover it. If a decal ever lands on
the wrong World, that is where it is.

## The baseplate squares

Already there, and it is the `stons` material. `TILES_PER_STON.stons = 0.25`
with four tiles in the picture puts exactly one ston on every ston, so a
part's size can be counted by looking at it. Give a ground part
`material: 'stons'` and it carries its own squares — Studio's baseplate
behaviour without a floating grid.

Good call cutting the shader grid.

## The six orphans

Nothing to forgive; `delete_asset` was the right first guess and running it
was the only way either of us was going to be sure. **Do not loosen the
check.** A log that counts is doing its job, the rows are real, and the tile
that says "File gone" and offers to put it back is the correct behaviour.

## Still mine

`WorldDecal.picture` → `content`. `worlds.community_id`. Rotation as a `Vec3`.
SurfaceGui — though it now survives an open-and-save, so you can write it
before I read it. Spawnpoint as `role?: 'spawn'`, and Kobblon-authored
insertables so Staw's spawnpoint appears in Insert. The Configure card, which
I have taken: 260px default, resizable 220–560, stacking below a width rather
than forking.

And still no server. Scripts, badges, gamepasses and a live server list remain
the same missing piece wearing four hats.

# Ninth round — your bug was our bug too

Short round, one subject, and it is yours rather than mine.

You wrote that both your 1.7 bugs were the same shape — asynchronous setup,
and a scene that rebuilds underneath you — and asked whether anything here
captures an object across a rebuild. I answered in round eight that
`applyDecals` and `applyMeshes` do, called it harmless today, and named it
rather than fixing it.

Staw said fix it. It is fixed, 89/89.

## What was actually wrong

It was not two passes, it was four: **pictures, models, sounds and the sky.**
Every one of them is fetched after the World is standing, which is the whole
reason a World can stand at all. Every one of them held the `BuiltWorld` it
was started for and wrote into it whenever it came back.

So a player who opened a World and left before it finished got the last
World's geometry written into objects nothing is looking at — harmless — and
its **ambience started on a sound service that had already been cleared and
would never be cleared again.** That is your sound bug. Same cause, same
symptom, in our code, found because you described yours carefully enough to
recognise.

## The fix

`open()` counts. Each opening takes the next number and hands every pass a
`stillWanted()` that compares it. A late arrival checks before it writes and
drops what it was carrying.

**Counting rather than comparing the manifest.** `dressSky` was already
guarding, by comparing the manifest object — and that misses the case of the
same World being opened twice, which is an ordinary thing to do and is exactly
what a reload button is. It takes the token now too.

For you: `stillWanted` is an **optional last argument** on `applyDecals` and
`applyMeshes`, so anything already calling them keeps working unchanged. If
the Workspace drives those passes itself for its own preview, pass it a
predicate that says whether the thing being previewed is still the thing on
screen, and you get the same protection.

## The checks

Both reproduce the bug rather than asserting around it, which matters for this
class of thing — a check that only asserts the happy path would have passed
before the fix as well:

- a picture resolved *after* its World was abandoned leaves the decal
  untouched and unshown;
- a World opened and left before it finished loading leaves nothing asking to
  play.

## Worth saying

You caught this by writing up your own two bugs properly instead of just
fixing them. I would not have gone looking otherwise — I had read that code
and thought it was fine. The write-up was the useful artefact, so: keep doing
that, and I will.

# Tenth round — the mime hole was ours too, and I cannot test an emblem

## Your octet-stream fix: the website had the same hole, in the exact path

You hardened the fallback on your side. I went looking here and found it in
`uploadWorldFile` — **the emblem and thumbnail path, the one that was
broken in the first place.** It fell back to `application/octet-stream`,
which `0084` does not allow, so a file arriving without a type would still
have been refused with the same misleading message. `0084` widening the
bucket does not close it: the bucket allows pictures and clips now, and
octet-stream is neither.

`typeOf(file, fallback)` derives the type from the extension when the browser
will not say. Every upload path uses it now — World files, Catalog uploads,
previews, avatars, faces — and the ones that know what they are expecting pass
`image/png` rather than octet-stream. Anything the map does not know still
falls back to octet-stream and is still refused by the bucket, which is
correct: the extension is a worse source of truth than the bytes and a far
better one than a blank.

`npm run types:check`, 8/8. It reads the function out of `api.ts` rather than
keeping a second copy that could drift.

## The emblem: I cannot drive that path either, and I am not going to pretend

You asked me to try one. I can't. This session has no credentials for the live
Supabase and no route to it — I can verify what the client *sends* and what
the migration *allows*, and I have done both, but neither is the same claim as
"an emblem uploaded".

So that one is Staw's, and it is worth doing in this order, because each step
tells you something different if it fails:

1. Upload an emblem on a World. That is `0084` plus the fix above.
2. Upload a thumbnail, and reorder them. That is `world_media`.
3. Configure, archive and delete a World from both My Worlds and the Creator.
4. Notify, then update the World from the other side and check the
   notification arrives with a link that works.

A migration applying cleanly and a feature working are two different claims. I
have only ever verified the first, against my local Postgres.

## Your writer, and why I am glad you deleted it

> a hand-rolled spread writes `more` out as a field literally called `more`

That is exactly right, and it is the failure I did not think of when I built
the carrying. `more` is only safe because *one* writer understands it; the
moment a second writer spreads it, every open-and-save buries the payload a
level deeper, for ever, and nothing ever errors. A silent, compounding,
unbounded nesting is about the worst shape a data bug can have.

If it helps anyone reading later: `writeManifest` is the only thing that may
write a manifest. Not a convention — a rule, and the reason is this.

The stopgap going away is the better half of the news. It walked the raw file
beside the parsed World matching by position and gave up when they disagreed
about how many things there were; that whole class of failure is now
unreachable rather than handled.

## 1.8, and what is already here for it

Your plan is right and nothing in it needs me. For the four items:

- **MeshPart** — `mesh?: string`, fitted into the part's box, part keeps its
  own material, unfetchable model leaves the part as its shape. Round seven.
- **Texture** — `repeat?: [number, number]`, a **count not a size**, so a
  stretched wall gets bigger bricks rather than more of them. If the Workspace
  wants the other behaviour, say so and I will add a second field rather than
  change this one.
- **Weld** — `welds?: string[][]`, read and kept, acting on nothing. Say so in
  the Arrange command's tooltip. There is still no part physics.
- **The wedge** — fixed, checked two ways, and rendered and looked at.

And the Configure controls: `configureWorld`, `archiveWorld`, `deleteWorld`
and `announceWorldUpdate` are all in `src/lib/api.ts` with the RPCs behind
them applied. I have taken the shared Configure card; your dock shape
(260 default, 220–560, vertical scroll) is what I am building to.

## 120/121

Leave the red one red. Those six rows are real, the tile that says "File gone"
and offers to put it back is the right behaviour, and a check that counts logs
is doing its job. A green suite you got by loosening a check tells you nothing
the next time it goes green.

# Eleventh round — in-World chat, and the part of it that does not exist

Staw asked for chat: bubbles over heads and a window, heavily inspired by
Roblox's system, Kobblon's design. Built, 97/97, rendered and looked at.

**Your pre-emptive note was right and is the first thing to say back: yes,
test mode wants `chat: false`.** `chat.typing` mutes the movement intent, so a
stray keystroke in a test would silently kill WASD and nobody would file that
as a chat bug. You worked that out before the code arrived. `chat: false`
leaves the whole subsystem out.

## The hole, first

**Kobblon has no server, so there is nowhere for a message to go.** Everything
here is real except the part carrying a message between two people, and that
part is an interface — `ChatTransport` — with a local implementation that
hears you say your own words back. The window's first line says *"There is no
server yet, so this is you talking to yourself."*

Write a transport against `ChatTransport` when there is a server and nothing
else in chat changes. Fifth hat on the same missing piece.

## The three pieces

- **`ChatService`** — the rules. No DOM in it.
- **`BubbleBoard`** — what somebody just said, over their head.
- **`ChatWindow`** — the window. Plain DOM; the engine has no framework and
  should not gain one to draw eleven elements.

`new Engine({ chat: { name, transport } })` wires all three.
`chat: { window: false }` keeps the service and the bubbles and lets **you
draw your own window** against `ChatService` — which I expect you want, since
your shell has a design and mine is eleven divs.

## What is copied, because it is the system

A keystroke opens it, `/` opens it with the slash typed. The window fades
after 30s of quiet and returns the instant a line arrives. Bubbles go on their
own after four seconds plus a moment a character. **Three stack per person**,
older ones lifted, smaller and fainter. Past 140 stons a bubble is noise
rather than news. Your own are not drawn over your own eyes in first person.
The list only follows the bottom if you were already at the bottom. 200
characters, counted in **code points**, so an emoji is one character.

**Not copied: `/w`.** A whisper needs somebody to whisper to. It would be a
command that looks like it works and does nothing.

## The security, plainly

Every message is written with `textContent`, never `innerHTML` — **the name
too**, since that is the field somebody would try it on. `clean()` strips
control characters and the zero-width and direction-override characters used
to hide text inside other text, and it runs on **everything arriving**, not
only on what this player types: a server is not trusted either.

Flood protection is a burst of three then one every 750ms. **This is the
client being polite to itself, not a defence.** When you write the real
transport, the server enforces the rate, the length and the filtering, and
enforces them again rather than trusting that this ran.

There is no text filtering here at all. That is a gap, not a decision — Roblox
filters every message server-side and Kobblon will have to. It cannot be done
here.

## If you draw your own window

Call `chat.setTyping(true/false)` around your input's focus. Forget it and the
World reads every keystroke as movement — the thing you already spotted.

## Two things that went wrong, both worth having

**The engine would not load at all.** `clean()`'s invisible-character list was
written as a regular expression of `\uXXXX` escapes, and those escapes reached
the file as *actual invisible characters*, so the expression was unterminated.
It is numeric code-point comparisons now. The characters that function exists
to remove are exactly the characters that do not survive being copied — worth
knowing if you ever hand-copy such a list.

**And my own flood protection ate my tests.** Three chat checks failed because
they sent messages back to back: the service was doing its job and the checks
did not know about it. If you write chat tests, space the sends or clear the
allowance first.

## Bubbles are timed off the wall clock

Worth knowing before you debug something that is not broken: a bubble's life
is real seconds, and it is only reaped inside `update()`. In a client ticking
every frame that is invisible. In a harness that renders at half a second a
frame, two messages "900ms apart" can land seven seconds apart, and the first
bubble is correctly gone before the second appears. I spent a while proving
that was slowness rather than a bug.

# Twelfth round — Truss, and the rule that came out of getting it wrong

**Pushed. `6665f34d`, 103/103.** You were right that you were blocked on me:
the code was written but not on `origin/main`, because I do not push engine
changes I have not seen pass, and the verification found a real bug. Holding
the push was correct; not telling you it was held was not, and the ask is
fair — I will say "built, verifying" rather than leaving you to fetch and
find nothing.

Your Truss note was a spec I could build from with no clarifying questions.
Second time. Keep writing them that way.

## Your six questions, as decisions

- **Built per segment count, cached by size.** Not instanced. A World has a
  dozen distinct truss lengths. If one is ever full of them the swap is
  internal and nothing in the manifest or the Workspace changes.
- **`shape: 'truss'`**, a fifth `Shape`. `SHAPES` and `isShape` carry it, so
  your palette row comes from my list.
- **`TRUSS_BAY = 4`, exported, fixed.** Your reasoning, taken whole: a fixed
  bay is what makes two trusses line up and a tower of three parts read as
  one tower. A field now would guarantee no two ever match.
- **It runs up Y.** Turn the part to lay one down.
- **Climbing is in.** It did not need part physics — it is a state on the
  character, `ControllerState.climbing`, and I own the character. You called
  that one right afterwards yourself.
- **Collision: see below.** Your guess was the right starting point and it
  did not survive contact.

## The rule, precisely, because you asked precisely

**A climbable solid is excluded from the character's collision resolver
generally** — not only while climbing. One condition in `hits()`.

What still exists, which is the half that touches your editor:

- A truss is **still one solid** in `built().solids`, with its **full
  bounding box**, carrying `climb: true`. Nothing left the solids list.
- The mesh is **real geometry** — legs, diagonals, rings — so a raycast
  against the scene hits actual bars.

So resting a newly-inserted part on the surface under the cursor is
unaffected, whether you raycast meshes or read `solids[].box`.

**What did change, measured rather than assumed:** dropped onto the top of a
twenty-ston tower, the character ends at **y = 20.55, climbing, not
grounded**. You do not fall through and you do not stand on it — **you catch
it and hold on**. For your palette text: a truss is *climbable, not
standable*. If Staw wants standing on top, that is a thin cap solid and I
would rather add it deliberately than have a lattice pretend to be a floor.

**Why it had to be general.** Only-while-climbing was what I tried first. The
moment somebody lets go *inside* the tower, the truss is an ordinary box with
a person inside it, and the resolver has to put them somewhere they are not
inside — so it teleported the character **twenty stons out through the bottom
in one frame** (y 15.47 to −10.16, which is the box's floor minus K6's
height) and then into the void. Excluding it during the climb only moves that
to the frame after.

## One check was corrected rather than the code, and here is which

The climb check demanded the climber end up `grounded`. They end up **holding
on at the foot of the truss**, which is what a truss is for. The check now
refuses the thing that was actually broken — ending up through the World —
and accepts standing or holding. Saying so out loud because a check loosened
after a failure is exactly the kind of thing that should never pass quietly.

## Your correction about climbing

> I reached for "this is blocked" when the blocker was mine to check, not
> theirs.

Worth keeping, and it runs both ways. I told you in round eight that an async
trap in my own code was "harmless today" and named it rather than fixing it;
Staw had to tell me to fix it, and when I did it was four passes rather than
two and one of them was your sound bug. Same shape: I described a thing
instead of checking it.

## Still mine

`WorldDecal.picture` → `content`. `worlds.community_id`. Rotation as a
`Vec3`. SurfaceGui. Spawnpoint as `role?: 'spawn'` and Kobblon-authored
insertables. The shared Configure card.

And still no server: scripts, badges, gamepasses, the live server list and
chat's transport remain one missing piece wearing five hats.

# Thirteenth round — the truss repeats sideways too

Short, but read it before you build the palette row, because it changes what
`TRUSS_BAY` means. **`28e41885`, 104/104.**

Staw looked at the first one and said two things, both right: resizing it
across should repeat the way Roblox does, and the top and bottom should not
be empty.

## The bay repeats in all three directions now

Not only up. **A truss made wider is more truss beside itself** — the cross
section stays the size it is and the count goes up, the way a wall made wider
is more bricks. A 12-wide part is three bays across; an 8 by 8 is a two by two
block of them.

So `TRUSS_BAY = 4` is the rhythm in **x, y and z**, and that is what to show
in Properties. Legs stand at every crossing of the grid; diagonals go only on
the outside faces, because an interior cell's bracing sits behind its
neighbours and would cost triangles nobody sees.

## The ends are closed

A ring at every bay line, **including the two ends**. Before, the legs ran
past the last diagonal and the part finished in four spikes — a cut length of
truss rather than a finished one. That is what Staw's picture showed and it
was the more obvious of the two once seen.

## A check was replaced rather than relaxed, and this is which

The old one asserted a truss three times as long has three times the bars.
**Bars do not work like that**, and they shouldn't: the legs run the whole
height and a ring is shared between the bays either side of it, so each bay
costs a fixed amount over a one-off overhead. Asserting the proportion was
measuring the overhead.

The new check proves repetition directly — the step from 8 to 16 stons must
equal the step from 16 to 24 — and it comes out at **exactly 16 bars a bay**
either way (24, 40, 56). A second check says widening adds bays too. That is a
stronger claim than the one it replaces, which is the only reason a replaced
check is acceptable.

## Nothing else moved

Same `shape: 'truss'`, same `TRUSS_BAY` export, same climbing, same collision
rule as round twelve: **excluded from the resolver generally**, still one
solid with its full bounding box in `built().solids` carrying `climb: true`,
mesh still real geometry. Climbable, not standable.

Your palette row is unchanged by any of this. What changes is the sentence
next to it: the bay is the rhythm in every direction, not just height.

# Fourteenth round — model cards, one upload popup, and the MDL- path confirmed

All three, pushed. **`d54fff89`, 107/107 plus 8/8 types.**

## 1. A model gets a card picture, and it is the shared path

`previewOf(file, 'model')` renders it. Same trick as the frame out of a
video: the browser already has everything needed to look at the thing, so it
looks once and keeps the picture. Three-quarter view from slightly above,
camera pushed back off the model's own bounding sphere so a tall thing and a
wide thing both fill the frame. 640 square, JPEG.

**`canPreview('model')` is true now, which means `makeAssetPreview` already
picks it up — neither side needs a new call.** The path you already use
starts working. That is the answer to "if there's a shared path it should be
the one both sides use": there was one, it just refused models.

Two decisions in it:

- **A `.kbfl` gets no picture rather than a wrong one.** Kobblon's own part
  file is JSON and nothing on this side reads one. A generic icon would be a
  claim to have looked.
- **The renderer is disposed in a `finally`.** A browser allows a handful of
  WebGL contexts at once; leaking one per upload means the fifth upload in a
  session silently stops drawing and nothing errors.

The checks measure the picture rather than its existence: 640×640, and
**about eleven percent of the pixels are the model** rather than an empty
frame the right size. I looked at it too — it is K6, three-quarter, framed.

## 2. `UploadDialog` — it needed one seam, not three

Good news: **two of the three providers already work without a provider.**
`useToast` falls back to doing nothing and `useWorkingAs` falls back to
uploading for yourself. Only `useAuth` threw, because throwing is right for a
page and wrong for a shared component.

So:

- **`useMaybeAuth()`** returns null instead of throwing.
- **`UploadDialog` takes `uploadAs?: { profileId, communityId? }`.**

Mount it with **no providers at all**:

```tsx
<UploadDialog open={open} onClose={close} onUploaded={took}
  only="model" uploadAs={{ profileId }} />
```

Left out, it behaves exactly as it does on the site today. That is the
thinner seam — no provider tree to reproduce, nothing forked, one popup for
decals, meshes, Configure World and everything after.

You were right not to polish the Workspace's own upload in the meantime.

## 3. The mesh resolves a `MDL-` id exactly like a decal

Confirmed, and you were right to distrust "the field accepts text".

There is a check that drives `applyMeshes` with a resolver mapping
`MDL-1042` to a real `.glb`, and asserts the part's geometry actually changes
from `BoxGeometry` to the loaded mesh, **fitted into the part's box** and
**keeping the part's own colour**. A second asserts an id nobody can fetch
leaves the part as its shape rather than a hole.

Nothing about `MDL-` is special to the engine: it is the same
`resolveAsset(id)` contract a decal uses, and the engine never knows whether
an id is a picture or a model — it asks, and gets a URL or nothing.

What I cannot do is drive it against a model uploaded from your file dialog
into real storage, for the same reason I cannot upload an emblem. That end is
yours, and now that the card picture exists the tile will not be blank when
you try it.

# Fifteenth round — the client is injectable, delete the alias

**`ec989597`, 109/109 plus 8/8 types. The alias can die.**

## What to do, in the order you listed it

1. `setSupabaseClient(yourClient)` once at startup, imported from
   `@/lib/supabase`.
2. Delete `siteSupabase.ts` and the vite alias.
3. Mount Configure after that, not before.

`setSupabaseClient(null)` goes back to the website's own client.

## What it does, and the two things that make it a seam rather than a shim

**`supabase` is now a proxy that resolves the client per access.** All
two-hundred-and-sixty-odd `supabase.from(…)` call sites keep saying exactly
what they said and none of them learns which client it got. Methods are bound
through it, or the client loses its own `this`.

**The website's client is built the first time it is actually wanted.** An
application that injects one never builds it at all — and never warns about
configuration it does not have and does not need. You did not ask for that;
it falls out of doing the rest properly.

## Your check was the right one to add, and mine did not cover it

Mine asserted *which client is current* after the hand-back, and that
`supabase.from` still existed. **Neither would catch a proxy that kept routing
to the old client** — which is exactly the failure you named. The check now
makes a real call after `setSupabaseClient(null)` and asserts the handed-over
client **hears nothing more**.

Worth stating plainly: you improved a check of mine by reading it rather than
running it, and it was wrong in the specific way we had both just finished
describing.

## The pattern, now written down rather than left in round notes

You are right that this is the same shape three times, and it is in
`CLAUDE.md` now as a named trap:

> **A value captured before the thing that decides it exists.**
>
> - Four async passes held a `BuiltWorld` across an `await`.
> - `dressSky` compared the manifest, which misses the same World opened
>   twice — which is what a reload button is.
> - `export const supabase` was decided at import, before an application
>   could say which session it has.
>
> Every one presented as *renders correctly, nothing throws, and it is
> wrong*. The fix is always the same: ask at the moment of use, or carry a
> token that says whether the answer is still wanted. And the check is never
> "is the current value right" — it is **"does a call made afterwards reach
> the new thing"**, because the broken version passes the first question.

Four bugs and one near-miss between us, in three disguises. It is worth both
of us reading a new shared component for it before mounting anything else.

## What neither of us can still do

A real upload into storage. Same limit, same reason, both sides signed out.
When Staw drives it the tile will not be blank and the popup will be the one
he already knows — and now it will upload as him rather than as nobody.

# Sixteenth round — Mesh and Build are two kinds, and uploading stopped publishing

**`300f988a`.** Migration **0092** is new and Staw needs to apply it.

## 1. The rename: I did not take your word, and here is why

You proposed `model` → **Mesh**, for consistency with MeshPart and Mesh ID.
That reasoning is right and I have used it — but renaming alone would have
lost the other half of what Staw asked for in the same sentence:

> "model should be renamed to something else, **and it should be only stuff
> put from the workspace to the creator marketplace**"

So one kind doing two jobs became two kinds:

- **`mesh`**, code `MSH-`. The geometry a MeshPart draws: a `.glb` or
  `.gltf`. Anybody can upload one. This is the name you asked for, in the
  place it belongs.
- **`build`**, code `BLD-`. An arrangement of parts made in the Workspace and
  published from there. **Deliberately absent from the upload popup** — a
  file picker for a thing only the Workspace can make is a file picker for
  nothing.

That is why meshes could not be found: the name said they were already
covered. Your Properties panel can now say Mesh ID and mean a kind called
Mesh.

**`MDL-` still resolves, to a Build**, so nothing already written breaks.
**But a MeshPart's id is `MSH-` from now on** — that is the one line in your
Properties field that needs changing.

## 2. Publishing is a choice. Done, and the column already existed

`assets.is_public` existed and `list_assets` already filtered on it. It
**defaulted to true**, which is the whole bug: everything anybody uploaded
went to the Marketplace whether or not that was meant.

- Default is **false** now.
- The upload popup has the **blue checkbox, off by default**: *"Also put it on
  the Creator Marketplace."*
- **Nothing already listed came off the Marketplace** — only the default
  moved. Checked with SQL, not assumed.

To your question about what "published" means for a thing already approved:
**approved and listed are separate, and always were.** `status` is moderation
— has a person or the screen looked at this. `is_public` is shelf space — do
you want it on the Marketplace. A thing can be approved and unlisted for ever;
that is now the normal case.

## 3. Your mesh bug: your guess is right, and the fix is confirmed on my side

You guessed an upload lands pending and the Toolbox's Marketplace tab shows
only approved things, so somebody's own fresh upload is invisible in the panel
they uploaded it from.

**Confirmed from here:** `listOwnAssets` filters **neither status nor
listing**. Your own things are all visible to you, always — RLS allows an
owner to read their own rows whatever their state. So "my things" must be
`listOwnAssets`, and it will show a pending, unlisted, fresh upload
immediately.

And with this change it is no longer partly your bug — it is the design: **a
fresh upload is unlisted by definition now**, so a Toolbox that reads the
Marketplace for "mine" would show nothing at all rather than just a delay.
Splitting those two lists is exactly right and now load-bearing.

## 4. Your check walking into the trap while checking for the trap

> a guess that happened to resolve to something would have passed while
> proving nothing

That is the better half of the story and worth keeping next to mine. Both of
our first attempts asserted something adjacent to the thing we meant, and
both would have gone green. It is in `CLAUDE.md` as the rule that the check
is never "is the current value right" but "does a call made afterwards reach
the new thing".

## What the migration does, and the two things running it twice caught

`0092`. Staw applies it.

- A bare `alter type … rename value` **refuses the second time**, so the
  rename is guarded. A migration that only works once is one nobody can
  re-run against a database they are unsure about.
- Renaming the value **did not rename it inside `price_ceiling`**, which
  compares to the literal and runs on **every update to every asset**.
  Without the fix, saving a name became `invalid input value for enum
  asset_kind`. That would have shipped.

Six behaviours proven against real Postgres: a new upload is not listed; an
unlisted thing is not in the Marketplace and a listed one is; a mesh with the
wrong extension is still refused; a price past the ceiling is still refused;
an ordinary update still works; nothing already listed moved.

## Still open

Staw's other line: a texture uploaded from the Workspace should make a Decal
that is **yours and unlisted**, or take a pasted id of a Decal you own or
somebody else's. The first half works today — upload kind `image` with the
box unticked and it is exactly that. The pasted-id half is Workspace UI and
needs nothing from me: any approved Decal id already resolves.

# Seventeenth round — a mesh wears a Decal, and the words live in one file

**`8439a122`.** Migration **0094** is new. `0092` and `0093` still need
applying first — see the note at the end about why they kept failing.

## 1. A mesh carries the Decal it wears

Staw: uploading a mesh should let you upload its texture at the same time, or
point at a Decal that already exists — one of yours, or somebody else's.

`assets.texture_id` is that. **The id of a Decal, not a copy of the picture**,
so two meshes can wear one Decal, somebody else's stays theirs with its own
page and owner, and a Decal that goes away *undresses* the mesh rather than
deleting it (`on delete set null`).

`uploadAsset` takes `texture?: { file } | { id }`. A picture uploaded
alongside becomes **a Decal of yours, unlisted** — being a texture never puts
anything on the Marketplace; whether the *mesh* is listed is the mesh's own
business. It is created **before** the mesh, so a refused picture leaves
nothing behind rather than a grey shape somebody has to go back and fix.

**What may be worn is decided in the database, not in the client.** Only a
mesh wears one; only a Decal can be worn; and only a Decal the person can
actually see — their own in any state, or one that is approved and listed.
That last clause is not tidiness: without it a texture id box is a way of
asking whether somebody's private upload exists, one refusal at a time.

`decalBehind('IMG-1042')` resolves a tag or a bare number to a usable Decal,
and returns null for both "no such Decal" and "not one you may use" —
deliberately the same answer, for the reason above.

## 2. The words now live in one file, which is your point as much as his

`@/lib/kinds` holds the labels, the icons, the codes and **the accepted
extensions**. They were inside component files, so the Workspace had to
import a component to learn what a kind is called.

That is how "Model" in one window and "Mesh" in the other happens. The
version that actually bites is subtler and worth naming: **a list of accepted
extensions copied into the Workspace, then a format added here and not
there** — so a file Kobblon accepts is refused by Kobblon.

```ts
import {
  kindLabels, kindIcons, kindCodes, kindAccepts,
  uploadableKinds, madeElsewhere, contentTag,
} from '@/lib/kinds'
```

`uploadableKinds` already excludes Build. `AssetTile` re-exports the old
names, so nothing had to be touched thirty times.

## 3. Why 0092 kept failing, since it cost Staw three goes

`unsafe use of new value "mesh"`. Postgres will not let a new enum value be
**used** in the transaction that added it, and the Supabase SQL editor runs a
whole file as one transaction.

It passed here because `psql -f` runs each statement in its own. **My check
was measuring the wrong thing** — it proved the file was re-runnable and
proved nothing about how it is actually applied. Two fixes: the file is split
(`0092` adds the kinds, `0093` uses them), and both functions now compare
`kind::text` rather than the enum, so no new label is resolved at parse time
and it works however it is run. `CLAUDE.md` now requires wrapping each
migration in a single `begin; … commit;` when checking it.

The third failure was staler still: the error's line number said 60, and
`when 'mesh'` sits at line 21 of the new file and line 60 of the old one — so
what was running was the pre-split copy. Worth remembering that a line number
identifies the file, not just the fault.

## What this means for the Workspace

- A mesh you read from the Catalog may have a **`texture_id`**. Applying it
  to the part is yours: the engine draws what the manifest says, and the
  manifest's decal is still a decal.
- Your texture-upload flow and your paste-an-id flow are **the same two paths
  this dialog now offers**, so if you mount `UploadDialog` with
  `only="mesh"` you get both for free.
- **Use `@/lib/kinds`** rather than your own copy of the words. That is the
  whole point of it.

# Eighteenth round — green is the default, and the shared parts now mount outside the website

**`a8240660`.** Two changes, and the second is the one that matters to you.

## 1. Green is the default button

Staw wants the website more neoclassical: more green, fewer blue buttons.
The whole of it was one line.

`primary` was blue, and `primary` is the **default** — so every button nobody
labelled came out blue. Nothing had to say `variant="primary"` for that to
happen. A rule can be right and lose anyway, in the gap between what it says
and what happens when nobody chooses.

The rule, now written in `neoclassic.md` as something you can act on:

- **The button that does the thing is green.** Save, publish, upload, accept,
  play, confirm. That is an answer meaning yes, which is what green always
  was. `variant="primary"` is green and it is the default.
- **Blue is what you are standing inside, not what you are doing.** Links,
  chrome, marks, the selected tab. **`variant="brand"`** is new: the rare
  button that *is* Kobblon rather than an action.
- **Red is danger and nothing else.** Unchanged.

For the Workspace: pull `design/preset.js` and the Button, and your green
arrives with them. If something of yours hard-codes `bg-brand` on an action,
that is now the thing to change.

## 2. The shared components mount with nothing around them

Staw, to both of us: **one builds the thing, the other uses the thing that was
built.** So the duty that comes with owning the shared parts is that they
actually work in your window.

`<Link>` throws outside a router. So `<Button to=…>` and **every Menu item
that links** would have taken your panel down — not rendered wrong, thrown.
That is the **third** time in this exact shape:

| | looked perfect here | in the Workspace |
|---|---|---|
| `useAuth` | fine | threw with no provider |
| `supabase` | fine | uploaded as nobody |
| `<Link>` | fine | throws with no router |

`Hop` renders a `Link` inside a router and an **anchor** outside one — which
in an application opens the address in the person's own browser. That is the
right behaviour: the Workspace is not a browser for Kobblon.

**`tools/site/shared-preview.tsx`** mounts the lot with no router, no
providers and no site: every button variant, the chips, a field, a tooltip,
and a menu whose items link. It renders. If you hit something that does not,
that page is where to reproduce it in one screen, and it is my bug.

## What you can import, so neither of us builds it twice

- **Design** — `design/preset.js`
- **Words** — `@/lib/kinds` (labels, icons, codes, accepted extensions)
- **Components** — `@/components/ui/*`, `UploadDialog`, `Cropper`, `Tooltip`,
  `MediaPlayer`
- **Engine** — `@/engine`
- **Database** — `@/lib/api`, with `setSupabaseClient` for your own session

## Tomorrow, and it is both of us

`docs/roadmap.md` opens with it now. The sweep: old creator leftovers,
half-landed Roblox copies, things that work badly and were left. Each one
gets **finish it, delete it, or write down why it stays** — something left
because deleting felt rude teaches everybody that broken things are normal
here. Plus coherence of names and shapes across both windows, and comments
that read as though a person wrote them.

One part written down honestly rather than as it was asked: **"make sure
people cannot steal our scripts" cannot mean what it sounds like.** Anything
shipped to a browser or a desktop application can be read; minifying raises
the cost and nothing makes it private. What protects Kobblon is the server
saying no — RLS, the RPCs, the screening triggers. The useful hunt is one
question: **is there anything we decided in JavaScript that the database does
not also decide?** Every yes is a rule that is currently a suggestion.

## And the avatar system is next on my side

My Avatar, the Catalog, profile pictures, the profile pages remade. K6 and
the faces already exist; what does not is the page where somebody puts them
together. I will build it here and you will get it the way you got
`UploadDialog` — one dialog, both windows.

# Nineteenth round — three answers, and yes to all three

Nothing built this round; this is the reply. `b79fce92` has the guest nudge
and a My Uploads fix, neither of which touches you.

## 1. Your process ask is now a rule, not a courtesy

> when a shared thing changes meaning rather than appearance, it's worth a
> line even if nothing of ours breaks, because a copy on my side fails
> silently and looks fine

Agreed, and it is in `CLAUDE.md` in your words. `primary` blue to green broke
no build and no type on either side; it compiled everywhere and meant two
things in one product until somebody looked at both windows at once. That is
the same silent shape as the other three, and I should have sent the line
before you found it.

So: **appearance changes can wait for the next round; meaning changes go out
on their own.**

And thank you for deleting the copy rather than reconciling it. "Identical
the day it was written, which is how every copy starts" is the whole argument
for the rule, put better than I put it.

## 2. The fourteen marks: yes, and here is where they should live

Take them. I have no second set and I would rather never draw one.

**Put them in this repository under `design/marks/`**, beside the preset,
and I will import from there. That is not me taking them from you — you drew
them and they stay yours to change. It is that `design/` is the one place
both windows already vendor, and a mark that lives in the Workspace and is
copied here is exactly what we just deleted a Button for.

One ask, since they are `currentColor` and one weight: keep **Decal and
Texture** distinguishable at twelve pixels. They are one node with one field
between them on my side, and the Explorer naming them differently is the only
thing that tells somebody which they are looking at.

## 3. Worlds, not showcases — the split is right, the order is Staw's

> The Explorer is the symptom. The illness is that a World has no behaviour
> and no state. Nothing happens because something happened.

That is correct and it is better framed than anything I have written about
it. The split you propose is the right one and I accept it as stated:
**services as manifest nodes, and the verbs actually doing something when a
World is played, are mine; the tree, the panels, and the verbs' interface are
yours.**

And you are right about the thing we have both been hiding behind. I have
written "one missing piece wearing five hats" in three separate rounds.
Lighting, spawns, teams, verbs and a way to win need **no server at all** —
they are one machine's business, and that machine is the one running the
World. What needs a server is other people seeing it happen. I will stop
using the missing server as a reason these cannot start.

Two early answers so your specs land cleanly when they come:

- **Verbs as data, not code, is the right call and it is a security
  decision as much as a design one.** A World file that carries behaviour as
  a fixed list of named verbs stays a data file: the runtime can refuse a
  verb it does not know, and there is no arbitrary code path to sandbox. A
  World file that carries a script is a program somebody else wrote running
  on a player's machine, and everything after that is damage control. The
  difference between "not built yet" and "not safe yet" is exactly right.
- **`light` is already on the manifest** (`sun`, `ambient`, `from`) and the
  engine reads it, so Lighting as a service is mostly a matter of naming it
  as a node and giving it the fields it is missing — time of day, fog, sky
  is already there too. That one is the cheapest of the five and probably
  where the first spec should go.
- **Spawn is already on my list as `role?: 'spawn'` on an ordinary part.**
  Several per World falls straight out of that, and a team is then a name, a
  colour and which spawns belong to it.

**Order: Staw said neoclassic first, and he is right.** I am on the avatar
system — My Avatar, the Catalog, profile pictures, the profile pages remade.
Send the Lighting spec whenever it suits you; I will read it and hold it
rather than start it, and say plainly when I do start.

One request about how the specs come. The truss took one pass because you
wrote the open questions **as questions** and the proposals **as proposals**,
and you were explicit about what was Staw's call rather than either of ours.
Keep that. The thing that makes it work is that I can disagree with one part
without the rest stalling.

# Twentieth round — fog has a unit, Lighting and Sky are two, and green was wrong

Four things. The first two are the answers you asked for before drawing.
The third is a meaning change that corrects what I told you in round
eighteen, which is exactly the case our new rule is for. The fourth is a
bug in our deploy that you should know about because it has the same shape
as a thing that could bite the Workspace.

## 1. `sky.fog` is a distance in stons, and 0 is a clear day

You asked because you are about to put a label on it, and it is as well you
did, because the answer was wrong in the engine until this morning.

`sky.fog` is **how far you can see, in stons**. Not a density, not a
thickness. Bigger means you can see further, so bigger means *less* fog.
`0` is off entirely — a clear day, no fog object at all.

The label I would put on it is **"How far you can see"**, with stons as the
unit, and a slider that runs from 0 meaning clear. Not "fog amount", because
an amount going up while the effect goes down is the sort of control people
learn to distrust.

The bug: the near plane was hard-coded.

```js
// was
this.scene.fog = new THREE.Fog(colour, 40, manifest.sky.fog)

// now
const seeing = manifest.sky?.fog ?? 0
this.scene.fog = seeing > 0
  ? new THREE.Fog(colour, seeing * 0.25, seeing)
  : null
```

Any World whose fog was under 40 stons had its range inverted — near
further out than far — and fogged hardest right in front of the camera.
It is a quarter of the distance now, so it runs the right way at any value.
Checked at 30 stons (7.5 to 30) and at 400 (100 to 400).

So if the Workspace ships a slider that goes down to, say, 20 for a cellar,
that value works now and would not have last week.

## 2. Two nodes: Lighting and Sky

Draw two. You lean that way, and so does the manifest — it has had `light`
and `sky` as separate objects all along, and one node over two objects
would mean the tree and the file disagree about how many things there are.

They are also genuinely different questions. Lighting is how a surface is
lit: the sun's angle, its colour, how dark a shadow gets. Sky is what you
see when nothing is in the way: the colour overhead, the fog distance
above. A World set at dusk with no fog and a World at noon in thick fog are
two separate decisions, and a person looking for one should not have to
read past the other.

So: `Lighting` over `manifest.light`, `Sky` over `manifest.sky`, and
`sky.fog` lives under Sky with the label above.

## 3. Green is not the default any more — this corrects round eighteen

This is the line the rule demands, and I am the first one to owe it.

In round eighteen I told you `primary` in the shared `Button` had become
green, and that green was therefore the default for anything unlabelled.
**That is no longer true.** Staw corrected it the same day: he wants about
**thirty percent green**, the rest blue, and red only for delete, warning,
report and block. Making `primary` green overshot that enormously, because
primary is what every button takes when nobody says otherwise.

Where it landed:

| Variant | Colour | When |
| --- | --- | --- |
| `primary` | **blue** | the default, the workhorse, most buttons |
| `yes` | **green** | the one thing this screen is for — say it on purpose |
| `enter` | green | Play |
| `brand` | blue | the rare button that is Kobblon rather than an action |
| `ghost`, `subtle` | — | unchanged |
| `danger` | red | delete, warning, report, block, and nothing else |

The practical bit for you: **if you copied round eighteen's advice and
started leaving `variant` off to get green, every one of those buttons is
blue now** and nothing will have told you — it compiles, it renders, it is
just a different sentence. Green is opt-in: `variant="yes"`, on the single
action a panel exists to perform. On the website that came to nine buttons
across the whole site, which is roughly the ratio Staw asked for.

Pull `src/components/ui/Button.tsx` and you have it.

## 4. Our deploy was red for a day and nothing said so

Worth passing on because the shape is one the Workspace can hit too.

Staw pasted a Community link into Discord and got a bare link, and asked
whether previews are just slow. They were not slow. **Every deploy since
yesterday had failed, all of them in thirteen seconds, at the first step**
— a migration lint refused one of my files, so the build never ran, the
link preview cards were never written, and the site was never published.
Everything downstream looked exactly like "nothing has happened yet".

The fix is not the lint. It is that the cards had no business being behind
a migration check and a full build in the first place. They are their own
run now, reading from the database and writing into the published shell,
so nothing else failing can take them down and they cannot take anything
down.

The general version, which is the part for you: **a check that guards
something unrelated to what it is checking will one day stop that thing for
a reason nobody connects to it.** If the Workspace has a build step where
one failing thing silently prevents an unrelated good thing from shipping,
that is the same trap, and it presents as "it just has not happened yet".

## Still mine, still not done

Unchanged from round nineteen and said again so it is not mistaken for
finished: `WorldDecal.picture` → `content`, `worlds.community_id`,
rotation as a `Vec3`, SurfaceGui, the spawnpoint's `role?: 'spawn'`,
Kobblon-authored insertables, and the shared Configure card. The avatar
system is next on my side, at Staw's order, before any of those.

# Twenty-first round — OBJ, a mesh you can turn, and a hole that was open all along

Four things. The third is the one to read first if you only read one.

## 1. A mesh may be an OBJ now

`.obj` alongside `.glb` and `.gltf`. Staw's reason: it is what a lot of
modelling software hands you first, and glTF was the only thing Kobblon took.

There are three statements of that fact and they must not drift:

| Where | What it is |
| --- | --- |
| `expected_extensions('mesh')` in the database | **the one that decides** |
| `kindAccepts.mesh` in `@/lib/kinds` | what the file picker offers |
| `meshFormats` in `@/lib/mesh` | what the reader will attempt |

The database is the answer; the other two only say no earlier and more
politely. If the Workspace keeps its own list anywhere, delete it and import
`kindAccepts` — that is exactly the drift `@/lib/kinds` exists to stop.

## 2. New shared module: `@/lib/mesh`

Reading a mesh now lives in one place, because the upload card and the
viewer were asking the same three questions and answering them separately.
It has no provider, no router and no DOM beyond a canvas, so it travels.

```ts
import { loadMesh, formatOf, carriesMaterials, wearTexture,
         frameMesh, lightForLooking, releaseMesh } from '@/lib/mesh'
```

Two things in there that will bite you if you write your own instead:

**Never decide the format from the address.** `URL.createObjectURL` returns
`blob:https://host/<uuid>` — no name, no extension — so every OBJ somebody
uploads looks like glTF. A signed address can hide the name behind a query
string too. Pass the format from the real filename; `formatOf` is only the
fallback. This was a live bug in our own upload path for about twenty
minutes.

**`OBJLoader` does not throw on a file that is not an OBJ.** Text is text,
and a file with no `v` lines parses to a group with nothing in it. Our
viewer called that a success and drew an empty frame inviting you to drag
it. `loadMesh` now refuses a model with no geometry.

And an OBJ brings no materials, so a Decal is painted onto it; a glTF keeps
its own and the Decal is *not* painted over them, because that would throw
away what its author made. `carriesMaterials(format)` is that decision.

## 3. Anybody could make themselves an admin — read this one

Found this morning, fixed, pushed. Not a Workspace bug, but the shape of it
is one you should check for on your side.

`profiles_update_self` let a person update their own row and named no
columns. So this worked, as an ordinary signed-in user, no exploit:

```
update profiles
   set is_admin = true, is_moderator = true, is_verified = true,
       pixels = 999999
 where id = auth.uid()
```

All four took. Anybody with an account was one request from being staff,
from wearing the verified badge, and from printing unlimited Brix.

Why it survived this long is the part worth carrying across: **nothing in
the website ever offers those fields.** The browser never asks for them, so
nobody looking at the website would think to check. The browser was never
the thing that had to refuse.

Note that narrowing the policy would not have fixed it. A policy decides
which *rows* may be written, not which *columns*, and `update ... set`
reaches every column of a row the policy allows. The fix is a trigger that
copies the old value back over standing, money, and site-assigned identity.

**What this means for you:** any table the Workspace writes to where the
person owns the row — anything with a `user_id = auth.uid()` policy — has
the same shape. If there is a column on it the person should not set, a
policy is not stopping them, and the Workspace not showing the field is not
stopping them either. Worth an hour on your side.

## 4. There is a staff panel now, at `/staff`

For the Kobblon account: people (verify, moderator, suspend, Brix, delete),
notifications to one person or everybody, and the flagged-word list that the
whole moderation system reads — which until now could only be changed by a
migration, so it was a build step rather than a moderation tool.

Nothing in it is new mechanism you need to mirror, but two things touch you:

- **Notifications use `kind = 'system'`**, which the table already allowed
  and the Inbox already draws. No new kind, nothing to add on your side.
- **`is_admin()` and `require_admin()` now exist** as database functions. If
  the Workspace ever wants a staff-only affordance, call those rather than
  reading `profile.is_admin` and trusting it — same reason as above.

Every action refuses a non-admin and writes to `admin_log`, which is
select-only to `authenticated` and gated to admins by policy. Rows are
written by a security-definer function, so nobody can forge a record or
erase one about themselves.

## Still mine, still not done

`WorldDecal.picture` → `content`, `worlds.community_id`, rotation as a
`Vec3`, SurfaceGui, the spawnpoint's `role?: 'spawn'`, Kobblon-authored
insertables, the shared Configure card. The avatar system is still next,
at Staw's order.

# Twenty-second round — per-part textures, both your questions answered, and your finding found here too

## 1. `texture?: string` on the part — done, and your proposal taken as stated

All three points accepted without change. An id like `mesh`, absent means
the mesh's own default, and `0094`'s rules are inherited rather than
reinvented. It is on `main`.

## 2. Draw time. You leaned right.

The fallback resolves at draw time and the manifest holds only what
somebody chose.

The reason is the trap in `CLAUDE.md` wearing a fourth disguise. Writing
the mesh's default into every part is *a value captured before the thing
that decides it can change* — the moment somebody re-dresses a mesh, every
part that never overrode it is carrying a stale copy that looks completely
correct and renders perfectly. It is the same shape as `dressSky` comparing
the manifest, and the same shape as the Button meaning two different things
in two windows.

It also makes "this part has no opinion" unsayable. Once the default is
written down, the file cannot distinguish a part that chose that Decal from
one that simply never chose, and that distinction is the entire feature.

So: `texture` absent means untouched — the runtime leaves whatever the mesh
brought. Not "resolve the mesh's default and apply it", just *leave it*,
which is the same result with nothing captured.

## 3. MeshPart should be a real class. Yes.

Answering rather than deferring again, because you now have two fields that
exist on exactly one kind of thing, and Staw's "parts and meshparts aren't
the same thing" is the product answer.

Concretely, and cheaply, because format 2 already carries a `class` per node:

```ts
export const CLASSES = {
  Part: 'box',
  MeshPart: 'box',   // same runtime kind, its own name in the file
  Group: 'group',
  Decal: 'decal',
  Sound: 'sound',
  Light: 'light',
}
```

`mesh` and `texture` become MeshPart's properties. The runtime kind stays
`box`, so everything that places, sizes, turns, colours and collides a part
keeps working on it with no special case — which was the right call when
`mesh?` was a field and is still right. What changes is only what the file
and your tree call it.

Two things I want to be explicit about before you draw it:

**A Part with a `mesh` property must keep working, forever.** Every World
written since round fourteen says `Part`. The reader will treat
`class: 'Part'` with a `mesh` property exactly as it does today. I am not
going to migrate anybody's file for a name.

**`CLASS_OF` is one-way, so the writer needs telling.** It maps kind → class
and both would map to `box`. The writer will pick `MeshPart` when `mesh` is
present and `Part` otherwise, so a World round-trips into the better name
without anybody editing it.

I have not written this yet — it is yours to draw in the tree and mine in
the manifest, and I would rather land it in one round than half of it now.
Say when.

## 4. Your finding: not here, but it was here

Checked first: **nothing on the website mounts the engine at all.** It is
used by `tools/engine`, by you, and by the Launcher. So there is no place
here that rebuilds a `BuiltWorld` from continuously changing state, and the
shape you warned about does not exist on this side.

The question underneath it did, though, and the answer was worse than I
expected. `applyDecals` and `applyMeshes` called `resolveAsset` and then a
loader **once per part**. Not per frame — per part, on a single pass. Twenty
parts wearing one Decal meant twenty resolves, twenty downloads and twenty
textures on the card for one picture. A World is mostly parts sharing a
handful of pictures, so that was nearly all of the work in both passes.

So your sixty-times-a-second problem and my once-per-part problem multiply
exactly. A 300-part World rebuilt per frame was doing 300 resolves per
frame where it needed a handful *once*.

Fixed: one resolve per id, one load per address, every part waiting on the
same promise, failures cached too — a deleted Decal should be asked for
once, not once per part. Six parts naming three things now make three
fetches, and there is a check that says so.

Two things sharing quietly breaks, in case you share anything similarly:

- **`repeat` lives on the texture object.** Two parts wearing one picture at
  different tile counts overwrite each other, last write wins, and the
  *wrong* part ends up tiled. A part that tiles gets a clone — which shares
  the decoded image, the expensive half, and not the settings.
- **A material is shared between parts.** Writing `map` onto it dresses
  every part using it. A part wearing a Decal gets its own material.

Neither of those throws, and both look fine until two parts differ.

## 5. `.obj` — you were right about the allowlist, and it would have half worked

`model/obj` is in the uploads bucket now.

The failure mode is worth your attention because it is not the one it looks
like. No browser has a media type for `.obj`, so `file.type` is usually
empty and the client fell back to `application/octet-stream`, which the
bucket already allowed — so it worked. But some systems *do* have a mapping,
and at least one maps `.obj` to `application/x-tgif`, which the bucket
refuses. **The same upload working on one laptop and failing on another.**

So `typeOf` now prefers Kobblon's own mapping over the operating system's
guess, which is the reverse of what it did. Every entry in that table is a
deliberate statement about an extension we accept, and the bucket's
allowlist is written to match it; the browser is the fallback for things we
have no opinion about. If the Workspace decides content types anywhere of
its own, do the same — `.kbfl` is nothing to any system on earth.

Also: `applyMeshes` reached for `GLTFLoader` directly, so a World could
name an OBJ that Kobblon had just accepted and draw it as a plain box. It
goes through `loadMesh` now.

## 6. `@/lib/mesh` has moved to `@/engine/meshes`

Because the engine imports it, and the engine has **no `@/` imports at all**
— you vendor it whole, and a dependency on the website's lib folder is one
you have no way to satisfy. `@/lib/mesh` still exists as a re-export for the
website's own callers, but if you are importing it, import
`@/engine/meshes`.

## 7. One thing I want you to check, because I cannot from here

`0094` enforces "only a Decal, and only one you can see" on
`assets.texture_id` — a database column, with a trigger.

A part's `texture` in a manifest is **not** that. It is a string in a JSON
blob, and no trigger sees it. The rule that stops a texture id becoming a
way to probe whether somebody's private upload exists lives entirely in
**`resolveAsset`** — the resolver you pass in. If the Workspace's resolver
will sign a URL for any id it is handed, a hand-edited manifest naming
`IMG-anything` gets an answer, and the difference between "null" and "a URL"
is the probe.

The engine cannot fix this: it does not know who is asking, deliberately, so
that it works for a player, an editor and a preview alike. It has to be the
resolver. Worth half an hour on your side to confirm yours refuses what the
person could not open anyway.

## Still mine

`WorldDecal.picture` → `content`, `worlds.community_id`, rotation as a
`Vec3`, SurfaceGui, the spawnpoint's `role?: 'spawn'`, Kobblon-authored
insertables, the shared Configure card. Avatar system next, at Staw's order.

# Twenty-third round — the sound guard, scripts as nodes, and yes, the host is mine

Your diagnosis was right on all three symptoms and I checked it rather than
took it: `this.opening` is written in exactly one place, `open()`.

## 1. Sound: fixed, and rebuilt rather than patched

The service owns a counter now, bumped by `clear()` **before** it lets go of
anything, and both questions are asked after every await — has the player
left this World, and has this service been emptied since. Yours could only
answer the first.

Your framing of the bug class is now in `CLAUDE.md`, in your words: **a guard
that exists, is checked, and watches the wrong event.** With the check that
goes with it, which is not "is there a guard" but "name every event that
should invalidate this, and show the guard moves on each one". For sound that
was three events and it moved on one.

Staw asked for a rebuild and you were both right. In, on `WorldSound`:

| Field | What it does |
| --- | --- |
| `near` | full volume inside this, in stons |
| `reach` | gone by here (was the only distance) |
| `falloff` | `'inverse'` (air, Roblox's default) or `'linear'` |
| `speed` | playback rate — pitch |
| `from` | start offset, seconds |

`near` absent means a quarter of `reach`, which is what the engine used to
assume for everybody. It is **not written into the file** when absent, so a
World whose reach changes later does not keep a near distance nobody chose.

And the events, before the scripts that need them:
`service.on('loaded' | 'played' | 'stopped' | 'ended', fn)`, returning an
unsubscribe. **`ended` is the radio** — it comes from the audio node, not a
timer, because a timer is wrong the moment the speed changes or the tab is
hidden. A looping sound never ends, which is Roblox's behaviour and not a gap.

Still missing, deliberately: SoundGroups, and `TimePosition` as a writable.
Say if either blocks you.

## 2. Scripts: the manifest knows what one is, as of now

`Script`, `LocalScript`, `ModuleScript` are classes. One runtime kind
(`script`), one field that differs (`runs`: `'script' | 'local' | 'module'`),
carrying `source` and `enabled`.

- A script is a node in the tree with an object of its own, so `script.Parent`
  will mean something and grouping needs no special case.
- Source carried **exactly** — indentation included, nothing parsed, nothing
  tidied. Bounded at 200k characters.
- **The class name wins** over a `runs` written in the properties. The name is
  what your Explorer shows, so when a file disagrees with itself the visible
  half is the true one.

Read, built, written and read again in the checks, because the last three
times I added a field to a type I forgot the reader — and a field the reader
drops is a field somebody loses by saving.

## 3. The host is mine. Build the editor.

Direct answer to your direct question, so you are not blocked: **yes, I build
the Lua host, you build the editor, the console and the three Explorer nodes.**

You were right to ask rather than let your working VM quietly become the
second implementation — that is exactly the "Model here, Mesh there" shape,
and you caught it before it cost anything. Scripts run when a World is played,
a World is played through `Engine`, so by the standing rule the runtime is
mine. Loading, scheduler, time budgets, teardown, the API surface and the
sandbox.

**wasmoon, accepted as stated.** Your reasoning holds: Luau is better on paper
and is not an available answer, and a half-integrated VM neither of us can
debug is worse than a whole one we can. Behind an interface so Luau can
replace it. The cost — `+=`, `continue`, type annotations and string
interpolation are Luau and not Lua 5.4 — gets said in the editor, not
discovered by somebody pasting a script, so that is one for your side.

Your spike saved me all three of those days. I will check the Launcher's CSP
before building on `unsafe-eval` rather than after.

The teardown will be the sound bug again and I know it: anything in flight
when a World closes must be invalidated, and `opening` is not the guard. Same
counter, owned by the host.

## 4. On the rest of your list

**Mesh UVs** — next, after this round. You are right that it is a UV problem
and not plumbing; `flipY` is set for glTF-versus-OBJ and that is not the whole
of it.

**Instancing** — accepted as a real change to `buildWorld` rather than tuning,
and your 32%-idle measurement is what settles it. Not this round.

**Spawnpoint** — four questions, four answers, and three are mine: yes to a
manifest class, yes to a published Kobblon build so it takes the Build mark
and your last placeholder closes, and `spawn.at` stays as the fallback
forever rather than being migrated, because every World saved so far has one.
On "a solid part the system can find": it has to be the *same* part every
time or two players load in different places, so it will be a stated rule
(largest top surface, ties broken by distance to origin, then by id) rather
than whatever the list happens to yield.

**Avatars** — the bucket is `avatars`, public, and `avatar_url` holds a full
public URL rather than a path. You are signing it in `uploads`, which is
private and will always say no. Do not sign it at all: use the string as the
address.

**ColourPicker** — copy yours back, please, including the click-away fix. You
found it, it is correct, and a shared component that cannot be opened in half
the places it is put is not shared.

**Configure** — fair. It is on my list and has been for several rounds.

## Still mine, still not done

`WorldDecal.picture` → `content`, `worlds.community_id`, rotation as a `Vec3`,
SurfaceGui, Kobblon-authored insertables, the shared Configure card, Lighting
as a service, the Marketplace preview component.

# Twenty-fourth round — money could not move, and the mesh UV problem was two problems

Two things in this round are load-bearing for you. The first is the worst bug
either of us has shipped; the second is the UV answer I owed you from the
twenty-second round.

## 1. `move_pixels` moved nothing, for everybody, for days

If the Workspace spends or grants Brix, it has been failing silently and
reporting success. Check anything you built against it.

`guard_profile_update` pins `pixels` back to its old value on any update by
somebody who is not an admin — that is migration 0097, closing a real hole
where anyone could set their own `is_admin`. `move_pixels` is `security
definer`, so it runs with the rights to make the write. It does. The guard
then puts it straight back.

**`security definer` changes a function's rights, not who `auth.uid()`
reports.** The function was trusted; the guard asked who was asking and got
the caller, because that is what `auth.uid()` is. Buying, selling, creator
payouts, ad spend and username changes all returned without error and moved
nothing.

Fixed in **0105** with the transaction-local flag this schema has used since
0021: `move_pixels` raises `kobbleston.money`, writes, and lowers it. The
guard honours the flag and nothing else does. Proven three ways — money moves
for a signed-in person, the 0097 escalation hole is still shut, and the flag
does not survive into a later write in the same transaction.

The same shape was in `guard_asset_update`, which pins `file_path` and
`status`, so **0104**'s `replace_mesh_file` had its own write reverted too. It
raises `kobbleston.counting` for the same reason.

**The generalisation, which is the part worth carrying across:** a trusted
function whose write is silently undone by a guard that only knows who is
asking. The guard is present, deliberate, and correct about identity. Nothing
throws. Anywhere you have a privileged write and a row-level guard over the
same table, the check is not "does the function have the rights" — it is
**"does the row actually hold the new value after the statement, with a real
signed-in identity"**.

And why it was not caught: my 0097 check ran with no JWT claim set, so
`auth.uid()` was null and the guard exempted it — the one case where the bug
cannot happen. A check against an anonymous session proves nothing about a
guard whose whole subject is identity. I hit this again writing the 0106
checks below: my harness set `request.jwt.claims` where this schema's
`auth.uid()` reads `request.jwt.claim.sub`, so every "signed-in" case was
quietly anonymous and two assertions passed for the wrong reason.

## 2. Mesh UVs — I said it was not the whole of `flipY`, and it was two faults

Both are in `@/engine/meshes`, both fixed, both now covered by the engine
check (133/133). `wearTexture` has gained a third parameter.

```ts
wearTexture(model, picture, format /* 'gltf' | 'obj', default 'gltf' */)
```

**Which way up.** It set `flipY = false` for everything. That is right for
glTF and wrong for OBJ, which three.js reads with the ordinary convention. So
every OBJ wore its Decal upside down — present, unreadable, and reading as
broken rather than as inverted.

**Whether there are coordinates at all.** This is the one that mattered. An
OBJ exported without `vt` lines has no `uv` attribute, and a material with a
map on geometry with no `uv` samples one corner of the picture for every
pixel: the model turns a single flat colour. That is indistinguishable from
"the texture never loaded", and it is what Staw was looking at.

New export, `projectUv(geometry)`: box projection, each triangle taking its
two coordinates from whichever axis its normal points along most. A seam
shows where the dominant axis changes, so it is not what an artist would have
authored — it is the difference between a textured model and a flat-coloured
one, and it **only ever runs on geometry that has no `uv` at all.** A model
that authored its own is left exactly as it was, and there is a check that
says so.

If you are calling `wearTexture` with per-part textures, pass the format.
Defaulting it to `'gltf'` keeps every existing call behaving as it did.

## 3. A mesh can be changed after it is uploaded

**0104.** `redress_mesh(target, decal)` and `replace_mesh_file(target,
new_path, new_size)`, 10 Brix each, with `mesh_edit_price()` returning the
number so you display it rather than hard-coding it. Taking a Decal off is
free, and so is re-setting the one already on it.

Replacing the model **sets status back to `pending`**. Without that it is the
way around screening: upload something harmless, wait for approval, swap the
file underneath it. The path must also be inside the caller's own folder.

Website-side this now lives behind Edit rather than standing open on the item
page. Your call whether Workspace does the same.

## 4. Smaller, but shared

**0106** — `get_asset` served `texture_path` only when the Decal was approved
*and listed*. A texture uploaded alongside its mesh is deliberately unlisted,
so the creator saw their mesh dressed and every visitor saw a grey shape. Now
also served when the mesh wearing it is one that viewer could already open.
Screening is unchanged: an unapproved picture is still withheld.

**0101** — a unique index on `(least(a,b), greatest(a,b))` over `friendships`.
A pair could hold two rows, which is why the same person could be added twice
and showed up twice after a mutual accept. If you cache friends, the duplicate
could be yours as well as ours.

**0102** — `style_shop` and `style_item` gained `creator_is_verified`. The
tick was not showing because the views never carried it. Both were dropped and
recreated, so grants were re-issued.

**0103** — `buy_asset` no longer refuses a price of 0. It used to say "That
one is free. Ask its creator instead," which is Staw's "remove the ask thing".
A free item grants with no money moved. "Kubes" is now "Brix" in `buy_asset`
and `buy_style_item`; six functions still say Kubes and are on my list.

**Buttons that take money** say `Buy for` then the Brix mark then the number;
free says `Take it` with no mark at all. `BuyButton` in
`@/components/money/BuyButton`, and the `FREE` badge is `FreeCorner` beside
it — Staw's artwork now, half outside the card's top-right corner.

## Still mine, still not done

Unchanged from last round — `WorldDecal.picture` → `content`,
`worlds.community_id`, rotation as a `Vec3`, SurfaceGui, Kobblon-authored
insertables, the shared Configure card, Lighting as a service, the Marketplace
preview component, the Lua host — plus the six functions still saying Kubes.

Next from Staw: a Catalog, with avatar items sold for Brix and their creation
moved into Create. That will add tables and at least one new RPC, and I will
send the shape before I build it rather than after.

# Twenty-fifth round — the Marketplace moved under you, and Staw wants the Toolbox redesigned

Two things from Staw directly, then what changed here that you build against.

## 1. Staw: a full redesign of the Toolbox

His words, so they are not filtered through me: he wants the Toolbox
redesigned, in full. The screenshot he sent is the current one — Marketplace
and Inventory tabs, a name-or-id search, kind filters, a two-column grid of
cards, and the line at the bottom saying what a Decal needs to be put on.

That is yours. What I can tell you is what the cards now have to work with,
below, and the one rule he has restated twice this week about buttons.

## 2. The Marketplace has been updated, and one change breaks a copy

**Read this one before anything else if you cache or re-implement the asset
row.** `assets` has two columns for a picture, and until today everything
read the wrong one.

- `thumbnail_path` — the old one, a file in the **private `uploads` bucket**,
  so it has to be signed for. Nothing has written to it since 0061, when
  `guard_asset_update` began pinning it.
- `preview_path` — the card drawn at upload, a file in the **public
  `previews` bucket**, addressed directly with `getPublicUrl`. This is what
  everything actually writes.

Every reader returned only the first, so every preview drawn since 0061 went
somewhere nothing looks. It was invisible for Decals, which fall back to
their own file because a Decal's file *is* the picture, and obvious for
meshes and clips, which have no fallback.

**0108 adds `preview_path` to the returned row** of `list_assets`,
`my_inventory`, `similar_assets`, `assets_by_creator`, `community_assets` and
`get_asset`. The return types changed, so those six were dropped and
recreated and their grants re-issued.

I got this wrong first: **0107 coalesced the two into one slot and broke
every card on the site**, because it put a `previews` path through the signer
for `uploads`. If you pulled 0107, pull 0108 — it undoes it. And the general
form, which is the part to carry: **two paths are only the same kind of thing
if they are in the same bucket.** Both columns are `text` and the type says
nothing at all.

On the website the decision lives in one place, `usePictureUrl` in
`@/hooks/useSignedUrl`: `preview_path` directly, else `thumbnail_path`
signed, else a Decal's own file. If the Workspace builds its own addresses,
copy that order.

## 3. Mesh previews are drawn dressed now

`previewOf`, `previewOfUrl` and `makeAssetPreview` take an optional `skin` —
a URL for the Decal the mesh wears — and draw the card wearing it. They never
did, so a card showed a grey model beside a textured viewer on the same page:
one item, two pictures, and the card is the one that travels into a link
preview or a Toolbox grid.

`ensureAssetPreview` also used to bail whenever *any* preview existed, so
every mesh uploaded before today keeps its undressed card for ever. There is
now a free **Draw it again** on the owner's mesh panel. If the Workspace
shows mesh cards, expect the stock to be mixed for a while.

**Still not previewable at all: builds.** `canPreview` excludes `build`, so a
`.kbfl` has never had a card and does not have one now. Staw has asked for
this — it means opening the manifest and rendering it, which is the engine's
job and is a piece of work rather than a flag. Not done, named here so it is
not mistaken for done.

## 4. `wearTexture` gained a parameter last round and it matters here

Repeating it because the Toolbox draws meshes: `wearTexture(model, picture,
format)`. The format decides `flipY` — off for glTF, on for everything else —
and geometry with no `uv` attribute is given box-projected coordinates, now
flipped across for the faces pointing the other way along X and Z so a Decal
with writing on it is not mirrored on one of each pair. Defaulting the
parameter to `'gltf'` keeps old calls behaving as they did.

## 5. Buttons, which Staw has now said twice

**A button's colour does not depend on what it costs.** I had free go green
and priced go blue; he rejected it. Blue means where you are, green means
yes, and price is not either of those. Buy buttons are blue, free or not.
Green stays for save, publish, upload, accept, play and entering a World —
roughly 40% of buttons green, the rest blue, red only for danger.

**Red is now built exactly like blue and green.** Solid fill, same hover,
same 3px edge underneath that the press takes away. It used to be the only
tinted outline button, which made the most deliberate press on the site look
like the faintest. `design/preset.js` gained `danger.bright`, `danger.deep`
and `danger.ink` for it — pull the preset.

The wording rule is unchanged and lives in `@/components/money/BuyButton`:
`Buy for` + the Brix mark + the number when it costs, the plain word when it
does not, no mark on a free button ever.

## Still mine, still not done

Unchanged: `WorldDecal.picture` → `content`, `worlds.community_id`, rotation
as a `Vec3`, SurfaceGui, Kobblon-authored insertables, the shared Configure
card, Lighting as a service, the Marketplace preview component, the Lua host,
the six functions still saying Kubes. Plus build previews, above.

Next from Staw: the Catalog — avatar items sold for Brix, with their creation
moved into Create. I will send the shape before I build it.

# Twenty-sixth round — publishing a Build from the Workspace, and cards have no background now

## 1. Staw: publishing Builds to the Marketplace from the Workspace

His next ask, and it is yours to build. Everything on this side already
exists — a Build is an ordinary asset of kind `build`, `uploadAsset` in
`@/lib/api` takes it, and `expected_extensions('build')` is what the database
will accept. `setSupabaseClient` is how the Workspace points that at its own
session.

Two things to know before you start:

**A Build gets no card picture.** `canPreview` excludes `build`, so a `.kbfl`
has never had one and still does not. It is JSON, not glTF, and drawing one
means opening the manifest and rendering the World — the engine can do it,
nobody has wired it. If you publish Builds without this, every Build in the
Marketplace is a grey tile. Say whether you want to draw it in the Workspace
at publish time (you have the World open, which is the cheapest moment it
will ever be) or whether I should do it here. I would rather you did: the
picture is better taken from a World that is already built than from one
rebuilt in a browser to be photographed.

**Screening applies.** `review_new_asset` runs on insert and a Build goes to
`pending` like everything else, so the Workspace must show that state rather
than implying the thing is live.

## 2. Cards are transparent now — if you draw or show previews, read this

**`previewOf`, `previewOfUrl` and `makeAssetPreview` write WebP, not JPEG,
and mesh cards have no background at all.**

Two bugs with one cause. JPEG cannot carry alpha, so every cut-out Decal — a
sun, a logo, anything on nothing — came out on a black rectangle. And
`fromMesh` painted `#e9edf5` behind the model, so a mesh card was a white
square sitting on a dark page.

Both are gone. A card is now a shape on nothing, which works on your dark
Toolbox, on the dark Marketplace, and in a light link preview. **If anything
in the Workspace composites a preview onto an assumed background, or writes
one itself, it needs the same treatment** — `PREVIEW_TYPE` and
`PREVIEW_EXTENSION` are exported from `@/lib/preview`, and the stored file's
content type is taken from the blob rather than hard-coded.

## 3. New engine exports: `lookFrom`, `LOOK_YAW`, `LOOK_PITCH`

Staw: the 3D previews are always from behind.

The honest finding is that **a mesh file does not say which way it faces.**
There is no such field in OBJ or in glTF, and exporters disagree about the
forward axis, so anything that claims to find a model's front is guessing.

What was actually wrong is that the card and the viewer each picked their own
angle, so one model looked like two things depending on whether you were
looking at a grid or at a page. There is one stated default now, shared by
both, exported from `@/engine/meshes`:

```ts
lookFrom(middle, away, yaw = LOOK_YAW, pitch = LOOK_PITCH): THREE.Vector3
```

`frameMesh` still gives you `middle` and `away`. **If the Toolbox places its
own camera for a mesh thumbnail, use this**, or Kobblon will have three
answers to the same question instead of two.

## 4. Smaller

- Turning a model inside a card used to start the browser dragging the link
  it sits in, ghost image and all. The viewer surface refuses `dragstart`. If
  you put `MeshViewer` inside anything draggable, you get this for free now.
- The 2D/3D switch is one button showing the view you are *not* in, with an
  optional word beside it (`labelled`). It was two lit segments; Staw did not
  like it and he was right — one of the two did nothing when pressed.

## Still mine, still not done

Unchanged, plus Build previews above if you hand them back: `WorldDecal.picture`
→ `content`, `worlds.community_id`, rotation as a `Vec3`, SurfaceGui,
Kobblon-authored insertables, the shared Configure card, Lighting as a
service, the Marketplace preview component, the Lua host, the six functions
still saying Kubes.

# Twenty-seventh round — shared components got stricter, and a warning about `cn`

Shorter round. One real trap, two component signatures that changed, and the
state of the Build render you may be picking up.

## 1. `cn` joins, it does not merge — and that bit twice in one day

`@/lib/cn` is `parts.filter(Boolean).join(' ')`. Nothing more. It is **not**
`tailwind-merge`, and it is easy to use as though it were.

So passing `rounded-none` into a component whose own class list has
`rounded-2xl` does not override it: both land on the element, and which wins
is which rule appears later **in the stylesheet**, which is Tailwind's own
ordering and nothing to do with the order you wrote them. It cost two bugs
here in a day — a labelled button that stacked its word under its icon
(`grid` and `flex` both setting `display`), and a card with a frame inside a
frame.

**If the Workspace restyles a shared component by passing classes, check it
renders rather than assuming the later class wins.** Where a caller needs a
genuinely different shape, the answer is a prop on the component, not a class
from outside. Two now exist for exactly this:

```ts
<MeshViewer bare />   // no border, background or corners of its own
<MeshView bare />     // same, for a caller that is already a frame
```

## 2. `MeshViewer` and `MeshView` signatures

```ts
MeshViewer({ src, format, textureUrl, className, bare, onTurn })
MeshView({ previewUrl, fileUrl, filePath, textureUrl, start, labelled,
           bare, className, onWant3d, onTurn })

onTurn?: (angle: { yaw: number; pitch: number }) => void
```

`onTurn` fires **only while somebody is dragging**, not while the turntable
drifts — the angle it reports is meant to be one a person chose. It fires per
frame during a drag, so hold it in a ref; a parent that puts it in state will
re-render against the drag. Inside `MeshViewer` the callback is itself held
in a ref, because the frame loop outlives any one render.

What it is for: a mesh file does not say which way it faces, so the card's
angle is a guess. On the website a creator now turns the model and takes the
card from exactly there. If the Workspace ever draws a mesh card, offer the
same thing rather than inventing a second guess.

## 3. A card is not draggable, and the reason is worth copying

Turning a model inside a card used to make the browser drag the card. I fixed
it twice; the first fix was in the wrong place and did nothing.

**A `<Link>` is an `<a>`, and an anchor is a drag source from anywhere inside
it.** The drag belongs to the anchor, not to the element under the pointer,
so refusing `dragstart` on the children never had a chance. It needs
`draggable={false}` on the anchor itself.

Anywhere the Workspace puts a draggable 3D view inside a link or an item that
the host treats as draggable, the same applies.

## 4. Build renders — still nobody's, and Staw has now asked twice

A `.kbfl` has no card picture anywhere: not in Create, not in the Toolbox, not
in a link preview. `canPreview` excludes `build` and nothing draws one.

Staw has now asked for Builds to be publishable from the Workspace *and* for
their renders to show in link previews. Both need the same missing piece.

My position, unchanged from last round and now with a second reason: **the
Workspace should draw it at publish time.** You have the World already built,
which is the cheapest moment the picture will ever be, and it is a render of
a World rather than of a file — the engine's job, not a thumbnailer's. If you
would rather I did it here, say so this round and I will, but it means
rebuilding the World in a browser purely to photograph it.

Whichever of us does it: the card must be **WebP with alpha, on no
background**, like every other card since last round, and it goes to
`preview_path` through `makeAssetPreview`.

## Still mine, still not done

Unchanged: `WorldDecal.picture` → `content`, `worlds.community_id`, rotation
as a `Vec3`, SurfaceGui, Kobblon-authored insertables, the shared Configure
card, Lighting as a service, the Marketplace preview component, the Lua host,
the six functions still saying Kubes.

In hand right now, so do not start them: copying a mesh render to the
clipboard from its own context menu, and getting mesh renders to appear in
link previews.

# Twenty-eighth round — old cards redraw themselves, link previews carry the render, and a turn is not a press

Everything here is shipped. Four things, and the first two change behaviour
you may have copied.

## 1. A card that cannot hold transparency is drawn again

**If the Workspace stores or reads `preview_path`, it needs this rule.**

Cards used to be written as JPEG. JPEG has no alpha, so every transparent
Decal had its transparency flattened to black when its card was drawn, and
every mesh was photographed on a painted square. Changing the format to WebP
last round fixed nothing that had already been drawn — and because the
readers had only just started returning these pictures, the black boxes
appeared everywhere at once on content that had looked right for months.

The rule, now in `ensureAssetPreview`:

> a stored card whose path does not end in `.webp` was made by the code that
> could not keep transparency, and is drawn again.

That is a fact about the file rather than a guess about its age — there is no
timestamp on a preview and none is needed. The old file is removed only once
the new one is saved, so a failure leaves the card it had rather than none.

It runs on the owner's own item page, and `CreateUploads` sweeps **Decals
only**, one at a time. Deliberately not meshes in a list: a Decal is a resize,
a mesh is a WebGL context, a download and a parse, and twenty of those because
somebody opened a list is a page that stops answering. A mesh is redrawn on
its own page, where exactly one is being drawn.

`PREVIEW_TYPE` and `PREVIEW_EXTENSION` are exported from `@/lib/preview`.
Compare against those rather than writing `'webp'` anywhere.

## 2. 0109 — link previews carry the render

`link_preview` returned `null` for the picture of anything on the
Marketplace. Its own comment said why: the file is private, so a preview said
what the thing was and showed nothing of it. That was correct when it was
written — there was nothing public to point a robot at.

There is now. The card lives in the public `previews` bucket, which is public
precisely so something with no account can fetch it.

**The column carries a storage path, not an address.** Building the address
needs the project's host, which the database has no business knowing, so the
`og` edge function does that part with `getPublicUrl`. If anything on your
side consumes `link_preview`, it has to do the same — a bare path handed
straight to an `<img>` is a broken picture.

`wide` is false for a mesh and true otherwise. A mesh card is square and
transparent, and a square picture in a wide card is letterboxed to a
thumbnail with bars down both sides. The statically written item pages follow
the same rule, so the two kinds of page cannot disagree about one item.

My first version had that flag inverted and the behavioural check caught it,
which is the argument for writing the check before believing the migration.

## 3. `MeshViewer` gained `onSnapshot`, and a turn is not a press

```ts
onSnapshot?: (take: null | (() => Promise<Blob | null>)) => void
```

Handed up once the model is drawn, and **handed back as `null` when the
viewer goes away** — a snapshot function outliving its renderer is a call
into a WebGL context that no longer exists, which is this project's favourite
trap wearing a new coat. If you take this, drop it on teardown.

It renders and reads in one synchronous block, which is what makes it work
without `preserveDrawingBuffer`. That flag would keep a second copy of every
frame for the life of every viewer on the page to serve a button almost
nobody presses.

On the website it feeds a context menu with one item, *Copy the render*,
replacing the browser's own — whose Save image as and Copy image address hand
out a signed private-file URL. PNG goes on the clipboard whatever the card
was, because a clipboard handed WebP is a paste that silently never arrives.

**And the behaviour worth copying into the Toolbox:** a pointer going down
and up on a card is a click however far it travelled in between, so letting
go after turning a model opened the item's page. `onTurn` now fires only once
the pointer has really moved — five pixels, because a hand is not steady
enough for "moved at all" and a card would otherwise swallow the click meant
to open it. Checked both ways: a still press counts, a turn does not, and
nothing is left suppressed afterwards.

## 4. Builds, for the third round running

A `.kbfl` still has no picture anywhere — not in Create, not in the Toolbox,
not in a link preview, where it falls back to the Kobblon card. Nothing draws
one.

Staw has now asked for Build publishing from the Workspace **and** for Build
renders in embeds, and both wait on this one piece. My position is unchanged
and I would like an answer this round rather than carrying it again: **draw
it in the Workspace at publish time**, where the World is already built. If
you would rather I did it here, say so and I will, but it means rebuilding a
World in a browser purely to photograph it.

Either way: WebP, alpha, no background, through `makeAssetPreview` to
`preview_path` — the same as every other card.

## Still mine, still not done

`WorldDecal.picture` → `content`, `worlds.community_id`, rotation as a
`Vec3`, SurfaceGui, Kobblon-authored insertables, the shared Configure card,
Lighting as a service, the Marketplace preview component, the Lua host, the
six functions still saying Kubes.

Next from Staw, not started: the Catalog — avatar items sold for Brix with
their creation moved into Create. I will send the shape before building it.

# Twenty-ninth round — there is an avatar system now, and it is all shared

This is a big one and it is late; it covers everything since round
twenty-eight. The short version: Kobblon has avatars, clothing, a Catalog
and a creation page for all of it, and every piece of that is in the engine
or in `@/lib/api` where you can take it. Migrations 0112–0123.

## The rig changed shape. This is the meaning change in this round

`BODY` in `@/engine` (`src/engine/clothes.ts`) is the single source for the
body's proportions, and Staw changed them:

```ts
Head:     { w: 2.6, h: 2.4, d: 2.6 }   // and the head is a rounded cylinder
Torso:    { w: 3.6, h: 3.6, d: 1.8 }
LeftArm / RightArm / LeftLeg / RightLeg: { w: 1.8, h: 3.7, d: 1.8 }
```

Arms and legs are now literally the same box. **Anything you have that holds
its own numbers for the body is now wrong**, and wrong in the way this
project keeps meeting: nothing throws, it just renders a body that is not
the body. Read `BODY`, do not copy it.

Two things follow from that and you need both:

- **The clothing templates were redrawn.** `public/templates/*.png` describe
  the new proportions. If you ship or link the old ones, people paint shirts
  for a body that no longer exists. `tools/site/template-sheets.html` draws
  them from `templateFor`, so there is no hand-kept file to forget.
- **`CARD_MARK` is `k3`.** Every drawn card made against the old rig is
  stale. `cardIsCurrent(path)` from `@/lib/preview` is the test; anything it
  refuses should be redrawn the next time its owner opens it. If you draw
  cards, read the mark from the export rather than holding your own copy —
  a check with its own copy keeps passing after somebody bumps one of the
  two.

## What is new in the engine

```ts
import {
  K6, K6_PARTS, K6_POINTS, K6_FACE_SIZE, loadK6Source, forgetK6Source,
  fitToSocket, blockify, headshot, PLACES,
  BODY, COVERS, templateFor, wrapToTemplate, drawTemplate, PIXELS_PER_STON,
} from '@/engine'
```

- **`K6`** is one avatar: `wear(point, object)`, `takeOff(point)`,
  `setFace(texture)`, `dress('shirt' | 'trousers', texture)`,
  `stick(texture)` for a t-decal, `paint(colours)`.
- **`fitToSocket(model, point)`** — new this round, and you want it.
  An uploaded accessory is modelled at any size **and around any origin**.
  Scaling alone was what we had, and it scales the offset too: a bicorne
  came out correctly sized, correctly parented to the head socket, and a
  full arm's length to the right of the body. This scales, re-measures,
  centres on the socket and seats the thing against the part. Call it before
  `wear`; do not write your own.
- **`stick`** now covers the torso's whole front face and stretches the
  picture to it. It used to keep the picture's aspect, which made a t-decal
  a sticker on a shirt. Staw's correction: a t-decal *is* the torso front.
- **`headshot(fov, room)`** returns the camera for a profile picture,
  framed off the head's place in the body table so a hat does not move it.
  Returned, not applied — three products want this shot and none of them
  should invent their own.
- **`blockify(root)`** replaces each skinned mesh with a rounded box (the
  head with a rounded cylinder) and binds every vertex to one bone read from
  *that mesh's own skeleton*. It runs on the clone, never on the loaded
  source.

Pass the **real** mesh format into `loadMesh` and `wearTexture` wherever you
have the filename. `formatOf` is a fallback: a signed URL hides the
extension behind a query string, so every OBJ sniffs as glTF and its texture
comes out upside down. That was a live bug here.

## The clothing system

Shirts and trousers are a picture painted into a template, exactly like the
place this all comes from. `templateFor(kind)` gives the region table,
`wrapToTemplate` writes a second UV channel (`uv1`) onto a part and leaves
the model's own `uv` alone, and the material reads `map.channel = 1`. The
regions are laid out from `BODY`, so the template and the wrap cannot
disagree.

`COVERS` says what a kind covers: a shirt is torso and both arms, trousers
are torso and both legs.

Faces are a picture on a plane at the head's front socket. T-decals are a
picture on a plane at the torso's front socket, over whatever clothing is
there — which is why they are planes and not another texture fighting for
the body's one map.

## The database — 0112 to 0123

Apply in order. 0115 onwards have not been applied to production as of
writing; Staw has the list.

- **0112** `avatar_items`, `avatar_owned`, `avatar_worn`, `profiles.body`,
  `avatar_rules()`. RLS with **no insert or update policies at all** — every
  write goes through a function.
- **0113** `create_avatar_item`, `list_avatar_item`, `buy_avatar_item`,
  `wear_avatar_item`, `take_off_slot`, `set_body_colours`.
- **0114** readers: `avatar_of`, `my_avatar_items`, `avatar_shelf`,
  `my_made_avatar_items`. The `catalog` bucket (public).
- **0115** faces moved out of Style into the Catalog. **Style is gone from
  the website.** Its tables still exist and still hold their rows; one
  migration drops them when Staw is sure. If you read them, stop.
- **0116** `image_bucket` on the readers, because a face's picture is in
  `faces` and a new item's is in `catalog`. **Two paths are only the same
  kind of thing if they are in the same bucket** — we broke every card on
  the site once by coalescing a public path with a private one.
- **0117** the shelf takes `made_by` and `sort_by`; `edit_avatar_item`,
  `archive_avatar_item`, `delete_avatar_item`.
- **0118** a maker owns what they made, with a backfill. Without it Kobblon
  could not buy its own faces and `buy_avatar_item` refused with "That is
  already yours".
- **0119/0120** `preview_path` and every reader handing it back.
- **0121** `sells_until` (limiteds), price optional at creation, price given
  when listing, `set_limited`.
- **0122** the readers hand back `sells_until`. Not `avatar_of`: what
  somebody wears does not stop being worn when the shop stops selling it.
- **0123** `set_body_colours` refuses a body whose six parts are all one
  colour. Staw's rule, and it is a rule, not a page's opinion.

Client calls for all of it are in `@/lib/api`: `avatarOf`, `avatarShelf`,
`myAvatarItems`, `myMadeAvatarItems`, `buyAvatarItem`, `wearAvatarItem`,
`takeOffSlot`, `setBodyColours`, `createAvatarItem`,
`listAvatarItem(id, listed, price?)`, `setLimited`, `editAvatarItem`,
`archiveAvatarItem`, `deleteAvatarItem`, `catalogUrl`, `cardFor`,
`drawAvatarCard`, `refreshPortrait`. Use `setSupabaseClient` as always.

## Two traps from this round, both the shape you already know

**A migration that adds a parameter has to say goodbye to the arity it
replaces.** 0121 gave `list_avatar_item` a third argument with a default,
which *overloads* rather than replaces. `list_avatar_item(uuid, boolean)`
then matched both and Postgres refused the call outright: "function
public.list_avatar_item(unknown, boolean) is not unique". This would have
broken listing in production. Drop the old arity by name.

**A file that reads a column it did not create fails naming the column, not
the file that was missed.** 0120 read `preview_path` on a database where
0119 had not been applied, and the error says `column i.preview_path does
not exist` with a hint pointing at an unrelated table. 0120 and 0122 now
repeat the previous file's `add column if not exists`. If you write
migrations for anything shared, do the same.

## Still true, still worth repeating

`cn()` joins, it does not merge. Two conflicting Tailwind classes are both
emitted and the stylesheet's order decides. Do not pass an override and
assume it wins.

## What is not done, plainly

- **The Catalog item page does not exist yet.** Cards do not open onto
  anything. No cart, and the search filters are thin.
- **2D/3D previews are half done.** Cards are drawn 2D everywhere; the
  3D-on-the-item-page half waits on the item page.
- `AvatarStage` has the drag/tilt/wheel handling but not the context menu
  and switch that `MeshView` has. They should share one component and do
  not yet.
- The Build render for embeds is still unanswered from round twenty-eight,
  and I am still asking you to draw it at publish time in the Workspace.
- Still mine and still not done: `WorldDecal.picture` → `content`,
  `worlds.community_id`, rotation as a `Vec3`, SurfaceGui, Kobblon-authored
  insertables, the shared Configure card, Lighting as a service, the
  Marketplace preview component, the Lua host, the six functions still
  saying Kubes.

# Thirtieth round — a name carries two marks, and nobody starts naked

Shorter than the last one. Migrations 0124-0133.

## The two marks on a name — this one reaches you

Staw's rule: the verified tick and the Kobblon k are **part of a display
name**, not an ornament beside it, and they go wherever the name goes. Never
Font Awesome's tick, and never a traced copy.

`@/components/brand/Verified` now exports `NameMarks`, `Verified`, `Staff`,
`isVerified` and `isStaff`. The artwork is `public/brand/verified.png` and
`public/brand/staff.png`, drawn as a **CSS mask over `currentColor`** - the
files are a solid badge with the glyph knocked out, so masking gives the
badge the colour it sits in and lets the glyph show the surface behind. An
`<img>` would be a white square. If you draw names, use `NameMarks` and pass
the person; it decides which marks apply, in one place.

`avatar_shelf` and `avatar_item_page` now return **`creator_is_staff`**
alongside `creator_is_verified`. They mean different things: verified is
"Kobblon vouches for this account", staff is "this account is Kobblon". The
old column folded admin into verified, which is why there was no way to know
to draw the k.

## Nobody starts naked, and nobody is faceless

- **`starting_kit`** (0131) is a table of Catalog numbers a new account is
  given and dressed in. It holds the free face and the Kobblon t-decal
  today; the shirt, trousers and cap go in as rows when they exist, and no
  code changes. Read it rather than hard-coding what a new person wears.
- **A guest is white head to foot** and keeps what the kit locks.
- **A face is not optional.** `take_off_slot('face')` puts the free face
  back rather than removing one, so **"wearing no face" is a state that
  cannot be reached**. If you have code that copes with a faceless avatar,
  it is now dead code - but leave it, because an old row can still be
  faceless until that account next touches its avatar.
- One colour head to foot is allowed **while trousers are on** (0127), and
  the trousers then cannot come off until a colour changes.

## Buying, refunds and removal

- **`buy_avatar_items(uuid[])`** (0126) buys a basket: every item or none.
- **`avatar_owned.paid`** (0128) records what somebody actually paid.
- **`remove_avatar_item(target, note)`** (0129) takes something down and
  refunds every buyer **40% of what they paid, from Kobblon's account**, not
  the maker's. They keep the record of the purchase; it comes off their body.
- **`review_avatar_item`** and **`avatar_review_queue`** (0124): avatar items
  could never leave `pending` before this. Moderator or admin only.
- **`avatar_item_page(content_id)`** (0125): one item for its own page. It
  finds a closed limited and a thing taken down, so an old link opens.

## Two things for anything that renders an accessory

- **`fitToSocket(model, point)`** from `@/engine`, before `wear`. A model is
  drawn around whatever origin its author used, and scaling an off-centre
  model scales the offset: correctly sized, correctly parented, an arm's
  length to the side. Do not write your own.
- **An item with no texture named wears its model's own Decal** (0130).
  `assets.texture_id` already says what a mesh wears; asking a second time is
  how accessories came out grey.

A t-decal is now the torso's whole front face, stretched. Buttons name a
price with the Brix mark and never the word "Brix".

## Said out loud

The first draft of 0130 retyped `create_avatar_item` from memory and in doing
so dropped its suspended-account check and invented a column on
`avatar_rules` that does not exist. It applied cleanly against a live
database. The file now takes the body out of 0121 rather than retyping it. If
you are ever replacing one of our functions, take its body from the migration
that defined it.

## Still not done

The adjust-an-accessory controls (move, turn, resize and save the offsets)
are **not built** - the create page draws the model on a body and nothing
more, because a control that moves something and saves nothing is worse than
no control. The eight-page redesign Staw named (landing, signup, home,
profile, friends, discover, communities, settings) is on the roadmap and not
started. Everything from round twenty-nine's "not done" list still stands
except the Catalog item page, which exists now.

# Thirty-first round — a socket holds more than one thing, and a face with nothing stored draws itself

Three meaning changes in here. Two of them break a copy on your side
silently, which is the kind this document exists for.

## A slot is no longer one thing (0150)

`avatar_worn`'s primary key was `(user_id, slot)` and is now
`(user_id, item_id)`. Staw: "i want to be able to wear multiple accessories,
even if itll look ugly, its possible". So:

- **The sockets may hold several**: `hat`, `front`, `back`, `neck`, `waist`,
  `leftHand`, `rightHand`.
- **These still hold one**: `shirt`, `trousers`, `tdecal`, `face`, `hair` -
  a picture laid on the body, and the head. Enforced by a partial unique
  index, and `one_at_a_time(slot)` is the function that answers which is
  which. Use it rather than writing the list again.
- **Eight per socket** is the cap, and it is the renderer talking, not
  taste: every accessory is a mesh and a texture in one WebGL context.
  `wear_avatar_item` refuses the ninth with a message you can show as it is.

What this means for you, and it is the silent part: **anything that keyed
worn pieces by slot now drops one.** Signed addresses held in a
`Record<slot, …>`, a React key of `piece.slot`, a map of slot to item - each
of those shows one of two hats and loses the other without erroring. It bit
exactly that way here, in My Avatar's mesh-signing cache. Key on `item_id`.

New and changed doors:

- **`take_off_item(target uuid)`** - new, and the one to use now. With two
  hats on, "take off the hat slot" no longer names anything. It carries
  every rule `take_off_slot` had: a guest keeps their locked kit, trousers
  stay on a body that is one colour all over, and taking off a face puts the
  free one back rather than leaving a hole.
- **`take_off_slot(which)`** - still there, still exported, and now means
  "everything in that slot". It calls `take_off_item` per row, so the rules
  live in one place.
- **`wear_outfit`** empties the sockets the outfit has something for before
  it fills them. Without that, trying three outfits left somebody wearing
  all three.
- **`outfit_items`** got the same key change, so an outfit can save two hats.

## The engine, same change (`@/engine/k6`)

- **`wear(point, thing)`** is unchanged in meaning: it replaces whatever is
  on that socket.
- **`wearAlso(point, thing)`** is new: it hangs something beside what is
  there. `AvatarStage` and `drawPortrait` both use it now, so a look with two
  hats draws both.
- **`takeOff(point)` now returns `THREE.Object3D[]`, not one object.** This
  is a signature change and it will not compile on your side until you
  follow it - which is the good case. The bad case would have been returning
  the first and leaking the rest.
- **`takeOffOne(thing)`** removes one particular object wherever it hangs.
- **`wearing()`** hands back `ReadonlyMap<K6Point, readonly Object3D[]>`.

## A face with nothing stored draws itself

`guestAvatar` and `/brand/guest-avatar.png` are **gone**. `avatarOf(person)`
now returns `person.avatar_url || null` and nothing else - no stock picture
for guests, no stock picture for anybody. If you had the guest fallback,
delete it.

In its place, `Avatar` takes **`personId`**, and with an id and nothing
stored it draws that person's avatar in the browser and shows it as soon as
it is ready. New accounts and guests have a fully dressed avatar and no
picture of it, and initials for a person whose avatar is sitting right there
was the thing Staw was looking at.

- `@/lib/headshots` is the shared piece if you want it outside a React
  component: `askForHeadshot(id)`, `headshotFor(id)`, `watchHeadshots(fn)`,
  `forgetHeadshot(id)`.
- One draw per person, shared between every picture of them on the page, and
  **one at a time** - each draw builds a WebGL context and a browser hands
  out a handful.
- It draws; it never writes. Writing another account's row is not something
  a page may do. `refreshPortrait` is still what makes a picture permanent,
  and only for the account that is looking.
- It mounts with no providers - no auth, no router, no theme - and
  `tools/site/face-preview.html` is the bare page that proves it. `api` is
  imported inside the draw rather than at the top, so a panel that shows a
  face does not pull the data layer in at import.

## A guest no longer gets the Kobblon t-decal (0149)

Reversing part of round thirty. `starting_kit.who` takes a third value,
`'members'`, meaning signed-up accounts only, and TDCL-1196 is one of those.
Guests get the face, the shirt, the trousers and the cap. Guests who already
had the t-decal have had it taken off and un-owned by the migration itself.

## Kobblon can make faces again

Not a server change - the server has been right since 0113
(`kobblon_only and not is_admin`). The create page wrote
`&& !rule.kobblon_only` with nothing after it, so faces were shut to
everybody including the house, and Kobblon's own form told Kobblon that only
Kobblon makes those. If you have a maker UI, the rule is
`!rule.kobblon_only || is_admin`. Faces stay hidden entirely from the kind
picker for everybody else, which is what Staw asked for.

## Said out loud

`give_starting_kit` named the old key - `on conflict (user_id, slot)` - and
0150 drops that key. The file applied cleanly twice and every new account
would have failed at the door with "there is no unique or exclusion
constraint matching the ON CONFLICT specification". It was caught by a
behavioural check and not by applying the migration, because **applying a
migration calls nothing**. If you change a constraint, grep every function
body for its name.

## Still not done

Best friends, cancelling your own requests, the staff console's content
review, editing a face by re-uploading its asset, the clothing render,
reselling limiteds, the outfit UI, and the eight-page redesign. All of round
thirty's "not done" list still stands apart from the accessory placement
controls, which exist now.

# Thirty-second round — a face is on the head now, and a profile is the whole person

## A face is a curved surface, not a sticker (`@/engine/k6`)

Staw asked for three things in one breath: every face the same size on a
head, bigger, and "really onto the head, not infront (like the image is curvy
literally onto the head)". All three are `setFace`, and if you draw an avatar
anywhere, this changes what you get.

- **It is a slice of a cylinder** of exactly the head's radius, a
  fingernail proud of it, centred on the head's own axis. It was a flat
  square standing off the front, which reads as a sticker from any angle but
  dead ahead and lifts away at the corners.
- **The arc is the one whose *chord* is the face width**, not the one whose
  length is. Wrapping a picture over an arc of the width you want draws a
  face wider than the head looks.
- **Bigger**: the box is 0.9 of the head's width and 0.9 of its height, up
  from 0.85 of the smaller of the two.
- **The picture no longer decides its own size.** Two faces drawn at
  different sizes inside their own files came out different sizes on two
  bodies. The transparent border is found and the drawing is fitted to the
  face box, keeping its proportions - never squashed; the window widens on
  the short side instead, which only ever shows more of the picture's own
  margin.

The trim reads the picture back out of a canvas, so it needs the picture to
be readable from this origin. When it is not - and when there is no
transparency to find - it is left exactly as it was. Nothing throws either
way.

Five checks cover it, and the one worth copying is "every vertex sits the
same distance from the head's axis": a flat sheet held against a round head
touches down the middle and stands off at the corners, and "is there a face"
passes on both.

## `lookOf` carries more (`@/lib/api`)

Additive, nothing breaks. Each piece now also has `itemId`, `name` and
`contentId` alongside its slot and its addresses, so one call feeds both a
figure and a list of what that figure has on. Two fetches for those two
things is two answers to one question.

## `avatarKindLabels` (`@/lib/kinds`)

"Shirt", "Trousers", "T-decal", "Accessory", "Hair", "Face". There were three
copies of this list in the website alone, which is how one of them ends up
saying "Decal". If you name a wearable kind, name it from here.

## The profile page

Redesigned around the avatar: the person stands in a studio card at the top
of their own page, turning, draggable, instead of a crop of their head - and
under About there is **Wearing**, every piece a link to its page in the
Catalog. Nothing new is needed from you for it; it is `AvatarStage`,
`Studio` and `lookOf`, all three of which you already have.

The Catalog item page's menu has **Copy link** now.

## Said out loud

The profile page could not be seen with real data from here - this container
cannot reach Supabase, so the page sits on its skeleton. What was looked at
is the figure, the studio card at its real size, and the faces, on bare pages
under `tools/site/`. The layout around them is read, not seen.

## Still not done

Unchanged from round thirty-one: best friends, cancelling your own requests,
the staff console's content review, editing a face by re-uploading its asset,
the clothing render, reselling limiteds, the outfit UI, and the rest of the
page redesigns.

# Thirty-third round — screening in the console, a hole at the screening door, and the profile again

## `review_asset` would take an order from nobody (0151)

Found while wiring screening into the staff console, and it is worth your
reading even though it is our RPC, because the shape is one you can repeat:

- **The guard exempted nobody-in-particular.** It read
  `if auth.uid() is not null and not is_moderator() then refuse` - so a
  caller with *no* identity passed it. That was meant to let a worker with no
  session through, and "has no session" is not the same claim as "is our
  worker".
- **The revoke did not revoke.** `revoke execute ... from anon, authenticated`
  leaves the `execute` that every function is created with for `public`
  standing, and both roles are members of `public`. The ACL still read `=X`.

What kept it from being a live hole was luck: `guard_asset_update` pins
`status`, `review_note` and `reviewed_at` for anybody who is not a moderator,
so the write went through the function and was undone by the trigger. The
door was open onto a wall. It is closed at the door too now: a moderator, or
a caller whose **verified JWT role claim** is `service_role`, and nobody else.

One more trap inside the fix, which cost a round of checks: a first go tested
`current_user in ('service_role', 'postgres')`, and inside a `security
definer` function `current_user` is its **owner for every caller**. It let an
ordinary signed-in account straight through, and the check caught it. A test
of who the caller is has to read something the caller brought with them.

`review_queue`, `review_avatar_item` and `avatar_review_queue` had the same
ineffective revoke and are now `authenticated` only.

## `screening_queue(how_many)` (new)

What is waiting, with the maker on it: name, description, picture, size, when,
and `creator_username` / `creator_display_name` / `creator_is_suspended`.
`review_queue` hands back bare `assets` rows, so a console built on it shows a
title and a uuid and asks somebody to judge blind.

Empty for anybody who may not screen, decided in the function.

**Worth knowing if you show upload state anywhere:** most uploads never reach
this queue. The screener decides as they arrive - approved or rejected - and
`pending` is only what it could not decide. The three `review` terms are
scoped `identity` today, so in practice the Marketplace queue is usually
empty. That is not a broken queue.

## The staff console

New **Screening** panel, two queues in one place - Catalog items and
Marketplace uploads - with the count on each tab, because a queue you have to
open to find out whether it is empty is a queue that fills up. Approve is
green; rejecting asks for a reason first, since the note is the whole of what
the maker is told.

## The profile page, again

Staw on the first attempt: "i absolutely DESPISE the new profile cuz almost
nothing changed". Fair - it moved the picture and added a list. It is laid
out on the old Roblox profile now, which is what he asked for:

- the round picture is back in the header, with name, @name, the three counts
  and the actions beside it;
- **About** under the tabs holds the bio and the Discord line;
- **Currently wearing** is the figure in a studio with a grid of what it has
  on, each tile a link to the Catalog;
- **Statistics** at the bottom: here since, visits, Worlds published.

`WearingPanel` (`@/components/avatar/WearingPanel`) is the figure-and-grid as
its own component, so you can put it in a panel too. It takes a `PortraitLook`
and nothing else - no provider, a router only because the tiles are links.

`lookOf` pieces now also carry `cardUrl`, the drawn card for each worn thing.

## Faces, corrected

Round thirty-two made them too big: a bigger box *and* each picture cropped to
its own drawing, and the two multiplied. The crop is gone. A face is the old
square times 1.2, curved onto the head, and the picture is laid in it whole.

## Still not done

Best friends, cancelling your own requests, AI screening (Groq, later -
screening is manual today), editing a face by re-uploading its asset, the
clothing render, reselling limiteds, the outfit UI, the rest of the redesigns.

# Thirty-fourth round — faces were stretched, a picture that knows it is old, and the card an avatar never handed back

## The face was a third too wide (`@/engine/k6`)

Staw: "i dont like how stretched the faces are being". He is right and the
arithmetic is the whole of it.

A face is painted on a curved surface. Round thirty-two picked the arc whose
**chord** is the face width - so a face would read exactly 2.45 stons across
from the front - and the surface under that chord is **3.13 stons long**. The
picture is painted along the surface, so a square face was drawn a third
wider than it was tall. Every face came out fat and nothing in the geometry
looked wrong, because the box was square.

`FACE_ACROSS` is measured **along the curve** now. A face reads about 2.1
across the front rather than 2.45, which is the right trade: the width was
never the complaint. If you have copied `setFace`, the line is
`arc = FACE_ACROSS / radius`, not `2 * asin(FACE_ACROSS / 2 / radius)`.

The check that goes with it is not "is the box square" - that passed on the
broken version. It is **"is the surface as wide as it is tall"**: the box sees
the chord, the picture is painted on the arc.

## `profiles.avatar_changed_at` (0153)

A profile picture is drawn from the avatar, and it still went stale, because
drawing it again happened in exactly one place: the account's own avatar page,
after a change it watched. Anything else that changes how somebody looks - an
outfit, a starting kit, a takedown that undressed them - left a picture of who
they used to be, and there was no way to tell, because a URL looks exactly as
current as it did the day it was written.

So the database stamps it. Set by a trigger on `avatar_worn` and by a body
colour change, with `clock_timestamp()` rather than `now()` - `now()` is when
the *transaction* began, so two changes in one transaction stamp the same
instant and the check could not tell them apart. It reads as the trigger not
firing and it is the clock standing still.

**How to use it:** a portrait is saved as `portrait-<when>.webp`. Older than
`avatar_changed_at` means stale. On the website that means the stored picture
is ignored and a current one drawn where it is shown (`portraitIsCurrent` in
`@/lib/headshots`, and `Avatar` takes a `changedAt`), and the signed-in
account redraws and saves its own once on the next page it opens. Nobody
writes anybody else's row to do it.

## `avatar_of` hands back `mesh_preview_path` (0152)

0138 taught every reader to hand back the card the Creator Hub drew for an
item's model. `avatar_of` was not one of them, because at the time nothing
drew a card out of what somebody was wearing. So an accessory had a picture
on the shelf, on its page and in a drawer, and no picture in the one place
built out of `avatar_of` - which is exactly what makes it read as a bug
rather than as a missing column. Additive; `lookOf` now carries `cardUrl`.

## The profile, again

Narrower column, the bio and Read more under the counts rather than in a
section of their own, the numbers inside the Read more card, bigger friend
faces, communities as big square emblems. `WearingPanel` has a **2D/3D
switch**: 3D is the live figure, 2D is a drawn picture of it - no spinning
and no WebGL context held while somebody reads the grid beside it.

## Still not done

Best friends, cancelling your own requests, AI screening, editing a face by
re-uploading its asset, the clothing render, reselling limiteds, the outfit
UI, the rest of the redesigns.

# Thirty-fifth round — one switch, not two

`ViewSwitch` (`@/components/avatar/ViewSwitch`): the pill in the corner of a
viewer that says which way you are looking at something - a picture of it, it
in three dimensions, it on you.

It was written on the Catalog item page, and when the profile grew its own
2D/3D switch I drew a second one that looked nearly the same. Staw spotted it
on sight: "for the 2d/3d bruh just use the same design we had for the
catalog". So it is one component now, used by the item page and by
`WearingPanel`, and it renders nothing when there is only one way to look -
a switch with one setting is a label pretending to be a control.

If you have a viewer with its own way of saying this, take this one.

```tsx
<ViewSwitch
  ways={[
    { value: 'picture', icon: faImage, label: 'Picture' },
    { value: 'body', icon: faCube, label: '3D' },
  ]}
  value={mode}
  onChange={setMode}
/>
```

It positions itself in the bottom-right corner of whatever is `relative`
around it, which is where `MeshView` has always put its own.

# Thirty-sixth round — hair could not be published, and a figure that fills its frame

## Nobody could publish hair

Staw: "seems like people may encounter trouble trying to publish hair,
accessories, etc", with a screenshot of somebody stuck on the form. They were
not unlucky - **it was impossible**, and had been since avatar items existed.

`create_avatar_item` requires `slot = kind` for everything except an
accessory, which is the only kind with somewhere to choose. The create page
drew its "Where it goes" picker for every model kind - hair included - and it
starts on "On the head", so a hair was always sent as a `hat` and the server
always refused it with "A hair is always worn as a hair". The message was
about an answer nobody had been asked to give, which is why it reads as a
mystery rather than as a mistake.

One line decides the slot now (`kind === 'accessory' ? slot : kind`) and the
picker is only drawn where it means something. Proven both ways in SQL:
hair-as-a-hat refused, hair-as-hair made, accessory-on-the-head still made.

**If you have a maker UI, check this.** Anything that offers a socket for a
hair is broken the same way.

## `AvatarStage` frames the body, not the sphere around it

It measured the bounding *sphere* and backed off by its radius - which is half
the **diagonal** of a standing figure, about a third more than its height - so
every avatar on the site sat a third too far back and read as a small person
in a big empty room. It now fits the body's height and width, asking both and
taking the further answer, because a frame narrower than it is tall runs out
of width first and the height alone crops the arms off.

This changes every figure you draw with `AvatarStage`: they all get bigger in
the same frame. Nothing else moves.

The margin is 1.18 and is not decoration: the camera sits a little above the
middle and looks down, so the top of the head is further from the lens than
the middle is. At 1.06 it sawed the head off.

## "2D", not "Picture"

In `ViewSwitch` and in `MeshView`'s own corner button. Staw: it "takes less
space", and the word was most of the control's width. Catalog item page,
Marketplace mesh viewer and the profile's wearing panel all say it the same
way now.

## Also

The profile's friends row and communities grid: smaller faces and emblems,
more space between them.

## Still not done

Best friends, cancelling your own requests, AI screening, editing a face by
re-uploading its asset, the clothing render, reselling limiteds, the outfit
UI, the rest of the redesigns.

# Thirty-seventh round — an avatar has a price, and three ways a figure sat wrong

## `avatar_of` hands back `price` (0154)

Staw wants what somebody is wearing to be worth something on the page: the
total in a corner of the profile card, and each piece's own price on its tile.
The price was on the item and every other reader handed it back; this one did
not, for the same reason it did not hand back the model's card two files ago -
nothing had needed it. A page looking each item up instead would be eight
requests to say one number.

It is **the asking price today, not what anybody paid** - `avatar_owned.paid`
is the receipt, and the thing worth showing on a profile is what the outfit
costs now. `lookOf` pieces carry `price`.

## Three ways a figure sat wrong

- **Off centre and cropped.** `AvatarStage` sizes its canvas and its camera's
  aspect from the element it mounts in. The profile's panel did not give it a
  height, so it measured one thing and the browser stretched the canvas to
  another. **Pass it `className="h-full w-full"`** - if you mount the stage in
  a box that sizes itself to its contents, it will look like this.
- **The flat picture was small.** `drawPortrait`'s whole-body frame still used
  the bounding sphere - half the diagonal of a standing figure - which is the
  bug fixed in the stage last round, in the other place that frames a body.
  Both measure height and width now and take the further answer.
- **The margin.** 1.18 in both, because the camera looks very slightly down
  and the feet are the far corner: at 1.1 it cut them off.

## A dot drawn for the wrong size

`PersonAvatar`'s status dot is sized from its `size` prop, so passing
`size="3xl"` and then overriding the width with a class gives a dot drawn for
a picture twice as big, sitting over the name. Pick the size, do not override
it. (Ours is `xl` now, which *is* `h-16 w-16`.)

## Still not done

Best friends, cancelling your own requests, AI screening, editing a face by
re-uploading its asset, the clothing render, reselling limiteds, the outfit
UI, the rest of the redesigns.

# Thirty-eighth round — the worth moved, and the item menu has an order

## Where an avatar's worth is said

In the Currently wearing panel, over the tiles it is counting - "soo i wanted
the total avatar value in this area somewhere". It was in the corner of the
profile card for one round; a total belongs beside what it adds up. Each tile
says its own price, and "Free" in words where there is none.

Counted from what is on the body: a piece that has been taken down is still
worn and has no page, so it counts for nothing rather than for its old price.

## The item menu, in an order

Staw: "i also want to reorder the thing u can do by clicking more cuz its a
bit of a mess rn". The order is now what somebody reaches for:

1. **Wear it on my avatar** (if they own it)
2. **Edit it** (if they made it) - new, and it goes to
   `/create/avatar?item=<content_id>`, which opens the maker's drawer *on that
   card* rather than on forty of them
3. **Copy link**
4. **See who made it**
5. **Report it**
6. **Take it down** (staff)

The rules under it, if you are building the same menu: anything that changes
the thing sits above anything that only reads it, and the two that cannot be
undone are last, apart, and red.

**`/create/avatar?item=<content_id>`** is a link you can use too - it is the
Things to Wear drawer, scrolled to one item.

## Still not done

Best friends, cancelling your own requests, AI screening, editing a face by
re-uploading its asset, the clothing render, reselling limiteds, the outfit
UI, the rest of the redesigns.
