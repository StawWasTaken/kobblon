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
