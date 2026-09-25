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
