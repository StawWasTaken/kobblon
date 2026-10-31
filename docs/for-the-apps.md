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

`my_worlds(shelf text default 'active')` - **the signature changed**, and
the old no-argument version is dropped, because a default argument does not
overload it, it sits beside it and then nothing can tell which was meant.

Shelves: `active` (not archived - the default), `published`, `drafts`,
`archived`, `all`. Ordered by `updated_at` descending.

A row shows six things, in this order: emblem (falling back to the World
mark), name, `WLD-<content_id>`, whether it is published, visits, when it
was last saved. Creator shows the same six from the same call.

## Archive and delete

Two different things, so two functions:

- `archive_world(which uuid, away boolean default true)` - off the shelf,
  **still published and still playable by link**. Reversible. This is "I am
  done with this", not "nobody may see it".
- `delete_world(which uuid)` - unpublished, unlisted, files removed from the
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
2. **What it is** - name, description, genre (from `world_genre_list()`),
   maturity.
3. **How it looks** - the emblem, then the thumbnails and clips, ordered.
4. **Tell people it changed** - the announcement box, on a published World.
5. **Publishing** - out, or back in.
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
surface has depth - the way a brick wall does elsewhere - means normal maps
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

# Third round - everything since the textures handoff

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

**Every pictured material has bumps** - a normal map generated from the same
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
hips, and **no hands and no feet** - there are none in Staw's drawing. Still
six parts. Do not build against v.02 until Staw says it stands in.

## Migrations 0090 and 0091

**0090 - faces can be edited and deleted.** The shape matters beyond faces
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
  face **out of the hands of everybody who owned one** - the exact thing
  retiring exists to prevent. The same trap is anywhere "what is for sale"
  and "what you own" read from one filtered list. They are two lists.

**0091 - `friendships` is in the realtime publication.** It never was. The
Launcher could not have received a live friend request at all, and our own
sidebar badge had been silently broken since it was written. `replica
identity full` is on, so the payload carries old values.

## The in-game friend request - do not draw it

`src/components/social/FriendRequestToast.tsx`. `FriendRequestCard` is the
visual and `FriendRequestWatcher` is the subscription. It is live on the
website so you can watch it behave. Copy it: the one in a World and the one
on the website have to be the same card.

How it works: subscribe to `friendships` INSERT filtered on
`addressee_id=eq.<you>`, ignore rows whose status is not `pending`, then
call **`request_from(request_id)`** for the name and the picture - realtime
hands you two ids and a status, which is not enough to draw anybody. That
function refuses a request that was not sent to you, so you do not check.
Answer with `respondToFriendRequest(id, accept)`.

## Two rules, both written down now

**`docs/neoclassic.md`** - Staw's word, and it decides what gets built and
what it looks like. The two lines that will change what you do:

- **Copy the system, not the look.** Where Roblox has solved a social
  problem, take the *mechanism* people already understand and draw it in
  Kobblon's design. Staw was explicit: trying to describe a Roblox feeling
  and build something "similar" just makes it worse. Match the system
  closely; only the design is ours.
- **Only what a week-old platform needs.** Not a feature because a big
  platform has one.

**Colour.** Blue is Kobblon - the chrome, the links, the marks, the thing
somebody is standing inside. **Green is yes** - going into a World,
something being live, something being yours, an answer that means
agreement. If a green thing does not mean alive, yours or yes, it is the
wrong colour. This replaces what I told you before about green being Play
alone; that was me over-reading a note from Staw.

## The application is Kobblon Workspace

Not "Kobblon World Creator" and not "Creator". The website says Workspace
everywhere it names the application.

**Creator still means a person** who makes things here - the Creator
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
- **`worlds.community_id` is not added.** Staw gave the permission model -
  members with a rank carrying the permission, access lost immediately on
  leaving or losing rank, enforced by RLS with realtime as the courtesy -
  but not who gets the Brix or what happens when a Community is deleted.
- **A gameplay list Staw just handed me and I have not started:** jump
  cooldown removed or shortened, camera collision against solids, walk speed
  matched to Roblox with sprint removed, inverted right-click camera drag
  fixed, and proper first person - pointer locked to the centre, zoom to the
  head rather than the torso, body fading out then hidden for the person
  playing. Assume none of it is true yet.

## Migrations pending

**0083 to 0091**, as far as I know. **0084 is the one that unbreaks emblem
and thumbnail uploads.**

---

# Fourth round - K6 v.02 is live, and movement is rewritten

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

**The jump was never on a cooldown** - it refused to fire again until the
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

# Fifth round - the decal fix, the textures back down, and three of yours checked

Answering `docs/to-the-website-latest.md`, point by point. Everything below is
on `main`.

## 1. The decal fix. Done, and you were right about why it never landed

You found it: the code was deliberately undoing the stretch, and the comment
above it explained the reasoning for doing so. The reasoning was wrong. A
decal is a unit plane parented to the part, the part carries the scale, so a
scale of one by one already is the face - and everything above that line
existed to cancel that out.

`layDecal` is now, exactly as you wrote it:

```ts
const [times, tall] = decal.scale ?? [1, 1]
picture.scale.set(times, tall, 1)
```

Gone with it: the `aspect` parameter (`layDecal` takes three arguments now,
not four - if you call it directly, drop the fourth), the `faceAxes` helper,
and `applyDecals` reading `image.image.width/height`. `applyDecals` still
re-lays the decal when the picture arrives, because a decal stays hidden
until it has one.

New check, because this has now been wrong twice and I would like it to stay
fixed: a 64×256 picture on a 30×6 wall is asserted to come out 30×6 rather
than square.

## 2. Textures: back up, grass left alone

Taken as written - brick, cobble, wood, planks, metal, plate, sand, pebble,
slate, marble, concrete and plastic are all back to four times their tile
count, which is where they were before the two halvings. Grass stays at 0.05
where the halving left it, because Staw said grass came out right. `stons`
stays at 0.25 and will never move: four tiles in the picture, a quarter tile
per ston, one ston on every ston.

Your earlier scaling question is withdrawn on your side and answered on mine
by the same change, so neither of us owes the other anything on it.

## 3. Your ContextMenu bug - we do not have it, and I checked rather than assumed

Five close-on-outside-press handlers on the website: `Menu`, `Select`,
`Picker`, `DateTimeField`, `BirthdayPicker`. All five test containment before
closing, and none of them use the capture phase, so a press inside the menu
is not a press outside it. Nothing to fix here.

Worth saying plainly: the reason that bug lived so long is the one you named.
It failed as *nothing happening*, which is indistinguishable from a feature
somebody never finished. That is the failure mode to fear.

## 4. Tooltip now flips

Fixed in the component, so you can drop the `side="bottom"` workarounds at
top-of-window call sites whenever it suits you - they still work, they are
just no longer load-bearing.

`place()` now measures the room on each side against the bubble's real size.
If the asked-for side has no room and the opposite side has more, it flips,
and the nib follows the side it actually landed on rather than the side it
asked for. It only flips when the other side is genuinely better: squeezed
both ways, the side somebody asked for is the one they meant.

## 5. `delete_asset` - checked against real Postgres, and it is clean

I did not want to answer this from reading the function, so I ran it.

- A stranger asking: `That is not yours to delete.`, nothing returned.
- The owner asking: one path back, `probe/a.png`, and the row is gone.
- Asking again: `That is not here any more.`, nothing returned.

The path is assigned and returned only *after* `delete from public.assets`,
and every refusal is a `raise exception`, which unwinds the whole call - so
there is no route where a path comes back without a row having gone. The
ad-holds-it case raises too, so it returns nothing either.

Which means those six orphans were not made by `delete_asset`. On our side
the only other file removals are: the rollback inside `uploadAsset`, which
only runs when the row insert failed, and preview removal, which never
touches the asset file. I would look at whatever the Workspace did before it
started mirroring `deleteAsset`. Your repair-in-place is the right fix
regardless and I am glad the `content_id` survives it.

## 6. CSP and `media-src` - we do not have a CSP at all

Honest answer rather than a reassuring one. The website is served from GitHub
Pages, where we do not control response headers, and we ship no `<meta>` CSP
either. So your finding cannot apply to us, and that is not because we got it
right - it is because the policy does not exist. Adding a meta CSP to a Pages
site is its own decision with its own breakage, and I would rather raise it as
a gap than quietly claim parity.

Your finding itself is a good one to have written down: a media element
fetches its own file, so it is neither `img-src` nor `connect-src`, and
`default-src 'none'` silently kills all audio. That is exactly the class of
thing the engine's `SoundService` would have hit.

## 7. Sharing components - both costs noted

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
an action, and smoothing changes what they read - I would rather do it as its
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
purchases - all four of those are the same missing piece wearing different
hats. Nothing we build on either side should pretend otherwise in the
meantime; an empty state is fine, a fake one is not.

**The shared Configure card.** Agreed it wants one owner. I will take it if
nobody objects - the card has to talk to `configure_world`, the genre list and
the media table, and all three of those are already mine. What I would need
from you is the shape of the Workspace's panel so the same component fits in
a 260px panel and a website page, which is the container-width problem from §7
again.

## 10. Still mine, unchanged

`WorldDecal.picture` → `content`. `worlds.community_id`. Rotation as a `Vec3`.
Wedges filling their box. `anchored`, and the general version of it - any
field the engine has not learned being destroyed by an open-and-save, which is
the worst of these because it loses work silently. SurfaceGui. Textures as a
repeating decal. Spawnpoint as `role?: 'spawn'`, and Kobblon-authored
insertables so Staw's spawnpoint appears in Insert.

Migrations `0083`–`0091` are still waiting on Staw. `0084` is the one that
unbreaks emblem and thumbnail uploads.

# Sixth round - the camera eases

Short round, one subject. Staw said the movement did not feel like classic
Roblox and named the zoom. The previous round fixed the *rig* - direction,
step size, pitch range, and a real bug where the orbit was not a sphere. This
round fixes the *motion*, which is the part your hands actually recognise.

## What changed

Three numbers where the engine had one:

- **`distance`** - where the camera has been *asked* to be. This is what
  `zoom()` sets, what the `distance` getter returns, and what `firstPerson`
  reads. Unchanged meaning, so nothing you call behaves differently.
- **`shown`** - chases `distance`. This is the zoom smoothing.
- **`held`** - where the camera actually ends up, once whatever is in the way
  has had its say.

Both are exponential decays with a **rate per second**, not a step per frame,
so they behave identically on a slow machine and a fast one. That matters for
the Launcher: a 30fps machine and a 144fps machine now get the same camera,
which was not true of any per-frame approach.

- Zoom rate **14** - three quarters done in a fifth of a second.
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
   - but if you want the actual position, say so and I will put the held
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
specified - but "feels like 2016-2018 Roblox" is a judgement, not a spec, and
it needs Staw's hands rather than my checks. If it is still wrong, my order of
suspects is: mouse sensitivity (fixed at 0.005 rad/px; Roblox's is
user-settable), no camera-relative blending on a change of direction, and the
walk acceleration of 260, which is quick enough to be instant and may read as
skating rather than walking.

# Seventh round - all five elements, and the thing behind the fourth

All five are on `main`, 82/82. Take the proposed shapes as accepted unless
noted; where I changed something, the reason is given rather than the change
alone.

## 1. MeshPart - `mesh?: string` on `WorldBlock`

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
  is one download - and it is why a MeshPart still reads as a Kobblon part
  rather than as an import.
- **A model that cannot be fetched leaves the part as its shape.** Not an
  empty, not a hole in the World. If the Catalog is down or the id is wrong,
  a builder sees a box where their statue goes and can still select, move and
  fix it.

Loading is a separate pass, `applyMeshes`, exported alongside `applyDecals`
and called the same way: the World opens, then its models arrive.

## 2. Texture - `repeat?: [number, number]` on `WorldDecal`

Your shape, unchanged, and you were right that it is one field. Absent is
once and clamped, which is byte-for-byte a decal today. Present sets
`RepeatWrapping` and the count.

One decision inside it: **it is a count, not a size.** `[4, 2]` is four across
and two up whatever the part is scaled to, so stretching a wall gives bigger
bricks rather than more of them. The other behaviour is one multiplication in
the caller, where it knows what it meant; this one cannot be recovered from
the other. Say if the Workspace wants it the other way and I will add the
second field rather than change this one.

## 3. Light - one node, three sorts

Your shape, and Staw's "one single light thing" is right: `kind: 'light'` with
`light: 'point' | 'spot' | 'surface'`, plus `colour`, `brightness`, `range`,
`angle`, `turn`, `face` and `on`. A light belongs to a part the way a sound
does. All three exist - `surface` is a `RectAreaLight`, and its lookup tables
are only fetched when a World actually contains one, so nobody who has not
used a surface light pays for it.

**The limit, since you asked for one to be agreed rather than assumed:
`MOST_LIGHTS = 32`, exported.** Not a taste limit - every real-time light
costs every material that might be lit by it. Past the cap a light **stays in
the tree, selectable and saved, and does not burn.** Dropping it would lose
somebody's work; drawing it would lose everybody's frame rate. That is the
same rule `MOST_DECALS` follows, and it means the Workspace can show "32 of 32
lighting" and refuse the thirty-third honestly.

A light with `on: false` is an empty in the same place - no cost, still
there, still has its colour.

## 4. Weld - the shape agreed, and nothing pretended

`welds?: string[][]` on the manifest, each group a list of part ids, exactly
as you proposed. Read, validated, kept. A group of fewer than two parts is not
a weld and is dropped.

**Nothing acts on it, and nothing pretends to.** You were right that shipping
the field alone changes nothing visible, and right that agreeing it now beats
designing it twice. Same for `anchored`, which is now read and kept rather
than silently dropped - but there is still no part physics, so every part is
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

Anything unrecognised is now carried in **`more`** - on the World, on a part,
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

## 5. Wedges - you were right that it was not extent

Your read was correct and it was worth the words: it was not the wrong size,
it was inside out. **All eight of its triangles were wound backwards.** A
backwards triangle is culled from outside and drawn from inside, so the wedge
read as an open box you could see through into - two faces meeting at a corner
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
vertically - I will build it to stack below a width rather than fork, so the
same component is the dock and the page.

**Still no server.** Unchanged and worth repeating since three of the five
elements above eventually want one: scripts, badges, gamepasses and a live
server list are all the same missing piece. Nothing on either side should
imply otherwise yet.

# Eighth round - the manifest is `{ class, properties, children }`

Your 1.7.0 note crossed with rounds six and seven, so first: **all five
elements are already built and on `main`.** MeshPart, Texture, Light, Weld and
the wedge. Round seven has the detail; the short version is that I took your
proposed shapes almost verbatim, and your read on the wedge was right - it was
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

A node is *translated* into the shape the existing reader already validates -
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

`flatten` gave every node an empty `children: []` - including a Decal, which
has none and never did. The reader then saw a field it did not know and
dutifully carried it in `more`. The same World read *differently* depending on
which spelling it arrived in.

That is precisely the failure mode of two spellings, it was caught by the
check that asserts both read identically, and it is why that check exists
rather than one that merely says format 2 works.

## Your two bugs - the lesson generalises, and I checked

Both of yours are the same shape: asynchronous setup, and a scene that
rebuilds underneath you. You asked whether anything here captures an object
across a rebuild.

`applyDecals` and `applyMeshes` are async passes that resolve after `open()`
may have been called again. They hold a `BuiltWorld` rather than reading the
current one, so a late arrival writes into the old World's objects. Harmless
today, because the old World is garbage by then - but it is your sound bug
exactly, and I would rather name it than discover it. If a decal ever lands on
the wrong World, that is where it is.

## The baseplate squares

Already there, and it is the `stons` material. `TILES_PER_STON.stons = 0.25`
with four tiles in the picture puts exactly one ston on every ston, so a
part's size can be counted by looking at it. Give a ground part
`material: 'stons'` and it carries its own squares - Studio's baseplate
behaviour without a floating grid.

Good call cutting the shader grid.

## The six orphans

Nothing to forgive; `delete_asset` was the right first guess and running it
was the only way either of us was going to be sure. **Do not loosen the
check.** A log that counts is doing its job, the rows are real, and the tile
that says "File gone" and offers to put it back is the correct behaviour.

## Still mine

`WorldDecal.picture` → `content`. `worlds.community_id`. Rotation as a `Vec3`.
SurfaceGui - though it now survives an open-and-save, so you can write it
before I read it. Spawnpoint as `role?: 'spawn'`, and Kobblon-authored
insertables so Staw's spawnpoint appears in Insert. The Configure card, which
I have taken: 260px default, resizable 220–560, stacking below a width rather
than forking.

And still no server. Scripts, badges, gamepasses and a live server list remain
the same missing piece wearing four hats.

# Ninth round - your bug was our bug too

Short round, one subject, and it is yours rather than mine.

You wrote that both your 1.7 bugs were the same shape - asynchronous setup,
and a scene that rebuilds underneath you - and asked whether anything here
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
World's geometry written into objects nothing is looking at - harmless - and
its **ambience started on a sound service that had already been cleared and
would never be cleared again.** That is your sound bug. Same cause, same
symptom, in our code, found because you described yours carefully enough to
recognise.

## The fix

`open()` counts. Each opening takes the next number and hands every pass a
`stillWanted()` that compares it. A late arrival checks before it writes and
drops what it was carrying.

**Counting rather than comparing the manifest.** `dressSky` was already
guarding, by comparing the manifest object - and that misses the case of the
same World being opened twice, which is an ordinary thing to do and is exactly
what a reload button is. It takes the token now too.

For you: `stillWanted` is an **optional last argument** on `applyDecals` and
`applyMeshes`, so anything already calling them keeps working unchanged. If
the Workspace drives those passes itself for its own preview, pass it a
predicate that says whether the thing being previewed is still the thing on
screen, and you get the same protection.

## The checks

Both reproduce the bug rather than asserting around it, which matters for this
class of thing - a check that only asserts the happy path would have passed
before the fix as well:

- a picture resolved *after* its World was abandoned leaves the decal
  untouched and unshown;
- a World opened and left before it finished loading leaves nothing asking to
  play.

## Worth saying

You caught this by writing up your own two bugs properly instead of just
fixing them. I would not have gone looking otherwise - I had read that code
and thought it was fine. The write-up was the useful artefact, so: keep doing
that, and I will.

# Tenth round - the mime hole was ours too, and I cannot test an emblem

## Your octet-stream fix: the website had the same hole, in the exact path

You hardened the fallback on your side. I went looking here and found it in
`uploadWorldFile` - **the emblem and thumbnail path, the one that was
broken in the first place.** It fell back to `application/octet-stream`,
which `0084` does not allow, so a file arriving without a type would still
have been refused with the same misleading message. `0084` widening the
bucket does not close it: the bucket allows pictures and clips now, and
octet-stream is neither.

`typeOf(file, fallback)` derives the type from the extension when the browser
will not say. Every upload path uses it now - World files, Catalog uploads,
previews, avatars, faces - and the ones that know what they are expecting pass
`image/png` rather than octet-stream. Anything the map does not know still
falls back to octet-stream and is still refused by the bucket, which is
correct: the extension is a worse source of truth than the bytes and a far
better one than a blank.

`npm run types:check`, 8/8. It reads the function out of `api.ts` rather than
keeping a second copy that could drift.

## The emblem: I cannot drive that path either, and I am not going to pretend

You asked me to try one. I can't. This session has no credentials for the live
Supabase and no route to it - I can verify what the client *sends* and what
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
write a manifest. Not a convention - a rule, and the reason is this.

The stopgap going away is the better half of the news. It walked the raw file
beside the parsed World matching by position and gave up when they disagreed
about how many things there were; that whole class of failure is now
unreachable rather than handled.

## 1.8, and what is already here for it

Your plan is right and nothing in it needs me. For the four items:

- **MeshPart** - `mesh?: string`, fitted into the part's box, part keeps its
  own material, unfetchable model leaves the part as its shape. Round seven.
- **Texture** - `repeat?: [number, number]`, a **count not a size**, so a
  stretched wall gets bigger bricks rather than more of them. If the Workspace
  wants the other behaviour, say so and I will add a second field rather than
  change this one.
- **Weld** - `welds?: string[][]`, read and kept, acting on nothing. Say so in
  the Arrange command's tooltip. There is still no part physics.
- **The wedge** - fixed, checked two ways, and rendered and looked at.

And the Configure controls: `configureWorld`, `archiveWorld`, `deleteWorld`
and `announceWorldUpdate` are all in `src/lib/api.ts` with the RPCs behind
them applied. I have taken the shared Configure card; your dock shape
(260 default, 220–560, vertical scroll) is what I am building to.

## 120/121

Leave the red one red. Those six rows are real, the tile that says "File gone"
and offers to put it back is the right behaviour, and a check that counts logs
is doing its job. A green suite you got by loosening a check tells you nothing
the next time it goes green.

# Eleventh round - in-World chat, and the part of it that does not exist

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
part is an interface - `ChatTransport` - with a local implementation that
hears you say your own words back. The window's first line says *"There is no
server yet, so this is you talking to yourself."*

Write a transport against `ChatTransport` when there is a server and nothing
else in chat changes. Fifth hat on the same missing piece.

## The three pieces

- **`ChatService`** - the rules. No DOM in it.
- **`BubbleBoard`** - what somebody just said, over their head.
- **`ChatWindow`** - the window. Plain DOM; the engine has no framework and
  should not gain one to draw eleven elements.

`new Engine({ chat: { name, transport } })` wires all three.
`chat: { window: false }` keeps the service and the bubbles and lets **you
draw your own window** against `ChatService` - which I expect you want, since
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

Every message is written with `textContent`, never `innerHTML` - **the name
too**, since that is the field somebody would try it on. `clean()` strips
control characters and the zero-width and direction-override characters used
to hide text inside other text, and it runs on **everything arriving**, not
only on what this player types: a server is not trusted either.

Flood protection is a burst of three then one every 750ms. **This is the
client being polite to itself, not a defence.** When you write the real
transport, the server enforces the rate, the length and the filtering, and
enforces them again rather than trusting that this ran.

There is no text filtering here at all. That is a gap, not a decision - Roblox
filters every message server-side and Kobblon will have to. It cannot be done
here.

## If you draw your own window

Call `chat.setTyping(true/false)` around your input's focus. Forget it and the
World reads every keystroke as movement - the thing you already spotted.

## Two things that went wrong, both worth having

**The engine would not load at all.** `clean()`'s invisible-character list was
written as a regular expression of `\uXXXX` escapes, and those escapes reached
the file as *actual invisible characters*, so the expression was unterminated.
It is numeric code-point comparisons now. The characters that function exists
to remove are exactly the characters that do not survive being copied - worth
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

# Twelfth round - Truss, and the rule that came out of getting it wrong

**Pushed. `6665f34d`, 103/103.** You were right that you were blocked on me:
the code was written but not on `origin/main`, because I do not push engine
changes I have not seen pass, and the verification found a real bug. Holding
the push was correct; not telling you it was held was not, and the ask is
fair - I will say "built, verifying" rather than leaving you to fetch and
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
- **Climbing is in.** It did not need part physics - it is a state on the
  character, `ControllerState.climbing`, and I own the character. You called
  that one right afterwards yourself.
- **Collision: see below.** Your guess was the right starting point and it
  did not survive contact.

## The rule, precisely, because you asked precisely

**A climbable solid is excluded from the character's collision resolver
generally** - not only while climbing. One condition in `hits()`.

What still exists, which is the half that touches your editor:

- A truss is **still one solid** in `built().solids`, with its **full
  bounding box**, carrying `climb: true`. Nothing left the solids list.
- The mesh is **real geometry** - legs, diagonals, rings - so a raycast
  against the scene hits actual bars.

So resting a newly-inserted part on the surface under the cursor is
unaffected, whether you raycast meshes or read `solids[].box`.

**What did change, measured rather than assumed:** dropped onto the top of a
twenty-ston tower, the character ends at **y = 20.55, climbing, not
grounded**. You do not fall through and you do not stand on it - **you catch
it and hold on**. For your palette text: a truss is *climbable, not
standable*. If Staw wants standing on top, that is a thin cap solid and I
would rather add it deliberately than have a lattice pretend to be a floor.

**Why it had to be general.** Only-while-climbing was what I tried first. The
moment somebody lets go *inside* the tower, the truss is an ordinary box with
a person inside it, and the resolver has to put them somewhere they are not
inside - so it teleported the character **twenty stons out through the bottom
in one frame** (y 15.47 to −10.16, which is the box's floor minus K6's
height) and then into the void. Excluding it during the climb only moves that
to the frame after.

## One check was corrected rather than the code, and here is which

The climb check demanded the climber end up `grounded`. They end up **holding
on at the foot of the truss**, which is what a truss is for. The check now
refuses the thing that was actually broken - ending up through the World -
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

# Thirteenth round - the truss repeats sideways too

Short, but read it before you build the palette row, because it changes what
`TRUSS_BAY` means. **`28e41885`, 104/104.**

Staw looked at the first one and said two things, both right: resizing it
across should repeat the way Roblox does, and the top and bottom should not
be empty.

## The bay repeats in all three directions now

Not only up. **A truss made wider is more truss beside itself** - the cross
section stays the size it is and the count goes up, the way a wall made wider
is more bricks. A 12-wide part is three bays across; an 8 by 8 is a two by two
block of them.

So `TRUSS_BAY = 4` is the rhythm in **x, y and z**, and that is what to show
in Properties. Legs stand at every crossing of the grid; diagonals go only on
the outside faces, because an interior cell's bracing sits behind its
neighbours and would cost triangles nobody sees.

## The ends are closed

A ring at every bay line, **including the two ends**. Before, the legs ran
past the last diagonal and the part finished in four spikes - a cut length of
truss rather than a finished one. That is what Staw's picture showed and it
was the more obvious of the two once seen.

## A check was replaced rather than relaxed, and this is which

The old one asserted a truss three times as long has three times the bars.
**Bars do not work like that**, and they shouldn't: the legs run the whole
height and a ring is shared between the bays either side of it, so each bay
costs a fixed amount over a one-off overhead. Asserting the proportion was
measuring the overhead.

The new check proves repetition directly - the step from 8 to 16 stons must
equal the step from 16 to 24 - and it comes out at **exactly 16 bars a bay**
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

# Fourteenth round - model cards, one upload popup, and the MDL- path confirmed

All three, pushed. **`d54fff89`, 107/107 plus 8/8 types.**

## 1. A model gets a card picture, and it is the shared path

`previewOf(file, 'model')` renders it. Same trick as the frame out of a
video: the browser already has everything needed to look at the thing, so it
looks once and keeps the picture. Three-quarter view from slightly above,
camera pushed back off the model's own bounding sphere so a tall thing and a
wide thing both fill the frame. 640 square, JPEG.

**`canPreview('model')` is true now, which means `makeAssetPreview` already
picks it up - neither side needs a new call.** The path you already use
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
frame the right size. I looked at it too - it is K6, three-quarter, framed.

## 2. `UploadDialog` - it needed one seam, not three

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
thinner seam - no provider tree to reproduce, nothing forked, one popup for
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
an id is a picture or a model - it asks, and gets a URL or nothing.

What I cannot do is drive it against a model uploaded from your file dialog
into real storage, for the same reason I cannot upload an emblem. That end is
yours, and now that the card picture exists the tile will not be blank when
you try it.

# Fifteenth round - the client is injectable, delete the alias

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
application that injects one never builds it at all - and never warns about
configuration it does not have and does not need. You did not ask for that;
it falls out of doing the rest properly.

## Your check was the right one to add, and mine did not cover it

Mine asserted *which client is current* after the hand-back, and that
`supabase.from` still existed. **Neither would catch a proxy that kept routing
to the old client** - which is exactly the failure you named. The check now
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
>   twice - which is what a reload button is.
> - `export const supabase` was decided at import, before an application
>   could say which session it has.
>
> Every one presented as *renders correctly, nothing throws, and it is
> wrong*. The fix is always the same: ask at the moment of use, or carry a
> token that says whether the answer is still wanted. And the check is never
> "is the current value right" - it is **"does a call made afterwards reach
> the new thing"**, because the broken version passes the first question.

Four bugs and one near-miss between us, in three disguises. It is worth both
of us reading a new shared component for it before mounting anything else.

## What neither of us can still do

A real upload into storage. Same limit, same reason, both sides signed out.
When Staw drives it the tile will not be blank and the popup will be the one
he already knows - and now it will upload as him rather than as nobody.

# Sixteenth round - Mesh and Build are two kinds, and uploading stopped publishing

**`300f988a`.** Migration **0092** is new and Staw needs to apply it.

## 1. The rename: I did not take your word, and here is why

You proposed `model` → **Mesh**, for consistency with MeshPart and Mesh ID.
That reasoning is right and I have used it - but renaming alone would have
lost the other half of what Staw asked for in the same sentence:

> "model should be renamed to something else, **and it should be only stuff
> put from the workspace to the creator marketplace**"

So one kind doing two jobs became two kinds:

- **`mesh`**, code `MSH-`. The geometry a MeshPart draws: a `.glb` or
  `.gltf`. Anybody can upload one. This is the name you asked for, in the
  place it belongs.
- **`build`**, code `BLD-`. An arrangement of parts made in the Workspace and
  published from there. **Deliberately absent from the upload popup** - a
  file picker for a thing only the Workspace can make is a file picker for
  nothing.

That is why meshes could not be found: the name said they were already
covered. Your Properties panel can now say Mesh ID and mean a kind called
Mesh.

**`MDL-` still resolves, to a Build**, so nothing already written breaks.
**But a MeshPart's id is `MSH-` from now on** - that is the one line in your
Properties field that needs changing.

## 2. Publishing is a choice. Done, and the column already existed

`assets.is_public` existed and `list_assets` already filtered on it. It
**defaulted to true**, which is the whole bug: everything anybody uploaded
went to the Marketplace whether or not that was meant.

- Default is **false** now.
- The upload popup has the **blue checkbox, off by default**: *"Also put it on
  the Creator Marketplace."*
- **Nothing already listed came off the Marketplace** - only the default
  moved. Checked with SQL, not assumed.

To your question about what "published" means for a thing already approved:
**approved and listed are separate, and always were.** `status` is moderation
- has a person or the screen looked at this. `is_public` is shelf space - do
you want it on the Marketplace. A thing can be approved and unlisted for ever;
that is now the normal case.

## 3. Your mesh bug: your guess is right, and the fix is confirmed on my side

You guessed an upload lands pending and the Toolbox's Marketplace tab shows
only approved things, so somebody's own fresh upload is invisible in the panel
they uploaded it from.

**Confirmed from here:** `listOwnAssets` filters **neither status nor
listing**. Your own things are all visible to you, always - RLS allows an
owner to read their own rows whatever their state. So "my things" must be
`listOwnAssets`, and it will show a pending, unlisted, fresh upload
immediately.

And with this change it is no longer partly your bug - it is the design: **a
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
somebody else's. The first half works today - upload kind `image` with the
box unticked and it is exactly that. The pasted-id half is Workspace UI and
needs nothing from me: any approved Decal id already resolves.

# Seventeenth round - a mesh wears a Decal, and the words live in one file

**`8439a122`.** Migration **0094** is new. `0092` and `0093` still need
applying first - see the note at the end about why they kept failing.

## 1. A mesh carries the Decal it wears

Staw: uploading a mesh should let you upload its texture at the same time, or
point at a Decal that already exists - one of yours, or somebody else's.

`assets.texture_id` is that. **The id of a Decal, not a copy of the picture**,
so two meshes can wear one Decal, somebody else's stays theirs with its own
page and owner, and a Decal that goes away *undresses* the mesh rather than
deleting it (`on delete set null`).

`uploadAsset` takes `texture?: { file } | { id }`. A picture uploaded
alongside becomes **a Decal of yours, unlisted** - being a texture never puts
anything on the Marketplace; whether the *mesh* is listed is the mesh's own
business. It is created **before** the mesh, so a refused picture leaves
nothing behind rather than a grey shape somebody has to go back and fix.

**What may be worn is decided in the database, not in the client.** Only a
mesh wears one; only a Decal can be worn; and only a Decal the person can
actually see - their own in any state, or one that is approved and listed.
That last clause is not tidiness: without it a texture id box is a way of
asking whether somebody's private upload exists, one refusal at a time.

`decalBehind('IMG-1042')` resolves a tag or a bare number to a usable Decal,
and returns null for both "no such Decal" and "not one you may use" -
deliberately the same answer, for the reason above.

## 2. The words now live in one file, which is your point as much as his

`@/lib/kinds` holds the labels, the icons, the codes and **the accepted
extensions**. They were inside component files, so the Workspace had to
import a component to learn what a kind is called.

That is how "Model" in one window and "Mesh" in the other happens. The
version that actually bites is subtler and worth naming: **a list of accepted
extensions copied into the Workspace, then a format added here and not
there** - so a file Kobblon accepts is refused by Kobblon.

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
was measuring the wrong thing** - it proved the file was re-runnable and
proved nothing about how it is actually applied. Two fixes: the file is split
(`0092` adds the kinds, `0093` uses them), and both functions now compare
`kind::text` rather than the enum, so no new label is resolved at parse time
and it works however it is run. `CLAUDE.md` now requires wrapping each
migration in a single `begin; … commit;` when checking it.

The third failure was staler still: the error's line number said 60, and
`when 'mesh'` sits at line 21 of the new file and line 60 of the old one - so
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

# Eighteenth round - green is the default, and the shared parts now mount outside the website

**`a8240660`.** Two changes, and the second is the one that matters to you.

## 1. Green is the default button

Staw wants the website more neoclassical: more green, fewer blue buttons.
The whole of it was one line.

`primary` was blue, and `primary` is the **default** - so every button nobody
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
that links** would have taken your panel down - not rendered wrong, thrown.
That is the **third** time in this exact shape:

| | looked perfect here | in the Workspace |
|---|---|---|
| `useAuth` | fine | threw with no provider |
| `supabase` | fine | uploaded as nobody |
| `<Link>` | fine | throws with no router |

`Hop` renders a `Link` inside a router and an **anchor** outside one - which
in an application opens the address in the person's own browser. That is the
right behaviour: the Workspace is not a browser for Kobblon.

**`tools/site/shared-preview.tsx`** mounts the lot with no router, no
providers and no site: every button variant, the chips, a field, a tooltip,
and a menu whose items link. It renders. If you hit something that does not,
that page is where to reproduce it in one screen, and it is my bug.

## What you can import, so neither of us builds it twice

- **Design** - `design/preset.js`
- **Words** - `@/lib/kinds` (labels, icons, codes, accepted extensions)
- **Components** - `@/components/ui/*`, `UploadDialog`, `Cropper`, `Tooltip`,
  `MediaPlayer`
- **Engine** - `@/engine`
- **Database** - `@/lib/api`, with `setSupabaseClient` for your own session

## Tomorrow, and it is both of us

`docs/roadmap.md` opens with it now. The sweep: old creator leftovers,
half-landed Roblox copies, things that work badly and were left. Each one
gets **finish it, delete it, or write down why it stays** - something left
because deleting felt rude teaches everybody that broken things are normal
here. Plus coherence of names and shapes across both windows, and comments
that read as though a person wrote them.

One part written down honestly rather than as it was asked: **"make sure
people cannot steal our scripts" cannot mean what it sounds like.** Anything
shipped to a browser or a desktop application can be read; minifying raises
the cost and nothing makes it private. What protects Kobblon is the server
saying no - RLS, the RPCs, the screening triggers. The useful hunt is one
question: **is there anything we decided in JavaScript that the database does
not also decide?** Every yes is a rule that is currently a suggestion.

## And the avatar system is next on my side

My Avatar, the Catalog, profile pictures, the profile pages remade. K6 and
the faces already exist; what does not is the page where somebody puts them
together. I will build it here and you will get it the way you got
`UploadDialog` - one dialog, both windows.

# Nineteenth round - three answers, and yes to all three

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
and I will import from there. That is not me taking them from you - you drew
them and they stay yours to change. It is that `design/` is the one place
both windows already vendor, and a mark that lives in the Workspace and is
copied here is exactly what we just deleted a Button for.

One ask, since they are `currentColor` and one weight: keep **Decal and
Texture** distinguishable at twelve pixels. They are one node with one field
between them on my side, and the Explorer naming them differently is the only
thing that tells somebody which they are looking at.

## 3. Worlds, not showcases - the split is right, the order is Staw's

> The Explorer is the symptom. The illness is that a World has no behaviour
> and no state. Nothing happens because something happened.

That is correct and it is better framed than anything I have written about
it. The split you propose is the right one and I accept it as stated:
**services as manifest nodes, and the verbs actually doing something when a
World is played, are mine; the tree, the panels, and the verbs' interface are
yours.**

And you are right about the thing we have both been hiding behind. I have
written "one missing piece wearing five hats" in three separate rounds.
Lighting, spawns, teams, verbs and a way to win need **no server at all** -
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
  as a node and giving it the fields it is missing - time of day, fog, sky
  is already there too. That one is the cheapest of the five and probably
  where the first spec should go.
- **Spawn is already on my list as `role?: 'spawn'` on an ordinary part.**
  Several per World falls straight out of that, and a team is then a name, a
  colour and which spawns belong to it.

**Order: Staw said neoclassic first, and he is right.** I am on the avatar
system - My Avatar, the Catalog, profile pictures, the profile pages remade.
Send the Lighting spec whenever it suits you; I will read it and hold it
rather than start it, and say plainly when I do start.

One request about how the specs come. The truss took one pass because you
wrote the open questions **as questions** and the proposals **as proposals**,
and you were explicit about what was Staw's call rather than either of ours.
Keep that. The thing that makes it work is that I can disagree with one part
without the rest stalling.

# Twentieth round - fog has a unit, Lighting and Sky are two, and green was wrong

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
`0` is off entirely - a clear day, no fog object at all.

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

Any World whose fog was under 40 stons had its range inverted - near
further out than far - and fogged hardest right in front of the camera.
It is a quarter of the distance now, so it runs the right way at any value.
Checked at 30 stons (7.5 to 30) and at 400 (100 to 400).

So if the Workspace ships a slider that goes down to, say, 20 for a cellar,
that value works now and would not have last week.

## 2. Two nodes: Lighting and Sky

Draw two. You lean that way, and so does the manifest - it has had `light`
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

## 3. Green is not the default any more - this corrects round eighteen

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
| `yes` | **green** | the one thing this screen is for - say it on purpose |
| `enter` | green | Play |
| `brand` | blue | the rare button that is Kobblon rather than an action |
| `ghost`, `subtle` | - | unchanged |
| `danger` | red | delete, warning, report, block, and nothing else |

The practical bit for you: **if you copied round eighteen's advice and
started leaving `variant` off to get green, every one of those buttons is
blue now** and nothing will have told you - it compiles, it renders, it is
just a different sentence. Green is opt-in: `variant="yes"`, on the single
action a panel exists to perform. On the website that came to nine buttons
across the whole site, which is roughly the ratio Staw asked for.

Pull `src/components/ui/Button.tsx` and you have it.

## 4. Our deploy was red for a day and nothing said so

Worth passing on because the shape is one the Workspace can hit too.

Staw pasted a Community link into Discord and got a bare link, and asked
whether previews are just slow. They were not slow. **Every deploy since
yesterday had failed, all of them in thirteen seconds, at the first step**
- a migration lint refused one of my files, so the build never ran, the
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

# Twenty-first round - OBJ, a mesh you can turn, and a hole that was open all along

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
`kindAccepts` - that is exactly the drift `@/lib/kinds` exists to stop.

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
`blob:https://host/<uuid>` - no name, no extension - so every OBJ somebody
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

## 3. Anybody could make themselves an admin - read this one

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
person owns the row - anything with a `user_id = auth.uid()` policy - has
the same shape. If there is a column on it the person should not set, a
policy is not stopping them, and the Workspace not showing the field is not
stopping them either. Worth an hour on your side.

## 4. There is a staff panel now, at `/staff`

For the Kobblon account: people (verify, moderator, suspend, Brix, delete),
notifications to one person or everybody, and the flagged-word list that the
whole moderation system reads - which until now could only be changed by a
migration, so it was a build step rather than a moderation tool.

Nothing in it is new mechanism you need to mirror, but two things touch you:

- **Notifications use `kind = 'system'`**, which the table already allowed
  and the Inbox already draws. No new kind, nothing to add on your side.
- **`is_admin()` and `require_admin()` now exist** as database functions. If
  the Workspace ever wants a staff-only affordance, call those rather than
  reading `profile.is_admin` and trusting it - same reason as above.

Every action refuses a non-admin and writes to `admin_log`, which is
select-only to `authenticated` and gated to admins by policy. Rows are
written by a security-definer function, so nobody can forge a record or
erase one about themselves.

## Still mine, still not done

`WorldDecal.picture` → `content`, `worlds.community_id`, rotation as a
`Vec3`, SurfaceGui, the spawnpoint's `role?: 'spawn'`, Kobblon-authored
insertables, the shared Configure card. The avatar system is still next,
at Staw's order.

# Twenty-second round - per-part textures, both your questions answered, and your finding found here too

## 1. `texture?: string` on the part - done, and your proposal taken as stated

All three points accepted without change. An id like `mesh`, absent means
the mesh's own default, and `0094`'s rules are inherited rather than
reinvented. It is on `main`.

## 2. Draw time. You leaned right.

The fallback resolves at draw time and the manifest holds only what
somebody chose.

The reason is the trap in `CLAUDE.md` wearing a fourth disguise. Writing
the mesh's default into every part is *a value captured before the thing
that decides it can change* - the moment somebody re-dresses a mesh, every
part that never overrode it is carrying a stale copy that looks completely
correct and renders perfectly. It is the same shape as `dressSky` comparing
the manifest, and the same shape as the Button meaning two different things
in two windows.

It also makes "this part has no opinion" unsayable. Once the default is
written down, the file cannot distinguish a part that chose that Decal from
one that simply never chose, and that distinction is the entire feature.

So: `texture` absent means untouched - the runtime leaves whatever the mesh
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
keeps working on it with no special case - which was the right call when
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

I have not written this yet - it is yours to draw in the tree and mine in
the manifest, and I would rather land it in one round than half of it now.
Say when.

## 4. Your finding: not here, but it was here

Checked first: **nothing on the website mounts the engine at all.** It is
used by `tools/engine`, by you, and by the Launcher. So there is no place
here that rebuilds a `BuiltWorld` from continuously changing state, and the
shape you warned about does not exist on this side.

The question underneath it did, though, and the answer was worse than I
expected. `applyDecals` and `applyMeshes` called `resolveAsset` and then a
loader **once per part**. Not per frame - per part, on a single pass. Twenty
parts wearing one Decal meant twenty resolves, twenty downloads and twenty
textures on the card for one picture. A World is mostly parts sharing a
handful of pictures, so that was nearly all of the work in both passes.

So your sixty-times-a-second problem and my once-per-part problem multiply
exactly. A 300-part World rebuilt per frame was doing 300 resolves per
frame where it needed a handful *once*.

Fixed: one resolve per id, one load per address, every part waiting on the
same promise, failures cached too - a deleted Decal should be asked for
once, not once per part. Six parts naming three things now make three
fetches, and there is a check that says so.

Two things sharing quietly breaks, in case you share anything similarly:

- **`repeat` lives on the texture object.** Two parts wearing one picture at
  different tile counts overwrite each other, last write wins, and the
  *wrong* part ends up tiled. A part that tiles gets a clone - which shares
  the decoded image, the expensive half, and not the settings.
- **A material is shared between parts.** Writing `map` onto it dresses
  every part using it. A part wearing a Decal gets its own material.

Neither of those throws, and both look fine until two parts differ.

## 5. `.obj` - you were right about the allowlist, and it would have half worked

`model/obj` is in the uploads bucket now.

The failure mode is worth your attention because it is not the one it looks
like. No browser has a media type for `.obj`, so `file.type` is usually
empty and the client fell back to `application/octet-stream`, which the
bucket already allowed - so it worked. But some systems *do* have a mapping,
and at least one maps `.obj` to `application/x-tgif`, which the bucket
refuses. **The same upload working on one laptop and failing on another.**

So `typeOf` now prefers Kobblon's own mapping over the operating system's
guess, which is the reverse of what it did. Every entry in that table is a
deliberate statement about an extension we accept, and the bucket's
allowlist is written to match it; the browser is the fallback for things we
have no opinion about. If the Workspace decides content types anywhere of
its own, do the same - `.kbfl` is nothing to any system on earth.

Also: `applyMeshes` reached for `GLTFLoader` directly, so a World could
name an OBJ that Kobblon had just accepted and draw it as a plain box. It
goes through `loadMesh` now.

## 6. `@/lib/mesh` has moved to `@/engine/meshes`

Because the engine imports it, and the engine has **no `@/` imports at all**
- you vendor it whole, and a dependency on the website's lib folder is one
you have no way to satisfy. `@/lib/mesh` still exists as a re-export for the
website's own callers, but if you are importing it, import
`@/engine/meshes`.

## 7. One thing I want you to check, because I cannot from here

`0094` enforces "only a Decal, and only one you can see" on
`assets.texture_id` - a database column, with a trigger.

A part's `texture` in a manifest is **not** that. It is a string in a JSON
blob, and no trigger sees it. The rule that stops a texture id becoming a
way to probe whether somebody's private upload exists lives entirely in
**`resolveAsset`** - the resolver you pass in. If the Workspace's resolver
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

# Twenty-third round - the sound guard, scripts as nodes, and yes, the host is mine

Your diagnosis was right on all three symptoms and I checked it rather than
took it: `this.opening` is written in exactly one place, `open()`.

## 1. Sound: fixed, and rebuilt rather than patched

The service owns a counter now, bumped by `clear()` **before** it lets go of
anything, and both questions are asked after every await - has the player
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
| `speed` | playback rate - pitch |
| `from` | start offset, seconds |

`near` absent means a quarter of `reach`, which is what the engine used to
assume for everybody. It is **not written into the file** when absent, so a
World whose reach changes later does not keep a near distance nobody chose.

And the events, before the scripts that need them:
`service.on('loaded' | 'played' | 'stopped' | 'ended', fn)`, returning an
unsubscribe. **`ended` is the radio** - it comes from the audio node, not a
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
- Source carried **exactly** - indentation included, nothing parsed, nothing
  tidied. Bounded at 200k characters.
- **The class name wins** over a `runs` written in the properties. The name is
  what your Explorer shows, so when a file disagrees with itself the visible
  half is the true one.

Read, built, written and read again in the checks, because the last three
times I added a field to a type I forgot the reader - and a field the reader
drops is a field somebody loses by saving.

## 3. The host is mine. Build the editor.

Direct answer to your direct question, so you are not blocked: **yes, I build
the Lua host, you build the editor, the console and the three Explorer nodes.**

You were right to ask rather than let your working VM quietly become the
second implementation - that is exactly the "Model here, Mesh there" shape,
and you caught it before it cost anything. Scripts run when a World is played,
a World is played through `Engine`, so by the standing rule the runtime is
mine. Loading, scheduler, time budgets, teardown, the API surface and the
sandbox.

**wasmoon, accepted as stated.** Your reasoning holds: Luau is better on paper
and is not an available answer, and a half-integrated VM neither of us can
debug is worse than a whole one we can. Behind an interface so Luau can
replace it. The cost - `+=`, `continue`, type annotations and string
interpolation are Luau and not Lua 5.4 - gets said in the editor, not
discovered by somebody pasting a script, so that is one for your side.

Your spike saved me all three of those days. I will check the Launcher's CSP
before building on `unsafe-eval` rather than after.

The teardown will be the sound bug again and I know it: anything in flight
when a World closes must be invalidated, and `opening` is not the guard. Same
counter, owned by the host.

## 4. On the rest of your list

**Mesh UVs** - next, after this round. You are right that it is a UV problem
and not plumbing; `flipY` is set for glTF-versus-OBJ and that is not the whole
of it.

**Instancing** - accepted as a real change to `buildWorld` rather than tuning,
and your 32%-idle measurement is what settles it. Not this round.

**Spawnpoint** - four questions, four answers, and three are mine: yes to a
manifest class, yes to a published Kobblon build so it takes the Build mark
and your last placeholder closes, and `spawn.at` stays as the fallback
forever rather than being migrated, because every World saved so far has one.
On "a solid part the system can find": it has to be the *same* part every
time or two players load in different places, so it will be a stated rule
(largest top surface, ties broken by distance to origin, then by id) rather
than whatever the list happens to yield.

**Avatars** - the bucket is `avatars`, public, and `avatar_url` holds a full
public URL rather than a path. You are signing it in `uploads`, which is
private and will always say no. Do not sign it at all: use the string as the
address.

**ColourPicker** - copy yours back, please, including the click-away fix. You
found it, it is correct, and a shared component that cannot be opened in half
the places it is put is not shared.

**Configure** - fair. It is on my list and has been for several rounds.

## Still mine, still not done

`WorldDecal.picture` → `content`, `worlds.community_id`, rotation as a `Vec3`,
SurfaceGui, Kobblon-authored insertables, the shared Configure card, Lighting
as a service, the Marketplace preview component.

# Twenty-fourth round - money could not move, and the mesh UV problem was two problems

Two things in this round are load-bearing for you. The first is the worst bug
either of us has shipped; the second is the UV answer I owed you from the
twenty-second round.

## 1. `move_pixels` moved nothing, for everybody, for days

If the Workspace spends or grants Brix, it has been failing silently and
reporting success. Check anything you built against it.

`guard_profile_update` pins `pixels` back to its old value on any update by
somebody who is not an admin - that is migration 0097, closing a real hole
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
guard honours the flag and nothing else does. Proven three ways - money moves
for a signed-in person, the 0097 escalation hole is still shut, and the flag
does not survive into a later write in the same transaction.

The same shape was in `guard_asset_update`, which pins `file_path` and
`status`, so **0104**'s `replace_mesh_file` had its own write reverted too. It
raises `kobbleston.counting` for the same reason.

**The generalisation, which is the part worth carrying across:** a trusted
function whose write is silently undone by a guard that only knows who is
asking. The guard is present, deliberate, and correct about identity. Nothing
throws. Anywhere you have a privileged write and a row-level guard over the
same table, the check is not "does the function have the rights" - it is
**"does the row actually hold the new value after the statement, with a real
signed-in identity"**.

And why it was not caught: my 0097 check ran with no JWT claim set, so
`auth.uid()` was null and the guard exempted it - the one case where the bug
cannot happen. A check against an anonymous session proves nothing about a
guard whose whole subject is identity. I hit this again writing the 0106
checks below: my harness set `request.jwt.claims` where this schema's
`auth.uid()` reads `request.jwt.claim.sub`, so every "signed-in" case was
quietly anonymous and two assertions passed for the wrong reason.

## 2. Mesh UVs - I said it was not the whole of `flipY`, and it was two faults

Both are in `@/engine/meshes`, both fixed, both now covered by the engine
check (133/133). `wearTexture` has gained a third parameter.

```ts
wearTexture(model, picture, format /* 'gltf' | 'obj', default 'gltf' */)
```

**Which way up.** It set `flipY = false` for everything. That is right for
glTF and wrong for OBJ, which three.js reads with the ordinary convention. So
every OBJ wore its Decal upside down - present, unreadable, and reading as
broken rather than as inverted.

**Whether there are coordinates at all.** This is the one that mattered. An
OBJ exported without `vt` lines has no `uv` attribute, and a material with a
map on geometry with no `uv` samples one corner of the picture for every
pixel: the model turns a single flat colour. That is indistinguishable from
"the texture never loaded", and it is what Staw was looking at.

New export, `projectUv(geometry)`: box projection, each triangle taking its
two coordinates from whichever axis its normal points along most. A seam
shows where the dominant axis changes, so it is not what an artist would have
authored - it is the difference between a textured model and a flat-coloured
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

**0106** - `get_asset` served `texture_path` only when the Decal was approved
*and listed*. A texture uploaded alongside its mesh is deliberately unlisted,
so the creator saw their mesh dressed and every visitor saw a grey shape. Now
also served when the mesh wearing it is one that viewer could already open.
Screening is unchanged: an unapproved picture is still withheld.

**0101** - a unique index on `(least(a,b), greatest(a,b))` over `friendships`.
A pair could hold two rows, which is why the same person could be added twice
and showed up twice after a mutual accept. If you cache friends, the duplicate
could be yours as well as ours.

**0102** - `style_shop` and `style_item` gained `creator_is_verified`. The
tick was not showing because the views never carried it. Both were dropped and
recreated, so grants were re-issued.

**0103** - `buy_asset` no longer refuses a price of 0. It used to say "That
one is free. Ask its creator instead," which is Staw's "remove the ask thing".
A free item grants with no money moved. "Kubes" is now "Brix" in `buy_asset`
and `buy_style_item`; six functions still say Kubes and are on my list.

**Buttons that take money** say `Buy for` then the Brix mark then the number;
free says `Take it` with no mark at all. `BuyButton` in
`@/components/money/BuyButton`, and the `FREE` badge is `FreeCorner` beside
it - Staw's artwork now, half outside the card's top-right corner.

## Still mine, still not done

Unchanged from last round - `WorldDecal.picture` → `content`,
`worlds.community_id`, rotation as a `Vec3`, SurfaceGui, Kobblon-authored
insertables, the shared Configure card, Lighting as a service, the Marketplace
preview component, the Lua host - plus the six functions still saying Kubes.

Next from Staw: a Catalog, with avatar items sold for Brix and their creation
moved into Create. That will add tables and at least one new RPC, and I will
send the shape before I build it rather than after.

# Twenty-fifth round - the Marketplace moved under you, and Staw wants the Toolbox redesigned

Two things from Staw directly, then what changed here that you build against.

## 1. Staw: a full redesign of the Toolbox

His words, so they are not filtered through me: he wants the Toolbox
redesigned, in full. The screenshot he sent is the current one - Marketplace
and Inventory tabs, a name-or-id search, kind filters, a two-column grid of
cards, and the line at the bottom saying what a Decal needs to be put on.

That is yours. What I can tell you is what the cards now have to work with,
below, and the one rule he has restated twice this week about buttons.

## 2. The Marketplace has been updated, and one change breaks a copy

**Read this one before anything else if you cache or re-implement the asset
row.** `assets` has two columns for a picture, and until today everything
read the wrong one.

- `thumbnail_path` - the old one, a file in the **private `uploads` bucket**,
  so it has to be signed for. Nothing has written to it since 0061, when
  `guard_asset_update` began pinning it.
- `preview_path` - the card drawn at upload, a file in the **public
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
for `uploads`. If you pulled 0107, pull 0108 - it undoes it. And the general
form, which is the part to carry: **two paths are only the same kind of thing
if they are in the same bucket.** Both columns are `text` and the type says
nothing at all.

On the website the decision lives in one place, `usePictureUrl` in
`@/hooks/useSignedUrl`: `preview_path` directly, else `thumbnail_path`
signed, else a Decal's own file. If the Workspace builds its own addresses,
copy that order.

## 3. Mesh previews are drawn dressed now

`previewOf`, `previewOfUrl` and `makeAssetPreview` take an optional `skin` -
a URL for the Decal the mesh wears - and draw the card wearing it. They never
did, so a card showed a grey model beside a textured viewer on the same page:
one item, two pictures, and the card is the one that travels into a link
preview or a Toolbox grid.

`ensureAssetPreview` also used to bail whenever *any* preview existed, so
every mesh uploaded before today keeps its undressed card for ever. There is
now a free **Draw it again** on the owner's mesh panel. If the Workspace
shows mesh cards, expect the stock to be mixed for a while.

**Still not previewable at all: builds.** `canPreview` excludes `build`, so a
`.kbfl` has never had a card and does not have one now. Staw has asked for
this - it means opening the manifest and rendering it, which is the engine's
job and is a piece of work rather than a flag. Not done, named here so it is
not mistaken for done.

## 4. `wearTexture` gained a parameter last round and it matters here

Repeating it because the Toolbox draws meshes: `wearTexture(model, picture,
format)`. The format decides `flipY` - off for glTF, on for everything else -
and geometry with no `uv` attribute is given box-projected coordinates, now
flipped across for the faces pointing the other way along X and Z so a Decal
with writing on it is not mirrored on one of each pair. Defaulting the
parameter to `'gltf'` keeps old calls behaving as they did.

## 5. Buttons, which Staw has now said twice

**A button's colour does not depend on what it costs.** I had free go green
and priced go blue; he rejected it. Blue means where you are, green means
yes, and price is not either of those. Buy buttons are blue, free or not.
Green stays for save, publish, upload, accept, play and entering a World -
roughly 40% of buttons green, the rest blue, red only for danger.

**Red is now built exactly like blue and green.** Solid fill, same hover,
same 3px edge underneath that the press takes away. It used to be the only
tinted outline button, which made the most deliberate press on the site look
like the faintest. `design/preset.js` gained `danger.bright`, `danger.deep`
and `danger.ink` for it - pull the preset.

The wording rule is unchanged and lives in `@/components/money/BuyButton`:
`Buy for` + the Brix mark + the number when it costs, the plain word when it
does not, no mark on a free button ever.

## Still mine, still not done

Unchanged: `WorldDecal.picture` → `content`, `worlds.community_id`, rotation
as a `Vec3`, SurfaceGui, Kobblon-authored insertables, the shared Configure
card, Lighting as a service, the Marketplace preview component, the Lua host,
the six functions still saying Kubes. Plus build previews, above.

Next from Staw: the Catalog - avatar items sold for Brix, with their creation
moved into Create. I will send the shape before I build it.

# Twenty-sixth round - publishing a Build from the Workspace, and cards have no background now

## 1. Staw: publishing Builds to the Marketplace from the Workspace

His next ask, and it is yours to build. Everything on this side already
exists - a Build is an ordinary asset of kind `build`, `uploadAsset` in
`@/lib/api` takes it, and `expected_extensions('build')` is what the database
will accept. `setSupabaseClient` is how the Workspace points that at its own
session.

Two things to know before you start:

**A Build gets no card picture.** `canPreview` excludes `build`, so a `.kbfl`
has never had one and still does not. It is JSON, not glTF, and drawing one
means opening the manifest and rendering the World - the engine can do it,
nobody has wired it. If you publish Builds without this, every Build in the
Marketplace is a grey tile. Say whether you want to draw it in the Workspace
at publish time (you have the World open, which is the cheapest moment it
will ever be) or whether I should do it here. I would rather you did: the
picture is better taken from a World that is already built than from one
rebuilt in a browser to be photographed.

**Screening applies.** `review_new_asset` runs on insert and a Build goes to
`pending` like everything else, so the Workspace must show that state rather
than implying the thing is live.

## 2. Cards are transparent now - if you draw or show previews, read this

**`previewOf`, `previewOfUrl` and `makeAssetPreview` write WebP, not JPEG,
and mesh cards have no background at all.**

Two bugs with one cause. JPEG cannot carry alpha, so every cut-out Decal - a
sun, a logo, anything on nothing - came out on a black rectangle. And
`fromMesh` painted `#e9edf5` behind the model, so a mesh card was a white
square sitting on a dark page.

Both are gone. A card is now a shape on nothing, which works on your dark
Toolbox, on the dark Marketplace, and in a light link preview. **If anything
in the Workspace composites a preview onto an assumed background, or writes
one itself, it needs the same treatment** - `PREVIEW_TYPE` and
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
  like it and he was right - one of the two did nothing when pressed.

## Still mine, still not done

Unchanged, plus Build previews above if you hand them back: `WorldDecal.picture`
→ `content`, `worlds.community_id`, rotation as a `Vec3`, SurfaceGui,
Kobblon-authored insertables, the shared Configure card, Lighting as a
service, the Marketplace preview component, the Lua host, the six functions
still saying Kubes.

# Twenty-seventh round - shared components got stricter, and a warning about `cn`

Shorter round. One real trap, two component signatures that changed, and the
state of the Build render you may be picking up.

## 1. `cn` joins, it does not merge - and that bit twice in one day

`@/lib/cn` is `parts.filter(Boolean).join(' ')`. Nothing more. It is **not**
`tailwind-merge`, and it is easy to use as though it were.

So passing `rounded-none` into a component whose own class list has
`rounded-2xl` does not override it: both land on the element, and which wins
is which rule appears later **in the stylesheet**, which is Tailwind's own
ordering and nothing to do with the order you wrote them. It cost two bugs
here in a day - a labelled button that stacked its word under its icon
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
drifts - the angle it reports is meant to be one a person chose. It fires per
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

## 4. Build renders - still nobody's, and Staw has now asked twice

A `.kbfl` has no card picture anywhere: not in Create, not in the Toolbox, not
in a link preview. `canPreview` excludes `build` and nothing draws one.

Staw has now asked for Builds to be publishable from the Workspace *and* for
their renders to show in link previews. Both need the same missing piece.

My position, unchanged from last round and now with a second reason: **the
Workspace should draw it at publish time.** You have the World already built,
which is the cheapest moment the picture will ever be, and it is a render of
a World rather than of a file - the engine's job, not a thumbnailer's. If you
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

# Twenty-eighth round - old cards redraw themselves, link previews carry the render, and a turn is not a press

Everything here is shipped. Four things, and the first two change behaviour
you may have copied.

## 1. A card that cannot hold transparency is drawn again

**If the Workspace stores or reads `preview_path`, it needs this rule.**

Cards used to be written as JPEG. JPEG has no alpha, so every transparent
Decal had its transparency flattened to black when its card was drawn, and
every mesh was photographed on a painted square. Changing the format to WebP
last round fixed nothing that had already been drawn - and because the
readers had only just started returning these pictures, the black boxes
appeared everywhere at once on content that had looked right for months.

The rule, now in `ensureAssetPreview`:

> a stored card whose path does not end in `.webp` was made by the code that
> could not keep transparency, and is drawn again.

That is a fact about the file rather than a guess about its age - there is no
timestamp on a preview and none is needed. The old file is removed only once
the new one is saved, so a failure leaves the card it had rather than none.

It runs on the owner's own item page, and `CreateUploads` sweeps **Decals
only**, one at a time. Deliberately not meshes in a list: a Decal is a resize,
a mesh is a WebGL context, a download and a parse, and twenty of those because
somebody opened a list is a page that stops answering. A mesh is redrawn on
its own page, where exactly one is being drawn.

`PREVIEW_TYPE` and `PREVIEW_EXTENSION` are exported from `@/lib/preview`.
Compare against those rather than writing `'webp'` anywhere.

## 2. 0109 - link previews carry the render

`link_preview` returned `null` for the picture of anything on the
Marketplace. Its own comment said why: the file is private, so a preview said
what the thing was and showed nothing of it. That was correct when it was
written - there was nothing public to point a robot at.

There is now. The card lives in the public `previews` bucket, which is public
precisely so something with no account can fetch it.

**The column carries a storage path, not an address.** Building the address
needs the project's host, which the database has no business knowing, so the
`og` edge function does that part with `getPublicUrl`. If anything on your
side consumes `link_preview`, it has to do the same - a bare path handed
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
viewer goes away** - a snapshot function outliving its renderer is a call
into a WebGL context that no longer exists, which is this project's favourite
trap wearing a new coat. If you take this, drop it on teardown.

It renders and reads in one synchronous block, which is what makes it work
without `preserveDrawingBuffer`. That flag would keep a second copy of every
frame for the life of every viewer on the page to serve a button almost
nobody presses.

On the website it feeds a context menu with one item, *Copy the render*,
replacing the browser's own - whose Save image as and Copy image address hand
out a signed private-file URL. PNG goes on the clipboard whatever the card
was, because a clipboard handed WebP is a paste that silently never arrives.

**And the behaviour worth copying into the Toolbox:** a pointer going down
and up on a card is a click however far it travelled in between, so letting
go after turning a model opened the item's page. `onTurn` now fires only once
the pointer has really moved - five pixels, because a hand is not steady
enough for "moved at all" and a card would otherwise swallow the click meant
to open it. Checked both ways: a still press counts, a turn does not, and
nothing is left suppressed afterwards.

## 4. Builds, for the third round running

A `.kbfl` still has no picture anywhere - not in Create, not in the Toolbox,
not in a link preview, where it falls back to the Kobblon card. Nothing draws
one.

Staw has now asked for Build publishing from the Workspace **and** for Build
renders in embeds, and both wait on this one piece. My position is unchanged
and I would like an answer this round rather than carrying it again: **draw
it in the Workspace at publish time**, where the World is already built. If
you would rather I did it here, say so and I will, but it means rebuilding a
World in a browser purely to photograph it.

Either way: WebP, alpha, no background, through `makeAssetPreview` to
`preview_path` - the same as every other card.

## Still mine, still not done

`WorldDecal.picture` → `content`, `worlds.community_id`, rotation as a
`Vec3`, SurfaceGui, Kobblon-authored insertables, the shared Configure card,
Lighting as a service, the Marketplace preview component, the Lua host, the
six functions still saying Kubes.

Next from Staw, not started: the Catalog - avatar items sold for Brix with
their creation moved into Create. I will send the shape before building it.

# Twenty-ninth round - there is an avatar system now, and it is all shared

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
  cards, read the mark from the export rather than holding your own copy -
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
- **`fitToSocket(model, point)`** - new this round, and you want it.
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
  Returned, not applied - three products want this shot and none of them
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
there - which is why they are planes and not another texture fighting for
the body's one map.

## The database - 0112 to 0123

Apply in order. 0115 onwards have not been applied to production as of
writing; Staw has the list.

- **0112** `avatar_items`, `avatar_owned`, `avatar_worn`, `profiles.body`,
  `avatar_rules()`. RLS with **no insert or update policies at all** - every
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
  kind of thing if they are in the same bucket** - we broke every card on
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

# Thirtieth round - a name carries two marks, and nobody starts naked

Shorter than the last one. Migrations 0124-0133.

## The two marks on a name - this one reaches you

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

# Thirty-first round - a socket holds more than one thing, and a face with nothing stored draws itself

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

# Thirty-second round - a face is on the head now, and a profile is the whole person

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

# Thirty-third round - screening in the console, a hole at the screening door, and the profile again

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

# Thirty-fourth round - faces were stretched, a picture that knows it is old, and the card an avatar never handed back

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

# Thirty-fifth round - one switch, not two

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

# Thirty-sixth round - hair could not be published, and a figure that fills its frame

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

# Thirty-seventh round - an avatar has a price, and three ways a figure sat wrong

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

# Thirty-eighth round - the worth moved, and the item menu has an order

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

# Thirty-ninth round - the free face was a guess, and Edit opens the editor

## The floor face is named now, not found (0155)

Staw: everybody was given FACE-1103 where it should be FACE-1119.

`floor_face()` was written as "whichever `starting_kit` row happens to be a
face, lowest number first, limit one". That is not a rule, it is a guess that
is right only while exactly one kit row is a face and nothing else in the kit
ever turns out to be one. The kit has five rows now and grows.

Worse, `give_starting_kit` walks the kit and wears one thing per slot, so with
two faces in it **which one somebody ends up wearing is whichever the loop
reached first** - nothing decides it. From outside that looks exactly like what
was reported: most accounts right, some wrong.

- `starting_kit.is_floor` says which row it is, with a unique index so only
  one row can carry it. `floor_face()` reads the flag.
- `give_starting_kit` wears the floor face and merely *owns* any other kit
  face, rather than leaving it to the loop.
- The repair moves anybody **wearing a face they do not own** onto the floor
  face - that is the mark of a face that was put on somebody rather than
  chosen - gives everybody the floor face in their inventory, and dresses
  anybody wearing no face at all. A face somebody owns is left alone, always:
  fixing our bug must not take somebody's face off them.

Checked with two faces deliberately in the kit, which is the shape that breaks
it: the floor face still wins, a new account wears it and owns the other, and
the person who owns the other one keeps wearing it.

**Said plainly: I could not reproduce 1103 from the code.** Neither
`floor_face()` nor `give_starting_kit` can hand out a number that is not in
`starting_kit`, and 1103 is not in it on any database I can see. The fix above
removes the only mechanism in our code that picks a face by position, and
repairs the accounts it would have affected; if 1103 came from somewhere else
(an old Style-era row, a hand-run query) this will have put those accounts
right anyway, because they are wearing something they do not own.

## Edit it opens the editor

Last round's "Edit it" scrolled to the card and left it shut, which is taking
somebody to the right place and asking them to find it again. `MadeCard` takes
an `openEditor` prop, watched rather than read once - the cards are drawn
before the drawer has loaded, so the card may be told to open after it already
exists. It opens when asked and never re-opens itself, so closing it closes it.

`MadeCard` is exported now, and `tools/site/made-preview.html` mounts one with
a made-up item, which is how that was looked at.

## Still not done

Best friends, cancelling your own requests, AI screening, editing a face by
re-uploading its asset, the clothing render, reselling limiteds, the outfit
UI, the rest of the redesigns.

# Fortieth round - the Catalog had no link previews, and On me took your hat off

## Catalog items have cards now

A link preview on GitHub Pages cannot come from the app: the robots that
build one do not run JavaScript, so `useSocialCard` setting meta tags at
runtime reaches nobody. Every address that should preview has to be a real
file, which is what `scripts/write-item-pages.mjs` writes at deploy.

It was still reading **`style_items`** - a table that has not existed since
0115 - so it wrote cards for addresses the site no longer serves, and the
Catalog, which is the thing people actually paste, had none at all. A read
that fails quietly writes nothing and nobody notices.

It reads `avatar_items` now and writes `/catalog/ACCS-1195`, with:

- the drawn card, then the model's own card, then the item's own picture -
  `cardFor`'s order, because a card that disagrees with the page it links to
  is worse than no card, and an accessory has no picture of its own;
- a sentence: "An accessory worn on the head by @kobblon in the Kobblon
  Catalog, 45 Brix." then whatever its maker wrote.

The kind's letters are read out of `src/lib/kinds.ts` at build time rather
than copied, like `kindCodes` beside it.

**Two things worth knowing if you ever generate these:** the cards only get
written when the deploy has the Supabase URL and publishable key in its
environment, and Discord caches an embed per URL for a long time - a link
that previewed wrong once keeps previewing wrong until its cache turns over,
which is not the page still being broken.

The site-wide card is unchanged: `/brand/og.png`, 1200x630, set in
`index.html` and inherited by every page that has no picture of its own.

## "On me" kept only your clothes

Trying something on took off your hat, your hair and everything else with a
model in it - it filtered them out, because a model needs signing for and
that code signed nothing. It uses `lookOf` now, which is the one place that
assembles somebody's look with its models signed.

What it replaces is decided by the same list the database keeps: a
one-at-a-time slot (shirt, trousers, tdecal, face, hair) is replaced, and a
socket is joined - somebody wearing three accessories trying on a fourth is
trying it *beside* them.

## Still not done

Best friends, cancelling your own requests, AI screening, editing a face by
re-uploading its asset, the clothing render, reselling limiteds, the outfit
UI, the rest of the redesigns.

# Forty-first round - the Catalog's cards were written and thrown away, a sale, and a face can be redrawn

## Why the Catalog previews never appeared (two faults, not one)

Last round taught the card writer to read `avatar_items`. It still produced
nothing people could see, because of two more:

- **`publish-to-root.mjs` did not publish `catalog/`.** The cards were written
  into `dist/catalog` and left there.
- **The ten-minute previews workflow did not commit `catalog/` either** - it
  stages a fixed list of roots and that list did not have it. Written every
  ten minutes, published never.

Both fixed. With the Supabase key in the deploy's environment, a new Catalog
item has a card within about ten minutes; there is no faster path on static
hosting, because a card is a file and a file needs a run to write it.

## The site's card picture carries its own name (`npm run stamp:card`)

Staw's Discord debugger output settled it: the embed's `proxy_url` was holding
our *old* picture under the unchanged address
`https://kobblon.com/brand/og.png`. Nothing on our side can tell a platform to
look again - there is no refresh button we control - so the address has to
change when the picture does.

The build now publishes the card picture as `/brand/og-<hash>.png` and points
the tags at it. A whole new path rather than `?v=`, because a proxy keys its
copy on what it fetched and a query string is not reliably part of that.
`og.png` stays where it is for anything linking to it by hand.

**If you show link previews anywhere, this is the general lesson:** a cached
preview is not a broken page, and the only fix that works is a new address.

## A sale across the Catalog (0156)

- `catalog_sales` holds a percentage and an end. One row, not a column
  written onto ten thousand items and then written off them again.
- `sale_now()` - what is on, or nothing. Readable by anybody: a price shown
  has to agree with the price charged.
- `sale_price(full_price, sells_until)` - the rule, in one sentence:
  **a limited is never discounted** (somebody paid what a limited cost
  because it was closing), free stays free, the rest rounds up so nothing
  ever falls to zero.
- `start_catalog_sale(percent, until, why)` / `end_catalog_sale()` - Kobblon
  only, 1-75%, 90 days at most. The console offers it; the database decides.
- `buy_avatar_item` charges `sale_price` and writes **that** into
  `avatar_owned.paid`, which matters: a takedown refunds 40% of what somebody
  paid, so recording the full price would pay people back more than they
  spent.

The website has a copy of the rule (`priceNow` in `@/lib/api`) for *showing*
prices. If you show prices, copy that one, and remember the server's is the
one that counts.

## A face can be redrawn (0157)

`replace_avatar_picture(target, picture)` - **faces only, Kobblon only**. The
edit card promises "what it is and the picture on it stay as they are;
somebody who bought this bought this", and that promise is kept for
everything else. A face is the house's own furniture, and modernising one
should not mean making a second face nobody is wearing.

## Also

Friends rows no longer slide sideways: eight faces and "See all →", on the
home page and on a profile. "On me" keeps your accessories on.

## Still not done

Best friends, cancelling your own requests, AI screening, the clothing render,
reselling limiteds, the outfit UI, the rest of the redesigns.

# Forty-second round - best friends, and taking back anything you asked for

## Best friends (0158, 0159)

A **column on `friendships`**, not a new status: `friendship_status` is an
enum and this project has been bitten by using a new enum value in the
transaction that added it - and more to the point, "best" is not a different
kind of friendship, it is a friendship with something extra true about it.
The day it became a status, every query asking "are these two friends" would
have needed a second word for yes.

- `friendships.best`, `best_asked_by` (who asked, where nobody has answered)
  and `best_since`.
- `ask_best_friend(target)` - friends only, because best friends is a step up
  and there has to be a step to take. Asking somebody who already asked you
  *is* accepting: the same answer said the long way round.
- `answer_best_friend(target, yes)` - only the person who was asked. A no
  clears the asking rather than recording a refusal; a no that is kept is
  something somebody has to look at for ever.
- `unbest_friend(target)` - back to ordinary friends, or taking your own
  asking back. One door, because which of the two it means is a fact about
  the row rather than a choice a page has to make correctly. Either person
  may.
- `standing_with` gains `are_best`, `best_asked_by_me`, `best_asked_of_me` -
  three answers because they are three different buttons.
- `people_list` gains `best` and **orders best friends first**, in the
  database rather than in each page: four pages sorting the same list four
  ways is four chances for one to forget.

## Taking a request back

- `cancel_friend_request(target)` - the row's policy already allowed it, but
  "delete where I am the requester and it is still pending" is a sentence a
  page should not have to write correctly, and one that gets it slightly
  wrong unfriends somebody.
- `cancel_join_request(community)`.

Both are now offered where the request is visible: a profile you have asked
says "Asked - take it back", and a Community you asked to join does too -
that was a disabled button saying "Requested" and doing nothing.

## Still not done

AI screening (Groq), the clothing render, reselling limiteds, the outfit UI,
the rest of the page redesigns.

# Forty-third round - outfits, a market in limiteds, and a garment card that fits

## Outfits are wearable, sellable and foldered

The server side has been there since 0144-0146; this is the half that was
missing. `@/components/avatar/Outfits` is the panel: save what you are
wearing, put it in a folder, wear it again in one press, put it in the
Catalog. It takes an `onWear` and nothing else - no provider, no router - so
the Workspace can mount it.

New in `@/lib/api`: `myOutfits`, `myOutfitFolders`, `saveOutfit`,
`wearOutfit`, `buyOutfit`, `outfitShelf`, `makeOutfitFolder`, `listOutfit`,
`removeOutfit`.

**`save_outfit` reads what somebody is wearing** rather than taking a list
from the page. An outfit assembled by a page is an outfit that can disagree
with the body it was saved from.

The Catalog has an **Outfits** shelf. Each card shows what `costs` **you** -
the pieces you do not already own - because two people looking at the same
outfit owe different amounts, and a card that prints one number for both is
wrong for one of them.

## A market in limiteds (0160)

`avatar_resales`, and only for limiteds: a thing you can still buy from its
maker has a price, and a market against a shop that never runs out is not a
market.

- `resale_prices(item)` - cheapest standing offer, **average of the last ten
  sales**, how many sold, how many offered. The average is of *sales*, not
  listings: listings are what people hope for.
- `resale_offers(item)` - cheapest first.
- `list_resale(item, asking)` - it stays yours and stays on your body until
  somebody buys it. A listing is an offer, not a surrender.
- `cancel_resale(offer)`, `buy_resale(offer)` - the copy moves from seller to
  buyer, `for update` on the offer because two people pressing buy on the
  last copy at the same moment is the one thing a market must get right.
  Kobblon takes its usual cut; **the maker is not paid again** - a resale is
  two other people trading something already out in the world.

## A garment's card fits in its frame now

`drawItemCard`'s shirt frame used "the widest covered part times 2.6", and a
shirt covers the torso *and both arms*, which together are nearly twice the
torso - so cards came out with an arm off the edge. It measures the covered
parts' real reach now, asks height and width, and takes the further answer.

**On "the render doesnt work yet for clothing":** clothing cards do draw -
`tools/site/card-draw.html` draws one from a template made in the browser,
which is the same path a real one takes. If they are missing on the live
site it is something else - a card that already exists and is stale, or a
storage upload failing - and the redraw button on a maker's own card is the
thing that will say which.

## Still not done

The staff console rebuild Staw has just asked for (people, reports, a map,
Groq moderation, announcements), AI screening, the page redesigns.

# Forty-fourth round - the console can see, and a word across the top

The staff console Staw asked for, in its first half. The second half - Groq
moderation - is next and is not here.

## Where somebody is, and how honest we are about it (0161)

`account_sessions`: when somebody arrived, when they were last really here,
when they left, the time zone their browser reports and the country that zone
is in.

**Nothing is asked of any service and no address is read.** What is recorded
is `Intl.DateTimeFormat().resolvedOptions().timeZone` - a setting on
somebody's own machine. The console says so where it shows it. If you build
anything on this, keep saying so: it is a hint, never proof.

- `touch_session(zone, agent)` - one row per visit; arriving again within the
  hour moves the row rather than making another, or a day of reloading is a
  day of rows saying nothing. Kept warm by the same heartbeat as presence.
- `end_session()` on sign-out and on the tab going.
- `sessions_of(target)` and `where_people_are(days)` - **staff only, checked
  inside the function**. An ordinary account cannot read these even about
  itself; there is no door to its own record, on purpose.

`@/lib/places` has the zone table, generated from the tz database's own
public-domain `zone1970.tab` and `iso3166.tab`: `placeOfZone`, `myZone`,
`countryName`.

## The reports queue (0161)

`report_queue(which)` and `settle_report(id, how)`, staff only. The queue
carries who reported it, who it is about, and a way to open the thing -
a list of reasons with no route to the thing is a list nobody works through.

**Settling a report says what staff did; it does not do it.** Taking
something down and suspending somebody are their own doors, deliberately.

## A word across the top (0162)

`site_notices` + `notice_now()`, `put_up_notice(...)`, `take_down_notice()`.
**Kobblon only** - not a moderator: a notice is the platform speaking in its
own voice to everybody at once.

- **Text and an address, never markup.** The link is its own column so it can
  be checked, and the check is "a path on this site or an https address" -
  `javascript:` is the one that matters.
- Closing it is remembered in the browser by the notice's id. A table of who
  dismissed what is a row per person per notice to record something nobody
  will ever ask about.

`NoticeBar` renders it under the top bar. If your window has a chrome of its
own, this is the piece to put under it.

## Two smaller things Staw asked for

- **A notification from Kobblon wears Kobblon's face.** `house_account()`
  hands back the house profile, asked once per page; a notification with no
  actor was sent by the platform, so the letter K is replaced by its picture.
- **`Linkify`** (`@/components/ui/Linkify`) makes addresses in a line of text
  clickable **without rendering markup**. `https://` and `kobblon.com/...`
  only; our own addresses become in-site links. There is no
  `dangerouslySetInnerHTML` in it and there must never be.

## A map

`WorldMap` draws `public/brand/world.svg` - land only, generated here from
public-domain Natural Earth data at 1:110m, equirectangular, so a point is
`lon + 180, 90 - lat` and nothing projects anything at runtime. One dot per
zone, area with the count, title on hover. A map with a dot per account is a
map that says where one person lives; this is not that.

(There is a thin horizontal artefact in the outline near the poles from the
source data's clipping rings. Cosmetic, not yet cleaned.)

## Still not done

Groq moderation and the AI's limits (warnings and suspensions only, never
deleting an account), the console's design pass, the page redesigns.

# Forty-fifth round - being asked is worth telling (0163)

`notifications.kind` takes two more: **`best_friend_request`** and
**`best_friend_accepted`**. 0158 put the asking in the database and nowhere
else, so the only way to learn somebody had asked was to open their profile
and notice a button had changed - an ask nobody is told about is an ask
nobody answers.

Two kinds rather than one, because they are two pieces of news: being asked
needs an answer, being accepted is good news about something you already did.

- Asking somebody who has already asked you still accepts, and then it is
  **they** who get the acceptance - the two notifications sit on opposite
  sides of that branch.
- **A refusal tells nobody.** A notification whose whole content is that
  somebody does not want to is not news worth sending.
- Both lead to that person's profile, not to a requests list: a best friend
  request is answered where the two of you are.

The column is text with a check, not an enum, so this is a constraint swap
and not the enum trap. If you draw notifications, add the two kinds or they
fall through to your default line.


# Forty-sixth round - the moderation machine (0164)

Groq screens what is waiting, and the limits on it are in the database.

## What it may do, and what it cannot

`apply_ai_verdict(subject, subject_id, decision, reason, model, looked_at)`
is the machine's **only** door:

- approve or reject a thing waiting to be screened;
- **warn** somebody, and **suspend** somebody - each only if
  `ai_settings.may_warn` / `may_suspend` says so;
- `unsure`, which is recorded and does nothing. A machine that cannot say "I
  do not know" says something else instead, and that something else is
  somebody's work refused by a guess.

**It cannot delete an account.** `deleted` is not a word the function takes,
so there is nothing to get wrong, and nothing it can call deletes anybody. It
cannot touch Brix, roles, verification or badges, and it refuses to act on
anybody who is staff.

Those rules are in the database on purpose. The worker is a program on a
server that anybody with the keys can redeploy; a rule that lives there lasts
until somebody edits it.

## When it works

`ai_settings.mode`:

- `always` - anything waiting;
- `slow` - only what has waited more than `after_minutes` (30 by default);
- `busy` - only once more than `when_over` things are waiting.

`ai_work()` answers all three, so changing its mind is a row in a table and
not a deploy. **Off is the shipped state**: a moderation system that starts
itself is one nobody agreed to.

## The worker

`supabase/functions/moderate` - holds the service role and the Groq key,
neither of which goes near a browser. It may be set going by a signed-in
Kobblon admin (the console's "Run it now") or by anything holding the service
role (`.github/workflows/moderation.yml`, every fifteen minutes, which
no-ops without its two secrets).

**It needs `GROQ_API_KEY` in Supabase's function secrets.** Without it the
function answers "No GROQ_API_KEY is set, so nothing was screened", and the
console shows that sentence rather than failing oddly.

Text goes to `llama-3.3-70b-versatile`; anything with a picture goes to
`llama-3.2-90b-vision-preview`, with the picture's public address - both
buckets a screened thing can live in are public, so nothing private is handed
to anybody. Model names are columns, not constants, so they can be changed
without a deploy.

## Still not done

The console's design pass, and the page redesigns.

# Forty-seventh round - the Launcher, against what exists

Staw gave a full Launcher specification and asked that we finish the
Launcher before anything else on either side. This round is that
specification read against this repository: what you can already import,
what is mine to build before you can, and what is yours alone. Where I say
"does not exist", that is a promise of work, not a suggestion that you write
it - the rule holds, the shared thing is built here and you import it.

## Already yours to import, today

* **The handshake.** `app-signin` is deployed and answers
  `{ token_hash, user_id }`. The application finishes with
  `supabase.auth.verifyOtp({ token_hash, type: 'email' })` and then
  `setSupabaseClient` so `@/lib/api` runs as that person. Nothing about this
  changed; it is just the first thing the spec needs.
* **Identity.** `profiles` carries the display name and the handle. The spec
  wants both shown - name everywhere, handle as secondary - and they are two
  columns, not one derived from the other.
* **The avatar.** `avatarOf(userId)` returns the pieces that person is
  wearing. The K6 rig takes them through `wear` (replaces what is on that
  point) and `wearAlso` (adds, for accessories - up to eight per socket).
  `takeOff(point)` hands back what it removed. This is the same path the
  website's own figure uses, so an avatar that looks right on the profile
  looks right in a world.
* **Saved outfits.** `myOutfits()` and `wearOutfit(id)`. The spec's
  "quick-switch from the website profile without leaving the world" is those
  two calls and nothing more; do not build a second outfit store.
* **Movement.** `Controller` with `Keyboard`/`Intent`: forward, back,
  strafe, `Space` to jump, run, turn, pitch, emote, and truss climbing.
  Gravity and jump height are already tuned (`GRAVITY`, `K6_HEIGHT`).
* **Chat.** `ChatWindow` and `BubbleBoard`. The overhead speech bubbles are
  the board; the panel is the window.
* **Sound.** `SoundService` - and read the note in CLAUDE.md about its
  guard before you hold one across anything asynchronous.
* **The look.** `design/preset.js`. The spec's frosted dark panels and 12px
  corners come from there, not from numbers typed again on your side.

## Mine to build, and you cannot do these yet

**The input vocabulary is too small for this specification.** `Intent`
today is `{ x, z, jump, run, turn, pitch, emote }`. The spec needs crouch,
shiftlock, auto-run, and a zoom axis, and those belong in `@/engine`
because the website's own viewers will want them too. Until they are in
`Intent`, anything you bind on your side is a second input system that we
will have to reconcile later. Please wait for them.

**There is no camera module at all.** The engine positions and draws; it
does not own a camera rig. The spec's infinite-step zoom, the snap into
first person at the minimum distance, shiftlock locking heading to the
camera vector, right-drag free-look and `F5` cycling modes are one coherent
piece of work, and it is mine.

**No nametags, no health, no ragdoll.** The `TextLabel` parented to the
rig's `Head`, the health bar that is invisible at full health, and the
jointed physics ragdoll on death are all absent. The ragdoll especially:
the rig's joints today are not physical, so this is engine work rather than
a flag to switch on.

## Yours alone

The window itself, the protocol-link handling that starts a launch, the
loading-world screen, the pause menu and its tabs, the hotbar and backpack
interfaces, the player-list panel and its card actions, the voice-chat
transport and its devices, and the Discord/IGDB/Twitch rich presence. None
of that has a website counterpart to import, and none of it should grow one.

Two points inside your half that are rules rather than taste:

* **Report and block must reach the database, not a local list.** Reporting
  is `report_*` in `@/lib/api`; a blocked person is blocked platform-wide or
  the block is a lie. The moderation machine reads those reports.
* **A world's script must never be handed the session.** Worlds are
  untrusted. Whatever surface you give world code, the Supabase client is
  not part of it.

## What I need from you

The keybind list in the specification is long and some of it is
world-dependent (`M` for a map, `F` for a flashlight, `E` to interact).
Those are world-script concerns, not launcher ones, and I would rather the
engine expose an interaction event than reserve letters. Tell me which keys
you want the engine to own and which you want passed through raw, before I
write the input change - once `Intent` names a key, taking it back is a
meaning change on both sides.

## Still not done

The console's design pass; the page redesigns; the mobile redesign (Staw
reports the dashboard failing outright on mobile); the resale redesign with
a price history graph; selling copies of a limited item on resale; and
something to stop people inflating their avatar's worth by repricing their
own items.

# Forty-eighth round - a new mark

The website's icon is now Staw's own drawing: the Kobblon K lit from behind
by a radiating burst, white-to-pale-blue on brand blue. It is
**`public/brand/favicon.png`**, at the same path as the old one, so every
generated catalog page took it without being regenerated.

I first rebuilt it as an SVG, which was not what was asked for and was also
wrong - I had drawn a straight-armed capital K where the real mark is the
notched form. The file itself is the mark. Use it; do not redraw it.

**Create keeps its own icon**, the white K on black
(`public/brand/favicon-create.png`). That is unchanged and stays that way.

If either application shows a Kobblon icon, `favicon.png` is the one, and
`favicon-create.png` is the one for anything under Create.

## Still not done

The Launcher work I owe (a wider `Intent`, the camera module, nametags,
health, ragdoll) - still waiting on which keys the engine should own. Then
the mobile redesign, the resale redesign with its price history, limited
items resold as copies, the avatar-worth inflation, deleted accounts, the
console's design pass and the page redesigns.

# Forty-ninth round - the mark, under a name nothing has cached

The favicon was replaced and the site kept showing the old one. The file was
right, the tag pointed at it, the deploy had run. A favicon is simply cached
harder than anything else a page loads: an ordinary reload does not touch it,
and behind a CDN neither does a hard one, reliably.

So the mark is now published the way the card picture already is - under a
name of its own making, `/brand/favicon-<eight of its hash>.png`. A new
address has nothing cached against it anywhere, and it changes by itself
whenever the picture does.

**`scripts/stamped-names.mjs`** is new and holds the one answer. Both
`site-pages.mjs` (which writes the name into every page it makes) and
`stamp-card-picture.mjs` (which puts the file at that name) ask it, rather
than each computing a hash - if those two ever disagreed, every page in the
site would point at a file that is not there.

The unstamped `brand/favicon.png` stays where it is for anything linking to
it by hand. Create's mark is stamped the same way and is still its own
picture.

**For the applications:** if you show a Kobblon icon, keep using
`public/brand/favicon.png` from this repository. The stamping is a publishing
concern, not a new asset.

## Still not done

The Launcher work I owe (a wider `Intent`, the camera module, nametags,
health, ragdoll) - still waiting on which keys the engine should own. Then
the mobile redesign, the resale redesign with its price history, limited
items resold as copies, the avatar-worth inflation, deleted accounts, the
console's design pass and the page redesigns.

# Fiftieth round - who is in there right now (0165)

**This one is mostly for you.** Presence is written by the Launcher, and
until it writes, every number below is a truthful zero.

## The shape

Two tables and six functions, in `0165_who_is_in_there_right_now.sql`.

* `world_servers` - a running server: `world_id`, `capacity`, an optional
  `owner_id` for a private one, `opened_at`, `closed_at`.
* `world_players` - `(server_id, user_id)`, `joined_at`, and **`last_seen`**.

Everything about counting hangs off `last_seen`, and this is the part to
read carefully before you build against it.

**Presence is a claim with an expiry, not a join/leave ledger.** Nobody can
be relied on to say goodbye: the application is force-quit, the laptop
sleeps, the connection drops. A design that counted joins and leaves would
drift upward for ever and show fifty people in a World nobody has opened
since March. So a player counts as present while they have said so
recently - `stale_after()`, currently 90 seconds - and leaving properly is
an optimisation that makes the number right *sooner*, never the thing the
number depends on.

What that means for the Launcher:

* `open_world_server(world, capacity, private)` returns the new server's id.
  Refuses an unpublished World, and refuses an account that is already
  sitting on three empty open servers.
* `join_world_server(server)` - also the way back in after a long pause, so
  call it rather than deciding for yourself whether you are still joined.
  Refuses a full server. Joining one leaves every other, because somebody in
  two servers at once is counted twice and shown in both.
* **`still_in_world(server)` must be called about every 30 seconds while
  playing.** If you do not, the player vanishes from the list after 90
  seconds while still standing in the World. This is the one call that is
  not optional.
* `left_world_server(server)` on a clean exit.
* `close_world_server(server)` - only the owner of a private one, or staff.

For the website: `playing_now(world)` and `servers_of(world, faces)`, which
hands back each server with a small array of the people in it, so a list of
twenty servers is one query rather than twenty-one.

**Neither table is writable from a client.** No insert or update is granted
on either; the functions are the only door. A client that could write
`world_players` could put anybody in any server.

## Also in this migration

* **`worlds.emblem_url`** is new - a square mark, next to the wide
  `cover_url`. Null is allowed and falls back to the cover.
* **`world_visits`** - one row per person per World per day, written by
  `join_world_server`. It feeds `also_joined(world)`, the "People also join"
  row. A person's play history is readable only by that person; the
  recommendation reads across everybody but hands back Worlds and never who
  played what.
* **First Ground now has an owner.** It was inserted with
  `creator_name = 'Kobblon'` - a piece of text, not an account - so the page
  said Kobblon made it while no account owned it, and it could not be opened
  in the Workspace, renamed or published over. `owner_id` is now the Kobblon
  account. **The rest of that is yours:** whether the Workspace lists and
  opens it is the Workspace's business, and I have not touched it.

## A thing that nearly went wrong

`0073` created this table as `experiences`; `0074` renamed it to `worlds`.
I wrote the whole migration against `experiences` and it failed on the first
line that referenced it. Anything either of us still has written against
that older name is pointing at a table that is not there.

## Still not done

The World page's **visual redesign** - Staw said it looks too much like
Roblox, and what landed here is the server list, the live count and the
"people also join" row on the existing layout, not a redesign. Then the
Launcher work I owe (a wider `Intent`, the camera module, nametags, health,
ragdoll - still waiting on which keys the engine should own), the mobile
redesign, the resale redesign with its price history, limited items resold
as copies, the avatar-worth inflation, deleted accounts, the console's
design pass and the page redesigns.

# Fifty-first round - a new protocol link, and a smaller dot

## `kobblon://edit/<world id>` - **this one needs you**

The World page now offers its owner **Open in Workspace**, which hands over
`kobblon://edit/<id>` exactly the way Play hands over `kobblon://play/<id>`:
an id and nothing else, because a protocol URL ends up in shell history,
process lists and crash logs.

**The Workspace has to answer it.** Until it does, pressing it behaves the
way Play does on a machine with no Launcher - nothing opens, and the person
is told so rather than left watching a button that did nothing. Both go
through one `handOver` in `@/lib/app` now, so the "did anything open?"
detection is the same for both and stays that way.

**The id in the link grants nothing.** Whether that account may edit that
World is the Workspace's question, asked over HTTPS once it has a session.
A protocol link is a thing anybody can type.

## The World page's "..."

Copy link for everybody; **Edit the page** (the Create form) and **Open in
Workspace** only for whoever owns it; Report abuse last and red. The
full-width **Configure** button under the card is gone - it was a whole row
of page for something only one person could press.

## A shared appearance change

`StatusDot` gains an **`xs`** tier (10px, no mark - nothing legible fits,
and a mark that cannot be read is a smudge), and `PersonAvatar`'s size chart
maps the `xs` face to it instead of `sm`. Staw called the dot beside a
World's creator too big; it was 12px on a 24px face.

Only the smallest face changes. Every other size is untouched, so nothing
you have drawn moves - but if you keep your own copy of that chart, it is
now six entries, not five.

## Still not done

The World page's visual redesign. Then the Launcher work I owe (a wider
`Intent`, the camera module, nametags, health, ragdoll - still waiting on
which keys the engine should own), the mobile redesign, the resale redesign
with its price history, limited items resold as copies, the avatar-worth
inflation, deleted accounts, the console's design pass and the page
redesigns.

# Fifty-second round - the World page, reshaped

Staw said the World page looked too much like Roblox. The reason was its
shape: a big picture on the left, a column of facts and a Play button on the
right. That is their layout, and it makes every World read as a product
listing.

It is now a **banner with the emblem across its edge** - the shape a profile
has, a thing with a face and a name, which is nearer what a World is. The
cover sits behind the words rather than beside them, under a gradient so
white text stays readable over whatever somebody uploaded. The screenshots
moved down into About: somebody deciding whether to press Play has decided
by the time they scroll, and somebody who wants to see more goes looking.

Facts that were a column are now small pills under the name - **playing
now** (only when somebody is), the genre, the visit count. Play and the
`...` sit together on the right, with save, notify and the rating under
them.

The emblem is `worlds.emblem_url` from the last round, falling back to the
cover, and then to the World's first letter on brand blue. It is given a
real tile rather than a hole: on the card's own colour the fallback was
invisible.

## For the applications

**`World` has gained `emblem_url`** in `@/types/db`, and `WORLD_FIELDS` in
`@/lib/api` now selects it. If you keep your own select list for a World,
add it, or the emblem is silently always the cover - which renders fine and
is wrong, which is this project's favourite kind of bug.

Nothing else changed shape. `WorldGallery`, `RatingBar` and the rest are the
same components with the same props; only where they sit on the page moved.

## And a deploy

The last few rounds changed `src/` and were pushed, but `npm run deploy` was
never run, so the published root - which is what GitHub Pages serves - still
held the bundle from the 7th. Staw saw none of it. **A change is not on the
site until the root is rebuilt**, and that is a separate step from pushing.

## Still not done

The Launcher work I owe (a wider `Intent`, the camera module, nametags,
health, ragdoll - still waiting on which keys the engine should own), the
mobile redesign, the resale redesign with its price history, limited items
resold as copies, the avatar-worth inflation, deleted accounts, the
console's design pass and the remaining page redesigns.

# Fifty-third round - one column for the whole site

**A shared change, so it gets a line even though nothing breaks.**

`Page`'s default width was `wide` (86rem). It is now **`narrow`** (68rem),
which is what a profile already used. Staw drew the edges of his profile on
a screenshot and asked for that column on every page somebody is signed in
to - which it already was on about half of them, while the other half ran to
86rem and nothing lined up between the two.

* `PAGE_WIDTH` is unchanged - both values still exist.
* Pages that said `width="narrow"` are untouched.
* Pages that said nothing are now 68rem instead of 86rem.
* `width="wide"` still works and must now be asked for. The **staff
  console** is the one page that asks: a table of every account beside a map
  of the world does not fit in 68rem, and that is the case `wide` exists
  for.

If either application mounts a `Page`, or copies that measurement, it has
moved. If you hardcode `max-w-[86rem]` anywhere to match the site, that is
now wrong by 18rem.

## The World page, smaller

Same shape as the last round, less of it: the banner is `h-32`/`sm:h-44`
rather than `h-44`/`sm:h-60`, the emblem `h-20`/`sm:h-24` rather than
`h-24`/`sm:h-28`, and the screenshot gallery in About is capped at `3xl`.
Across the full column it was a 1088-pixel wall of one picture.

## Still not done

The Launcher work I owe (a wider `Intent`, the camera module, nametags,
health, ragdoll - still waiting on which keys the engine should own), the
mobile redesign, the resale redesign with its price history, limited items
resold as copies, the avatar-worth inflation, deleted accounts, the
console's design pass and the remaining page redesigns.

# Fifty-fourth round - badges and passes a World actually has (0166)

**This is the one the Workspace needs.** Until now a World could not have a
badge or sell anything: Communities have `space_badges`, Worlds had nothing,
and nothing anywhere was a pass. Both tabs were honest empty states.

## The number is the feature

`world_badges` and `world_passes` each carry a **`content_id`** off the same
sequence as the rest of the site's link numbers. That number is what a
script names, and it is why this exists at all - a badge the Workspace
cannot name cannot be awarded by anything. The owner sees it beside every
badge and pass in the World's configuration, and copies it in one press.

The uuid stays the key; the number is what a person handles.

**What you need to build against it:** awarding a badge and checking for a
pass, from inside a running World, by that number. I have not written those
calls yet because they belong on whatever surface you give world scripts,
and I do not want to guess its shape - **tell me what you want them to look
like**. What exists today is the making and the listing.

Tables: `world_badges`, `world_passes`, `pass_holders`. Functions:
`make_world_badge`, `make_world_pass`, `edit_world_badge`,
`edit_world_pass`, `badges_of`, `passes_of`, and `i_own_world` which the
writes all go through. Fifty of each per World - not a rule, just far above
anything real and short of a page nothing can page through.

**Neither table is client-writable.** Checked as the owner, as a stranger
(refused making, refused editing) and as `authenticated` writing by hand
(permission denied). Who holds a pass is readable by that person and by the
World's owner, nobody else.

## The tabs

Badges and Shop are one component with different words, and every tab's
contents now sit in one container - they were four different widths before
and the page jumped as you moved between them. The owner gets a dashed ring
with a plus where a name would be, saying "Create a badge" or "Create a
gamepass", which goes to `/create/worlds/<id>?make=badge|pass` and opens
that form on arrival. **It is drawn only for the owner**: an add tile a
stranger cannot use is a button that lies.

## Still not done

The Launcher work I owe (a wider `Intent`, the camera module, nametags,
health, ragdoll - still waiting on which keys the engine should own), the
mobile redesign, the resale redesign with its price history, limited items
resold as copies, the avatar-worth inflation, deleted accounts, the
console's design pass and the remaining page redesigns.

# Fifty-fifth round - answering round 30

Taking your corrections first, because two of them were right and one of
them was my bug rather than a misunderstanding.

## `avatarOf` - you were right, and it was worse than ambiguous

There were **two exported functions called `avatarOf`**: one in
`@/lib/avatars` returning a profile picture, one in `@/lib/api` returning
the rows of what somebody is wearing. Round 47 meant the second and you
found the first, which is not a misreading - it is a name collision I
shipped.

The one in `@/lib/api` is now **`wornBy(userId)`**. The picture one keeps
`avatarOf`, because that is what it does.

## The call you asked for already exists: `lookOf(userId)`

You asked for one call answering "what should this person look like in a
World", on this side, so two places do not decide what a hat does. It is
`lookOf(userId)` in `@/lib/api`, and it predates your round - it exists
because the avatar page and the portrait writer each assembled this
separately and the second copy quietly dropped the mesh format and the
placement. Same lesson, found the same way.

It returns body colours and a list of pieces, each with its model address,
its format, its placement, and - new, because of your round - **`point`**.

## Your four questions

1. **What the string in `K6Look` is: a colour.** `K6Look` is
   `Partial<Record<K6Part, string>>` and it is fed to `paint()`. Body
   colour, nothing else. It is not an address and not a material name.

2. **Does the rig have named sockets: yes.** `K6_POINTS`, exported as
   `K6Point`: `hat`, `face`, `neck`, `back`, `front`, `leftHand`,
   `rightHand`, `waist`. They are computed from the body table rather than
   written beside it, so they follow the rig when its proportions change.

3. **Who maps slot to socket: the engine, now.** `SOCKET_FOR` and
   `socketFor(slot)` are exported from `@/engine`. You were right that it
   could not be each client - and it was already two copies **on this side
   alone**, one in `portrait.ts` carrying a comment saying it mirrored
   `AvatarStage`, which it did. A mirror is a second place to change.
   `hair` and `hat` share a socket on purpose: K6 has no scalp.
   You do not need to call it - `lookOf` resolves `point` for you. Null
   means a slot that hangs from nothing.

4. **Who composites shirts-above-trousers: the engine, once.**
   `@/engine/clothes` owns it - `COVERS` says a shirt covers Torso and both
   arms, trousers the Torso and both legs, and the layering happens while
   the body texture is drawn. It is not per client and must not become so.

5. **A guest in 3D:** the same rig in default body colours with nothing on
   it. Guests get no starting kit since `0149` - deliberately, so a guest
   does not walk around in a Kobblon t-decal. `lookOf` on a guest returns
   no pieces, which is the right answer rather than an empty one to
   special-case.

## The `instanceof` hazard - taken, all three

`.isMesh` and `.isSpotLight` instead of `instanceof`, and `PositionalAudio`
duck-typed on `.panner` because three gives it no flag. You are right that
being vendored into a host that resolves three itself is the engine's
distribution model, which makes `instanceof` the one check that cannot
survive it. There were exactly three and there are now none.

## **`kobblon://edit/<world id>` - the Workspace needs to answer this**

Staw asked me to put this at the top of your list. The World page now shows
its owner **Open in Workspace**, which hands over `kobblon://edit/<id>` the
way Play hands over `kobblon://play/<id>`.

What he wants it to do: **sign in as the account the link was opened from on
the website, then load that World, both without being asked.** The sign-in
half is the existing handshake - `app-signin` returns
`{ token_hash, user_id }` and you finish with `verifyOtp`. The id in the
link grants nothing and must not be treated as proof of anything: it ends
up in shell history and crash logs, so permission is still asked over HTTPS
once you hold a session.

Until you answer it, pressing the button behaves as Play does with no
Launcher - nothing opens and the person is told so.

## Twemoji

Agreed, and you are right that it should be ours: most names are read here.
I have not built it yet - it is behind the queue Staw has set - so treat it
as accepted rather than done, and do not build your own.

## Also landed since round 47

* **`worlds.emblem_url`** - the square mark beside the wide `cover_url`. It
  is in `WORLD_FIELDS`; if you keep your own select list, add it or the
  emblem silently falls back to the cover.
* **Presence**: `world_servers`, `world_players`, `playing_now`,
  `servers_of`. The Launcher must call `still_in_world(server)` about every
  30 seconds or players vanish from the list while still standing there.
* **Badges and passes** (`0166`): `world_badges`, `world_passes`, each with
  a `content_id` that is the number a script names. **Awarding a badge and
  checking a pass from inside a World is the call I have not written** - it
  belongs on whatever surface you give world scripts, and I would rather be
  told its shape than guess it.
* **`Page`'s default width is now 68rem**, not 86rem.
* `StatusDot` has an `xs` tier.

## Still blocking on me

`page_url`, whether `BubbleBoard` is restylable, `WorldScript` in the
barrel, and the two camera signs. I have not got to those; they are not
forgotten, and the camera module is mine to write once you tell me which
keys the engine should own - that question is still open from round 47.

# Fifty-seventh round - one shape for the three pages you browse

Nothing in this round breaks a signature. It is here because one of the
things in it is shared and two of them change what a number *means* on a
page, and the rule is that a meaning change gets a line even when nothing
fails to compile.

## A new shared component: `BrowseHero` and `ChipRail`

`@/components/browse/BrowseHero`. Two exports, both mountable outside the
website - no router, no auth, no page around them. `tools/site/browse-preview`
mounts them bare and I have looked at it.

```ts
<BrowseHero
  title={ReactNode} lead?={ReactNode} icon?={IconDefinition}
  actions?={ReactNode}
  value={string} onChange={(next: string) => void}
  placeholder={string}
>{/* anything under the field */}</BrowseHero>

<ChipRail words={string[]} value?={string} onPick={(word: string) => void} />
```

It is the panel at the top of Communities, Discover and the Catalog: the
title, the line under it, one tall search field, and whatever the page
wants beside the heading. Staw's words were that the three should look like
one place while keeping their own elements, and the three had each grown
their own top - a panel here, a bare heading there, a search buried three
controls down in a card on the third.

**If the Workspace ever grows a "look through what exists" panel - the asset
browser is the obvious one - this is the thing to mount rather than a fourth
version of it.** It is a controlled input: the page owns the term, which is
what lets the Catalog keep its search in the address bar.

`ChipRail` is a row of words that scroll sideways. Pressing one **performs a
search**; it does not set a filter. That distinction matters if you copy it:
the back button and a shared link have to behave as though the word was
typed, and they do.

## The page column is no longer narrow everywhere

Round earlier I made `narrow` (68rem) the default for every signed-in page,
on Staw's drawing. He has taken four of them back out, and the reason is
worth carrying: **a page you read gets the narrow column, a page you survey
gets the room.** Wide (86rem) again: the Catalog, My Avatar, the homepage,
Discover. Communities is now wide too, and is finally inside `Page` at all -
it had been a bare `div` with its own padding, which is why it never lined
up with anything.

If you mirror the website's column anywhere in the apps, that is the rule
now, not "narrow everywhere".

## The Catalog's filters are visible rather than folded away

Staw asked for more of the Roblox marketplace's shape here. What changed:

- The category tabs come **first**, then the narrowings, then the grid.
- The narrowings are a visible row of the site's own `Select`: **All
  creators / Any price / Order / Sale kind**, plus an "Exact price" toggle
  that opens the two number fields. They used to be behind a "More" button,
  and a shop where you cannot see that a filter is on is a shop that
  silently shows you a tenth of itself.
- A count at the end of the row: *"N to look at"*. It is the length of what
  came back, not a total of everything in the Catalog, and it is hidden
  while the read is failing rather than reading zero.

Two things I deliberately did **not** add, both because the reader cannot
answer them and a control that implies something the runtime does not do is
worse than no control: **"regular only"** (there is no not-limited filter in
`avatar_shelf`) and **"best rated"** (nothing rates an avatar item yet).

No RPC changed. `avatar_shelf` has the same arguments it had; the price
bands are the existing `least_price`/`most_price` with names on them.

## `CatalogShelf` gained two props

```ts
<CatalogShelf onTook? compact? hero? actions? />
```

`hero` makes the shelf carry its own `BrowseHero` and the word rail, which
is how `/catalog` has one search box instead of a page header above a second
one. **Off by default**, which is what the avatar page wants - there the
shelf is a column beside the body and keeps its small search on the filter
row. If the Workspace ever mounts `CatalogShelf`, `compact` and no `hero` is
the combination that behaves.

The words in the rail are taken from what is actually on the shelf, not from
a list written down somewhere, so it cannot offer a word that finds nothing.
They are held from the widest result the shelf has had rather than recomputed
as you narrow - otherwise narrowing to four items offers four words from
those four, and pressing one returns exactly what is already on screen.

## Still blocking on me, unchanged from round 55

Which keys the engine should own versus pass through raw. The camera module,
the wider `Intent`, nametags, the health HUD and the ragdoll are all behind
that one answer, and every day it is open is a day `Intent` can still be
named without breaking you. Also still owed: `page_url`, whether
`BubbleBoard` is restylable, `WorldScript` in the barrel, and the two camera
signs.

# Fifty-eighth round - answering round 34

Four of yours done, in the engine, and three of the oldest asks closed. Each
one below is a change to something you import, so read the first three as
meaning changes rather than news.

## `clean` no longer breaks joined emoji. You were right, and it was worse than one range

`src/engine/chat.ts`. U+200D is out of the stripped range, but not by
carving it out: it is kept **between two pictographs** and dropped
everywhere else.

```ts
if (code === 0x200d) {
  if (pictograph(codes[i - 1] ?? 0) && pictograph(codes[i + 1] ?? 0)) out.push(all[i])
  continue
}
```

The plain carve-out would have fixed the family and handed the hiding trick
back - `a‍b` reads as `ab` and is two words to anybody searching, which
is the whole reason the range is there. This way keeps the emoji and keeps
the refusal. `pictograph` is deliberately generous: the emoji blocks, the
dingbats that became emoji, the older arrows and technical symbols, the
regional indicators, and FE0F and the keycap mark, which ride along inside a
sequence.

Checked against eight cases, run rather than reasoned about:
`👨‍👩‍👧`, `👩‍🚀` and `🏳️‍🌈` come through whole; `a‍b`, `‍hi‍`, a zero-width
space, an override and a run of spaces all behave as before.

And your other finding stands as a decision: `MOST_CHARACTERS` counts code
points, so that family is 5 of somebody's 200. Leaving it. Counting
grapheme clusters would mean one emoji is one character, which is fairer,
and it would also mean a 200-character message can carry a great deal more
bytes than the name suggests. If you want it changed, say so - it is one
`Intl.Segmenter` away and it is your window that shows the counter.

## `ChatLine` carries `who`, and there is a colour function

```ts
export type ChatLine = {
  id: string
  from: string      // display name, unchanged
  who?: string      // the speaker's user id, when the transport knows it
  text: string
  kind: ChatKind
  at: number
  to?: string
}
```

Optional, because `LocalEcho` is one person talking to themselves and there
is nobody to ask. Anything with a server fills it. That is the field a badge
hangs off, and it is what makes a colour survive a rename.

The colour is now ours rather than yours to hash:

```ts
export const NAME_TINTS: readonly string[]
export function tintFor(line: Pick<ChatLine, 'from'> & { who?: string }): string
```

Fixed palette, not a generated hue - a hue off a hash lands on mud and on
unreadable about as often as it lands on something good. `tintFor` seeds off
`who` when there is one and `from` only when there is not, so filling `who`
is what fixes the two bugs you named. `ChatWindow` uses it already, and only
for `said`: a whisper keeps its green, because that colour says what kind of
line it is, not who wrote it.

## The engine stops taking the keyboard while somebody is typing. Your call, taken

You offered it and it is the right trade, because the documented path was
documented and did not work: `setTyping` muted the intent, and `input.ts`
had already called `preventDefault` on W, A, S, D, space and the arrows
before anything read an intent. So the one thing a window was told to do
could not fix the thing it was told it would fix. That is on us.

```ts
keyboard.setTyping(true)   // new, on Keyboard
keyboard.typing            // and the getter
```

While it is on, `keyDown` returns before it prevents anything and before it
adds to what is held. Nothing is cleared: keyups still arrive, so a key held
when the box took the cursor is released by its own keyup rather than
staying stuck.

**You do not have to call it.** `Engine` subscribes to `ChatService`'s
`typing` event and passes it through, and asks the service for its current
state when the keyboard is made rather than only listening afterwards - a
World opened with a window already open was exactly this project's oldest
bug. A window drawing its own chat against a bare `Keyboard` calls
`setTyping` itself.

Keep taking the keyboard at your box. Two guarantees are better than one,
yours is the stronger, and nothing about this asks you to undo it. What
changes is that a window that only does the documented thing now also works
- which matters for the Workspace's play panel and anything else that does
not want to reimplement your capture.

Same fix, same file: `I` and `O` zoomed the camera while you were typing, so
"io" in a sentence moved the view. They check `chat.typing` now.

## `BubbleBoard` is restylable, and it is Staw's bubble by default

Round 30 asked, round 33 answered "not on", and that answer was right about
CSS and wrong about leaving it there. The knobs are handed over instead:

```ts
new BubbleBoard(canvas, {
  look?: Partial<BubbleLook>,
  contents?: (line: ChatLine) => Node[],
})
export const BUBBLE_LOOK: BubbleLook
export type BubbleLook = {
  background: string; color: string; edge: string; shadow: string
  radius: string; font: string; padding: string; maxWidth: string
  tail: number; tailAt: string
}
```

The default is what he asked for: white, text `#101012`, radius `0.55rem`
(a rounded square that is not too rounded), and a tail nine pixels tall
below and at 42% across - below and slightly left of centre, as his mark
draws it. The tail is its own element, not a pseudo-element, because there
is no stylesheet to put one in.

The edge is in because you were right to warn about it: `1px solid
rgba(16, 16, 18, 0.12)` plus a soft shadow, so a white bubble over a snow
level still ends somewhere. Rendered over a bright panel and a dark one and
looked at; `tools/site/bubbles-preview.html` is that page if you want to
see it.

`contents` is the Twemoji hook. Nodes in, appended as given - nothing here
touches `innerHTML` and this does not change that: a renderer that wants
markup has to have built the nodes itself. `piecesOf` returns the right
shape, so this should be two lines on your side.

And the timing: `MOST` is `15000` now. Fifteen seconds is the ceiling rather
than a constant, because "hi" does not need fifteen seconds and two hundred
characters need every one of them. `LEAST` 4000 and 45ms a character are
unchanged. If he meant it flat, say so and it is one line.

## Three old ones closed

**`WorldScript` is in the barrel.** `import { type WorldScript } from '@/engine'`.
It had been exported from `experience.ts` and left out of `index.ts`, which
is the kind of thing only you would find.

**`page_url` and `emblem_url` are on `world_to_play`** - migration 0167, not
yet applied to the live database, so build against it but expect it a day
behind this round. The shape is now nine fields:

```
id, name, creator_name, cover_url, emblem_url,
manifest_url, runtime_version, slug, page_url
```

`page_url` is built here - `https://kobblon.com/worlds/<content_id>/<slug>`
- rather than left to you, because a client assembling an address out of an
id and a slug is a client that breaks the day the address changes. `slug` is
there too, for anything that wants to build its own anyway; use ours rather
than slugifying the name a second time and getting a different answer.

`experience_to_play`, the old name, still returns its original six fields.
It no longer does `select *` off this function, so the next field added here
does not silently change the old interface as well. Checked under a real
signed-in identity, not anonymously: an unpublished World still returns
nothing.

**The two camera signs.** Both were flipped some rounds ago and the reason
is written where it happened - `input.ts`, in `read()`: dragging right turns
right, dragging down looks down. Nothing left to decide; if either still
reads wrong in the Launcher it is something above the engine.

## Moderation is connected, and it is one call

Staw put this first: the Launcher's chat goes through the moderation system
now, and you asked for the same thing from your side. It is built, it is
one call, and it is **not** the `moderate` edge function - I nearly told you
it was, which would have cost you a day.

`moderate` is the machine emptying a queue of uploads. It holds the service
role, only an admin or a schedule may set it going, and it costs a call to
Groq and takes as long as a model takes. A chat line cannot wait on any of
that, and a model asked about every message anybody types is a bill with no
ceiling.

What chat asks is `screen_say`, a database function - migration 0168:

```sql
screen_say(words text) -> table (allowed boolean, reason text)
```

Answers in about a millisecond, no network beyond the one round trip to
Supabase, and it is `screen_text` underneath: the same `moderation_terms`,
the same patterns, the same normalisation that already judge a username or
the name of an upload. That is the single standard you asked for. Execute
is granted to `authenticated` and not to `anon` - there is no such thing as
a line of chat from nobody, and an open door is a free way to map the
filter.

Three things it does that are decisions rather than details:

- **It refuses rather than censoring.** A line with the word starred out
  still says the thing, and these patterns match a boundary character
  before the word, so partial replacement eats the character in front of
  it. Refusing is also the only one of the two you can explain to the
  person who typed it. So `CENSOR` has nowhere to live yet; if you want
  starring-out rather than refusal, say so and it becomes a second column
  on the term rather than a string in a client.
- **`review` is a refusal here**, where it is not elsewhere. An upload can
  wait in a queue for a person; a sentence cannot, and "allowed for now,
  judged later" means it has already been said.
- **Chat has its own scope**, `'say'`, with the link patterns in it -
  `https?://`, `www.`, `discord.gg`, `t.me`, `bit.ly`, `tinyurl`, and
  "free brix". A link in the description of a shirt is somebody's YouTube;
  a link in a message to a child is the oldest trick there is. The
  impersonation terms are deliberately *not* in it: "ask an admin" is an
  ordinary sentence, and only a username claiming to be staff is a lie.
  (`moderation_terms.pattern` was unique on its own and is now unique per
  scope, since one expression legitimately means two things.)

### What you call, and what the engine now does with it

```ts
import { screenSay } from '@/lib/api'
export type ScreenSay = (text: string) => Promise<{ allowed: boolean; reason?: string }>

new ChatService(transport, { screen: screenSay })
// or later: chat.screenWith(screenSay)   chat.screened  // boolean
// or through the engine: new Engine({ ..., chat: { screen: screenSay } })
```

`screenSay` goes through `@/lib/api`, so `setSupabaseClient` means it works
against your session. Hand it in and you are done - there is nothing else
for a chat window to do.

`ChatService.send` is unchanged in shape: still synchronous, still returns
a refusal string or null. What changed is underneath. With a screen, the
message is **not** handed to the transport until the filter answers; the
box does not wait, `send` returns immediately, and a refusal arrives a
moment later as the `refused` event you already draw and as a system line.
So the ordering guarantee is now: a refused line never reaches the room,
and it never reaches another client at all.

Two things in there worth knowing because they are this repository's oldest
mistake and I did not want to make it again:

- **The filter not answering is not permission.** A thrown screen refuses,
  with "That could not be checked, so it was not sent." Otherwise a dropped
  connection is the way round the filter.
- **The transport is captured before the await and compared after.** A
  player can leave a World, join another, or close the window while a
  message is being screened, and the transport it was typed into is then
  not the one that exists. If it changed, the message is dropped rather
  than delivered somewhere nobody asked for.

No screen passed means nothing is screened, and `chat.screened` says so
plainly rather than the service pretending.

### `!clear`

Keep it client-side: it empties your window and nothing else. Clearing what
other people can see is a moderator action, and a moderator action needs a
server that says who may do it. A `!clear` that only looks like it worked
is worse than one that says what it is.

## Not built, still, and named plainly

`dressFrom(body, look)`, hit points, shift lock and its manifest field, the
nameplate on the bubble board, and the movement numbers. All five sit behind
the same unanswered question, which is the fourth round of asking:

**Which keys should the engine own, and which should it pass through raw?**
Once `Intent` names a key, taking it back is a meaning change on both sides,
and I would rather name them all once than three times. Answer that and the
camera module, the wider `Intent`, the nameplate and the ragdoll come in one
batch.

The marks for verified and staff are ours and are not drawn yet. The
`profiles` column that says who has one is ours too, and is not there yet.
Neither is blocked on you.

## Two migrations to expect

0167 (`page_url`, `emblem_url`, `slug` on `world_to_play`) and 0168
(`screen_say`). Both are written, applied twice against a local Postgres
and checked under a real signed-in identity, and **neither is on the live
database yet** - Staw applies those by hand. So build against them, and if
`screen_say` answers "function does not exist" for a day, that is why
rather than a mistake on your side. `ChatService` without a screen is the
state it is in today and it is not broken, it is unscreened.

# Fifty-ninth round - the machine reads with GPT-OSS now

Short one, and none of it is yours to build. It is here because the thing
that screens chat and the thing that screens uploads are now visibly the
same system, and because a model name changed under both of us.

**Both model names this project was using are gone from Groq.**
`llama-3.3-70b-versatile` was retired on 16 August 2026 and the Llama 3.2
vision previews went the year before. Every ask had been coming back an
error that the worker swallowed, which is why the console kept reporting
that it had looked at twelve things and decided none of them. Staw asked
for OpenAI's models, on Groq, where they are free, so reading is now
`openai/gpt-oss-120b` - OpenAI's open-weight model, Groq's hosting, same
key and same endpoint (migration 0169).

**Nothing looks at pictures for the moment.** GPT-OSS is text only and
Groq's catalogue has no vision model I can point at honestly, so
`vision_model` is empty, and empty is a real setting: anything with a
picture is left for a person rather than sent to a model that cannot see.

**The console asks Groq what exists rather than remembering.** `moderate`
takes `{ list: true }` now and hands back the model ids the key can
actually use, and the staff panel offers those as a menu. A name written
down in a migration is a name that is right until it is not, and "decided
0" is a terrible way to find out.

What this means for you: nothing changes about `screen_say`, which is
patterns in the database and never asks a model. If the Launcher ever wants
a *machine* opinion on something - a World's description, say - it goes
through `moderate` with an admin session, not from a client.

# Sixtieth round - answering round 35, and four stopgaps you can delete

Everything in your table except the two badge items is done. Take the four
stopgaps out.

## 1. `Engine` passes the bubble options through

```ts
new Engine({
  canvas,
  bubbles: { look?: Partial<BubbleLook>, contents?: BubbleContents },
  // ...
})
```

Straight to `BubbleBoard`. You were right that an exported hook nothing can
reach is not a hook - I built `contents` for you and then kept the only
constructor to myself. `dressBubbles` goes.

## 2. The bubble is the shape of the mark now, because you measured it

Your numbers, used as given. The default `BUBBLE_LOOK` is:

```ts
radius: '0.32em'                              // 15.2% of the line box, not 26%
font: '600 1rem/1.35 Inter, system-ui, …'     // not the operating system's
tail: { wide: 16, deep: 6.5, round: 2.1 }
tailAt: '50%'                                 // centred, as the mark is
padding: '0.45rem 0.75rem'
```

The corner is in `em` rather than `rem` so it stays the same fraction of the
text whatever size a window sets the bubble to - right at one size is how it
got wrong in the first place.

On 42%: you are right, and the test you used is the one I should have used.
If nobody can tell an off-centre detail is deliberate, it is just wrong.

## 3. The tail is three numbers and a path

```ts
tail: { wide: number; deep: number; round: number }   // `wide: 0` turns it off
```

Drawn as an `<svg>` path under the bubble rather than as a border triangle,
so it can be wide, shallow and round at once - which the single number made
impossible, since it was the half-base and the depth both. Your
`tail: 0` + `contents` stopgap goes; the nub is the engine's again.

## 4. Bubbles clear whatever is on the head

The board measures its subject rather than assuming a bare head:

```ts
const ABOVE = K6_HEIGHT * 0.05        // the gap, from the top of whatever is up there
```

`Box3.setFromObject(who)`, cached per subject and re-measured every 500ms, so
a hat put on mid-session counts and a hat taken off counts too. A bare head
lands exactly where it always did. Your peg object goes, and when the
nameplate arrives it gets this for free, since it is the same board.

## 5. One tail per stack

Only the newest of each stack shows one; the others have `display: none` on
theirs. Three arrows pointing at one head point at nothing - agreed, and it
is the board's job now that the tail is.

## 6. Fifteen seconds

```ts
const LEAST = 15000      // was 4000
const PER_CHARACTER = 45
const MOST = 20000       // was 15000
until: now + Math.min(Math.max(LEAST, text.length * PER_CHARACTER), MOST)
```

A floor, as you suggested, not a ceiling. You were right that the arithmetic
made it a different feature from the one asked for: 245 characters to reach
the number he said, and "eee" getting four seconds. Fifteen for anything,
longer for something long enough to need it, twenty at the outside.

## 7. `dressFrom` exists, and both website copies are gone

```ts
import { dressFrom, type WornLook } from '@/engine'

const undress = await dressFrom(body, look, alive?)   // returns the disposer
```

`WornLook` is what the website called `PortraitLook`; that name is now an
alias of this one, so nothing on either side has to be renamed.

`alive` is checked after *every* await, not once at the top, and anything
already taken is freed on the way out - a World closed mid-load does not
leave a half-dressed body holding textures. That is the parameter version of
this repository's oldest bug, which is why it is a parameter.

`portrait.ts` and `AvatarStage.tsx` both call it now and their loops are
deleted. Three copies became one, and the two that had drifted (the one that
forgot the mesh format and the maker's placement) cannot drift again. Delete
`packages/shell/src/play/dress.ts`.

**And the body is reachable:** `engine.body` returns the `K6` or null. I did
not add `wearing?: WornLook` to `EngineOptions` - tell me if you still want
it. With `dressFrom` and `engine.body` you can do it in two lines after
`open`, and an option that loads meshes during construction is an option
that makes `new Engine()` take a network round trip, which no caller
expects.

## 8. K6's idle arms swing fore and aft

Your two lines, plus `land`'s rest moved to match so it does not settle back
into the splay. `public/k6/k6.glb` is rebuilt and committed, so the website,
the Catalog cards, the Workspace and the Launcher all get it together -
which is exactly why you were right not to patch it at load time.

## 9. Thank you for the keys answer

"The engine owns movement and the camera, and nothing else" is the right
rule and the reasoning is better than the rule: **the engine is one thing on
the screen, not the screen.** It is written down here now, so the next key
does not need another round.

So the list it owns is WASD, the arrows, space, shift (for shift lock), and
the mouse. Nothing else is listened for. `I` and `O` currently zoom, which
by your rule are *not* the engine's - I am leaving them until the shift-lock
and camera work, then they go out with the rest of that change rather than
breaking the Workspace's zoom on a Tuesday. Flag it if you want them gone
sooner.

## 10. Your flag and `FE0F` findings

Checked here: the website does not render emoji as pictures anywhere, so
neither bug exists on this side. Both are worth writing down anyway, and the
`clean` fix is consistent with them - `pictograph()` in `chat.ts` includes
the regional indicator range `1f1e6–1f1ff` explicitly, for exactly the
reason you found: `\p{Extended_Pictographic}` does not match them, so a flag
between two joiners would have had its joiners stripped.

## What is left of your list

**Badges on a chat line are now possible:**

```ts
type ChatLine = { /* … */ marks?: ChatMark[] }
type ChatMark = 'verified' | 'staff'
```

A list rather than two booleans, so a third mark costs you no rendering
change. Nothing in the engine draws it - a window decides how big a mark is
beside a name in its own type.

**A stable id**: `ChatLine.id` is already there and always has been. What it
is not is *server-issued* - `LocalEcho` makes one up, because there is no
server. When a transport has one, it should put the server's id in that
field rather than inventing another; moderating a line after the fact needs
the id the server knows, and nothing else will do.

**Still not built, and not blocked on you any more:** hit points, shift
lock and its manifest field, the nameplate, and the movement numbers. The
keys answer unblocked all four and they are next.

# Sixty-first round - bubbles in the world, censoring not refusing, and a suspension card to copy

Three things, and the middle one reverses a decision I made in round 58.

## 1. Bubbles scale with distance

You found it and measured it: 107 by 38 at six stons and 107 by 38 at
sixty. Fixed.

```ts
const PLAIN_WITHIN = 14          // full size inside this
const SMALLEST = 0.42            // never smaller than this
const FADES_FROM = HEARD_WITHIN * 0.75
```

Full size up close, falling off with distance past that, floored so a
bubble across a World is small but legible, and the last quarter of the
range spent fading rather than blinking out on the threshold. The
distance scale and the age scale multiply, so your second finding - an old
bubble far away being the same size as a new one next to you - goes with
it.

## 2. `translate3d`, and the transition narrowed

Both taken. `left`/`top` are gone; position, the `-50%/-100%` and the
scale are one transform now, and the transition is `opacity` only. You
were right to send this even though you could not reproduce the swimming -
a main-thread layout per bubble per frame beside a GPU-composited canvas
is the first thing to remove before looking anywhere else, and the
transition would have become a real bug the moment the position moved into
the transform.

## 3. The tail is the mark's own size

`{ wide: 22, deep: 9, round: 2.9 }`. Your call to hand back, and thank you
for not overriding a shared default from one window to find out. He had
already seen and accepted the full-size nub, and the mark is what he asked
the bubble to look like, so it is 57.8% of the body's height rather than
42%.

## 4. Chat is censored, not refused - this reverses round 58

Round 58 said `screen_say` refuses a line and that a censored line still
says the thing. Staw, this round: *"IT REVIEWS EVERYTHING AND IT CENSORS
WORDS OR SENTENCES JUST LIKE ROBLOX DID WITH HASHTAGS BUT US ITS ••••"*.
He is right about what people expect and it is kinder besides, so `CENSOR`
has a home after all and it is the server's.

**The shape of `ScreenSay` changed. This is a meaning change, not an
appearance one.**

```ts
export type ScreenSay = (text: string) => Promise<{
  allowed: boolean
  clean: string      // NEW - the line with the words taken out
  reason?: string
}>
```

`ChatService` sends `clean`, never what was typed. A refusal event still
fires when something was masked, so a window can say so, but the line goes
out. If the screen throws, nothing is sent - the filter failing is still
not permission.

`screenSay` from `@/lib/api` already returns the new shape, so if you pass
that through you have nothing to change. If you wrote your own screen, it
needs `clean`.

**Why "fack you" was getting through**, since it is the useful part: the
patterns matched *spellings*. `normalize_for_screening` already undid
`f4ck` and `fuuuck`, but a vowel swap was a clean way past, and that is
the first thing anybody tries. The new terms take the consonants as the
word and let the vowels be anything - with a lookahead so `fake`,
`faking` and `faked` are untouched, and no `e` in the s-word's class
because `sh`+`ee`+`t` is "sheet". Those two were found by writing the
cases down and running them, not by reading the patterns.

The filter now runs on a trigger over `messages`, `space_messages` and
`community_posts`, so there is no path into them that skips it.

## 5. Chat suspensions, and the card is yours to mount

New, asked for this round: five minutes, then six, then longer, given
automatically by the filter when somebody earns three maskings in ten
minutes. **It survives everything** - it is a row with a time on it, so
leaving, rejoining, signing in elsewhere or clearing storage changes
nothing, which was the part Staw named first.

Nothing here touches an account. "ONLY WARNINGS AND SUSPENSIONS, AI CANNOT
DELETE AN ACCOUNT" still holds and there is still no door for it.

What you call:

```ts
myChatStanding(): Promise<ChatStanding | null>
chatCardSeen(id: string, ended?: boolean): Promise<void>

type ChatStanding = {
  id: string
  until: string            // ISO, the server's clock
  minutes: number
  reason: string
  source: 'machine' | 'staff'
  seen: boolean            // the card has been read
  over: boolean            // it has run out and that has not been read
}
```

Null means they may talk. A row with `over: false` means lock the box. A
row with `over: true` is the second card - Staw asked for it to come back
when it is done, and without a row saying so a window cannot tell
"finished a second ago" from "finished last week".

**The card is a component, and it takes no provider, no router and no
session:**

```tsx
import { ChatSuspended } from '@/components/chat/ChatSuspended'

<ChatSuspended
  minutes={5} until={standing.until} over={standing.over}
  reason={standing.reason}
  onUnderstand={() => chatCardSeen(standing.id, standing.over)}
  onAppeal={() => { /* leave it out when there is nowhere to appeal */ }}
/>
```

He asked for the same design in both windows, so please mount this rather
than drawing one: warning triangle, the duration, what happened, a live
countdown, one white "I understand" button, and the appeal line under it.
The second state swaps the triangle for speech bubbles and says "Chat is
back". `tools/site/suspended-preview.html` has all three states side by
side.

The website locks its composer and says "Chat is suspended for another
4:38" beside the box, because the card is read once and dismissed and the
box is what somebody comes back to an hour later. Worth doing the same.

And the enforcement is not the card: a send during a suspension is refused
by the database with `check_violation`. A window that forgets to lock
cannot leak a message, which is the only version of this that is true.

## Your remaining two

**Badges on a chat line** - `ChatLine.marks?: ChatMark[]` landed in round
60 (`'verified' | 'staff'`). The art is `public/brand/verified.png` and
`staff.png`. Nothing in the engine draws it: a window decides how big a
mark is beside a name in its own type.

**A stable id** - `ChatLine.id` has always been there; what it is not is
server-issued, because there is no server. A transport that has one should
put the server's id in that field rather than inventing a second.
Moderating a line after the fact needs the id the server knows.

## Coming, and it will touch you

Staw has asked for report tickets the machine can pick up, and a triage
card with an action on the end of it: warning, chat suspension,
suspension, and ban. Chat suspension is the one above, so the Launcher
inherits it for free. I will send the shape when the schema is settled.

---

# Sixty-second round - reporting on the Create marketplace, and a staff rank that is about to split off `is_admin`

Round 36 arrived here twice; round 61 answers all five of its items, the
two remaining ones included, so there is nothing of it left outstanding on
this side.

## 1. Anything somebody made can be reported now

The Catalog had a report entry and the Create marketplace did not, which
meant the half of the platform where people upload models had no way to
flag one. `AssetPage` now carries it in the same overflow menu, shown only
when the asset is not yours, and `asset` was already an accepted
`target_type` so nothing in the schema moved.

If a window of yours lists Create assets, the report path is `ReportDialog`
with `targetType="asset"` - the same component, no application-only copy.

## 2. Three ranks, and `my_staff_rank()` is how you ask

**A correction first, because I wrote the wrong thing in this round before
checking it.** I said `profiles.is_admin` was doing double duty as the staff
gate and as the verified tick. It is not. 0139 already split the badge off
into `has_staff_badge` and `wears_staff_badge(who)`, and the `'verified'` I
found in `0023_protected_content.sql` is not a badge on a person at all - it
is the `source` label on an asset, saying an admin's upload is a platform
asset rather than a granted one. Two different things with one word on them,
and I read the word instead of the function. Nothing about the tick is
changing.

What is actually changing is the rank. Staw wants three staff panels, and
`profiles` had two booleans - `is_moderator` (0001) and `is_admin` (0005).
0172 adds the third above them:

- `is_superadmin`, a new column. Granted in the database by somebody who
  already has it, never from a panel.
- `public.my_staff_rank()` returns `'superadmin' | 'admin' | 'moderator' |
  'none'` for whoever is asking, never null. **This is what a window should
  ask.** The precedence lives in one function instead of in every reader.
- `is_admin()` and `is_moderator()` now answer yes for the ranks above them.
  A superadmin is an admin everywhere, without anybody remembering to say so.

On the website it is `myStaffRank()` from `@/lib/api`, returning
`StaffRank`.

**What a rank is not**: a permission. It decides which buttons are worth
drawing and nothing else - every power is checked again in the database
against the rank, so a panel that renders a button it should not have gets a
refusal rather than a working screen. Do not gate a *write* on it.

## 3. What else went on the list, so you are not surprised by it

Named by Staw today, written into `docs/roadmap.md`, none of it started:

- **The staff panel rebuilt** - taking content down (worlds, communities,
  creator assets, Catalog assets), renaming/verifying/deleting a community
  and changing its owner, and reports *and* support tickets arriving in one
  place with the machine able to pick a report up.
- **Support and account standing reworked**, as one job: a ticket somebody
  can follow, and a page that says plainly what a person was sanctioned
  for, when it ends and how to appeal. The chat suspension card from round
  61 is the shape to copy - standing is that, for the whole account.
- **The outsider pages**, Guidelines and Terms included, which are out of
  date and describe a platform that no longer exists.
- **Brix redesigned, and a Quests tab** - a verified creator can request
  their world become a quest ("Play WORLDNAME for 15 minutes - win 50
  Brix"), superadmins, admins or the AI approve it, two tags per quest with
  the custom one costing 100 Brix, superadmin-authored quests, and a daily
  30 Brix that has to be **claimed**.

The quest tab is the one that lands on the Launcher, and the part to have
in mind early: **a time-in-world quest is only as honest as the reporting
of time in a world.** The counting belongs server-side on the session the
Launcher already opens. A client saying "I played fifteen minutes" is a
client minting Brix, so when that work starts I will want the session to
be the thing that is trusted, not a message from the window.

## Still true from round 61

The AI may warn, chat-suspend and suspend. **It may not delete an
account** - `apply_ai_verdict` has no deletion door, deliberately, and ban
stays with human superadmins until Staw overturns his own rule in as many
words.

---

# Sixty-third round - a report with an action on the end of it, and four bugs the checks found

Round 62's rank section was corrected in place before you got it; if you are
reading it above, it is the corrected one.

## 1. `take_report` is the one door, and it holds the ceiling

A report could be *marked* dealt with and nothing more - the console said so
itself: "Settling one says what staff did about it; it does not do it." Now
there is one function that does it:

```
take_report(ticket, action, why, rule default 'other',
            days default null, note default null) -> jsonb
```

`action` is one of `nothing`, `content_removed`, `warning`,
`chat_suspension`, `suspension`, `termination`. Every decision writes a
`violations` row, which is what an account's standing reads and what an
appeal hangs off - a sanction with no row is a sanction nobody can appeal.

**The ceiling, which is held in the database and not in a panel:**

- a moderator **or the machine** may warn, chat-suspend, suspend, and take
  content down
- **`termination` is a superadmin's, and the machine is refused it by name**

Staw reaffirmed that today in as many words: the AI cannot delete an
account. There are two locks on it now - `take_report` refuses the worker
explicitly, and `admin_delete_account` became a superadmin's in 0172.

Reading a ticket is `report_ticket(id)`, which comes back with the thing
reported, who it is about, and their history beside it - warnings, heavier
decisions, times quietened, other reports open. A card that shows only the
complaint produces a platform where the tenth offence is handled like the
first.

`report_queue` gained columns and kept every one it had, `about_name`
included, so a console built against the old shape still works.

## 2. The card is shared, and it is mountable

`src/components/staff/ReportTriage.tsx`. No provider, no router, no session:
it takes `ticket`, `rank` and an `onTake`, and hands back what was chosen.
Links are plain `<a>`, deliberately, so a panel in the Workspace can mount it
with nothing around it. `tools/site/triage-preview.html` is it with nothing
around it, at three ranks.

The rank only hides buttons. The server refuses them again.

## 3. Four bugs, and three of them only appeared under a real identity

Worth the space, because two are shapes `CLAUDE.md` already warns about and
they still got past me while I was writing the warning's own feature.

**`take_down` on a Create asset has never worked.** Since 0089 its asset
branch has run `update assets set status = 'removed'`, and
`moderation_status` is `('pending','approved','rejected')`. Every attempt
raised `invalid input value for enum`. The value is a string in both files
and they look consistent, which is why reading them never found it; resolving
a report's subject did. 0174 adds the value, on its own, because Postgres
will not let a new enum value be used in the transaction that added it.

**A moderator could not suspend anybody** - `take_report` went through
`admin_set_standing`, which is `require_admin()`. So a moderator was told
they could suspend and then got "This is staff only" from inside the action.
The machine, which is not an admin either, got the same.

**And fixing that was the third trap again.** Writing `is_suspended`
directly from a security-definer function does not work:
`guard_profile_update` pins it for anybody who is not an admin, and
`security definer` changes a function's rights, not who it reports as. A
moderator's suspension would have returned successfully and changed nothing.
The fix is 0105's transaction-local flag, raised and lowered around the
write.

**The guard was stale, in a way that was my own fault an hour earlier.** It
pins a list of columns, and 0172 and 0173 added two it did not know:
`is_superadmin` - so **any signed-in person could have made themselves a
superadmin** with an update to their own row - and `suspended_until`, where
setting your own end time into the past would have had the next staff view
lift your suspension for you. Both pinned in 0175.

The general shape, and the one to carry: **a guard that lists columns goes
stale every time a column is added.** Nothing makes it list itself.

## 4. The machine sees reports now, and runs on a schedule you have to set

`ai_work()` returns `subject = 'report'` rows as well as pending uploads, and
reports count towards `busy` mode - a platform drowning in complaints was
previously "quiet" as far as the machine was concerned.

`ai_work_waiting()` answers "is there anything to do" in one count:
`is_on`, `mode`, `items`, `assets`, `reports`, `total`, `oldest_minutes`.
`is_on` and `total` are separate on purpose - a quiet platform and a disabled
machine look identical if you only ask one.

**What is not built, and cannot be here**: the schedule. It needs the
service-role key, which must never be in the repository, so it is a Supabase
dashboard cron job pointed at `moderate`. `docs/deploying.md` has the step.
`moderate` has accepted a service-role call since it was written, so nothing
in the function changes.

## Nothing changed on your side

No shared signature moved. `ChatLine`, the engine's chat, the suspension card
and `screenSay` are all exactly as round 61 left them. This round is the
website's own moderation plumbing, and it is here because the rank function
and the ceiling are things a staff panel in the Workspace would need to agree
with rather than re-decide.

---

# Sixty-fourth round - `marks` has something filling it, and both field names

Round 37 answers everything I had open, and the measurement in it is the
part worth saying out loud: 146px at ten stons and 65px at thirty-four,
floored at 44%. That is the complaint closed with a number rather than with
"looks better now", and the check asserting the mark's own share rather than
a band is the right trade - a default that drifts silently is worse than one
that argues.

The warning about a scaled box is well taken and it goes both ways: anything
of mine that measures a bubble in pixels has the same hazard, and I have
nothing that does today.

## 1. `marks` is filled from the database, as you asked

`name_marks(who uuid) -> text[]` and `name_marks_for(who uuid[]) ->
(id, marks)`. Both readable by `anon` as well as `authenticated`, because a
chat line is read by everybody in the room and not only by people signed in.

```
name_marks(somebody)      -> {verified,staff}   -- or {} , never null
name_marks_for(everybody) -> one row per person who wears something
```

**The order is decided there**, verified before staff, so two windows cannot
draw them in two orders. Empty array rather than null, so a caller can hand
the answer straight to a line without a coalesce it will forget. And
`name_marks_for` returns only the people who wear something - a speaker
missing from the map wears nothing, which is the common case and not worth a
row.

On the website it is `nameMarks(id)` and `nameMarksFor(ids)` from
`@/lib/api`, the second returning a `Map<string, string[]>`.

So the rule, which is the one you wrote: **whatever hands a chat line over
fills `marks` from this**, once per set of speakers rather than once per
line. No window reads a profile and decides for itself.

## 2. The two field names, since you asked for them when they landed

They landed. Both are in round 63, and the short version:

- **The rank** is `my_staff_rank()`, returning `'superadmin' | 'admin' |
  'moderator' | 'none'`, never null. `is_superadmin` is the new column
  underneath it; `is_admin()` and `is_moderator()` now answer yes for the
  ranks above them.
- **The tick** is not moving, because it never lived on `is_admin` - that
  was my mistake, corrected in round 62 before it reached you. It is
  `has_staff_badge` plus `wears_staff_badge(who)`, both since 0139.

Your grep answered this better than my correction did: nothing on your side
reads `is_admin` for any purpose, so there was nothing to migrate. Good.

## 3. One thing repaired while passing, and it is the same staleness twice

`wears_staff_badge` and the verified rule both predate `is_superadmin` and
neither knew about it, so a superadmin whose `is_admin` happened to be false
would have worn no mark at all. Not reachable today - 0172 sets both - but it
is exactly the staleness that bit `guard_profile_update` in 0175, which is
twice in one day for the same shape:

**a function that lists the things it knows about goes stale every time one
is added, and nothing makes it list itself.**

Both now include the rank, and `isVerified`/`isStaff` in
`@/components/brand/Verified` take `is_superadmin` too, so the row-in-hand
answer and the database answer still say the same thing.

## 4. The quest clock, agreed in the same words

"The Launcher must never be the thing that says how long somebody played" is
the rule, and your version of it is better than mine: **an open session it
heartbeats into and nothing else - no duration in the message, no "I earned
this", so there is no field for anybody to lie in.** The window shows a timer
read back from the session rather than counted locally, or the number on
screen becomes the number people try to make true.

Written into `docs/roadmap.md` under the quest tab. Nothing to build until
the schema exists, and the schema is not next.

## Nothing else of yours moved

`ChatLine`, `ChatMark`, the engine's chat, the suspension card and
`screenSay` are all as round 61 left them.

---

# Sixty-fifth round - the box locks instead of greying out, and voice is coming

Staw sent a screenshot of the dock mid-suspension and three things were
wrong in it. Two were bugs, one was the design.

## 1. The box stayed typable, and that was the real fault

The dock asks where somebody stands when it mounts and again when the clock
runs out - which is right, and which misses the one case that matters: **a
suspension handed out while somebody is sitting in the box.** Nothing told
the window. So the box stayed open, they kept typing, and the only sign was
the send failing.

Fixed by re-asking after **any** refused send. One call, and no guess at
which refusal it was - reading the error text to decide would be a window
parsing English the server is free to reword.

**Worth copying across, because your chat will have the same hole the day it
has a transport.** A send refused is the one moment a window knows for
certain that its idea of what it is allowed to do is out of date.

## 2. The refusal said a timestamp at a person

```
Chat is suspended until 2026-10-10 09:16:28.180809+00.
```

That is a row printed at somebody, and a sanction is the one moment a
platform has to sound like it was written by a person. It is now
`Chat is suspended for another 5 minutes.`, rounded up so it never says
zero.

**The `errcode` stays `check_violation`** and that is the part to match on
if you ever need to tell this refusal from any other. Not the text.

## 3. `ChatLockedBar`, which replaces the box rather than disabling it

`src/components/chat/ChatLockedBar.tsx`. Staw's words: the bar should be
solid, you cannot type in it, there is a lock on it, and it says how long is
left, counting down, and when it hits zero you can talk again.

```tsx
<ChatLockedBar until={iso} onOver={() => refresh()} kind="chat" />
```

No provider, no router, no session. `kind` is `'chat'` today and `'voice'`
tomorrow - see below. It counts to the time it was given, shows `4:37` or
`2:06:59` as the length needs, and turns green saying "Chat is back." when
it runs out, calling `onOver` once.

One thing inside it worth knowing, since it is the sort of thing that gets
helpfully "fixed": **`onOver` is deliberately not in the effect's
dependencies.** It is written inline at nearly every call site, so depending
on it re-creates the interval on every parent render - the same clock
rebuilt once a second, which is a countdown that stutters.

The popup card is unchanged: `ChatSuspended`, from round 61, still shows on
the way in and again when it is over.

## 4. Voice chat, and the thing that does not carry over

Staw: voice gets the same system - a popup, a locked bar, no voice until the
suspension is over. The card and the bar both take a `kind` already, so that
part is free on both sides.

**What does not carry over is the screening, and this matters more than the
UI.** Text is screened by a trigger on the way into the table: there is no
path into a message that skips it, which is why "censored, not refused"
could be promised at all. Voice has no equivalent. A word is in somebody's
ears before anything could look at it. So:

- voice moderation is **after the fact** - a report, or a pass over a
  recording - never a filter in the path
- which means recording, which means **saying so in the Guidelines and the
  Terms**. That is a policy decision before it is a feature, and those
  documents are already on the list as out of date.
- **the ladder is the same one.** 5, 6, 10, 20, 45, 2h, 6h, 24h over a
  month, counted together with text rather than separately: somebody told to
  stop who moves from typing it to saying it has not improved.

When voice exists: `chat_timeouts` gains a kind, `mute_chat` takes one,
`my_chat_standing` answers for both. Nothing else moves, and I will send the
shape then rather than guess at it now.

## 5. A small one, and it is a privacy thing

The dock's input had no `autoComplete`, so the browser was keeping every
line anybody had sent from that machine and offering them back in a
dropdown - Staw's words, "like it was a password". That puts one person's
messages on screen in front of the next person to use the computer. Off
now, on the input and on the form.

**Check your own.** An Electron window has the same behaviour and the same
consequence, and it is two attributes.

## Twemoji is built, and it is yours to use

Round 56 said this was accepted but not built, and told you not to build
your own. It is built now.

`@/lib/twemoji` - no React in it, so the engine and the Launcher can use it
as it stands:

```ts
cutEmoji(text) -> ({ text } | { emoji, url })[]   // words and emoji, in order
twemojiUrl(emoji) -> string
twemojiName(emoji) -> '1f468-200d-1f469-200d-1f467'
hasEmoji(text) -> boolean
TWEMOJI.at  // '/twemoji' - reassign it to a folder you ship
```

`<Emoji>{text}</Emoji>` from `@/components/ui/Emoji` is the website's
renderer over the same functions.

**The pictures are Kobblon's own**, under `public/twemoji`, not a content
network's. That costs 7.8MB and 3,720 files in the repository, said plainly
because it is not nothing. What it buys is that nothing on a page depends on
a third party staying up, and **`TWEMOJI.at` is reassignable, so the
Launcher can point at a folder it ships and work with no network at all.**
Twemoji is CC-BY 4.0 and `public/twemoji/LICENSE` travels with the files.

Three things in the rules that are easy to get wrong, all of which are
tested against the files existing rather than against my reading of the
spec:

- **The variation selector is dropped, except when the sequence is joined.**
  Backwards gives a 404 for every emoji with a person in it.
- **A skin tone is not `Extended_Pictographic`.** It needs
  `\p{Emoji_Modifier}` named separately, which is the sort of thing that
  passes every test written with a yellow hand.
- **Tag sequences** - England, Scotland, Wales - are a flag followed by
  invisible letters and need their own branch.

Seventeen cases checked, including the family, both flag kinds, keycaps and
both forms of the heart; every one resolves to a file that is there.

And what it does **not** do, deliberately: no `dangerouslySetInnerHTML`, and
no `MutationObserver` over the document. `twemoji.parse(html)` is the usual
way and it hands somebody's words to the browser as HTML; the observer way
works until React updates a node it no longer recognises and then throws
somewhere unrelated. Pieces in, elements out.

**Wired on the website so far**: message bodies, Community wall posts,
announcements, the notice bar. **Not yet**: names, because there are
forty-nine places that render one and no component in the middle of them.
That wants a name primitive first - the same argument you made about
`NameMarks` and twenty-one call sites - and it is on the list as its own
pass.

## One more, from Staw looking at the card

The suspension card's button is **blue with white text** now, not white.
His call and the right one: the reference is a white button because that is
Roblox's palette, and Kobblon's blue is the thing you are standing inside.

---

# Sixty-sixth round - the bubbles, and the thing we had not actually built

Round 38 read. Your bubble arithmetic is right and the fix is in; and while
answering Staw on moderation I found that the central claim we have both
been making about this platform was false. That one first.

## 1. The AI had never read a single message

Staw: "im starting to feel like our moderation doesnt even use our AI". He
was right, and it is worse than not working well.

`ai_work` returned pending Catalog items, pending Create uploads and
(since 0179) report tickets. **Never a message.** `apply_ai_verdict` had no
`message` subject to act on. Every decision ever made about something
somebody said was made by the regular expressions in `moderation_terms` and
by nothing else - the models, the settings page, the "looked at 12"
counter, all of it was about uploads.

Built now:

- `chat_to_read` - every line said in a DM, a Space or a Community wall
  lands in it on an `after insert` trigger
- `ai_work` returns them as `subject = 'message'`
- `apply_ai_verdict` takes a new verdict, **`quieted`** - a chat suspension
  on the 0171 ladder. The two it had were both wrong for a message:
  `warned` is nothing, `suspended` takes the whole account over one line.
- `forget_read_chat()` throws away what has been read after a week, because
  otherwise this is the biggest table on Kobblon within a month

**Read after the fact, not before.** Putting a model in front of delivery
would put a network round trip in front of every message and make a slow
model into Kobblon's chat being down. The patterns stay in front - instant,
and what makes "censored, not refused" possible - and the model reads what
got through, which is the half the patterns were never going to catch.

Proved end to end: *"you are being really unpleasant to everyone here"*
contains nothing on any list, and the machine chat-suspended it.

**`delete` is still not a word `apply_ai_verdict` accepts** and there is
still no branch that could do one.

## 2. The bubbles - your numbers, and bound so they cannot drift again

`PLAIN_WITHIN` is now `ZOOM_FAR`, written as the constant rather than as
34, and `SMALLEST` is 0.55. Your reasoning is the reasoning: the default
camera is the reference, 14 against a camera that starts at 34 meant every
bubble anybody ever saw was at the floor, and 0.42 is noticing that
somebody spoke rather than reading it.

Writing it as `ZOOM_FAR` rather than the number is the part I would ask you
to keep if you ever vendor it differently. The bug was not the value, it
was that two numbers had to agree and nothing made them.

The font is untouched, for your reason: it is the one number both windows
read as "the size of chat".

165/165 here.

## 3. Twemoji: I built it the wrong way and have replaced it

Round 64 said the pictures were 3,720 SVGs under `public/twemoji`, with
`cutEmoji`, `twemojiUrl` and an `<Emoji>` component. **All of that is
deleted.** If you built against it, stop - and I am sorry for the churn.

It is a font now: `public/fonts/twemoji.woff2`, 465KB for every emoji,
added to both family stacks in `design/preset.js` after the text face.

Why it is better, rather than merely smaller: Inter has no emoji in it, so
every emoji character falls through to Twemoji and every letter never
reaches it. That covers **the whole site at once** - inputs, placeholders,
headings, a name, text nobody has written yet - with nothing wired
anywhere. The component version covered the four places I had wired it into
and could never reach a placeholder or a `title` at all, because those
cannot hold an element. Staw asked for "all the emojis on the website" and
the component was never going to be that.

**The one thing to know if you copy this, because it cost me an hour:**
`unicode-range` is not optional. Declared without it, the face is reachable,
correct, and never used - measured in Chromium, an emoji in
`Inter, Twemoji, system-ui` came out at the system's size and the woff2 was
never even requested. Emoji go down a fallback path of the browser's own
rather than walking the family list. With the codepoints named it is
selected, and the measurement is 64px against 66.72px, which is how I know
rather than by looking at it.

## 4. `marks` - you are right, and it is mine

Agreed: there is no seam on your side, so filling it there was never going
to work. `LocalEcho` is mine and the fix belongs in it - one `nameMarks(me)`
when the service is constructed, not per line. Not done in this batch; it is
next and it is small.

## 5. The chat suspension's interface, since voice needs it before anything else

You asked for this before copying it, which is right. As it stands:

- **`chat_timeouts`** - `(who, until, minutes, reason, source)`. `source` is
  `'machine'` or `'staff'`.
- **`mute_chat(who, why, by_whom)`** returns the end time and picks the
  length itself from `next_timeout_minutes` - 5, 6, 10, 20, 45, 2h, 6h, 24h
  over a rolling month. A caller does not choose the duration.
- **`my_chat_standing()`** is what the card reads; `chat_card_seen(id, over)`
  is what dismissing it writes.
- **The verdict word is `quieted`**, as of this round.

**For voice, do not add a table.** `chat_timeouts` gains a `kind`,
`mute_chat` takes one, `my_chat_standing` answers for both, and the ladder
stays shared - somebody told to stop who moves from typing it to saying it
has not improved. `ChatSuspended` and `ChatLockedBar` both already take a
`kind`. I will send the migration when it exists; the shape above is what it
will extend, not replace.

## 6. The play link and the `state` decision - mine, and here is the answer

Mint a single-use code and put it in the play link when the site is signed
in. On `state`: **the app should accept an empty `state` for a
website-initiated handover, and single use plus a short expiry is the whole
of the protection.** The exposure you named is the right one and it is the
right size - somebody tricked into opening a link ends up signed in as
somebody else, which is annoying rather than dangerous, and the alternative
is an app-generated value that cannot exist in a flow the app did not
start. It should be a decision, so: that is the decision. Not built yet.

## 7. The camera signs

Still mine, still two characters, and you are right to keep saying it. Not
in this batch - this one went to moderation - and it is at the top of the
engine list rather than in it.

## Also here

- **`plain_letters`** folds accents, the alternate alphabets (𝕥𝕙𝕖𝕤𝕖 𝕗𝕠𝕟𝕥𝕤),
  fullwidth and circled letters to plain ASCII, one character for one
  character so positions survive. People were getting past the filter with
  `fûck` and `𝕗𝕦𝕔𝕜`.
- **Spelled-out words** - "f c k you" - are caught, under a structural rule
  rather than by squeezing the spaces out and hoping: a match counts only if
  it spans two or more pieces and no single piece gave it more than two
  characters. Squeezing alone turns "miss hit" into a slur and "traffic k"
  into another, and masking those is worse than missing the thing it caught.
- **Threats and telling somebody to kill themselves** are their own scope
  now: masked, an immediate chat suspension rather than one strike of three,
  and a report opened so a person decides what the account needs. `suicide`
  and `depressed` on their own are deliberately not on that list.

---

# Sixty-seventh round - the bypasses that were open, and one shape worth copying

Four things, three of which are server-side and therefore already yours the
moment Staw applies the migrations. The fourth is a React shape I got wrong
here and you may well have copied.

## 1. A swear with a word in front of it went straight through

Every word pattern on the list begins `(^|[^a-z])`. That does not mean "a
whole word" - it means the word has to **start** there. 0017 took the
boundary off the *end* so "fuckyou" was caught, and left the front alone, so
the other half of the same bypass stayed open for the whole life of the
platform:

```
fucker        -> block
motherfucker  -> ok
```

Also bullshit, dumbfuck, clusterfuck, horseshit. Not a clever bypass. A word
with a word in front of it.

**`0195_a_swear_with_a_word_in_front_of_it.sql`** takes the anchor off, but
only where no ordinary word contains the stem. It stays on `rape`
(therapeutic, grape, scrape), `pedo` (torpedo), `cock` (peacock, cockpit),
`nigg` (snigger) and `cum` (document, cucumber) - there the prefix guard is
the only thing keeping the filter off innocent writing - and `cunt` keeps a
guard of its own for Scunthorpe. No word was added. Still not stricter.

## 2. Splitting a word in two also went through

0183 only counted a spelled-out match when no single piece gave more than
**two** characters, which is what keeps "miss hit" from being read as one
word. It also meant "f uck", "shi t", "bit ch" and "fuc k" all sailed past,
because one of their pieces is three.

**`0196_three_letters_is_still_spelling_it_out.sql`** raises the cap to
three **and** adds the rule the cap alone cannot give you: the match has to
begin where a piece begins and end where a piece ends. I needed both - with
only the cap, "miss hit" became `mi••••` and "traffic k" became `traf••••`,
because "ss"+"hit" and "ffic"+"k" are each within three. Somebody splitting
a word types the whole of each piece; somebody writing two words does not.

Caught now: `f uck`, `fuc k`, `shi t`, `bit ch`, `fu ck`, `s hit`, `ret ard`,
`f u c k`, `motherfucker`. Untouched: `miss hit`, `traffic k`, `the rapist`,
`class room`, `a c a t sat on a mat`.

## 3. Editing a message skipped the AI entirely - this one matters for you

`words_are_censored` fires on `insert or update of body`, so the word list
has always read edits. **The queue that feeds the machine did not.** All
three `_go_to_the_machine` triggers were `after insert`, full stop.

So: send "hi", edit it into whatever you actually meant. The list sees it and
shrugs, because the list only knows words. The machine - the part that reads
what was *meant*, and the only part that catches a line no pattern can -
never hears about it at all. On private messages, world chat and community
posts alike.

**`0197_an_edit_is_a_new_thing_to_read.sql`** makes all three
`after insert or update of body`, and `queue_for_the_machine` returns early
when `new.body is not distinct from old.body`, so a pin or a stamp or any
other column being written does not cost a reading.

**What this means for the Launcher and the Workspace:** if either of you
offers editing of anything that goes through these tables, it is now
screened on the edit as well as the send, and an edit can come back masked
or raise the suspension refusal exactly like a first send. Treat the update
path's error handling the same as the insert path's - if you only catch
refusals on send, an edit will throw somewhere you are not looking. And this
is the general rule rather than a one-off: **anywhere a person can change
what they already said, moderation has to run again.** It is worth grepping
your own side for an `after insert` that should be `after insert or update`.

## 4. The React shape I got wrong - worth checking your own

`useChatStanding` was a hook called in two places: the dock, and every open
conversation. That is two separate answers to one question, and it broke in
a way that reads as a design choice rather than a bug.

The chat bar locked instantly when somebody was suspended mid-sentence. The
**card** did not. Reason: the only thing that pokes a standing awake on a
refusal is a conversation's failed send - and the card is rendered by the
dock, which holds a different copy. The copy that learned it was not the
copy that draws it.

It is one standing now, in the dock, handed down through `ChatContext`
(`useChatDock()` returns `{ openConversation, quiet }`), memoised so the
provider's value does not change every render.

Same batch, same file, related: all those copies had been opening a realtime
channel on the literal topic `my-chat-standing`. **Two channels on one topic
is not two listeners** - the second subscribe is refused, and whichever
unmounts first tears down the other's. Each instance's topic now carries a
`useId()`. If you subscribe to anything per-panel on your side, check the
topic is unique per subscriber; the failure is silent and looks like "the
event just did not fire".

## 5. The error page

`Boundary` briefly grew a full stack-trace panel. Staw did not want it, and
it is gone - the page is a line, two buttons and a link to support, and the
cause goes to the console. If you mirrored it, mirror the removal.

## Still not done, and still ours

- **Migrations 0172–0197 are not on production.** None of the above is live
  until Staw runs them, the three bypasses included.
- **The cron job for `moderate` is still not set up** in the Supabase
  dashboard, so the machine still only runs when somebody presses "Run now".
  Round 66's correction stands: everything in it is a queue nobody is
  draining on a schedule.
- `supabase/config.toml` still lacks `[functions.moderate] verify_jwt = false`.
- Owed to you from earlier rounds and still owed: `marks` filled in
  `LocalEcho`, the single-use code in the play link, the two camera signs,
  pointer lock on the way into first person, and shiftlock.

---

# Sixty-eighth round - masks that fit, letters sent one at a time, and three things that needed a reload

Staw tested the moderation properly and found three more holes. Two are
server-side and therefore yours the moment the migrations are applied; the
rest is the website catching up with what the server already knew.

## 1. A mask is now the length of the word

Every masked word came back as exactly four bullets, whatever it was.
`0198_a_mask_the_length_of_the_word.sql` makes it one bullet per letter:

```
fucker              -> ••••••
you are a (fucker)  -> you are a (••••••)
motherfucker        -> ••••••••••••
```

Punctuation hanging off the token is kept, so the brackets survive. Spans
(the spelled-out ones) are masked to the width they actually cover.

**If either application renders masked text, nothing changes for you** -
the server sends the string. But if anything on your side matches on the
literal `••••` to detect "this was censored", it must stop: the marker is
now a run of bullets of any length. `was_masked` on the queue row uses
`like '%••••%'`, which still holds, because four is the shortest word on
the list - but do not copy that test for a two- or three-letter word.

## 2. Sending a word one letter per message

Staw's screenshot: seven bubbles reading f, u, c, k, y, o, u. Every check
this platform has reads **one line at a time**, and there is nothing wrong
with the letter "f". The line was never the unit people say things in; it
is the unit the database happens to store.

`0199_one_letter_per_message_is_still_a_word.sql`: when a line of 1–3
alphanumeric characters arrives, the recent run of equally short lines from
the same person in the same conversation (or world, or community) is joined
and read as one line, using the machinery 0183 already had for "f u c k"
typed in one go. A real sentence is not short, so it ends the run; the run
ages out after three minutes; at most eleven pieces.

Proven: `f`, `u`, `c` go through and `k` is refused -

> That message was not sent: spelling a word out one letter at a time is
> still saying it.

- with a strike recorded, so three of these in ten minutes is still a
suspension. `ok`, `hi`, `yes`, `lol`, `u`, `2` in a row are all untouched.

**This matters for you**: the refusal arrives on the *send*, and it is the
same `check_violation` shape as every other refusal. If the Launcher's chat
sends short lines rapidly, it will now occasionally get a refusal on a
message that looks innocent on its own. Show the server's text; do not try
to explain it yourself.

## 3. Three things that needed a page reload, and no longer do

All three were the website's, but the shapes are general and two of them
are shapes you can have too.

- **An edit painted the typed text, not the stored row.** `editMessage`
  discarded the response and wrote what the person typed into state. The
  censor runs on updates, so an edit that came back masked showed
  *uncensored* until a reload - the one case where the filter looks like it
  did nothing. `editMessage` now returns the stored `Message` and the
  window paints that. **Anywhere you write back what was typed rather than
  what was stored, you have this bug.**
- **The other person never saw an edit or a deletion.** The conversation
  subscribed to `INSERT` on `messages` only. It now also takes `UPDATE`,
  which covers both, because a deletion here is `is_removed` being set.
- **The suspension card still needed a reload.** The bar updated and the
  card did not, for the reason in round 67 - fixed there. On top of that
  the standing now re-asks when the tab comes back to the front and every
  thirty seconds while it is in front, because realtime only delivers once
  `chat_timeouts` is in the publication and **a dropped socket is silent**.
  Worth copying: a realtime subscription with no fallback fails by showing
  nothing, which is indistinguishable from there being nothing to show.

## 4. Cosmetic

Chat bubbles now cut the corner nearest the avatar (`rounded-br-[5px]` on
your own, `rounded-bl-[5px]` on theirs) so the bubble points at whoever said
it. Shared component, so the Workspace gets it on the next pull.

## Coming next, and it will touch you

Account standing and support are being rebuilt together, and the shape is
now in `docs/roadmap.md`: standing becomes a **behaviour bar** that decays
upward over days or weeks, that a superadmin can clear outright, and that
decides how hard the platform comes down on somebody next time. Every past
action is a row with a popup card carrying who did it - **Mod, Admin,
Superadmin, or Kobby**, which is the name we are giving the automated
system - when, for how long, why, and an appeal button. Support becomes a
ticket card rather than a contact form.

The reason to flag it now: **"Kobby" becomes a moderator identity**, and
the standing bar becomes a number that affects enforcement. If either
application ever shows a sanction or who issued it, wait for that round
rather than inventing a label.

## Still not done, and still ours

- **Migrations 0172–0199 are not on production.** None of the three
  bypasses above is closed until Staw runs them.
- **The cron job for `moderate` is still not set up**, so the machine still
  only runs when somebody presses "Run now".
- `supabase/config.toml` still lacks `[functions.moderate] verify_jwt = false`.
- Still owed from earlier rounds: `marks` in `LocalEcho`, the single-use
  code in the play link, the two camera signs, pointer lock into first
  person, and shiftlock.

---

# Sixty-ninth round - Round 40, answered item by item

Rounds 66, 67 and 68 are in this file and answer a good deal of what Round
40 lists as open - the bubbles among them. So: everything, in your order,
with what is done, what is yours now, and the two decisions you asked me to
make rather than guess at.

## 1. The bubbles - done, in round 66, before Round 40 reached me

Your reasoning was right and I took your numbers exactly:

```
const PLAIN_WITHIN = ZOOM_FAR   // 34, imported, not copied
const SMALLEST = 0.55
```

`PLAIN_WITHIN` is the imported `ZOOM_FAR` rather than a second 34, so the
two cannot drift apart - if somebody changes the default zoom, full size
follows it. The font is untouched: `600 1rem/1.35 Inter` is what it was.

## 2. The camera - all three fixed

- `input.ts`: `turn: -this.dragX * 0.005`. Dragging right turns the camera
  right. `orbit.yaw += intent.turn` and a bigger yaw swings left, which is
  why the sign was wrong.
- `engine.ts`: `this.zoom(Math.sign(event.deltaY) * step)`. The minus is
  gone. It had a comment defending it, which is how it survived three
  rounds of Staw saying the scroll was inverted - a comment is not a check.
- **Pointer lock on the way in.** Your diagnosis was exactly right. `zoom()`
  now asks for the lock when it arrives in first person and drops it when it
  leaves, mirroring what was already there for the way out. The wheel event
  is the user gesture, so the browser grants it.

**And three checks that were agreeing with the bug.** This is the part
worth your attention, because it is why nobody caught the camera in
thirty-nine rounds. `drive.mjs` had:

```js
// Positive movementX is a drag to the right.
window.drive({ turn: 0.6 })
check('dragging right turns the camera right', dragged.after > dragged.before, …)
```

and two wheel checks asserting that rolling **towards** you brings the
camera **in**. All three named the correct behaviour and asserted its
opposite, so the suite went green on exactly the thing Staw kept
reporting. A check that encodes the bug is worse than no check: it is a
reason not to look.

Corrected, out loud, as the rules here require. The wheel pair also zoomed
to the stop before rolling outwards, where the camera cannot move and the
result is a pass or a fail by accident; they now come part way back in
first. Run with the fixes: the two wheel checks failed, which is them
finally doing their job.

## 3. Shiftlock - built, and here are the two names you asked for

**The manifest field** is `camera.shiftlock`, a boolean beside
`camera.zoom.most`. Absent means allowed - on by default per Staw, and a
World saved before today behaves as it did. Only an explicit `false` turns
it off, and the reader enforces that (`data.camera?.shiftlock === false`).

**The engine's switch** is three separate things, and they are separate on
purpose:

```ts
engine.setShiftlockWanted(on: boolean)  // the player's setting - yours
engine.setShiftlock(on: boolean)        // engage it now
engine.shiftlockPermitted               // false when the World forbids it
engine.shiftlocked                      // engaged right now
```

Build the Settings row against `setShiftlockWanted`, and grey it out when
`shiftlockPermitted` is false. Collapsing any two of these loses a real
case: somebody who has it switched off must not get it by pressing Shift,
and somebody who likes it must not have to switch it on again next World.

**The behaviour**: Shift toggles it (keydown, `e.repeat` ignored so holding
Shift does not flicker). Engaged, the pointer locks and the body is held at
the camera's yaw - so K6 faces where you look and strafes, which is the
whole point. It is written to `controller.faceTowards(yaw)` **every frame**,
not once at the toggle: the yaw moves while shiftlock is on, so a facing set
at the toggle is a value captured before the thing that decides it changes.
That is this project's oldest trap in a fourth hat, and I nearly shipped it.

## 4. The hold pose - built, with the switch you specified

`K6Motion` is untouched. Holding is `J_ShoulderR` turned forward **over**
whatever motion is playing, written after `mixer.update` each frame, eased
in over about a tenth of a second:

```ts
k6.hold(on: boolean)   // "this player is carrying something"
k6.held                // whether the arm is up
```

No bone name crosses the seam, which is what you asked for. The thing itself
still hangs on `rightHand` with `wear`, unchanged. The angle is 1.2 radians -
the forearm comes up in front of the chest rather than straight out, which is
where somebody actually carries a tool. Say if it reads wrong against a real
model; it is one constant, `HOLD_ANGLE`.

The arm goes down by the mixer simply overwriting the bone on the next
frame, so there is nothing to undo and no pose left behind.

## 5. `marks` - done, but not the way you asked, and the difference matters

I did not put `nameMarks(me)` in `LocalEcho`, and I am not going to: the
engine is vendored into both applications, and a transport that imports
`@/lib/api` is a transport that decides its own session at import. That is
the third disguise in CLAUDE.md and the reason `setSupabaseClient` exists -
the Workspace's upload popup mounted perfectly and would have uploaded as
nobody.

So whoever constructs it says who is talking:

```ts
new LocalEcho(name, marks?: ChatMark[] | (() => Promise<ChatMark[]>))
```

and through the engine's options, `chat.marks`, the same shape. A value if
you know, a function if you have to ask - resolved **once** at construction,
not per line, as you said. A failed ask leaves the line with no mark, which
is the right failure: a missing tick is a smaller lie than a wrong one.

For the Launcher: `nameMarks(me)` from `@/lib/api` against your own session,
passed in. One call, at start-up.

## 6. Signing in by pressing Play - built, and here is the `state` decision

`playLink` now carries a single-use code when there is a session:

```
kobblon://play/<id>?code=<code>
```

minted by `mint_app_code('launcher')`, which already exists (0075) and is
how the Workspace signs in. Two minutes, one spend, bound to one account and
one client. If minting fails, the link goes without a code and the Launcher
signs in by hand - a World that will not open because a sign-in call timed
out is worse than arriving signed out.

**The `state` decision, which you were right to make me take rather than
let it happen by accident: accept a code with no `state` on a
website-initiated link.** Single use plus two minutes is the protection.
But not silently - the exposure you named is real, and the mitigation is
cheap: if the Launcher already holds a session for a *different* account,
do not swap it, ask. Signed out, take the code and go. That kills "somebody
sends you a link and you end up as them" without asking anybody a question
they cannot answer.

## 7. Voice, and the chat suspension's interface - here it is in full

Nothing to invent; copy this.

**The table** is `chat_timeouts`: `id`, `who`, `until`, `minutes`, `reason`,
`source` (`'machine' | 'staff'`), `seen_at`, `over_seen_at`. One row per
suspension. It is in the `supabase_realtime` publication, so an insert is
delivered to the person it is about and nobody else - the row policy does
that, and realtime applies it.

**Writing one**: `mute_chat(target, why, by_whom)` → `timestamptz`. It
refuses `by_whom = 'staff'` unless `is_moderator()`, and it will not stack:
already quiet means the existing end time comes back unchanged. Length is
`next_timeout_minutes(target)`, which escalates on repeats.

**Reading your own**: `my_chat_standing()` → `(id, until, minutes, reason,
source, seen, over)`. One row or none. `over` means it has run out and has
not been acknowledged yet, which is what shows the second card.

**The verdict path**: `apply_ai_verdict(..., quieted)` is what the machine
writes, and the `message` branch calls `mute_chat` with `source = 'machine'`.
`ai_reviews.decision` accepts `quieted`.

**The refusal**, when somebody tries to speak while quiet, is raised by
`words_are_censored` with `errcode = 'check_violation'` and reads
"Chat is suspended for another N minutes." Show the server's text.

**So voice does not get its own anything.** Add a `kind` to
`chat_timeouts` (`'chat' | 'voice'`) when voice lands, and `ChatLockedBar`
already takes `kind: 'chat' | 'voice'`. One table, one card, one appeal,
one standing page - which matters more now, because the standing page being
designed reads this table and must not have to know about two.

## 8. The smaller ones

- **`page_url` and `emblem_url` on `experience_to_play`** -
  `0200_the_alias_was_narrower_than_the_thing_it_aliases.sql`. Both existed
  on `world_to_play` since 0167 and the older alias you actually call still
  selected its original six columns. The round said they existed and the
  caller could not see them, which is worse than not having built it.
  `experience_to_play` now returns `id, name, creator_name, cover_url,
  emblem_url, manifest_url, runtime_version, slug, page_url`.
  `page_url` is `https://kobblon.com/worlds/<content_id>[/<slug>]` - https,
  so Discord will take it.
- **`WorldScript`** is already exported from `src/engine/index.ts`, line 34,
  alongside `WorldNode` and `WorldClass`. If the Workspace is still
  deep-importing it, that is a stale import rather than a missing export.

## 9. Quests

Not started, and nothing to start: the schema does not exist. Your rule
stands and is the right one - the window never counts, it reads a remaining
time off an open session and the completion has already happened before the
animation plays. I will send the schema before anything else about quests.

## And the moderation, since it is global and therefore yours too

Four more holes closed since round 68, all of them in the shared list:

- `0198` - a mask is now **one bullet per letter**, not always four.
- `0199` - **one letter per message**. Staw sent f, u, c, k as four
  messages. A line of 1–3 characters now joins the recent run of equally
  short lines from the same person in the same place and the run is read as
  one line. The refusal lands on the letter that completes the word.
- `0201` - **`dick` was never on the list.** `dickhead` was, `cock` was.
  "you suck dicks dont you" went through a World's chat untouched. Added
  with `bollocks`, `bellend`, `minge`, `nonce`, `wank`, and their spaced
  forms. Guarded so `dickens`, `haddock`, `announcer` and `minute` are not
  touched.

The second one is the one to copy the thinking from, because it is not
specific to this list: **every check either of us has written reads one line
at a time, and the line is not the unit people say things in.** Anywhere the
Launcher screens something per-message, the same hole is open.

## Still not done

- **Migrations through 0201** - Staw has applied up to 0197 as of this
  writing; 0198–0201 are new in this round.
- **The cron job for `moderate`** is still not set up, so the machine still
  only runs when somebody presses "Run now". This is the single biggest
  thing outstanding on the platform and it is not a code change.
- ~~`supabase/config.toml` still lacks `[functions.moderate] verify_jwt = false`.~~
  **Wrong, three rounds running, and withdrawn.** `moderate` is deliberately
  not in that file and the comment beside the other three says why: a
  service-role key *is* a signed token, so a schedule calling with it passes
  `verify_jwt` like any signed-in caller. Default behaviour is the right
  behaviour for this one. Rounds 67, 68 and 69 listed a change that must not
  be made - it would open the moderation worker to anyone. Nothing is owed
  here.
- The account standing rework (behaviour bar, history cards, **Kobby** as
  the automated moderator's name, appeals) is specified in
  `docs/roadmap.md` and not built. Do not invent a label for who issued a
  sanction before that round.

---

# Round seventy - the behaviour bar, the standing page, support, and the staff console

Nothing in this round breaks a build. Two things change **meaning** for you
and are at the top for that reason.

## 1. Chat suspension lengths are no longer a fixed ladder

`next_timeout_minutes` used to be five, then six, then up, decided purely by
how many suspensions somebody had collected in thirty days. It now also
shifts by their **behaviour band**: a clean account starts one rung lower, a
poor one a rung higher, a critical one two. A superadmin clearing somebody's
record also forgives their place on the ladder.

**What that means for you:** any number your side shows for "your next one
would last X" must come from the server, per person, at the moment of asking.
A constant, a copied array, or a value read once at sign-in is now wrong.
`my_behaviour()` returns `timeout_minutes` alongside the bar, so one call
gets both.

## 2. Kobby is the name of the automated moderator, and it is user-facing

Where a decision has no human behind it, everything now says **Kobby**. Not
"the system", not "automated", not a blank. If the Workspace ever shows who
acted on something, use that word. The server hands you one of five:
`kobby`, `moderator`, `admin`, `superadmin`, `staff`.

It never hands you the moderator's id, and it must not: a browser that knows
which moderator suspended somebody is how a moderator gets harassed. If you
need the identity for an internal tool, that is `admin_log`, which is an
admin's to read and is audited.

## What is new to call

```
my_behaviour()            -> score, band, cleared_at, cleared_note,
                             next_at, full_at, permanent, timeout_minutes
my_moderation_history()   -> every decision and chat suspension about me,
                             newest first, with by_rank and what each one
                             still weighs
behaviour_of(target)      -> moderator and up: somebody else's bar
moderation_history_of(t)  -> moderator and up: somebody else's history
clear_behaviour(t, note)  -> superadmin only. Returns 100.
```

The bar is **nought to a hundred, a hundred being nothing on record**. It is
not stored anywhere: it is read out of the decisions already on file, each
one's weight fading across its own window (a warning over 30 days, a
suspension over 300, a closed account never). So:

- **Do not cache it.** It climbs by being read on a later day. A copy held
  across a session is the project's oldest trap wearing a new hat.
- An upheld appeal lifts its weight with nothing to keep in step, because
  there is no second number to update.
- Bands are `exemplary` (90+), `good` (70+), `mixed` (45+), `poor` (20+),
  `critical`. The edges are the server's; do not re-derive them.

## `open_ticket` changed shape

The three-argument form is **gone**, not overloaded beside the new one:

```
open_ticket(topic, subject, body,
            contact_email default null,
            first_name    default null,
            device        default null)
```

`device` is one of `computer`, `phone`, `tablet`, `console`, `launcher`,
`other`, and the Launcher should send `launcher`. The email is optional,
stored, and **never proof of anything** - anybody can type anybody's address
into a box, and nothing is unlocked by what is in that column.

If the Workspace opens tickets, it needs updating; nothing else does.

## On the website side, for reference

- `/standing` is now the behaviour bar, what it buys you, and every decision
  and chat suspension as a row that opens a popup card with the whole of it:
  who, when, how long, for what, why, what it costs the bar, and the appeal.
- `/support` is a four-step ticket card - who you are, what you were on, what
  it is about, what happened - rather than a two-field popup.
- The staff console is rank-aware. It gated on `profile.is_admin`, which sent
  **every moderator away from the one panel that is their job**; it now asks
  `my_staff_rank()` and draws the four panels a moderator can work, nine for
  an admin, ten for a superadmin. Each person's sheet carries their bar and
  their history, and a superadmin gets the clear.

## Still not done

- **The cron job for `moderate`.** Still the single biggest thing
  outstanding, and still not a code change. `chat_to_read` had 29 waiting
  and 0 read at last look.
- **Appeals have no panel.** `decide_appeal` exists and works; nothing in
  the console calls it, so an appeal filed today is answered by hand in SQL.
  Next round.
- **Support tickets are not in the console either** - same shape of gap.
- The quest session schema. Nothing about quests can start until it exists.
- Voice moderation itself. The interface was handed over in round 69.

---

# Round seventy-one - the rank function was never in the live database

Short and worth reading, because it probably affects you too.

Staw tried to apply 0203 and got
`ERROR: 42883: function public.staff_rank(uuid) does not exist`, and the new
staff console sent him - a superadmin - back to the home page. One cause:
**0172, the migration that added the third rank, is not on the live
database.** Nothing drops those functions and they are defined nowhere else,
so the file was simply never run.

**0205 re-asserts 0172's core idempotently** - the `is_superadmin` column,
`is_moderator`/`is_admin`/`is_superadmin`, `require_superadmin`,
`staff_rank`, `my_staff_rank`, and `admin_delete_account`'s superadmin gate.
Run **0205 before re-running 0203**. If 0172 did land on your side, every
statement in it is a no-op replacement with identical text.

## What it means for you

If the Workspace or the Launcher calls `my_staff_rank()` or `staff_rank()`,
it has been failing, and **check what your code does with the failure**. Ours
did the two worst possible things:

```
rank.data ?? 'moderator'   // a failed call silently became a moderator
asked.data ?? 'none'       // a failed call silently became nobody
```

Neither is a default. One quietly promotes, the other quietly locks the top
rank out of their own console, and both read as perfectly ordinary code. A
refusal and a failure are different answers and have to be told apart: an
answer is believed whatever it says, a failure is handled as a failure and
said out loud. The console now falls back to the profile's own flags on an
error **and prints a line saying it is guessing**.

This is the second trap wearing another coat: a guard that is there, is
checked, and is answering from a call that never completed.

Also: `admin_delete_account` was gated on `require_admin` until 0205 lands,
so until Staw runs it, **any admin can delete any account** on the live
database. That is the actual reason 0172 existed.

# Round seventy-two - a ticket that asks for a person, in a popup

## What changed

**0206 adds `wants_human boolean not null default false` to
`support_tickets`**, plus a partial index on
`(wants_human, updated_at desc) where status <> 'closed'` so the urgent,
still-open ones are cheap to list.

**`open_ticket` now takes seven arguments.** The six-argument form 0204
created is **dropped**, so a caller that passes six is now calling nothing:

```
open_ticket(topic, subject, body,
            contact_email default null,
            first_name    default null,
            device        default null,
            wants_human   default false)
```

The seventh is defaulted, so a positional call with six arguments still
resolves - but if you were passing six positionally you were already
depending on 0204's shape, and this is the signature to build against now.

**The ticket form is a popup, not a page section.** `Support` keeps its
topic tiles and its list of your tickets; pressing a tile opens
`TicketCard`, a `Dialog size="lg"` with four steps (who you are, what you
were on, what it is about, describe it) and the checkbox. The dialog is
keyed on an open counter, so it remounts empty every time rather than
holding the last draft.

**The checkbox is "I want my ticket to be reviewed by a human."** Its own
copy says the honest thing, which matters more than the box: *every ticket
is read by a person today - nothing automated answers these.* Ticking it
marks the ticket important and puts it at the front of the queue. It is not
an opt-out of a machine, because there is no machine on this path. It is
the column that would stop Kobby if there ever is one.

An urgent ticket shows an amber **Urgent** badge with `faBolt` in the
ticket list.

## What it means for you

If either application opens tickets, pass `wants_human` and show the badge,
or you will have tickets in the queue whose urgency is invisible on your
side. If you render a ticket row, `contact_email`, `first_name`, `device`
and `wants_human` are all selectable now.

## What is not built

Nothing automated reads or answers a support ticket. There is still **no
support queue in the staff console** - tickets are written and stored and a
staff reader has no panel for them yet. And `decide_appeal` still exists
with nothing calling it, so an appeal sent from the standing page can be
read in the database and not from any screen. Both are owed.

Also in this batch, not shared: `docs/staff-console.md`, a full written
description of the console - the gate, the three ranks, the layout, all ten
panels and every control with the rank it needs. If you are building
anything staff-facing, read it rather than guessing from our screenshots.

# Round seventy-three - Kobby reads the rules, and a suspension says which way of talking

## The thing to build on your side

**`my_chat_standing()` returns four new columns, and one of them is work
for you.**

```
evidence    text      the line that was acted on, already censored
rule        text      the rule's code
rule_ord    integer   its number: "rule 5"
rule_title  text
gravity     integer   1-4, how serious Kobblon calls that rule
channels    text[]    ['chat'] or ['chat','voice']
```

`channels` is the one that matters. **Read it rather than assuming chat.**
A row saying `['chat','voice']` and a client that greys out the text box
and leaves the microphone live is a voice suspension that does not exist,
and the person has been told by the one screen meant to explain it that
only chat was taken away. Every existing row and every existing caller
defaults to `['chat']`, so nothing you have today changes meaning.

`ChatSuspended` already takes all of it: `evidence`, `ruleOrd`,
`ruleTitle`, `channels`. The heading becomes "Chat and voice suspended"
on its own when voice is in the list. **Pull the component rather than
copying the card** - that is the whole reason it has no provider, no
router and no session in it.

## Voice moderation, since you are waiting on me for it

Here is the shape, and the part of it that is already built.

Built here: the rules are rows now (`moderation_rules`, 0207), each with a
`channels` array that already lists `voice`, and a `gravity`. The ladder
that turns a broken rule plus a behaviour bar into an action is
`what_kobby_may_do(gravity, band)` and it is channel-agnostic - voice gets
the same ladder as chat, which is the point. `mute_chat` takes a
`channels` argument, so a voice suspension is one call.

Not built here, and this is what the Workspace and the Launcher own:
**voice never reaches this database.** Text does, because every line is a
row in `messages` and a trigger queues it. Voice is a stream between
clients.

So the join has to be: the client that carries the audio produces a
**transcript**, and the transcript lands in `chat_to_read` exactly as a
message does - `kind` would need a `'voice'` value added, which is a
migration I will write when you are ready for it, not before. From there
nothing is new: the worker reads it against the numbered rules, and
`judge_chat_line` decides with the speaker's behaviour bar.

Three things to settle before either of us writes code:

1. **Where the transcription runs.** On the speaker's machine is cheapest
   and is also the one place a person can tamper with it. On a server
   costs real money per minute. I would take the server and sample rather
   than transcribe everything.
2. **What is kept.** My position: the transcript of a judged line only,
   as `evidence`, under the same seven-day rule the text queue has. Never
   the audio.
3. **The lag.** Text moderation here is deliberately after the fact. Voice
   has to be too, and that means a voice suspension lands after the thing
   was said and heard. Live blocking is not on this ladder.

Say which of the three you disagree with and I will build to that.

## What changed in the database

**0207 - `moderation_rules`.** Eleven numbered rules as rows, each with a
code (the same vocabulary `violations.rule` has used since 0072), a number,
its text, a gravity 1-4 and the channels it applies to. `the_rules(channel)`
reads them. They are public - everybody may select them signed in or not,
because a rule nobody can read is a rule nobody agreed to.

Rule 5 is "Kobblon chat is not for sex", which is Staw's own example.

**0208 - evidence.** `chat_timeouts` gains `evidence`, `rule`, `gravity`,
`channels`; `violations` gains `evidence`. `mute_chat` takes four more
arguments (the three-argument form is **dropped**, so a six-argument call
is the one to write; fewer still resolves on the defaults).
`my_chat_standing`, `my_moderation_history` and `moderation_history_of`
all return the new columns - **all three changed shape**, so if you select
positionally, look again.

**0209 - the ladder.** `judge_chat_line(line_id, breaks, rule_code, quote,
reason, model)`. The model says whether a sentence breaks a numbered rule
and quotes the part it judged. **It never says what should happen.** The
rule's gravity and the speaker's behaviour band pick the rung in
`what_kobby_may_do`: nothing, a warning, chat suspended, chat and voice
suspended, account suspended. Gravity 4 - the hard limits - ignores the bar
entirely. The top of the ladder is still a suspension; nothing here deletes
an account and nothing can.

The same sentence from an exemplary account and from a critical one,
checked locally: a five-minute chat suspension, and a suspended account.

**0210 - the report console, re-asserted.** 0176, 0177 and 0178 never
landed on the live database, exactly as 0172 had not. `report_ticket`,
`report_queue`, `take_down`, `suspend_account` and `take_report` are
re-asserted verbatim. If you call any of them, they have been missing over
there, and a missing function and a refusing one read identically from a
page.

**0211 - `judge_report`.** Kobby could never settle a report: `ai_work` has
handed it open reports since 0179 and `apply_ai_verdict` has no `report`
branch, so it answered in the vocabulary of screening an upload and the
ticket stayed open. Now the same ladder decides, and it goes through
`take_report`, which still refuses the worker a termination outright.

## What is not built

Voice, as above. `decide_appeal` still has nothing calling it. There is
still no support queue in the console. And `take_report` has no voice
action, so a report that earns the chat-and-voice rung lands as a chat
suspension - said out loud in the code rather than quietly.

# Round seventy-four - a queue staff can work, an appeal somebody can answer, and a page that stopped drawing

## Two migrations, in this order

**0212 - the support queue.** `support_tickets.status` accepts
`open | in_progress | answered | escalated | closed` now; it was three
values before. Three functions, all gated on `is_moderator()`:
`ticket_queue(which, how_many)`, `ticket_counts()`,
`set_ticket_status(ticket, status)`. The queue returns the person's
`first_name`, `contact_email`, `device` and `wants_human` alongside the
ticket, and sorts `wants_human desc, updated_at desc` - somebody who asked
for a human is at the top whatever the clock says.

**0213 - the appeal queue.** `appeal_queue(which, how_many)` and
`appeal_counts()`. The queue hands back the appeal, the violation it is
against, the rule's number, title and gravity, the stored `evidence`, and
the person's behaviour score and band. It never returns the moderator's
id - only `by_rank`, because an appeal reviewer does not need to know
which of their colleagues decided it.

## The thing that matters to you: status is now a wider set

If the Workspace renders a support ticket's status, **it must not index a
lookup table with it and dereference the result.** That is not advice, it
is the bug that took the website's Support page down today: `statusLook[
ticket.status].look` on a browser holding a bundle built before 0212, the
moment a staff member moved a ticket to `in_progress`. Nothing threw on the
server, nothing threw in the build, and the page rendered "This page would
not draw". The website now goes through `lookOf(status)`, which falls back
to a neutral chip with the raw word in it. Do the same.

The general shape, since it will happen again: **a closed set in the code
and an open set in the database.** Any `Record<Status, …>` you write is a
promise that the server will never learn a new word, and this server learns
new words in migrations you do not see.

## New shared components you can mount

- `@/components/ui/Drawer` - slide-over panel. Portal, focus trap, Escape,
  scroll lock, `width: 'md' | 'lg'`. No provider, no router.
- `@/components/staff/SupportQueue` - also exports `TicketLine` and
  `TicketDrawer` on their own, if you want the row without the queue.
- `@/components/staff/AppealsQueue` - likewise `AppealLine`, `AppealDrawer`.
- `@/components/staff/CommandBar` - Ctrl/Cmd+K panel jump. Takes its panel
  list as a prop, so it has no idea it is on a website.

`design/preset.js` gained two keyframes, `slide-in` and `row-in`, used by
the drawer and the staggered queue rows. Pull the preset or the animations
are named and absent.

## The console is a popup card now

`/admin` draws as a modal over whatever was behind it, not as a page.
Closing it goes back, or home if there is no back. It is exported as
`ConsoleCard` from `src/pages/Admin.tsx` if you want the same shell.

## In `@/lib/api`

`appealQueue`, `appealCounts`, `decideAppeal`, `ticketQueue`,
`ticketCounts`, `setTicketStatus`. `ChatStanding` carries `evidence`,
`rule`, `rule_ord`, `rule_title`, `gravity` and `channels` as of 0208 -
round seventy-three covers what they mean.

## What is not built

Voice moderation itself, still. The console's vector map, People bulk
actions and the audit-log filters. And Kobby has not answered anything yet
for a reason that is not code: **`SUPABASE_SERVICE_ROLE_KEY` is not set as
a repository secret**, so every scheduled run has printed "nothing was
screened" and gone green. The workflow now names the missing secret out
loud instead.

# Round seventy-five - the machine answers, and the report console finally works

## Three migrations, in this order: 0214, then 0215, then 0216

**0214 and 0215 - the console was broken for a reason worth repeating.**
A moderator pressing Take on a report got `column r.handled_by does not
exist`. 0210 re-asserted the report *functions* because 0176 to 0178 had
never reached the live database; it did not re-assert the *schema* they
stand on, which is 0173, and 0173 had never reached it either.

**A plpgsql body is not checked until it runs.** Every one of those
functions was created perfectly by a migration that applied cleanly, and
failed the first time a person called it. If you carry any plpgsql of your
own, this is the trap: a green migration proves the text parsed, not that
the columns exist.

0214 adds the enum value `removed` alone, because Postgres refuses to use a
value in the transaction that added it. 0215 adds `reports.handled_by`,
`handled_at`, `outcome`, `handled_note`, `profiles.suspended_until`,
`report_subject`, `lift_expired_suspensions`, the widened `violations`
checks, and the guard that knows about `suspended_until`.

**0216 - Kobby answers support tickets and appeals.** Two new functions,
both worker-or-admin only:

- `answer_ticket(ticket, reply, confident, model)` → `answered` |
  `escalated` | `for_a_person` | `already_answered` | `gone`
- `judge_appeal(appeal, overturn, why, model)` → `overturned` | `upheld` |
  `for_a_person` | `gone`

What they will not do matters more than what they will, and the
applications should say the same things in their own words:

- A ticket whose opener ticked **"I want a person"** is never answered by
  the machine. `ai_work` does not even hand those over.
- The machine **never closes a ticket.** `answered` is as far as it goes.
- An appeal against a decision a **person** made is never machine-decided.
  `violations.moderator_id is null` is exactly "Kobby decided this".
- The machine may **overturn** any decision of its own, at any weight. It
  may **uphold** only a warning or a chat suspension. Upholding a
  suspension is a human sentence.
- Still, and in three places now: the machine cannot delete an account.

## Two shapes changed

`ai_work` now returns `subject = 'ticket'` and `subject = 'appeal'`
alongside the three it had. If you switch on `subject`, the default branch
now catches two new values.

`ai_work_waiting` gained `tickets` and `appeals` columns, and `total`
counts them. **This is a return-type change**, so 0216 drops the function
before recreating it - if you call it positionally rather than by name,
look again.

`ai_reviews.decision` accepts six new words: `answered`, `escalated`,
`for_a_person`, `overturned`, `upheld`, `quieted_voice`.

## The support thread is a popup card, not a page

`/support/:id` still resolves - an emailed link has to land somewhere - but
it now opens the list with the conversation card on top of it, and closing
the card puts the address back to `/support`. `src/pages/SupportTicket.tsx`
is gone; the conversation is `@/components/support/TicketThread`, which
takes `number`, `onClose` and `onChanged` and mounts anywhere.

It also exports `KobblonFace`, the face Kobblon answers with: the burst
mark at `public/brand/kobblon-reply.svg`. If the Workspace shows a support
reply, use that, not a moderator's avatar and not the plain logomark.

## One bug the Workspace would have had too

`getTicket` never selected `status`, so every ticket page read
`undefined` - which is what the "UNKNOWN" chip in Staw's screenshot was,
and what took the page down before `lookOf` landed. If you select ticket
columns by name anywhere, check `status` is among them.

## What is not built

Voice moderation itself. The console's vector map, People bulk actions,
the audit-log filters. And Kobby has still answered nothing on the live
platform, because `SUPABASE_SERVICE_ROLE_KEY` was not set as a repository
secret - Staw has now added it, and the next run is the first that can do
anything.

# Round seventy-six: two shared pieces, and shorter words everywhere

## `Note`, and the end of the wall of text

`@/components/ui/Note` is the information rectangle the Launcher already
draws: a bordered box, a filled Font Awesome icon on the left, one
sentence next to it. `tone` is `brand` (blue, the default) or `yes`
(green), `icon` swaps the icon, `side` puts a link or a button on the
right.

The rule that comes with it, from Staw: **one per screen.** Support,
account standing, the staff support queue and the ticket card each had
two or three stacked boxes of explanation; they now have one line each,
and the account standing page's "what this buys you" and "it climbs on
its own" boxes are a single `Note`. If something needs two sentences it
belongs in the thing it is about, not in a box above it.

If the Workspace draws its own info boxes, import this one instead.

## `Tick` and `Tickbox`

`@/components/ui/Tickbox` exports both. `Tick` is the square with the
check in it - `h-5 w-5`, rounded, brand fill when on - which picking a
friend, an outfit and a colour each drew by hand. `Tickbox` is that tick
with a label beside it, which is the form control: `on`, `onChange`,
`label`. Use these rather than a bare `<input type="checkbox">`; the
accent-coloured native one does not match anything else on the platform.

## No em dashes

They are gone from every source file in the repository, 144 of them, and
they do not come back: `-` or `;` instead. Same rule your side.

## A passed-up ticket now says so (migration 0217)

`answer_ticket` set the status to `escalated` and wrote an `ai_reviews`
row, both of which only a moderator sees. From the person's side the
ticket sat there empty, which is exactly how the first test ticket on the
platform read as ignored.

It now writes a line on the thread as well, from staff, and sends a
letter: one for "this needs a person", one for "you asked for a person".
`ai_work` only hands out tickets that are still `open`, so neither line
can be written twice. If you render a ticket thread, nothing changes for
you - it is one more `from_staff` message.

Apply **0217** after 0214, 0215 and 0216.

## What is not built

Voice moderation. The console's vector map, People bulk actions, the
audit-log filters. Kobby answers tickets and appeals in the schema and in
the worker; whether it has answered anything live still depends on the
service-role key in the repository secret being the right one.

# Round seventy-seven: the console's last unbuilt pieces

## `Switch`

`@/components/ui/Switch` is the toggle: `on`, `onChange`, `label`, an
optional `note`, `busy` and `disabled`. Green when on, because green is
yes here.

It replaces the pattern the Machine panel used, a button whose own label
flipped between "May warn" and "May not warn" - which reads as a state
half the time and as the thing you are about to do the other half. If the
Workspace has a settings toggle, this is the one.

## The record can be looked through (migration 0218)

Two new functions, both admin-only and both refusing by returning
nothing rather than by raising:

- `staff_record(what, term, since_hours, how_many)` - the staff log,
  filtered where it is kept. `term` matches the subject's handle, the
  staff member's handle, or anything in the `detail` JSON. Capped at 500.
- `staff_record_kinds()` - which actions are actually in the log, with
  counts, so the filter's options are read rather than hard-coded.

`staff_record` also answers **who did it**: `admin_log.admin_id` is a
uuid and nothing joined it to a name, so the one column a record most
needs was the one the panel could not show. In `@/lib/api` these are
`staffRecord()` and `staffRecordKinds()`, returning `RecordEntry`.

Filtering client-side was the alternative and it is wrong for the usual
reason: it hides rows out of the sixty the browser happened to be given,
which answers no question anybody actually has.

## The map answers

`WorldMap` takes `active` and `onHover` now. The console's Map panel
lights the dot under the pointer, in the map or in the list beside it,
and reads out the zone, the country and its share of the total. Still one
dot per time zone, still a hint, still nothing asked of any geolocation
service.

## What is deliberately not built

**Bulk select on People.** The only actions worth doing in bulk there are
suspend and delete, and a checkbox that suspends nine accounts at once is
a mis-click with no undo. It stays one account at a time, from the report
or the person's own row.

## Still not built

Voice moderation. Quest session schema.

# Round seventy-eight: voice, and the branch that went missing

## The machine stopped reading what people say (migration 0221)

Worth reading even though it is a website bug, because it is the shape of
mistake either of us can make.

0189 queues every line - chat, Space chat, Community posts - into
`chat_to_read` by trigger. 0190 handed those lines to `ai_work`.
`apply_ai_verdict` has had a branch for judging one ever since. Then 0216
added tickets and appeals by rewriting `ai_work` **whole**, and the
message branch did not come back with it. Lines kept being queued,
nothing ever asked for them, and the console's own count left them out,
so the panel read "nothing waiting" over a queue that was growing.

0221 puts the branch back and adds `lines` to `ai_work_waiting`.

The lesson: replacing a function whole means its old branches are gone
unless they are carried across, and nothing in the schema says one is
missing. The check is not "does it apply" - it is **"name every subject
it used to hand out and show each one still coming back"**.

## Voice (migrations 0219 and 0220)

Voice moderation is after the fact. There is no filter in the path and
there cannot be one: a word is in somebody's ears before anything could
look at it. Nothing records anybody.

What changed:

- **`mute_chat` widens instead of returning early.** It used to hand back
  an existing live timeout untouched, which was right for two reports
  about the same hour and wrong the moment the channels differ: somebody
  chat-quieted and then reported for voice got the old row back and kept
  their microphone, and the caller was told a time as though it had
  worked. A live timeout that does not cover what is asked for now has
  the channels added and `seen_at` cleared, so the card is shown again
  saying what it actually took. The clock is not restarted.
- **`take_report` takes `voice_suspension`**, which quiets chat and voice
  together. Never voice alone: somebody who cannot be trusted with a
  microphone can type the same thing in a second.
- **`apply_ai_verdict` accepts `quieted_voice`.** `what_kobby_may_do` has
  returned that rung since 0209 and the applier refused the word, so the
  ladder's fourth rung quietly did nothing.
- **`report_subject` knows `'voice'`**, and `reports.target_type`,
  `reports.outcome`, `violations.action` and `violations.target_type` all
  allow the new words.

### What the applications need

**`may_i_speak()`** is the one to call. It returns
`{ chat, voice, until, why }` for the signed-in account - `chat` and
`voice` are booleans meaning *may*. Ask it when joining, and again when a
countdown says it is over. A client deciding this for itself is a client
that can decide the other way.

`my_chat_standing()` already returns `channels`, and `ChatLockedBar` and
`ChatSuspended` already take a `kind`. A row saying `['chat','voice']`
with a greyed-out text box and a live microphone is a voice suspension
that does not exist, so read the array, do not assume chat.

Report a voice incident as `target_type: 'voice'`, `target_id`: the
person's uuid. There is nothing else to name - no row, no file, no line.

## The console can now say why the machine has not run

`checkTheMachine()` in `@/lib/api`, behind a "Check it" button in the
Machine panel. Four steps in the order they stop being answerable: the
worker is deployed, its secrets are set, your sign-in gets through and
Groq answers, it is on with something to read. Each carries the sentence
that step actually produced, and the first cross is the one to fix.

It exists because "it does not work" has had three different causes here
- a function never deployed, a gateway refusing before the function ran,
and a key that did not match - and from the console all three looked
identical.

# Round seventy-nine: the worker was never recognised

The machine has never acted on anything, and the reason was one word in
one function.

`is_the_worker()` asked `current_setting('request.jwt.claim.role')`. That
is the **old** spelling: PostgREST set one GUC per claim years ago, and
now sets a single JSON `request.jwt.claims`. Supabase's current gateway
does not set the per-claim ones at all. So the setting read back empty,
the worker was not recognised, and every door it has was shut:

- `ai_work` returned nothing, so a run read "looked at 0" with sixty-one
  things waiting, which is exactly what the console showed;
- `apply_ai_verdict` would have refused the verdict anyway;
- `take_report`, `answer_ticket` and `judge_appeal` the same;
- `review_asset` read the claim itself, with the same spelling, and was
  not granted to `service_role` either, so the worker was refused at the
  door before the branch inside could be read.

0222 reads both spellings, in one place, and grants the two review
functions to `service_role`.

**Nothing was wrong with the key, the deployment or Groq.** The worker
arrived, was not recognised, and was handed an empty queue, which from
outside is indistinguishable from an empty queue. That is the whole
lesson: the check is never "is the guard there", it is **"show the guard
saying yes to the real caller"** - and no test on this project had ever
set the claims the way PostgREST actually sets them. If anything your
side reads `request.jwt.claim.<name>`, it has the same bug today.

Apply order from here: 0214, 0215, 0216, 0217, 0218, 0219, 0220, 0221,
0222.

# Round eighty: it runs, and what the first real run found

Kobby screened its first twelve things today: four decided, a slur
quieted on rule 2, three lines read and left alone. The worker is alive.
Three things came back from that one minute, all now handled in
`supabase/functions/moderate`:

- **429.** `openai/gpt-oss-20b` has eight thousand tokens a minute on the
  free tier and twelve jobs is more than that. Groq says how long to wait
  in its own sentence, so that is read and waited out once. A second 429
  means the minute really is spent: the run stops there and says so,
  rather than collecting the same refusal nine more times. Nothing was
  marked read, so it is a pause, not a loss, and the console says it in
  blue rather than red.
- **400 `json_validate_failed`.** That model sometimes refuses
  `response_format: json_object` outright. Asked again without the flag
  it answers JSON anyway, and the reply is read with `firstJson`, which
  takes the first `{...}` out of a model that wrapped it in a sentence.
- **`Named a rule that does not exist: [sexual]`.** The prompts put each
  rule's code in brackets, so a model answering `[sexual]` copied what it
  was shown. `tidyRule` takes the brackets, quotes and case off in the
  one place that knows both how the prompt is written and how the column
  is spelt.

Nothing in the database changed for this round; it is all in the worker.
If you call a model from the applications, the first two are worth
copying rather than rediscovering.

# Round eighty-one: the worker is woken, and an appeal can be sent twice

Two things in this round, plus a mark that was wrong.

## The worker is woken the moment work lands

Staw asked whether the machine answers immediately when something new
arrives. It did not, and nothing in the database has ever called it. There
were exactly two ways in and both were clocks: the button in the staff
console, and a GitHub schedule that does not keep time on a quiet repository
- its runs have landed five hours apart.

`0224` adds the missing one. An `after insert` trigger on the six tables
work arrives in (avatar items, assets, reports, support tickets, appeals,
chat lines) knocks on the edge function through `pg_net`, which posts and
does not wait for an answer. Four things about it worth knowing on your
side:

* **The mode decides.** "Whenever anything is waiting" knocks at once.
  "Only when the queue is long" knocks as soon as the queue gets there.
  "Only what has waited too long" is never woken early, because waiting is
  what that setting means.
* **Twenty seconds between knocks**, kept on the row, so a hundred rows
  landing together is one run and not a hundred.
* **It cannot fail a write.** The trigger swallows everything; if the knock
  cannot go out, the row still lands and the clock picks the work up as
  before.
* **The address and the key live in `ai_poke`**, a table with row level
  security on and no grants to any role at all. `authenticated`, `anon` and
  `service_role` all get "permission denied" reading it, and only the
  definer functions touch it. There is deliberately no way to set it from
  the console: a service-role key typed into a web page is a service-role
  key that went through a browser.

Nothing here is a shared component, so nothing to import. What it means for
you is only that a thing screened in the Workspace now comes back in
seconds rather than on the next quarter hour, when the mode allows it.

`poke_state()` is new and moderator-only: `wired`, `net_ready`, `last_at`.
Never the url and never the key. The console's "Check it" grew a fifth step
off it.

## An appeal can be sent twice, and only for a while

`0223`. The rule was one appeal per decision, for ever, and the only wall
was a unique index.

* **Two goes.** Send one; we answer it. If it was declined you may send a
  second, and that is the last. Upheld means there is nothing left, and an
  appeal still open is not a reason to write another.
* **Fifteen days** from the decision for everything short of closing an
  account. A closed account is **a month**, and **six months in the EU**.
* The EU part reads the country kept on `account_sessions`, which comes
  from the browser's time zone and is a hint. So it is used **only to
  lengthen** a window, never to shorten one. Somebody who sets their
  machine to Dublin gets six months; nobody loses a day over a zone we read
  wrong.

Shapes that changed, if you read any of this:

* `appeals` gained `attempt` (1 or 2). The unique index is now
  `(violation_id, attempt)`. **Anything selecting a single appeal row by
  `violation_id` will start returning two** - the website's own `getAppeal`
  did, and now orders by `attempt desc limit 1`.
* `my_moderation_history()` gained `appeals_used` and `appeal_closes_at`,
  and `appealable` now means all four walls rather than "no appeal yet".
* `my_appeal_state(violation)` is new: `used`, `closes_at`, `may`.
* `moderation_history_of(target)` was quietly returning one row per appeal
  per decision from the same join. Fixed the same way.

On the website the writer moved: there is an **Appeal this** button beside
Close in the decision card, and the form opens in that same card. Under it,
one line saying when the window shuts.

One thing that is **not** built, said plainly: the appeal review can be
described as able to make a sanction heavier, and the words on the page and
in the policies say so - but there is no door for it in `decide_appeal` or
`judge_appeal`, which take upheld or declined. A moderator who finds worse
re-sanctions from the person's panel, by hand. If that should be one
action on the appeal itself, it is a migration nobody has written.

## The face on a support reply

It was `brand/kobblon-reply.svg`, a mark drawn to look like the favicon.
Staw: "i gave you the image i wanted you to use, that image, not try to
recreate it - just use the favicon we're using for the website". It is now
`brand/favicon.png`, the same file the browser tab shows, and the SVG is
deleted. If you drew your own anywhere, use the favicon.

# Round eighty-two: voice, struck-out lines, and what the Launcher calls

The big one for you. Everything here is about chat and voice in the
Launcher, and most of it is a call you make rather than a component you
mount.

## Voice is moderated by reading what was said

There is no new machine for it, on purpose. A transcript is a line
somebody said, and `chat_to_read` already is the queue for lines somebody
said. Voice joins it as a fourth kind and walks the same path: the same
numbered rules, the same prompt, the same ladder, the same `judge_chat_line`.

**What you call, once per transcribed utterance:**

```ts
import { heardInVoice } from '@/lib/api'
await heardInVoice(whatWasHeard, worldOrPartyId)
```

`where_at` is whatever you call the place it was said; it is kept so a
moderator can see where it happened and nothing is looked up from it. The
text is censored on the way in by the same patterns chat goes through, and
it is rate limited to sixty lines a minute per person - a transcriber that
breaks and floods is a bill, and the person being transcribed has not done
anything wrong.

Two differences from a typed line, both deliberate:

* **Being quieted for something spoken takes voice too.** A spoken line
  that would have quieted somebody's chat quiets chat and voice. Voice is
  still never taken on its own: somebody who may not speak may not type the
  same thing instead.
* **The model is told it was spoken**, so it reads the recogniser's
  mistakes as the recogniser's rather than the person's.

**What you ask before letting anybody talk:**

```ts
const { chat, voice, until, why } = await mayISpeak()
```

Ask it on joining and after every suspension card. A client that greys the
text box and leaves the microphone live is a voice suspension that does not
exist.

## Something that got you moderated is struck out where you said it

Staw: "if you get moderated for something youve said, even days after,
then the text you sent gets instantly censored where it was". It was not,
and the gap was the worst possible one: the filter stars out *words* as
they are typed, and Kobby reading the *meaning* of a sentence is exactly
the case the filter cannot catch. The one kind of line the machine exists
to find was the one kind that stayed on screen in full, for everybody, for
ever.

Now, the moment a line is judged to break a rule, the row it came from is
rewritten in place: every word becomes four bullets, the same bullets the
filter uses. The original is kept in `chat_to_read` and on the violation,
which is what a moderator reads when the appeal arrives.

**Nothing to call.** It is an UPDATE on `messages`, `space_messages` or
`community_posts`, so if your chat listens for UPDATE it is already
instant. **If it only listens for INSERT, it is not** - that is the one
thing to check on your side.

## The suspension card, with one tap for a transcript

`ChatSuspended` took `onAppeal` already. Three props more:

* `spoken` - the tap reads **"I did not say that"** and the line above it
  says the transcript can be wrong.
* `appealBusy` - while it is going out.
* `appealed` - once it has gone, so the card says so instead of offering
  it again.

The host does the call: `iDidNotSayThat(timeoutId)`. **The card does not
compose the appeal and neither should you** - the database writes the
words, so the Launcher and the website cannot put two different claims in
somebody's mouth. It files a real appeal against that suspension, it shows
up on the standing page like any other, and a person answers it.

`tools/site/suspended-preview.html` mounts all of it with nothing around
it, including the spoken and already-sent states.

## An appeal can be about a suspension now, and has three answers

Until this round an appeal could only be about a `violations` row, so the
sanction the machine hands out most often - a chat or voice suspension, a
`chat_timeouts` row - was the one thing on the standing page with no way to
argue with it.

* `appeals` now points at a violation **or** a timeout, never both.
  `violation_id` is nullable; `timeout_id` is new. **Anything you read off
  `appeals` has to handle both.**
* `chat_timeouts` has `lifted_at` and `lift_reason`. Everything that asks
  whether somebody may speak, whether a new sanction widens the live one,
  and how long the next one should be, ignores a lifted timeout. If you
  cache a timeout anywhere, a lifted one is over.
* `decide_appeal(appeal, outcome, note)` - **the signature changed**, a
  word instead of a boolean, and the old one is dropped. `upheld`,
  `declined`, `worsened`. Worsening moves it one rung up and leaves the
  original standing, because an appeal that found worse does not erase what
  was already found. A suspension does not escalate: the only thing above
  it is closing an account, which is a superadmin with a typed
  confirmation and never a side effect of answering an appeal.
* `appeal_queue` gained `subject`, `attempt` and `timeout_id`, and its
  inner join on `violations` became a left join - it would have hidden
  every timeout appeal, open for ever and counted nowhere.
* `my_moderation_history()` gained `timeout_id`, and a timeout row now
  carries its appeal and `appealable` like any other.

**The machine never sees these.** `judge_appeal` only ever gets appeals
against a violation a person did not decide. An appeal that says "I did
not say that" is a claim about a transcript, and a transcript is the
machine's own evidence; asking it to mark its own homework is not review.
`ai_work`'s own 'busy' gate was counting them as work it could take, and
no longer does.

## The decision card was redrawn to match yours

The popup on the standing page and the suspension card you show were two
layouts for one event. The popup now takes the card's shape - the icon in
a disc, the one line saying what happened, a hairline, then the facts -
and keeps what the small card cannot carry: the rule in full, the appeal
and its answer, and the bar. A timeout that took voice is titled "Chat and
voice suspended" rather than by the action's name, which said "Chat
suspended" at somebody whose microphone was dead.

## Ranks

`set_staff_rank(target, 'none' | 'moderator' | 'admin')`, a superadmin's,
with the console control beside it. It cannot make a superadmin, touch a
superadmin's row, touch the house account, or be used on yourself. Every
use is written to the admin log and the person is told.

And the house account is a superadmin now. It has been answering tickets,
sending every piece of staff mail and owning the starting kit from rank
'none' this whole time, which worked only because the functions behind
those are `security definer`. The first page to read a table directly as
that account would have found out the hard way.

## Migrations

0225 through 0230, in order. 0230 has to come after 0225, because it
rewrites the same function.

## Round eighty-three

**Staw's icons are in the repository and they are yours too.** He uploaded
fifty-eight PNGs. They arrived at the repository root in two folders called
`F-icons` and `workspace icons` - a space in a served path, and nothing under
`public/`, so none of them were reachable from the site at all. They are at
`public/icons/ui` and `public/icons/workspace` now.

Fifteen of them were drawn for you: `cylinder`, `decal`, `group`, `light`,
`meshpart`, `part`, `script`, `sky`, `sound`, `soundservice`, `sphere`,
`texture`, `truss`, `wedge`, `world`. They are at
`public/icons/workspace/<name>.png` and they are the explorer's icons - a
MeshPart in your tree and a MeshPart in Create should not be two drawings of
the same thing. They carry their own colours; do not tint them.

The website reads them through `@/components/brand/Icon`:

```ts
import { Icon, type KobIcon } from '@/components/brand/Icon'

<Icon name="workspace/decal" className="h-4 w-4" />
<Icon name="chatbubble" tone="currentColor" />   // painted as a mask
```

It takes no provider and no router. `tone` paints the icon as a CSS mask, so
the shape is exact and the colour is whatever the design system hands it;
left out, the icon is drawn as Staw drew it. The names are a union type, so a
name that does not exist is a build error rather than a picture that silently
does not load.

**The Brix mark was a reproduction and is not any more.** `CurrencyMark` drew
a two stud brick as hand-written `<svg>`. Staw: "i dont want you to reproduce
it and use the reproduction i want you to use the original image". It is his
file now - `public/icons/ui/brix.png` - and every price on the website draws
it. If you have your own copy of that `<svg>`, replace it; it is not the
mark.

**`outfit_look(outfit uuid)` is new, and it answers in `avatar_of`'s own
columns.** Same names, same order, same meaning: body, slot, kind, item_id,
content_id, item_name, price, image_path, image_bucket, preview_path,
mesh_preview_path, fit, mesh_path, mesh_format, texture_path. So whatever you
already have that draws a person from `avatar_of` draws a saved outfit with
no new code. Readable by the owner, or by anybody if it is listed in the
Catalog; a private one belonging to somebody else returns no rows.

**`update_avatar_item` lets a creator fix something they have published, for
60 Brix.** Signature:

```sql
public.update_avatar_item(
  item uuid,
  new_name text default null,
  new_description text default null,
  new_mesh uuid default null,
  new_texture uuid default null,
  new_fit jsonb default null,
  new_price integer default null
) returns text   -- 'nothing' | 'changed' | 'pending'
```

Every argument is optional and null means "leave it alone" - do not send a
field back because you happen to be holding it, because the value you are
holding is the one from before somebody else's change. Charged once, after
every refusal, and nothing is charged when nothing moved. **A new mesh or
texture sends the item back to `pending`**, so anything of yours that lists a
creator's items has to expect an approved item to become pending again
without the creator uploading anything new. `item_edit_price()` is the 60, if
you want to print it.

`restyle_outfit(outfit uuid)` and `rename_outfit(outfit uuid, new_name text)`
are there as well. `restyle_outfit` reads `avatar_worn` on the server rather
than taking a list - same promise `save_outfit` makes - and keeps the
outfit's name, folder, price and Catalog listing.

**Not built, and said plainly:** the transport field and `mark`/`unmark` on
the bubble board went in last round. Nothing here touches either. The
moderation work from the round before last was lost before it was pushed and
is being redone; if you built against `my_account_standing`,
`reactivate_my_account` or `ban_account`, none of those exist yet - wait for
the round that says they do.

## Round eighty-four

**`outfit_page(tag bigint)` is new** and it is the reader behind an outfit's
own page, the way `avatar_item_page` is behind an item's. It takes the
`content_id` - the number in the address, not the uuid - and hands back the
outfit, its maker, what it costs *this person* (the pieces they do not
already own), and `pieces` as JSON with each piece's own `item_id`,
`content_id`, `kind`, `slot`, `name`, `price`, picture paths and `owned`.
So every piece in an outfit can be linked to that item's own page, which is
the thing the shelf row could never do.

It refuses what it should: an outfit that is not public and not yours
returns no rows at all, rather than a row with the details blanked.

The website's address for one is `/catalog/outfit/OUTF-<content_id>`, and
`outfitTag(id)` in `@/lib/kinds` builds it. Outfits get their own code
rather than borrowing an item's, because they are an arrangement of items
and not a kind of one.

**Drawing an outfit** is still `outfit_look` from round eighty-three, and the
website now has `OutfitStage` over it - `@/components/avatar/OutfitStage`,
which takes one prop:

```tsx
<OutfitStage outfitId={id} className="aspect-[4/5] w-full" />
```

No provider, no router, no session. It signs each piece's address itself and
guards every await with a `wanted` flag, because a grid of these mounts and
unmounts as folders open. If you show saved looks anywhere, use this rather
than drawing one yourself.

**My Avatar has been rebuilt** and two things in it are worth copying if the
Workspace ever shows a wardrobe. The drawers are a vertical rail of icons
with counts rather than tabs over a grid, and what somebody has on is a row
of pictures with a cross on each rather than a column of names. Neither is a
new component yet; say so if you want them extracted.

**A bug worth knowing about `AvatarStage`:** it is `aspect-square w-full` and
it frames the body to fit the box it is handed. Wrapping it in a box of a
different shape and passing `h-full` makes it square at the *container's*
width and clips the head and feet. Give it a width and let it keep its own
square.

**Still not built:** the moderation work from two rounds ago is still gone
and still being redone. `my_account_standing`, `reactivate_my_account` and
`ban_account` do not exist. Do not build against them yet.

## Round eighty-five

Eight migrations since the last round, and three shared components changed
meaning. The components are the part that cannot wait: a copy on your side
goes on compiling and quietly draws the wrong thing.

**`Icon` paints with `currentColor` now.** `@/components/brand/Icon` used to
draw Staw's icons exactly as the files are, which is white line art - so
every one of them disappeared on a light surface. Staw, in capitals, about
the Brix mark on a white card. The default is now the colour of the text it
sits in:

```tsx
<Icon name="brix" />                 // takes the text colour
<Icon name="brix" tone="#FFCC4D" />  // a colour you name
<Icon name="brix" tone={null} />     // the file as drawn, colours and all
```

`undefined` and `null` are different answers and both are needed. The
Workspace's own icons (`workspace/part`, `workspace/sound`, the rest) still
default to as-drawn, because a flat green cylinder and a flat red part are
the same picture.

**Two faces have a second colour.** `reaction-heart-eyes` has red hearts and
`reaction-winky-grin` a pink tongue, and they only appear when the face is
painted its own colour rather than the text's. There are two new files in
`public/icons/ui` for them, cut out of the originals by what they are in the
picture - the hearts are the enclosed holes at eye height, the tongue is the
white island not joined to the rest. If you draw these faces yourself, take
the pair of masks; nothing was traced, so they line up exactly.

**`Glyph` takes `name` and `on`.** `@/components/brand/Glyph` is the adapter
that lets a Font Awesome call site turn into one of ours. `name` overrides
the mapping, and `on` picks between the stroke and the filled drawing for
the four that have both (star, heart, thumbs up, thumbs down). The rule Staw
set: **stroke is the unselected state.**

**`AvatarStage` takes `fill`.** Without it the stage is `aspect-square
w-full` and frames the body to its own square, so a stage inside a wider box
left two dead strips. With `fill` it takes the box it is given and fits the
body to whatever aspect that is.

**The database, in the order these should be applied:**

* **0234** `recommended_avatar_items(how_many integer default 12)` - answers
  in `avatar_shelf`'s exact columns. Empty socket counts for most, then what
  they can afford, then how many people took and starred it, then the kinds
  they keep buying, then a nudge for anything new. At most two per slot, so
  it cannot come back as twelve hats. Signed out it quietly answers "popular
  and new".
* **0235** the Kobblon Klub. `profiles.membership` is one of
  `none | lite | klub | life`, with `klub_until` and `klub_since`.
  `klub_of(target)` reads it; `in_the_klub(target default auth.uid(),
  at_least default 'lite')` is the one to ask, because it ranks the tiers
  rather than comparing strings. `set_klub` is superadmin only. **There is
  no way to buy it yet** - do not build a purchase flow against this.
* **0236** `take_down_outfit(target uuid, note text default null)` -
  moderator only, writes the admin log and notifies the owner, returns false
  on a second attempt.
* **0237** reactions. `react(what text, which text, face text)` toggles,
  `reactions_on(what, which)` and `reactions_on_many(what, text[])` read.
  `what` is `'post'` or `'world'`; the ten faces are the names above.
  **One face per person**, so pressing a new one takes the old one off.
  Reacting to a World needs `in_the_klub(me, 'lite')`; posts and
  announcements are open to everybody. Worlds keep likes and dislikes as
  they are - reactions sit beside that rating, they do not replace it.
* **0238** the link allow-list. `allowed_link_hosts` is a table, seeded with
  youtube, youtu.be, tiktok, discord.gg, discord.com, spotify, open.spotify
  and kobblon. `offsite_link(input)` returns the first host that is not on
  it, or null. `screen_text` asks about links first. Everything else is
  blocked - so if the Launcher screens chat text itself, screen it through
  this and not a pattern of your own.
* **0239** a lifted sanction gives the points back. `behaviour_score` skips
  timeouts with `lifted_at` set, which it did not before: somebody cleared on
  appeal kept the penalty.
* **0240** `avatar_of` and `outfit_look` gained a trailing `sells_until
  timestamptz`. **This changes a shape you read.** Null is ordinary, a date
  in the future is a limited still selling, a date in the past is one that
  has closed. The website now says Limited and Closed everywhere it draws a
  worn item, not only in the Catalog.
* **0241** buying an outfit leaves you with the outfit. `buy_outfit` still
  buys every piece and splits the money exactly as before, and now also
  writes a copy of the arrangement into the buyer's drawer, marked
  `bought_from` and `bought_at`. `my_outfits()` returns those two plus
  `maker_username` and `maker_display_name`. A bought copy **cannot be put
  on the Catalog** - a trigger refuses it, not a page. Staw's two sections,
  Saved and Bought, are that column.

**Still not built:** the moderation work is still gone and still being
redone. `my_account_standing`, `reactivate_my_account` and `ban_account` do
not exist. There is still no purchase path for the Klub. The five pages Staw
wants reordered - Catalog, Communities, Discover, People, Settings - and the
staff console are written down in `docs/roadmap.md` and not started.

## Round eighty-six

Two things here change meaning for anything that draws clothes or shows
reactions.

**The clothing template is the one everybody already has.** Staw, holding up
a sheet made for somewhere else: "if i upload this to kobblon then it will
work and become a proper shirt". So `templateFor` no longer lays regions out
from the body's measurements; it returns the familiar sheet: **585 by 559**,
64 pixel grid, torso unfolded across the top (front panel 128x128 at 231,74,
its sides 64 wide), the two limbs unfolded side by side beneath it at y=346
with their lids at y=282.

Two details are easy to get wrong and both show as a sleeve on backwards:
the limbs are **mirrored** - the left one's lid and floor sit over its fourth
column, the right one's over its first - and the order of faces across the
row differs between them for the same reason. Read `templateFor`; do not
re-derive it.

This replaces the layout the first templates used. Anything painted into the
old sheet is laid on the body by the new one, which is a handful of items on
a platform this age. The two PNGs in `public/templates` are regenerated from
the code, by `tools/site/template-sheets.html` - never edited by hand.

**Clear pixels in clothing show what is underneath.** They used to show
white, because the fix for "the body colour tints the shirt" was to paint the
part white under any picture, and white is exactly what a transparent patch
then rendered.

`K6` now patches the part's material: the skin colour stays on the material
and the shader lays the garment over it by the garment's own alpha, with the
layer below it drawn first. So a clear patch in a shirt shows the trousers
under it, or the skin if there are none, and a half-clear garment is half
clear. No second mesh and no second pass.

If you build materials for K6 parts yourself, do not set them white under
clothing any more, and do not assume `material.color` is white while a map is
set. Two traps came up doing it and are worth repeating: three's
`Material.copy` deep-copies `userData` through JSON but does **not** copy
`onBeforeCompile`, so a "patched" flag in `userData` survives a clone that
dropped the patch; and a texture must never be parked in `userData` for the
same reason.

**Three reactions each, not one** - migration **0242**. The one-per-person
rule was the reactions table's primary key; the key now includes the face and
`react` refuses a fourth with "Three faces is as much as anybody can say
about one thing." Nothing is swapped out to make room. `reactions_on` and
`reactions_on_many` are unchanged in shape, but `mine` can now be true on up
to three rows for one person - a client that reads "the one that is mine"
will show the wrong state.

## Round eighty-seven

**A suspension has not actually suspended anybody since migration 0215.**
That is the one line in this round that matters to you, and it is not a new
feature, it is a bug that was live for months.

`guard_profile_update` honours transaction-local flags so a
`security definer` function can write a column the guard otherwise pins back
(CLAUDE.md's third trap). Migration 0178 added the `kobbleston.standing`
branch for `is_suspended`, `suspended_until` and the standing columns.
Migration 0215 rewrote the whole guard for another reason and **dropped that
branch**. Everything downstream kept working: `suspend_account` wrote the
violation, wrote the mail, wrote the admin log, returned successfully - and
the guard put `is_suspended` straight back to false. Nothing threw. Only an
admin, whose writes the guard exempts, could suspend anybody at all.

Migration **0243** restores it. If an application reads `is_suspended` to
decide whether somebody is locked out, that column is now telling the truth;
anything that was working around it by reading the violations table instead
can stop.

Also in 0243, for the lockout the applications will eventually have to show:

- `ban_account(target, said, which_rule default 'other')` - a permanent
  termination. Needs `is_moderator()`, refuses the worker account by name
  first, and refuses a reason under ten characters. Writes a `termination`
  violation, sets `is_suspended`, sends the mail, logs to admin.
- `lift_account_ban(target, said)` - voids the termination and returns the
  account to clear. **Named `lift_account_ban`, not `lift_ban`**: `lift_ban`
  already exists and is the Community one. Do not call the short name
  expecting an account.
- `my_account_standing()` - what to show the person themselves:
  `level, headline, why, rule, decided_at, until, violation_id,
  appeal_status, can_appeal, can_return`. `level` is `clear`, `warned`,
  `suspended` or `banned`. `can_return` is true only when a suspension has
  run out.
- `reactivate_my_account()` - returns true when the account is back. Refuses
  a running suspension with "This suspension has not run out yet." and
  refuses a termination outright.

No website UI for the lockout yet - the functions are there and nothing
reads them. Said plainly so neither of us builds half of it twice.

**ONLY WARNINGS AND SUSPENSIONS - nothing in this round deletes an account**,
and nothing ever will. A termination is a flag and a row; the data stays.

**Following is a heart now, everywhere.** Staw: "make that every icon for
following someone is a heart instead of a user". The person-with-a-tick on
the profile's Follow button and the star on the Followers list are both
hearts. The split is worth copying: **person icons mean friendship** (a
request and an answer, two-sided), **the heart means following** (one-sided,
no answer). If a panel of yours has a Follow control on a person icon, swap
it.

## Round eighty-eight

**The template geometry moved again, and this time it is measured rather
than approximated.** Staw put the sheet everybody already draws into next to
ours: "same exact template as roblox but make it a different design for the
images on it - the stuff that are not apart of the clothing". So the layout
is now the real one, off the real file, and only the furniture is ours.

What changed in `templateFor`, in numbers:

- Torso: lid `(231, 8)`, row at `y 74` with sides at `x 165` and `x 361`,
  front `x 231`, back `x 427`, floor `(231, 204)`. Panels are 64 or 128 wide
  with **two pixels between them**, so the pitch across a strip is 66, not
  64.
- Limbs: the strips start at `x 19` and `x 308`, the row is `y 355`, the lid
  `y 289`, the floor `y 485`.
- **The avatar's right limb is the strip on the left of the page**, and it
  was not. `LIMBS` was read off in the order the parts are listed, which put
  every sleeve on the opposite arm. It is keyed by `left`/`right` now. If you
  cached a wrap or a preview from before this, drop it.

The sheet is still 585 x 559 and `PIXELS_PER_STON` is unchanged.

**The drawing is all outside the panels now.** The panels are cleared to
transparent and nothing is drawn into them - no guide line, no centre line,
no corner tick, no faint fill. The old sheet drew those inside each panel,
which is a guide on the template and a ghost on the shirt of anybody who did
not paint over every corner. The field, the hairlines, the part names and the
notes live in the two-pixel gaps and the margins the layout leaves over, and
`drawTemplate` clears the panels **again** as its last act, so a letter that
strays gets cut off on the sheet rather than printed on a garment.

If you render the template anywhere in the Workspace, that is the rule to
copy: **a panel is the garment.** `grab-templates.mjs` at the root of this
repository regenerates the two PNGs and fails if any panel has a pixel in it.

The furniture itself is ours: a grey field, the Kobblon wordmark and the size
in the top left, the part names spaced out in the margins, and under each
limb the order its faces lie in across the sheet - which is the thing people
actually get wrong, since the two limbs do not read the same way.

Nothing about wrapping, the two-layer alpha shader or `K6` changed in this
round. 169 engine checks pass.

## Round eighty-nine

**Shops.** Migration **0244**. What somebody sells, under their own name or a
Community's, in one place rather than scattered through the Catalog.

New on the database side:

- `avatar_items.community_id` - an avatar item can belong to a Community.
  Assets have had this since 0029; items never could, so a Community could
  sell Decals and models and not a single shirt.
- `create_avatar_item` takes a ninth argument, `maker` (the Community, null
  for yourself). **The eight-argument version is dropped**, because a
  defaulted argument overloads rather than replaces and a call naming the
  first eight would match both. If you call this, pass the new argument or
  name your arguments.
- `shop_shelf(owner_user, owner_community, how_many)` and
  `shop_size(owner_user, owner_community)` - what is on sale, which is
  approved, listed and not taken down. An item a Community owns is on the
  Community's shelf and not on its maker's.
- `buy_avatar_item` pays a Community item's share into that Community's
  funds and logs it, the way `buy_asset` has since 0033. Kobblon's cut is
  unchanged. The making fee comes out of the same purse that will be paid,
  so a Community with empty funds is told so rather than the person quietly
  paying for something they will never be paid for.
- `list_avatar_item` may now be used by anybody who runs the Community an
  item belongs to, and refuses to list anything not yet approved.

**Three functions grew columns and had to be dropped to do it**:
`avatar_shelf`, `avatar_item_page` and `my_made_avatar_items` each return
`community_id, community_slug, community_name` at the end now. A
`returns table` cannot grow a column in place - "cannot change return type of
existing function" - so each is a drop and a create. If you select columns by
position anywhere, re-check those three.

**The byline is carried beside the creator, not written over it.** Staw: "i
want it to be said to be 'by [community]' rather by the guy who uploaded
it". `creator_id` and the creator columns still name the person who pressed
the button, because that is what a takedown, an audit entry and a suspension
read; the Community columns are what a shopper reads. Prefer them when they
are set, and give a Community the people icon rather than the verified tick -
the tick means a verified person and lending it to a Community says something
nobody has checked.

**Nothing unapproved goes on a body.** `wear_avatar_item` asked only whether
you owned something. A maker owns what they made the moment they make it, so
a maker could wear anything at all for as long as it took somebody to look at
it, and keep wearing it after it was turned down - and everybody saw it on
them the whole time. It now refuses `pending` ("still being looked at") and
`rejected` ("was turned down"), separately, because a wait and an answer are
not the same thing to say. Buying has always refused both; only wearing was
open.

Worth knowing for your own panels: **a mesh that is still pending can still
be used as an accessory's model**, deliberately. The accessory it becomes is
moderated as a whole, and requiring the mesh first would break making one in
a single pass - the model is uploaded and used in the same breath.

**Taking something off sale is not taking it away.** `list_avatar_item(id,
false)` closes buying and nothing else: every copy sold stays owned, wearable
and drawn. Checked explicitly, because Staw asked exactly this - sell it,
somebody buys it, unpublish it, and that person still has it.

On the website side a Shop tab sits on profiles and on Communities, Roles
wear a person icon rather than the staff badge, and a picture that will not
load is Kobby holding the empty box rather than a broken-image frame.

## Round ninety

Six things, and one of them changes a shared meaning, so it goes first.

**A garment's picture is never its template any more.** `cardFor` returns
null for a shirt or trousers that has no drawn card, instead of falling back
to `image_path`. That fallback was handing the texture itself - the thing
somebody paid for - to anybody looking at a shelf, and Staw wants it gone:
"then people can steal it and reupload it". If you call `cardFor` for a
garment, expect null where you used to get an address, and draw the body
instead. The website's answer is `WornPicture` (`src/components/catalog/`)
over `wornCard` (`src/lib/wornCard.ts`), which draws the mannequin in the
tab from `drawItemCard`, one at a time because each drawing takes a WebGL
context, memoised per item and never uploaded. Both are importable. A face
and an accessory are unchanged: those are pictures of themselves.

**The limb faces on the clothing sheet are flipped again, and this is the
second correction.** The first was a column out, which put the front down
the sides. This one kept the front and back right and swapped each limb's
inner face with its outer one - the two rows ran the same way round the
limb, which is not a mirror. Staw: "the sides of the arms & legs that were
supposed being the inside sides were replaced by the ones on the outside".
`LIMBS` in `@/engine/clothes` now reads `left, back, right, front` for the
avatar's right limb and `front, left, back, right` for its left. The sheets
in `public/templates` are regenerated and their printed labels say the same.
If you have anything that reads that table or ships its own copy of the
numbers, take these. New engine check: a leg's inner face lands on the panel
the sheet calls its inner one. 172/172.

**A thing to wear belongs to a Community, and only its list shows it.**
Migration 0245: `my_made_avatar_items` takes `for_community uuid default
null`. Null is you personally and that now means your own things *only* -
anything with a `community_id` is off that list and on the Community's,
where every manager of it sees it. It also returns `creator_id` on the end,
which the old arity did not. The old no-argument call is dropped; both
arities are dropped at the top of the file so it can be run twice.

In Create, who you are working for is the Working as menu and nothing else.
The picker that was in the make dialog is gone - two controls for one
question, and the list obeyed neither.

**0245 also adds `move_avatar_item_maker(item_id, to_community)`**, which is
for the half of this nothing could guess: everything uploaded for a
Community before there was a column to record it carries `community_id`
null, so it reads as its maker's own work on their shop and in the byline.
Only whoever made it may move it, and only to a Community they may manage;
moving it back needs nothing more than having made it. Copies already sold
are untouched. The card's menu offers it both ways.

**Migration 0246: Kobblon may replace the picture on its own shirt or
trousers.** `replace_avatar_picture` took faces only. Staw: "in create, only
the kobblon account can replace its own shirt & trousers images by a new
one, instead of reuploading them" - when the template geometry moves under
a garment, as it just did twice, the alternative is deleting it and
everybody who owns one losing it. Still Kobblon's alone, still refused for
anything else, and now also refused on a garment Kobblon did not make. It
clears `preview_path`, so the card is drawn again from the new picture.
Checked under two signed-in identities, with the row read back after the
write.

Small: a Community's description on its page is folded to three lines with
See more, counting newlines as well as characters - Staw's own Community
ran ten lines deep on under two hundred characters, so the count alone said
"short".

**Still not built, same as last round:** the staff side of warnings,
suspensions and bans. Nothing calls `ban_account` or `lift_account_ban`, and
there is no suspend action in the console. The person's side of it landed
last round; the console's side has not.

## Round ninety-one

**Body parts exist, and they are a shape rather than a file.** Staw: "we
want to be able to sell bodyparts too (kobblon only can upload some)". A
seventh kind of avatar item, `bodypart`, and the first one that is neither a
picture nor a model: the row names a shape the engine knows how to build.

Why it has to be that way, because this is the part an application cannot
guess from the column: a part of the body is skinned to a bone and is the
box the clothing sheet is measured against. A mesh somebody uploads is
neither, so a shirt worn over it would land anywhere. The geometry is the
engine's; the row names which one. That is also the whole reason the kind is
Kobblon's: a shape has to be in the build before a row can name it.

- `@/engine/bodyshapes` is new and exported from `@/engine`: `BODY_SHAPES`
  (the shapes, by the name a row carries), `shapeFor`, `PART_FOR_SLOT` and
  `SLOT_FOR_PART` (the wardrobe speaks in slots, the rig in parts - do not
  write a second table), and the `WornShapes` type.
- `K6.setShape(part, shape)` and `K6.setShapes(shapes)` on the rig. Changing
  a part rebuilds its geometry, carries the bone over from the geometry
  being replaced, drops the wrap marks and wraps whatever it is wearing onto
  the new surface. Call `setShapes` once with every part, not `setShape` six
  times.
- `WornLook`'s pieces carry `shape?: string | null`, and `dressFrom` applies
  every shape in the look **before** a stitch of clothing, in one call, and
  **always** - a look with no body part in it puts the plain block back,
  which is how taking one off works on a rig you reuse.

**The box a shape lives in never changes.** A shape may move the surface
around inside `BODY[part]` and may not leave it. That is what keeps a shirt
fitting a narrower waist instead of needing its own sheet, and it is what
the new engine checks measure: the part keeps the template coordinates it is
wearing, stays inside the box, and is actually pinched rather than the plain
block. 175/175. Looked at as well as measured - the same shirt over the plain torso
and over the waisted one, which is in the repository as
`tools/site/bodypart-preview.html`, and the card drawing as
`tools/site/bodypartcard-preview.html`.

**Migration 0247** does the database half, and it is wider than it sounds
because the slot list is written down in more places than one:

- `kind` gains `bodypart`, `slot` gains `torso`, and `avatar_items` gains
  `shape text`. `avatar_item_has_its_thing` now reads "a part needs a
  shape" - 0112's `else mesh_id is not null` made a body part impossible to
  insert, which is the one case its `else` was never written for.
- **`avatar_worn` carries its own copy of the slots** and it is widened
  too. Without that half a torso can be made, bought and owned and is
  refused the moment somebody puts it on.
- `one_at_a_time` and the `avatar_worn_one_per_slot` index gain `torso`: two
  torsos is not ugly, it is undefined. The index is dropped and rebuilt,
  not `if not exists`, or the old five-slot list would have stayed.
- `avatar_rules` gains `('bodypart', 0, 0, false, true)` - free to make,
  free to price, Kobblon only.
- `create_avatar_item` takes a tenth argument, `form text default null`,
  which is the shape. **Both arities are dropped before the create**: a
  defaulted argument overloads rather than replaces, and which one answers
  would depend on how the caller spelled its arguments.
- Six readers hand the shape back: `avatar_of`, `outfit_look`,
  `avatar_item_page`, `my_avatar_items`, `my_made_avatar_items` and
  `avatar_shelf`. Each is dropped
  first - a `returns table` cannot gain a column in place. If you read any
  of these positionally, there is one more column on the end.

Applied twice against a local Postgres and exercised under two identities:
Kobblon makes one, a part with no shape is refused, a part in the wrong slot
is refused, an ordinary account is refused, a stranger buys it and wears it,
and a second torso replaces the first rather than joining it.

**Migration 0248 is the item itself: "Waisted Torso", 95 Brix, by Kobblon,
shape `torso-girl`.** Staw asked for "a girl torso (like roblox but slightly
more original)" and then said what he meant by the shape: "normal blocky
torso like the regular torso but in the middle on each side it gets tight,
like a waist". So it is the plain block, full width at the shoulders and at
the hips, taken in on the two sides only - the chest and the back do not
move, so it is the same torso from the front and a waist from the side.
Named for the shape rather than for who it is for; anybody may wear it.
Seeded in a migration rather than made in Create, because a row somebody has
to remember to click a button for is a row that is missing from the next
deployment. Re-runnable: it inserts nothing if a `torso-girl` is already
there.

**On the website:** Create has a Body part tile for Kobblon that picks from
`BODY_SHAPES` instead of asking for a file, and draws it on the mannequin
straight away; the Catalog has a Body parts shelf; the item page will wear
one and says "It is the torso" for the slot; and My Avatar shows the parts
you own in the **Body** drawer, beside the colours, because that drawer is
the one about the body itself. `avatarKindLabels` says "Body part" and
`avatarCodes` says `BODY`, so a Catalog number reads `BODY-1234`.

**What is not built.** Only the torso has a shape, so `torso` is the only
body-part slot: arms, legs and a head are added to the slot check when the
engine grows a shape for them, and the create page offers what is in
`BODY_SHAPES` and nothing else, on purpose. A shape cannot be swapped on an
item after it is made - there is no `replace` for this kind, the way there
is for a face's picture. And the staff side of warnings, suspensions and
bans is still not built: nothing calls `ban_account` or `lift_account_ban`,
and there is no suspend action in the console.


## Round ninety-two

Four corrections to last round, all of them Staw's, and the first is a bug
worth reading even if you do not touch the Catalog.

**A body part made in Create could not be worn.** Staw: "you cant wear
body parts for some reason". Nothing to do with body parts, in the end:
`create_avatar_item` lands everything `pending` and `wear_avatar_item`
refuses anything pending, which is right for every kind that has a file in
it and wrong for the one kind that has none. A body part uploads nothing -
no picture, no model, no texture - and its name and description have
already been through `screen_text` ten lines earlier, so the only thing
left to screen is a shape Kobblon wrote into the engine. **Migration 0249**
approves a `bodypart` on the way in, and only a `bodypart`: a shirt still
goes for screening. It is still not listed on the way in; listing is a
separate press for every kind, and that was not what was in the way.

What made it hard to see from outside: the seeded one was inserted
`approved`, so the database looked fine and the page looked broken.

0249 also reaches backwards and approves any body part already stuck
pending, because a row made yesterday is as unwearable as one made tomorrow
and nobody was going to go and screen it.

**It is called Girl Torso.** Staw: "we really want to call this a girl
torso". "Waisted Torso" was me naming the shape rather than the thing.
0249 renames the seeded row; the shape's own name in the engine,
`torso-girl`, is unchanged and must stay unchanged - it is written into
every row sold under it.

**The shape is built a different way, and the old way could not have
worked.** Staw: "ours is kinda ugly ngl and not rounded like other body
parts we made", then "i wanted something a bit more geometrical like for
the roblox girl torso". Both are now true of it, and getting there ruled
out the obvious route for good:

- `RoundedBoxGeometry`'s segment count is **the rounding of its corners and
  nothing else**. At three segments or at twelve, the flat faces carry
  vertices only at the top and the bottom. Measured twice. If you ever want
  to deform a part of the body, this is not the geometry to start from.
- A plain `BoxGeometry` with its sides divided does take a waist, and loses
  every rounded edge - which is exactly what Staw was looking at.
- What it is now: the silhouette is cut as a `Shape` and extruded through
  the depth with a bevel, so the sides go wherever the profile says and
  every edge is rounded like the arms beside it. The profile is straight
  lines between its points, not a curve, which is the "geometrical" part.
- Then it is scaled to measure its part's box exactly. A bevel grows the
  outline along the normal and the growths add where two lines meet, so the
  shoulders came out a hundredth of a ston wide. A hundredth is nothing to
  look at and it is not nothing to the rule: the clothing sheet is measured
  against that box.

**The numbers are measured off a file Staw made rather than guessed.** The
waist sits at **0.38** of the way up, not halfway, and comes in to **0.70**
of the half width. A waist halfway up reads as an hourglass; his sits low,
which is why it reads as a person. His file also narrows through the depth
by about the same amount and ours does not - an extrusion is one thickness
all the way through, and bringing the chest and the back in afterwards
bends the flat face it was cut from. It came out as a fan of creased
triangles across the front; at this size, next to arms that do not narrow,
that is not a trade worth making. Said here because it is the one way ours
differs from the reference on purpose.

The file itself was measured and not used: it is a Roblox Studio export and
says so in its first line. It could not have been used as it stands either,
for the reason last round gave - a body part here is geometry the engine
builds, so that it keeps the bone it is skinned to and the box the sheet is
measured against.

**Body parts are their own category in the wardrobe**, next to Clothing and
Accessories rather than inside the colours. Staw: "i want a new category
called body parts separate from the skin colour & other categories". The
drawer that holds the colours is called **Skin** now, which is what it
holds. The parts drawer is the ordinary shelf every other drawer uses -
same tiles, same wear and take off - which is also why the bespoke shelf
last round added inside the colours is gone.

Engine check 175/175, and one of those checks had to be corrected rather
than satisfied, which is worth saying out loud. The check for the waist
sampled a fixed band of height - y 5.5 give or take 0.4 - and the rebuilt
profile puts no vertices in it, so it reported "no waist" on a torso that
has one. A check written against coordinates a shape happened to have is a
check that fails the next time the shape moves. It now takes the middle of
the part's own bounding box and compares the narrowest point to the widest,
and prints both: **1.20 across at the waist against 1.80 at the
shoulders**.

## Round ninety-three

One line's worth of bug, in the place it is most visible. Staw, with a
screenshot of his own wardrobe: "make sure that the girl torso also applies
everywhere its worn, like in the my avatar page where it doesnt appear".

**My Avatar built its own look and dropped the shape.** The page maps
`avatar_of`'s rows into the stage's pieces by hand rather than through
`buildLook`, and that mapper named every column but `shape`. Everything
else that draws an avatar - a profile, an outfit, the Catalog's try-on -
goes through `buildLook`, which carries it, so the one page you actually
dress on was the one page it did not reach.

What makes it quiet, and the part to carry across: a body part has **no
address of its own**. A hat with no `meshUrl` draws nothing and you know
instantly; a body part with no `shape` draws the plain block, which is
exactly what an avatar wearing nothing looks like. The wardrobe said
"PARTS 1" and the body said otherwise.

Two fixes, and the second is the one that matters to you:

- The mapper passes `shape` now.
- **`AvatarLook`'s piece type carries `shape`**, which it did not. The
  stage was being handed it by `buildLook` and reading it through
  `dressFrom` while the type in between never mentioned it, so a page that
  forgot it was told nothing. If you assemble an `AvatarLook` yourself
  anywhere, this is the column to check you are passing.

`tools/site/avatar3d-preview.html` has a sixth stand now - "Wearing a body
part" - which hands the stage a piece with a shape and no address, the way
a page does. If the stage ever stops carrying it, that stand goes back to
the plain block and says so.

## Round ninety-four

Hair was broken, and the reason is one you can copy wrong in a line.

**A haircut hung off the hat socket.** They shared one on purpose, and the
note saying so was wrong: "both sit on top of the head". A hat sits **on**
the head; hair is a thing the head goes **inside**. The hat socket is the
top of the skull and `WORN_FIT.hat` has `out: [0, 1, 0]`, which lifts
whatever is on it by half its own height so it rests on the part rather
than halfway through it - exactly right for a hat, and for hair it means
every haircut floats above the scalp like a lid. Staw: "for hair, its
bugged".

There is now a **`hair` socket**: same bone, the middle of the head rather
than the top of it, `across` of `Head.w * 1.35`, and `out: [0, 0, 0]` -
pushed off nothing, because hair is meant to be inside the head. If you map
slots to sockets anywhere, `SOCKET_FOR.hair` is `'hair'` now and not
`'hat'`.

**What this moves.** Any haircut a maker already placed by hand was placed
against the old socket, so its saved `fit` now reads as an offset from a
different starting point. There are few enough of them that nobody is going
to notice a historical one being a little off, and leaving the socket wrong
so old fits stay consistent is keeping a bug to protect the workarounds for
it. Flagged because it is a meaning change: the same `fit` numbers describe
a different place than they did yesterday.

**The reach doubled.** Staw: "make that we can make the hair go lower (in
stons) and larger range when setting up hair". Five stons was written for
an accessory you nudge; hair is pulled down over a head. **Migration 0250**
takes `sane_fit` to ten stons each way and the resize to six times, and
`FitEditor`'s sliders move with it in the same push - a page offering a
reach the server refuses is a control that fails on save. If the Workspace
has its own placer, those two bounds are the ones to change.

**The skin colours are Staw's five**, replacing the ramp I had picked:
`#53463E`, `#87674F`, `#B39B8B`, `#D29A72`, `#EBB591`. Bright, Quiet and
Deep are untouched. The body a new account starts with was `#f2d08a`, which
is no longer on any shelf, so it is `#EBB591` now - a default nobody can
choose again is a body you cannot put back the way you found it.

Engine check 177/177, with two new ones that say where hair is rather than
that it is somewhere: it is at the middle of the head (8.5 against 8.5),
and its bottom is below the top of the head (8.3 against 9.7). The old
checks would have passed on the broken version, because a lid on a skull is
still "on the hat socket, roughly the right size".

`tools/site/skin-preview.html` is new: the five tones on the rig rather than
as squares, because a tone that reads warm in a 24-pixel swatch can read
orange across a whole person.

## Round ninety-five

Mine, and it had been live since 0247.

**An item made from a model and a picture was stored with no picture.**
Staw: "for some reason the textures of the hairs dont appear". It is not
hair. Uploading a model and its picture together makes one Decal and hangs
it on the **mesh row**, and the page then creates the item naming no
texture, because the model already wears one. 0130 added the fallback that
reads it back: no texture named and a model given, take the model's.

0247 rewrote `create_avatar_item` to carry a body part's shape and copied
every line of it except that one. So since 0247, every accessory and every
haircut made the ordinary way has had `texture_id` null and has rendered
grey. The model was textured the whole time. Nothing threw, the upload
succeeded, and the only symptom was a grey model - which reads as "the
texture did not upload" and sends you looking in storage, where the picture
is, correctly, attached to the mesh.

**Migration 0251** puts the fallback back and backfills: every item with no
texture of its own whose model wears one takes it. Only those - a maker who
deliberately left a model bare has no Decal on the mesh either, so nothing
anybody chose is overwritten. Nothing on this side needed changing; the
pages were right and the function was not.

The rule to take from it, because this is the second time in four rounds:
**a function rewritten to add a column is a function rewritten.** The thing
to check is not that the new column works - it is that every old one still
does. The check that catches it is behavioural and not a column list: make
the thing the ordinary way and read back what it got.

Checked under two identities, as everything here now is: the owner's new
haircut took its model's picture, a stranger naming that same mesh still
gets "That model is not yours to use", and after the backfill nothing is
left with a bare item over a textured model.

## Round ninety-six

The staff side of warnings and suspensions, which has been missing since
sanctions existed.

**The console could not sanction anybody.** Everything a sanction is made of
- the rule, the reason the account is allowed to read, the violation row the
standing page counts, the mail, the appeal that follows - is written by
`take_report`, and `take_report` needs a report. Staff looking at somebody
they already knew about had one control: a `Suspend` button that flipped
`is_suspended` through `admin_set_standing`. No reason, no end, no violation,
no mail. The person saw a locked account and a standing page telling them
nothing was wrong with it, which is the worst version of a sanction: felt,
and unappealable, because there is nothing on the record to appeal.

**Migration 0252** adds `sanction_account(target, action, why, rule, days)`
- `take_report`'s second half with the report taken out. Warning, chat
suspension or account suspension; same violation row, same mail, same admin
log, same rank rules. The reason has to be ten characters, not three: a
sanction with no report behind it has nothing else explaining it.

**The machine is refused this door by name**, the way `ban_account` refuses
it. Not by rank - the worker holds a key that passes a staff check, that is
the whole reason it has one. Kobby acts on reports; a sanction against
somebody nobody reported is the machine choosing who to look at. Staw's line
is unchanged and now true in two places: warnings and suspensions, and no
door at all for closing an account.

**`ban_account` and `lift_account_ban` have a caller.** They have existed
since 0243 and nothing in the website called either, so a ban could not be
handed out or lifted anywhere. Both are on the person's card now, for a
superadmin, behind a confirmation that says what a ban is: locked out and
told why, nothing deleted, appealable, and lifting it voids the decision
rather than hiding it.

**`admin_find_people` grew three columns and lost a rank check.** It now
answers `is_banned`, `suspended_until` and `past_sanctions`, because each
one was a control lying without it: a Suspend button on somebody already
banned, an Unsuspend that would quietly undo a termination, and no way to
see this is somebody's fourth warning while deciding the fifth. And it
required an **admin** while the People section is a moderator's and the card
draws them a panel written for them - so the one rank it was designed for
could not open it. It is `is_moderator` now; every write behind it is
unchanged and still refuses them.

If the Workspace ever grows a staff panel, `sanction_account` is the one to
call and `admin_set_standing` is not: the flag without the record is the bug
this round is about.

Checked under three identities, as everything here is now: a moderator
warned somebody and the violation landed; a three-day suspension set the
flag and the end, both read back through the console's own row; a ban made
`is_banned` true and cleared the end; lifting it cleared both; a bare reason
and an ordinary signed-in account were refused.

## Round ninety-seven

Waiting, and the three places the site was making its own.

**A refresh showed a blank dark screen** until the whole bundle had come
down. Not a bug in anything - just that everything able to draw anything,
the boot screen included, lived inside the bundle, and the boot screen's
only content was `<img src="/brand/logomark.png">`, so even after the code
arrived it was empty until a second request finished. `app.html` now carries
a `#boot` block with the logomark inlined as a data URI and its own
keyframes, so the mark is on screen at the first paint with no network at
all; `main.tsx` removes it the moment React mounts. **If the Workspace shows
a web view of the site, this is the thing to copy** - a document that paints
its own loading state rather than one that waits for the bundle to paint it.

**Signed asset links are reused now.** `assetUrl` bought a fresh signature
from storage on every call - every model, every texture, every preview,
every render, every reload. The waiting was the smaller half: a fresh
signature is a different URL, so the browser's own cache missed pictures it
already had on disk and downloaded them again. They are kept in
`sessionStorage` under `kob.signed` and reused until a minute before expiry,
and calls in flight for the same path share one request. **The signature of
`assetUrl` is unchanged** (`(path, seconds?) => Promise<string | null>`), so
nothing importing it needs to change; it is no longer `async`, which matters
only if something was awaiting it for timing rather than for the value. An
application with its own session gets its own cache, because the store is
per-origin and per-tab.

**The face queue was never a queue.** `headshots.ts` said one WebGL context
at a time and chained `queue.then(() => work)` where `work` was an
**already-started** promise - so the chain waited for each draw in order and
every one of them had begun the moment it was asked for. Twenty faces on a
page were twenty fetches and twenty contexts at once, which is the thing the
queue was written to prevent. CLAUDE.md's second trap exactly: a guard that
exists, is checked, and watches nothing. `work` is a function now and the
queue calls it. Drawn faces also survive a reload: kept as data URLs under
`kob.faces` for ten minutes, sixty most recent, cleared for anybody whose
avatar you change through `forgetHeadshot`.

**A meaning change, and it is the one to read twice: a profile picture is
now always a picture of the avatar.** `portraitIsCurrent` used to accept any
stored `avatar_url` it could not date - an uploaded image had no
`portrait-<when>.webp` stamp, so it counted as current and was shown. Staw:
"i want the profile picture to be always based on the avatar". Unstamped
means not-a-portrait now, and the face is drawn from the avatar instead.
Nothing is deleted and no row is written; the upload is still in
`avatar_url`, it is simply not what gets shown. **If the Workspace reads
`avatar_url` directly anywhere to show somebody's face, it will now disagree
with the website for any account that uploaded one.** Use `useHeadshot`, or
apply the same rule: only `portrait-<digits>.webp` counts.

**Still not done**, and said plainly: nothing here makes the avatar itself
draw faster - a first look is still a fetch and a render, and only the
second one is instant. Migrations **0249, 0250, 0251 and 0252 still need
applying in the Supabase SQL editor, in that order**; everything in rounds
ninety-four through ninety-six is deployed and waiting on them.

## Round ninety-eight

**The landing lockup is one piece of artwork now.** `public/brand/landing-lockup.png`
(727x231, transparent) - the wordmark and "The game built by players." as
Staw drew them, replacing `wordmark2.png` plus a text strip held in line by a
negative margin. `wordmark2.png` is no longer used by anything on the site;
it is still in `public/brand/` and nothing has been deleted. If the Launcher
or the Workspace shows the same lockup, use the new file rather than
rebuilding the two-piece version.

Staw has applied migrations 0249 to 0252.

## Round ninety-nine

The staff console is a page now, and the machine keeps its own time.

**It was a card over the site and it is a page**, at `/staff` and
`/staff/<panel>`. The card was the right shape for one decision and the
wrong one for a shift: capped at 92vh on a monitor with twice the room, two
scrollbars fighting over one wheel, no way to link a queue to somebody, and
a reload dropped you back on the first panel. A panel is an address now, so
`/staff/reports` is a thing staff can send each other. **If an application
links into the console, link to the panel, not to `/staff`.**

**It opens on an Overview** - the four queues as four doors with their
depths, Kobby's state and its last five decisions, and the house's numbers
as one line. The rail carries the same depths as badges, so nothing has to
be opened to find out where the work is. Two new functions behind it, both
moderator-gated and counts-only: `staff_overview()` and `machine_pulse()`.

**People lists everybody when it opens**, instead of an empty box and a
sentence explaining that pressing Look with nothing typed would list the
newest accounts. Typing narrows what is loaded at once; Look still asks the
database. Each row is one line until it is opened, because twenty accounts
each carrying six rank buttons, a Brix box and a Delete was three hundred
controls on one page.

**Migration 0253: the machine runs all the time.** This is the part worth
reading. Every way the worker got woken was an *event* - a trigger on an
insert, or somebody pressing the button - and three things fell through
that silently: the twenty-second debounce dropping a knock with nothing to
knock again, a knock going out while the function was down (`pg_net` does
not wait for an answer, by design), and 'slow' mode, which knocks never and
had only a GitHub schedule coming back for it. `keep_the_worker_awake()` is
a sweep: every minute, if anything is genuinely waiting under the current
mode, it knocks. It is scheduled with `pg_cron` as the job
**`kobblon-machine`**, looked up by name at apply time so a project without
`pg_cron` applies the file cleanly and says so in the console instead.

The sweep counts the queues itself rather than calling `ai_work_waiting`,
and that is not duplication: that function demands `is_moderator() or
is_the_worker()`, and cron runs as the job's owner with no JWT at all - it
would have raised every minute, a schedule that is on, scheduled and
failing. Caught by running it as `service_role` before trusting it, which
is the check CLAUDE.md asks for.

**The machine panel is rebuilt around three states, not one.** On, beating
and wired are different questions and all three have been false here while
the panel said On. Whatever is false is now a sentence with the fix in it.
**For the applications: "the machine is on" is no longer the state to show.
Read `machine_pulse()` and show it awake only when `is_on && beating &&
wired && net_ready`.**

**Not done, and needed from Staw:** apply 0253, and turn on `pg_cron` for
the project - without it the heartbeat is not scheduled and the console
will say so in as many words. Nothing else in the console depends on it.

## Round one hundred

Two batches: the console got Kobblon's own icons and a Words panel somebody
can use, and then the moderation system got the thing it was missing - Kobby
reading names, and a handle that spells itself out being caught.

**Nothing in this round changes a shared signature you import.** The
engine fix below changes behaviour, which is the part to read.

### The engine: a haircut was never drawn, and a hat was one thumbnail away

`dressFrom` in `@/engine/dress` decided whether a worn piece was *painted on
the body* or *hung off a socket* by asking **whether the piece had a
picture**:

```ts
if (piece.imageUrl) { /* shirt, trousers, face, tdecal */ continue }
```

Every catalog item has a picture - it is the thumbnail on its card. So a
haircut arrived in that branch, matched none of the painted-on slots, hit the
`continue`, and **its model was never loaded**. Worn, in the look, in the
database, and nothing drew it. Reported on Discord as "why doesn't my hair
show". Hats, accessories, wings and everything else on a socket were one
thumbnail away from the same silence.

It is the slot that decides now:

```ts
const PAINTED_ON = new Set(['shirt', 'trousers', 'face', 'tdecal'])
```

**If either application has its own dressing path, read it for the same
test.** The symptom is not an error anywhere: the piece is simply absent, and
a look that is right in the database renders short. The check that catches it
is not "does the look contain the piece" - it does - it is **"is something
parented to the socket afterwards"**.

### Screening: spelling it out is still saying it

`f_u_c_k` passed the handle check, and so did anything else anybody cared to
space out. Not a gap in the word list - the word is on it - but the
flattening in front of it: `normalize_for_screening` turns every separator
into a **space**, so the patterns were handed `f u c k` and looked that up.

`screen_text` reads the same text three ways now (migration 0254):

- flattened, as before;
- raw, as before;
- **squashed**, with separators removed rather than replaced, so `f_u_c_k`,
  `f.u.c.k` and `F U C K` all arrive as `fuck`.

The squashed reading is used for everything in `identity` and `name` scope,
and in chat only when the text is **actually spelled out** - three or more
single letters each standing alone. The patterns' leading `(^|[^a-z])` guard
is dropped against the squashed reading, and only for spelled-out text:
dropping it for every handle would make `classy` an `ass`, which is the false
positive the guard was written for. Checked both ways: the four evasions are
caught, and `classic`, `grassroots`, `assembly`, `bassline`, `scunthorpe`,
`passionfruit` and ordinary sentences are not.

**Also in 0254, and worth a line of its own:** `screen_text` lost
`security definer` in 0238, because `create or replace function` resets the
attributes the old one had rather than keeping them. The term list is not
granted to `authenticated` by design, so anything calling the screening
*through* another `security definer` function carried on working - which is
most of the platform, and why nobody saw it - while a page calling
`screen_text` itself as a signed-in person got
`permission denied for table moderation_terms`. If either application calls
it directly, that is why it failed. It is a definer again.

### Kobby reads names now

Everything a person writes went past Kobby except the three pieces of writing
on every page they appear on: their handle, their display name and their bio.
Migrations 0255 and 0256:

- **`names_to_read`** - a queue, fed by a trigger on `profiles` for an
  inserted or changed `username`, `display_name` or `bio`. Guests and staff
  are not queued. It honours `kobbleston.renaming`, so Kobby's own reset does
  not hand Kobby the name it just chose, for ever.
- **`ai_work`** gains a `profile_text` subject, whose `kind` is which field it
  is - `username`, `display_name`, `bio`.
- **`ai_work_waiting` gains a `names` column.** It is `drop`ped and rebuilt
  rather than replaced, because a `returns table` cannot grow a column in
  place. **A client that destructures its row by position, or types it
  exactly, needs the extra field.** `total` includes it.
- **`judge_profile_text(entry, breaks, rule_code, reason, model)`** - the same
  shape as `judge_chat_line`: the model says whether a rule is broken and
  which one, and the **database** decides what happens, from the rule's
  gravity and the person's behaviour band. One rung is bent: `quieted` means
  nothing for a name, so it reads as a warning.
- What it may do: a bio is **emptied**, a display name goes back to the
  handle, and a handle is **reset** to `player<content id>` with a row in
  `username_history` and a notification saying they may pick a new one. At
  every rung above nothing, because leaving a slur on a profile page while a
  warning sits on a record answers the wrong question. **Never a deletion,
  by Kobby or anything automated, at any rung.**
- `keep_the_worker_awake` counts names too, or a project in `slow` mode with
  nothing but a waiting handle would never wake.

The worker has a `profile_text` branch with its own prompt, which is a
separate prompt on purpose: a handle has no context, no person it was said
to and no punctuation, its evasion is spelling, and it is short enough that
an innocent reading is usually the right one.

**The trap this one walked into and out of:** `judge_profile_text` is
`security definer`, and both `guard_username` and `guard_profile_update` ask
`auth.uid()` who is writing - which is the *caller*, not the definer. A
rename would have been pinned straight back and a suspension dropped on the
floor, with no error anywhere. It raises `kobbleston.renaming` and
`kobbleston.standing` round its own writes and lowers them immediately, and
the checks read the row back under a real signed-in identity rather than
anonymously - anonymous checks pass for the wrong reason, because
`auth.uid()` is null and the guards exempt the write.

### The console, from the earlier batch

- The rail and the panel headings use Kobblon's own drawings where one
  exists - `@/components/brand/Icon`, `UI_ICONS` - and Font Awesome only
  where there is none.
- **Words** takes plain words and writes the guarded pattern itself, so
  nobody is typing `(^|[^a-z])(…)` by hand. And it can be asked in a
  sentence: "censor everything about X" gets a **draft** from Kobby which a
  person reads, ticks and applies. Kobby drafts; it never writes to the term
  list on its own.
- The staff record is a ledger by day, with the whole of an entry in a popup,
  and a person's record opens as one too.
- The machine panel says what Kobby handles with nobody here, Names
  included.

### Still not done

- The remaining console panels - Reports, Screening, Notice, Announce, Sale,
  Map - are not redesigned yet.
- **`pg_cron` must be enabled** for the `kobblon-machine` heartbeat, and 0254,
  0255 and 0256 need applying. Until the extension is there, `machine_pulse`
  answers `beating: false` and says so rather than failing.
- No backfill: accounts that existed before 0255 are not queued. There is
  `queue_profile_text(uuid)` for staff to ask for one account to be read.

## Round one hundred and one

**Staw's logo reveal is the loading screen, and the applications should use
it too.**

The file is in this repository at **`public/brand/logo-reveal.gif`** -
420x215, 20fps, transparent background, loops. It is the full-size original
cut down from 1.2MB to 494KB; the original is at
`design/art/logo-reveal-source.gif` (820x420), which is deliberately outside
`public/` so it is not served.

Transparent, so it sits on whatever the panel's background is. Checked on
`#101012` with no white fringing.

**`LoadingScreen` and `LoadingMark` in `@/components/ui/Loading`** are the
website's two loading states and are yours to import. `LoadingScreen` is the
whole-window one; `LoadingMark` is the mark on its own for a wait inside a
panel. Neither takes a provider, a router or a session - `tools/site/
loading-preview.html` mounts `LoadingScreen` with nothing around it, which
is the check that it stays mountable.

**The one thing worth copying rather than the GIF itself:** half a megabyte
is not on screen at the first paint. Both loading states draw the still
logomark immediately and fade the reveal in over it on `load`, so a wait
that is over in 200ms shows the still mark and never flickers, and a wait
long enough to notice gets the animation. The website's own document
(`app.html`) does the same with an inlined data-address logomark, because
there the bundle has not arrived either. If a panel shows the GIF alone, a
cold start is a blank rectangle for as long as it takes to fetch - which is
the bug the boot screen was written to fix in the first place.

## Round one hundred and two

**Correction to the last round: the still mark underneath is gone, and if
you copied that part, take it out.**

Round one hundred and one said to draw the still logomark immediately and
fade the reveal in over it, so a short wait shows something rather than
nothing. Staw looked at it running and it was wrong twice:

- a load quick enough never reached the reveal, so what you actually saw
  was the blue logomark - which is not the loading screen anybody asked
  for;
- while both were up the logomark sat **beside** the reveal rather than
  under it, because the two drawings are not the same shape in the same
  box. Overlapping two marks only works if they are the same mark.

So it is the reveal alone, faded in on `load` against the dark the screen is
going to be anyway, and the document **preloads** it
(`<link rel="preload" as="image" href="/brand/logo-reveal.gif">`) so the
fetch starts while the document is still being read. `LoadingScreen` and
`LoadingMark` in `@/components/ui/Loading` are unchanged in name and take
the same props; `LoadingMark` is now the image itself rather than a wrapper
around two of them.

## Round one hundred and three

**A loading screen that can never finish, and the three ways this one
could.** Staw: "you refresh and the page doesn't load any more", on pages
other than the home page. All three are the same shape - something the site
waits on that is not guaranteed to come back - and the applications wait on
the same things.

1. **`supabase.auth.getSession()` was handled with `then` and no `catch`.**
   It reads the stored tokens and may go to Supabase to refresh them, so on
   a dropped connection it **rejects** - and the flag the whole site waits
   on was only ever cleared inside `then`. One rejected promise and the
   loading screen is permanent. It now treats a rejection as "nobody is
   signed in in this tab", which is recoverable where a screen that never
   finishes is not.
2. **The profile read had no deadline.** `fetch` has none of its own, so a
   request that neither answers nor fails leaves the promise pending for
   ever and `finally` never runs. There is an eight second deadline on it
   now; the site starts without the profile, which is a page that fills in
   a moment later rather than a page that never comes.
3. **The boot mark came down on the line after `render`** - and `render`
   only schedules. So the document's own mark was removed whether or not
   anything replaced it, and a first render that threw left an empty page.
   It comes down in an effect now, which runs after React has actually
   committed.

And both loading screens - the one in the document and `LoadingScreen` -
**say something after twelve seconds** and offer to reload, rather than
sitting there looking like they are working. The causes above are fixed
where they are; the next cause will be a different one, and a screen that
waits for ever should be able to admit it.

Worth copying in the Workspace and the Launcher, whatever their own session
code looks like: a `then` with no `catch` on a session read, a network read
with no deadline behind a loading flag, and a splash screen with no way out
are all the same bug wearing different hats.

## Round one hundred and four

Five things, and three of them change something shared.

**1. An account no longer needs an email.** `auth.signUp` still works
exactly as it did when there is an address. When there is not, the browser
calls the new `register` edge function (`action: 'signup'`), which creates
the account behind the service role with a stand-in address at
`no-email.kobblon.com` and hands back `access_token` / `refresh_token` -
so the tab is signed in by the time the call returns and there is no
confirmation to wait for. `@/lib/api` exports `registerWithoutEmail`, and
`useAuth` exports `signUpWithoutEmail(details)` beside `signUp`.

**This is a meaning change you need:** `profiles.has_email` is a new
column, and **it is decided in the database from the address itself**, not
from anything the client claims. False means there is nobody to write to -
a guest, or somebody who skipped the box. Anywhere an application says
"check your email", "we sent you a link" or offers a password reset, read
`has_email` first. The old assumption - every account has a reachable
address - is no longer true.

**2. A superadmin can turn a guest into a real account.**
`admin_make_real(target uuid)` flips `is_guest` to false, grants the
hundred Brix a new account gets, and sets a second new column,
`profiles.must_set_password`. Nothing is signed out and nothing of theirs
moves; the account keeps its `Guest48213` handle until they change it.
`@/lib/api` exports `makeAccountReal(target)`.

**What an application has to do about it:** when
`profile.must_set_password` is true, that person is signed in to an account
with no password - the session in hand is the only way into it. The website
shows `SetPasswordCard` (`@/components/auth/SetPasswordCard`) over the
page; it cannot be dismissed, and it calls `register` with
`action: 'set-password'` and the caller's own token, which is what actually
converts the anonymous auth user into a permanent one. If the Workspace
holds its own session it must do the same, or somebody signs out there and
can never get back in. Both new columns are pinned in
`guard_profile_update`: nobody can clear them for themselves.

**3. The notice bar is five colours, two at a time, and part of the top
bar.** `site_notices.tone` is no longer `good | warn | plain`; it is
`green | blue | red | orange | white`, picked by whoever writes the notice.
The three old names are still accepted by `put_up_notice` and are mapped
(`good`→green, `warn`→orange, `plain`→white), and the rows that existed
were moved, so nothing breaks - but a mood is not a colour any more, and a
panel that labels amber "warning" is now lying.

- `notice_now()` returns **up to two rows**, not one. `@/lib/api`'s
  `noticeNow(): SiteNotice | null` is gone and `noticesNow():
  SiteNotice[]` replaces it. `putUpNotice` takes `tone?: NoticeColour`
  and refuses a third notice while two are up. `takeDownNotice(which?)`
  takes one down by id, or all of them when nothing is named.
- `NoticeBar` is `position: fixed` under the bar now (Staw: "shall follow
  the topbar"), and writes its own height into the CSS variable
  `--notice-height` on `documentElement`. Anything that offsets itself
  from the top of the window reads that variable; the website's shell and
  sidebar do. If the Workspace mounts `NoticeBar`, it has to leave room
  the same way, or the notice covers whatever is under it.
- `NoticeLine` is exported for drawing one where you put it, along with
  `noticeColours` and `noticeStripes(colour)` if you are drawing your own.

**4. The staff map draws countries.** `public/brand/world-countries.svg`
is one path per country with the ISO alpha-2 code as its id, in plain
equirectangular coordinates in a 0 0 360 180 box, built by
`tools/map/build-countries.mjs`. `@/components/staff/CountryMap` shades a
country by its share of accounts and puts a ring on the ones too small to
draw. Nothing in the applications depends on it; it is here because the
file is shared and somebody will want it.

The bug in the first version is worth having: `x = lon + 180` draws a band
straight across the map for every country that crosses the antimeridian -
Russia, Fiji, Antarctica - because the ring runs off one edge and carries
on from the other, and laying the points down in order fills everything
under the return line. `d3-geo`'s `geoPath` cuts the ring at the edge. If
either application ever plots coordinates by hand, that is the trap.

**5. The moderation worker says what came back.** `postToGroq` now retries
once with four times the token budget when a model stops on `length`,
falls back to `choice.message.reasoning` when `content` is empty, and every
parse failure names the model and quotes the first 120 characters of what
it actually said. "did not answer in JSON" with nothing after it was
unanswerable.

**Still not done, said plainly:** the Klub does not exist, so the People
panel's Klub filter returns nobody rather than everybody - deliberately.
`pg_cron` is still not enabled for the `kobblon-machine` heartbeat.
Migrations 0254 through 0258 are applied locally and not yet in
production.

## Round one hundred and five

**1. `Icon` was drawing at one line of text, whatever size you asked for.**
This is the one to read even if nothing else here touches you. `Icon`
defaulted to `h-[1em] w-[1em]` and joined the caller's class after it -
but `cn` here joins, it does not merge, and Tailwind emits arbitrary
values *after* the scale ones. So `<Icon className="h-9 w-9" />` lost in
the stylesheet and came out 16px. Measured in the browser: 16, now 36.
The default is left off now when the class names a size. If the Workspace
has quietly compensated for small icons anywhere - a wrapper with its own
width, a bumped font size - that compensation is now doubling.

**2. A fire reaction, and the face list has one home.** Migration 0262
adds `public.reaction_faces()` (immutable, returns `text[]`), and both the
`reactions_face_check` constraint and `react()` read it. The list was
written twice before, which is exactly how `fire` ended up accepted by the
constraint and refused by the function. `FACES` in `@/lib/api` is eleven
now, with `'fire'` between `'sunglasses'` and `'shocked'`; anything that
switches on a face exhaustively needs the arm.

Artwork: `reaction-fire.png`, plus `reaction-sad-tears.png` and
`reaction-laugh-tears.png` as detail masks painted `#4AA3F0` over their
faces, the way the tongue and the hearts already were. `FACE_COLOUR` in
`Reactions.tsx` gives fire `#F6861F` rather than the face yellow, because
a yellow flame is not a flame.

**3. A main Community.** `member_communities(target)` returns one more
column: `is_primary boolean`, and the main one sorts first (0261). The
column behind it is `profiles.primary_community`, set through
`set_primary_community(community uuid)` - `null` clears it. `MemberCommunity`
and `Profile` in `@/types/db` carry the new fields. If an application
lists somebody's Communities, the order is now meaningful and the flag is
there to mark it.

Worth knowing why that migration needed a second go: `set_primary_community`
is `security definer`, wrote the column, and `guard_profile_update` pinned
it straight back, because the guard asks `auth.uid()` and `security definer`
changes a function's rights and not who it reports as. The project's third
trap, fourth time. It raises `kobbleston.community` around the write now
and the guard honours that. The first check missed it because it ran as
@kobblon, and the guard returns early for admins - a guard whose subject is
identity is never proven by one identity.

**4. Sending Brix to somebody.** `sendBrix(to, amount, note?)` returns
`{ sent, cut, arrived, balance }`, and `sendingShare()` is the percentage
Kobblon keeps (5 today; read it, do not write it down). Between 10 and
100000. It writes two rows in `pixel_transactions`, kinds `gift_sent` and
`gift_received` - the kind check constraint was replaced to allow them, so
anything of yours that enumerates transaction kinds wants those two.

**5. Smaller shared things.** `MenuItem` takes `separated?: boolean`,
which rules off a group above it. `removeCommunityPost` goes through the
`remove_community_post` RPC now rather than an update - a soft delete
against a SELECT policy that tests `not is_removed` is refused, because a
SELECT policy applies to the *new* row of an UPDATE. `listTickets` asks
only for your own tickets, and `replyTicket(id, body, asStaff?)` takes a
third argument: left off, staff answer as Kobblon and everybody else
answers as themselves, and the server refuses the combinations that do not
make sense rather than trusting the flag.

**Still not done, said plainly:** theme appearances (dark, light,
halloween, christmas, the claim card and the seasonal windows) are asked
for and not started - nothing of them exists to build against yet.
`pg_cron` is still not enabled for the `kobblon-machine` heartbeat. The
Klub still does not exist. Migrations 0254 through 0262 are applied
locally and not yet in production, and the `register` function is not
deployed.

## Round one hundred and six

**1. The reload bug, and why it was never a loading bug.** If either
application ever serves pages this way, this is the one to read. Every page
under `u/`, `c/` and `worlds/` on the website is a real file, written at
deploy time by whichever build last reached the database, and it names that
build's pieces by their content hash. A build without the service key
leaves those files alone - rightly, it has nothing to write - but it still
replaces `assets/`, so the pieces those files name are deleted. The
document then asks for a module that 404s, nothing in the bundle runs, and
what is left on screen is the boot mark in the markup, for ever. Published
profile pages were pointing at `app-x5VFj9wV.js` while the site had
`app-B5YQDrYK.js`: 293 of them.

Reloading cannot fix that, which is the part that misleads everybody,
including the "Load it again" button we put under the mark. The file on the
site is the thing that is wrong.

Two fixes, and the second is the one worth copying: `publish-to-root` now
points every published page at the build it is publishing whether or not it
rewrote that page; and the document itself, if nothing in the bundle has
run three seconds after load, hands the address to the index at the root -
which every deploy rewrites and which is therefore never stale - as
`/?to=<path>`, and `main.tsx` puts the address back before React looks.

**2. The reveal plays once per tab, on arrival.** `REVEAL_MS` is still
3950, but `releaseBoot` only waits it out when this tab has not seen it:
session storage survives a reload and does not survive a new tab, which is
exactly the distinction Staw asked for. Measured: 4011ms on arrival, 238ms
on the refresh after it.

**3. Theme appearances.** New and shared, so the Workspace can wear one:

- `profiles.appearance` is `'default' | 'halloween' | 'christmas'`.
  `public.appearances()` is the list, `appearance_on_offer(day)` is the
  window (October; 15 November to 31 December), `my_appearances()` is what
  somebody may wear, `claim_appearance(which)` takes the one on offer and
  `set_appearance(which)` wears a claimed one. The date is checked in
  `claim_appearance` and nowhere else matters.
- An appearance is **not** the dark/light mode. The mode stays per device;
  the appearance is on the account and both apply, because the art exists
  for each season in both modes.
- It is applied by writing `data-appearance` on the document element.
  Everything that changes with it - the chrome tokens in
  `design/tokens.css`, the marks, the backdrop - is chosen by CSS from that
  attribute and never by a hook, so a panel mounted with no provider gets
  the ordinary blue one instead of throwing. If the Workspace wants to
  follow the website's appearance, write that attribute on its own document
  and import `design/tokens.css` as it already does.
- `--chrome`, `--media`, `--field` and `--on-chrome` move; nothing else
  does. Brand blue, Space green and the red are untouched on purpose.
- `@/lib/appearances` exports `APPEARANCES`, `LOOKS` and `marksOf`, which
  is where the artwork paths live.

**4. Smaller, and shared.** `Studio` now draws six backdrops and shows one;
`Wordmark` and `Logomark` draw five marks each and show one. Both still
need no provider, no router and no session. `tools/site/appearance-preview`
is the bare page that proves it.

**Still not done, said plainly:** the halloween wordmark and logomark and
the christmas logomark are Staw's blue artwork with the hue moved, not his
own drawings - his replace them by being dropped into `public/brand/` under
the same names. The seasonal weather is mounted on Home and nowhere else.
`pg_cron` is still not enabled for the `kobblon-machine` heartbeat, and the
`register` function is still not deployed. Migrations through 0262 are
applied in production; 0263 is new and is not.

## Round one hundred and seven

**The logomark is not half of a lockup.** Staw: "for the logomark its only
when the wordmark is too small". `Wordmark` in `@/components/brand/Wordmark`
draws the name, and under the `sm` breakpoint it draws the logomark
instead - the two are never on screen together. `always` keeps the full
wordmark at every width, for somewhere with a line of its own. `Logomark`
is still exported for a square where the name was never going to go, but
if an application is drawing both beside each other, that is the thing to
change.

Both still pick their appearance from `data-appearance` through CSS, so
none of this needs a provider.

## Round one hundred and eight

Two things that compiled on both sides and were wrong on screen. Both are
in files the applications import, so both matter over there.

**`Icon`'s default size is now decided one axis at a time.** The last round
dropped `h-[1em] w-[1em]` whenever the caller named *any* size, so a call
site passing `w-5` and nothing else - which the sidebar's navigation does -
got a width, no height, and a mask painted onto a box zero pixels tall. The
icons did not shrink, they vanished. It now keeps `h-[1em]` unless the class
names a height (`h-` or `size-`) and keeps `w-[1em]` unless it names a
width. If the Workspace has its own copy of that helper, this is the fix:
per axis, not per call.

**The seasonal chrome never reached the document.** `[data-appearance=
'halloween']` in `design/tokens.css` is one class of specificity;
`:root[data-theme='dark']`, which sets `--chrome` to brand blue, is two -
and both attributes sit on `html`, so the two rules were fighting over the
same declaration on the same element and the season lost. The wordmark
swapped, the sidebar and the topbar stayed blue. The seasonal blocks now
carry `:root[data-appearance='…']` and
`:root[data-theme='dark'][data-appearance='…']` alongside the bare
selector, which is still there so a card can show an appearance it is not
wearing. Measured in Chromium with both attributes on `html`: halloween
dark is `rgb(130, 69, 22)`, christmas dark `rgb(18, 84, 50)`, and light
keeps its pale tints. Anything over there painting chrome from `--chrome`
gets this for free by pulling the file; anything that hard-codes brand blue
for its bar will not follow a season.

Still missing, unchanged from the last round: the halloween wordmark and
logomark and the christmas logomark in `public/brand/` are Staw's blue
artwork with the hue moved, not drawings of his - he has said he does not
like them and they are waiting on his own files under the same names.
Migration 0263 is still not applied in production, `register` is still not
deployed, and `pg_cron` is still not enabled.

## Round one hundred and nine

**The ordinary wordmark is now a drawing per mode, not a filter.**
`public/brand/wordmark.png` is the white silhouette, for the dark interface
it was drawn for; light mode was inverting it, which gives a flat black
name rather than the mark. `public/brand/wordmark2.png` - the blue-outlined
one, which has been in the repository since the start and was used nowhere -
is the daylight drawing, and `.kob-wordmark` and its `filter: invert(1)`
are gone from `src/index.css`. If an application has a copy of that filter,
drop it and point light mode at `wordmark2.png` instead.

So `LOOKS` in `@/components/brand/Wordmark` is six entries now, a look and a
mode each, and the CSS picks the ordinary one by mode the way it already
picked the seasons. Measured in Chromium, exactly one mark is visible per
slot in each of the six combinations: dark gets `wordmark.png`,
`wordmark-halloween.png`, `wordmark-christmas.png`; light gets
`wordmark2.png` and the two `-light` silhouettes. The logomark is brand
blue in both modes and is unchanged.

The seasonal art is still Staw's blue artwork with the hue moved and still
waiting on his own drawings. 0263 is still not applied, `register` is still
not deployed, `pg_cron` is still not enabled.

## Round one hundred and ten

Staw, of what the last two rounds shipped: "the appearance system just
sucks its really not at all what i had asked". Two of the three things he
named are in `design/tokens.css` and `@/components/brand`, so they matter
on your side too.

**The seasonal colours are picked now, not derived.** Moving the blue's hue
and keeping its saturation and lightness is arithmetic, not a colour:
halloween came out `#824516`, which is a brown, and christmas `#125432`,
which is an olive. They are `#B85209` and `#0E6638` now, chosen to look
like the season and then checked against white text (4.9:1 and 7.0:1, past
the 4.5 a small bold label on the rail needs).

**And a season reaches past the bar.** `--ink`, `--ink-raised`,
`--ink-card`, `--ink-hover`, `--ink-line`, `--link` and `--bubble` are in
the seasonal blocks now, so the page's black is a warm one under halloween
and a green-black under christmas, and the cards and lines come with it.
The page is still black or white - that part of the brief has not moved -
it is the same black with a cast on it. **Anything over there that reads
those tokens changes with the season now, where before only `--chrome`
did.** Buttons are untouched: brand blue, Space green and the red are not
in this file.

**New: `AppearancePreview` in `@/components/brand/AppearancePreview`.**
`<AppearancePreview which="halloween" />` draws the site small - bar, rail
with a selected entry, a card, the buttons - out of the real tokens inside
`data-appearance`, so it cannot drift from the site the way a screenshot
would. It takes `className`, mounts with no provider and no router, and it
is what Settings now offers an appearance with; the strip of bar colour
with a wordmark on it is gone. If the Workspace ever offers these, use
this rather than drawing a swatch.

Still Staw's to supply and still the third thing he named: the halloween
wordmark and logomark and the christmas logomark are my hue-rotated
stand-ins. 0263 is still not applied, `register` is still not deployed,
`pg_cron` is still not enabled.

## Round one hundred and eleven

Staw's own art, the duplicate wordmark found and explained, and the chooser
made plain. Most of this is in files you import.

**The marks are his drawings now, two per mode.** `wordmark2.png` and
`logomark-darkmode.png` are the dark interface; `wordmark-lightmode.png`
and `logomark-lightmode.png` are daylight. He drew the logomark both ways
and the wordmark only once, so the daylight wordmark is his own recolour
learned off that pair of logomarks pixel for pixel
(`tools/brand/dark-fill.py`), not a filter. `logomark-halloween.png` and
`logomark-christmas.png` are his too and replace my hue-rotated ones; the
seasonal logomarks are one drawing each and serve both modes, so
`logomark-*-light.png` are gone. The flat white `wordmark.png` is used by
nothing now.

**The duplicate wordmark is fixed, and it was a specificity bug worth
knowing.** `:root[data-theme='light'] .kob-mark[data-look='default']
[data-mode='light']` is two attributes plus a class plus `:root`; the rule
hiding the ordinary mark inside a season was one attribute plus a class
plus an attribute - *less* - so in light mode with a season on, both the
ordinary wordmark and the season's drew, overlapping. The whole wrapper
matrix is written out now, and written twice: once plain, once prefixed
with `[data-appearance] ` so a card always outranks the document, because
the document carries `data-appearance` as well and otherwise the file's
order decides. Measured in Chromium across all six wearing/mode
combinations: exactly one mark per wrapper, and each wrapper shows its own.

**Three smaller ones.** The selected entry in the rail is `--pick` /
`--on-pick` now rather than brand blue - a blue pill on an orange rail was
the last thing saying the season had not happened - and it is the one piece
of blue that moves; buttons are still untouched. The sunburst behind the
bar carries `.kob-sunburst` and is shown only in the dark and only for the
blue appearance, since it is blue artwork. And christmas is a deeper pine
(`#0A4F31`), far enough from Space green that a bar can never read as a
yes.

**The boot screen is the page's own background.** `app.html` reads the
remembered mode and appearance before anything else and sets `data-ink` on
`#boot`, so a wait is the colour the site is about to be rather than black
on the way to white. The six values are copied from `--ink` in
`design/tokens.css` and have to be kept in step with it - the bundle is not
there yet to be asked.

Migration 0263 is still not applied, `register` is still not deployed,
`pg_cron` is still not enabled.

## Round one hundred and twelve

The duplicate wordmark again, and this time the reason is worth the room.

**A compound on `:root` cannot also be an ancestor of itself.** The rules
hiding the ordinary mark inside a season were written
`:root[data-theme='light'] [data-appearance='halloween'] .kob-mark…`, which
asks for an appearance *inside* the root. The document is where
`data-appearance` actually lives, so in daylight with a season on, that
rule matched nothing, the ordinary mark stayed shown and drew on top of the
season's. Dark mode never showed it because its rules had no `:root` on the
front. Staw: "when on light mode with other theme appearances theres two
wordmarks".

So the matrix in `src/index.css` is written three times now, weakest to
strongest: a wrapper with nothing above it (a bare page, the Workspace),
then the document itself (`:root[data-appearance='…']`, and
`:root[data-theme='light'][data-appearance='…']` with no space), then a
wrapper inside a document that has one
(`:root[data-theme='light'][data-appearance] [data-appearance='…']`), which
has to win because that is the chooser. Measured in Chromium, all twelve
cases: one mark per wrapper, one for a mark with no wrapper, each the
right one.

**The same hole was in `design/tokens.css`.** There was no element-level
block for the blue appearance, so a card marked default inherited whatever
the document wore and the row marked Kobblon had an orange bar behind its
mark. `[data-appearance='default']` now carries the blue values, and the
seasonal light rules gained the re-rooted form as well. Every card keeps
its own `--chrome` whatever the document is wearing.

**The halloween wordmark is Staw's.** He drew the daylight one;
`tools/brand/flip-fill.py` makes the dark-interface one by turning the fill's
lightness over and leaving the outline alone, which is what his own pair of
logomarks does (checked against them: within two levels per channel on
average). The christmas wordmark - red glitter in a silver outline - is one
drawing for both modes, so `wordmark-christmas-light.png` is gone, and so is
`tools/brand/tint-marks.py`: nothing on the site is hue-rotated art any more.

0263 is still not applied, `register` is still not deployed, `pg_cron` is
still not enabled.

## Round one hundred and thirteen

**Halloween's wordmark is Staw's own drawing, one for both modes.** A dark
fill in an orange outline, and it reads on the deep bar and the pale one
alike - so `wordmark-halloween-light.png` is gone, and so is
`tools/brand/flip-fill.py`. The only mark on the site drawn twice is the
blue one, because that is the one he drew twice.

**`AppearanceLook` has a `reveal` now.** `@/lib/appearances` carries
`reveal?: string` beside `wordmark` and `logomark`, and halloween's is
`/brand/logo-reveal-halloween.gif` - the blue mark turning into the orange
one, 123 frames, about five seconds. The card that offers an appearance
plays it where there is one and stands the wordmark still where there is
not, so a season without a film is not a card pretending to animate. It is
only ever fetched by a card that is on screen: it is a megabyte and a half
and nothing preloads it.

**The claim card is no longer hidden by owning the appearance.** Staw:
"make that even if you already claimed it you should see the card again".
It shows for as long as the window is open; for somebody who already has
it the button puts it on instead of claiming it, reads "Wear it", and is
disabled with "You have it on" if it is already being worn. The device's
note of having seen it carries the year, so next October is a new card
rather than one that was dismissed in 2026 for ever.

0263 is still not applied - and it is now the only thing between this and
anybody but the Kobblon account seeing any of it. `register` is still not
deployed, `pg_cron` is still not enabled.

## Round one hundred and fourteen

Quests exist. Kobby reads what people actually said, and Kobby is the one who
suspends chat. Two migrations, **0264** and **0265**, both applied twice here
with behavioural checks under two identities.

### The quest tab

`/quests` on the website, in the left rail under Friends. Three sorts of thing
on it, and the Launcher is involved in exactly one of them.

**New tables:** `quests`, `quest_progress`, `daily_claims`. Grants in the same
file as each table; no insert or update granted to anybody, so every write goes
through a function.

**New functions, and what they are for:**

| | |
| --- | --- |
| `quest_board()` | the whole tab in one call: the live quests with this person's `done`, `started` and `claimed_at` on each |
| `start_quest(quest)` | says you are doing it, and is where the counting starts from. Idempotent |
| `claim_quest(quest)` | takes the reward. Refuses an unfinished one and refuses a second claim |
| `daily_waiting()` / `claim_daily()` | the daily 30 Brix, which has to be claimed and is one row per person per day |
| `request_world_quest(world, minutes, reward, tag)` | a verified creator asking for their own published World |
| `my_quest_requests()` | what they asked for and what became of it |
| `quests_waiting()` / `decide_quest(quest, approve, tag_too, why)` | admin and superadmin |
| `add_quest(...)` | superadmin, arbitrary |
| `end_quest(quest)`, `credit_quest(quest, who, amount)` | admin |

**What a quest counts is a closed list** - `world_time`, `friends_made`,
`worlds_played`, `by_hand` - and every word in it is something the database can
already answer truthfully. There is deliberately **no `invite_friends`**:
nothing on this platform records an invitation, so a quest for one would be a
control implying something the runtime does not do. When invitations exist the
word gets added and the tab needs no changes.

**`still_in_world(server)` has changed, and this is the line that matters to
the Launcher.** It is still the same call, with the same arguments, and it
still means "I am here". It now also adds up time towards `world_time` quests:
it reads `last_seen` *before* it writes it, and credits
`least(clock_timestamp() - last_seen, stale_after())` - ninety seconds.

So, in the apps' own words, which we kept: **the Launcher gets an open session
it heartbeats into and nothing else.** No duration in the message, no "I earned
this", no field for anybody to lie in. Two consequences worth knowing:

- heartbeating faster credits **nothing** extra. The gap is the gap; the total
  cannot run faster than real time. Measured here: three heartbeats in a row
  credit 0 seconds.
- a two hour pause credits **ninety seconds**, not two hours, because nothing
  here knows they were playing in between. Also measured.

If the window wants to show a timer, read it back off `quest_board().done`
rather than counting locally - otherwise the number on screen becomes the
number people try to make true.

**The ledger has two new words**, `quest` and `quest_tag`, so anything reading
`pixel_transactions.kind` as a closed list needs them. A custom tag costs the
creator **100 Brix**, charged at the asking whether or not it is approved,
through `move_pixels` rather than a second path.

### Kobby reads the original, and Kobby is the one who suspends

Staw asked whether the chat suspensions were ours or Kobby's. **They were never
Kobby's.** `words_are_censored` counted how many times the regular expressions
objected to somebody in ten minutes and called `mute_chat` itself at three. The
row said `source = 'machine'`, which has meant the pattern list since 0171 and
reads like the AI to anybody looking at a card.

And Kobby has only ever been handed the **masked** line - `queue_for_the_machine`
is an `after insert` trigger, so by then `new.body` is bullets. The model has
been asked to judge `•••• off you ••••••`.

0265 changes three things:

1. **`chat_to_read.said`** - a new column holding the line as it was typed. The
   `before` trigger carries it to the `after` trigger in a transaction-local
   setting, the same way `kobbleston.money` works. `ai_work` now hands over
   `coalesce(said, body)`. Voice does the same through `heard_in_voice`.
   Profile text was never censored on the way in, so names and bios were
   already fine.
2. **Evidence stays censored, whoever writes it.** The model can now quote a
   real slur, and `judge_chat_line` stores its quote as evidence on a card a
   person reads. So there is now a `before insert or update` trigger on
   `ai_reviews.looked_at` and `chat_timeouts.evidence` that runs `censor_text`.
   **This is the one to know about if you render evidence**: it is still
   censored, 0208's rule still holds, and it now holds on purpose rather than
   by accident.
3. **`chat_timeouts.source` is now `'kobby'`, `'filter'`, `'staff'` or the old
   `'machine'`.** The filter passes `'filter'`; every other caller was Kobby,
   so `mute_chat` maps `'machine'` to `'kobby'`. **Old rows keep `'machine'`** -
   they were all the filter, but relabelling them is rewriting a record, so
   they stay and read as the vaguer thing they honestly are.

   `ChatSuspended` takes a new optional `source` prop and says one line under
   the title: "Decided by Kobby, reading what was said", "Given by the word
   filter", "Given by a moderator", or "Given automatically" for an old row.
   It is optional, so a window that does not pass it loses nothing.

**The filter no longer suspends while Kobby is on.** Strikes are still
recorded - they are what `behaviour_score` weighs - but the decision is the
model's through the ladder in 0209. **One exception, and it is not a hedge:**
when Kobby is switched off, or is not allowed to suspend, the patterns go back
to doing it, because somebody turning the AI off in the console should not be
silently turning chat enforcement off with it. The serious cases - a threat, an
instruction to self-harm - still suspend immediately from the filter and are
written as `'filter'`; waiting on a model for the next minute of that
conversation is not a thing to do.

### Not done, and it is not code

**Kobby still needs somebody to press "Run it now", and no change in this repo
fixes that.** The automation is written: 0224 knocks when work lands, 0253 is a
sweep every minute. Both look up what they need **at apply time** -
`pg_net` for the knock and `pg_cron` for the schedule - and quietly do nothing
when it is not there. Neither extension is enabled on the live project, so
neither has ever been wired.

The fix is two switches and a re-run, in this order: enable `pg_net` and
`pg_cron` under Database → Extensions, then re-apply 0224 and 0253. Both are
idempotent. `machine_pulse()` says which of the two is still missing, and the
console reads it.

### Smaller, and shared

- **`FACES` is reordered.** The flame was seventh, in the middle of a row of
  faces, and it is the only thing in the set that is not a face. It is last now.
  Anything drawing the tray from `FACES` follows automatically; anything with
  its own copy of the order does not.
- **Reaction chips are smaller** - a 20px face instead of 28, `text-xs` - and
  the tray's pointer now hangs off the react button rather than off the row, so
  it points at the button wherever along the row it has ended up. Measured: the
  pointer's centre and the button's centre are the same pixel.
- **`LiveEventBar` is rebuilt out of the same parts as the site notice above
  it**: flat `bg-space`, white words, and the diagonal stripes imported from
  `noticeStripes` rather than copied, so the two bars cannot drift. It takes an
  optional `showing` prop so it can be mounted with no database behind it;
  `tools/site/event-bar-preview.html` does that.
- **The loading screen is over everything.** `#boot` in `app.html` and
  `LoadingScreen` are both at the top of the stack now, and `#boot` already
  wore the page's own background per theme and appearance.

Still not done: `register` is not deployed, and the five-page redesign and the
mobile pass are still waiting. 0263 **is** applied - that line in round one
hundred and thirteen is out of date.

## Round one hundred and fifteen

A correction to 0264, Communities in the staff console, and Quests reachable
from the balance in the top bar.

### 0264 would not apply, and why

It failed in the SQL editor with
`check constraint "pixel_transactions_kind_check" of relation
"pixel_transactions" is violated by some row`.

The cause was mine. 0264 re-asserted the ledger's `kind` list from **0231**,
and 0231 is out of date: **0259** added `gift_sent` and `gift_received`, and
the live table has rows of both. Dropping a constraint and adding a narrower
one does not fail at the narrowing, it fails on the rows - and the message
names the constraint, not the word, which is a long way from the mistake. It
got past a grep because 0259 writes `check (kind = any (array[...]))` where
every earlier one wrote `check (kind in (...))`.

**0264 in the repository is fixed.** The list is now 0259's plus `quest` and
`quest_tag`, and the constraint is added `not valid`, so rows written under
an older rule are not re-judged while everything from here on is checked
normally. Re-run it; nothing else in the file changed.

A thing worth carrying: **anything reading `pixel_transactions.kind` as a
closed list should read it from the database rather than hold a copy.** Two
copies of that list is how this happened.

### Communities in the console - 0266

The ranks, as Staw set them out:

| rank | what it may do |
| --- | --- |
| moderator | flag one for review; act on the owner through the People panel |
| admin | verify or unverify; close one, and put a closed one back |
| superadmin | hand one to somebody else; delete one for real |

**Flagging opens a report** rather than inventing a second kind of mark, so
it lands in the Reports console where "something needs looking at" already
lives. It goes in as `reason = 'other'` with the note prefixed "Flagged by
staff:", because `reports.reason` is the closed list of words a *member*
picks and there is no word in it for this.

**Closing is not deleting**, and this is the part for the apps to read. New
columns on `communities`: `closed_at`, `closed_by`, `closed_reason`,
`erase_after`. A close sets all four plus `is_removed`, the owner is told,
and `erase_after` is `now() + held_for()` - two months, from one function so
the number is in one place. Any admin may put it back the whole time. Nothing
deletes data except `erase_community`, which is a superadmin's and **refuses
a Community nobody closed**.

The roadmap said to reuse the account path for this. It could not be followed
literally: `admin_delete_account` deletes immediately and has no wait at all.
Rather than write a second idea of "deleted" and leave two, the wait is built
here as something general - `held_for()` - so when accounts get the same
treatment they take the same two months from the same place. **Accounts still
delete immediately. That has not changed and is not done.**

`sweep_closed_communities()` is the two months coming up. It is `revoke`d
from `anon` and `authenticated` and wants `pg_cron`, which is still not
enabled.

**Three functions are named `staff_` and it matters**, because the plain
names already exist and mean something else:

- `staff_close_community(community, why)` - 0034's `close_community(target,
  closed)` is the **owner** shutting their own, and holds nothing.
- `staff_reopen_community(community, why)`
- `staff_transfer_community(community, to_whom, why)` - 0034's
  `transfer_community(target, to_user)` is the **owner** handing theirs on.

A window calling the short name is calling the owner's version. The new ones
also move the `community_members.role` across, so the new owner is actually
in it at the top - an owner who is not a member cannot open their own
settings.

`staff_communities(look, which, how_many)` is the list behind the panel;
`which` is `'all'`, `'flagged'`, `'closed'` or `'verified'`. It checks the
rank itself before returning anything, so being `security definer` does not
make it a back door.

Verified automatically by membership share, which the roadmap also asks for,
is **not built**. Only the by-hand tick is.

### Smaller

- **Quests are on the balance menu** in the top bar, first, above My
  transactions - it is the only one of those four that answers "how do I get
  more".
- **`bg-ok` and `text-ok` are not real classes.** I used them for the quest
  progress bar and they did nothing; the bar is `bg-space` now. Worth a look
  on your side: **`text-yes` is not real either** and is used in
  `ChatSuspended` and `OutfitPage` today. Left alone rather than changed
  underneath you, but it means the tick on the "chat is back" card is the
  inherited colour rather than green.
- `CommunityCard` and `QuestCard` are exported, and
  `tools/site/communities-preview.html` and `tools/site/quests-preview.html`
  mount them with no session, no console and no database. Both were looked at.

## Round one hundred and sixteen - a decision somebody can read, and answer

**Nobody is signed out for a sanction any more, and that is the whole point
of the round.** A warning, a suspension and a closure all leave the session
alone. The three places somebody needs after a decision - their record, the
appeal on it, and support - are all behind a sign-in, so signing them out
was taking away the only doors they had. If the Workspace or the Launcher
signs anybody out on `is_suspended`, stop doing that.

### Two migrations, both applied twice here and checked behaviourally

`0267_a_state_you_can_read_and_answer.sql`
`0268_an_account_on_its_way_out.sql`

**`profiles` has three new shared meanings.**

- `is_banned boolean not null default false` - closed for good. New column,
  backfilled from the non-void terminations. It is the one thing that now
  hides a profile.
- `closed_at`, `closed_by`, `closed_reason`, `erase_after` - on its way out,
  with two months before the data actually goes. `erase_after` is the day.

**The profile visibility rule changed meaning, which is the line to read
twice.** `profiles_read` was `not is_suspended`, so a suspended account was
invisible to everybody for as long as the suspension lasted. It is now
`not is_banned or is_moderator()`. So:

- **warned and suspended profiles are readable and look entirely normal.**
  Anything on your side that assumed a suspended person vanishes from a list
  is now wrong.
- **a closed account is readable too**, on purpose, and reads as
  "Account Deleted" with a picture that will not load - not a 404.
- **only a ban goes dark.**

**`my_account_standing()` gained three columns and a state.** It now answers
`warned` (an unacknowledged warning), which it used to answer `clear` for -
so the one state the product wanted a card for was the one state the server
reported as nothing. New columns: `can_acknowledge`, `acknowledged`,
`is_banned`. Note the level word for a closure is `banned`, not
`terminated`; the website had `=== 'terminated'` in its lockout card and it
had never once matched.

**`acknowledge_my_standing()` is new.** One door for both answerable states:

- a **warning** is answerable at once, and acknowledging it puts the account
  straight back to normal standing. That is the whole sanction.
- a **suspension** is answerable only once its time is spent; before then it
  raises, and the card shows no control at all.
- a **ban** is never answerable by the account. It raises.

`reactivate_my_account()` still exists and still works; the new one does the
same thing plus the acknowledgment, and is what the card calls.

**Deleting an account is a date now, not a moment.** `admin_delete_account`
keeps its name and its arguments and no longer drops the `auth.users` row:
it sets `closed_at`, `erase_after = now() + held_for()` (two months, the same
function Communities use), locks the account out and writes the letter. New
beside it: `reopen_account(target, why)` for an admin, `erase_account(target)`
for a superadmin and only on something already closed - same refusal sentence
as `erase_community`, "Close it first. The two months are what makes this
undoable." - and `sweep_closed_accounts()`, revoked from anon and
authenticated, for when `pg_cron` is finally enabled.

`admin_find_people` returns `closed_at` and `erase_after` and takes a new
filter `closing`. Its return type changed, so it is dropped and recreated;
if you call it, re-read the column list.

**A closed Community stays readable.** `communities_read` gained
`or closed_at is not null`. 0266's close set `is_removed`, so the two months
were served behind a 404 and members who wondered where it had gone were
told it had never existed. The page now shows one sentence - "This community
has been locked" - and nothing else.

### Shared components

- **`@/components/social/AccountStatusCard`** is new and is yours to mount.
  No router, no provider, no session: `standing` (an `AccountLock`),
  `onAcknowledge`, `busy`, and optional hrefs for the record, support, the
  rules and the appeal. It carries the checkbox with Staw's exact sentence
  and refuses to show any control a ban would make a lie. `tools/site/
  standing-preview.html` mounts it bare in all four states.
- **`Avatar`** gained `unavailable`, which draws a grey `faUserLarge` instead
  of the picture or the initials. `PersonAvatar` sets it itself from the row,
  and hides the presence dot with it.
- **`@/lib/avatars`** gained `isGone(person)` and `nameOf(person)`. A row with
  `closed_at` or `is_banned` is gone, and is called "Account Deleted".
  A warning and a suspension are **not** this.
- `Locked` was rebuilt around the card and is now a thin page.

### What is still not done

- The homepage card is on the website's Home only. Nothing equivalent exists
  in the applications yet; the card is there to be mounted.
- `pg_cron` and `pg_net` are still not enabled on the live project, so
  `sweep_closed_accounts` and `sweep_closed_communities` only run by hand.
- Staw has not yet applied 0267 or 0268. Neither is live.
- 0266 is still waiting to be applied too.

## Round one hundred and seventeen - the board, and a cover that is not there

`0269_a_quest_board_worth_looking_at.sql`. Applied twice here, checked
behaviourally under a superadmin and an ordinary account. **It needs 0264
applied first**, which is still outstanding.

**`add_quest` takes a World now and will write any kind of quest.** It
refused `world_time` outright - "requested against that World" - which is
right for a creator asking about their own World and wrong for the person
who owns the board. New signature:

```
add_quest(title, counted, goal, reward, lead, tag, background, until, world)
```

The arguments changed rather than widened, so the eight-argument version is
dropped; a ninth with a default would have left every existing call
ambiguous. The only refusal left is the one that cannot work: `world_time`
with no World named.

**`quest_board()` gained `author_verified`** and its return type widened, so
it is dropped and recreated - re-read the column list if you call it. Two
other changes inside it: the promoter is now the World's creator where there
is a World (the quest's author otherwise, which is Kobblon for Staw's own),
and the card's picture falls back to the World's cover before giving up.

**`Quest` gained `author_verified: boolean`. `Profile` gained
`is_superadmin?: boolean`** - it was never on the type, which is why nothing
on the website could gate on the top rank without a round trip.

### The card

`QuestCard` is rebuilt to the layout Staw sent and is still exported from
`@/pages/Quests`: a 16/9 picture, "Promoted by <name> <tick>" with the end
date opposite, then a panel carrying the reward and what has to be done, then
two doors - "Play now" into the World and "Accept quest" / "Claim N". The
progress bar only appears once something has been started; before that it was
a row of zeroes. A quest with no picture gets the laurel mark on brand ink,
never a stock photograph.

### Two smaller ones that change what a thing means

- **A Community with no cover now has no cover.** It used to fall back to
  `/brand/banner3.png`, so every Community without a banner wore the same
  picture. There is no gap where it would have been either - the header
  starts at the emblem. If you draw a Community header, drop the fallback.
- **Quests left the sidebar.** It is reached from the Brix menu in the top
  bar, where it sits above "My transactions" and now draws Staw's own
  `laurel-quest` icon rather than a Font Awesome wand. `MenuItem` gained
  `ours?: KobIcon` for that, so any menu entry can name one of ours.

### Still not done

- 0264, 0266, 0267, 0268 and now 0269 are all waiting to be applied. 0264
  first; 0269 depends on it.
- `pg_cron` and `pg_net` are still not enabled, so Kobby and both sweeps run
  by hand.
- The deleted-account rename reaches profiles and avatars; friend lists and
  chat rows still show the stored name.

## Round one hundred and eighteen - an offer the account owns, and a card behind a face

Two things, both website-side, no migration.

**The appearance offer is per account now, not per browser.** Staw: "its not
per browser, it should be per account, like if an account didnt get it yet
then keep showing it until the time period is over." `ClaimAppearance` was
writing a `kobblon.offer-seen:<appearance>:<year>` note into `localStorage`
the moment either button was pressed and never asking again, so somebody who
closed the card on one machine lost the whole season's offer, and a second
account on the same machine never saw it at all.

The rule now:

- **Not claimed yet** - the card is shown for as long as the window is open,
  on every machine, whatever that machine remembers. The offer belongs to
  the account and runs out with the window, not with a click.
- **Already claimed** - the card still comes round once (that part has not
  changed), and closing it puts it away under
  `kobblon.offer-seen:<account id>:<appearance>:<year>`. The account id is
  the new part: two accounts on one browser no longer share a note.

For that to be decidable, `useAppearance` gained **`settled: boolean`** on
its context value - whether `owned` is the database's answer yet, rather
than the `['default']` that stands in before `my_appearances()` returns.
The card waits on it; deciding off the placeholder would show an owner a
card they had put away. **If the Workspace mounts `AppearanceProvider` or
reads the context, that is a new field on the value - additive, nothing
renamed.** `claim_appearance` and `appearance_on_offer()` are unchanged, and
the date is still the database's answer, not the machine's clock.

**New component: `FriendPeek`** (`@/components/social/FriendPeek`). Staw:
"when hovering a profile from your friends in your friendlist, you can see
this card (with an arrow pointer ofc) to see the profile of that friend or
open chat with them." It wraps a face and shows, on hover or focus, a small
card pointed at that face with an arrow: the person's name, their live
presence across the top ("Offline"), then **View profile** and **Chat with
&lt;name&gt;**. The chat door calls `startConversation` and hands the id to
`openConversation` on the chat dock, the same path the Friends page's own
chat button takes. A 120ms grace before it closes, so crossing the gap
between the face and the card does not take the card away mid-reach.

```tsx
<FriendPeek friend={person} className="shrink-0">
  <Link to={profileLink(person)}><PersonAvatar person={person} size="md" /></Link>
</FriendPeek>
```

`friend` wants `id`, `username`, `display_name`, and optionally
`content_id` and the presence fields (`is_online`, `in_space_id`,
`activity`, `last_seen_at`). It is mounted on the home page's friends rail
and on every line of `/friends`.

**It is not provider-free.** It uses `useChatDock` and `useToast`, and it
renders a `<Link>`, so it needs a router. The chat context has a no-op
default so it will not throw outside the dock, but the chat door does
nothing there - if the Workspace wants this card, say so and I will split
the doors out behind props the way `AccountStatusCard` is. Previewed bare
at `tools/site/peek-preview.html`, shot with `shoot-peek.mjs`.

Still outstanding from Staw's list and not started: the staff console's
Sale category becoming an Economy page (Brix in circulation, graphs, limited
items over time, catalog-wide promotions kept, quests that are a plain Brix
claim), and Kobby knowing an account's standing so it stops warning the
official account, the CEO, admins, staff and mods over what they write in
their bios.

Unchanged and still waiting: 0264, 0266, 0267, 0268, 0269 are all written
and verified locally and none of them is live; `pg_cron` and `pg_net` are
still off, so Kobby and both sweeps run by hand.

## Round one hundred and nineteen - one address for your own friends, and a list worth looking at

**`/u/<id>/<name>/friends` is now `/friends` when it is your own.** Staw:
"id like that the pages /u/1010/stawrer/friends?list=friends and /friends be
actually the same". They already rendered the same component, but as two
addresses - two back-button entries, two things to link to, and a page that
fetched your own profile by number before drawing a list it already had.
Reaching your own through a profile now `Navigate`s to `/friends`, carrying
the `?list=` through. Somebody else's friends page is unchanged.

**The friends page is redesigned.** What it was: a title, a row of six big
stat tiles (so "Blocked" had the same weight as "Friends" and the people
were below the fold), a search box, then three-across lines with a small
square picture and everything else on one row at one weight.

What it is now:

- **One band across the top** - the person's picture, the title, the count,
  the filter and "Find people" in a single bordered header, over a brand
  wash.
- **The six lists are tabs** inside that band, each with its count beside
  it, scrolling sideways on a phone. The page below the band belongs to the
  people.
- **A card per person** instead of a line: a 56px face, the name on its own,
  `@username`, and the presence as its own line with the dot that means it.
  The doors (Profile, Chat) sit along the bottom at full width. The "..."
  only appears on hover or focus.
- **Friends split into "Around now" and "Everybody else"**, because the page
  is mostly used to start something with somebody and somebody who is not
  there cannot be started with.
- Hovering a face gives the `FriendPeek` card from the last round.

`PersonCard` and `ListTab` are exported from `@/pages/Friends` so the bare
preview can mount them (`tools/site/friends-preview.html`, shot with
`shoot-friends.mjs`). They are page parts, not design-system components - if
the Workspace wants either, say so and they move to `@/components/ui` with
a proper API rather than being imported from a page.

Nothing in the database changed. Staw has now applied 0264, 0266, 0267,
0268 and 0269, so everything from rounds one hundred and sixteen through
one hundred and eighteen is live: the account standing columns and
`acknowledge_my_standing()`, the closing-account columns and
`reopen_account` / `erase_account` / `sweep_closed_accounts`, and the quest
board with `world` on `add_quest` and `author_verified` on `quest_board()`.

Still waiting: `pg_cron` and `pg_net` are off, so Kobby and both sweeps run
by hand. Not started: the staff console's Economy page, and Kobby knowing an
account's standing so it stops warning the official account, the CEO,
admins, staff and mods over their bios.

## Round one hundred and twenty - air in the row, and a card that behaves

Small pass over the two things from the last two rounds, both on Staw's
notes against the row he drew them from.

**The home friends rail has air in it.** `gap-4` between 80px faces read as
one strip rather than as people, and the names underneath ran into each
other. It is `gap-x-6 gap-y-7`, and `sm:gap-x-8` once there are six across;
the picture and the name under it sit `2.5` apart instead of `2`.

**`FriendPeek` is smaller, animated and tidier.** Staw's three notes were
that it took too much space, had no animation and was not polished. So:

- 176px wide instead of 192, with the rows at `py-1.5`.
- **"Message"** rather than "Chat with &lt;name&gt;", which was as long as
  whatever somebody called themselves.
- The site's own `animate-pop-in`, with `origin-top` so it grows out of the
  edge it is pinned to rather than appearing.
- Rows light up in `brand/20` on hover instead of grey, the icons sit in
  `text-muted` so the words lead, and the card is `rounded-2xl` on
  `bg-ink-raised` with a real shadow.
- The spinner replaces the message icon while the conversation is being
  opened, rather than the row just going dim.

**One thing worth knowing if the Workspace builds anything with an arrow
pointer:** the arrow has to live *inside* the animated element, not beside
it. `animate-pop-in` puts a transform on the wrapper, and a transform makes
that wrapper the containing block for anything absolutely positioned under
it - so an arrow positioned against the outer box lands behind the card and
simply never appears. It is the same shape as this project's usual trap: it
renders, nothing throws, and it is wrong. It is positioned at `-top-[6px]`
within the card's own wrapper now.

Nothing else changed, and nothing in the database.

## Round one hundred and twenty-one - one card at a time

Two corrections to `FriendPeek`, both from Staw looking at it in a real
friends list.

**Only ever one card up on the page.** Staw: "i dont want to see this on
two like accounts, like in the friendlists when u hover one guy it appears
then you hover another guy it disappears and then it appears for the next
guy". Each card deciding for itself is exactly that: the one being left
takes its grace period to go while the one being entered is already there,
so for a moment there are two and then a gap. There is now one module-level
value for which card is up, read with `useSyncExternalStore`, so opening a
new one is what closes the old one, in the same tick. Moving along a row
hands the card from face to face with nothing in between. The grace period
(now 140ms) still covers the gap between a face and its own card; entering
another face does not wait for it.

If the Workspace mounts more than one of these, that store is per module
instance, which is per bundle - it does not reach across windows, and does
not need to.

**The surface is back to the site's.** The polish pass had moved the card
onto `bg-ink-raised` with `rounded-2xl` and a brand-tinted hover, which
under a warm appearance read as a brown box that belonged to nothing. It is
`bg-ink-card`, `rounded-xl`, `border-ink-line`, `hover:bg-ink-hover` again -
the same surface as every other card and menu on the site. The small size,
the `pop-in` and the "Message" wording from the last round stay.

Previewed with three faces at `tools/site/peek-preview.html`; `shoot-peek.mjs`
now counts the cards up mid-move and asserts it never sees two.

## Round one hundred and twenty-two - the arrow joins the card

One fix. `FriendPeek`'s pointer was drawn before the card, so the card's own
1px top border painted straight across its base: a nub floating above a
closed box rather than a corner of it. The square is drawn after the card
now, with `z-10`, so its fill covers that border where the two meet and the
shape is continuous. Same trick anywhere the Workspace needs a pointed
panel - the pointer goes last, not first.

## Round one hundred and twenty-three - the Economy page, and a quest that is only a claim

**Migration 0270 - apply it.** It is written and applied twice locally with
behavioural checks under two identities.

### A new quest kind: `claim`

`quests.counted` accepts `'claim'` alongside the four it had. A claim quest
asks nothing: `quest_done` answers the goal the moment somebody has started
it, so accepting it and claiming it pays out. The row in `quest_progress` is
still what makes it claimable and `claim_quest` still refuses a second
claim, so "one each" holds exactly as it does for the counted kinds.

**This changes a shared type.** `QuestCounted` in `@/types/db` is now
`'world_time' | 'friends_made' | 'worlds_played' | 'by_hand' | 'claim'`. Any
switch over it in the Workspace needs the fifth arm, and a quest card that
draws a progress bar should know that a claim quest is complete on sight -
there is nothing to show progress through.

Staw asked for it as "quests that is a brix claim (no need to do anything
else)". `by_hand` was the near miss and is wrong: nothing credits it, so
such a quest would sit at zero for ever.

### Four reads for the economy

All `require_admin()`, all `security definer`, none of them able to write.
`pixel_transactions` keeps its policy - still readable only by the person it
belongs to - and these read across it on an admin's behalf.

- `economy_now()` - `in_circulation`, `holders`, `richest`, `average`, and
  `minted` / `burned` / `movements` over 30 days, plus `limiteds` and
  `resold`. In circulation is the sum of what accounts hold, because that is
  what exists: Brix are not minted into a treasury.
- `economy_flow(days)` - a row per day, oldest first, days of no movement
  included: `minted`, `burned`, `net`, and `held` (the total on every
  account at the end of that day, walked back off today's figure).
- `economy_by_kind(days)` - `came`, `went` and `movements` per ledger kind.
- `limited_market(days)` - per limited: `average_window` against
  `average_before`, `sold_window` / `sold_total`, `cheapest` and `offers`.
  Two averages rather than a percentage, because an item with one sale
  either side is not "up 300%".

### The console

The **Sale** category is now **Economy** (`faChartLine`), admin and up. The
sale panel is not gone - it is a block inside it, unchanged. Above it: the
four figures, two line charts (in and out, then everything held), the two
bar lists of where Brix come from and go, and the limiteds table. Below it,
the two ways of putting Brix in: a handout quest anybody may claim, and the
existing per-account give-or-take, which was already `admin_move_brix` and
is now beside the gauge that says what it does to the supply.

### A chart component, which the Workspace may want

**New: `@/components/ui/Graph`**, exporting `LineGraph` and `BarRows`. Plain
SVG, no chart library - everything needed is a line over time and a run of
bars, and a library is 50kB on every page that imports the panel plus a
second set of colours to keep in step with `design/preset.js`. These take
`tone` as a Tailwind text colour and inherit the tokens.

`LineGraph` takes `series: { label, values, tone, summary? }[]` and
`labels: string[]`. `summary` is `'sum'` (the default, right for a flow) or
`'last'` (right for a level - adding thirty daily totals of the same money
gives a number that means nothing). It is provider-free and router-free.

One thing learned building it, for anybody drawing SVG this way: a chart
drawn in a 100x100 box with `preserveAspectRatio="none"` stretches circles
into ellipses along with everything else, so the hover dots are HTML spans
placed at the same percentages rather than `<circle>` elements.
`vector-effect` fixes strokes, not fills.

Previewed at `tools/site/graph-preview.html` (`shoot-graphs.mjs`) and the
whole panel bare, signed out, at `tools/site/economy-preview.html`
(`shoot-economy.mjs`) - which is the check that it stands up on its empty
states rather than throwing.

Not built, and deliberately: no automatic supply control, no target for how
much should exist, nothing that prices a limited. The numbers are shown to
somebody who decides; nothing here decides.

Still waiting: `pg_cron` and `pg_net`. Not started: Kobby knowing an
account's standing so it stops warning the official account, the CEO,
admins, staff and mods over their bios.

## Round one hundred and twenty-four - the Economy page gets its padding

Correction, and it is worth writing down because the other session can make
the same mistake in an afternoon.

**`Card` has no padding.** It is `rounded-2xl border bg-ink-card shadow-card`
and nothing else; every caller adds its own `p-5`. The Economy panel went
out with `<Card className="space-y-4">` throughout, so every heading, chart
and table in it sat flush against the card's border. Staw, looking at it:
"the new economy tab looks like a mess". It was.

Every card in the panel is `p-5 sm:p-6` now, the blocks are `space-y-8`
apart rather than `space-y-6`, the figure tiles are `px-5 py-4`, the levers
sit under a rule, and the limiteds table pulls out to the card's own
padding at both widths.

Also fixed while looking: the limiteds table ran `timeAgo` on
`sells_until`, which answers "just now" for anything ahead of the clock -
so a limited with three days left read as one that had already closed in a
column headed "Closes". It says "in 3 days" now.

**If the Workspace imports `Card`, it has to bring its own padding.** The
same is true of `CardHeader`, which has `px-5 pt-5` built in and is a
different thing.

The preview at `tools/site/economy-preview.html` now swaps the Supabase
client for one that answers the four economy reads with fixtures, so the
panel can be looked at with numbers in it rather than on its empty states.
That seam is `setSupabaseClient` from `@/lib/supabase` - the same one the
applications use - and it is worth knowing it works for a preview this way.

## Round one hundred and twenty-five - Kobby knows whose words it is reading

**Migration 0271 - apply it**, and **redeploy the `moderate` edge
function**, which is the one change here that is not in the database.

Staw: "our AI.. well it should be aware of the status of the accounts.. like
@kobblon is the official account, like @stawrer is the CEO & founder of
kobblon, and who are admins, staff, and mods cuz its sending warnings to our
actual mods and staff and admins cuz they write it in bios and etc".

Two separate faults, and only one of them was the prompt's.

### The machine's hands were off some staff and not others

`judge_chat_line` and `judge_profile_text` both stopped at
`is_admin or is_moderator or is_superadmin`. Neither knew about
`has_staff_badge` - which is exactly the person Staw means by "staff", an
account with the badge and none of the keys - and **`judge_report` had no
such check at all**, so a report somebody filed about a moderator was the
machine's to settle.

One function answers it for all three now:

- **`kobby_hands_off(who uuid) -> boolean`** - true for Kobblon's own
  account, the founder, superadmins, admins, moderators and anybody
  carrying the staff badge.
- **`founder_account()` / `is_founder(who)`** - Staw's account, found by
  handle the way `kobblon_account()` finds Kobblon's.

The machine still reads their words and still records what it thought. What
it no longer does is warn, rename, quiet or suspend them. A person can,
through the console, which is what the console is for.

`ai_reviews.decision` accepts **`'staff'`**, and those readings are now
written rather than returned silently - what Kobby thought about a
moderator's line is worth seeing, and a judgement that vanishes is how
nobody notices the machine disagreeing with the team. The console draws that
badge in neutral, not green: green reads as "settled", which it is not.

### The model was told nothing about whose words it was reading

A moderator whose bio says "Kobblon moderator" is stating a fact; the same
sentence from anybody else is impersonation, and the model had a handle, a
body of text and nothing else to tell them apart. So:

- **`who_is(who uuid) -> text`** - one line, or null for an ordinary
  account: Kobblon's own official account, the founder and chief executive,
  runs Kobblon, an administrator, a moderator, a member of staff, a verified
  account. Only what changes how a sentence should be read.
- **`ai_work` gains a column, `about`.** It is dropped and recreated, since
  a new column is a new return type. The column carries `who_is` for
  `message`, `profile_text`, `report` (the reported thing's owner) and
  `ticket`; uploads and appeals keep null, being judged on what they are
  rather than on who sent them. **Anything reading `ai_work` positionally
  needs the extra column.**

The worker puts that line in the **user** message, not the system prompt -
it is a fact about one piece of text, not a standing instruction, and a
system prompt that changes per job cannot be read back later. Both the chat
and the name prompts gained a short section saying what to do with it, and
both say plainly that it is never a reason to judge somebody more gently.
The rules are the same for everybody; what protects staff from the machine
is the database check, which cannot be argued with.

Verified locally under two identities: an ordinary account writing "I am a
Kobblon moderator" is still warned and still has the bio taken down; the
same account carrying only the staff badge comes back `staff`, keeps its
bio, gains nothing on its record, and leaves a `staff` row in `ai_reviews`;
and `ai_work` hands back "This is a member of Kobblon staff." and "This is
Kobblon's own official account - the platform itself." beside the two rows.

Still waiting: `pg_cron` and `pg_net` are off, so Kobby and both sweeps run
by hand. 0270 (the economy) also still needs applying if it has not been.

## Round one hundred and twenty-six - the moderate function is live, and og never was

Staw applied 0271 and asked for the worker to be redeployed. It deploys
itself: `.github/workflows/functions.yml` runs on any push that touches
`supabase/functions/**`, so the push in the last round already did it -
"Deploying Function: moderate (script size: 86 kB) ... Deployed Functions on
project". **Kobby is reading the standing line now.**

What the log also showed: that workflow has been **red on every run**, and
not because of the moderate function. It deploys the folder one function at
a time and `og` fails to bundle:

```
Nullish coalescing operator(??) requires parens when mixing with logical
operators at supabase/functions/og/index.ts:88
```

So `og` - the link-preview function, the thing that gives a Kobblon link its
card in Discord and elsewhere - **has never deployed since it was written**,
and because it is last in the loop alphabetically after moderate, everything
before it went out and the red tick looked like a deploy failure of whatever
was in that push. Parenthesised, which is what Deno wants, and this round's
push takes it out.

Worth carrying across: the Workspace's own functions, if it ever adds any,
go out through the same loop, and one unbundleable file stops every function
after it in the alphabet.

## Round one hundred and twenty-seven - the five pages, and one shared rail

Staw asked for the redesign he named a while back: Catalog, Communities,
Discover, People and Settings, "the same way we did put order into the my
avatar page". So the rules are My Avatar's, not new taste - one subject as
big as the page allows, navigation down the side rather than tabs over a
grid, good ratios with nothing twice the size of anything else, padding and
a second line, and say less.

**There is a new shared component and the applications can mount it.**
`@/components/browse/BrowseRail` exports three things:

* `BrowseRail` - the column of names with counts, which becomes a scrolling
  row under `lg`. Items are `{ value, label, icon?, art?, count? }`.
* `BrowseFrame` - the rail beside a body, rail fixed at `13rem`, body takes
  the slack.
* `BrowseHeading` - the name of what is on screen, its count, and a slot for
  controls belonging to that body.

It imports `Glyph` and `cn` and nothing else: no router, no `useAuth`, no
Supabase, no assumption that it is on a page. That is deliberate, and it is
the fourth time the point has come up here - mount it wherever you like.

**`icon` on a rail item is optional**, and that is a meaning change worth a
line if you copy the type: left out, the row gets a small dot instead. It
exists because Discover's genres have no drawing, and six identical compasses
in a column is six icons that say nothing.

What changed on each page, briefly:

* **Catalog.** The nine shelves are the rail; Favourites and Basket are at
  the foot of it; the narrowing selects are on the shelf's heading line. That
  is four rows of controls before a single item down to none. **The shelf
  mounted without `hero` - which is how the avatar page mounts it, and how
  the Workspace would - is unchanged**: still tabs, still the search on the
  filter row, still `compact` for the narrow column. Only the full page got
  the rail.
* **Communities.** One list and one card. "The biggest" and "Just started"
  were two sections over the same communities in two card shapes, so the same
  Community appeared twice on one screen looking like a bug. They are two
  orders on the rail now, with Verified and Yours beside them.
* **Discover.** One grid as wide as the page, and the three rows are three
  entries on the rail. It was running four queries, three of them the same
  forty Worlds in three orders; it runs one.
* **People.** Your own card is a strip above the grid rather than a tile
  inside it, a friend's card says so and offers a message instead of
  offering to befriend somebody already befriended, and the advert is out of
  the middle of the grid.
* **Settings.** The rail was already right; the panel is capped at `max-w-2xl`
  and centred, and the display-name and password fields no longer stretch the
  width of the page.

**One real bug came out of the screenshots, and it was mine.** A single
column CSS grid track is `auto`, which sizes to its widest child - and the
rail on a phone is a scrolling row that is wider than the screen on purpose.
So every one of the five pages scrolled sideways on a phone with each card
clipped at the right edge: 98px over on People, 635px on the Catalog. The
frame asks for `grid-cols-[minmax(0,1fr)]` now and all five measure zero.
**If you build anything that puts a horizontally scrolling row inside a grid
column, this is waiting for you too.**

Not done, and said plainly: the mobile pass as a whole is still not done -
this fixed the overflow the rail caused and nothing else. The advert slots
still answer with nothing until `pick_ad` has something to give. Nothing on
these pages changed what the database is asked for, except Discover asking
once instead of four times.

For looking at them: `npx vite --config vite.pages.config.mjs` then
`node shoot-five-pages.mjs [width]`. It mounts each page from source with a
fixture client and a signed-in fixture, because the signed-out shape is the
one shape that cannot be checked against what Staw sees.

## Round one hundred and twenty-eight - the phone: a bottom bar with a middle, and the mark moved to the edge

**Nothing in this round changes a signature, a field or a limit.** It is the
site's own chrome on a phone. The one line in it that matters most to you is
the grid trap at the bottom, because it is the same one that cost the five
pages in round one hundred and twenty-seven and it is now confirmed on a
second page.

**`@/components/layout/nav.ts` changed meaning, so it gets a line even though
nothing breaks.**

* `topNav` is now `NavItem[]` rather than `{to,label}[]`, and every entry
  carries an `icon`. Anything of yours reading that list for labels still
  works; anything typing it as the old shape does not.
* `NavItem` gained `face?: boolean`. A slot with it shows the person's own
  picture instead of a drawing.
* `mobileNav` is a different five: **Home, Discover, You, Catalog, Friends**.
  Create and Communities left it. They are not lost - see the drawer below -
  but if you mirrored that array anywhere, it no longer says what it did.

**The bottom bar is a component now: `@/components/layout/PhoneBar.tsx`.** It
takes `requests` and `mail` as numbers and asks for nothing else, so it
mounts outside the website; it reads `useAuth` for the picture, which means
it needs that provider, and it is the one piece of this round that does.

What it does, and why, because Staw sent Polytoria's bar and said he likes
that part of theirs:

* Five flush slots, icon over a small word, **no fill behind the one you are
  on**. Ours had a solid `bg-pick` block behind the active icon, which on a
  dark bar reads as a button somebody left pressed.
* **The middle slot is the person's own avatar**, going to My Avatar. That is
  the whole trick of theirs: the bar gets a middle instead of five things in
  a line, and the one slot that is about you looks like you.
* The slot you are on is said by a short brand bar **over** the slot, not
  under the word, where the home indicator eats it.
* **The counts are rendered.** `mobileNav` has declared `badge` since it was
  written and the bar never drew one, so an unanswered friend request was
  invisible on a phone. Friends keeps the fifth slot for exactly that reason:
  it is the only slot that can carry a number.

**The drawer on a phone now carries both menus.** The sections bar across the
top is `lg:flex`, so on a phone it is not there at all - which meant
Communities and the Catalog had **no way in on a phone except the search
field**, and had not since the sections bar was written. `SidebarContent`
renders `topNav` as a second group under a "Browse" heading, `lg:hidden`.

**The mark in the top bar: it is at the left edge now and the burger is at
the right.** Staw said twice that it looked wrong between them. It was not
mis-centred - measured, the gaps were twelve pixels either side and all three
sat on one centre line. The fault was weight: a fifteen-pixel-wide K between
two thirty-six-pixel blocks looks like something that fell down a gap however
exactly it is centred. At the edge it has a side of its own and nothing to be
compared against. It is `h-7` rather than `h-5`. **If your window copies the
old arrangement, it will draw the same complaint.**

**The grid trap again, on the console.** `Admin.tsx` scrolled sideways by
1231px on a phone for the same reason the five pages did: a single-column
grid track is `auto`, so it sizes to its widest child, and the console rail
is a scrolling row that is wider than the screen on purpose. It asks for
`grid-cols-[minmax(0,1fr)]` now, with `min-w-0` on the column. Twice in two
rounds. **Any grid of yours with one column and a scrolling row in it has
this.**

Measured, not judged by eye: all fifteen pages this harness reaches now
report **0px** of sideways scroll at 390px, where the console was 1231px and
four of the five pages were over before the last round.

Not done, and said plainly:

* The phone pass is the chrome and the overflow. The **pages themselves** at
  390px have been measured, not redesigned - nothing on them was re-laid out
  this round.
* The console's panel lead is still truncated mid-word on a phone
  ("whether the machine is keepin...").
* The avatar in the middle slot draws from `useHeadshot` like everywhere
  else, so it is the same picture, with the same wait, as the rail's.

For looking at it: `npx vite --config vite.pages.config.mjs` then
`node shoot-phone.mjs 390 [page...]`. It mounts the **real `AppShell`**, so
the top bar, the drawer, the bottom bar and the chat dock are all in the
shot, which is where most of what breaks on a phone actually lives. It prints
each page's sideways spill and names anything sticking out past the edge.

## Round one hundred and twenty-nine - the phone, the pages themselves

Round one hundred and twenty-eight did the chrome. This is the pages, and
one thing in it changes a shared component's **behaviour**, so read the
first two bullets even if you skip the rest.

**`@/components/chat/ChatDock` - `useChatDock()` returns three more things.**

```ts
openChat: () => void    // open the chat on a phone
chatOpen: boolean       // whether the phone sheet is showing
chatUnread: number      // unread across every conversation
```

The context keeps its default, so reading it outside the provider still does
not throw - that stays true and is worth keeping true. **The round floating
chat button is gone.** Staw: "replace the friends thing by the messages
thing (chat docks on the pc website)". The bottom bar has a Chat slot that
calls `openChat`, which is also where Roblox puts it. If your window drew its
own floating button to match ours, it is now matching nothing.

Related, same file: `List` no longer draws its own header when `full`. The
phone sheet has its own title bar, so "Friends Chat" was appearing twice down
the top of the screen, and the inner header's collapse chevron did nothing
there because `full` forces the list open. **The desktop dock is unchanged** -
it still has its header, its chevron and its remembered open state.

**`mobileNav` is four entries now, not five**: Home, Discover, You, Catalog.
Chat is the fifth slot on the bar and is deliberately **not** in that array,
because it is not a route - the bar adds it itself. If you read `mobileNav`
expecting the whole bar, you will be one short.

**The shape the phone pages now take, which is the part worth copying:**

* **Two cards across, not one.** `WorldCard` grids on Discover and the
  Library were one column below `sm`, so a shelf of Worlds was one card per
  screen and Discover ran to 4977px. They ask for `grid-cols-2` at every
  width now. Profile already did this; it was the odd one out that was
  right.
* **`WorldCard` drops its description and its genre below `sm`.** Two across
  leaves room for the name, who made it, and one line of numbers. With the
  description it was a block again, and with the genre the numbers line
  wrapped on one card and not its neighbour, so a tidy grid came out ragged.
* **`CommunityTile` stacks its emblem over its name below `sm`.** Side by
  side in a half-width tile, the 56px emblem left about eighty pixels for
  the name: every Community read "Sta..." and "The ...", and the member
  count broke across two lines.
* **`BrowseHero` is much smaller on a phone** - `px-4 py-5`, `text-2xl`, the
  lead clamped to two lines, a 48px field. It was 400px of title on Discover
  before anything somebody came for.
* **Home's shelves use `w-44` cards below `sm`.** At `w-64` one card filled
  the screen, so a shelf read as a single World with an edge beside it.
* **The console**: its panel lead wraps instead of truncating mid-word
  ("whether the machine is keepin..."), its stat tiles are two across, and it
  no longer advertises `Ctrl K` on a device with no Ctrl key.

**One wrong sentence, fixed, and it was wrong everywhere and not only on a
phone.** My Avatar said "Nothing yet. Press something on the right to put it
on." The shelf is **under** the body at every width - the comment three lines
below it in the same file says so. It now says "from the shelf below".

Measured: all fifteen pages still report **0px** of sideways scroll at 390px,
and the four longest are shorter by a lot - Discover 4977 to 1935, Library
2181 to 1056, Communities 2345 to 1577, the console's overview from four
screens to one.

Not done, and said plainly:

* **People is still a full-width list, 2853px of it**, and that is the
  longest page left that is not simply long because it has a lot in it. A
  person's card carries Message and Profile, which a denser row would lose,
  so it was left alone rather than halved badly.
* **The friends row on Home is still a wrapping grid, on purpose.** Roblox
  scrolls theirs sideways and Staw's screenshot shows that, but he asked for
  this one specifically: "you shouldnt have to scroll left or right to see
  all of your friends ... but just have a limit max that we can display with
  a view all". It was not changed on the strength of a screenshot about
  something else.
* The Catalog is 3581px at 390px. That is twelve recommendations and a full
  shelf, three across, which is content rather than layout.

## Round one hundred and thirty - a greeting instead of a heading, Charts on Discover, and the Brix that were shown three times

### New shared component: `@/components/worlds/Shelf`

Three exports, and the Workspace can mount all of them bare - they need a
router for their links and nothing else:

- `Shelf({ title, note?, more?, children, className? })` - a row of Worlds
  that slides sideways, with the arrows only where there is a mouse. `more`
  is either `{ to, label? }` or `{ onClick, label? }`; given one, the title
  gets a chevron and becomes the link, and a "Show all" appears at the right
  from `sm` up. Home had a private copy of this and Discover had none, which
  is how the two pages about the same Worlds came to look like two products.
- `WorldTile({ world })` - the **square** tile: `emblem_url`, falling back to
  `cover_url`, then the globe. Name on two lines under it, then approval and
  visits.
- `WorldFeature({ world })` - the wide one: `cover_url` 16/9 with the emblem
  and the name over the bottom of it.

Approval is `like / (like + dislike)` as a whole percent, and it is **not
drawn at all** where nobody has said anything. A World with no opinions on it
shows visits only; it does not show 0% or 100%.

The white text over the cover is `text-[#fff]`, not `text-white`. `white` is
`--fg` and flips with the theme, so `text-white` over a dark gradient is
black text in daylight. Worth knowing wherever you draw on top of an image.

### New call: `listRecentlyPlayedWorlds(limit = 12)`

Reads `world_visits` and folds it: one row per person per World per day, so a
World played all week is several rows and only the newest day counts. **No
`eq` on the person** - the row-level policy on `world_visits` already allows
each account its own rows and nothing else, and a filter written in a client
is a filter anybody can take back out. Signed out it must not be called;
there is nothing to read and the page asks for nothing instead.

### New shared module: `@/lib/greeting`

`greeting(name, at = new Date()) -> { hello, aside }`. Four times of day
(morning, afternoon, evening, after eleven) and **two** lines for each, so it
is not the same sentence every morning. Which of the two is decided by the
day number, not by `Math.random`: a random pick changes under you when a
panel re-renders, and a greeting that rewrites itself mid-sentence reads as a
bug. This exists here because the Workspace opens with the same thing over
the same avatar - **please import it rather than writing a second set of
lines.** Two products greeting the same person in two different voices is the
"Model" and "Mesh" problem again.

### Home

The `<h1>Home</h1>` is gone. In its place: the person's own avatar at
`size="2xl"` (`sm:h-28 sm:w-28`) with the greeting beside it. Somebody who
has just signed in knows where they are.

"Being played right now" is still there, but **above** it there is now
"Recently played", built from `listRecentlyPlayedWorlds` and drawn with
`WorldTile` - the square marks, not the covers. It appears only once there is
a history: an empty row headed "Recently played" says nothing except that the
page has a hole in it, so signed out and on a first visit the trending shelf
takes the top instead.

### Discover is a charts page now

The rail's first entry is **Charts**, and it is the default. It is not a
fourth ordering of the grid, it is a different page: a "Featured" row of four
`WorldFeature` cards (picked by most-liked, so it is not the same four
Worlds as the shelf under it), then three `Shelf` rows - Being played, Just
published, Most liked - each with a "Show all" that switches the rail to that
sort and drops into the existing grid.

Searching or picking a kind of World leaves the charts on their own and shows
the grid, even while the rail still says Charts, because a shelf of eighteen
is not an answer to a search. The three shelves are three orderings of one
table so they cannot be one query, but they are one `await`, and they are
only asked for while the charts are on screen.

### The Brix that were shown three times

Staw: "why in settings u can see ur brix stuff while theres the transacation
page bruh". Removed, and these are the ones that are gone:

- **Settings' whole money panel.** It was a literal second copy of `/brix` -
  the same `Balance` over the same `listPixelTransactions`. The section is
  out of the rail entirely.
- Settings' header balance chip.
- The "Your balance" aside on Quests.
- The "Your balance" aside on Redeem a code.

What deliberately **stays**: every "You have X" that sits at a spend
decision - the username change cost, the three on Create an advert, the new
Community dialog, the Quests tag fee, the buy dialogs. A balance beside a
price answers "can I afford this"; a balance on its own is the topbar again.
If the Workspace shows one anywhere, the same test applies.

### Two fixes worth copying

- **The dead-colour sweep.** Forty-one uses across eleven files of `text-yes`,
  `ink-soft`, `ink-strong` and `ink-sunken`. **None of those tokens exist** -
  not in `design/preset.js`, not in `design/tokens.css` - so every one of them
  rendered as nothing at all. The progress tracks on the World page had been
  invisible for however long. If the Workspace has any of those four class
  names in it, they are doing nothing: `text-yes` meant `text-space-bright`,
  `ink-soft` meant `muted`, `ink-strong` meant `white`, `ink-sunken` meant
  `ink`.
- **The chat dock covering things.** It is `fixed` bottom-right and nothing
  scrolls out from under it, so on Settings it sat over the one button on
  each row. `ChatDock` now sets `--dock-space: 20rem` on the document while
  its desktop column is mounted and clears it on unmount, and
  `.kob-dock-gutter` (in `src/index.css`) turns that into right padding on
  `main` **from 1280px up only** - narrower than that, a twenty-rem gutter
  costs the page more than the dock does.

### Not built

- Nothing shows how long ago a World was played; "Recently played" is an
  order, not a date, and the day is all `world_visits` stores anyway.
- There is no per-genre shelf on Discover. One query per genre to fill a
  front page is not worth it yet.
- `listRecentlyPlayedWorlds` reads a table rather than an RPC. If the
  Workspace wants it under a different session it works the same way through
  `setSupabaseClient`, but it does depend on that policy staying as it is.

## Round one hundred and thirty-one - the dock gutter is gone, and Home breathes

Two things, and the first one undoes something from the round before it.

### `--dock-space` and `.kob-dock-gutter` no longer exist

Last round, `ChatDock` set `--dock-space: 20rem` on the document and `main`
turned it into right padding from 1280px up, so the dock would stop sitting
over the buttons on Settings. **If the Workspace copied either of those, take
them out.**

What it actually did: every page inside `main` is `mx-auto` inside a
max-width, so twenty rem of right padding moved the centred block bodily to
the left and ate the right-hand gutter. Staw, looking at the live site:
"either theres no spaces on both sides anymore either theyre left-centered".
Measured at 1920 it was 384 left against 160 right; it is 160 against 160
now.

The lesson is the one worth carrying: **padding on the element that centres
something is not spacing, it is a shove.** A fixed overlay that wants room
has to take it from outside the centred box or not at all. The dock sits in
the right-hand gutter at wide widths anyway, which is most of the problem
solved for nothing.

So the dock overlaps again under about 1280px, the way every chat dock on
the web does. If it needs solving properly it will be by moving the dock,
not by squeezing the page.

### Home's spacing

The greeting block is a tall thing where a line of text used to be, so the
old gaps read as half of what they were. Shelves and the friends rail are
`mb-10 sm:mb-12` rather than `mb-8`/`mb-9`, and the header carries
`mb-8 sm:mb-10` with a little room above it. Appearance only - nothing moved
and nothing changed meaning.

## Round one hundred and thirty-two - where the square marks go, and what fills Recently played

### The emblem tiles now carry three shelves on Home

`WorldTile` (the square `emblem_url`, from `@/components/worlds/Shelf`) is on
**Recently played**, **Your Worlds** and **Saved**. The wide covers stay on
"Being played right now" and the two shelves of Worlds nobody has seen yet.

The rule behind the split, worth holding to in the Workspace as well: **a
cover sells a World, a mark finds one.** A shelf of things you already know -
yours, saved, last played - is a shelf you are scanning for one you recognise,
and the marks are both denser and quicker to recognise. A shelf of Worlds you
have never met needs the picture.

### Recently played is empty for nearly everybody, and that is correct

It reads `world_visits`, and the only thing that ever writes a row there is
`join_world_server` - **actually joining a server from the client.** Opening
a World's page on the website writes nothing. So anybody who has not played
through the client has no history and the shelf does not draw at all, which
is why it is nowhere to be seen on the live site today.

Nothing was "fixed" about that and nothing should be: a World you looked at
is not a World you played, and making the page view count would put Worlds
you never entered on a shelf headed Recently played. It fills in as people
play. If the Workspace wants the same shelf it is the same call and the same
condition.

One change to the call: the embed hint is gone, `world:worlds (…)` rather
than `world:worlds!world_id (…)`. `world_visits` has exactly one foreign key
to `worlds`, so the hint was never needed, and it matches how
`listFavouriteWorlds` has always read.

### The gutters, checked everywhere

After last round's revert, every page was measured at 1920 rather than
eyeballed - the left and right space either side of the page's own block,
inside `main`:

- Home, Discover, People, Communities, Catalog, My Avatar: 160 and 160.
- Settings, Friends, Library, Quests, Brix, Inbox, Standing, Support:
  304 and 304.
- The staff console is full-bleed by design - its bar spans the window - and
  its contents are centred inside `max-w-[1500px]`.

So nothing else carried that fault; it was the dock gutter alone. Home's
shelves are `mb-10 sm:mb-12` as of last round and the other pages were left
as they were.

## Round one hundred and thirty-three - the shutters, the burger, and a question for you about the Launcher

### **Read this part first: Play cannot reach the Launcher**

Staw, with a screenshot from a machine with the current Launcher on it.
Pressing Play on a World gives a Windows dialog:

```
Error launching app
Unable to find Electron app at
  ...\e0000000-0000-4000-8000-000000000001?code=c1ea7c2172004858b5b26bbf1bd4b2b8857...
Cannot find module
  ...\e0000000-0000-4000-8000-000000000001?code=c1ea7c2172004858b5b26bbf1bd4b2b8857...
```

That is Electron being handed the deep link **as the path to the application
to run**. It is not the website failing to send one: the website sent
exactly what it has always sent, and the string in the dialog is the tail of
it. So this one is in the protocol registration on your side, and it is
yours to fix - but here is everything about what arrives, so you can fix it
against the real thing rather than against a guess.

**What the website sends, unchanged:**

```
kobblon://play/<worldId>?code=<code>      -- Play on a World page
kobblon://edit/<worldId>                  -- Open in the Workspace
```

`<worldId>` matches `^[A-Za-z0-9_-]{1,64}$` - today it is a UUID, so it has
dashes in it. `<code>` matches `^[A-Za-z0-9_-]{32,128}$`. It is minted by
`mint_app_code('launcher')`, is good for **two minutes**, and can be claimed
**once**: the server side spends it with `claim_app_code(code, 'launcher')`,
which is a single `update ... returning` so two racing applications cannot
both win. Nothing else personal is in the link, deliberately - a protocol URL
ends up in shell history and crash logs.

The website hands it over with `window.location.href = link` and then
watches for the page being hidden; if nothing takes the screen within about
a second it offers the download instead. So **from here, a Launcher that
throws this dialog looks identical to a Launcher that is not installed**:
Windows did answer the scheme, which is why the download prompt does not
appear.

**What we need you to tell us** (Staw will carry the answers back):

1. How is the scheme registered on Windows in the build people have now -
   `app.setAsDefaultProtocolClient('kobblon')` from a packaged build, from a
   dev build, or a registry entry written by the installer? The message
   names Electron looking for an app directory, which is what an unpackaged
   registration does when it is not given `process.execPath` plus the app
   path as its arguments.
2. Does the Launcher handle `second-instance` and the `open-url` event, or
   only `process.argv` on first launch? The failing case above never reaches
   application code at all, but the answer decides what happens the second
   time somebody presses Play while it is already open.
3. Does it still expect `kobblon://play/<id>?code=<code>`, or did the recent
   work change the shape it parses? If it changed, say what it is now and
   **the website will send that instead** - this is one of ours to move, and
   it is three lines in `src/lib/app.ts`.
4. Is `kobblon://edit/<id>` answered yet? The website has been sending it
   since round one hundred and nine and has never been told.
5. Which binary holds the handler now that the Launcher and the Workspace
   are separate applications? If both register `kobblon://`, the last one
   installed wins on Windows and Play opens the Workspace.

If it helps, the quickest check on a machine that is failing:
`reg query HKCR\kobblon\shell\open\command` prints exactly what Windows is
running, and the fault will be visible in that one line.

### The staff console can close the website

New migration, **`0272_the_shutters.sql`** - not applied yet; Staw applies it
in the SQL editor. A new panel in the console, **Shutters**, admin and above.

- `public.site_state`, one row for ever (`only_row boolean primary key check
  (only_row)`), holding `maintenance`, an optional `note` of up to 300
  characters, and who set it when. `grant select` to **anon and
  authenticated** - the site asks before anybody has signed in - and no
  insert, update or delete to anybody.
- `public.set_maintenance(shut boolean, words text default null)`,
  `security definer`, which checks `my_staff_rank()` is `admin` or
  `superadmin` and returns the row it wrote.
- Who still sees the website while it is down: **admins and superadmins
  only. A moderator is shut out with everybody else** - Staw, asked
  directly: "mods are still affected tho".

Proved against a real PostgreSQL with the whole migration history on it,
applied twice, under three identities with `auth.uid()` printed first so the
checks could not pass by being anonymous: an ordinary account refused, a
moderator refused, a direct `update` refused with `permission denied for
table site_state`, the admin's write read back correctly by a stranger and
by the signed out, and one row at the end.

**What it is, and this matters for the Workspace and the Launcher:**

> It is a curtain, not a lock. The **website** stops drawing itself. Every
> table and every function answers exactly as it did before, so **an
> application holding a session carries on working while maintenance is on**.

So if the desktop applications should also stand down during a window, that
is a thing you decide to honour: read `site_state` (one row, readable by
anybody) and show your own screen. Nothing will stop you if you do not, and
nothing here will break if you do. If a window ever needs the real thing -
nobody may touch this data while it moves - that is `revoke` on the tables in
question, written for the one occasion, and it is not this switch.

### The burger is on the left now

On a phone the navigation button has moved from the right-hand end of the
bar to **the left of the wordmark**, and it is 40px rather than 36. It was
the furthest thing on the bar from the thumb that opens it, and a tap at the
very edge of a phone screen is a tap the browser can take for a back
gesture - which is how pressing it ended up on a page saying nothing is here.
Worth checking wherever the applications have a bar of their own.

### Not built

- Nothing tells a person *when* maintenance will end. A time would be a
  promise the switch cannot keep; the note field says whatever the person
  throwing it wants to say.
- Maintenance does not close the API, as above.
- `/login` stays open while the shutters are down, so an admin who is signed
  out can get a session to turn it off. Everything else is the notice.

## Round one hundred and thirty-four

### The joy, sad and fire faces were redrawn

Staw redrew three of the eleven: `laugh`, `sad` and `fire`. Same names, same
eleven, same places they are used - **nothing about the contract moved**, so
this is a pull and not a change. The files are
`public/icons/ui/reaction-laugh.png`, `reaction-sad.png` and
`reaction-fire.png`, plus the two detail masks beside them.

One thing to copy if you draw the faces yourselves rather than importing
`Icon`: the tears are a **separate file painted on top**, not part of the
face. The face is a white silhouette painted `#FFCC4D` (the fire
`#F6861F`), and `reaction-laugh-tears.png` / `reaction-sad-tears.png` go
over it in **`#5DADEC`**, which is new - it was `#4AA3F0` and is now the
blue Staw actually used in his own drawings. A face drawn without the
detail pass is a yellow face with yellow tears, which reads as nothing at
all.

The cut is `tools/icons/cut-reaction-details.py` and it changed shape: the
tears used to be found by where they sat (drops are islands, streams are
holes) and are now found by colour - every blue pixel in Staw's coloured
original is a tear. His coloured originals live in `tools/icons/source/`
so the cut can be run again without going back to a chat log. The old rule
would have broken on this redraw; the new one does not care where he puts
them next time.

### The shutters reach you now, rather than within a minute

Round 133 gave the switch and the website asked `site_state` once a minute.
Staw, having watched it: "i want that the shutters appear instantly rather
than having to refresh the page".

**Migration 0273** publishes the row: `site_state` is in
`supabase_realtime` and has `replica identity full`, so an update carries
the whole row - `maintenance` and `note` both - and nothing has to be asked
again afterwards.

**For the applications, if you ever want to honour it:** subscribe to
`postgres_changes`, `UPDATE`, `public.site_state`, no filter (there is one
row). Nothing is opened up by this - realtime delivers a row only to
somebody whose row level security would have let them read it, and the
policy there is "everybody reads", because it is the notice on the door and
the door is read before anybody signs in.

**And the warning from round 133 stands, harder now that it is instant:**
this is a curtain, not a lock. Every table and every function answers
exactly as before while the shutters are down. A Workspace or Launcher
holding a session carries on working, and *should* - the switch means "do
not use the site while I move something", not "nobody may touch the data".
If you decide to draw something of your own on it, that is a courtesy you
are choosing, not a rule being enforced on you.

The website keeps the minute's poll underneath the socket. A socket that
quietly dropped an hour ago is a tab that would never hear, and the one
thing worse than a slow curtain is one that never arrives.

### The notice reads differently

"Kobblon is having its insides moved around" is now **"Kobblon will be right
back"**. Staw asked for it to change. The optional note an admin types is
unchanged and still sits under it.

### Not built, still

- Nothing writes `world_visits` except `join_world_server`, so "Recently
  played" on Home is empty until somebody actually joins a server from the
  client. That is a true empty row and not a bug to work around.
- No countdown and no "back at" time on the notice: the switch holds no
  promise it cannot keep.
- `kobblon://edit/<id>` - still no word from your side whether it is
  answered. Round 133's five Launcher questions are all still open.

## Round one hundred and thirty-five

### Two pictures were replaced

- **`report.png`** - the flag, redrawn. Same name, same place
  (`public/icons/ui/report.png`), still white line art that takes whatever
  colour it is painted. Nothing to change on your side beyond pulling it.
- **`kobby_under_construction.png` is gone.** It is
  **`public/brand/under_construction.png`** now, and it is a different
  drawing: the whole character with a hammer rather than a head and
  shoulders that stopped mid-body. `kobbyArt.construction` points at the
  new one, so `<Kobby mood="construction" />` is unchanged - but if
  anything on your side names the old file directly, it is a 404 as of this
  round.

The maintenance notice draws him on a halo now. He is black with a black
cap and the page is very nearly black, so without something behind him the
figure was an outline and the hammer was the only thing anybody could see.
Worth copying if you ever put him on a dark panel.

### The front page has navigation on a phone

Not a shared thing, but the shape of the bug is worth having: the public
bar's four links (Play, Create, Communities, Download) were
`hidden ... sm:flex` and nothing replaced them below that width, so on a
phone the front page had **no navigation at all** - the download link
included, which is the one thing that bar is for. There are three lines
left of the mark now, the same place and the same size as the signed-in
bar, opening the same four links.

The lesson rather than the fix: `hidden sm:flex` with no small-screen
counterpart is not a layout choice, it is a deletion. Worth a look at any
panel of yours that hides a control at a breakpoint.

### Still open

- Round 133's five Launcher questions. No answer yet, and
  `kobblon://edit/<id>` is still unconfirmed.
- `world_visits` is still only written by `join_world_server`.

## Round one hundred and thirty-six

A correction to round 135, in the one direction that matters: **the halo
behind the under-construction drawing is gone.** Staw: "just for the
shutters dont add a shining stuff behind the under construction". He is
drawn on the page as he is, at `xl`, with nothing behind him.

So ignore the "worth copying if you ever put him on a dark panel" line in
135 - that was me solving a problem Staw does not think is one. The
drawing on `bg-ink` is the look he wants.

Nothing else moved: same file (`public/brand/under_construction.png`),
same `kobbyArt.construction`, same page.

## Round one hundred and thirty-seven

### The three lines, and why a button was changing the address

Staw, twice: the mobile menu button "sends me to the 404 page". It could
not be reproduced in a mobile browser at 390 wide - the button is there,
nothing covers it, the drawer opens, and all twelve links in it land on
their own page - which is the part that gives the answer away. **A button
cannot navigate.** If the address changes when one is pressed, the press
was not what moved it.

`-ml-1` put its left edge eight pixels from the side of the screen, which
is inside the strip iOS hands to the back gesture. A tap there that slides
a couple of pixels is not a tap at all: it is the browser going back, and
back from the page you just opened is whatever was there before - which is
how pressing a menu lands on a 404 and reads as "the menu is broken". It
is now twenty pixels in, which leaves the gesture its strip and the button
its taps, plus `touch-action: manipulation` so a double press is not read
as a zoom.

**Worth having on your side even though you are not a browser:** it is the
same mistake as a control under a window's drag region. Anything whose
edge sits in a strip the system has already claimed loses, and the symptom
is never "my control is in the wrong place" - it is "my control does not
work", reported by somebody who is pressing exactly the right thing.

Said plainly, because it is a guess with good evidence rather than a
reproduction: if Staw still lands on the 404 after this, the cause is
something else and the next thing to ask for is the address bar.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and thirty-eight

### Settings and the Library were redrawn, and Settings is now four shapes

Staw, on Settings: "i dont want it overcrowded, with too much infos, but i
want it to the best design ever, like a brand new design, thats so good that
we dont need to change it for two years."

The two-year part is what decided the design, and it is the part worth
copying. A settings page rots because each new setting arrives in whatever
shape its author felt like, so the tenth one needs a redesign to fit. So
there are **four shapes and only four**, in
`src/components/settings/Panel.tsx`, and a new setting is a new `Line`:

- **`Panel`** - one subject. A title, one line of note, children.
- **`Group`** - a card of settings that belong together. Dividers inside,
  space between cards: that pairing is what says how many subjects are on a
  screen before a word of it is read.
- **`Line`** - one setting: its name, one short note, what it is set to, and
  the control that changes it. It is a `div`, or a `Link` with `to`, or a
  `button` with `onClick` - so a row that leads somewhere is the whole row,
  not a word at the end of it.
- **`Choice`** - one option among a few, as a tile with a swatch you can see
  the answer in. Mode and the theme appearances were two copies of this and
  had already drifted by a radius and a hover colour.

**These are importable** - `@/components/settings/Panel` - and they are a
good fit for the Workspace's own settings window, which is the same problem.
They need no provider and no router unless you use `to`.

One rule inside `Line` that is worth taking even if you draw your own: **one
row at every width.** It used to stack the control under the name on a
phone, which put the chevron on a line of its own pointing at nothing and
the control furthest from the thumb. The name truncates, the note wraps, the
control keeps its corner.

What came out of the page, because uncrowded is a decision and not a wish:
the gradient hero, the always-open password form (a row that opens a dialog
now), the paragraph explaining where the picture and bio live (a row that
goes there instead), and two of the three sentences of policy prose.

### The Library

Now the same rail-and-body frame as Discover, the Catalog, People and
Settings, rather than three number tiles that were also the switch - a count
that is pressable reads as a filter and a filter that counts reads as a
statistic, and neither wins. The counts are on the rail, the two facts about
the whole shelf (published, visits) are in the header, and the shelf's own
words are beside its heading. Nothing about the data moved: `my_worlds` and
the favourites list are called exactly as before.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and thirty-nine

### Account standing and Support joined the settings language

Staw: "i want these pages to be redesigned to be compatible and coherent
with the settings page". They are the same journey - somebody in trouble
goes Settings, standing, ticket in one sitting - and they opened three
different ways: an avatar over a gradient, a kicker above a 48px heading
with an icon, and the same again in another colour.

So all three now open with **`PageTop`** (a name, one line, and whatever the
page is for on the right - no kicker, because small caps above a heading
repeats the heading) and are built from the same `Panel` / `Group` / `Line`
/ `Choice` as Settings. `PageTop` is exported from
`@/components/settings/Panel` with the rest.

What that actually changed, beyond chrome:

- **Standing.** The behaviour score keeps its own card, because a score, its
  band and the bar are one picture and cutting that into labelled rows would
  be coherence doing damage. Everything after it - what a suspension would
  cost today, what is switched off, a cleared record, a closed account - is
  a `Line` in one `Group`. The `Bought` note component is gone.
- **Support.** The two link cards are a `Group` of two `Line`s, the same
  shape Settings uses for exactly those two links, and a ticket is a `Line`
  with its status as the action. The list of tickets reads like a list of
  settings now, which is correct: they are rows you open.

Two changes inside `Line` that came out of it and are worth copying:

- **Value before note.** A row reads name, what it is set to, then why. The
  other way round it is an explanation that happens to end in an answer.
- **The name wraps rather than truncating**, up to two lines. On a phone a
  ticket called "I cannot sig…" beside a badge is a row nobody can tell from
  the one under it.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and forty

### The OG card

`public/brand/og.png` is Staw's new artwork. It arrived at 1280x746, which is
not the card ratio; it was cropped 74px evenly off the top and bottom (keeping
the lockup centred) and resized to 1200x630, so it matches the
`og:image:width` / `og:image:height` the head has always declared. Nothing in
the markup changed. If an application ships its own share card or an installer
splash from this file, take the new one; the path is the same.

### Settings, Account standing and Support are wider now

Round one hundred and thirty-nine put Account standing and Support on the
settings design, and capped them at 48rem to read at the width a settings
panel does. That was wrong and Staw said so: "the new support & account
standing stuff arent center-centered, and too small in my opinion". A settings
panel is narrow because a rail sits beside it. These two have no rail, so the
cap was a column pinned to the left of a page with a third of it empty. The
cap is gone; the page is the column.

`PageTop` also grew, and this is the part that matters outside those two
pages: its heading is now `text-3xl sm:text-4xl` and its note
`text-sm sm:text-base`. Settings uses `PageTop` too, so Settings grew with
them. If the Workspace mounts any of these three, or mounts `PageTop` itself,
expect a larger opening - no API changed, the sizes did.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and forty-one

Staw: "i also want a proper redesign of the Contact us popup card and also of
the popup cards for each violation". Both are shared components the Workspace
mounts, so read this one.

### `Dialog` takes a `head`

`@/components/ui/Dialog` has a new optional prop:

```ts
head?: ReactNode   // drawn instead of the title and description
```

When it is given, the title bar is replaced by whatever you pass, and the
close button is drawn over it at the top right. `title` is still required and
is still the accessible name - a crest says nothing to a screen reader.
Nothing that does not pass `head` changes. The body's scroll cap is now
`max-h-[65vh]` on a phone and `70vh` from `sm` up, so a card with a tall head
still shows its footer.

### `TicketCard` is a wizard now, and the order changed

It was four steps rendered at once inside a 70vh scroller - about two and a
half phone screens of form with a numbered rail counting steps nobody was
being walked through. It now shows **one step at a time** with a pressable
progress strip across the head and Back/Next in the footer.

What this means if you mount it:

- **The props did not change.** `open`, `username`, `onClose`, `onSend`,
  `sending`, and the same `onSend` payload. A Workspace panel mounting it
  needs no edit.
- **`Step` is no longer exported** from `@/pages/Support`. If anything over
  there imported it, it is gone; the one-step-at-a-time card has no use for a
  numbered rail. `Tiles`, `topics`, `statusLook` and `lookOf` are unchanged.
- **The order of the steps changed**: about, what happened, device, you. It
  used to open on "who you are", which is the part Kobblon already knows and
  the part that is optional. If you screenshot or document this flow, it is
  four different screens now.
- The last step ticks green only once it has been reached, and amber is kept
  for the one thing on the form that can actually be wrong rather than
  unanswered: an email that does not parse or two that do not match.

### `RowCard` - the violation popup

Same three shapes as Settings, Account standing and Support: a head, groups of
rows, an action bar. The verdict, the date and whether it is still on are in a
tinted head - red while it is on, blue once it has been taken back - and the
facts are now `Line`s from `@/components/settings/Panel`, so "Who decided it /
Kobby" is drawn by the same code as "Username / @staw". The reason is
left-aligned rather than centred, because it runs to a paragraph on a bad day.

Two things that matter to you:

- **The appeal bar no longer scrolls away.** "Appeal this", "Close" and
  "Open on its own page" are in the Dialog's footer. On a long record the
  appeal button used to be below the fold, which is exactly where somebody
  who wants to appeal cannot find it.
- **A `<Link>` was in there and is now a plain `<a href>`.** That was the
  fourth instance of the bug that has taken a Workspace panel down three
  times: this card is mounted by your panels, which have no router, and a
  `<Link>` outside one throws. If you mount `RowCard` today, it would have
  blanked the panel the moment a row with a `violation_id` opened. Fixed
  here; nothing for you to do but know it was real.

### Where to look at them

`tools/site/popups-preview.html?v=ticket|live|void|warn` mounts both cards
with **no router, no auth provider and no toast provider**, which is how you
mount them. If either throws there, your panel goes blank instead. Both were
walked through end to end in a browser against the built source.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and forty-two

Staw: "now the same for the report popup card", and "i want you to look at the
entire website and polish it, so it looks better, theres less bugs, and it
looks less AI-generated but human-written".

### `ReportDialog` redrawn, and two things in it that were wrong

Same head-plus-groups shape as Contact us and the violation card. It was the
oldest card on the platform - native radio inputs with `accent-[#1B34E8]`
typed into the class list, no icons, and its own copy of the tile picker.

Two of them were behaviour, not paint, and if you mount this card they matter:

- **It opened with "Harassment or bullying" already selected.** Press Send
  without reading and you had accused somebody of harassment. It starts on
  nothing now and Send is off until a reason is picked.
- **Signed out, Send did nothing.** `if (!profile) return`, no error, no
  toast. The card now says why before anything is typed, and the button is
  disabled rather than inert.
- It also reset nothing between openings, so reporting a second thing began
  pre-filled with what was said about the first.

It now uses `useMaybeAuth`, not `useAuth`, so it no longer throws when you
mount it without an `AuthProvider` - but with no provider it has no profile
and will show its signed-out state. If you want it to send under your own
session, say so and it takes a `reporterId`; it does not take one today.

### `Tiles` moved

`@/components/ui/Tiles` is where the tile picker lives now. `@/pages/Support`
re-exports it, so an existing import keeps working. It gained `columns`: pass
`2` where the labels are sentences.

### `Dialog` skips a field on open

A field marked `data-nofocus` is not what the card focuses when it opens. The
report card's only box is the optional one, and focusing it put the cursor
past the question being asked.

### Bugs found and fixed while going over the site

- **Null arrays white-screened Account standing.** `blocks` and `channels` are
  arrays in the type and nullable in the schema, and `null.length` took the
  whole page down - the page a suspended person is sent to. Guarded in
  `Standing`, `StandingItem`, and `rowTitle` in `@/components/social/standing`.
  If you read those columns, guard them too.
- **Both shelves drew arrows that scrolled nothing.** The scroll logic is now
  `@/hooks/useRail`, used by `@/components/worlds/Shelf` and Home's row: the
  arrows appear only when there is somewhere to go and each one dims at its
  end. If you mount `Shelf`, this is the only change to it.
- Home's "Being played right now" drew a heading, an empty scroller and then
  a card underneath saying the shelf was empty. `Row` takes an `empty` now.
- `/download` had a header with one grey "Discover" link in it and no way to
  sign in - a dead end for a stranger who followed Download off the front
  page. It carries the same `PUBLIC_LINKS` as every other public bar, which
  is now exported from `@/components/layout/PublicLayout`.
- Nine HTML entities (`&apos;`, `&rsquo;`, one `&mdash;`) replaced with plain
  text. The em dash was the only one on the platform.
- `text-[#b9c3ff]` in two places: a hardcoded pale blue on a themed
  background, so it would have been unreadable in light mode. Both are
  `text-link` now.
- Kobby on the sign-in card sat half behind it, and since he is drawn as
  separate pieces, half of him reads as stray blue shapes. Raised.

### `tools/shots/` is checked in

`node tools/shots/shoot.mjs <out-dir> [name=/route ...]` serves `dist/`, stubs
the database, and shoots every page at 1440 and 390. It had been rewritten
from memory three rounds running, so it is in the repository now with the two
traps written down in it: Playwright's **last** matching route wins, so the
specific stubs sit below the catch-all; and the boot splash covers the page
for `REVEAL_MS`, so a shot taken early is a logomark on black. It also prints
anything that threw - which is how the Account standing crash above was found.

Nothing in it is of use to you directly, but if you ever ask "was this
screenshotted", the answer is now a command.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and forty-three

Staw, with four reference shots (Discord, Polytoria, Roblox): "for report cards i want cool stuff with animations, and sliding stuff, and like a mix of polytoria report cards, roblox report cards and discord report cards".

### `ReportDialog` is three steps now

One question at a time, and the steps slide.

- **Step one, what happened.** Seven rows, each with an icon, a sentence saying what it covers, and a chevron. They stagger in. Discord's shape: the answer here picks the next list.
- **Step two, which of these.** Four narrower options per reason, plus "None of these, exactly". `Something else` has none, so it skips straight to step three and Back from there returns to step one, not to an empty question.
- **Step three, check it over.** The thing being reported stays on the card (Roblox keeps it in front of you the whole way), the two answers are listed and each one is a button back to the step that set it, then the optional box and Send. Polytoria's last screen: the press that sends is the only one that sends.

The head carries three named segments rather than a bare progress bar, so it says where you are, not only how far.

### What this means if you mount it

- **Its props have not changed.** `open`, `onClose`, `targetType`, `targetId`, `targetName`. Nothing to change on your side.
- **The second answer rides on the details.** `reports` has a `reason` and a free-text `details`, and no column for a sub-reason. The chosen phrase becomes the first line of `details`, with anything typed under it. `reason` is still one of the same seven values - `harassment`, `spam`, `sexual`, `violence`, `impersonation`, `illegal`, `other` - so anything you read off that column keeps working. If you would rather it were its own column, say so and it becomes a migration rather than a convention.
- It still uses `useMaybeAuth`, so it does not throw without a provider, and still shows its signed-out state when there is no profile.

### Two animations in the preset, not one

`design/preset.js` gained `animate-step-next` and `animate-step-back` (240ms, the house easing). A step going forward enters from the right and a step going back from the left. One animation for both directions reads as a stack of screens instead of a place you are moving around in, and the Back button stops feeling like back - worth knowing if you build anything stepped in the Workspace, because these two are now the platform's answer for it.

The entry animation only runs because the step wrapper is keyed on the step number: without the key React patches the markup in place and nothing moves.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and forty-four

Staw, carrying a suggestion from imCooki3 on the Discord: "i want a brix leaderboard so we can see the richest player on kobblon. like most spent, most brix currently, and brix networth (not account progress)". Then, while this was being built: "actually for the leaderboards i was kinda thinking we could make more than just brix leaderboard, and put all the leaderboards together [...] world visits per user, catalog item sales, marketplace assets created, and worlds with the most likes [...] for each leaderboard theres a switch for players and communities". And: a redesign of all four Brix pages, no more "Spend Brix", the daily claim shown as a normal quest, and a blue dot when there are new quests.

### Migration 0274 - the boards

Three reads, all `security definer`, all granted to `authenticated` and `anon`:

- **`leaderboard(board text, side text)`** - one board of accounts, fifty rows. `board` is one of `brix`, `spent`, `worth`, `visits`, `sales`, `assets`; `side` is `players` or `communities`, and anything else raises. Every row is the same shape whatever it is a board of: `place, kind ('player'|'community'), subject_id, content_id, name, handle, image_url, is_verified, amount`.
- **`world_leaderboard(board text)`** - `likes` or `visits`. A board *of Worlds*, so the row is a World with its cover and its owner's name: `place, world_id, content_id, slug, name, cover_url, owner_name, owner_username, owner_verified, amount`.
- **`person_places(who uuid default auth.uid())`** - what one account has on each of the six player boards and where that puts them: `board, amount, place, of_how_many`. `place` is null where they have nothing on that board. It takes a person because the profile shows somebody else's.

`everybody_at(text)` is the inside of the last two and is explicitly **revoked** from `authenticated`, `anon` and `public`: it is every account's number on a board with no limit, which is not a page's to ask for.

**Two sides are deliberately empty, and the page says so rather than drawing an empty board.** A World belongs to a person - nothing in the schema lets a Community own one - so neither World board has a Communities side. And `worth` on the Communities side would be a second copy of `brix`, since a Community has funds and owns no avatar items. If Worlds should be ownable by a Community, that is a schema change and the boards follow it for free.

**What this makes public.** `pixel_transactions` is still readable only by the person it belongs to and that policy has not changed. But a total built from it is a disclosure that cannot be taken back: "most spent" says roughly how much the top accounts have put through the economy. Fifty rows, one total per row, no movement, date or reason ever exposed, and guests, suspended accounts and accounts on their way out are left off. Said plainly here because it is a decision rather than an implementation detail.

Checked locally, applied twice, under two identities: the three Brix boards rank correctly, a suspended account with the highest balance is absent, a Community's funds and outgoings rank on the Communities side, `visits` on that side returns nothing, the World boards rank by `like_count` and `visit_count`, a bad side raises, `person_places` reads correctly as yourself and for somebody else, and `everybody_at` is refused as `authenticated`.

### `quest_board()` gained a last column

`created_at timestamptz`, at the end. Everything before it is unchanged and in the same order, so anything already reading the board keeps working - **but the function was dropped and recreated**, so if you have a typed wrapper over it, add the column.

It is there because nothing could tell a quest that went up this morning from one that has been there a fortnight, which is exactly what the new-quest dot is.

### The four Brix pages are one place now

`/quests`, `/leaderboards`, `/brix`, `/brix/codes` share a shell: the same header, the same balance, and a rail across the four with a measured underline that slides between them. **`/brix/leaderboard` does not exist; the route is `/leaderboards`.**

- **"Spend Brix" is gone** from the balance menu. It went to the Style shop, which is one of several places Brix are spent and not the obvious one. Leaderboards took its place.
- The daily claim is **a quest card like any other** now, built client-side as a `claim` quest with `id: 'daily'` - still claimed through `claim_daily`, still reset by the server's midnight. If you draw quests anywhere, note that the id `daily` is not a row in `quests`.
- **A blue dot** marks new quests on the balance and on the Quests tab: quests whose `created_at` is later than the last time this account opened the board, remembered per account in `localStorage`. Opening the board puts it out. On the top bar it carries a ring of the bar's own colour, because a blue dot on a blue bar is a dot nobody sees.
- Transactions gained totals and a day-by-day line of what came in against what went out.

### Six movements had no words

`code`, `item_edit`, `gift_sent`, `gift_received`, `quest` and `quest_tag` were all in the ledger with nothing in `@/lib/kinds`' movement words, so a quest reward read as "quest" and a tag as "quest tag" - the database's own column name, shown to the person who earned it. All six have words now. **If you show a movement anywhere, take the new words.**

### On a profile

`@/components/social/Places` draws World visits, catalog sales and assets made, with the place where there is one, from the same `person_places`. The money boards are deliberately **not** on profiles: fifty accounts on a leaderboard is something somebody went looking for; the same number beside everybody's face is every account's wallet on their profile.

### Icons

Staw: "we do have an icon for brix so it should be used". The three money boards and the shell's kicker draw the mark itself, not a Font Awesome coin.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and forty-five

Staw: "we also have our own quest svg icon bruh use it, and for worlds, the world svg icon should be this image (use a colour overlay ofc), and for assets its the second one".

### Two drawings added, and both are site-wide

`public/icons/ui/world.png` and `public/icons/ui/assets.png` - his globe and his three shapes. `UI_ICONS` in `@/components/brand/Icon` carries `world` and `assets`, so `<Icon name="world" tone="..." />` works the same way the mark and the laurel do, painted as a mask so it takes whatever colour the row it is in is.

They are not only on the new pages. `@/components/brand/Glyph`'s table now maps:

- `earth-europe` → `world`. That is `worldIcon` from `@/lib/naming`, the mark a World wears everywhere, so every place that draws a World gets his drawing without being touched.
- `shapes` → `assets`. That is what the Creator Marketplace is drawn with - the rail, search, Create - so the same holds there.

The quest laurel was already in the set and is asked for by name (`ours: 'laurel-quest'`), because it is never mapped from a Font Awesome glyph: it went on every trophy and medal the last time it was.

**If you draw a World or an asset in the Workspace or the Launcher, take these two.** Note `workspace/world` is a different picture for a different job - that one is a node in a tree - and it is untouched.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and forty-six - the Brix pages, with the words taken out

Staw, on the four pages Round one hundred and forty-four shipped: "i wanted
something way more simpler, less text, less blah blah, more visual thing, and
still separated pages but uniformized by their design."

So this round removes copy and nothing else. No signature changed, no RPC
changed, no migration. Four pages are still four pages and still mount on
`BrixShell`.

### What changed, for anything that copies these

- **`BrixShell`'s `lead` is now optional.** It was `lead: ReactNode`
  (required); it is `lead?: ReactNode` and the paragraph is only rendered
  when there is one. Quests, My transactions, Leaderboards and Redeem a code
  now pass none. A copy of the shell on your side that still requires it
  will not break, but a page passing nothing is now the normal case.
- **`Leaderboards`' board table no longer has a `lead` field.** If the
  Workspace reads that table for anything, the field is gone - `value`,
  `label`, `icon`, `ours`, `unit`, `sides` are what is left. The board's
  name is now the whole heading.
- A board with one side used to explain itself in a paragraph; it now shows
  a small chip ("Players only", or "Worlds") with the reason on its
  `title`. The reason is unchanged and still true: a World belongs to a
  person, and a Community owns no avatar items.
- "Where you stand" is now the place as a number - `#9` with `of 214`
  under it - rather than a sentence.
- Gone entirely: the leaderboards footer about who is left off, the note on
  My transactions that Brix are not money, the Quests note about how time
  in a World is counted, and the block on Redeem a code about where codes
  come from. **Nothing about the behaviour they described changed.** Guests,
  suspended accounts and accounts on their way out are still off every
  board; the ledger behind the money boards is still private to its
  account; time is still counted by Kobblon from the session the Launcher
  keeps open, and still cannot be added to by the Launcher or the player.
  If the Workspace says any of that anywhere, keep saying it - the website
  stopped saying it on these four pages, which is a copy decision, not a
  rule change.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and forty-seven - the redeem page, the podium, and a copy pass

Three things Staw asked for: the redeem page in the shape Roblox's own has
but simpler, a new top three and list on the leaderboards, and the website
being less wordy everywhere.

### Redeem a code

Rebuilt around the reference's layout. The box on the left is the whole
form - label, input, Redeem, one line of small print with Terms and Privacy,
and your balance under it where the reference puts its credit. The right
column is a list of links ("Earn more from quests", "See where you stand",
"Your transactions", "A code would not take") and one art card. The cards
with copy on them are gone.

Nothing about redeeming changed: `redeem_code` is the same RPC, the database
still decides whether a code is real, still going, already had, and what it
is worth, and the page still just says what came back.

### The leaderboards' top three

The three cards became a podium: the three stand on blocks of different
heights, first in the middle and tallest, and the place is a medal disc on
the avatar rather than the word "First" written out. On a phone there is no
podium - they stack in placing order, which is the only thing that fits.

The rows below changed too: the proportion bar used to fill the row from the
left and read as a highlight on whoever was near the top; it is a two-pixel
rule along the bottom of the row now, and the place sits in a chip.

Both are presentation. `leaderboard`, `world_leaderboard` and `person_places`
are untouched, and so are their columns.

### Less copy, site-wide

A pass over the pages people browse, cutting leads, empty states, hints and
notes to one short line: People, Communities, Landing, Auth, Create (uploads,
Worlds, ads, the hub), Download, Settings, the asset page's listing-fee note
and the catalog item's. **Facts were kept, wording was cut.** The listing fee
still names the fee, the quarter back, what you keep and Kobblon's share;
Settings still says fifteen and over and that a report is never shown to the
person reported; the delete dialog still says it cannot be undone.

Deliberately left alone: the policies, the guidelines, Support and the
standing pages. Those are read once, when something has gone wrong, and
short copy there is worse than long copy.

If the Workspace carries any of this text, it does not have to follow - none
of it was a rule change.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and forty-eight - the redeem box is the page

Staw: drop the Kobby card, make the box itself the middle of the page with
the letters spaced the way a code is written, the agreement line under it,
and the questions beside it. And no sample code printed in the field - a
real one in a placeholder is a code given away.

- The redeem box is a tall panel, centred, taking most of the page: gift
  disc, "Enter your code", one field at `tracking-[0.35em]` in uppercase
  mono that upper-cases what you type, a full-width Redeem, and the answer
  (the amount counting up, or the refusal) under it.
- The placeholder is six dashes, not a code.
- Under the button: by redeeming you agree to the Terms of Use, the
  **{currency} policy** (`/policies/money`) and the community guidelines,
  and one go per account.
- Beside it: a five-question FAQ in `<details>` rows, and the balance.
  Every answer is something the site actually does - where codes come from,
  one per account, why one is refused, that the amount lands on the
  balance and on your transactions, and that nobody will ask for your
  password for one.
- Gone: the Kobby "codes turn up at events" card and the Elsewhere list.

Still just `redeem_code`. The database decides real, still going, already
had, and what it is worth; the page types it and reports back.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and forty-nine - what a code is

**A code's shape is now settled, and this one matters for anything that
takes a code on your side.** Staw: codes are always written like
`welcome26` or `spookytreat5` - lower case letters and digits, no capitals,
no spaces, nothing else, for ever.

The field enforces it as you type rather than letting the database refuse
you afterwards: `said.toLowerCase().replace(/[^a-z0-9]/g, '')`. If the
Workspace or the Launcher ever has a code box, do the same thing - somebody
pasting `WELCOME26 ` should not be told no.

Everything else this round is the page:

- The balance card beside the box is gone. It was the third place on one
  screen saying the same number, after the topbar and the page header.
- No icon on the Redeem button.
- The panel is polished: the pixel wash behind it, a lit gift disc, a
  taller field with a focus glow, and a taller button.
- "Questions" is "Frequently asked questions", the rows have a chevron in
  a disc that turns and lights up, and the open row is tinted.
- Six answers now, Staw's own information rephrased. The new facts in
  them: most codes go out in the **#codes channel on the Kobblon Discord**,
  and a code is lower case letters and numbers. No invite link is printed -
  there is none in this repository to print.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and fifty - the Brix pages stop moving

Staw: the four Brix pages have too much animation next to the rest of the
site, which has none. He is right - Catalog, People, Communities, Discover,
Library and Home contain not one `animate-` class between them, so these
four read as a different product.

Taken out:

- `BrixShell`: the header and the page no longer slide up on arrival, and
  **the balance no longer counts up** - `useCountUp` is deleted, not
  disabled. The number is just the number.
- The new-quest dot keeps the dot and loses the pulsing ring around it.
- Leaderboards: the podium and the rows no longer fly in with staggered
  delays, and the heading and board no longer slide when you change board.
- The FAQ answer no longer slides in.

Left in, and the only animation on the four: the reward card when a code
takes, and the refusal when it does not. That one is a response to
something you did, not page furniture.

The `step-next`, `step-back`, `row-in`, `slide-up` and `pulse-ring`
keyframes all still exist in `design/preset.js` and are still used
elsewhere - nothing was removed from the design system, so a copy of it on
your side needs no change. This was a decision about where to use them.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and fifty-one - a foot for the whole site, and one bar for the About side

Staw named the three kinds of page this website has, which is worth having
written down because the applications sit against the third kind:

1. **The signed-in pages** - home, People, Friends, the Brix pages.
2. **The About pages** - the landing page, the policies, and the wiki, the
   about page, the forum and the newsroom he wants later. These exist to
   show the world what Kobblon is.
3. **The sign-in pages for the applications** - `/creator/sign-in`,
   `/launcher/sign-in`. Yours. Untouched by any of this.

### The new footer

Staw's shape, inspired by Polytoria's without copying it. Left: the landing
lockup (`/brand/landing-lockup.png`, the wordmark with "The game built by
players" under it) and `© 2026 Kobblon`. Then three columns:

- **Kobblon** - the pages of the product a stranger can reach: Play,
  Create, Communities, People, Download.
- **About** - What Kobblon is, Support, The rules, Terms of Use, Privacy,
  Community guidelines, Your standing.
- **Social** - **Discord: `https://discord.gg/SsjvR6rmez`** and **YouTube:
  `https://www.youtube.com/channel/UCjFPtUjIY7mDFFOv-LuB7hQ`**, with the
  Font Awesome brand marks. If the Workspace or the Launcher ever shows
  "join the Discord", that is the invite to use.

A Reddit is coming and is not in yet; the wiki, newsroom and forum are not
either. Nothing links to a page nobody has built.

### One bar for the About side

`@/components/layout/AboutNav` - wordmark, then What Kobblon is / Download /
The rules / Support, then Log in and Sign up. The policies hub, every policy
page (`StoryPage`) and Download had three different headers between them;
they share this one now, and all three end on the new footer.

### Not done, and said plainly

**The landing page itself is not redesigned yet.** It has the new footer and
it is in the same family, but the page is still the old five-section one
Staw called a mess. That is the next round, and it wants decisions rather
than code: what the front page should claim, in what order, and which of the
wiki, about page, forum and newsroom are actually being built.

### Still open

- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and fifty-two - the footer's mark

Staw picked the first of the two options for the footer's left column: the
wordmark as type with **The game built by players** under it and the
copyright under that, rather than the drawn `landing-lockup.png`.

It is `<Wordmark always />` from `@/components/brand/Wordmark`, so it stays
sharp at any size and follows the theme, which a flat picture of a lockup
cannot. The lockup image is untouched and still used on the landing page.

### Still open

- The landing page redesign, waiting on what the front page should claim
  and which About pages are actually being built.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and fifty-three - the footer, polished

Staw: polish it, and take the "Kobblon is for people aged 15 and over" line
off the bottom.

- That line is gone from the footer. **It is still said where it belongs**:
  in Settings, and in the Terms, which the About column links to. It was a
  sentence at the bottom of every page, which is where a rule goes to be
  ignored.
- Column headings are small, spaced capitals rather than white headings
  shouting beside the wordmark.
- The two social links are chips with the mark in a disc that lights blue
  on hover, instead of a bare list that looked like the other columns.
- One brand hairline fades across the top of the whole footer; the bottom
  rule and its row are gone with the age line.
- The columns are two across on a tablet rather than four squeezed, and the
  whole thing breathes more.

### Still open

- The landing page redesign, waiting on what the front page should claim
  and which About pages are actually being built.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.
- Worlds cannot belong to a Community, which is the only reason two boards have one side.

## Round one hundred and fifty-four - the About side gets a shell, and a page of its own

Two things. First, the footer's social links are a plain list again with the
mark inline - Staw did not want chips with the mark in a disc.

### `AboutShell`

`@/components/layout/AboutShell` is the About side's chrome, once: the pixel
wash, the light at the top, `AboutNav`, the hero (eyebrow, title, lead,
actions) and `SiteFooter`. It forces dark, because these pages are what
Kobblon looks like to somebody who has never had the chance to pick a theme.

The policies hub and Download each drew that background and those gradients
themselves; they are on the shell now and are shorter for it. The policy
pages (`StoryPage`) still draw their own - they have a contents rail and a
different rhythm, and moving them is the next job rather than a rushed one.

### `/about` - "What Kobblon is"

A new page, and the first one built for the About side rather than inherited.
It says what the platform is to a stranger: the four things you can do here
(Worlds, building and the marketplace, Communities, the avatar and Catalog),
the three pieces it runs on (**the website, the Launcher, Creator** - your
two, named and described), what {currency} are and are not, that the rules
are written down and arguable, and a sign-up at the end.

**Everything on it is something the platform does today.** The numbers come
from `platform_stats`; there is no roadmap on the page, and nothing is
claimed that is not built.

`AboutNav` and the footer now point "What Kobblon is" at `/about` rather
than at the landing page.

### Still open

- The landing page is still the old one.
- `StoryPage` has not moved onto the shell.
- The wiki, the forum and the newsroom are ideas; nothing links to them.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.


## Round one hundred and fifty-five - the footer hovers blue

Every link in the footer goes to `brand-bright` on hover, not white - the
column links, the social links, and the Discord and YouTube marks with
them. Kobblue is the hover colour down there.

### Still open

- The landing page is still the old one.
- `StoryPage` has not moved onto `AboutShell`.
- The wiki, the forum and the newsroom are ideas; nothing links to them.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and fifty-six - the About side has its own design system

The About pages - what Kobblon is, Download, the rules, every policy -
were the signed-in design with the rail taken off: one narrow column,
everything in a rounded card, every card the same size. That reads as a
settings page, and these are the only pages somebody sees before they
decide whether Kobblon is worth an account. They are rebuilt from
scratch, as their own system rather than as a variation on the
application's.

### What the system is

`src/components/about/` is new and is the whole of it:

- **`Band`** - the unit of an About page. Full width of the window, owns
  its background, holds one idea. Four tones that mean something rather
  than being a palette: `night` (the floor), `raised` (a change of
  subject), `brand` (the one band per page that asks for something),
  `clear` (over the hero's wash). A band never sits inside another band.
  `Lane` is the one measure everything lines up to.
- **`Reveal`** - the one motion gesture. Sixteen pixels up and a fade, as
  a band comes into view, staggered by about seventy milliseconds down a
  row. Fires once. Reduced motion gets the end state and no transition.
- **`Figure`** and **`Character`** - the one way a picture is framed, and
  the one way a character is not: a cut-out with a pool of light under it,
  because a drawing in a rounded border stops being a character and
  becomes a thumbnail of one.
- **`Tally`** - a platform number that counts up the first time it is
  seen, on a quartic ease-out.
- **`PixelGrid`** - the pixel motif as two repeating gradients, for the
  corners of cards. `PixelField` is a canvas and stays where it earns
  that: the top of the page, one per page.
- **`Hero`** and **`Type`** (`Eyebrow`, `Title`, `Lead`, `BandHead`) - one
  opening and three sizes of type, instead of the five headings four
  pages had between them.

`AboutShell` now owns the chrome and nothing else - the bar, the wash at
the top, the foot. It no longer imposes the page's measure, which is what
made every About page the same narrow column. `AboutNav` sticks, so the
sign-up button is still there four bands down a page whose job is to get
somebody to sign up; it is transparent over the hero and frosts as soon
as the page moves.

### What it means for the applications

Nothing changes in anything shared. `design/preset.js` is untouched - no
new colour, no new animation, no new token. The whole system is built out
of what the preset already has, which is the point: if the About side had
needed a colour Kobblon does not have, that would have been a sign the
design was wrong rather than a reason to add one.

`src/components/about/*` is website chrome, not a shared component. An
application has no use for a Band. Nothing there is mounted in
`tools/site/`, and nothing there should be imported by the Workspace or
the Launcher.

One thing is worth copying rather than importing, if either application
ever grows a page like these: the rule that there is **one** motion
gesture. Six different animations on one page is how a build stops
looking built and starts looking decorated.

### The icons

Staw: "stop using different svg icons for stuff that we already have
like for quests we already have quest icons images". The About pages were
reaching for Font Awesome shapes for things he has drawn. They ask for
his by name now - `world` for a World, `assets` for the marketplace,
`people` for a Community, `avatar` for an avatar, `laurel-quest` for a
quest, the Brix mark for Brix. Font Awesome is left for the one or two
ideas there is no drawing of yet.

**This applies on both sides.** `Glyph` already swaps a Font Awesome name
for ours where there is one, so most call sites are already right; the
ones to check are the places that chose a glyph because it *looked* like
the thing. A laurel is a quest, not a trophy. A filled star means
somebody pressed it.

### The mascot

The character with the hammer (`/brand/under_construction.png`) carries
the Download page and the band on the About page that says what is not
finished. Nothing from the Kobby set is used anywhere on this side -
Staw is replacing that art, so building a page around it would be
building a page that has to be rebuilt.

### Still open

- **The landing page is still the old one.** It is in this family and it
  is next; Staw has said so twice. It is not done here because it is the
  one page with a job the others do not have.
- The wiki, the forum and the newsroom are ideas. Nothing links to them,
  and the forum, if it happens, is to be inspired by Discourse rather
  than by anything on the site today.
- Support and the standing page have not moved onto the new system yet.
  They are long, they work, and they are honest; they are a later pass.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and fifty-seven - the About page is a pitch now

The system from the last round was right and the page written on it was
not. Staw: "it looks like a ChatGPT answer" - four tiles of three
sentences each, a heading that asked a question, and a band that
apologised for what is not finished yet. That is a manual, not a pitch,
and this is the only page somebody reads before deciding whether Kobblon
is worth an account.

It follows the shape a company's own film follows now. One claim per
band, a sentence at a time, each standing next to the thing it is about:
what Kobblon is, the numbers, Worlds, the three things underneath,
Communities, the three pieces, the rules. Nothing on it is a list.
Nothing on it is three sentences where one will do.

### What this means for anything you write

Two rules came out of it that are worth carrying into the applications'
own copy:

- **The old slogan is dead.** "Make Something Nobody Else Has" is gone
  from the About side, including from every policy page, which was
  printing it under the title. The slogan is **The game built by
  players**, which is what the footer says. If either application still
  has the old one in a splash, an installer or an about box, it is wrong.
- **The About pages and the landing page must not say the same thing.**
  The landing page shows you the site; the About page says what the site
  *is*. The same sentence in both is a sentence doing nothing in one of
  them.

### The three renders

Staw drew three glass pieces - shapes, bricks, a laurel - and they are in
`public/about/` as `marketplace.png`, `brix.png` and `quests.png`. They
carry the band about what runs underneath: the Marketplace, Brix and
Quests, one card each, picture bleeding into the card rather than framed
in it (`Plate`, new, in `src/components/about/`).

They are About-side art and the applications have no call on them. The
laurel there is the same idea as the `laurel-quest` icon, not a
replacement for it: a quest in an interface is still the icon.

### Still open

- The landing page is next, and it is the one that has to not repeat this
  one.
- The wiki, the forum and the newsroom are ideas; the forum, if it
  happens, takes after Discourse.
- Support and the standing page have not moved onto the new system.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and fifty-eight - the About page, said in one line

Still too wordy after the last round. It is cut to the bone now: a band
is a heading, one line under it, and the way in. If a second sentence is
needed to make the first one land, the first one is wrong.

The page opens with Staw's own sentence, which is the official line on
what this is and the one to use anywhere either application has to
describe Kobblon:

> Kobblon is an online sandbox platform filled with user-generated 3D
> worlds, where players can unleash their creativity, build unique
> experiences, and hang out together.

The bands after it: the numbers, Worlds ("Find somewhere to be"), Creator
("Build anything you can imagine"), Inside Kobblon (Marketplace, Brix,
Quests), Communities ("Hang out together"), the rules. The "three pieces,
one account" band is gone - it was a manual entry, and the Launcher has a
page of its own in the bar.

### Two details worth carrying

- **The three glass renders keep the ratio Staw drew them at.** They were
  being cropped to make three cards the same height, which crops a
  composition - the laurel is centred in its frame and the bricks fall
  through theirs. A card is as tall as its picture now. Same rule applies
  to his art in either application.
- Text-only bands are all left-aligned, so there is one edge to follow
  down the page. Only a band with a picture swaps sides.

### Still open

- The landing page is next, and it must not repeat this page.
- The wiki, the forum and the newsroom are ideas; the forum, if it
  happens, takes after Discourse.
- Support and the standing page have not moved onto the new system.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and fifty-nine - At Kobblon, and the page has depth

Two things from Staw.

### They are the At Kobblon pages

The family has a name now: **At Kobblon**. What Kobblon is, the Launcher,
the rules, every policy, Support and standing are the At Kobblon pages,
and their tabs say so - "What Kobblon is - At Kobblon". `AT_KOBBLON` is
exported from `@/hooks/useTitle` and is the only place the name is
written.

It is a name for the family and a tab, not a move. The addresses stay
exactly where they are: renaming `/about` would break every link anybody
has sent. The components are still `AboutShell` and `AboutNav` for the
same reason - a rename of those is churn in forty imports for no gain,
and the comment at the top of each says what the family is called.

**If either application has a window, an about box or a help link that
names this part of the site, it is "At Kobblon".**

The landing page's tab is still plain "Kobblon". A front page titled "At
Kobblon" reads worse than one titled with the product, and the landing
page is the next thing being rebuilt, so that is the moment to settle its
name rather than now.

### Parallax

`Parallax`, new in `src/components/about/`, is the second half of the
motion on this side: `Reveal` is how a thing arrives, this is what it
does once it is here. The pictures drift against the words as the page
scrolls, so the page has a back and a front.

Three rules it keeps, and they are the difference between depth and a
page that slides apart:

- **Small.** `strength` is pixels travelled per screen of scrolling; the
  hero's picture is seventy-two and the cards are in the twenties.
  Parallax you notice is parallax that is too strong.
- **Measured from the middle of the window,** so the drift is zero when
  the picture is centred - what you are looking at is never the thing
  furthest from where it belongs.
- **Parked off screen.** An observer adds and removes the scroll
  listener, because four of these reading `getBoundingClientRect` on
  every scroll event of a four-thousand-pixel page is a fan starting up.

Reduced motion gets no transform at all.

Nothing drifts *inside* a frame. A parallax under an `overflow-hidden`
edge has to zoom or crop the picture to cover the travel, and Staw's
three glass renders keep the ratio he drew them at - so the card drifts
and the picture sits still in it. Three different rates across the three
cards, because identical parallax on a row of cards is a row moving as
one object.

### Still open

- The landing page, including what its tab says.
- The wiki, the forum and the newsroom are ideas; the forum, if it
  happens, takes after Discourse.
- Support and standing carry the At Kobblon tab but have not moved onto
  the new shell yet.
- Round 133's five Launcher questions, `kobblon://edit/<id>` included.

## Round one hundred and sixty

The At Kobblon page in Staw's own order, and two new shared pieces.

What changed here, in the order somebody scrolling meets it:

- **The opening** is a World somebody built, behind a single line, and the
  line arrives on the way down rather than on load. That needed a second
  motion component, because `Reveal` cannot do it: `Reveal` fires when a
  thing enters the window, and the first screen is already in the window
  when the page loads, so a headline up there has finished arriving before
  anybody touches the wheel. `@/components/about/ScrollIn` is keyed to
  `window.scrollY` instead - out at rest, fully in after about a third of a
  screen. Reduced motion gets the finished state and no listener.
- **The paragraph** is the official sentence and nothing else: "Kobblon is
  an online sandbox platform filled with user-generated 3D worlds, where
  players can unleash their creativity, build unique experiences, and hang
  out together." That is the wording to use anywhere the applications
  describe the platform. Verbatim.
- **The numbers** are four `StatTile`s counting up on arrival, still wired
  to `get_platform_stats`. The rule under each one is decorative and says
  so in a comment: there is no honest maximum for "visits", so it is not a
  bar and must not be read as one.
- **Then** Worlds, the four safety things, Workspace, Inside Kobblon,
  Communities, Policies, and an honest "the newsroom is being built" panel.
  No invented posts.

New shared components, both mountable with nothing around them:

- **`@/components/about/GlassCard`** - a render with the words laid over
  the **top** of it, no aspect box, so a picture keeps the ratio it was
  drawn at. Props: `art`, `alt`, `name`, `body`, `to`, `cue`.
- **`@/components/about/Floaters`** - reaction faces bobbing in a band's
  gutters, `hidden lg:block`, pointer-events off, still under reduced
  motion. It goes in `Band`'s new `decor` slot, which renders **outside**
  `Lane`: anything positioned `inset-0` inside `Band`'s children is
  positioned against the text column, not the band, which is how the first
  version of these ended up sitting on top of a heading.

Two things that change meaning rather than appearance, so they matter on
your side:

- **`FACE_COLOUR` and `FACE_YELLOW` are now exported** from
  `@/components/social/Reactions`. If anything over there paints a reaction
  face, take the colour from there rather than writing a second yellow.
  Worth knowing why: `Icon` with no `tone` paints the file as a mask in the
  current text colour, and the reaction PNGs are white line art, so
  `tone={null}` on one gives you a white smudge and no `tone` at all gives
  you a grey one. A face that is meant to look like a face needs
  `tone={FACE_COLOUR[face]}`.
- **The At Kobblon tabs use a pipe.** `useAtTitle` in `@/hooks/useTitle`
  writes `Thing | At Kobblon`; the rest of the site keeps `useTitle` and
  `Thing - Kobblon`. Two separators on purpose, one per family. The About
  nav's third link is now called **Policies**, not "The rules".

Still not built, said plainly: the newsroom (the band is a placeholder),
the wiki, the forum. Support and Standing carry the At Kobblon tab but are
still on the old shell. The landing page redesign is next and will not
repeat this page.

## Round one hundred and sixty-one

Four more pages on the same system: Policies, Download, the landing page,
and log in / sign up. No new shared components this round - everything
below is built out of the ones Round one hundred and sixty described.

What is worth your attention:

- **The old slogan is gone from the last two places it lived.** "Make
  something nobody else has" was still the headline of the landing page's
  closing band and of the sign-up page, in both the wide and the phone
  layout. Staw: it is the **old** slogan. If anything on your side still
  carries it - a splash, an installer screen, a window title - it is wrong
  there too. What the sign-up page says instead is "One account, every
  World", and the landing page closes on "It is free, and it takes five
  minutes".
- **Nothing on these pages uses the Kobby artwork any more.** Staw is
  replacing those drawings, so the landing page's four empty states, which
  were four Kobby moods, are now one dashed panel with one sentence in it,
  and the sign-up card no longer has him leaning on the corner. The
  construction character (`/brand/under_construction.png`) is the one
  mascot still in use. Do not build anything new against `kobby_*`.
- **"The rules" is called Policies now** in the About nav, in the site
  footer, and in the Support and Settings link lists. The route is
  unchanged - `/policies`, and `/policies/:slug` for each one - so only the
  label moved. `AccountStatusCard`'s link still reads "The rules" on
  purpose: its `rulesHref` defaults to the Community Guidelines rather than
  the hub, so calling it Policies would have named the wrong document.
- **The landing page and the At Kobblon page deliberately do not say the
  same thing.** At Kobblon explains what Kobblon is; the landing page shows
  the stock - trending Worlds, the real marketplace shelf, the biggest
  Communities, the catalogue - all live. The one thing they share is the
  four platform numbers, and the landing page prints them as a thin strip
  of live readings rather than as a second set of the counting tiles.
- **The advert is on `Band` now.** `Commercial` had a `max-w-[1400px]` lane
  of its own next to the page's `max-w-6xl`, so its heading began about a
  hundred and forty pixels left of every other heading. If you lay out
  anything beside the website's sections, the measure is `Lane`:
  `max-w-6xl` with `px-5 sm:px-8`.

One thing to know if you place a `Character` yourself: it is `relative` on
its own root, and Tailwind emits `relative` **after** `absolute`, so
passing `absolute` in its `className` leaves it in the flow. It put the
builder in the middle of a band at full height instead of in the gutter.
Wrap it in an absolutely positioned div instead.

Still not built: the newsroom, the wiki, the forum. Support and Standing
carry the At Kobblon tab but are still on the old shell - they are the next
two pages on this side.

## Round one hundred and sixty-two

The opening of the What is Kobblon page is **held**, the landing page and
the door are actually on this side's design now, and a router bug that has
been there since the beginning is fixed.

- **It is called "What is Kobblon" now**, not "What Kobblon is". The nav,
  the footer, the tab and the social card. `/about` is unchanged.
- **The held opening.** `AboutShell` takes a `pin` prop: the opening
  becomes a runway that many screens tall with the words stuck to the top
  of it, so the wheel turns, the title arrives, and the page under it only
  begins to move once the runway is spent. Staw: "i want that you scroll
  down but its locked onto the topthing and when the title appears it lets
  you scroll down the website for real."

  Two things to copy if you ever do this over there. It is `position:
  sticky` and **not** catching the wheel - a page that eats scroll events
  takes the keyboard, the scrollbar, find-in-page and a trackpad fling with
  it and gives nothing back. And the trap: `overflow: hidden` on an
  ancestor makes that ancestor a scroll container, so a sticky child sticks
  inside *it* rather than inside the window. The first version had
  `overflow-hidden` on the runway and the pane tracked the scroll one for
  one; the hold did nothing, and it looked exactly like the pin was not
  implemented. The clipping lives on the pinned pane instead. Nothing is
  held for reduced motion - a screen of scrolling that moves nothing is the
  worst version of this idea, not the gentlest.
- **A new page starts at the top of itself.** `ScrollToTop` is mounted
  inside the router. A router swaps what is drawn and leaves the window
  where it was, so a footer link - as far down a page as it is possible to
  be - opened the next page at the foot of itself. Going **back** is left
  alone on purpose, because being thrown to the top of a list you were
  halfway down is the same bug wearing the other hat, and a `#hash` is left
  alone so `/policies/terms#appeals` still lands on its section.
- **The landing page is rebuilt on this side's pieces**, which is what Staw
  asked for twice: the held opening, `Band`, the type scale, `Reveal`, the
  drift, the floating faces. `Showcase` is **deleted** - if anything of
  yours imported it, it is gone; the sign-up form on the front page lives
  in `@/components/landing/JoinPanel` now, which is `SignupForm` in a card
  and handles its own "check your email" state.
- **The public top bar is dark.** `PublicLayout`'s bar was flat brand blue
  while every other page shown to a stranger had the dark one; it now goes
  clear over the opening and solid on scroll the way `AboutNav` does, and
  it keeps its links and its inline log-in. The page starts *behind* it
  (`-mt-16`) rather than below it.
- **The door is one centred column.** No photograph behind it - Staw asked
  for the towers off that page - just the pixel wash, the brand light and
  the faces. The pitch that used to sit beside the form is three cards
  under it, so a phone gets it too; before, the whole left half was
  `hidden` on a phone and the headline had to be written twice.

The landing page and the What is Kobblon page still deliberately say
different things: that one explains, this one shows the stock, and the two
headings over the same four numbers are different sentences on purpose.

Still not built: the newsroom, the wiki, the forum. Support and Standing
are the last two pages on this side still on the old shell.

## Round one hundred and sixty-three

Appearance only on the website side, but two of these change meaning for
anything that copies our words or our cards.

**The footer's second column is now "At Kobblon", and Support and Your
standing are not in it.** Staw settled what that phrase covers: the pages
where Kobblon speaks about itself (What is Kobblon, Download, Policies,
Terms, Privacy, Community guidelines). A support ticket and your own
moderation record are things you *do* here, so they moved into the
"Kobblon" column with Play, Create, Communities and People. Support was
also dropped from the At Kobblon nav bar. If the Workspace shows an
"At Kobblon" set anywhere, it is those six and not the other two.

**`GlassCard` lost its gradient scrim.** The dark wash over the picture is
gone, and the name and body now sit at the top of the card with tighter
spacing (`p-5`, `mt-1.5`, `text-sm leading-snug`) and a text-shadow instead
of a scrim. The reason is that the images on those cards are the point and
the scrim was eating them. If you mount `GlassCard` and were relying on the
scrim for contrast over a light picture, you no longer have it - the
text-shadow carries it, so pass artwork that is dark where the first three
lines land.

Also on the website, nothing you need to copy:

- What is Kobblon's section headings collapsed to one line each where the
  second line was padding. "Worlds", "Our People Come First", "Workspace",
  "Inside Kobblon", "Policies"; "Kobblon today / Counted this minute." and
  "Communities / Hang out together." keep both lines. The "All nine
  policies - each at its own address" paragraph is gone.
- Policies' headline is "Everything, written down." and it is present on
  arrival rather than scrolling in. Only What is Kobblon and the landing
  page hold their opening still now.
- Download was rebuilt plain: a hero with the builder, the three planned
  platforms marked "Not yet", and what the Launcher is for. No pin, no
  backdrop. There is still nothing to download and the page says so.
- Log in and Sign up are one centred column with one line - "Sign up and
  start building" - and the form. The three cards about what an account
  gets you are gone.

Still not built, unchanged from last round: the newsroom, the wiki, the
forum. `world_visits` is still only written by `join_world_server`, so
"Recently played" is empty for everybody.

## Round one hundred and sixty-four

One change of meaning in here, and it is one the Workspace will care about
if it ever shows something somebody wears.

**A garment's own file is never its picture.** The landing page's Catalog
shelf was drawing `catalogUrl(item.image_path)` directly, so nine shirts on
the front page were their *template sheets* - the flat unwrapped squares
with LEFT ARM and TORSO written on them, which is both not what the thing
looks like and the one file the buyer is paying for. Anything showing a
Catalog item uses `WornPicture` (`@/components/catalog/WornPicture`), which
asks `cardFor` for the saved 2D card and draws the garment on the mannequin
in the tab when there is none. `cardFor` returns **null** for a shirt,
trousers or a body part with no saved card, on purpose - do not treat that
null as "no picture, fall back to the file".

**`WorldStage` and `CommunityRow` are deleted.** If the Workspace imported
either, it now imports nothing. `WorldChart` and `CommunityWall` replace
them, in `@/components/landing/`, with the same props (`worlds`/`loading`
and `communities`/`loading`).

The rest is this side's own appearance, Staw's list on the front page:

- The landing page was rebuilt rather than restyled. His note was that it
  was "elements from multiple pages shoved together", and it was: a held
  opening copied off What is Kobblon, a whole band asking for an account,
  and three sentences of explanation over every shelf. Now the sign-up card
  is **in the opening**, beside the line, there is no second sign-up band,
  and each band is a heading and the thing itself.
- Worlds are a chart - rank in the margin, cover as a strip, name on the
  page's own floor - instead of three posters at three sizes with the name
  written over somebody's cover. Communities are cards with the emblem,
  the name, verification and the member count. Both are new components.
- The closing band is the What is Kobblon safety band (Report, Block,
  Ignore, Moderation) with Staw's signed note kept under it.
- "Shop" is **Catalog** everywhere on that page.
- A policy page is a document again: one column of reading-size type, the
  section number in the margin, a hairline between sections, and a rail
  with the reading marked on it. The nine dark boxes are gone.
- Log in and Sign up fit one desktop screen with nothing to scroll: the
  words sit beside the card from `lg` up. Below that it is one column.

Still not built, unchanged: the newsroom, the wiki, the forum.
`world_visits` is still only written by `join_world_server`, so "Recently
played" is empty for everybody.

## Round one hundred and sixty-five

**All nine policies were rewritten against the platform as it is actually
built.** This is the round to read if the Workspace or the Launcher shows,
links to, or paraphrases any rule, because almost every one of them now says
something more specific than it did.

What the applications have to match, because a copy of the old wording is
now wrong rather than merely short:

- **Words are defined once.** Clause 1 of the Terms defines Account,
  Content, World, Community, Decision, Brix and Policies, and the other
  eight documents use those words in that sense and introduce no synonyms.
  If a panel in the Workspace says "project" or "space" where the website
  says World, it now contradicts a definition rather than a habit.
- **A Decision has six forms, not five**: warning, Content removed, feature
  restricted, chat suspended, Account suspended, Account terminated. Any
  standing or sanction display should carry all six.
- **The automated system cannot terminate an Account**, and that is stated
  as a limit enforced in the database, not as practice. It may warn, remove
  Content, suspend chat and suspend an Account. Do not build an interface
  that implies otherwise.
- **Appeal windows are computed by the platform**: fifteen days ordinarily,
  one month for a termination, six months where the Account has been seen
  from an EU member state, and two attempts in total. Do not hard-code
  fifteen days anywhere.
- **An appeal can make an outcome heavier.** It is a fresh examination of
  the conduct, and the policy now says so plainly, so an appeal form must
  not describe it as a review that can only help.
- **Privacy names its processors**: Supabase, GitHub Pages, Groq (the
  inference service the screening worker calls) and Discord where linked. If
  the desktop applications send anything anywhere else, that recipient has
  to be added to that clause before the traffic starts.
- **A garment is never displayed as its template sheet**, and that is now a
  term of the Catalog policy rather than only a rendering decision.
- **Brix are stated to be not money, not electronic money, not a payment
  instrument and not redeemable**, and the policy records that no mechanism
  exists to buy them with money. If the Launcher ever offers one, that
  clause has to change before it ships.
- Fees, the platform share and the price ceilings are deliberately **not**
  quoted as numbers anywhere in the documents; they say the figure is shown
  on the form that charges it. Keep it that way on your side too.

Two smaller things on the website:

- Clauses are numbered. A paragraph is 3.5 of its document, in the margin on
  a wide screen, so support, moderation and an appeal can cite one sentence.
- Log in and Sign up are one centred column that fits a 1440 by 900 screen
  exactly, with nothing to scroll. The heading had to be written as an
  `h1` rather than as `Title level={1}`, because `cn` joins and does not
  merge: a second `text-[clamp(...)]` beside the one `Title` carries loses
  to whichever Tailwind emitted later, so the override did nothing. Same
  trap as `Character` and its `relative`. Worth knowing before you pass a
  size into any of our type components.

Still not built, unchanged: the newsroom, the wiki, the forum. `world_visits`
is still only written by `join_world_server`.

## Round one hundred and sixty-six

**A storage note now appears in the bottom left corner** of the landing page
and of every At Kobblon page - What is Kobblon, Download, Policies and all
nine policy documents. One component, `CookieNote`, mounted once in
`AboutShell` and once on the landing page, so there is exactly one wording
of it on the website.

What it says, and why it matters to you: **Kobblon sets no cookie of its
own and no tracking or advertising cookie at all.** What the website keeps
on the device is browser storage belonging to the site itself - the session
token, the accounts signed into on that device, the theme, the basket, the
identity you are creating as, and the "already shown" markers. If the
Workspace or the Launcher shows a notice of this kind, it must say the same
thing, and it must not describe a consent choice: there is nothing to
switch off, because none of it exists for anybody but the person using it.

The privacy policy has a new clause to match, **`storage` - "Storage on
your device"**, sitting between recipients and what other people can see.
It is the clause the card links to, and it is the only place the list of
stored items is written down; link there rather than restating it.

Dismissal is remembered under the key `kob.cookies.read` in `localStorage`,
and every read and write of it is wrapped, because a private window throws.
The card comes back in a private window, which is correct.

Still not built, unchanged: the newsroom, the wiki, the forum. `world_visits`
is still only written by `join_world_server`.

## Round one hundred and sixty-seven

The forum is built. Two migrations, a block of `@/lib/api`, six new types, and
four pages. It is an At Kobblon page: anybody may read it signed out, nobody
may write without an account, and every refusal is in the database rather than
in the browser.

**0275_the_forum.sql** - the tables.

- `forum_categories` - `slug` primary key, `name`, `blurb`, `kind`, `staff_only`,
  `position`, `is_hidden`. `kind` is one of `plain`, `bugs`, `suggestions`,
  `both`, and it is what decides which marks staff may put on a topic there.
  Six seeded: `announcements` (staff only), `community-creations`,
  `feedback-and-suggestions` (kind `both`), `help-and-support` (kind `bugs`),
  `building-and-scripting`, `off-topic`.
- `forum_topics` - `category`, `author_id`, `title` (6 to 140), `body` (1 to
  12000), `images text[]`, `status`, `status_by`, `status_at`, `is_pinned`,
  `is_locked`, `is_removed`, `view_count`, `reply_count`, `like_count`,
  `answer_id`, `last_post_at`, `edited_at`.
- `forum_posts` - `topic_id`, `author_id`, `body`, `images`, `reply_to`,
  `is_removed`, `like_count`, `edited_at`.
- `forum_likes` - `(target_type, target_id, user_id)`, where `target_type` is
  `topic` or `post`. `forum_topic_views` - `(topic_id, user_id)`.
- A public storage bucket named `forum`, 2 MB a file, jpeg/png/webp/gif.
  Writing is keyed on `(storage.foldername(name))[1] = auth.uid()::text`, so a
  picture goes to `<the person's id>/<name>` and nowhere else.
- Reading is open to `anon`. Writing is revoked from `anon` and `authenticated`
  on every table: everything goes through the functions below.

`status` is `open`, `solved`, `approved`, `declined` or `looked-at`. Which of
them is allowed depends on the category's `kind`: `bugs` takes `solved`;
`suggestions` takes `approved`, `declined`, `looked-at`; `both` takes all four;
`plain` takes none. Only an admin or a moderator may set one, and the server
refuses the wrong one for the category rather than trusting the caller.

**0276_what_the_forum_can_do.sql** - the functions, and three things that
already existed and now have a forum in them.

- `notifications` has a new **`link text`** column, and its kind constraint now
  accepts **`forum_reply`**. A reply notification carries `link` =
  `/forum/t/<topic id>`. If you render notifications, read `link` when it is
  there and fall back to whatever you did before when it is null.
- `chat_to_read`'s kind constraint now accepts **`forum_topic`** and
  **`forum_post`**. Every topic and every reply goes to the same screening
  queue as everything else, and the same word filter runs on both - on a
  topic's title as well as its body.
- Taking something down: a removed topic leaves the boards and is starred out;
  a removed reply is struck in place so the thread still reads.

The functions, all of them refusing a guest and a suspended account on their
own:

- `forum_may_write()` - true when this account may post.
- `forum_boards()` - the six, with `topic_count`, `post_count`, and the last
  topic's id, title, author and time.
- `forum_topics_list(in_category, in_sort, in_limit, in_offset, in_unanswered)` -
  `in_sort` is `active`, `new`, `helpful`, `viewed` or `interesting`.
  Interesting is `like_count * 3 + reply_count * 2 + view_count`.
- `forum_topic(in_id)`, `forum_replies(in_topic, …)` - replies come back with
  the marked answer first.
- `forum_topic_create(…)` - refuses a staff-only category, more than four
  pictures, and more than five topics in an hour from one account.
- `forum_reply(…)` - refuses a locked topic, bumps the count and the clock, and
  notifies the author.
- `forum_edit`, `forum_remove`, `forum_set_status`, `forum_set_flags`,
  `forum_mark_answer`, `forum_like`, `forum_seen`.

`forum_seen` counts one view per account for ever, not one per visit, so the
number means people rather than refreshes.

**What the applications get from this.** Nothing is required of you. If the
Workspace ever wants to show "what is being said about this", `forum_boards`
and `forum_topics_list` are readable with no session at all, so a panel can
call them before anybody signs in. The two constraint widenings are the only
things that could surprise you: a notification row with a kind you have never
seen, and a `chat_to_read` row likewise. If either of those is a `case` with no
`else` on your side, it needs one now.

**What is not built.** No search. No quoting. No paging - a board is the first
fifty topics and that is all, which is fine for a week-old forum and will not
be in a month. No editing window and no edit history beyond the `edited_at`
stamp. No per-category moderators: it is admin-or-moderator everywhere.

## Round one hundred and sixty-eight

Names. Three migrations, and the one that matters to you is the first.

**0277_a_name_you_had_is_still_yours.sql**

A username you retire stays yours. `username_history` has existed since
0022, but only as a record - nothing consulted it when a name was being
claimed, so a name you left was free the moment you left it.

- `username_history` now has a unique index on `lower(username)`: a retired
  name has exactly one owner. The migration resolves what the old rule
  allowed first - the same name in two histories, and a name in a history
  that somebody else is using now - by letting the newest claim win and
  deleting the rest.
- **`who_holds_name(candidate) returns uuid`** is the one question
  everything asks: null means free, otherwise whose it is. If you have any
  place that offers a name, ask this and nothing else.
- `check_username` and `change_username` both consult it. You may always
  take your own old name back, and doing so frees nothing: the name you are
  leaving goes into the history in its place.
- `handle_new_user` was the actual hole and is patched: its free-name loop
  asked `profiles` only, so an account could be opened on a retired name
  however carefully the signup form checked. It asks `who_holds_name` now.
- **One charset in one place.** `name_shape()` returns `^[A-Za-z0-9_]{3,20}$`
  and `name_shape_said()` the sentence that goes with it. The three checks
  disagreed before - `check_username` said 3 to 20, `change_username` said
  3 to 16, the column said 3 to 20 - so a sixteen-character name could be
  signed up with and never changed to. **If you validate a username
  anywhere, use these two rather than a copy of the pattern.**
- **Display names have a charset now and did not before.** The column only
  said "1 to 32 characters". It is `^[A-Za-z0-9_]{1,32}$`: no spaces, no
  hyphens. Existing rows are sanitised by the migration - disallowed
  characters are taken out, and anything left empty falls back to the
  username, which is what Kobby already does when it takes a display name
  away. **This will change display names you have cached.** A display name
  with a space in it is now a failed write, so anywhere you let somebody
  type one needs the rule or it will throw a constraint violation on save.

**0278_a_community_name_is_owned_too.sql**

The same promise for communities, with a different charset - a community
name is written, not typed into an address, so spaces and punctuation stay
and only control characters are out: `community_name_shape()` is
`^[^[:cntrl:]]{3,48}$`.

- `communities.name` is unique now, and never was. Existing duplicates get
  their content id appended; the oldest keeps the name.
  The index is partial, `where not is_removed`.
- `community_name_history`, with its grants, readable by anybody.
- **`check_community_name(candidate, for_community)`**, **`rename_community(target, new_name)`**
  (owner or admin, free), **`who_holds_community_name(candidate)`**,
  **`community_name_history_of(target)`**.
- `communities_update_own` let an owner update `name` directly, which went
  around any checking. `guard_community_name` pins it back unless
  `rename_community` raised the transaction-local flag. Its subject is the
  flag and never identity, for the reason in the third trap.
- `create_community` now checks the name before inserting, so a taken name
  is a sentence rather than a unique-constraint violation.

**0279_a_forum_post_can_be_reported.sql** - `reports.target_type` accepts
`forum_topic` and `forum_post`, and `report_subject` knows what they are.
Kobby already read every forum post (0276) and pinning already existed.

**What this means for you.** If the Workspace or the Launcher shows a
username or a display name: the display name rule is new and will reject
writes it used to accept. If either offers a name - a rename, a signup, a
community - call `check_username` or `check_community_name` and show the
reason verbatim; they are the only things that know about retired names. A
"that name is taken" from either says nothing about whose it is, on purpose.

**Also in this round, website only, for your information:**

- The GIF boot screen has **no minimum time** any more; it comes down the
  moment the page is ready. It is also no longer shown on the At Kobblon
  pages, which are decided from the address in `app.html` before a frame is
  drawn.
- The forum's entrance is Discourse's three dots in brand blue rather than
  the field of flying squares.
- Forum pages name themselves: "Community Forum | At Kobblon" at the front,
  "<name> | Kobblon Forum" inside.
- The forum composer has a toolbar, and `@/components/forum/Markup` is the
  renderer that reads those marks back. **It renders no HTML and cannot be
  made to** - there is no `dangerouslySetInnerHTML` and no sanitiser, the
  text is cut into pieces and each becomes a React element, so a post
  containing `<script>` is a post that says `<script>`. If you ever show a
  forum post, use `Markup` and not a markdown library.
- `AuthContext` is exported from `@/hooks/useAuth` so a bare page can hand a
  component a session. `tools/site/composer-preview.html` is that page, and
  it is the check that the composer and the renderer stand up with no
  provider around them.
- On the At Kobblon pages a signed-in person now sees their own picture and
  the account menu instead of Log in and Sign up. It is the same `UserMenu`,
  with a `trigger="avatar"` prop, rather than a second one.

**What is not built.** No way to see your own retired names and pick one
from a list - `username_history_of` returns them and nothing offers them
yet. The community rename has no page: `rename_community` exists and
`ConfigureCommunity` still writes `name` directly, which the guard now pins
back, so **renaming a community through that page currently does nothing**.
That is the next thing to fix here and it is named rather than hidden.

## Round one hundred and sixty-nine - a category's mark is its own colour

Small and visual only. Nothing changed meaning, nothing changed shape, and
there is no new call for you to make.

The forum's six categories each already had a colour: the stripe down the
side of a row, and the square in the rail. The drawing in the middle of the
row was painting brand blue six times over, so the one place in the row with
room for the colour was the one place not using it. Each board's icon is now
drawn in its own category colour.

The map is `BOARD_INK` in `src/components/forum/Shell.tsx`, beside
`BOARD_COLOUR`. It is a second map rather than a string swapped on the
first, because `bg-brand-bright` and `text-brand-bright` are two classes and
Tailwind only emits the ones it can read whole in a file; building a class
name at runtime gets you no class at all. Off topic is the one entry that is
not a straight copy - `white/40` is a fill a 4px stripe can carry and a line
drawing at 18px cannot, so its ink is `white/60`.

Worth knowing if you ever draw one of ours in the applications: `Icon`
paints a `ui/` icon as a mask in `currentColor` by default, so a colour set
on the wrapper reaches it. `workspace/` icons are as drawn unless you pass
`tone`, because a green cylinder and a red part painted flat are the same
picture.

Still not done, and unchanged since the last round: `ConfigureCommunity`
writes `communities.name` directly and the name guard pins it back, so
**renaming a community through that page still does nothing**.
`rename_community` is the call it needs.

## Round one hundred and seventy - a name wears the same marks everywhere, and the forum grows a profile

The long one. Most of it is the forum, but the first part is not, and the
first part is the one that touches you.

### A name wears the same marks everywhere

Staw: "i dont see all of the badges ... sometimes its just the staff badge,
sometimes just the verified badge, sometimes NEITHER".

This was never a drawing bug. Twenty-odd lists each decided which marks
somebody wears from whatever columns its own RPC happened to return, so one
person wore the tick on one page, the k on another and nothing on a third.
The authoritative answer already existed - `name_marks` and `name_marks_for`,
shipped in 0180 - and the website had never once called it.

So there is now one client-side resolver, `useNameMarks(id?, username?)`, and
`NameMarks` asks it. It batches: every name on a page lands in one set, one
`name_marks_for` call answers all of them, and a key that comes back absent
means "wears nothing" rather than "not asked yet". A failed call leaves keys
unanswered on purpose, so a flaky network does not cache somebody into
wearing nothing for the rest of the session.

**What this means for you.** If the Workspace draws names with marks, do the
same thing: ask the database, do not infer from whatever columns your query
returned. `name_marks_for(uuid[])` takes ids. New this round:

```
name_marks_by_name(text[]) -> table (username text, marks text[])
```

Case-insensitive in, the real username out. It exists because the five large
Catalog RPCs return `creator_username` and no `creator_id`, and adding one
small function beat drop-and-recreating five big ones. Use whichever key you
already hold.

Until the resolver answers, `NameMarks` falls back to whatever the row said.
That is deliberate - it is the cold-load path - but it means a row with
stale columns shows stale marks for one tick. If that matters to you, hold
the marks rather than the booleans.

### Forum profiles - a new surface, and two new tables

`/forum/u/:username` exists now. Avatar, display name with its marks, the
username, a tag, the Kobblon bio unless a forum bio has been written, the
Discord handle if one is connected, counts, buttons across to the Kobblon
profile and the usual add-friend / block / report, and everything the person
has written.

New in 0282:

- **`forum_tags`** - 18 rows, `code` / `label` / `position` / `automatic`.
  `staff` is automatic: it is given to anybody wearing the k and nobody can
  choose it. The rest are chosen - player, builder, scripter, programmer,
  developer, modeller, artist, designer, animator, musician, sound-designer,
  writer, translator, tester, content-creator, teacher, learning. Null is
  "no tag" and is a real answer, not a missing one.
- **`forum_profiles`** - `user_id`, `tag`, `bio`, `updated_at`. Both grants
  and a public read policy; `insert`, `update` and `delete` are revoked from
  everybody including the owner.

Read with `forum_profile(in_username)`, `forum_tag_list()` and
`forum_posts_of(uuid, int, int)`. Write with `set_forum_profile(tag, bio)`,
which refuses automatic tags and unknown tags, caps the bio at 500
characters, and queues the words to `names_to_read` **only when they
actually changed**.

**A bio of null means "the one on my Kobblon profile", asked at the moment
of use.** It is not copied at signup and it is not copied when the Kobblon
bio changes. If you show a forum bio anywhere, coalesce at read time or you
will show a stale copy - this is the trap this project keeps falling into,
wearing its fifth disguise.

### Editing, and the hole it would have opened

The three dots on a post: copy link, edit (author only), report, delete.
`forum_edit` is author-only, not even staff - staff take a post down, they
do not rewrite somebody's words.

The hole: **an edited forum post was never read by Kobby.** Posting was
screened and editing was not, so the edit button would have been a way to
post anything by posting something harmless and then changing it. 0280 adds
`after update` triggers on `forum_topics` and `forum_posts` that queue the
new text to the machine, skipping when the text is unchanged.

If the Workspace ever grows a way to edit forum text, it goes through
`forum_edit`. Do not write the column.

### The smaller forum things

- The door: three blue dots on ink, on `/forum` only, every arrival, tied to
  the real fetch with a 450ms floor so a cached answer does not flash.
- `OP` on the opener's posts, `(edited)` where something was edited.
- A reading rail down the right of a thread, a signed-out note at the foot
  of one, and related topics underneath - `forum_related(bigint, int)`,
  ranked by shared title words, then same category, then views. It returns
  nothing when nothing is shared rather than padding with the newest.
- Boards now draw their mark in their own colour, not six times in brand
  blue.
- The forum's title is "Community Forum", the cookie note appears there now,
  the At Kobblon navbar is What is Kobblon / Forum / Policies / Download,
  and the footer's social column carries the forum under our own logomark.
- `name_marks` aside, every forum read now falls back to the username when
  somebody has no display name, which several of them did not.

### Previously known as

"Previous usernames" is "Previously known as" now, and it is the whole
history rather than the distinct set: stawrer, staw, stawrer again,
someguystaw all show. 0283 drops the `limit 20` and orders by `h.id desc`
instead of `changed_at`.

**Worth copying if you list these.** `now()` is the transaction clock, so
rows written in one transaction share a timestamp to the microsecond and
ordering by that column is not deterministic. Order by the `bigserial`.

### What is not done, plainly

- **The forum pages themselves have not been looked at in this container.**
  There is no route to Supabase from here, so the index, a topic and the new
  profile page are entirely data and render empty. What *was* built and
  looked at is `tools/site/forum-preview.html`, which mounts the new pieces
  on nothing - bylines, the OP tag, the open menu, the signed-out note,
  related topics, the rail, the six board marks. Nothing threw outside a
  provider, which is the check that directory exists for.
- **The link-preview cards for forum topics and forum profiles are written
  but unverified against the real database.** The code is proven against a
  stubbed fetch - a topic in a hidden board correctly gets no card, the
  topic card is `og:type article` with a large image, the profile card
  prefers the forum bio over the Kobblon one - but `npm run deploy` here
  reported "7 of the tables did not answer", so no card has actually been
  written from live rows. It leaves published cards alone when the database
  does not answer, so nothing was damaged; it simply has not run for real.
- **`ConfigureCommunity` still writes `communities.name` directly**, which
  `guard_community_name` pins back. Renaming a community through that page
  still does nothing. Named in Round 168 and still true; it has to move onto
  `rename_community`.
- No page offers somebody their retired usernames to pick from, though
  `username_history_of` returns them.
- The forum has no search, no quoting, no paging past fifty topics, and no
  per-category moderators.
- `npm run check:migrations` reports six findings. All six are in 0247,
  0260, 0261 and 0263 and predate this batch; none are in 0280 to 0283.

---

## Round one hundred and seventy-one - the migration that did not run, and a post that can carry a clip

Short version of the first part: **0280 and 0282 do not apply as shipped last
round.** If you have not run them, pull first.

### The migration that did not run

```
ERROR: 42883: function public.name_marks(uuid) does not exist
```

Both files call `name_marks(uuid)`, which has existed since 0180. 0180 had
never been applied to the live database - so a file that was correct here
failed there, which is the exact failure mode the "applied twice, wrapped in
one transaction" rule exists to catch and did not.

Why it did not: **my harness supplied the schema I believed existed rather
than the one that does.** `name_marks`, `is_name_verified` and
`name_marks_for` were all in the stub, so 0280 found them every time. I cut
them out of the stub, reproduced the failure exactly, and 0280 now defines
all four functions itself, verbatim from 0180, with `create or replace` - a
no-op where 0180 did land, a repair where it did not. All seventy-three forum
checks pass against a database that has never seen 0180.

Worth copying if you ever write one of these: **a migration that assumes an
earlier one landed is a migration that works on your machine and fails on
theirs.** Stub the oldest thing you depend on *out* and see whether your file
still stands up.

### A post can carry a clip - 0284

The `forum` bucket is forty megabytes now, up from two, and takes
`video/mp4`, `video/webm`, `video/ogg` and `video/quicktime` as well as the
four image types.

This matters to you if the Workspace or the Launcher ever posts to the forum:
**the bucket is the limit, not the composer.** Storage refuses on
`file_size_limit` and `allowed_mime_types` before any policy or function of
ours is consulted, so a client that allows a 50MB file gets a refusal from
Supabase and looks broken. The website keeps its own copy of the ceiling only
so somebody is told before they wait for an upload.

Two things to know:

- **The column is still called `images`.** It holds clips now. Renaming it
  reaches four functions, two types and every caller to say the same thing in
  a better word, so it waits for a day when that file has to change anyway.
  `isForumClip(path)` in `@/lib/api` decides which a path is, from its
  ending - the path is all a reader has.
- **`video/quicktime` is accepted and may not play.** A Mac or an iPhone
  hands `.mov` over by default and refusing it at the door would refuse most
  of what gets dragged in; whether it decodes depends on the codec inside,
  which nothing can see from a mime type. Both the composer and the thread
  draw the real first frame rather than a tick, so somebody finds out before
  posting.

### Attachments open in a viewer, not a tab

Staw: "when you click on an image or video it opens it in bigger view but i
dont want to be able to open the image in a new tab ... and its the same
image/video player design that we have on the website".

So `Attachments` draws buttons rather than links, and `Lightbox` (new, in
`@/components/forum/Lightbox`) opens over the page with arrows, Escape, and
`MediaPlayer` for a clip - our player, not the browser's.

**It takes an optional `urlOf`.** The default is the `forum` bucket's own, and
anything mounting it outside the website passes its own. That is the
mountable-outside-the-website rule, and it is in this round because this is
the fourth component to need it.

**What "not in a new tab" is not.** The invitation is gone - no `<a href>`, no
middle click, `controlsList="nodownload"` on the player. The *file* is not
gone and cannot be: the bucket is public and every attachment is a plain
address anybody can read out of the page. If an attachment ever must not be
fetchable by its address, that is a private bucket and signed URLs, which is a
different change in a different place. Do not tell anybody otherwise in the
apps either.

### Two answers, not four marks - 0285

The staff bar had Solved, Approved, Declined and Been looked at in a row.
Staw: "the tags be either solved/been looked at, either declined/approved."
They are two joined controls now, one answer each.

The pairing needed a server change, and the server change is the interesting
half: **"been looked at" was filed with the verdicts under suggestions**, so a
bug report could be solved or nothing at all. That was wrong on its own terms
before the pairing - an acknowledgement is what you say *before* a verdict, and
it is worth the same on a bug as on an idea. `forum_set_status` now allows
`looked-at` on any board that marks anything at all; `solved`, `approved` and
`declined` keep the boards they had, and a `plain` board still refuses
everything.

Nothing already marked was rewritten.

### Views - 0286, and a number that is not true

Two topics with real readers were showing "2 views". Both reasons were
decisions from 0275 that were right about accuracy and wrong about what the
number is for:

- a signed-in account counted **once, ever** - come back tomorrow and the
  counter has already had you;
- a signed-out reader counted **nothing at all**, on a forum built to be read
  without an account.

So: once per account per day, and signed-out readings count. The key on
`forum_topic_views` grew a `seen_on date`.

**The honest cost, because you should not copy this without it.** A signed-out
reading cannot be deduplicated server-side - there is no account to key on,
and the things that would serve instead are exactly what 0275 refused to keep
and was right to. The website asks once per topic per day per browser out of
`localStorage`, which stops a refresh and stops nobody determined. That is a
client-side rule, which this project's own line says is not a rule. It is
accepted for this one number because it is a vanity counter on a public page
that decides nothing. **If a view ever decides anything - a payout, a staff
queue, what gets built next - the signed-out half has to come back out.**

And the part to take seriously if you ever show a forum view count:

> **The number printed on the site is ten times the number of readings
> recorded.** Staw asked for it: "deliberately lie about them, like 1 view =
> 10". It is `forumViews()` in `@/lib/format`, one function with one constant,
> `VIEW_FACTOR = 10`.

Nothing is stored multiplied, nothing is compared multiplied, `view_count` in
the database is still the count of readings. **Only what is printed moves.**
If an app ever draws a forum view count it must go through the same function
or the two surfaces will disagree by a factor of ten and look like a bug.
Setting `VIEW_FACTOR` to 1 makes every number on the site true again in one
commit, which is the only reason it is one constant rather than a `* 10` in
five places.

My objection, stated once and then dropped: the people being told something
untrue are the forum's own readers, and a thread that says four hundred also
looks ignored the day it honestly gets four hundred. 0286 is the real lever.

### The mobile bugs okayCooki3 reported

Five, all real, all fixed, and three of them were one-word mistakes:

- **The category name covered by the green button.** `flex-wrap` was there and
  did nothing, because the text column carried `flex-1 min-w-0` - "give up all
  your width before anything else moves" - so the title was squeezed narrower
  than the word "suggestions" and overflowed sideways under the button.
- **"Searc".** The top bar's search field was `w-full` beside a `shrink-0`
  group of buttons, so the overflow went off the right of the screen. It asks
  for what is left now.
- **Leaderboards, Codes and Quests unreachable on a phone.** The Brix balance
  in the top bar was `hidden sm:flex`, and that menu is the only way into all
  four of those pages from the shell. Hiding a number hid four pages.
- **Every Chat button on the site doing nothing on a phone.** This is the one
  worth reading. `openConversation` set `openIds`, and `openIds` is only ever
  drawn by the docked windows, which are `hidden md:flex`. State changed, the
  thing that draws it was not on the screen, no error anywhere. It sets the
  phone sheet too now, and **the width is read at the moment of use** rather
  than held - a `matches` captured at mount is this project's oldest trap, and
  here it would mean turning the phone deciding where your chat opens.
- **Three friends under "Around now", each saying Offline.** The heading split
  the list on the row's `is_online`; the label under each face asked
  `useLivePresence`, which will not believe a stale `last_seen_at`. Two
  questions, two answers, printed next to each other. There is one answer now:
  **`presenceNow(person)` and `usePresenceVersion()` in
  `@/hooks/usePresenceStore`**, exported for anything that groups by presence
  outside a hook. If the apps sort or group people by presence, use those.

Also: the home page's friends row is four smaller faces across on a phone
instead of three large ones, two rows instead of three.

### A thing I shipped last round that was not true

The signed-out card at the foot of a thread said the forum "keeps your place
in a thread so you come back to where you stopped". **It does not and never
did.** I wrote that from `forum_seen`, which is the view counter - nothing
reads it back, and there is no reading position on this forum at all. I
claimed in Round 170 that every line of that card was something the forum
actually does. That claim was wrong about one line of three.

The copy is fixed. The lesson is the one this project keeps relearning: *read
the function, do not read its name.*

### The Launcher idea, passed on

Staw, for you: when the Launcher clips an image or a video, a button on the
clip that publishes it straight to the forum - either into a category you pick
or into one made for it.

From this side: everything it needs exists. `uploadForumImage(file, userId)`
puts a file in the `forum` bucket under the uploader's own folder (forty
megabytes, clips included, as above), and `forum_open(in_category, in_title,
in_body, in_images)` opens the topic with up to four paths. `forum_boards()`
lists the categories with their slugs, and `staff_only` on a board says
whether an ordinary account may post there.

Two things to decide rather than assume: whether a clip published this way
goes into an existing board or a new "Clips" one - that is a row in
`forum_categories` and Staw's call, not ours - and that **everything posted is
read by Kobby**, so a clip published from the Launcher can be taken down like
anything else and the Launcher should be ready to say so rather than report a
silent success.

### What is not done, plainly

- **The forum pages themselves have still not been looked at in this
  container.** No route to Supabase from here, so the index, a topic, a
  category and the profile page are entirely data and render empty. What was
  built and looked at is `tools/site/forum-preview.html`, which now also
  carries the two status pairs, the attachment grid, the viewer open over a
  clip, and the footer. Nothing threw, and there is no horizontal overflow at
  390px.
- **Three of the mobile fixes were not seen on a phone-width render of the
  real page**, for the same reason - the top bar, the friends row and the
  Chat button all need a signed-in session. They are read from the markup and
  from the cause in each case, which is weaker than a screenshot and is said
  here rather than left to be found.
- **The forum link-preview cards have still never run against live rows.**
  `npm run deploy` reported "7 of the tables did not answer" again and left
  the published cards alone. One thing did change in the writer: a card now
  takes the first *picture* rather than the first attachment, because an
  `og:image` pointing at an mp4 is a broken image everywhere it is pasted.
- `ConfigureCommunity` still writes `communities.name` directly, which
  `guard_community_name` pins back, so **renaming a community through that
  page still does nothing.** Named in Round 168 and in Round 170.
- No page offers somebody their retired usernames to pick from.
- The forum still has no search, no quoting, no paging past fifty topics and
  no per-category moderators.
- `npm run check:migrations` reports the same six findings, all in 0247, 0260,
  0261 and 0263. None in 0280 to 0286.

---

## Round one hundred and seventy-two: search, quoting, paging, and a board that has its own staff

Everything on last round's "what is not done" list that this container could
reach. Four migrations, 0287 to 0289 plus last round's 0288, and the client
halves of all of them.

### What to apply, in order

`0287`, `0288`, `0289`. Each is wrapped in one `begin; … commit;` and each was
applied twice against a local Postgres before being pushed.

### 0287 - five functions that could not see pgcrypto

`reply_ticket`, `member_communities`, `claim_appearance`, `set_appearance` and
`my_appearances` were `security definer` pinned to `search_path = public`, with
no `extensions`. None of them calls pgcrypto today, which is why it never
broke; it is a trap for whoever edits one next and reaches for
`gen_random_uuid`. Fixed with five `alter function ... set search_path`, which
touches the setting and not the body.

**For the applications: nothing changes.** No signature moved, no behaviour
moved. It is named here only so that a Workspace copy of any of those five is
not "fixed" a second time differently.

### 0288 - the forum can be searched

New: `forum_search(in_terms text, in_category text default null, in_limit
integer default 20, in_offset integer default 0)`.

It returns **exactly `forum_topics_list`'s column list, in the same order**, so
a result draws with the topic row you already have. Granted to `anon` and
`authenticated`.

What it is built on, because this decides what it can and cannot do:

- Postgres's own full-text search, no extension. `to_tsvector('english', …)`
  with the configuration written out - left to the default it is only `stable`
  and cannot be indexed - over title (weight A) and body (weight B).
- **It matches words, not fragments.** "scrip" finds nothing; "scripting"
  finds "scripts". `pg_trgm` is not installed and enabling it is Staw's to do,
  not a migration's. The empty state on the website says so in as many words,
  and yours should too, or the first report you get will be "search is
  broken".
- `websearch_to_tsquery`, so quotes, `or` and a leading minus work and an
  apostrophe does not raise. **Words are joined with AND**: `door won't open`
  finds nothing, `door will not open` finds the topic.
- Replies are **not** searched. Only topic titles and first posts. A real
  limitation, said out loud rather than buried.
- Removed topics and hidden boards are filtered inside the function. A search
  that returned a title out of the staff room would have leaked the title.

Also new: index `forum_topics_text`, a GIN expression index over the same
document.

### 0289 - a board can have its own staff

This is the one with meaning in it for you.

Until now forum staff was all or nothing: `is_moderator()`, true for every
platform admin and moderator and false for everybody else. So somebody who
should be closing duplicates on Building and scripting had to be handed the
whole site.

New table `forum_category_staff (category, user_id, given_at, given_by)`, with
its grants in the same file: `select` to `anon` and `authenticated`, every
write through a function. Who looks after a board is public on purpose - a
board whose staff are anonymous is a board where nobody is answerable.

New functions:

- `forum_can_moderate(in_category text default null) → boolean`. **This is the
  question every forum function now asks instead of `is_moderator()`.** True
  for real platform staff anywhere, and for a board's own somebody on that
  board.
- `forum_boards_i_mind() → (category, name)`. Which boards the caller looks
  after.
- `forum_board_staff(in_category) → (user_id, username, display_name,
  avatar_url)`. Who looks after one. Public.
- `set_forum_board_staff(in_category, in_user, in_on)`. **Admins only, not
  moderators** - a moderator handing out board keys is a moderator growing
  their own staff.

**Six functions changed their rule and none changed its signature:**
`forum_topic_create`, `forum_reply`, `forum_remove`, `forum_mark_answer`,
`forum_set_status`, `forum_set_flags`. Each asks `forum_can_moderate(<that
board>)` where it asked `is_moderator()`.

**What a board's staff can do, and only on their board:** pin, close, mark
solved/looked-at/approved/declined, take a topic or post down, mark the
answer, post in a staff-only board, and bypass the five-topics-an-hour brake.

**What this never gives, anywhere:** warnings, suspensions, anything on
anybody's standing, or the ability to appoint more of themselves. Those stay
with real staff and `is_moderator()` is still the question everywhere outside
the forum. If the Workspace has a staff panel, **do not read
`forum_category_staff` as a staff rank.** It is not one.

`forum_edit` is deliberately untouched and must stay untouched: it is
author-only, and staff of any kind do not rewrite somebody's words. They take
a post down.

**The thing a client copy gets wrong.** Whether to draw the staff controls is
now a question about *this topic's board*, not about the account. The website
asks `forum_boards_i_mind()` once and compares the list against
`topic.category` at the moment of use - working it out when the page mounts
gives the answer against a topic that has not loaded, which reads as "the
buttons are missing" rather than as an error.

### The website side of all that

- `forumSearch`, `forumBoardsIMind`, `forumBoardStaff`, `forumBoardStaffOf`,
  `setForumBoardStaff` in `@/lib/api`.
- `ForumSearchBox` is exported from `@/components/forum/Shell` and mounts
  bare. It **submits** rather than searching per keystroke; what is in the box
  is seeded from `?q=` so a pasted link and the box agree.
- `/forum/search?q=…&in=<slug>&page=N`, drawing the same `TopicTable` a board
  does.
- Paging on boards and on search: 25 a page, `?page=N`, **Newer / Older**
  rather than numbered pages. Numbered pages need a count of the topics in a
  board and nothing counts that; asking for one on every board view is a
  second full scan to draw a number nobody clicks. It asks for one row past
  the page and that row's existence is what "there is more" means.
- Quoting. `PostMenu` gained a `canQuote` / `onQuote` pair and a Quote entry.
  `Composer` gained `insert?: { text: string; at: number } | null`, which it
  **appends** so a half-written reply survives, and which it watches on `at`
  and not on the text - quoting the same post twice is the same string, so an
  effect watching the string fires once and then never again. If you mount our
  composer, that is the prop.
- The board header lists who looks after it, when anybody does.
- The Admin page's person row has a **Forum boards** dialog, shown to admins
  only, that puts somebody in charge of a board or takes them off it.

### A thing this round found that is yours as much as ours

`tools/site/forum-preview.tsx` mounted `Composer` bare and the page went down:
`useAuth must be used inside <AuthProvider>`. That is the first trap in
CLAUDE.md, for the fourth time. The composer is fine; it needs a session. The
way to give it one outside the website is `AuthContext`, which is exported
from `@/hooks/useAuth` for exactly this, and the preview now hands it a
profile and nothing else. **If the Workspace mounts `Composer`, `UploadDialog`
or anything else of ours that asks who you are, it has to supply that context
or the panel goes blank.**

### Verified, and how

- 0288 and 0289 applied twice to a Postgres 16 that has never seen 0180, then
  checked under four identities - a stranger, a platform moderator, a board's
  own somebody, and anonymous. Forty-one assertions; every refusal was proved
  by a refusal, and every write was **read back off the row afterwards** rather
  than trusted to have landed.
- The AND-joining in `forum_search` is asserted as a zero, deliberately, so
  that it is being checked rather than hoped for.
- `npm run check:migrations`: 289 migrations, nothing to complain about. The
  six long-standing findings are gone - five were real and are 0287, and the
  sixth was the checker being wrong about `drop index` then `create index`,
  which is as idempotent as `if not exists` and is the only correct form when
  an index's definition changed.
- `npm run build` clean, and the new pieces rendered and looked at from
  `tools/site/forum-preview.html`: the search box, the pager in three states,
  the board-staff strip, Quote in the three-dot menu, and the composer after
  two quotes.

### What is not done, plainly

- **The forum pages have still never been rendered.** This container has no
  route to Supabase, so every forum page is an empty shell here. Search,
  paging, the board-staff strip and the quote button have been looked at as
  pieces on a bare page and **not once on a real page with real rows.**
- Search does not read replies, does not match fragments, and has no
  highlighting of the matched words in a result.
- Paging has no page numbers and cannot jump to the end, for the reason above.
- Quoting quotes at most four lines and then an ellipsis, and quoting a
  selection rather than the whole post is not built.
- A board's own staff see their controls on the topic page and on the board
  header. There is no page anywhere that shows a board's staff *to them* as a
  list of what they are responsible for.
- Nothing notifies somebody that they have been put in charge of a board.
- Still untouched from earlier rounds: the newsroom, the wiki, Round 133's
  five Launcher questions, Worlds belonging to a Community, `pg_net`/`pg_cron`
  and the re-apply of 0224 and 0253, the deleted-account rename not reaching
  friend lists or chat rows, automatic Community verification by membership
  share, `register` not being deployed, `world_visits` only being written by
  `join_world_server`, and Support and Standing still being on the old shell.

## Round one hundred and seventy-three: a search that reads the replies, a name that is gone everywhere, and a bell that could not render

Three migrations to apply, in order: `0290`, `0291`, `0292`. One of them
fixes a leak and one of them fixes a bug I shipped in Round one hundred and
seventy-two. Both are below, named.

### A bug I shipped, and the shape of it

`NotificationsPanel` kept a lookup of marks by notification kind and read it
directly. Round one hundred and seventy-two added `forum_reply` as a kind
the database can now store, and did not add it to that lookup - so the first
person to get a forum reply got `undefined.icon` and a blank panel, not a
missing icon. A list that renders other people's data by a key it was
written against will do this again every time the database learns a new
value, so the fix is both: the two kinds are added, and `markFor(kind)`
falls back to `marks.system` for anything it has never heard of. If the
Workspace maps notification kinds anywhere, it wants the same fallback - the
set is open-ended now.

### A visibility leak, fixed in 0290

`forum_search` always filtered hidden boards. `forum_topics_list` never did.
So a hidden board's topics were out of search and still on the front page.
0290 rewrites `forum_topics_list` whole with the one added line
`and not c.is_hidden`. If the Workspace lists topics through anything of its
own rather than through `forum_topics_list`, check it for the same hole.

### 0290 - a search reads the replies too

- A GIN index `forum_posts_text` over `to_tsvector('english', body)`.
- `forum_search` now matches a topic on its own title and body **or** on any
  of its non-removed replies. Still one row per topic; a topic whose answer
  matches comes back once, not once per reply.
- New: `forum_search_count(in_terms, in_category)` and
  `forum_topics_count(in_category, in_unanswered)`. These exist so a pager
  can print "Page 2 of 7" instead of "Page 2" - the list functions page by
  limit and offset and never knew the total.

Searching matches words, not fragments: there is no `pg_trgm` here, so "mesh"
finds "mesh" and "meshes" and does not find "remesh". `websearch_to_tsquery`
joins words with AND, so two words means both.

### 0291 - being put in charge is told to you

`notifications_kind_check` gains `'forum_staff'`, and
`set_forum_board_staff` now inserts a notification linking to
`/forum/c/<category>` - but only when the write actually changed a row
(`get diagnostics changed = row_count`), so setting somebody who is already
staff is silent rather than a second bell. Notifications now carry an
optional `link`, and the panel prefers it over anything it works out itself.

### 0292 - a name that is gone is gone in the lists too

The retired-name work landed on profiles and never reached friend lists or
chat rows, so somebody who closed their account still read by their old
display name there. `people_list` now returns `closed_at` and `is_banned`,
and `my_conversations`' member objects carry both. The website prints every
one of those through `nameOf(person)`.

**`people_list` changed its return table**, which means `drop function if
exists` then recreate - `create or replace` cannot do it. Anything on your
side typed against the old shape gains two columns.

### What else is in the website now

- Search results pick the words out in the title and show the line of the
  post they were found in (`Marked`, `snippetOf`).
- Quoting: the post menu's **Quote** takes the selection if there is one
  inside that post (up to twelve lines) and the first four lines otherwise,
  and appends it to the composer. `Composer` gained an `insert` prop -
  `{ text, at }`, where `at` is a counter, so quoting the same post twice
  inserts twice.
- `/forum/mine` lists the boards somebody is staff of, and says plainly what
  that does and does not let them do.
- Support, Your standing and a single standing item are on the At Kobblon
  chrome now, not the old `Page`/`PageTop` shell.

### A trap, for the fourth time

Mounting `Composer` bare in `tools/site/` threw `useAuth must be used inside
<AuthProvider>`. `AuthContext` is exported from `@/hooks/useAuth` for exactly
this: hand it a session and the component mounts with no provider, no router
and no page around it. If a shared component of ours takes your panel down on
mount, that is the first thing to try.

### What is not done, plainly

- Neither the forum pages nor Support nor Standing have been rendered
  against real rows: this container has no route to Supabase. The SQL is
  checked against a local Postgres under four identities; the pages are
  checked for chrome and for not throwing, and nothing more.
- Still open from before: the newsroom, the wiki, Round one hundred and
  thirty-three's five Launcher questions, Worlds belonging to a Community,
  `pg_net`/`pg_cron` and the re-apply of 0224 and 0253, automatic Community
  verification by membership share, `register` not being deployed, and
  `world_visits` only being written by `join_world_server`.

## Round one hundred and seventy-four: a foot on every page, a door to the forum, and replies that read as a conversation

No migrations this round. Nothing to apply.

### The two halves of the site had no door between them

From a signed-in page the only way to the forum or to What is Kobblon was
the address bar: the rail is yours, the top bar is the platform's, and
neither carried an At Kobblon page. So the rail grows a third group at its
foot - Forum, What is Kobblon, Download, Policies - drawn smaller than the
rail's own rows, because it is where you leave rather than where you are.
It is `outNav` in `@/components/layout/nav`, beside `sideNav`, `topNav` and
`mobileNav`. If the Workspace draws a rail of its own from those, it now
has a fourth list to decide about.

The account menu gains **Forum profile**, pointing at
`/forum/u/<username>`. On an At Kobblon page that menu is the only thing
that knows who you are, and the forum's own shell only ever linked to a
profile through a post - so somebody who had not posted had no way to
their own.

### Every signed-in page has a foot now

The same `SiteFooter`, with a new `compact` prop: same links, less room.
Staw asked whether it should be this one or a second one, and it is this
one - a second foot is a second place for a moved page to keep pointing at
where it used to be. It is mounted **inside** `main` in `AppShell`, so it
sits inside the rail's offset and the phone bar's clearance without being
told either number.

### The forum, on the three front pages

`@/components/forum/TopTopics` - one component, used on the landing page,
on the signed-in Home and on What is Kobblon. It asks for
`forum_topics_list` with `sort = 'interesting'`, which already weighs
replies against age, rather than for the newest five; and it renders
**nothing at all** when the forum is quiet or the request fails, so a
stranger never meets an empty shelf on the way in. `head={false}` turns off
its own heading where the page has already said what it is.

It is mountable bare: no provider, no auth, just a router for its links.

### Replies read as a conversation

`@/components/forum/Thread` - three pieces, none of which asks the
database for anything. The replies are all in hand, so who answered whom is
already known.

- **ReplyingTo** - the grey "Replying to Ryko" line becomes a chip with
  their picture that opens into the post itself, quoted, with the way down
  to it. An answer three screens below the thing it answers can be read in
  one place.
- **Answered** - the other direction. A line of pictures and a count under
  a post that was answered, opening into who said what, each one a jump.
  Without it, a reply that started a long back-and-forth looks like a dead
  end.
- **Later** - "Eleven days later" between two replies more than three days
  apart. A topic answered in March and picked up in October read as one
  conversation.

`Forum.tsx` works out `byId` and `kids` once per load with `useMemo`
rather than per reply: twenty replies each walking the list is four hundred
passes on every render.

One thing that was wrong and is worth saying, because it is the kind of
thing that passes a type check: the chip first sat at the top right of the
post beside the three dots, and the quote it opens is a paragraph wide - so
it unfolded straight over the name it was next to. It is on a line of its
own now. Screenshot caught it; nothing else would have.

### What is not done, plainly

- **`TopTopics` has never been seen with rows in it.** This container has
  no route to Supabase, so on every page it was put on it rendered its
  empty case, which is nothing. The markup is right by reading, and that is
  all I can say for it.
- Staw is reordering the rail, the top bar and the account menu and is
  sending the list; nothing here is that reorder. What is above is
  additive, so the order it adds to is still the old one.
- Still open from before: the newsroom, the wiki, Round one hundred and
  thirty-three's five Launcher questions, Worlds belonging to a Community,
  `pg_net`/`pg_cron` and the re-apply of 0224 and 0253, automatic Community
  verification by membership share, `register` not being deployed, and
  `world_visits` only being written by `join_world_server`.

### A correction to Round one hundred and seventy-four, found on the way out

The deploy from this container was deleting every forum card page - the
`forum/t/<id>` and `forum/u/<name>` files that make a topic or a forum
profile unfurl when it is pasted. `publish-to-root.mjs` keeps a list of
roots that hold cards written from the database, and leaves those alone
when the build could not reach it. `forum` was never added to that list,
so it was wiped and rebuilt from nothing on every run. It is in the list
now, and the forty-two cards survived this deploy and were repointed at
the current bundle.

It had been happening for a while and showed up only as pull conflicts.
Nothing on your side depends on it; it is here because it is the fourth
time this project has lost data to a value that was right for every case
somebody had thought of.

---

## Round one hundred and seventy-five

Support takes a ticket from somebody with no account, and from a company.
Account standing went the other way, behind the rail.

### Anybody can write to support now

`open_ticket` has raised **"Sign in first."** since 0072. That is the oldest
hole on this platform's support page: the person who cannot get into their
account is exactly the person who cannot sign in to say so. 0293 closes it.

The function is granted to `anon` as well as `authenticated` and takes a
caller with no session. What it insists on instead is an email address,
because a ticket with no account behind it has no page to be answered on -
there is nothing for that person to come back to as themselves.

**For the Launcher and the Workspace, this is the line that matters:** a
sign-in failure, a locked account, a device that will not authorise - any
of those can now offer "write to support" without a session, by calling
`open_ticket` with `kind => 'player'` and an address. Before this round the
only honest thing an application could do with a signed-out person was send
them to a page that would refuse them.

What anonymity costs and what pays for it:

* **The row is readable by staff and by nobody else.** `tickets_read` is
  `user_id = auth.uid() or is_moderator()`, and `null = anything` is null
  rather than true, so an account-less ticket cannot be read by the next
  anonymous person on that page. No grant to `anon` on the table is added
  and none is wanted: the form posts through the function and reads nothing
  back. Checked under three identities - anonymous, a signed-in stranger, a
  moderator - and the stranger counts zero.
* **Rate limiting loses its subject.** Three open tickets an hour per
  account still holds. With no account it counts the address instead, case
  insensitively, and holds a ceiling of sixty account-less tickets an hour
  over all of them together, because an address is a thing anybody can
  invent. Neither is a wall; both are a cost.
* **A guest is no longer refused outright.** The old refusal was "so we can
  write back". With an address there is a way back, so the refusal is now
  about exactly that: a guest with no email is still turned away, a guest
  with one is not.

### Two forms, and the first step is which

Staw: "theres two categories like for the players users etc and 'business'
like in the sliding thing theres two boxes".

`support_tickets` grows `kind` (`player` | `business`), `org` and
`org_role`. The business form has four topics of its own - `invest`,
`partner`, `content`, `press` - beside `other`, which is the one value both
lists share. **The server refuses a business topic sent as a player ticket
and the other way round**, so these are not interchangeable in a call.

The business form asks for a name, a company and an email, all required,
and never asks what device anybody was on - `device` is forced null for it
rather than carrying whatever the form last held. A player ticket is
unchanged except that its email is required when there is no session.

One thing on that form is worth repeating exactly, because it is a claim
about the company and not a label: **Kobblon is not a publicly traded
company and nothing is on sale. An investment buys nothing back unless it
is negotiated directly with Staw, Kobblon's CEO.** That sentence is on the
card under the Investing tile. Picking a tile no longer jumps to the next
step, which it used to - that is what made the line under the tiles
unreadable.

### What changed in the shared pieces

* **`openTicket(card)`** in `@/lib/api` takes three more fields:
  `kind?: 'player' | 'business'`, `org`, `org_role`. All defaulted, so an
  existing call still compiles and still sends a player ticket.
* **`Ticket`** in `@/types/db` grows `kind`, `org`, `org_role`.
  **`TicketTopic`** grows the four business values. **`TicketRow`**, which
  the staff queue reads, grows the same three and its `user_id` is now
  `string | null`. If you read `TicketRow.user_id` anywhere, that is a
  nullable now and it means "nobody was signed in".
* **`TicketCard`** takes `signedIn?: boolean` and
  `startKind?: 'player' | 'business' | null`. It still takes no provider it
  cannot be given - no `useAuth`, no router, no toast - and it is mounted
  bare at `tools/site/popups-preview.html?v=ticket|business|out`.
* **`ticket_queue`** gained a `'business'` filter and returns `kind`, `org`
  and `org_role`. It was **dropped and recreated**, not replaced, because
  its return table changed; if anything of yours calls it, the old
  two-argument signature is gone and the new one has the same name.

### Account standing is a signed-in page and stays one

Staw: "make sure that the account standing page stays a logged in page
while the support page can become an at kobblon page". Both had been
sitting side by side in the At Kobblon chrome and they are not the same
kind of page. Support is Kobblon talking to anybody who writes in;
standing is one account's own record. So `/standing` and `/standing/:id`
moved inside `AppShell`, behind the rail, and `/support` moved out of
`RequireAuth` entirely.

The foot follows: Support is in the At Kobblon column now, and "Your
standing" left the foot altogether, because the foot is drawn on the
landing page and a link there would have bounced a stranger straight back
to it. It is in the account menu, where somebody who has an account will
find it.

### Still not done

The two reorders Staw said he would send - the rail and the top bar, and
the account menu - are still waiting on his lists. Nothing in this round is
that reorder.

`TopTopics` from the last round has still never been drawn with real rows
in it; this container has no route to Supabase. Worth a look on the live
site.

### For the applications

Nothing here breaks a build of yours. The three type additions are
additive, the one dropped function is a staff-console RPC, and `openTicket`
still works called the old way. The piece worth acting on is the first
section: support no longer needs a session, so a signed-out failure path in
the Launcher can offer a real ticket instead of a dead end.

## Round one hundred and seventy-six

Navigation split in two, Contact & Support cut down to what it is for, the
forum quotation rebuilt as real post cards, and a forum panel in the staff
console - which turned up two server bugs that meant forum moderation had
never worked at all.

### Removing a forum post raised an error every single time

`take_report` calls `take_down(target_type, target_id::uuid, said)`. A
forum id is a `bigint`, so `'412'::uuid` raises *invalid input syntax for
type uuid*. Every Remove on a forum report since the forum shipped has
failed with that, and the second wall behind it is that
`violations.target_type`'s check constraint has no forum values, so even a
working cast would have been refused on the write.

`0294_a_reported_forum_post_can_actually_be_taken_down.sql` widens that
constraint with `forum_topic` and `forum_post`, adds
`take_down_forum(what text, which bigint, said text)` - staff only, flags
the row, notifies the author, mails them, points them at `/standing` and
writes the admin log - and gives `take_report` a branch so a forum target
goes there and everything else still goes to `take_down`.

Worth saying how it was found: not by reading it. The first version of
`take_down_forum` named a local variable `title`, which collides with
`forum_topics.title`, and Postgres refused the function outright. Running a
migration twice against a real database is the check; reading it is not.

### Staff could take a forum post down and then never see it again

Every reading function on the forum filters `not is_removed`, so a removed
topic is reachable from nowhere - including by the person who removed it.
`0295_the_forum_from_the_console.sql` adds the one door that does not
filter: `forum_staff_topics(in_which, in_category, in_limit, in_offset)`,
staff only, where `in_which` is `all`, `live`, `removed`, `locked` or
`pinned`, returning the same columns as `forum_topics_list`. And
`forum_restore(in_what, in_id)`, staff only, which clears the flag, logs it
and tells the author.

`forum_topics_list` is deliberately untouched. A wider reading function
with a staff branch inside it is one function that behaves differently
depending on who asks, and that is the shape that quietly leaks.

**Both migrations need applying in the SQL editor**, along with 0293 from
the last round if that has not been run yet.

New in `@/lib/api`: `forumStaffTopics`, `forumRestore`, `takeDownForum`.
`takeDownForum` is not `forumRemove` - that one is the author deleting
their own and says nothing to anybody; this one is a moderation decision
with words attached that the person can appeal.

### Navigation: each half lists its own half

Staw: "at kobblon's navbar will mainly display navigating stuff around at
kobblon, while logged in pages shall mainly show navigating around logged
in pages, and to go from at kobblon to logged in pages idk theres one
singular or maybe two or three portals".

So: `outNav` - the way out of the signed-in rail - is two entries now,
Forum and What is Kobblon. Download, Settings and Policies are gone from
it; Settings has a gear of its own and the other two live in the At
Kobblon bar, which is where they belong. The At Kobblon bar gains
`Contact`. Nothing is in both lists any more except the two portals, which
is what a portal is.

The account menu was eight rows and is now five or six: Settings, Account
standing, Contact & Support, Switch Accounts, Log Out, plus Staff for staff
and Keep this account for a guest. My Avatar moved to the rail and the
forum profile moved to the forum's own rail, which now has a Your profile
entry above Mine. The rule that came out of Staw's Roblox comparison:
**this menu is the account, not the site.**

The signed-in pages' footer sits on `mt-24 sm:mt-28` instead of `mt-12`.

### Contact & Support

Renamed from Support, and cut down. Staw: "we just need a contact us card
thing and prevuious tickets or awaiting tickets and thats it". It is a
hero, one card with the two buttons on it, and your tickets. The policies
block, the sign-in block and the "where the reply goes" panel are gone.

The investor wording is Staw's own, verbatim in substance: investing in
Kobblon means giving - money, time, a word in the right place, dedication -
for little or nothing back, unless something is agreed directly with him.
Nothing is on sale and Kobblon is not publicly traded. If the Launcher or
the Workspace ever says anything about investing, say that.

A screenshot caught a real bug while this was being checked: picking a
topic auto-advanced the step, so the line under the tiles - which on the
business form is that disclaimer - was drawn for a tenth of a second and
gone. It no longer advances on its own.

### The forum, where it is quoted

`src/components/forum/TopicCard.tsx` is new and is the only thing that
draws a forum topic outside the forum now. Two looks: `tile` for the
signed-in home's shelves, which is the same card the rest of that page's
shelves use, and `glass` for the At Kobblon bands. Both carry the board
chip, the time, the title, the first lines of the body, and the author with
the reply and like counts. It exports `useTopTopics(limit)`.

The home page's "From the forum" is a `Row` like every other row on that
page, and What is Kobblon's band is three glass cards instead of a list
that matched nothing around it. Both hide entirely when there are no
topics, rather than drawing a heading over nothing.

Still never drawn with real rows - no route to Supabase from this
container. Third round saying so; it wants a look on the live site.

### The console

A Forum panel, moderator and up: every topic including the removed ones,
tabs for Everything, Live, Removed, Locked and Pinned, and Pin, Lock,
Remove and Restore on the rows. Remove asks for words first and will not
send without them, because a removal with no reason cannot be appealed.
`tools/site/staff-queues-preview.tsx` now draws three forum rows beside the
ticket and appeal rows, which is where the removed-row look was checked.

### For the applications

Nothing here changes a signature you call. `take_down_forum`,
`forum_restore` and `forum_staff_topics` are new and staff-only; the three
api wrappers are additive. If the Workspace ever grows a staff view, those
three are what it would read.

What is still not built, said plainly: the newsroom, the wiki, a World
belonging to a Community, and Round 133's five Launcher questions, which
have now been open for long enough that it is worth saying whether they
are dead rather than leaving them listed.

## Round one hundred and seventy-seven

A polishing pass over the whole site rather than a feature. Staw: "polish
the whole app again, polish the design, the ecosystem, the content, etc,
make everything coherent". What that turned up was mostly one thing wearing
different clothes: **the site was built for somebody who is signed in, and
a visitor was being shown it anyway.**

### A visitor was shown a menu of doors to the login screen

Every public page - Discover, the Catalog, a World, somebody's profile, a
404 - draws the signed-in rail. Signed out it listed Home, Profile, My
Avatar, Friends, Library and Inbox: six rows, all of them behind
`RequireAuth`. The phone bar did the same with Home, You and Chat, three of
its five slots.

`NavItem` has `needsAccount` now, and a `visitorOnly` for the other
direction. Signed out the rail is what a visitor can actually open - People,
the At Kobblon pair - with Make an account and Log in at its foot where the
person's own card sits once there is one. The phone bar drops Home and You,
puts Communities in their place, and does not draw the chat at all, because
the roster is read as whoever is signed in and signed out it opens an empty
panel.

The account menu did it too: signed out it offered Settings, which is behind
`RequireAuth`. It now offers Log in, Make an account and Contact & Support.
The top bar had Sign up and no Log in, so somebody who already had an
account had to find the login screen through the sign-up one.

### Following a link to a page that needs an account threw you at the front door

`RequireAuth` redirected to `/`. No word about why, no way back, and the
address they wanted gone. It redirects to `/login?next=<address>` now, and
the login page honours `next` - after signing in, or signing up, or coming
in as a guest. Only a path on this site, never `/login` or `/signup`
themselves: a login page that follows whatever a link tells it to is an open
redirect, and bouncing back to itself is a loop. The Log in / Sign up toggle
carries `next` across with it.

**This is the one worth copying.** If the Launcher or the Workspace ever
sends somebody to the website to sign in, `/login?next=/whatever` now works
and lands them where you meant.

### A TypeError on the console of every public page

`app.html` has two inline scripts. The first removes the boot screen on any
page that does not get the logo reveal - every At Kobblon page, the forum,
login, signup. The second then did
`document.getElementById('boot').setAttribute(...)` with no check, so on all
of those it threw. Harmless only because nothing came after it in that
script, which is not a thing to leave resting on. Guarded.

While in there: `/support` was not in the list of pages that skip the
reveal, so a stranger writing to us sat through four seconds of our logo
first. It is now.

### Words

- The guest refusal messages said "Guests cannot like Spaces". The tables
  are still `space_*` and that is fine; the sentences say World.
- What is Kobblon's opening line said "build unique experiences". An
  experience is Roblox's word for what Kobblon calls a World.
- The eighth policy was titled "Worlds and experiences". Same fix, and a
  policy heading is the last place on the site to use somebody else's name
  for our own thing.
- The 404 said "Discover Spaces", and its Go home button sent a stranger to
  `/home`, which is behind the rail - a second dead end after the first one.
  It goes to the landing page when there is no account.
- Log in, Sign up and Log out were Title Case in five places and sentence
  case in four. The whole site is sentence case, so they all are now. "Play
  as Guest" is "Play as a guest".

### Dead and missing

- `/create/requests` has no route and no function behind it; the link fell
  through to the content route and read as a broken asset. It is a plain
  number until requests get a screen.
- Four pages had no tab title: the 404, Configure, Maintenance and
  ConfigureCommunity, which is now named after the Community so two open
  tabs can be told apart.
- Contact & Support used a plain tab title while sitting in the At Kobblon
  bar. It wears that family's pipe now: "Contact & Support | At Kobblon".
  The comment in `useTitle` that still listed account standing in that
  family was corrected - standing went behind the rail last round.

### Contact & Support, again

The two lines that floated under the card - where a reply goes, and that we
never ask for a password - are a foot inside the card now. A footnote set
loose in the middle of a page reads as a paragraph nobody finished.

### For the applications

Nothing changed in `@/engine`, `@/lib/kinds`, `design/preset.js` or any
component you mount. Two things are worth knowing: `/login?next=<path>`
works, and if the Workspace ever says anything about a World, the word is
**World** - not space, not experience. The guest refusal strings and the
policy headings now match `@/lib/naming`, which is where that word is
decided for the whole product.

Still not built, said as plainly as last round: the newsroom, the wiki, a
World belonging to a Community, requests have no screen, and Round 133's
five Launcher questions are still open.

---

## Round one hundred and seventy-eight

Staw, of the four mobile reports from the forum: "those issues werent fixed
at all because when using them it just says 'This page would not draw' same
thing when you try using the three lines icon in the logged in pages".

Which is a different bug from the four, and worth saying plainly: Round one
hundred and seventy-six's fixes were real and are in the build, but on a
phone the two things that open them - the chat and the drawer - were landing
on the error screen instead. So the fixes were correct and unreachable.

### Hidden is not absent

`hidden lg:block` stops a thing being painted. It does not stop it being
mounted, its effects running, or its channels being open.

Two panels in this app are drawn twice for that reason, and on a phone both
copies were live at once:

* **The rail.** `AppSidebar` is fixed and `hidden` below `lg`; the drawer
  draws the same `SidebarContent`. Pressing the burger put a second copy on
  the page - two friend-request counts, two unread-post counts, and a second
  subscription to `friendships:<id>` and `sidebar-mail:<id>`, topics the
  first copy was already joined to.
* **The chat.** The docked windows are `hidden md:flex` and the phone sheet
  is `md:hidden`, and `openConversation` deliberately set both pieces of
  state. So one conversation on a phone was two mounted `Window`s on
  `dock:<id>`, each marking the same messages read.

Counted in the harness, on a phone, before and after: the drawer went from
two rails on the page to one, and opening a conversation went from two chat
lists to one.

`@/hooks/useWidth` is the fix - `useMedia`, with `useWide` and `useNarrow`
over it. The breakpoint is a **value** now, so the branch that is not being
used is not mounted at all. It is a live query with a listener, not a
`matches` read once: turning the phone sideways has to change the answer,
and the single line in `openConversation` that read the width at the moment
of use was already an instance of the trap this project keeps falling into.
It is gone; the width decides which tree exists, once, and `openConversation`
now says only what was opened.

**For the applications:** if a panel of yours is hidden by a class and it
subscribes to anything, it is still subscribed. `useMedia` is in
`@/hooks/useWidth` and mounts outside the website like the rest of `@/hooks`.

### The pencil on the phone chat did nothing

Same silent shape as the Chat button okayCooki3 reported, one layer down.
The new-group panel is 288 by 384 and positioned for the bottom-right corner
of a desktop, and the only place it was drawn was inside that corner's
container - which a phone never paints. Pressing the pencil set the state
and showed nothing, with no error.

`NewGroupDialog` takes `full` now, the same way the roster and a conversation
already did, and the phone sheet gives it a screen of its own.

### The error screen says what went wrong

This is the part that matters for the next report. "This page would not
draw" was the same sentence for every cause, the stack went to the console,
and a phone has no console - so a report of this screen was a report that
something, somewhere, had gone wrong, which is why neither of the two above
could be chased from the outside.

There is a closed "What went wrong" under the two buttons now: the error's
name and message, the address it happened at, and the first eight frames of
the component stack, with a button that copies the lot. Closed by default,
so the screen is still the apology it was.

### For the applications

Nothing changed in `@/engine`, `@/lib/kinds`, `design/preset.js` or any
component you mount, and no migration this round. One new hook worth having:
`useMedia`/`useWide`/`useNarrow` in `@/hooks/useWidth`.

Still not built, same list: the newsroom, the wiki, a World belonging to a
Community, requests have no screen, and Round 133's five Launcher questions.

---

## Round one hundred and seventy-nine

Staw, with a Kobblon link pasted in Discord: "make that every embed about
Kobblon has its sidebar's colour as kobblue (kobblon's brand colour)".

### The stripe beside an embed is `theme-color`

Discord paints the bar down the side of an unfurled link with the page's
`theme-color`, and ours said `#101012` - the near black every page happens
to sit on. So every Kobblon link anybody pasted anywhere looked like a link
to nothing in particular. It is `#1B34E8` now, which is `brand.DEFAULT` in
`design/preset.js` and the only blue that is allowed to mean Kobblon.

It is also what a phone paints its own chrome with, and that is the same
answer rather than a cost: the bar at the top of this site is brand blue, so
the browser's bar above it matching is the one that does not look like a
seam.

### The 357 pages that would never have got it

Writing it into the template was not enough, and this is the part worth
copying. Every page under `u/`, `c/`, `worlds/`, `catalog/`, `create/`,
`e/` and `forum/` is a real file written by whichever build last reached the
database. `publish-to-root.mjs` brings those files forward on every deploy,
but it only carried two things across: the asset block and the boot script.
Everything else in the head stayed as it was written, so a page published
last month would have gone on wearing the old colour for ever, and the one
Staw actually pasted - `forum/t/8` - was one of them.

So the theme colour goes over too, by the same mechanism. It is the one line
in the head that is neither the page's own - its title, its description, its
picture, all of which must stay its own - nor part of the bundle. All 357
pages carry Kobblue now, with their own cards untouched.

### Words, while in there

The template's own fallback description still said "Build your own Space",
and five of the addresses in `scripts/site-pages.mjs` described Kobblon with
Spaces and experiences - including the policy titled "Spaces and
experiences", which Round one hundred and seventy-seven had already fixed on
the page itself and not in the thing that writes its card. Those are the
sentences search engines and chat apps quote, which makes them the last
place for a word we retired.

### For the applications

Nothing changed in `@/engine`, `@/lib/kinds`, `design/preset.js` or any
component you mount, and no migration. If either application ever writes a
`theme-color`, or a card for a Kobblon link, the colour is `#1B34E8`.

---

## Round one hundred and eighty

Staw sent five drawings: "now replace all of the remaining mascot driven UX
thingy by these - brix, construction worker, lighthouse no result/looking
for some, notifications, catalog sunglasses. These will replace the kobby
ones."

### The five, and what each one means

They live at `public/mascot/` and they are reached through the same
component as before, `@/components/brand/Kobby`, whose moods did not change
names. That is the point of having had them: about forty call sites ask for
`noResults`, and none of them had to know that it stopped being a shrug and
became a lighthouse.

| mood | drawing | the moment |
| --- | --- | --- |
| `emptyBox` | a brick on a stand | nothing here yet |
| `noResults` | the lighthouse | looked and did not find it |
| `construction` | the worker in hi-vis | not built, being worked on, broken |
| `notification` | Kobby with the bell | something came in, or nothing did |
| `style` | the shades | the Catalog's own |

The old set - `kobby_crown`, `kobby_empty_box`, `kobby_no_results`,
`kobby_notification`, `kobby_sunglasses` and `under_construction` - is
deleted rather than left lying about, so there is one drawing per idea and
nothing to pick the wrong one from. `kobby.png` itself stays: it is the
28-pixel mark beside "Ask Kobby" in the staff panel, which names the
auto-admin and is not an empty state.

`under_construction` had two deliberate placements outside the empty states
- the Download page's hero and the corner of the Workspace banner on What is
Kobblon - and both are the worker now. Two drawings of "this is still being
built" was one more than the idea needs.

### The shades got a job

`style` was in the table and used nowhere, and the Catalog's empty shelves
were all using the lighthouse. Searched-and-found-nothing is the lighthouse;
a shelf nobody has filled yet is the Catalog's own, so:
`Nothing on this shelf yet` is now `term ? 'noResults' : 'style'`, the
outfits shelf and a creator's empty shop are `style`, and a Catalog item
that was never screened or has been taken away is `noResults`.

### One of them arrived on paper

The brick drawing had its background painted opaque white rather than left
transparent, which does not show on a white canvas and is a white slab on
every card this site has. Cleared by flooding in from the border, so white
that the drawing fences in - the top of the stand - is kept exactly as
drawn. Worth knowing for the next batch: if a drawing looks right in the
chat and wrong on a dark card, that is this.

`tools/site/mascots-preview` draws all five at the sizes pages ask for,
beside four real empty states.

### For the applications

If you draw an empty state, the drawings are at `/mascot/<name>.png` on the
website and the component that picks one is `@/components/brand/Kobby`,
which mounts with nothing around it. No migration, and nothing changed in
`@/engine`, `@/lib/kinds` or `design/preset.js`.

---

## Round one hundred and eighty-one

A correction to the round before it, from Staw's own old-against-new sheet.

### The names are his now

He put the five into the repository properly - `brix.png`,
`construction_worker.png`, `lighthouse_no_results.png`, `notification.png`,
`sunglasses.png` - so those are the filenames under `public/mascot/`
rather than the shorter ones the last round invented. If a drawing is
replaced, it is replaced by overwriting the file he named.

### The worker and the hammer are two drawings, not one

Last round folded `under_construction` into the construction worker on the
grounds that two drawings of "still being built" was one too many. That was
wrong, and his sheet says why: they are not the same idea.

* **The worker** - hard hat, hi-vis - is the empty state. A thing that is
  not finished, is being worked on, or broke.
* **The guest with the hammer** is a Kobblonian who builds, standing beside
  something being advertised. It is not an empty state at all, which is why
  it has no `mood` in the old table and why Staw lists it as "none before".

It is back, in `public/mascot/` with the rest, and it has its two
placements again: the Download page's hero and the corner of the Workspace
banner on What is Kobblon. It is `kobbyArt.building`, so the two call sites
name a drawing rather than a path, and the next time one of these moves
there is one line to change.

### What the set is now

| mood | file | the moment |
| --- | --- | --- |
| `emptyBox` | `brix.png` | nothing here yet |
| `noResults` | `lighthouse_no_results.png` | looked and did not find it |
| `construction` | `construction_worker.png` | not built, being worked on, broken |
| `notification` | `notification.png` | something came in, or nothing did |
| `style` | `sunglasses.png` | the Catalog's own |
| `building` | `under_construction.png` | beside what is being advertised |

The brick still arrived with its background painted opaque white, so it is
cleared the same way as last round - flooded from the border, keeping the
white the drawing fences in. Said again because it will come up again: a
drawing looks right in the chat and wrong on a dark card when its
background is white rather than transparent.

### For the applications

`/mascot/<name>.png` on the website, picked through
`@/components/brand/Kobby`. No migration, and nothing changed in
`@/engine`, `@/lib/kinds` or `design/preset.js`.

## Round one hundred and eighty-two

Kobblon's news is a forum board, not a second product; the mascot set has
one more mood and one fewer.

**No newsroom, and nothing in the website pretends there will be one.**
Staw: "for the forums & the about page, no newsroom, use the forums'
announcement channel and for the thumbnails it'll just be the media
attached (if theres any) so we dont need to actually build a newsroom". So
the newsroom that has sat in this file's backlog since Round one hundred
and thirty-three is cancelled, not pending. Do not build a news panel
against a news table; there is no news table and there will not be one.

What there is instead, and what you can use:

- `useAnnouncements(limit = 3)` in `@/components/forum/TopicCard` - newest
  first from the `announcements` board. Newest, not "interesting": the
  second-most interesting piece of news from March is not news.
  `useTopTopics(limit = 5)` is unchanged beside it and still sorts by
  interesting.
- `TopicCard` now draws a cover when the topic has one, taken from
  `topic.images[0]` - 16:9, `object-cover`, bled to the card's edge, with a
  play badge over a clip (`isForumClip` decides from the extension). No
  attachment means no picture and no gap: the card closes up and starts at
  its category chip.
- `TopicCard` gained one optional prop, `urlOf?: (path: string) => string`,
  defaulting to `forumImageUrl`. The website never passes it. It is there
  for the same reason `Lightbox` has one - a panel mounted outside the
  website may hold its attachments somewhere else, and with no way to say
  so every thumbnail is an empty rectangle. If the Workspace shows forum
  cards against its own cache, this is the seam.

Both the forum's front page and What is Kobblon now lead with the
Announcements board through those two - two cards on the forum, three on
What is Kobblon - and both sections disappear entirely when nothing has
been announced. A News heading over an empty rectangle says the place is
dead.

What is Kobblon's old "Newsroom" panel, which said a newsroom was being
built, is gone. In its place is **Where things get said**: the
Announcements board and the Discord, both of which exist. That one stays
whether or not anything has been announced, so the page never ends without
telling a stranger where to listen. `SiteFooter`'s comment no longer
reasons about a newsroom either; the wiki is still the only idea named
there.

**`kobbyArt.emptyBox` is gone. It is not renamed - it is removed.** Staw,
on the first pass at his new drawing: "the mood isnt emptybox bruh". He is
right, and this is a meaning change, which is why it is here rather than
waiting:

- `kobbyArt.brix` is the new key: a Brick floating over its stand, like a
  prize. It is what you are playing **for**, so it belongs where Brix are
  earned and ranked - Quests and Leaderboards - and nowhere else. It is not
  an empty state.
- Every other site that asked for `emptyBox` now asks for `noResults`,
  which is the lighthouse: looked, and did not find it. Nineteen call sites
  moved. `EmptyState`'s default mood is `noResults` too.

If you hold a copy of the mood list, `emptyBox` will not resolve any more,
and a copy that still points `emptyBox` at a box drawing is now showing a
picture that is not in Staw's sheet. The full list, which is the whole of
it:

`brix`, `noResults`, `construction`, `notification`, `style`, `building`,
`default`.

`building` is the Kobblonian with the hammer and is **not** `construction`:
the worker stands for a thing that is not finished, the hammer guest stands
beside a thing being advertised. Folding them together last round was
wrong. `default` is Kobby's own face and is a label, not an empty state -
it names the auto-admin beside "Ask Kobby" at 28 pixels.

`tools/site/pages-auth-stub.tsx` gained `AuthContext` and `AuthValue`,
because the real module exports them and a preview that aliases the module
must stand in for all of it. A missing export there is not a type error; it
is the whole page failing to load. Worth knowing on your side for the same
reason - whatever you alias `@/hooks/useAuth` to needs those two names now.

Still not done, unchanged from last round: the wiki; Round one hundred and
thirty-three's five Launcher questions; Worlds cannot belong to a
Community; use requests have no screen; `pg_net`/`pg_cron` and the
re-apply of 0224 and 0253; automatic Community verification by membership
share; `register` is not deployed; `world_visits` is still only written by
`join_world_server`.

## Round one hundred and eighty-three

Announcements live inside the card that explains them; a post's picture is
inset rather than bled; and an edit can finally change what is attached.

**`forum_edit` takes attachments. 0296, and it drops the old function.**
Staw: "we cant actually edit posts (especially attached content)". He was
right twice - the editor opened on the body alone, so a topic's title was
fixed from the moment it was posted and a picture attached to it could
never be taken off. The only way out was deleting the topic, which takes
the replies with it.

```
forum_edit(in_what text, in_id bigint, in_body text,
           in_title text default null, in_images text[] default null)
```

- `in_images` null means **leave them alone**, so a caller written before
  today cannot wipe a post's attachments by being quiet.
- An array replaces the whole set; `'{}'` takes them all off. There is no
  "add one": the composer holds the whole set while it is open, and a
  per-attachment door is a second mechanism that can disagree with the
  first.
- Four at most, said here as well as in `forum_topic_create` - an edit that
  can carry six is a way round the create that refuses them.
- Still author-only. Staff take a post down, they do not rewrite it.

**The old four-argument function is dropped, not replaced.** Adding a
parameter makes a different signature, so `create or replace` would have
left both sitting there and every call - which is every call, since
PostgREST passes these by name - would have failed as "function is not
unique" rather than resolving to either. If you hold a client wrapper for
this, it keeps working untouched; it just cannot change attachments until
it passes the new argument.

Applied twice against a local Postgres and checked under two signed-in
identities, with `select auth.uid()` printed first so "signed in" meant it:
body-only leaves both pictures; an array replaces them; `{}` clears them
and sets `edited_at`; five raise "Four attachments at most."; and a
stranger gets "That is not yours to edit." with the row's title, body and
images unchanged afterwards.

On this side: `forumEdit(what, id, body, title?, images?)` in `@/lib/api`
grew the same two optional arguments, and `Composer` grew `initialImages`,
seeded once for the same reason `initial` is - a field that refills itself
from the row cannot be changed while the thread reloads under it. The topic
editor now opens with its title and its attachments in it.

**`TopicCard`'s cover is inset.** Staw: "i want the posts with images to be
polished and look even better, like the thumbnail is like a rounded
rectangle inside of it and slightly smaller to leave a path around the
image". So the picture keeps the card's own padding round it and wears a
`rounded-xl` (a `rounded-2xl` in the glass look) with a hairline ring,
rather than bleeding to the card's edges. A bled cover reads as a cut-out
of a bigger page; an inset one reads as something the card is holding. The
card itself is tighter all round - `p-5`, a `text-lg` title, a three-line
gist - because both places it appears were too big.

**What is Kobblon has one card where it had two.** The "What we are doing."
band is gone and the announcements now sit inside *Where things get said*,
under a rule, with the Announcements and Discord links still in its header.
Staw: "i want you to put the announcement posts into this card ... get rid
of 'What we are doing.'" - they were one idea wearing two headings, and the
posts are the evidence for the sentence above them. The card stays when
nothing has been announced; only the row of posts goes.

The forum's own strip is three across rather than two - Staw: "the
announcements are too big" - and asks for three.

**Three of the new drawings were barely used.** Staw: "for the new UX stuff
you didnt use the catalog sunglasses, the construction worker & the brix
that often, for brix you could put one instead of the gift icon in the
redeem card".

- `brix` is now the drawing on the Redeem a code card, in place of a
  24-pixel present. The tab beside it keeps `faGift`: that is a mark in a
  row of marks and has to stay a glyph.
- `style` took the empty wardrobe drawer on My Avatar. An empty drawer is
  not a search that failed; it is a wardrobe nobody has put anything in.
- `construction` was already on seven surfaces (the error screen,
  maintenance, Home, Discover, the activity feed) and is left as it is.

`tools/site/pages-auth-stub.tsx` now also carries `AuthContext`/`AuthValue`
(Round one hundred and eighty-two), and `phone-preview` gained `?page=codes`.

Not checked here, and worth saying rather than implying otherwise: the
populated version of What is Kobblon's card has not been rendered in this
container, because the announcements come from the database and this
container has no route to it. The cards in it were rendered and looked at
on their own, in both looks, with a picture, with a clip and with neither.

Still not done, unchanged: the wiki; Round one hundred and thirty-three's
five Launcher questions; Worlds cannot belong to a Community; use requests
have no screen; `pg_net`/`pg_cron` and the re-apply of 0224 and 0253;
automatic Community verification by membership share; `register` is not
deployed; `world_visits` is still only written by `join_world_server`.

## Round one hundred and eighty-four

A phone shows fewer friends, not smaller ones.

okayCooki3, on the forum, about the Friends row on a phone: "i think
instead of it being more crammed together there should just be 2 of the
person's friends (on mobile) shown then when they click see all they can
see all their friends". He is right, and he is pointing at the wrong turn
taken last time: the row was four across with eight faces because an
earlier complaint of his was that it took too long to scroll past, and the
answer to that was fewer faces rather than tighter ones. Two rows of small
circles with the names touching is what tighter got us.

So on a phone:

- `FriendsRail` (the home page) is three columns - Add Friends and two
  faces - one row, nothing under it, and the faces are bigger for it.
  Unchanged from `sm` up: six across, nine at `lg`, eight faces.
- The Friends card on a profile shows three rather than eight. Three, not
  two, because there is no Add Friends cell on somebody else's profile, so
  three is the full row.

Both hold the extra cells back with `hidden` rather than slicing the list
shorter, so one piece of markup serves both widths and turning the phone
sideways is a repaint rather than a refetch. The count in the heading is
still the real one, and "See all" was always right there.

Nothing shared changed: no component signature, no API, no table. If you
draw a friends row of your own, the number worth copying is "one row,
whatever one row holds at this width", not eight.

Checked at 390 and at 1280 in the phone harness, which mounts the real
shell: one row of three on the phone, the full nine-column row unchanged on
the desktop. The profile card takes the same rule and could not be
rendered here - a profile needs the database and this container has no
route to it.

## Round one hundred and eighty-five

A profile picture is the avatar, redraws the moment the avatar changes, and
is the same picture everywhere.

Staw: "for the profile pictures i want that it redraws everytime you change
your avatar, make sure its FROM the avatar, and lastly make sure its the
same image used everywhere you need your pfp". Three sentences, and the
first and third were each a real bug.

**It redraws now.** `forgetHeadshot` had one caller: My Avatar. Every other
way to change how you look - putting something on from the Catalog, from a
shelf, from an outfit, from a World's own shop, taking one thing off,
changing your body colours - changed the avatar and told nobody. The face
in the top bar, in the sidebar and on the comment you left further down the
page stayed as it was until the tab was closed, and the saved picture
everybody else sees stayed as it was until you next opened My Avatar.

So the five doors in `@/lib/api` that change what somebody is wearing -
`wearAvatarItem`, `takeOffItem`, `takeOffSlot`, `wearOutfit`,
`setBodyColours` - now do what follows from it themselves:

- `markLookChanged(id)` in `@/lib/headshots`: every face of them on screen
  forgets what it drew and draws again from what the database says they are
  wearing.
- `refreshPortrait`, held back a second and a half, last one only, so
  dressing is one render and one file rather than four. An explicit
  `refreshPortrait` cancels the queued one, so My Avatar is not doing it
  twice.

It is in `api` rather than in the six pages because six places remembering
is five places that forget, and five of them already had.

**It is from the avatar, and that part was already true.** `portraitIsCurrent`
only accepts a stored picture named `portrait-<when>.webp`, which is what
`refreshPortrait` writes; an uploaded or inherited picture is not a picture
of an avatar, so it is ignored and the face is drawn instead. Nothing on the
website uploads one, and signup deliberately stores nothing.

**It is the same picture everywhere, and this is the one that needed
building.** Whether a stored picture is still you is decided by comparing
the stamp in its filename against `avatar_changed_at` - and thirty-four
places that draw a face are handed a row with no `avatar_changed_at` in it
at all: a forum byline, a chat message, a ticket, a community member. With
nothing to compare against, the stored picture was taken on trust, so
somebody could wear last March's face on the forum and this morning's on
their profile.

`@/lib/headshots` now keeps, for the life of the tab, when each person's
avatar last changed:

- `noteAvatarStamp(id, when)` - every row that *does* carry the date feeds
  it on the way past, so most of this costs nothing.
- `askForAvatarStamp(id)` - a face drawn from a row that does not carry it
  asks once, batched on a 60ms timer, through `avatarStamps(ids)`: a plain
  select on `profiles`, which is already readable, capped at 200. A forum
  page is one request, not forty.
- The newest answer wins, so a list fetched before a change cannot undo
  what the change recorded, and a change made in this browser a second ago
  beats every stored picture because the row saying so has not been fetched
  yet.

**For the applications:** if you draw a face from a row of your own, pass
its `avatar_changed_at` to `Avatar`/`PersonAvatar` where you have it; where
you do not, the store now answers for you, so nothing needs threading
through. If you change what somebody is wearing through anything other than
those five `api` functions, call `markLookChanged(id)` yourself - that is
the one thing this cannot do for you.

No migration, no table, no RPC: `profiles` already had the column and
already allowed the read.

Checked in `tools/site/headshots-check.html`, which exercises the
comparison itself with no database and no WebGL - eight cases, all passing:
an old portrait is refused, a new one kept, an uploaded picture never used,
nothing stored is nothing to use, a dateless row on its own trusts what is
stored, the store answers for a dateless row once another row has said, an
older row does not undo a newer one, and a change made here beats the
newest stored picture.

Still not done, unchanged: the wiki; Round one hundred and thirty-three's
five Launcher questions; Worlds cannot belong to a Community; use requests
have no screen; `pg_net`/`pg_cron` and the re-apply of 0224 and 0253;
automatic Community verification by membership share; `register` is not
deployed; `world_visits` is still only written by `join_world_server`.

## Round one hundred and eighty-six

Small on this side, and one thing for you.

**The mascot set is yours to use too.** Six drawings live in the website's
`public/mascot/`, and `@/components/brand/Kobby` is the one place that names
them - `kobbyArt` maps a mood to a file, so neither side hardcodes a path:

- `construction` - `construction_worker.png`. Not finished, being worked on,
  or broken. **This is the one to lean on in the Workspace**, wherever a
  panel, a tool or a tab is not built yet; it is what the website uses for
  the same thing, so the two windows say "not yet" with the same face.
- `building` - `under_construction.png`. The Kobblonian with the hammer, who
  is *not* an empty state: somebody who builds, standing beside what is being
  advertised. The Launcher's splash or a Workspace welcome panel is where
  this one belongs, never a hole in a page.
- `brix` - `brix.png`. Anywhere Brix are the subject: a balance, a reward, a
  code redeemed.
- `noResults` - `lighthouse_no_results.png`. Looked and did not find it.
- `notification` - `notification.png`. Something came in, or nothing did.
- `style` - `sunglasses.png`. Shelves of things to wear.

Start using them in the Launcher, and in the Workspace with `construction`
first. They are drawings, not icons - a drawing fills a hole where a list
would be, an icon sits in a row of controls, and the Font Awesome set stays
the answer for the second. Nothing about them changed this round; this is the
line saying they exist and are shared.

**On the website itself:**

- The Workspace band on What is Kobblon now shows `construction` rather than
  `building` - Staw's call, and consistent with the rule above: the Workspace
  is still being built, so the worker is the right drawing there.
- **Download is last in every list of At Kobblon pages.** The bar reads What
  is Kobblon, Forum, Policies, Contact, Download; the footer's At Kobblon
  column ends on it too. If the Launcher or the Workspace draws its own copy
  of that list anywhere, put Download at the end of it.

No migration this round. **0296 is still waiting** - `forum_edit` gained
title and attachment arguments and the new signature only exists once that
file is applied.

## Round one hundred and eighty-seven

Polish only, and one correction to the last round.

**0296 is applied.** Staw ran it. `forum_edit` is live as
`(in_what, in_id, in_body, in_title default null, in_images default null)` -
the old four-argument signature is dropped, so anything calling it by name
must pass the new shape. Nothing is outstanding on the database now.

**"Where things get said." on What is Kobblon** was too wordy and the cards
under it repeated themselves. The lead is two short lines, and `TopicCard`
gained `showBoard` (default true): off, the board pill goes and the card
leads on the time. It is off in that row, because three cards reading
"Announcements" under a heading about announcements is the word four times -
the rule being that a card does not name the thing the container already
named. If you draw the same card in a board-specific list, turn it off there
too; in a mixed feed leave it on, because there the board is the one piece of
information the card alone carries.

## Round one hundred and eighty-eight

Staw's drawings, all of them, in one place. **Round eighty-three said this
once, a hundred rounds and a lot of new icons ago; this is the current
list, and it replaces that one.** Nothing here changed this round - the
point is that you can use all of it.

Four sets, all under the website's `public/`, all plain files you can copy
or serve:

**1. `public/icons/workspace/` - drawn for you.** Fifteen PNGs, the
explorer's icons: `cylinder`, `decal`, `group`, `light`, `meshpart`, `part`,
`script`, `sky`, `sound`, `soundservice`, `sphere`, `texture`, `truss`,
`wedge`, `world`. **This is the folder for the Workspace.** A MeshPart in
your tree and a MeshPart in Create must not be two drawings of the same
thing, so take these rather than drawing your own; the website already uses
them on Create for exactly that reason.

**2. `public/icons/ui/` - the interface set.** About fifty, and the website
leans on them everywhere: `add-user`, `admin`, `announcement`, `assets`,
`avatar`, `brix`, `broken-image`, `chatbubble`, `check-user`, `checkmark`,
`circle-user`, `click`, `clock-user`, `cross-user`, `discount`,
`favourite` / `favourite-stroke`, `gear`, `heart-user`, `klub`,
`klub-badge`, `laurel-quest` / `laurel-quest-stroke`, `microphone`,
`mute-microphone`, `notification`, `people`, `remove-user`, `report`,
`search-user`, `send`, `thumbs-up` / `thumbs-up-stroke`, `thumbs-down` /
`thumbs-down-stroke`, `user`, `users`, `voice-user`, `world`, and the
sixteen `reaction-*` faces. Note `ui/world` and `workspace/world` are
deliberately different pictures: one is a World as a place, the other is a
node in a tree.

**3. `public/mascot/` - the six drawings**, as Round one hundred and
eighty-six listed them. `construction` first in the Workspace.

**4. `public/brand/`** - wordmarks, logomarks (including the light, dark,
Christmas and Halloween variants), the favicons, `og.png`, the
studio backdrops and the logo reveal. If the Launcher draws the mark
anywhere, draw it from here rather than from a copy.

**How to read them.** `@/components/brand/Icon` is the one place their names
are written down, and it is mountable outside the website - no provider, no
router:

```ts
import { Icon, type KobIcon } from '@/components/brand/Icon'

<Icon name="workspace/decal" className="h-4 w-4" />   // as Staw drew it
<Icon name="chatbubble" tone="currentColor" />        // painted as a mask
```

The names are a union type (`UI_ICONS`, `WORKSPACE_ICONS`), so a name that
does not exist is a build error rather than a picture that silently does not
load - which is the whole reason for the registry, with sixty-odd files in
play. `iconUrl(name)` gives you the bare URL if you would rather draw it
yourself. Pass a size on **both** axes or on neither: the default is
`1em` per axis and naming only one leaves the other unset, which is a mask
with nothing to paint onto - an invisible icon, learned the hard way.

`tone` paints the icon as a CSS mask, so the shape is kept and the colour is
whatever you hand it. Left out, the drawing keeps its own colours - which is
what the Workspace set wants. **Do not tint those.**

One thing that is ours and not yours to re-solve: four files in `ui/` are not
icons but detail masks (`reaction-heart-eyes-eyes`,
`reaction-winky-grin-tongue`, the two `*-tears`). `Icon` paints them on top
of a tinted face so a red eye or a pink tongue survives being masked. They
are not in the name union; if you draw a reaction face untinted you get all
of it from the one file and need none of this.

## Round one hundred and eighty-nine

**Kobby answers questions about the rules now**, on the Policies page, and
there is a new migration and a redeployed edge function with it.

Staw: "make that in the policy page theres a bar to ask about the policies
or certain things about kobblon, and its kobby who answers based on whats
written in our policies and the blocked words, etc of the staff console ...
make that its not ugly and doesnt take too much space".

**Two things to apply before it works:**
1. `0297_somebody_can_ask_kobby_about_the_rules.sql` in the SQL editor.
2. Redeploy the `moderate` function. It now ships a file beside it,
   `supabase/functions/moderate/policies.json`, so deploy the folder and
   not just `index.ts`.

**The new door: `moderate` with `{ question }`.** It is the first branch of
that function that does **not** need an admin, and the only one that needs
no account at all - the Policies page is read before anybody signs up.
`verify_jwt` stays on and is not to be turned off; what changed is that this
one branch accepts the publishable key instead of throwing it out. It
answers `{ answer, sources: [{slug, title}], covered }`, and the website
calls it through `askKobbyAboutTheRules(question)` in `@/lib/api`. If the
Launcher or the Workspace ever wants the same bar, use that function rather
than writing a second caller.

**What grounds the answer, and what does not.** The policy text is baked out
of `src/content/policies.ts` by `scripts/bake-policies.mjs`, which
`npm run build` now runs, and lands next to the function. **The browser
never sends policy text and must never be allowed to**: a question is
untrusted, a document is not, and a page that could send both would be a
page that can have Kobby quote a rule somebody invented on the way in. The
word filter is used but never shown - the patterns stay on the server and
the model is told only whether this one question trips one, because a list
that keeps slurs out of a children's chat is worth nothing the moment it is
read out.

**Fences,** because this hands a language model to the open internet:
twelve questions per asker per hour, counted in the database (an isolate
cannot count for its siblings); 300 characters per question; answers
refused where the documents do not cover it. An asker is their account when
signed in, otherwise a salted hash of the address - **the address itself is
never stored.** Every question is logged in `kobby_questions`, which no
browser can read, signed in or not.

**It decides nothing about anybody's account** and is told so four ways in
the prompt. Every answer carries a line pointing at `/support`. If either
application grows its own helper, keep that rule: a bot on a rules page
saying "you'll be fine" is the platform saying it.

**Not built:** a screen in the staff console. `kobby_question_log(n)` exists
and checks `is_admin`, so what people ask is readable, but nothing in the
console calls it yet.

**Checked:** eight behavioural cases against local Postgres under two real
identities, after the whole stack applied clean and 0297 applied twice - the
ceiling holds at twelve and holds per asker, the refused question is still
logged, a long one is cut rather than refused, a nameless asker is refused,
neither `anon` nor `authenticated` can touch the table, the log refuses an
ordinary account and answers an admin, and an ordinary account cannot call
the counter directly to raise its own ceiling.

---

## Round one hundred and ninety - one person, several Accounts

**The Terms changed their mind about Accounts, and that is a meaning
change, so it gets a line before anything about the page it sits on.**

The Terms of Service used to say "One Account per person. You may not
operate, control or benefit from more than one Account". It no longer
does. Staw's decision: **somebody may hold as many Accounts as they
like.** The Eligibility and registration section of the Terms now reads,
in substance:

- Several Accounts are allowed, and each is separate. What is held on it,
  earned on it and done on it belongs to that Account alone, and each is
  answerable for its own conduct.
- Holding several does not multiply anything granted once per person, and
  an Account may not be used to obtain a second time what another of your
  Accounts has already had. (Nothing in the schema enforces that today -
  it is a rule, not a check. Say so if either side is asked.)
- Passing an Account on is still forbidden: no selling, renting, lending,
  gifting, trading, bequeathing or transferring an Account or a
  credential.
- **Evasion is unchanged.** A restriction placed on one of somebody's
  Accounts applies to the person, not only to that Account; using another
  of them to carry on is evasion and is dealt with under the Community
  Guidelines, which already said exactly that and still does.

What this means for the applications: **nothing in either of them should
tell somebody they may only have one account, or treat a second account
as suspicious on its own.** If the Launcher's sign-in, the Workspace's
account panel, or any onboarding copy on your side says or implies one
per person, that copy is now wrong and contradicts the published Terms.
Multiple accounts signed in on one machine is not a thing either side
builds today, and this round does not ask for it - this is about what the
words say, not about a feature.

The Terms' `updated` date moved to 25 Oct 2026 for it.

**Consequence for Ask Kobby (Round one hundred and eighty-nine):** the
policy text is baked into `supabase/functions/moderate/policies.json` at
build time, so Kobby answers out of whatever was last deployed. Until the
`moderate` function is redeployed, Kobby will keep telling people they may
only hold one Account. That is the baking rule biting for the first time,
exactly as that round warned: **change a policy, rebuild, redeploy the
function folder.**

### The Policies page, on Staw's instruction

The ask bar moved from between the band heading and the nine cards into
the hero, directly under "Everything, written down." - replacing the lead
line and the "9 policies - newest ..." counter, both of which are gone.
It is still a bar and not a panel: one row, grown only by an answer.

Redesigned with it, for standing over a photograph rather than on a flat
band: a blur behind it, one hairline border, a shadow under it, the face
a little larger and tilting on focus, and the send button showing a
spinner while Kobby is thinking. Appearance only; the request, the
response shape and every fence are the ones Round one hundred and
eighty-nine described.

### Still outstanding from Round one hundred and eighty-nine

Both steps are Staw's to run, and neither has been reported done:

1. Apply `0297_somebody_can_ask_kobby_about_the_rules.sql` in the SQL
   editor.
2. Redeploy the `moderate` function **as a whole folder**, so
   `policies.json` goes with it - and now doubly, because of the Terms
   change above.

---

## Round one hundred and ninety-one - the ask bar never names the service

Staw: "when we cant generate stuff instead of saying to all of our users
that we use groq, we wanna say instead something like Kobby couldnt
generate a proper answer, please try again shortly".

Every public failure of the Ask Kobby branch in `moderate` now returns
one sentence, and it is always this one:

> Kobby could not put an answer together just then. Give it a moment and
> ask again - the policies themselves are all on this page, and support
> gets you a person.

It covers all three ways that branch can fail without an answer: the
model did not answer, an empty answer came back, and the rate counter
itself refused. The real reason is written to the function log with
`console.error` instead, so the console can still be told what broke.
Status codes are unchanged (502, 502, 500), so anything reading them
reads the same thing as before - only the words changed.

Two things that did **not** change, deliberately:

- **The admin console still gets the exact sentence.** Staff pressing a
  button that failed need "Groq said 429 for ..." or "no GROQ_API_KEY is
  set", because they are the only people who can act on it. Nothing in
  the moderation, appeal, report, chat or model-list paths was touched.
- **The ceiling message is still its own sentence** ("that is twelve
  questions in an hour"), because that one is not a failure - it tells
  somebody something true about what they did, and swapping it for an
  apology would have them hammering a bar that is working as intended.

On the website side the client does the same thing: `askKobbyAboutTheRules`
in `@/lib/api` shows the function's own sentence when there is one and
that same apology for everything else, instead of the "the function is
not deployed" diagnostics the rest of that file hands the console.

**If the applications ever surface a Kobby answer**, copy the rule rather
than the string: a public failure says what to do next and names no
service, no model and no provider. A staff-facing failure says exactly
what went wrong.

Nothing about the request, the response shape, the ceiling or the fences
moved. `moderate` needs redeploying as a folder for this to take effect -
the same redeploy Round one hundred and ninety already asked for, which
also carries the multiple-Accounts wording into Kobby's copy of the
policies.

## Round one hundred and ninety-two - a code on the edit link, and three ranks that mean something

Two things from Staw, and the first one is yours more than it is mine.

### Signing in by pressing a button, not by signing in

Staw: "cannot log in into the launcher or the workspace for some reason.
and i want it to be easier, instead of needing to log in, all you do is
click the playbutton of a world page and then it launches the launcher
where you are already signed in on the same account that pressed that
playbutton on the website".

The website has done that half since the Launcher got a protocol handler:
pressing Play on a World mints a single-use code and opens
`kobblon://play/<id>?code=<code>`. Nothing about that changed. What did
change:

* **`kobblon://edit/<id>` now carries a code too**, minted for `creator`:
  `kobblon://edit/<id>?code=<code>`. Pressing "Open in Workspace" on a
  World page is now the whole of signing in to the Workspace, the same way
  Play is for the Launcher. The code is `[A-Za-z0-9_-]{64}`, single use,
  and spent with `claim_app_code(code, 'creator')` - a code minted for one
  application is refused to the other. The query string is optional, so an
  edit link with no `?code=` is still valid and still means "open this
  World"; it just arrives signed out.
* **A code lives ten minutes, not two.** The table said two minutes while
  the sign-in page has said ten since it was written. Two is not enough for
  a cold start that has to update itself and ask Windows for a protocol
  handler, and what somebody sees when it runs out is the sign-in page this
  was built to avoid. Still single-use, still tied to one application,
  still worthless once claimed.

**The error in Staw's screenshot is on your side, and it is not a Kobblon
problem.** The dialog says `Unable to find Electron app at
...\?code=0cf99...&state=...` and `Cannot find module <the same URL>`. That
is Electron being handed the protocol URL as `process.argv[1]` and treating
it as the path to the application to run, which is what happens when the
handler was registered without the executable and its arguments being
spelled out. In development that means
`app.setAsDefaultProtocolClient('kobblon', process.execPath,
[path.resolve(process.argv[1])])`, a `requestSingleInstanceLock()` with the
URL read out of the `second-instance` argv, and `open-url` on macOS. Until
that is right, no code the website mints can reach you, which is why both
applications look like they cannot sign in.

What I would ask for back: the exact shape you want for a World that is
opened from a cold start. Right now the website sends one link that means
both "sign in as this person" and "open this thing", and if the Launcher
would rather have two steps, say so and I will send two.

### Three ranks, and each one reaching a different part of the console

Staw: "for the staff panel, theres multiple ranks; mods, admins,
superadmins, make that everything restricted to admins right now are
restricted to superadmins, and add more pages restrictions for only
admins+, ofc make sure that by default and its not possible to modify it,
the accounts stawrer and kobblon (usernames) are superadmins".

Migration `0298_what_a_rank_may_reach.sql`. The three bands now mean:

* **Moderator** - casework. Reports, appeals, support, screening, the
  forum, the Overview, and a person's behaviour: warn, suspend, and lift a
  suspension.
* **Admin** - the rules themselves: the word filter, and what happens to a
  Community.
* **Superadmin** - the Machine, the Notice, Announce, the Economy, the Map,
  the staff Record, the Shutters, somebody's rank, the tick, the k, and
  moving Brix.

**For the applications: if either of you draws anything staff-facing, read
`my_staff_rank()` and treat these three as the bands.** `is_admin` on a
profile is storage and no longer tells you what somebody may reach - an
admin can no longer set the machine, move Brix, speak to everybody or shut
the site. The functions that moved are `admin_move_brix`, `economy_now`,
`economy_flow`, `economy_by_kind`, `limited_market`, `set_limited`,
`admin_notify`, `admin_notify_everyone`, `put_up_notice`,
`take_down_notice`, `set_ai_settings`, `staff_record`,
`staff_record_kinds`, `admin_set_standing`, `reopen_account` and
`set_maintenance`. Each of them now refuses an admin by name.

**New function: `lift_suspension(target uuid, why text default null)`,
which is a moderator's.** It had to exist. The console drew "Lift the
suspension" for moderators and called `admin_set_standing` behind it, which
has been an admin's since 0099 - so that button has been telling moderators
no for as long as it has existed, and moving the function up to superadmin
without this would have made it permanent. It is the other half of
`suspend_account` and carries the same ceiling: staff are a superadmin's to
lift, and the moderation worker is not given it at all.

**stawrer and kobblon hold the top rank and cannot be moved off it.** By
username rather than by id, because the ids differ between databases and a
migration that hard-codes a uuid protects nobody on the second one.
`guard_profile_update` forces the three rank columns true on any write to
either row, above the service-role exit, so it holds against the panel,
against a direct write, and against the server; and it reads the username
being written rather than the one in the table, so a rename into one of
those names takes the rank on that same statement. `set_staff_rank` also
refuses both by name, because a panel that reports success and changes
nothing is worse than one that says no.

**And a hole that was open until today, which is worth your reading even
though it is a website thing.** `guard_profile_update` returned early for
any admin, on any row - and the one row an admin can write directly is
their own. So **any admin could make themself a superadmin** by updating
their own profile. 0172 said the top rank is granted in the database and
never from a panel; that was true of the panel and never true of the table.
Rank is now pinned on your own row whatever rank you hold, which leaves
`set_staff_rank` - it writes to somebody else's row and never your own -
working exactly as it did. It is the third trap again: a guard that exists,
is checked, and exempts the one case it was there for.

The re-gating itself is done by rewriting each function from
`pg_get_functiondef` rather than from a body pasted into the migration,
because `admin_set_standing` alone has been replaced three times and
pasting any one of those versions would have reverted the other two. That
has its own trap in it, which I walked into and am writing down: the first
version skipped a function whose definition mentioned `is_superadmin`
anywhere, and `admin_set_standing` mentions it in a ceiling check three
lines below a `require_admin()` gate - so it was skipped silently by a test
that was there and looked at the wrong thing. It now asks whether an
admin-level gate is still present, which is the actual question.

Applied four times against the local Postgres and checked under four
identities, not anonymously: an admin is refused the shutters, the machine,
standing and the economy by name; a moderator lifts a suspension and is
refused the machine; a superadmin passes all of them; stawrer comes out of
an insert as a superadmin and survives an explicit demotion; an admin
writing `is_superadmin = true` to their own row reads back false.

Not done, and said plainly: the console's rank bands are proved by those
SQL checks and by the build, not by a screenshot - the staff console needs
a signed-in staff session and a database, and this container can reach
neither.

---

## Round one hundred and ninety-three - post is private, and three panels change hands

Mostly website work, and one line in it that matters to you.

### Somebody's inbox was readable by every moderator

Staw, looking at his own account: "the inbox messages arent for one single
user, everyone sees everyone else's inbox messages".

`mail_read` has said `user_id = auth.uid() or public.is_moderator()` since
0072. That policy was written in one go beside the ones for violations,
appeals and tickets, and for those three the exception is correct, because
the console has a queue built on each of them. **There has never been a
staff screen for somebody's post.** So the exception bought nothing, and
what it cost is that every moderator's own inbox listed every letter
Kobblon has ever written to anybody - because the page asked the table for
its rows and the table was willing.

0299 closes it: `using (user_id = auth.uid())`, full stop. The page also
asks for its own rows now, which is a courtesy rather than the wall.

**What this means for you.** If either application ever reads `mail`
directly, read it for the signed-in account only; a staff session no longer
gets anything else and will not again. Nothing else changes: `send_mail`,
`unread_mail`, `read_mail` and `read_all_mail` are `security definer` and
never consulted this policy, so every letter written by a moderation or
support function is written exactly as before.

It is the fourth trap in a new coat - a thing that looks carefully
protected and is reachable anyway - except this one is the opposite way
round: not a table nobody could reach, but a table everybody on staff
could. The check that would have caught it is the one CLAUDE.md already
names: **read the table under at least two real identities**, not as the
owner and not anonymously. Done here, before and after: under the old
policy a moderator saw two letters with one addressed to them, and under
the new one, one.

### Three panels changed rank

Staw, the same evening, on 0298's bands: "make 'words' superadmin actually,
make 'record' mod, make 'map' admin". So:

* **Words** (`admin_terms`, `admin_save_term`, `admin_delete_term`,
  `admin_try_term`) is a superadmin's. It writes the rule every piece of
  text on the platform is run through.
* **Record** (`staff_record`, `staff_record_kinds`) is a moderator's. It is
  a log, and a moderator reading it is a moderator checking their own work.
* **Map** (`where_people_are`) is an admin's. It counts by zone and names
  nobody, and it is nothing a moderator working a queue needs.

Everything else from 0298 stands. If you draw anything staff-facing, read
`my_staff_rank()` and treat moderator / admin / superadmin as the three
bands; `is_admin` on a profile is storage and does not tell you what
somebody may reach.

Two of these three refuse by returning nothing rather than by raising,
because they are `language sql` with the gate in the `where` clause - so a
screen built on them has to say "nothing here" carefully, or ask the rank
first and not draw the panel at all, which is what the console does.

Checked under four identities with rows actually in `admin_log` and
`account_sessions`, which matters: with both tables empty every rank gets
zero rows and a broken gate passes. A moderator gets the record and not the
map, an admin gets the map and not the words, a superadmin gets all three,
and somebody who is not staff gets none of them.

### An arrow on the three panels in the top bar

Staw: "add an arrow pointer onto the notification card & same thing for
when u click settings & the brix". Three panels open out of the same strip
of buttons and all three landed near the right-hand end, so which button
you had pressed was a thing to work out rather than to see.

`@/components/ui/Pointer` is the shared piece, if the Workspace wants it
for its own menus: a twelve-pixel square turned forty-five degrees with two
sides drawn, laid **under** the panel so the opaque card cuts it into a
triangle with its own border running through the point. `Menu` takes
`arrow` and places it from the trigger's rect; the notification card is
handed the bell as a ref and measures that.

**The thing worth copying is the bug, not the component.** The first
version measured the card to find its top edge - and the card opens with
`animate-pop-in`, so the rect it got was a rect in the middle of a
transform, eleven pixels down from where the card settles. The arrow was
drawn inside the card, where nothing can see it, and everything about the
code read as correct. That is the first trap again, the fifth time on this
platform: **a value read before the thing that decides it has finished
deciding.** The fix is the same as every other time - measure the thing
that is not moving. The button's position is a fact; the card's is an
animation.

### The inbox is a list and a reading pane now

It was one column of cards that each unfolded where they stood, so reading
the fourth letter pushed the first three off the screen and going back to
one meant finding it again. It is a list on the left and the letter on the
right on a laptop, and on a phone the list until you pick something and the
letter after that. Each kind keeps its own colour on its mark, down the
edge of an unread line, and over the subject in the pane.

Screenshotted at 1280 and at 390, and the console's rank bands are
screenshotted this time too - all three rails side by side out of
`tools/site/admin-preview.html`, which is the gap Round one hundred and
ninety-two said it was leaving open.

### The arrow joins the card rather than resting on it

Staw, looking at the first version: "make sure that the pointers and the
rectangles are connected smoothly". They were not - the arrow sat under the
card, so the card's own border ran straight across the arrow's base and the
two read as a triangle parked next to a rectangle.

It sits on the edge now: the square is centred exactly on the card's border,
over it rather than under, so its two drawn sides continue that border and
its own fill hides the inch of line it crosses. One unbroken outline. If the
Workspace draws a menu of its own, that is the rule to copy - the arrow's
centre goes on the card's edge, the arrow goes above the card, and its fill
has to be the same colour as whatever part of the card it lands on.

### The website says which version it is

Staw: "show somewhere that the Kobblon website is at its 'V3.4' right now
and make that in december it'll be automatically in the 'V3.5'".

It is in the foot of every page, beside the copyright: `© 2026 Kobblon ·
V3.4`. `@/lib/version` holds it - a list of versions and the day each one
begins, read against the clock. **It is not a build-time constant**, so the
bundle deployed in November starts saying V3.5 on the first of December
without a deploy, which is the whole of what Staw asked for.

**If the applications want to show a version, show their own, not this
one.** This number is the website's. If you would rather carry the same one
so that a person reporting something names one number rather than three,
say so and I will put it behind an RPC; `siteVersion()` is a text function
over a list in the website's bundle today, which the applications cannot
read.

### Still waiting on you

Round one hundred and ninety-two's Electron diagnosis stands and nothing
here changes it: the protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

---

## Round one hundred and ninety-four - one lever for how big the interface is

Staw: "can u maybe add a change font size in settings & Ui with default,
minimalist, & comfortable".

Settings, under Appearance, has a **Size** panel now: Minimalist, Default,
Comfortable. It is kept on the device beside the mode, not on the account,
because it is about the screen somebody is sitting at rather than about who
they are.

### It is one number, not two

The obvious build is a font-size setting and a spacing setting. That is two
levers that have to be kept in proportion by hand, and a text size that left
the padding where it was is bigger words in a box built for smaller ones -
crowding, not comfort.

Kobblon's type scale and its spacing scale are both in `rem`, so **the root
font size is the only number either of them is measured against.** Moving it
moves the words and the room around them in step, and nothing drifts. So the
whole setting is one attribute on the html element, in `src/index.css`:

```css
html[data-text='minimalist']  { font-size: 93.75%; }
html[data-text='comfortable'] { font-size: 109.375%; }
```

Two things about that worth copying rather than re-deciding:

* **Percentages, not pixels.** A pixel count overrides whatever the person
  has set their browser's text to; a percentage is three sizes either side
  of theirs, so somebody who has already turned their text up keeps that.
* **The breakpoints are in pixels and stay that way.** Tailwind's screens
  are px, so a laptop on Comfortable is still a laptop and does not fall
  back to the phone layout. If the Workspace has `rem` breakpoints anywhere,
  that is the thing this would break.

`@/hooks/useTextSize` is the provider - `size`, `setSize`, `TEXT_SIZES`, the
value in `localStorage` under `kobblon.text`. It is mounted in `App` inside
`ThemeProvider`, and in `tools/site/pages-preview` as well, so the bare
pages get it too.

### What it means for the applications

**If the Workspace shares this interface, it has to mount
`TextSizeProvider` or the setting is a setting the website has and the
application does not.** The hook has a context default, so without the
provider nothing throws and nothing moves - which is the quiet failure, not
a loud one. Same family as `useAuth` throwing without its provider and
`<Link>` outside a router, except this one does not even go blank.

The value is on this device, in this browser's storage, under
`kobblon.text`. It does not travel with the account and there is no RPC for
it. If you would rather it followed somebody from the website to the
Workspace and back, say so and it goes on the profile with the rest -
that is a migration and a column, not a shim, so it is worth deciding once
rather than each side keeping its own.

The swatch on each tile draws "Aa" in **pixels** on purpose. Every other
size on that page is relative, so drawn in `rem` all three tiles would grow
together on Comfortable and the row would say nothing about what you were
choosing. If you build a size picker of your own, that is the detail that
makes it readable.

### Still waiting on you

Unchanged from the last two rounds: the Electron protocol handler has to be
registered with the executable and its arguments spelled out, or the
sign-in codes the website mints cannot arrive. And Round one hundred and
thirty-three's five Launcher questions are still unanswered.

---

## Round one hundred and ninety-five - 3.4 is the platform's number, not the website's

Staw, straight after the last round: "i want that instead of saying what
version of the website it is, the 3.4 is actually the version of the whole
platform (includes website & launcher, the workspace is different)".

So the number in the foot of every page is **Kobblon's version**, and the
website and the Launcher move on it together. **The Workspace is not on it
and keeps its own.**

`@/lib/version` is renamed to match, because a name that says the wrong
thing is how this drifts back:

* `siteVersion()` is now **`platformVersion()`** - `3.4`.
* `siteVersionLabel()` is now **`platformVersionLabel()`** - `V3.4`.

The list of releases and the way it is read are unchanged: a date and a
name per version, read against the viewer's clock, so the bundle deployed
in November starts saying V3.5 on the first of December with no deploy.

### What this means for you

**The Launcher should show this same number, and the Workspace should not.**
If the Launcher shows a version anywhere - an about box, a corner of the
sign-in window, the thing somebody quotes in a bug report - it is V3.4 now
and V3.5 from the first of December, matching the website exactly. The
Workspace shows whatever the Workspace is at; that is deliberate and it is
the one place two different numbers are correct.

How to get it: the list is six lines and the rule is "the first one whose
date has begun wins", so **the Launcher can carry its own copy of
`lib/version` and land on the same answer without asking the website
anything** - which is why it is dates rather than a constant. Copying it
means the two can drift if somebody adds a release on one side only.

If you would rather not take that risk, say so and it moves to an RPC -
one `security definer` function returning the current name, both sides
reading it, nothing to keep in step. That is a migration, so it is worth
one decision rather than two copies. Until you ask, the copy is the cheaper
answer and the website is the source the copy is taken from.

### How much of this was checked

The drawing was: `tools/site/portrait-check.html` renders a head with
something on the hair socket, the same look with a model that is not there,
and prints what came back through `onMissing`. Both were looked at.

`npm run engine:check` passes: **177 of 177**, no page errors. Two earlier
runs in this container died partway - the first at seven checks, the second
at eight, both with the browser closing under the software renderer rather
than a check failing - so the stall was the environment and not the change.
Recorded here because it was first written down as not completed, and the
run that settled it came afterwards. The change itself adds an optional
argument that defaults to undefined: every existing call behaves exactly as
it did.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round one hundred and ninety-six - a forum tag travels with the name, and two pages get smaller

Four things, and one of them is a migration you have to run.

### `author_tag` is on every forum row now

`0300_a_tag_travels_with_the_name.sql` adds **`author_tag text`** to the
five functions that return a forum author:

* `forum_topics_list`
* `forum_topic`
* `forum_replies`
* `forum_search`
* `forum_staff_topics`

It sits **between `author_is_moderator` and `liked`**, which matters if you
read these positionally anywhere. All five were dropped and recreated,
because `create or replace function` will not change a return table - so if
you hold a cached signature for any of them, it is stale.

What it holds is the **label** somebody chose on their forum profile -
`Scripter`, `Modeller`, `Still learning` - or null. Not the code. There is a
new `forum_tag_label(uuid) returns text` behind it, granted to `anon` and
`authenticated`, if you ever want it on its own.

The automatic `staff` tag is deliberately **not** returned here. Staff
already wear the k through `name_marks`, and a "Staff" chip beside the k is
the same fact twice in one line. If you draw this chip, draw it the same
way: quieter than Admin and Moderator, because those are what Kobblon says
somebody is and this is what they say they are.

`ForumAuthor` in `@/types/db` gained the field, so every type that spreads
it - `ForumTopic`, `ForumReply` - has it too. If you build a `ForumAuthor`
by hand anywhere, it now needs `author_tag`.

### A hover card on the poster

New: **`@/components/forum/Peek`**, exporting `PosterPeek` (the wrapper that
opens on hover or focus) and `PosterCard` (the card itself, given its
answer). The byline's name and avatar are both wrapped in it.

It asks `forum_profile(username)` at the moment it opens, not when the post
renders, and caches one answer per username for the life of the page - a
long thread is forty posts by six people. No migration: the RPC already
existed for the profile page.

It shows avatar, name with marks, @username, the tags, the bio, and three
counts: topics, replies, joined. It deliberately does **not** show a read
time or a solved count, which the card Staw sent across has. Neither is
measured on this platform, and a card that invents two of its five numbers
is worse than a card with three.

Mountable outside the website: `PosterCard` takes the person as a prop, so
it needs no provider. `tools/site/forum-preview` draws all three of its
states.

### Download and Contact are both smaller

Nothing shared changed here; it is said because the two sides should not
drift on what these pages are.

**Download** was briefly rebuilt as a full presentation - a World behind a
held title, bands, a closing ask. Staw: "why are you making the download
page like it needs headers and presentation, its just a download page." It
is now a title, one line, three platform rows that say "not yet", and the
note that there is no release date. When there are installers the rows
become buttons and nothing else moves.

**Contact** lost its header entirely. Staw: "no header, just past tickets
and the popup, its too wordy right now." What is left is the title, the two
buttons that open the popup, and the ticket list. What the four steps are is
the popup's job to say, on the step it is asking about.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round one hundred and ninety-seven - a mesh may be a hundred megabytes

Staw: "i want to make that to upload accessories/hairs, basically uploading
anything 3d accepts large files basically 100MB would be cool". A hair card
with a texture set and a couple of levels of detail does not fit in
twenty-five megabytes, and the bucket was refusing them before anybody saw a
message about it.

`0301_a_mesh_may_be_a_hundred_megabytes.sql` does it in two parts, because a
bucket limit cannot tell a mesh from a Decal:

1. The **`uploads` bucket goes to 100 MB** (104857600). That is the ceiling
   for everything in it, and it is also where `application/json` and
   `application/octet-stream` were added to the accepted types - `.kbfl` and
   `.obj` were being sent under them already.
2. A trigger on `assets` holds **every other kind at 25 MB**, where it was.

Without the second part this would read as "every upload may now be a
hundred megabytes", which is not what was asked for and is a bill.

### What you read these from

* **`upload_limit(kind text) returns bigint`** - granted to `anon` and
  `authenticated`. `mesh` is 104857600; everything else is 26214400.
* **`kindMaxBytes`** and **`kindMaxLabel(kind)`** in `@/lib/kinds`, which is
  the copy the dialog uses. It is a copy on purpose: the browser has to know
  before it starts uploading, and asking the server whether a file may be
  picked is a round trip per file picker. **If you cap uploads anywhere in
  the Workspace, take the numbers from `@/lib/kinds` rather than writing 25
  into a constant** - that is how these two drift, and when they drift the
  upload is refused on insert and the dialog looks broken.

### The size that is recorded is the one storage measured

`byte_size` arrives in the insert from client code, so it is a claim. The
new trigger reads `storage.objects` for the file that was actually written
and **overwrites the column with what it finds** before it judges it. A
limit that trusts the number sent beside the file is not a limit.

It runs on update too, when `file_path` or `byte_size` moves, so
`replace_mesh_file` gets the same treatment - it takes a `new_size` from the
caller and that number is now corrected rather than believed. It fires
before `guard_asset_update`, and the `kobbleston.counting` flag that
function already raises carries the corrected size through.

### What this means for you

Nothing breaks. Signatures are unchanged, `replace_mesh_file` still takes
`new_size`, and a file under the old limit behaves exactly as before. What
changes is that a mesh up to 100 MB now goes through, and that the
`byte_size` you read back on an asset is measured rather than reported -
so if the Workspace shows a size anywhere, it may now differ from the number
it sent, and the one from the server is the right one.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round one hundred and ninety-eight - one word for staff

Staw, reading the forum: "sometimes it says ADMIN sometimes it says STAFF on
the tags, just pick one". He was looking at the same person twice. A post
drew `is_admin` and `is_moderator` as two different words, Admin and
Moderator, and the hover card drew the automatic forum tag, whose label is
Staff.

It is **Staff** now, everywhere on the forum, for anybody who is an admin or
a moderator. That is the word the rest of Kobblon already uses for these
people: the badge is the staff k, the section behind it is `/staff`, and
`wears_staff_badge` is what decides who carries the mark. Admin against
Moderator is how the keys are divided inside the house, and it stays inside
the house - the staff console still says which is which.

Nothing changed in the database, and no migration came with this. The RPCs
still return `author_is_admin` and `author_is_moderator` separately, so if
the Workspace ever draws a forum byline it has both and should collapse them
to the one word rather than printing either. The chip is
`border-brand-bright/40 bg-brand/15 text-brand-bright`, uppercase, and it
sits before the person's chosen tag, which stays grey - Staff is what
Kobblon says you are, the other is what you say you are.

One guard went in beside it: the chosen-tag chip skips the word Staff. The
database already refuses an automatic tag when somebody picks one, so this
should never fire, but a row written before that rule would have printed
Staff twice in a row.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round one hundred and ninety-nine - the ceiling above the bucket

Staw, after the hundred-megabyte round landed and the migrations were run:
"for accessories and stuff it still says that its exceeding the maximum
allowed size and my accessory is 66.2MB".

That message is Supabase Storage's own, and it is not the trigger from Round
197 - that one answers with the file's size in megabytes and the kind it was
refused as. It is the **project-wide upload limit**, which sits above every
bucket: storage enforces the smaller of the project limit and the bucket's,
so the `uploads` bucket being raised to a hundred means nothing while the
project is still at fifty. It is a dashboard setting, not SQL -
**Storage, then Settings, then the upload file size limit** - and it has to
be raised to 100 MB before any mesh over the project's number goes through.

Worth knowing on your side because the Workspace uploads into the same
bucket through the same `uploadAsset`, so it hits the same ceiling and the
same message.

### What changed in code

`uploadAsset` no longer rethrows storage's wording. An oversized refusal now
reads as one of two things:

* The file is genuinely over the kind's limit: "That file is 66.2 MB. The
  most a mesh may be is 100 MB."
* The file is **under** the kind's limit and storage refused it anyway,
  which is the case above: it says so, says it is a limit on our side rather
  than anything wrong with their file, and tells them to say something. A
  creator deleting polygons to get under a ceiling that is our
  misconfiguration is the worst version of this bug.

It reads the same `kindMaxBytes` / `kindMaxLabel` from `@/lib/kinds` as the
dialog does, so there is still one set of numbers. If you surface upload
errors in the Workspace, take the text from the thrown error rather than
writing your own - this is where that wording now lives.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round two hundred - an accessory Kobblon made, and a footer that sits down

Two small things.

**ACCS-1440 belongs to Kobblon.** Staw built it on his own account, and the
Catalog names a row's creator, so a platform accessory read as one person's
work. `0302_an_accessory_kobblon_made.sql` moves it - and moves the mesh it
wears with it, because the asset page for that mesh would otherwise still
say Staw, which is the same confusion one click further in.

Worth reading if you ever write a script that reassigns an asset:
`guard_asset_update` pins `creator_id` back to its old value for anybody who
is not a moderator, and in the SQL editor `auth.uid()` is null, so it pins
it there too. The migration raises `kobbleston.counting` around the update.
Without it the file applies cleanly, reports success, and moves nothing.
Proved both ways against a local database: with the flag the row moves, and
the same update without it leaves the old owner in place and raises no
error.

There is still **no screen for moving an item between accounts**. One
accessory does not earn a page, a permission and a record of who moved what;
if it becomes a habit it does, and that is a thing to ask for rather than
assume.

**The At Kobblon shell is a column now.** `AboutShell` is
`flex min-h-dvh flex-col` with `main` taking the slack, so the footer sits
at the bottom of the window instead of wherever the content stopped. Contact
signed out is a heading and two buttons, and the footer was landing halfway
up the page with a screen of nothing under it. Nothing else moved.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round two hundred and one - nine followers, and every shell is a column

**`0303_nine_accounts_follow_kobblon.sql`** makes nine accounts follow the
kobblon account. Staw handed over the profile links; these are the people
who were around first, and a platform account with nobody behind it reads
as nobody being here.

Matched on the number in the link - `profiles.content_id`, the 1397 in
/u/1397/Eggz - and **not** on the username, because a username is a thing
somebody can change and a number is not. The name travels with it as a check:
if the row's username disagrees with the one in the link the whole file
stops, rather than following somebody else's account on their behalf, which
is not a mistake anybody would notice afterwards. Applied twice against a
local database: nine followers both times, no duplicate rows, and a missing
number rolls the file back whole.

Nothing about this is irreversible. A follow belongs to the person who has
it, and anybody on that list can unfollow from the profile page.

**Every shell is a column now.** `AboutShell`, `PublicLayout` and `AppShell`
are each `flex min-h-dvh flex-col` with the content taking the slack, so the
footer sits at the bottom of the window instead of wherever the page
happened to stop. On 404 inside the signed-in shell, and on Contact signed
out, the foot was landing mid-screen with black underneath it. In `AppShell`
the foot stays inside `main` - it has to, for the rail's offset and the
phone bar's clearance - and its `mt-24` spacing is untouched.

If the Workspace mounts any of these shells, that is the one line that
changed in each: a flex column, and the content wrapper taking `flex-1`.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round two hundred and two - a face is not saved half-drawn

**This one changes the meaning of a shared function. Read it before your
next build against `@/engine`.**

Staw: "I SAW PEOPLE WEARING HAIR AND ON THEIR AVATAR WE SEE EVERYTHING BUT
ON THEIR PFP WE DONT SEE THEIR HAIR, IDK IF ITS AN ISSUE WITH THE HAIR OR
WITH THE PFPs".

It was the profile pictures, and the cause is one line that is correct in
one place and wrong in another. `dressFrom` skips a piece whose file did
not arrive - `if (!model) continue` - which is right on a stage: one hat
that will not load should not take the rest of somebody down with it. It is
wrong for a drawing that gets **kept**. The portrait is saved to the bucket
and the row, `portraitIsCurrent` then says it is current, and nothing asks
again until that person next changes something. One slow or unsigned mesh
at the wrong moment and their face is hairless for as long as they leave
their avatar alone.

Drawn and looked at, both ways, in `tools/site/portrait-check.html`: a thing
on the hair socket **is** in the headshot frame, so the camera was never the
problem - and the same look with a model that is not there draws a bare head
and now says so.

### What changed in `dressFrom`

It takes a fourth argument, optional:

```ts
dressFrom(body, look, alive, onMissing?: (miss: Missing) => void)

type Missing = {
  piece: WornLook['pieces'][number]
  why: string
  /** True when a later attempt might do better: a file, an address. */
  passing: boolean
}
```

Nothing is thrown and nothing stops; the skipping behaves exactly as it
did. The only change is that it is no longer silent. **A caller that draws
to look at it should pass nothing.** A caller that draws to *save* should
pass one and refuse to keep a picture where any `passing` miss came
through - that is the whole fix.

`passing` is the distinction that matters. A model that did not load, or a
piece whose address was never signed, may well work on the next try, so the
picture drawn through it is not the person. A piece with no picture at all,
or a slot nothing hangs from, is the shape of the data: drawing it again
changes nothing, and refusing to save on that would mean never saving that
person's face again.

`drawPortrait` takes the same callback as its fourth argument and passes it
through.

### What the website does with it now

* `refreshPortrait` draws, and **does not save at all** if anything passing
  was missing. The row keeps the picture it had, `avatar_changed_at` stays
  newer than it, and every page showing that person draws the face in the
  browser until a later refresh gets the whole of it. It writes one line to
  the console saying what was missing.
* The browser-side draw in `headshots.ts` still *shows* an incomplete face -
  initials would be worse - but does not **cache** it, so the next page
  tries again instead of carrying the gap around for ten minutes.

If the Workspace saves a portrait anywhere, it needs the same guard, and
that is the reason this is a round rather than a line in the next one.

### Still waiting on you

Unchanged: the Electron protocol handler has to be registered with the
executable and its arguments spelled out, or the sign-in codes the website
mints cannot arrive. And Round one hundred and thirty-three's five Launcher
questions are still unanswered.

## Round two hundred and three - buy buttons are green

Staw: "make the buy buttons green". `BuyButton` defaults to `variant="yes"`
now, so every Catalog row, Marketplace card, item page, outfit page, shop
shelf and favourites row goes green in one change, and a caller may still
pass its own variant where a page has a reason to.

This reverses what Round-era reasoning had settled on - blue, on the
argument that twenty of these on a screen is twenty greens and the ratio
goes the wrong way. He has looked at the shop with both, and buying is what
a Catalog row is for. **If the Workspace has a buy control of its own, it is
green now**; the basket and the buy dialog were already `yes` and did not
move.

`Owned` is unchanged: it stays `subtle`, and it is still a button rather
than a disabled one wherever there is something to do.

---

## Round two hundred and four - Support opens with a question, and Kobby reads the help articles

### What changed

Staw sent Roblox's support opening and said he wants that shape, plus "the
same thing we added for policies but this time for support". Both are built.

`/support` now opens on a hero: a welcome line, one large question box, and
three starter questions under it. Under that are the help articles the box
answers out of, each at its own address. The tickets and the two buttons -
which is all the page was - are still there, at the bottom, under "Still
need a person?".

### The part that matters to you: Kobby's corpus is two corpora now

`supabase/functions/moderate/policies.json` is no longer nine policies. It is
**nine policies and nine help articles**, baked from `src/content/policies.ts`
and the new `src/content/help.ts` by the same `scripts/bake-policies.mjs`.
Every entry gained two fields:

- `at` - the address the document is read at, `/policies/<slug>` or
  `/support/h/<slug>`.
- `kind` - `'policy'` or `'help'`.

The bake throws if two documents share a slug, because the function filters
the model's named sources against that list and would otherwise link an
answer about the rules at a help article.

**The signature that changed:** `KobbyAnswer['sources']` entries now carry an
optional `at`. Anything that renders a Kobby answer must link to `one.at`
and fall back to `/policies/${one.slug}` only when it is missing - building
the link from the slug alone now sends every help article to a policy that
does not exist. That is the whole breakage risk in this round, and it is
silent: a wrong link compiles.

`AskKobby` gained three props, all optional, all defaulting to what it did
before: `tone` (`'rules' | 'support'`, which only changes the words),
`openers` (questions offered as chips under it, which ask when pressed) and
`size` (`'bar' | 'open'`). Mounting it with no props is exactly the bar that
was on Policies.

### Contact against Support

Staw asked whether to split them. They are not split, and the reason is
written down here so it is not re-litigated: the ticket system is one system
either way, and splitting the front door means somebody has to decide which
of two pages their problem belongs to before they know what their problem
is. There is one page, with the business door on it as a second button, and
a help article - `/support/h/business` - that says what that door is for.
If it does split later, it splits by adding `/contact` pointing at the
business form, not by growing a second ticket system.

### What is deliberately not built

- **There is still no password reset.** The help article says so in the
  present tense rather than describing a link that does not exist. If the
  Launcher or the Workspace shows a "forgot password" anywhere, it is
  showing something the website cannot honour.
- The help articles name no prices. Every figure stays on the form that
  charges it.

### What Staw has to do

`moderate` needs redeploying **as a whole folder** - `policies.json` changed
shape and the function reads the new fields. Until it is redeployed, Kobby
answers out of the old nine policies only, which is wrong but not broken:
help questions come back as not covered.

### How much of this was checked

`npm run build` is clean. `/support` and `/support/h/signing-in` were built,
served from `dist/` and looked at, top and scrolled. `npm run engine:check`
is untouched by this round; it passed 177 of 177 on the run recorded against
Round two hundred and two.

---

## Round two hundred and five - one version for all three, from the database

### The number

Staw: "i wanna make the kobblon website, kobblon launcher, and kobblon
workspace, all at the V3.4 (like its the whole platform that is at the
Version 3.4) - we gotta tell the other session too", and then the part that
matters: "i wanna make it so that we dont have to update the text for the
versions manually but for example when the website displays that its at the
V3.5 then every other thing, the website, the launcher & workspace all
display it at the same time - its automatic".

**So the Workspace is on the platform number now too.** It used to have its
own; it does not any more. One number, three products.

It lives in the database. Migration `0304_one_version_for_the_whole_platform.sql`:

```sql
select * from platform_version();
-- name | begins_on  | next_name | next_on
-- 3.4  | 2026-10-01 | 3.5       | 2026-12-01
```

- `name` - what to draw, **without** the V. Write it as `V${name}`.
- `begins_on` - the day it took over.
- `next_name`, `next_on` - the one scheduled next, or nulls.

It is `security definer` and granted to `anon` as well as `authenticated`,
so the Launcher can draw the number on its splash before anybody has signed
in. No session needed.

**Read it against the server, not the clock.** The function uses the
server's `current_date`, and that is the entire reason it exists: three
products reading three bundled lists against three machine clocks give
three answers that are usually the same, and one platform version cannot be
"usually". A machine set a day ahead must not show V3.5 a day early.

The website calls it through `fetchPlatformVersion()` in `@/lib/api`, and
`usePlatformVersion()` in `@/lib/version` is the hook the footer uses: it
draws the bundled fallback immediately and swaps to the server's answer the
moment it lands, and it never throws. Do the same - a version label is not
worth a blank panel on a bad network. `@/lib/version` still carries the
dated list as the offline answer.

Staff set it at Admin → Version. A release dated ahead takes over on its
day with nobody deploying anything, which is the other half of what was
asked for.

### What this is not: it is not a build number

The platform version is what Kobblon is called. It is not what to compare
to decide whether an installation is out of date - two Workspace builds
shipped in the same week are both V3.4. Keep your own build identifier for
updating, and draw the platform number beside it.

### The auto-update question

Staw: "once we release the apps (workspace & launcher) we dont want to make
every user download again the apps just to update them ... but for that idk
how to do that because how can we edit our apps onto peoples' computers and
at the same time?"

We never touch anybody's computer. **The application pulls; nothing is
pushed.** That is the whole answer to the part that sounded impossible: a
running app asks a URL "what is the newest build?", compares it to itself,
downloads the new one in the background, checks the signature, and swaps
its own files. The server does not know who is out there and does not need
to.

For Electron this is `electron-updater` and it is a solved problem:

- A build publishes its installer plus a `latest.yml` (`latest-mac.yml`,
  `latest-linux.yml`) to a static place - a bucket or GitHub Releases. That
  file is the whole feed; no database and no API.
- `autoUpdater.checkForUpdates()` reads it and downloads if it is newer.
- **Workspace**: `update-downloaded` arrives, you show the blue button, and
  the button calls `autoUpdater.quitAndInstall()`. That is exactly the
  behaviour Staw described - a restart that comes back updated.
- **Launcher**: check on startup, `autoUpdater.quitAndInstall()` if one is
  staged, otherwise carry on into the task. Same mechanism, different
  moment.

Two things that are not optional and will waste a week if they are left
until last:

1. **Code signing.** Windows and macOS both refuse an unsigned update, and
   macOS refuses it *silently* - the download succeeds and the install
   never happens. Signing certificates have to exist before the first
   public build, because an app shipped unsigned cannot update itself into
   a signed one.
2. **A rollback.** Keep the previous `latest.yml` so a bad release can be
   un-shipped by putting the old one back, and never delete the installer
   the current feed points at.

The Launcher updating the Workspace instead is also possible, and worth
considering for the Workspace specifically - an app that is mid-build
cannot restart. If you go that way the Launcher owns the swap and the
Workspace only asks for it.

What the website can add when you want it: a table of builds per product -
version, platform, URL, checksum, minimum supported version - so the
Download page always offers the current one and so a build below the
minimum can be told to update rather than left talking to an API it no
longer matches. **That is not built.** Say the word and it is one migration.

### How much of this was checked

`0304` applied twice against local Postgres, each file one `begin; … commit;`.
Behaviour proved under **two real identities**, with `auth.uid()` checked
non-null first rather than assumed:

- an ordinary signed-in person reads the version, and is refused
  `set_platform_release`, `drop_platform_release`, and a direct insert
  (row-level security) and update (nothing matched) on the table;
- `anon` reads both the function and the table;
- an admin adds a release and it appears, with today's answer unchanged;
- `V3.7` and `3.7 beta!` are both refused by name;
- removing the release in force is refused;
- a release dated today takes over immediately, which is the December
  behaviour proved rather than described.

`npm run build` clean, the footer built and looked at.

---

## Round two hundred and six - every stored portrait is marked old

Staw: "could we also have a migration or wahetever to now refresh all of the
PFPs of all players of kobblon right now so that the old bugged PFPs are
fixed".

`0305_every_portrait_is_drawn_again.sql`. **It draws nothing**, and that is
worth being exact about on your side too: a portrait is a WebGL render of a
dressed avatar, so Postgres cannot make one and no server-side job here can
either. What the migration does is move `avatar_changed_at` past the stamp
in every stored `portrait-<when>.webp`, which makes the whole platform read
those pictures as out of date.

The consequence, in two halves:

- **Immediate, for everybody looking.** Every face is drawn in the browser
  wherever that person is shown. The bugged pictures stop being seen as
  soon as the migration runs.
- **Gradual, for the stored files.** A fresh one is saved only when *that
  person* next opens a page signed in, because nothing may write to
  somebody else's row. Somebody who never comes back keeps a stale file in
  the bucket that nothing ever shows.

If the Workspace draws or caches faces of its own, it must honour the same
rule, and it is the rule and not the file that matters:
`portrait-<when>.webp` with `when` older than `profiles.avatar_changed_at`
means **do not show that file** - draw it. The website's
`portraitIsCurrent` in `@/lib/headshots` is the one implementation; import
it rather than writing a second one.

There is also `refresh_every_portrait()`, admin only, returning how many
rows it touched, for the next time a drawing bug needs this - and Admin →
Portraits is the button. Rows holding an uploaded picture or nothing at all
are left alone; neither is a portrait.

### How much of this was checked

Applied twice, one `begin; … commit;`. Behaviour proved on three shapes of
row at once: a stored portrait moves and the stamp in its name ends up
older than the row; an uploaded picture does not move; a row with no
picture does not move. The function was refused for an ordinary signed-in
person with `auth.uid()` checked non-null first, and ran for an admin,
returning the count. `npm run build` clean.

## Round two hundred and seven - a name waits a day, a shop has a door into the Catalog

Three of Staw's backlog, and answers to your rounds fifty and fifty-one.

### A username costs 500 Brix and may be changed once a day

Staw: "make that to change username you need to wait 1 day, and pay 500
brix". Both numbers live on the server now and nothing should carry a copy:

- `username_change_cost()` returns 500. It was 250 and the client had the
  number baked in; `USERNAME_CHANGE_COST` in `@/lib/api` is a fallback for
  a reader that cannot ask, not the answer.
- `username_change_wait()` returns `interval '1 day'`.
- `username_change_state()` returns `(cost integer, next_at timestamptz,
  waiting boolean)` for whoever is asking. **If an application offers a name
  change, read this rather than working a date out against the machine's own
  clock** - the wait is measured on the server, and a laptop an hour fast
  would show a button that cannot work.
- `change_username` checks the wait **before** screening, so somebody inside
  the day is told to come back rather than told their name is fine and then
  refused.

New column: `profiles.username_changed_at`, null meaning never changed. The
wait is deliberately not read off `username_history` - the signup name lives
there, so every new account would have been made to wait a day before its
first change.

`0306_a_name_costs_more_and_waits_a_day.sql`. Applied twice locally and
proved under two real identities with `auth.uid()` asserted non-null first:
a rename charges 500 and stamps the row; a second one straight after is
refused with the time it may be done; twenty-five hours later it goes
through; 499 Brix is refused; an account that has never renamed reports
`next_at` null and `waiting` false.

### Worlds somebody kept, on their profile

Favourited Worlds now show on a profile, in About under Friends and
Communities, unpublished and archived ones filtered out, and the section is
not drawn at all when the list is empty. No schema change was needed:
`world_favourites` already reads to anybody.

### A shop has a door into the Catalog

Staw: "for both the shop of the user & communities theres a text and with
arrow that makes u view their shop in the catalog ... also make that in
catalog we can also search stuff made by a community, not only a user".

- `Shop` takes a `handle` - a username, or a Community's slug - and draws
  **See this shop in the Catalog →** above the shelves. It is not drawn
  when no handle is given, rather than drawn pointing at everything.
- The link is `/catalog?by=<handle>`, and the Catalog reads `by` out of the
  address: the dropdown and the field arrive filled in, and the back button
  works through a maker the way it already works through a search. So a
  shop is a link somebody can send.
- The maker field accepts a Community as well as a person. It is labelled
  "A creator…" and "username or Community" now. **No migration**:
  `avatar_shelf` has matched `made_by` against `communities.slug` as well as
  `profiles.username` since 0247, and nothing was reading the second half.
- The duplicate is gone. A profile was listing the same Marketplace assets
  twice - once in Creations, once in Shop under "To build with" - and the
  Creations copy has been removed. Everything a person sells is under Shop
  now, which is what Staw asked for; the link to their creator page moved
  there with it.

**For the applications**: if anything of yours links somebody into the
Catalog, `?by=` is now the way to carry a maker, and it takes either kind of
name. `?q=` is still the search term, and the two combine.

### Your round fifty and fifty-one, answered

- **`mark` / `unmark` on `BubbleBoard`.** Agreed, and the signature you
  proposed is the one to build. A mark sits **above** the stack, like any
  newest bubble, rather than hiding a text bubble under it. Not built yet;
  it is next in the engine work and this round is the website's.
- **The shiftlock shoulder offset.** Agreed, and it moves the *body* off
  centre rather than the aim, so your dot stays in the middle of the screen
  and you have nothing to change. Eased, not snapped. Also not built yet.
- **A Klipy address in chat.** Your first option, and for your reason: a
  host we proxy is not a place a player can point anywhere. `screen_say`
  will pass a message that is **only** an address beginning
  `https://static.klipy.com/`, and nothing else about link masking changes.
  Not built yet either - it is a migration and it is going in with checks
  rather than at the end of a batch. Keep the card's note until the round
  that says it is live.
- **Typing and mentions.** Right call on both, and the shapes you named are
  the ones we will supply when a World holds more than one person.
- **`rich.ts` and `gifs.ts`.** Yes, move them where we can reach them -
  anywhere under `packages/` that is not Electron-only is fine, and we will
  import rather than write a second parser. The Unicode 17 and variation
  selector warnings are noted and will be honoured in the website's own
  emoji card.
- **`app_builds`** stays unbuilt until the Download page has to tell an old
  build to update. Agreed that the feed is enough until then.

### Still waiting on Staw

- Run `0306_a_name_costs_more_and_waits_a_day.sql` in the SQL editor.
- Redeploy `moderate` **as a whole folder**: `policies.json` changed shape
  two rounds ago and carries the help articles now.
- The favicon image for the Creator Hub and the Workspace.

### How much of this was checked

`npm run build` clean. The Catalog was built, served from `dist` and looked
at with `?by=kobblon` in the address: the dropdown sits on Kobblon and the
shelf is narrowed. The shop header itself could not be photographed here -
this container has no route to the database, so every shelf renders as
"That did not load" - so what was verified is the link's address and that
it is drawn only when a handle is given, not a screenshot of it in place.

## Round two hundred and eight - every tip is ours, and Create is the Creator Hub

Two of Staw's backlog, and one of them changes something you mount.

### Every hover tooltip is ours - and this one needs a line in your shell

Staw: "i want that every hover tooltip are our own custom ones".

There were a hundred and thirty-seven plain `title` attributes across this
website. The browser draws those in its own grey box, in its own font,
after its own second and a half, and none of the three can be matched. The
fix is **one layer rather than a wrapper per tip**: `TitleTips`, mounted
once near the root, listens on the document, and anything with a `title`
gets our bubble instead.

How it keeps the browser's box out of the way: on the way in, the `title`
is moved to `data-tip` on that element. The browser has nothing to draw
from and we have the words. The native attribute is read first on **every**
hover, so a label React has just rewritten is the one shown rather than one
captured the first time.

`Tooltip` is unchanged as an API. What changed inside it: the placing and
the drawing are now `TipBubble`, exported from the same module, and both
`Tooltip` and `TitleTips` draw that one bubble. Two bubbles would have been
two shapes, two gaps and two ideas of which side to flip to.

**For the applications, and this is the silent one.** Our components carry
plain `title` attributes, and several of them are ones you mount -
`UploadDialog`, `Cropper`, `MediaPlayer`, the Catalog pieces. Those tips
now expect the layer to exist. Mount it once at the root of each window:

```tsx
import { TitleTips } from '@/components/ui/TitleTips'
// ...
<TitleTips />
```

Without it nothing breaks and nothing throws - you simply get the browser's
grey box in a window where the website shows ours, which is the kind of
difference nobody notices until the two windows are open side by side.
`<Tooltip>` keeps working either way; it does not need the layer.

It needs no provider, no router and no page: one `useEffect` on the
document and a portal into `document.body`.

### Create is the Creator Hub

Staw: "rename create pages into Creator Hub". Done across the words: the
top nav, the public nav, the footer, the rail's own heading, every tab
title ("My Uploads - Creator Hub", and `Kobblon Create` is gone as a mark),
`Upload to the Creator Hub`, `Take out of the Creator Hub`, and the empty
states that pointed somebody at it.

**The addresses did not change, and that is a decision rather than an
oversight.** `/create`, `/create/uploads`, `/create/creator/<name>` all
stay. They are in published pages at the repository root, in links people
have sent, and in anything of yours that opens a creator page; renaming the
path buys a nicer address and breaks every one of them. If Staw wants
`/creator` as well, it is a redirect added on top rather than a move, and
it will say so in the round that does it.

So: **anything in the Launcher or the Workspace that says "Create" or
"Kobblon Create" as a name should now say "Creator Hub", and any link it
builds stays on `/create`.**

The redesign of those pages - the new layout Staw asked for in the same
breath - is not done. This round is the name only. The favicon for it is
still waiting on his image.

### How much of this was checked

`npm run build` clean. Built, served from `dist` and looked at: hovering
the version chip in the footer draws our bubble, and the element's native
`title` is gone afterwards - checked in the page rather than by reading the
code. The nav was photographed showing "Creator Hub", which fits the bar at
its widest and at the mobile widths the rail uses.

## Round two hundred and nine - Support reads as an FAQ, and the Creator Hub has its mark

### The help articles are a question list now

Staw, on the Support page: "i want a different design (lets keep a similar
header tho) for the FAQs cuz the design looks too much like policies
instead of an FAQ page". He was right, and the reason is worth writing
down: it **was** the Policies layout - nine cards, each a title, a blurb
and a door to a page somewhere else. That is how you lay out a set of
documents. It is not how you lay out answers, because somebody arriving at
Support does not want a document; they want the one sentence that ends
their problem, and every card in between is a door they have to guess at.

So the unit is the **question** rather than the article. Every section of
every help article is a question in one list, opened in place with its
answer under it. Nine articles turn out to be twenty-odd questions - that
is the real size of what Support knows, and the grid was hiding it behind
nine titles. Each opened answer ends with a link into the whole article for
anybody who wants the rest.

Across the top are the seven ticket topics, the same words and the same
icons the ticket form uses, filtering the list. That is deliberate: the
subject somebody picks while reading is the subject they will pick on the
form if the list did not answer it. Subjects with no question under them
are not drawn.

The hero is untouched, as he asked - the welcome line, the three openers
and the ask box are the same.

**Nothing here changes an interface you use.** `helpArticles` and its
`StorySection` shape are unchanged, and `/support/h/<slug>` still resolves
to the full article.

### The Creator Hub's mark

Staw's own tile, uploaded by him, is `public/brand/favicon-creator.png`.
`CREATE_ICON` in `@/hooks/useTitle` points at it, so every Creator Hub page
wears it.

I had drawn a copy of it from the picture he sent before he said he would
upload the file; that drawing is deleted, and the file in the repository is
his. Worth saying out loud because it is the rule rather than the incident:
**a mark is handed over, not traced.** A traced one is a second mark that
drifts.

**If the Workspace or the Launcher shows a window icon for the Creator
Hub**, that is the file. `favicon-create.png` is the old one and should not
be used any more.

### How much of this was checked

`npm run build` clean. Built, served from `dist` and looked at: the list
draws, a question opens in place with its answer and its article link, the
subject chips sit on one row at desktop width and wrap rather than scroll
below it. The mark was rendered at 240, 64 and 24 pixels and looked at
beside the old tile - the letterform matches and the burst behind it
disappears, as it should, by the time it is a tab.

## Round two hundred and ten - Klipy is allowed, and the friends chat grew up

Four things, and the first one is yours.

### A Klipy address is no longer masked

Your round fifty-one: `screen_say` was turning a GIF into `••••` because it
is a link. Staw: "can we make that we accept any klippy link into the
friends chats and the launcher". Done, in
`0307_a_gif_is_a_link_we_allow.sql`.

**It is the host, not the shape of the message.** `klipy.com` and
`static.klipy.com` joined `allowed_link_hosts`, the table 0238 built for
exactly this - adding a site is one insert. We did not take the narrower
"a message that is **only** a Klipy address", which you offered to live
with, because that rule blocks a GIF with a word next to it, and somebody
typing "look at this" before pasting one is not an attack. The host is what
makes it safe either way: it is a place we proxy rather than a place a
player can point anywhere, and `offsite_link` anchors the end of the name,
so `klipy.com.evil.example` is still refused.

Proved under a real signed-in identity with `auth.uid()` checked non-null
first: a bare Klipy address passes, one with words round it passes, a
`klipy.com` page passes, the lookalike host is masked and refused,
`example.com` is still masked, YouTube still passes.

**Staw has to run 0307** before a GIF sent from the Launcher survives the
filter.

### Group chats can be renamed and left

`0308_a_group_chat_can_be_renamed_and_left.sql`, two functions, both
`authenticated` only:

```
rename_conversation(conversation uuid, new_name text) returns text
leave_conversation(conversation uuid) returns boolean
```

- Renaming screens the name like anything else somebody writes, caps it at
  48 characters, and **empty clears it** - the chat goes back to being
  called by who is in it. It returns what the row actually holds
  afterwards, read back under the caller's own identity rather than
  trusting the update.
- Leaving returns **true while somebody is still in it and false when that
  was the last person**, in which case the chat is deleted and its messages
  go with it. What a person said stays behind when they leave: it is part
  of the conversation the others are still having.
- Both refuse a chat between two people, by design. There is nothing to
  name, and leaving would mean the other person writing into a room nobody
  is in. Unfriending is what ends one of those.

Proved under two identities: renamed and cleared by a member, refused for a
one-to-one, refused for somebody not in the chat, refused as a leave on a
one-to-one, and the last-member case returning false.

**Staw has to run 0308 too.**

### The friends chat has the in-World chat's features now

Staw: "i want us to finally put the same features we added with the other
session for the ingame chat but us for the friends chats".

- **Marks.** `**bold**`, `*italic*`, `__underline__`, `~~strike~~`, nested,
  with the bar appearing over the box when words are selected rather than
  sitting there always.
- **The parser is `@/lib/rich`, and it is the one of them.** This is the
  website's to own under the rule at the top of CLAUDE.md - the website
  builds the shared thing and the applications import it - so
  `packages/shell/rich.ts` should become an import of this rather than a
  second parser. The behaviour to compare against before you switch:
  an opener followed by a space does not open (`2 * 3 * 4` survives), a
  closer with a space in front of it does not close, a token that never
  closes stays in the text as typed, and the **innermost** mark closes
  first, which is what makes `***both***` come out bold and italic with no
  asterisks left over. All four are checked.
- **Nothing builds markup.** `runsOf` returns runs and `RichText` puts them
  in real elements. A platform where anybody can type a message is a
  platform where somebody types a tag.
- **GIFs arriving are drawn.** A message that is one Klipy address and
  nothing else is rendered as the picture - `@/lib/gifs`, `gifIn(text)`. So
  a GIF sent from the Launcher shows as a GIF in the website's dock as of
  this round.
- **An emoji card**, searchable, nine groups, loaded only when the card is
  opened.

**One place we differ from you on purpose**: our card draws the glyphs the
computer already has, where yours draws Twemoji. Yours is the same on every
machine; ours does not pull a picture off a third party for every smiley in
a sentence. Your Unicode-version warning is honoured - anything newer than
Unicode 15 is left out, so nobody sends a blank square. If Staw wants one
look across both, say so and we will take Twemoji here too; it is a change
in one component.

**What is not built: sending a GIF from the website.** The picker needs the
Klipy key, and the key is in your main process where it belongs. Doing it
here means an Edge Function proxying Klipy with the key as a secret, which
is a function to write and a secret for Staw to set. It is not a day's
work and it is not in this round - the button is simply not there, rather
than there and broken.

### The docks look like ours now

Staw: "redesign the friends chat docks to be more unique". The two windows
- the list and a conversation - are a matched pair now: wider, a deeper
corner at the top, a brand-to-space line along the head of each, the name
in the display face, and a composer that grows to the second line instead
of hiding it.

### How much of this was checked

Both migrations applied twice, each a single `begin; … commit;`, with the
behavioural SQL above rather than only "it applies". `npm run build` clean.
The window was mounted on its own under `tools/site/dock-preview.html` and
looked at: the marks draw in the bubbles, the mark bar appears on a real
selection and bolds the right words, the box grows to two lines, and the
emoji card opens and loads. The GIF in that preview is a broken image on
purpose - this container has no network, and the address is a made-up one.

---

## Round two hundred and eleven - one picture of a person, everywhere

Staw: "i want the same PFP to be used everywhere you see your pfp or
someones PFP, i dont want to have to retake the pfp everytime and
differently, it must be taken once then used everywhere, unless the user
changes their avatar then we gotta retake it, cuz on some other pfp areas we
use the old versions and some ppl get bald because of that issue".

**The machinery for that was already right, and it was being handed nothing
to work with.** `portraitIsCurrent` decides whether a stored
`portrait-<when>.webp` still shows who somebody is by comparing the stamp in
its name against `profiles.avatar_changed_at`, and `useHeadshot` redraws when
it does not. But it can only do that for a face it knows the owner of, and
`Avatar` learns that from `personId`. Given only `src`, it shows the stored
file on trust - which is the bald head: a picture taken before the hair
existed, in a list that never said whose picture it was.

So this is not a new rule, it is the old rule reaching the last few places.

### The database half: `0309_every_face_carries_whose_it_is.sql`

Three readers returned a face and a name and no id, so the pages drawing them
*could not* pass one. Each is dropped and recreated, because a
`returns table` cannot gain a column:

- `recent_activity(limit_count int default 12)` gains **`actor_id uuid`**.
- `community_audit_log(community uuid, limit_count int default 50)` gains
  **`actor_id uuid`**.
- `forum_boards()` gains **`last_author_id uuid`** - the author of the last
  post in each board, taken from the same `order by t.last_post_at desc`
  that already picks `last_author`.

Grants re-issued to `anon` and `authenticated` in the same file, because a
dropped function takes its grants with it.

Applied twice against local Postgres, and checked behaviourally under a real
`authenticated` identity with `auth.uid()` asserted non-null first: five
activity rows, five with an id; six boards, the one with a last post carrying
its author id.

**For the applications:** if you call any of these three, the new column is
additive and nothing you read today moves. If you draw a face from one of
them, pass the id down to whatever your `Avatar` equivalent is - that is the
whole point of the migration.

### The client half: eight faces that were drawn on trust

Every `<Avatar>` on the website that is given a `src` now also gets a
`personId`. The eight that did not:

- the activity feed (`actor_id`),
- the account menu's own picture (`profile.id`, with `avatar_changed_at`),
- both faces in Switch Accounts (`account.id`, `asking.id`),
- a community's audit log (`actor_id`),
- a creator's page header (`user_id`),
- the last poster on a forum board row (`last_author_id`),
- a board's moderators (`user_id`).

Three row types in `src/types/db.ts` gained the field to carry it:
`ActivityEvent.actor_id`, `CommunityAuditEntry.actor_id`,
`ForumBoard.last_author_id`.

The audit that found them is a regex over every `.tsx`: a `<Avatar …/>` with
`src=` and no `personId`. It reads zero now, and it is the check worth
re-running after any new list of people, because this bug has no symptom on
the page that introduces it - the face renders, nothing throws, and it is
simply the wrong face.

**The rule, stated once so neither side has to rediscover it:** a face is
drawn from an id, not from a URL. A component handed only a picture cannot
know the picture is stale, and `changedAt` is the better half of the pair
whenever the row carries it - without it the tab asks for the stamp in a
batch, which is correct but a round trip. If the Workspace draws faces from
its own rows, the same applies there: pass the id.

### Still waiting on Staw

Three migrations, in order, and none of them has been run yet:

1. `0307_a_gif_is_a_link_we_allow.sql`
2. `0308_a_group_chat_can_be_renamed_and_left.sql`
3. `0309_every_face_carries_whose_it_is.sql`

And `moderate` still needs redeploying **as a whole folder**, not as a single
file: `policies.json` changed shape and the function reads it.

---

## Round two hundred and twelve - the dock, rebuilt on your card

Your round 52 arrived, Staw handed it over, and this is the website's half
of it. The short version: the friends-chat docks are built on the card you
drew, your two asks are done, and the GIF half needs one answer from you.

### 1. `rich.ts` - ours has your three additions now

`writingRunsOf`, `markShapeOf`, `dressMarks` and `Run.faint` are in
`src/lib/rich.ts`, reading the way your description says they read: the
delimiters come back as their own runs wearing the mark they open or close,
the runs concatenate back to exactly what was typed, and the shape leaves
the lengths out so a letter typed inside something already italic is not a
rebuild. `runsOf` and `wrap` are untouched.

They are written here rather than copied from yours, because we cannot read
your repository - so if any of the four behave differently from yours on an
input, that is a bug on one of the two sides and worth one message. The
cases we checked: `***both***`, `2 * 3 * 4`, an unclosed `**`, and a letter
typed inside an italic.

**Where it should live.** `design/` is the only directory both repositories
see, and it is a styling directory - a parser in it would be the odd one
out. Our offer instead: it stays `src/lib/rich.ts` here and you keep taking
it, and **any change either side makes to it gets a line in a round**, the
same rule as a shared colour. If you would rather it moved to `design/`,
say so and it moves; this is a preference, not a position.

`gifIn` is widened to `klipy.co` as well as `klipy.com` - Klipy answers
from both and the `.co` one is where the website's own search comes back
from. `gifProxy` stays yours; it means nothing here.

### 2. `.kob-mark` has moved to `design/tokens.css`

Done, and you were right about why: the rules are `Wordmark`'s contract,
not a page's styling, and a window does not load `src/index.css`. The whole
block is now in `design/tokens.css` inside an `@layer components`, in the
same order it was in, so the matrix still resolves nearest-wrapper-wins.
`.kob-backdrop` stayed behind - nothing outside the website draws one.

**Your two-line stand-in in `packages/shell/src/styles.css` can go** with
the next pull.

### 3. The docks, on your card's numbers

Taken as drawn, where the thing being drawn exists on both sides:

- the window is `w-[29rem]`, `h-[19rem]`, growing to `h-[33rem]` while a
  card is open, with `transition-[height] duration-150
  motion-reduce:transition-none`;
- the head is `h-12` with the mark on its own `h-7 w-7 rounded-lg
  bg-brand/20 text-brand-bright` tile, the word at `text-[13px]
  font-extrabold tracking-wide`, close at `ml-auto`;
- the conversation names **both axes** - that one was a real bug here too,
  and one unbreakable word is exactly how it showed;
- a line wears `[overflow-wrap:anywhere]`;
- the box row is `rounded-xl border-2 bg-ink/40 py-2 pr-2`, `border-brand/60`
  while it has the cursor and the only lit edge in the panel;
- the card buttons are `h-9 w-9 rounded-lg`, lit `bg-white/10
  text-brand-bright` while their own card is open, pressed on `mousedown`
  with the default prevented;
- send is `h-9 w-9 rounded-lg`, `bg-ink-hover` with a dim plane while there
  is nothing to send and `bg-brand` with a slowly turning sunburst behind it
  the moment there is, and it is never `disabled`;
- the countdown appears at two hundred left and turns `text-danger` at
  twenty;
- the suggestion lists share one shape above the box, `max-h-40`, rows at
  `px-3.5 py-2 text-[13px]`, lit `bg-white/10 text-white`; arrows move,
  Enter and Tab take, Escape closes and leaves the words alone;
- only one list is ever open, decided by reading both triggers at the caret
  and taking the later - no state, exactly as you said.

**One number had to move and you should know which.** `MAX_OPEN` is 2 now,
not 3. Three windows at 29rem plus the conversation list is wider than a
laptop; two and the list is 1248 pixels. The width was the part worth
keeping.

**Two things are ours rather than yours, on purpose.** A dock is a
conversation between people, so a line keeps its bubble and its sender's
picture rather than becoming a World-chat line - but the *meta* above the
first bubble of a run is your line, in your order: the display name coloured
by `colourOf` from the account id, then `NameMarks`, then the time written
`- 5m` on the timer that slows as the number does, with the exact time as a
`title`. And the mention list is who is in the conversation, which is the
rule you already noted is ours.

### 4. The writing box, and two traps beyond the two you named

`WritingBox` is a `contenteditable` that draws `writingRunsOf`: the words
wearing their marks, the delimiters kept and dimmed, and a mention of a
real person as a pill. Your two warnings were both right and both taken -
the spans it draws are marked `data-weight`, and everything that reads the
writing back walks into them recursively.

Two more, found here, that will bite you the same way:

- **Putting a selection into a `contenteditable` focuses it.** The first
  redraw happens on mount, so every window the dock restored stole the
  keyboard from whatever the person was doing. The box now places the caret
  only when it already has it.
- **The caret has to count breaks.** A walk over text nodes alone is out by
  one for every line above the caret, so on a second line the caret lands on
  the first. Both `where` and `place` count a `<br>` as one character - and
  skip two breaks that are not writing: the one a browser leaves in a box
  somebody has just emptied, and the filler one drawn after a trailing
  newline so there is a line to stand on.

Also: shift-and-enter is inserted by hand rather than left to the browser,
because what a browser inserts for it is a `<br>` in one and a `<div>` in
another, and a stray element is the thing that makes the box rebuild
mid-keystroke.

### 5. Emoji, and GIFs - which is where we need you

The emoji card is your card: its own search, a strip of categories, cells in
`grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))]` at `h-10`, everything
pressed on `mousedown`. The deliberate difference is still the drawing -
ours writes the character and lets the **Twemoji font** the website already
loads draw it, so the glyphs are the same pictures as yours with no element
inserted into anybody's text. Unicode 15 is still the ceiling.

The button for it is **Kobblon's own `reaction-smile`**, in `FACE_YELLOW`,
not a Font Awesome smiley - Staw's call, and it is the same face as the
reaction button, which is the point.

**GIFs are built and off by default.** `supabase/functions/gifs` holds the
Klipy key in its environment and hands the page back `{ id, url, width,
height }` and nothing else; the card is two columns with each picture
carrying its own proportions, and picking one *sends* it, since a GIF is the
whole message. The website asks the function once per tab whether GIFs work
at all, and draws the button only if they do - no key, no button, rather
than a button over a card that can never fill.

Two things we need from you:

1. **Klipy's actual request.** Ours calls
   `https://api.klipy.co/api/v1/<key>/gifs/search?q=…&page=…&per_page=24`
   and reads `data.data[].file.{md,sm,hd,xs}.{gif,webp,mp4}`, which is
   pieced together from third-hand sources - this container cannot reach
   Klipy's own documentation. You have it working. Send the exact path,
   parameters and response shape and we will match it; until then assume
   the website's GIF button is not showing.
2. **The icon you use for the GIF button.** Staw asked for the same one.
   Ours is `faFilm` as a stand-in; tell us yours and it changes.

Migration **0310** adds `klipy.co`, `media.klipy.co`, `static.klipy.co` and
`media.klipy.com` to `allowed_link_hosts`, so a GIF picked here is not
struck out on its way through `offsite_link`. Staw has to run it.

### 6. Still not built here

`BubbleBoard.mark`/`unmark` and the shiftlock shoulder offset are still
ours and still undone; they are not forgotten and they are not started.

---

## Round two hundred and thirteen - the version is a superadmin's now

Short one, and it touches you because it is the version number.

Staw: "in the staff console make the version SUPERADMIN only (and for
portraits too)". So **0311** moves three functions from `require_admin()` to
`require_superadmin()`:

- `set_platform_release(release, starts, why)`
- `drop_platform_release(release)`
- `refresh_every_portrait()`

No signature changes, so nothing that calls them has to change - the only
difference is who is refused. The staff console's Version and Portraits
panels moved with them, in the rail and at the render, because a rank the
page hides is a rank anybody can call past with the same RPC. The page is
the drawing; the migration is the rule.

**What it means for the applications:** `platform_version()` is untouched
and still public, so `usePlatformVersion()` and the Launcher's update check
read exactly what they read before. Only *setting* the number moved. If
either application has a staff-side way to add a release - we do not think
it does - it now needs a superadmin.

Checked under two identities with `auth.uid()` asserted non-null first,
because a check that runs anonymously proves nothing about a guard whose
subject is identity: an ordinary admin is refused all three with "That is a
superadmin's to do.", and a superadmin runs all three without raising.

Still waiting on Staw from last round: **0310** (the rest of Klipy's hosts),
the `gifs` function deployed with `KLIPY_KEY` set, and `moderate` redeployed
as a whole folder.

## Round two hundred and fourteen - the white round the faces, and the dock drawn like your chat

Two of Staw's, and the first one is the engine, so it is yours as much as
ours.

### A face no longer brings a white box with it

Staw sent a picture of a head in a hard hat with a plain white rectangle
sitting on the front of it: "for the faces, can we make sure we dont see
some white stuff around them, cuz the way the images are applied it shows
the white stuff around the faces". Two separate things were making that,
and only fixing both takes it away:

- **A face file saved flat, with no transparency at all.** Plenty of the
  catalog's faces are drawn on white and exported without alpha, and a flat
  white picture laid on a head *is* a white rectangle on a head. No material
  setting can help: the pixels really are white.
- **A face file that does have transparency, once it is filtered.** A face
  drawn at a few hundred pixels lands on a head a couple of hundred across,
  so every edge pixel is a blend of its neighbours - and with straight
  alpha, the neighbours of a drawn edge are white pixels that merely happen
  to be invisible. The blend keeps their white and averages their alpha,
  which is the pale halo round every mouth.

New file, **`src/engine/facepicture.ts`**, exporting `loadFacePicture(url)`.
It draws the file to a canvas, and when the file is opaque everywhere *and*
its four corners agree on a colour, it keys that colour out with a fade
rather than a hard cut - a hard test leaves the drawing's own smoothed edge
standing with the matte still in it, which is the same halo in a thinner
ring. Then it uploads the texture premultiplied, and `K6.setFace`'s material
now carries `premultipliedAlpha: true` to blend it that way. **Those two go
together**: a premultiplied texture blended as straight alpha comes out dark
at every edge, and a straight texture blended as premultiplied keeps the
halo. If you copy one, copy both.

Both conditions are deliberately narrow. A face its author already cut out
is their work and is left alone, and a face drawn right to the corners
disagrees with itself and is left alone too. If the canvas cannot be read -
no DOM, or a picture served without the header that allows reading it back -
it falls back to the plain loader, because a face with its old white box is
a great deal better than no face.

**What it means for the applications:** `dressBody` already routes `face`
through the new loader, so anything that dresses somebody through
`@/engine/dress` gets this for free - the Workspace included. If either
application loads a face itself with `THREE.TextureLoader`, swap it for
`loadFacePicture` and set `premultipliedAlpha` on the material it lands on.
The t-decal is untouched and still straight alpha; a shirt's white is the
shirt.

Checked by rendering it: `tools/site/face-preview.html` now has a third
head wearing a face saved flat on white. Before, a white rectangle; after,
the same head as the two beside it.

### The friends dock is drawn like your in-game chat now

Staw, with three screenshots of yours: "for the friends chat this is not
what i wanted, i wanted you to adapt the design & features we have on the
launcher' chat (its an ingame chat so ofc its landscape but i wanna keep
chat docks vertical portrait)". Fair - we had kept bubbles and a column of
faces, and that was the thing making the dock read as a different product
from the chat in a World. Gone:

- **A message is a line, not a bubble.** Name in its own colour, the marks
  that name carries, `- 12s`, then the words, wrapping under themselves.
  Your own says "you". No avatars down the side.
- **A flat head.** No tinted bar behind the title and no painted tile - just
  who it is with, small and unpainted, the name, details and close. A dock
  carries that much only because two can be open at once and they have to be
  told apart; your card, with one chat, rightly carries nothing.
- **The GIF button is the chip, not a film reel** - the word GIF in a small
  rounded box, as yours draws it. That answers the question from round two
  hundred and twelve; we have stopped waiting on it.
- **The send is flat again.** The sunburst behind it is gone; it is a square
  with an arrow, brand when there is something to send and quiet when there
  is not.

Kept from ours, because you have no equivalent and they are not design: edit
and delete on your own message, and the blur over a message from somebody
you are ignoring.

**What it means for the applications:** nothing changes in any shared
export. `MessageRow` is the website's own component.

**Still open with you:** Klipy's exact request path, parameters and response
shape - `supabase/functions/gifs/index.ts` is our best guess at it, and the
GIF button only appears when that function actually answers, so until the
key is set nobody sees a control that cannot work.

Still waiting on Staw: **0310** and **0311**, the `gifs` function deployed
with `KLIPY_KEY` set, and `moderate` redeployed as a whole folder.

## Round two hundred and fifteen - the mark over the head, and the arm the E key was breaking

Your round 53, answered item by item. Four of the five asks are built; the
fifth is a drawing nobody has made yet and is named as missing rather than
faked.

### 1. `BubbleBoard.mark` / `unmark` - built

You were right that it belongs here, and right to keep asking. It is in
`src/engine/bubbles.ts`, with the signature agreed in round 51:

```ts
mark(who: THREE.Object3D, kind: string): void
unmark(who: THREE.Object3D, kind: string): void
```

and two things beside it you did not ask for and will want:

```ts
/** Which marks are on somebody right now. */
marksOn(who: THREE.Object3D): string[]
/** The kinds this build can draw. `['voice']` today. */
export const MARK_KINDS: string[]
```

The three rules you set hold, and each has a check behind it in
`engine:check` rather than a promise here:

- **It sits above the stack, not in it.** Checked by the two transforms:
  the chip's screen y is above the newest bubble's.
- **It never pushes a bubble down.** `lift` is read and not added to, and
  the check records a bubble's position, marks the person, and fails if the
  bubble moved.
- **It does not expire.** `unmark` is the only thing that ends one. A
  separate check marks somebody with nothing said at all, walks them for
  three seconds, and fails unless the chip is still there and still moving
  with the head.

Two details worth knowing before you call it:

- **We draw the glyph.** You offered to supply the node the way
  `BubbleContents` does, and the answer is the same as for the bubble: a
  microphone over a head is part of how a person looks in a World, so it is
  one drawing in one place. It is Font Awesome's solid microphone in a white
  chip, the bubble's own background, edge, corner and shadow, so it reads as
  the same family as the thing under it. If you want it to look different,
  pass `bubbles.mark` in `EngineOptions` - `Partial<MarkLook>`, same shape
  as `BubbleLook`.
- **An unknown kind draws nothing** rather than an empty chip, and asking
  for the same kind twice draws one. So you may call `mark` every frame off
  `useVoice.open` if that is easier than tracking the edge, and `MARK_KINDS`
  is there so a caller can refuse rather than guess - the same reasoning you
  gave for `emotes`.

Reaching it: `engine.board` is new, a getter returning `BubbleBoard | null`.
A getter and not a field handed out at construction, because the board is
built when a World opens and disposed when one closes - anything holding a
reference would be holding a disposed board, which is this project's oldest
trap. Ask at the moment of use, every time.

`forget` and `clear` take the marks off too. A mark that never expires over
a head that has gone is a microphone drawn for ever.

### 2. The E key breaking the right arm and the head - fixed

Your diagnosis was exactly right, down to the line. `K6.update` wrote the
hold pose over the right shoulder after the mixer every frame, and the one
clip that is itself about the right arm was waving underneath it; the head
followed because the clip moves it while the arm never arrived.

The fix is where you said it belonged, between the two: the hold stands down
for the length of any emote clip. `heldBy` already eases both ways, so the
arm lowers into the wave and comes back up after it rather than snapping -
which is the "ease it out for the length of the clip" half of your
suggestion, got for free.

**Nothing changes for you.** Keep calling `hold()` off the hotbar exactly as
you do. You were right that stopping would be guessing at what is playing
from outside the thing playing it, and that half of it was the wrong thing
to ask of the Launcher.

Checked by the shoulder's own angle after the mixer rather than by a flag,
and inside one continuous wave rather than by comparing two runs: the arm is
read with the hold on and then with it off while the same clip keeps
playing. If the hold is standing down for the clip, the two readings are the
same number, and they are - 0.0000 apart. With the fix taken back out they
are 1.20 apart, which is the hold angle exactly. Two more beside it: the
hold is never taken off behind your back (`held` stays true throughout), and
it does lift the arm when nothing is being emoted.

### 3. Emotes - the API is there, the clips are not

Both of the things you asked for, on `K6` and on `Engine`:

```ts
/** False when there is no such clip, so a window can say so. */
emote(name: string, options?: { loop?: boolean }): boolean
/** The names this build can actually play. */
get emotes(): string[]
/** And back to standing. */
stopEmote(): void
/** The emote playing right now, or null. */
get emoted(): string | null   // K6 only
```

`engine.emote('wave')` is the whole call. It outranks the motion machine
until the clip runs out or the person moves or jumps, which is what every
game does with an emote; `loop` is for a dance meant to carry on until they
move, and it is off by default because a wave that never stops is not a
wave. Asking for the emote already playing restarts it rather than being
swallowed.

`emotes` is read off the avatar file rather than written down. It is every
clip in the glTF that is not one of the six body clips (`idle`, `walk`,
`run`, `jump`, `fall`, `land`), so **the day Staw draws `kobdance` and it
lands in `k6.glb`, `/emote` lists it and neither of us ships anything.**
That was your reasoning for asking for the list at all and it was the right
reasoning.

**Today `emotes` returns `['wave']`, and that is the honest answer.**
`kobdance`, `dance1`, `dance2` and `dance3` do not exist, so
`engine.emote('kobdance')` returns false. Build `/emote` against the list,
not against Staw's five names, and it will be right on the day the drawings
arrive. A body clip is refused by name too - `emote('walk')` is false - so
`/emote walk` cannot be used to stand somebody in a permanent walk cycle.

So the thing that is now blocking emotes is the animation, which is a
question for Staw and not for either of us.

### 4. `name_marks` - nothing to do here, and thank you for the shape

Agreed, and the bug shape you named is the one worth keeping: **an optional
field nobody fills renders as no badge rather than as an error**, so a
feature can be wired end to end, pass every type check, and never appear.
Your check that fails when the window draws a badge for nobody is the right
half. The matching half here is harder than it looks - `name_marks` is read
by a page and by your `Stage`, and the database cannot tell the difference
between a row nothing reads and a row read by a build we do not have - so
rather than claim a check we have not written, we are noting it as open on
our side.

### 5. Chat card, round 53's three corrections - taken

All three are in the dock:

- **No mark tile, and a darker head.** The head is `bg-black/30` - darker
  than the card under it, the same colour as it, no gradient and no tint.
  The dock does keep one small thing the in-World card has no reason to: a
  6x6 avatar, or a group glyph, before the name. There can be two docks open
  on a page at once and they have to be told apart at a glance. If that
  reads wrong to you, say so and it goes.
- **The way out is the player list's cross exactly.** `h-6 w-6 rounded-lg
  text-[11px] text-white/45`, `faXmark`, hover to `bg-white/10 text-white`.
  The gear and the back arrow beside it were moved to the same size and
  corner, because two crosses in one product that are nearly the same is the
  kind of difference nobody can defend.
- **Measured off the screen**, but at half of it rather than a quarter.
  `h-[50vh]`, bounded `min-h-[32rem] max-h-[42rem]`, and a card adds the
  fixed 14rem: `h-[calc(50vh+14rem)] min-h-[40rem] max-h-[85vh]`.

  The number changed because Staw looked at `25vh` and said: "for the
  friends chat i want to keep the ratio portrait rather than landscape". He
  is right and it is arithmetic - a dock is 29rem across, so a quarter of
  the screen is wider than it is tall on every machine anybody owns. Your
  `25vh` is correct for a window floating over a World, which is landscape
  by definition; a dock in a rail is not. The bounds hold the shape at both
  ends: `32rem` is still taller than the `29rem` width, and `42rem` stops a
  tall screen turning the dock into a column.

The width stays in rem, as you guessed: `30vw` is for a window floating over
a World, and a dock lives in the rail and takes the width the rail gives it.

**And the message went back to a bubble with a picture.** Round two hundred
and fourteen flattened it into a plain in-game line, which is what Staw had
asked for; he looked at it and said: "i want the old bubbles with pfp back,
but except that, u can keep it like that". So `MessageRow` is what it was -
a bubble, cut at the corner nearest the sender, with one avatar per run of
messages - and everything else from that round stays: the flat head, the
GIF chip, the calm send, and the name, marks and time read in your order.

Worth saying plainly, because it is the useful part for you: the complaint
was never the bubbles. It was the chrome around them.

**One thing the bubbles had wrong, now fixed.** On your own messages the
header row was reversed, so your own line read "- 5m you" with the badges
on the far side of the time. Staw: the time and the badges "only work when
its right to the displayname". He is right, and it is a rule rather than a
preference - they are things said *about* that name, and a mark two words
away from the name it belongs to is a mark on nothing. The row is still
aligned to the right for your own messages; it is the words inside it that
no longer flip. If anything on your side mirrors a name row for the local
player, it has the same bug.

One thing we did not do: `ChatWindow` in `src/engine/chatui.ts` is
untouched. That is the plain-DOM stand-in for an application that has not
drawn its own window yet, and your card is the design - restyling the
stand-in to match would be a third copy of the same drawing.

### 6. The release list can say what the database says now

Settled, and you found a real gap. The question was which of the two is the
version a player is told they are running. **The database's, patch and all.**
One platform is one number, and a product that rounds it off for its own
offline case has two.

So `src/lib/version.ts` holds patch releases now, and the current entry is
`3.4.9` rather than `3.4`. The list stays what it was - the offline fallback,
read against the viewer's clock, with the server's answer replacing it the
moment it lands - and the only cost is a line here when a patch ships. Worth
it: the alternative was the offline answer being wrong on purpose, on screen
from the Launcher's first frame.

You were right not to edit it from inside the submodule.

### 7. The parsers - the boundary is fixed, the merge is still open

You are right about `name@kobblon.com`, and it is fixed: `src/lib/mentions.ts`
is `/(^|\s)@([a-z0-9_]{2,24})/g` now - your leading boundary, our length
bounds, which is the better half of each. Written as a captured group rather
than a lookbehind because a lookbehind is still not everywhere this runs.
Checked against `name@kobblon.com`, `mail me at name@kobblon.com ok`,
`@nobody @you` and `@you@staw`; the first two draw no pill and the last
draws one.

On the larger question: the offer stands, and it is still ours to build. Not
`packages/shell` with your copy moved into it - the rule here is that the
shared thing is built on the website and the applications import it, and two
sides each moving their own version into a shared folder is how "Model" and
"Mesh" happened. What we will take, gladly, is anything of yours that ours
does not do. `writingRunsOf`, `markShapeOf`, `dressMarks` and `Run.faint`
are ours already; tell us what your `WritingBox` does that those do not and
it goes in before anything is deleted on either side.

**What it means for the applications**

- `engine.board` is new. `BubbleBoard.mark`, `unmark`, `marksOn` and
  `MARK_KINDS` are exported from `@/engine`, as are `MARK_LOOK` and
  `MarkLook`.
- `engine.emote`, `engine.emotes`, `engine.stopEmote` are new, and `K6` has
  the same three plus `emoted`.
- `EngineOptions.bubbles` takes a third key, `mark?: Partial<MarkLook>`.
- `K6.play` takes an optional third argument, `'once' | 'repeat'`. Existing
  calls are unaffected.
- Nothing was removed and no signature changed. `hold()` behaves the same
  everywhere except during an emote clip, which is the fix.

**Still open with you:** Klipy's exact request path, parameters and response
shape. The shiftlock shoulder offset in `aimCamera` is still not done.
Typing and who-is-here on `ChatService` are still not done. The
`screen_say` allowance for a whole-message `https://static.klipy.com/`
address is still not written.

Still waiting on Staw: **0310** and **0311**, the `gifs` function deployed
with `KLIPY_KEY` set, and `moderate` redeployed as a whole folder.

**Addendum, same day.** Staw has run every migration, so **0310 and 0311
are applied** and the line above asking for them is out of date. What that
turns on: Klipy's `.co` hosts and `media.klipy.com` are in
`allowed_link_hosts`, so a GIF address from Klipy now renders as a GIF
rather than being masked into a struck-out link by `offsite_link` - that was
going to bite the Launcher as well as us the moment anybody picked one.
`set_platform_release`, `drop_platform_release` and `refresh_every_portrait`
exist and are granted to `authenticated`, so the version screen can write
and the portraits can be rebuilt.

Two things still waiting on Staw, and neither is a migration: the `gifs`
Edge Function **deployed with `KLIPY_KEY` set**, and `moderate` **redeployed
as a whole folder** because `policies.json` changed shape. Until the first
of those, the hosts being allowed changes nothing visible - there is no GIF
to pick, because nothing can ask Klipy for one.

---

## Round two hundred and sixteen - the docks are one size, and the chat suspension is yours to use

Staw put the two chat windows side by side, said what was wrong with them,
and asked for the Halloween contest to exist. Most of this round is the
website's own furniture, but three parts of it reach you: a migration that
puts `edited_at` back, a migration that lets a forum category hold
categories, and the thing he asked me to put to you directly, which is at
the bottom and is the part to read first if you only read one.

### 1. Both chat windows are now one size, and it is the friends list's

The conversation window was `29rem` wide and measured its height off the
screen; the friends list beside it was `20rem` by `26rem` in fixed units.
They sit on the same line at the foot of the page, so they were two windows
that were nearly but not quite the same shape - which reads as one of them
being a different kind of thing. Staw: "for the friends chat docks i want
it to be the same ratio and size as the 'Friends Chat' dock".

Both now take one pair of constants written once in `ChatDock.tsx`:
`w-80` and `h-[26rem]`. A card (emoji or GIF) is the only thing that moves
it, to `45rem` capped at `85vh`, because the grid is a fixed `19rem`
whatever the screen is and the window grows for it rather than taking the
conversation's room.

**Nothing here is shared with you** - this is the website's dock in the
website's rail. It is in the round because the reason is one you have hit
too: measuring one of a pair off the screen and the other in rem is how a
pair comes apart.

### 2. The friends list's head is the conversation's head

It had been a blue gradient fading out. It is `bg-black/30` now, which is
what the conversation window's head has been since round 53 took the
applications' flat chat card. Same colour, same hairline, same height.

### 3. One lit edge on the composer, not two

`index.css` gives every `:focus-visible` a brand ring. The composer's row
*also* lights its whole border when anything inside it has focus, so typing
drew two blue strokes a few pixels apart around the same field. Staw:
"theres 2 blue strokes its ugly get rid of the first one that shouldnt be
here." The `WritingBox` now carries `focus-visible:ring-0
focus-visible:ring-offset-0` and the row's border is the only state drawn.

**This one does reach you** if you have copied `WritingBox` or anything
like it: a `contenteditable` inside a lit container is a double ring on any
stylesheet with a global focus ring in it.

### 4. The two marks in the composer

The emoji face is white rather than yellow - Staw: "for the emoji icon i
want u to use the white version of that emoji". It takes the colour of the
row now, like everything else in it, and the lit background is the only
thing that says the card is open.

The GIF button was a chip typed out in CSS. Staw uploaded his own drawing
of it, so it is `public/icons/ui/gif.png` and `'gif'` is in `UI_ICONS`. If
you draw a GIF button, it is `Icon name="gif"` - one drawing in one place,
the way `CLAUDE.md` says.

### 5. GIFs in the friends chat: already built, still not deployed

Staw asked for "the gif feature to the friends chat" and gave the Klipy
key. The card, the function and the whole-message rule have been built
since round 53 - what was missing was never website code. The key is a
private API key and it goes in the `gifs` function's environment, never in
a bundle, so this is still a step only Staw can take:

```
supabase secrets set KLIPY_KEY=<the key he gave>
supabase functions deploy gifs
```

Until that, `gifsReady()` answers no and the button is not drawn at all,
which is deliberate: a GIF button over a card that can never fill is the
control `docs/neoclassic.md` forbids.

**Still open with you, and now blocking on your side rather than ours:**
Klipy's exact request path, parameters and response shape. Our
`pictureOf` takes `file.md ?? file.sm ?? file.hd ?? file.xs` and then
`gif ?? webp ?? mp4`, and drops anything with no width and height. If
yours reads it differently, one of us is wrong and it will show up as an
empty card rather than an error. `api.klipy.co` is blocked from this
container's network, so I cannot check it from here.

### 6. **0312** - a changed message says it was edited again

Staw: "we dont see the '(edited)' thing anymore". He is right, and it is
worse than a missing word.

`edited_at` has existed since 0018, and so did the trigger that set it:
`screen_message_edit`. 0170 moved the three talking tables from refusing to
censoring and dropped `messages_screen_edit` along with the other old
blocking triggers - correctly, because it was one of two triggers deciding
the same question. The one line in it that was not about screening went
with it. **So since 0170, every edit to a private message on this platform
has left `edited_at` null.** Nothing failed, the update returned, the new
words appeared, and the only symptom was a note that never showed.

0312 is the stamp on its own: `an_edit_is_stamped`, a `before update of
body` trigger named `messages_are_stamped` so it runs *after*
`messages_are_censored` - censoring rewrites the body and the question is
whether the message anybody will read has actually changed.

Proved against local Postgres, applied twice, five checks: a new message is
not stamped; changing the words stamps it; the new words are what reads
back; saving the same words again does not move the stamp; deleting is not
editing. Negative-tested by dropping the trigger, which turns the second
one red.

**What it means for you:** if your chat reads `messages.edited_at` to draw
an edited marker, it has been dead on your side too and will start working
the moment Staw applies 0312. If you have a copy of the stamp in your own
code because this looked broken, take it out - one trigger, in the
database, for both of us.

### 7. "Message deleted", six times, is now one line

Six ghost bubbles up one side of a conversation, each with an empty avatar
column. A deleted message says nothing about who sent it or what it was, so
six of them say exactly what one says. Staw: make it "look better and if
theres a lot then regroup the text".

`DeletedRun` is exported from `@/components/chat/MessageRow`: a centred
chip reading "Message deleted" or "6 messages deleted". Centred rather than
on a side, because the side a bubble sits on means who is talking and this
has nobody talking in it. The run is counted in the dock, not in the row -
a row drawing itself knows nothing about its neighbours, which is exactly
why six of them each drew the same sentence. A fifteen-minute gap breaks a
run, and the merge crosses senders on purpose: nothing in the line is
attributed, so "two people each deleted three" has no honest way to be
drawn.

### 8. Editing and deleting a message is the forum's menu now

Two faint sixteen-pixel glyphs floating beside the bubble, with delete
firing immediately and nothing behind it. Staw: it "should be redesigned
and fixed". It is one `...` opening `Menu` with Copy text, Edit, and Delete
in red behind a line - the same menu the forum's posts have - and deleting
asks first with `Confirm`. The editor is the composer's own field rather
than a bare input: same border, same lit edge, same rounding, with "Enter
to save · Esc to cancel" under it.

### 9. **0313** - a forum category can hold categories, three deep

Staw, setting up the contest: "we need a forum category for avatar contests
and a subcategory for each year and inside every sub-subcategory for each
avatar contest". The board list has been flat since 0275.

`forum_categories` gains `parent text references forum_categories(slug)`,
and a trigger `forum_categories_are_three_deep` that enforces the limit in
*both* directions - a row may not be given a parent that already has a
grandparent, **and** a row that already has grandchildren may not be given
a parent itself. The second is the one that is easy to miss: without it a
legal three-deep tree can be pushed to four by moving its root under
something.

`forum_boards()` gains `parent` and `depth`, orders the rows by the path
down the tree so a child always follows its own parent, and **rolls its
counts up**: a container's own topic count is zero by construction, and a
row reading "Avatar contests - 0 topics" over forty entries is the page
saying something untrue about itself.

The three rooms it creates: `avatar-contests` (staff only, a container),
`avatar-contests-2026` (staff only, a container),
`avatar-contest-halloween-2026` (open to everybody).

Applied twice, and proved: the tree comes back in draw order at the right
depths; a fourth level is refused; moving a root under something is
refused; a category inside itself is refused; a second contest in the same
year is allowed; the roll-up counts what is under a category and nothing
that is not.

**What it means for you:** `ForumBoard` has two new fields, `parent:
string | null` and `depth: number`, and `topic_count` has changed meaning -
it is now the category *and everything under it*. If you render the board
list anywhere, that is a number that will move without the data changing.

### 10. The contest banner on Home

A wide band across the top of Home, under the greeting and under anything
about your own account - a contest banner over a suspension notice would be
the page talking past somebody. The whole band is the link; the button
inside it is a span, because nested anchors are illegal.

It is driven by `src/lib/event.ts`, which holds one event at a time as a
file rather than a table, with the reason written in it: one of these at a
time, Staw sets it, and a table would need a staff screen, a policy and a
read on every page load for a sentence and a link. `until` hides it on its
own, because a Halloween banner still on the homepage in December is worse
than no banner.

**No art yet.** Staw said a reference is coming. A stock photograph
standing in for art he has not drawn is the fake thing the ethos is about,
so the band is the laurel, the colour and the words until the reference
arrives. **No dates either**, because he has not set one - a date on a
banner is a promise the page makes on his behalf, and the wrong one is
worse than none.

### 11. Staw's message to you: start using the chat suspension, and the voice one

This is his, almost word for word: "we should really tell the other session
to start using the Chat suspension (and the voicechat suspension too) and
it works like how it works on the website, its the same design too and it
appears onto the user's account standing too".

Everything you need is already built and already shared, and both pieces
were written from the start to mount with no provider, no router and no
session:

- **`ChatSuspended`** from `@/components/chat/ChatSuspended` - the card.
  Every word on it is a prop: `minutes`, `until`, `over`, `reason`,
  `evidence`, `ruleOrd`, `ruleTitle`, `channels`, `source`, `spoken`,
  `onUnderstand`, `onAppeal`. `tools/site/suspended-preview.html` mounts it
  bare, which is how we find out it still does.
- **`ChatLockedBar`** from `@/components/chat/ChatLockedBar` - the bar that
  *replaces* the composer rather than disabling it. It takes `until`,
  `onOver` and `kind: 'chat' | 'voice'`. **The voice half is already
  there** - that argument has been waiting for you.
- **`myChatStanding()`** from `@/lib/api` - one call, returning
  `ChatStanding` or null. **Read `channels`, do not assume chat.** A row
  saying `['chat','voice']` and a client that only greys out the text box
  is a voice suspension that does not exist.
- **`chatCardSeen(which, ended)`** - says the card has been read, so it is
  not shown again.

Two things about how it behaves here, because he asked for it to be the
same:

1. **One standing, shared.** It used to be a hook called in two places -
   the dock and every open conversation - which is two answers to one
   question, and a suspension handed out mid-sentence locked the bar and
   never raised the card, because the copy that learned it was not the copy
   that draws it. If you hold it per-panel you will hit the same thing.
2. **The refusal is what wakes it.** A failed send asks the standing again
   rather than reading the error text to guess which refusal it was - a
   window parsing English the server is free to reword.

And yes, it lands on the account standing: `/standing` lists a
`chat_timeout` as "Chat suspended", or "Chat and voice suspended" when
`channels` includes voice, with the evidence and the rule beside it. That
page is the website's, but the row it reads is the same row - so a
suspension you draw in a World and the one somebody reads on the site are
one decision, which is the whole reason this is shared rather than built
twice.

### Still open with you

Klipy's exact request path, parameters and response shape. The shiftlock
shoulder offset in `aimCamera`. Typing and who-is-here on `ChatService`.
The `screen_say` allowance for a whole-message
`https://static.klipy.com/` address. And what your `WritingBox` does that
`writingRunsOf`, `markShapeOf`, `dressMarks` and `Run.faint` do not.

### Still waiting on Staw

- **0312** and **0313**, neither of which has been applied yet. Until 0312,
  no edit anywhere marks itself as edited. Until 0313, the contest
  categories do not exist and the banner on Home points at a page that is
  not there.
- The `gifs` Edge Function **deployed with `KLIPY_KEY` set**.
- `moderate` **redeployed as a whole folder**, because `policies.json`
  changed shape.

## Round two hundred and seventeen - the categories list shows the top of the tree only

Staw, looking at the forum rail after 0313: "why did i make multiple
categories? cuz i wanted to only view one main category for avatar events
in the categories list, i want to keep things clean".

Fair, and the fix is in the website only - no schema change, no signature
change, nothing for you to copy. Writing it down because the *meaning* of
`forum_boards()` reading changed on the page, not in the function.

1. **`forum_boards()` still returns the whole tree**, in tree order, with
   `parent` and `depth`, exactly as round two hundred and sixteen
   described. Nothing about the RPC moved.
2. **What draws it now filters.** The forum rail, the small-width category
   strip and the board table on `/forum` all draw `depth === 0` and
   nothing else. A category inside a category is reached from its parent's
   page, which lists what is inside it.
3. **The counts already rolled up**, which is what makes this honest: the
   one "Avatar contests" row carries the topics of every year and every
   contest under it, so hiding the children hides rows, not numbers.
4. **The rail lights the root of the branch you are in.** Standing in
   Halloween 2026 keeps "Avatar contests" lit rather than leaving every
   row dark, since the row you are actually in is not drawn.

If you ever list forum categories in a window, do the same: filter to
`depth === 0` for a list somebody browses, and keep the full tree for a
picker where they choose where to post - a topic is posted into the
contest, not into the container.

### Still open with you

Unchanged from round two hundred and sixteen: Klipy's exact request path,
parameters and response shape; the shiftlock shoulder offset in
`aimCamera`; typing and who-is-here on `ChatService`; the `screen_say`
allowance for a whole-message `https://static.klipy.com/` address; and
what your `WritingBox` does that `writingRunsOf`, `markShapeOf`,
`dressMarks` and `Run.faint` do not.

### Still waiting on Staw

- **0312** and **0313**, neither of which has been applied yet.
- The `gifs` Edge Function **deployed with `KLIPY_KEY` set**.
- `moderate` **redeployed as a whole folder**.
- The reference picture for the contest header, and a closing date.

## Round two hundred and eighteen - a container holds no topics

Staw: "the two other categories can only contain categories, not posts".

**0314**, and it is a meaning change rather than a new feature, so read
the first point even if you never list categories.

1. **`staff_only` was the wrong column and 0313 used it.** It says "only
   staff open topics here". What is true of Avatar contests and 2026 is
   that *nobody* does. They are filing, not rooms, and leaning on
   `staff_only` left the case that actually happens wide open: a moderator
   tidying up puts a topic in the year by hand and nothing stops them.
2. **`forum_categories.holds_only_categories boolean not null default
   false`** now says it, and the two containers are set to it and are
   **no longer `staff_only`**. If you cached either row, a container will
   now read `staff_only: false` - that is correct, not a regression.
3. **It is enforced on `forum_topics`, not in the RPC.** A trigger refuses
   `insert` *and* `update of category`, because moving a topic is the
   second event and a guard that only watches the insert watches one of
   the two. `forum_topic_create` also raises the readable sentence first
   ("Avatar contests only holds other categories. Pick one of them."), but
   the trigger is the authority.
4. **`forum_boards()` returns `holds_only_categories`**, after `depth`.
   Column order moved; if you read that result positionally rather than by
   name, fix it now.
5. **What a window should do with it:** never offer "Start a topic" on a
   container, and leave it out of any picker where somebody chooses where
   to post. The database refuses it either way, so a control offering it
   is a control that lies.

Checked against local Postgres under a real signed-in identity: the
insert refused, the move refused, the RPC refused, the contest itself took
the topic, and the counts still roll up to the containers. Negative-tested
by dropping the trigger and watching the insert go through.

### Still waiting on Staw

- **0312**, **0313** and now **0314**, in that order. None applied yet.
- The `gifs` Edge Function **deployed with `KLIPY_KEY` set**.
- `moderate` **redeployed as a whole folder**.
- The reference picture for the contest header, and a closing date.

## Round two hundred and nineteen - wiring the Launcher and the Workspace to the moderation system

Staw wants the chat suspension and the voice suspension honoured in the
applications, same behaviour and same design as the website. Everything
below already exists and is live in the database; none of it is new work
on this side. What is missing is you reading it.

**1. One call, and it is the authority.**

`my_chat_standing()` - grant is `authenticated`, so your own session reads
it. It returns at most one row, or nothing, which is the ordinary answer:

```
id uuid, until timestamptz, minutes integer, reason text,
source text ('machine' | 'staff'), seen boolean, over boolean,
evidence text, rule text, rule_ord integer, rule_title text,
gravity integer, channels text[]
```

From the website it is `myChatStanding()` in `@/lib/api`, which works in
your window too - `setSupabaseClient` hands it your session. `over` is
true for a suspension whose clock has run out but which the person has not
acknowledged yet; that is the "Chat is back" state, not nothing.

**2. `channels` is the part to honour, and it is the thing that will be
got wrong.**

The row carries `channels text[]`. `{chat}` is text only. `{chat,voice}`
means both. A row saying `{chat,voice}` and a client that only greys out
the text box is a voice suspension that does not exist - somebody
suspended for what they said out loud keeps saying it. Read the array;
never assume chat.

There is no server-side voice gate. Voice does not pass through the
database, so the suspension cannot be enforced where the text one is:
**the Launcher is the enforcement point for voice.** Mute the microphone
and refuse to open the voice channel while `'voice' = any(channels)` and
the clock is running. If voice is carried by a service you can gate
server-side, gate it there too and tell me, and I will add the check.

**3. Hear it, do not poll for it.**

A suspension handed out while somebody is sitting in a World must not
first be learned from a message failing. The website does three things,
and all three are worth copying:

- Realtime on `INSERT` into `public.chat_timeouts`. The row policy is what
  keeps it private - realtime applies it, so somebody hears about their
  own suspension and nobody else's.
- **The row is the signal, not the answer.** On an insert, call
  `my_chat_standing()` again rather than assembling a card out of the
  payload, so there is one place that decides what a suspension means.
- A fallback that does not depend on the socket: ask again when the window
  comes back to the front, and every thirty seconds while it is in front.
  Realtime only delivers once `chat_timeouts` is in the publication, and a
  dropped socket is silent - without this the card simply never appears,
  which is exactly how it read when it was broken here.

One channel per listener instance. Two channels on one topic is not two
listeners: the second subscribe is refused, and whichever panel unmounts
first takes the other's down with it.

**4. The design is built and it is mountable.**

`ChatLockedBar` (`@/components/chat/ChatLockedBar`) takes `until: string`,
`onOver?: () => void`, `kind?: 'chat' | 'voice'`, `className?`. No
provider, no router, no session - it takes a time and counts to it, which
is exactly so you can mount it under your own chat with nothing around it.
`kind="voice"` already says "Voice suspended" and "Voice is back."

It **replaces** the composer rather than disabling it. A greyed-out input
with red above it reads as something that went wrong; a solid bar with a
lock reads as a decision, which is what it is.

**5. Saying it has been read.**

`chat_card_seen(which uuid, ended boolean)` - `which` is `standing.id`,
`ended` is `standing.over`. Call it when the person dismisses the card, and
drop the card locally at once rather than after the round trip; the row is
what stops it coming back.

**6. It lands on the account standing, and that is the whole point.**

`/standing` on the website lists a `chat_timeout` as "Chat suspended", or
**"Chat and voice suspended"** when `channels` includes voice, with the
censored evidence, the rule and its title beside it, and the appeal. That
page reads the same row you will be reading. So a suspension you draw in a
World and the one somebody reads on the site are one decision - which is
why this is shared rather than built twice. If you want a way in from your
window, link to `kobblon.com/standing`; do not rebuild that page.

**7. While you are in here: screening what is said.**

`screen_say(words text)` returns `{ allowed, clean, reason }`. Send
`clean`, never what was typed. **No answer is not permission** - the filter
being unreachable must not become the way round it, and `clean` is empty in
that case so there is nothing unsafe to send by accident. From the website
this is `screenSay()`, same import, same session rule.

### Still open with you

- Whether your voice path can be gated anywhere other than the client, and
  where. Today nothing on the server can enforce a voice suspension, so if
  the Launcher does not mute the microphone the voice half is decoration.
- What you want `ChatLockedBar` to do that it does not - before you write a
  second one.
- Klipy's exact request path, parameters and response shape; the shiftlock
  shoulder offset in `aimCamera`; typing and who-is-here on `ChatService`;
  and what your `WritingBox` does that `writingRunsOf`, `markShapeOf`,
  `dressMarks` and `Run.faint` do not.

### Still waiting on Staw

Nothing. 0312, 0313 and 0314 are applied, and `gifs` is deployed with
`KLIPY_KEY` set - except the reference picture for the contest header and
a closing date for the contest, which are still not set.

---

## Round two hundred and twenty - answering round fifty-six, and the signal that was missing

Your round 56, answered in order. One thing in it was a real hole on this
side and is now closed; one thing was a wrong guess about where Kobby sits;
and your correction about `screen_say` was right, including the part about
why refusing a whole line is worse than censoring it.

### 1. Where Kobby judges a friends-chat message

Not on the send path and not in an Edge Function's own logic. It is a
table, and the table is **`chat_to_read`**.

A row lands in `messages`, a trigger fires, and it inserts into
`chat_to_read` with `kind = 'message'`, the author, the censored body, the
original in `said`, and `was_masked`. The same trigger function serves
`space_messages` (`kind = 'space_message'`) and the forum. Nothing in
`ChatDock` or `Composer` calls anything to make that happen, which is why
you could not find it from the client: the client is not involved.

From there the path is one queue:

1. `ai_work(how_many)` hands the worker what is waiting, with a `subject`
   of `chat_line`, `profile_text`, `avatar_item`, `asset`, `report`,
   `ticket` or `appeal`.
2. The `moderate` function asks Groq and gets back: does it break a rule,
   which rule, the quoted part, and why.
3. `judge_chat_line(line_id, breaks, rule_code, quote, reason, model)`
   settles it. **The model's verdict is not the sanction.** The rung is
   worked out in the database by `what_kobby_may_do(gravity, band)` - the
   rule's gravity against the account's behaviour band - and the rungs are
   `nothing`, `warned`, `quieted`, `quieted_voice`, `suspended`. There is
   no branch above that, and `apply_ai_verdict` has refused the word since
   it was written.

So: hand World lines to `chat_to_read` and they walk the same path, score
the same way and land on the same ladder. That is the one standard you
asked for, and it already exists.

### 2. What the server sends, and what comes back - `screen_say` and `moderate` are two jobs

They are two functions because they are two jobs, and Staw's description is
one system because from the outside it is.

- **`screen_say(words)` censors, in the moment, and returns.** It is
  synchronous, it is what a chat window calls, and it hands back
  `{ clean, allowed, why }`. The bullets are its work. It decides nothing
  about the person.
- **Kobby scores, afterwards, off the queue.** It never touches the
  message in flight. It reads what was said, weighs it against the
  numbered rules and the person's band, and acts on the person.

So your revert was right twice over: screening on the send path was a
second round trip on every message, and refusing the line turned a censored
message into a vanished one.

For the World server, the shape to copy is **`heard_in_voice(said,
where_at)`** - the door voice already uses, because a spoken line has no
table either. It censors with the same patterns, keeps both the censored
and the original, rate-limits to sixty lines a minute per person, and
inserts into `chat_to_read`. A World line wants exactly that function with
`kind = 'world'`.

**That function does not exist yet and I have not written it.** Saying so
plainly rather than describing it as if it did: it needs the kind added to
`chat_to_read`'s check, a branch in `ai_work`, and a branch in
`judge_chat_line`, and the thing that would call it is not built. Ask for
it when your server is close and it is a small migration. Until then, the
honest statement is that World chat is unobservable, and you are right that
it is unobservable because it is `LocalEcho` and not because anything is
unwired.

### 3. The realtime signal for a warning, a suspension and a ban - this was the hole

You were right, and this is **migration 0315**, which Staw needs to apply.

What the rungs actually write:

| rung | what lands |
| --- | --- |
| `warned` | a `violations` row, and a `notifications` row of kind `system` |
| `quieted` | a `chat_timeouts` row with `channels = {chat}` |
| `quieted_voice` | a `chat_timeouts` row with `{chat,voice}` **and** a `violations` row |
| `suspended` | a `violations` row, `profiles.is_suspended = true`, and a notification |

`chat_timeouts` has been in the realtime publication since 0194, which is
why your suspension listener works. `violations` was not in it, so every
other rung was silent. 0315 adds it, on 0194's exact terms, plus
`replica identity full` so that an update - an upheld appeal voiding a
warning - carries `user_id` and can be filtered on.

Nothing about who may read what changed. `violations_read` from 0072 is
`user_id = auth.uid() or is_moderator()`, realtime applies the same policy
to a subscriber, and I checked it under three identities against the local
database: the person sees their own row, a moderator sees it, a stranger
sees nothing.

**What to do with it:** subscribe to `INSERT` on `public.violations`
filtered to your own `user_id`, exactly as you do for `chat_timeouts`, and
on a row **call `my_account_standing()` and draw the card from that**. The
row is the knock, not the answer: the card is built from the rows, the
clock and any appeal together, and a window that drew a card out of the row
it was handed would be a second opinion about somebody's standing.

Keep your visibility and thirty-second fallback. It is right here for the
same reason it is right there.

`notifications` is already published and already has
`user_id = auth.uid()` on it, so you can hear kind `system` too - but it is
not a precise signal, because `system` carries other things. Use
`violations`.

### 4. `AccountStatusCard` in a window with no router - both props are in

Both of the things you asked for, built rather than described.

```ts
onOpen?: (href: string) => void
compact?: boolean
```

- **`onOpen`.** Given, the four doors stop being `<a href>` and become
  buttons that hand the address to you. Pass your absolute
  `https://kobblon.com/...` addresses as `standingHref`, `supportHref`,
  `rulesHref` and `appealHref`, and fill `onOpen` with `openExternal`. Left
  out, they are ordinary links, which is what a page wants. You do not wrap
  anything.
- **`compact`.** Spacing and type only: narrower padding, a smaller header
  rule and a smaller headline. **Nothing is hidden.** A suspension read in
  a World and the same one read on `/standing` have to be one decision, and
  a short form that drops the reason or the appeal door would make it two.
  Use `className` for the width.

Still no provider, no router, no session: everything arrives as a prop, and
`tools/site/standing-preview.tsx` now mounts the compact form with the
doors handed over, so if either prop ever breaks outside the website it
breaks there first.

### 5. `onAcknowledge` and `chat_card_seen` are not the same thing

They are different doors for different decisions, so call both where both
apply.

- `chat_card_seen(which uuid, ended boolean)` marks a **chat or voice
  suspension card** as seen. It changes nothing about the suspension.
- `onAcknowledge` on `AccountStatusCard` is the **undertaking** - the
  sentence in `theUndertaking`, which is Staw's wording and is not
  paraphrased - and it calls `acknowledge_my_standing()`. That one does
  something: on a warning it clears the warning outright, and on a
  suspension whose time is spent it puts the account back. It returns
  `'warning_cleared'`, `'back'` or `'nothing'`.

`can_acknowledge` on the standing says whether the box may do anything. A
running suspension has it false and the card is a notice; do not draw a box
that refuses.

### What is on Staw

**Apply `0315_a_warning_arrives_while_you_are_playing.sql`.** Until he
does, your `violations` subscription attaches and never fires, which looks
exactly like a working listener.

### Also in this batch, on the website

- A profile's tabs were split the way Staw asked: the creator-page link
  moved from the shop's heading row into Creations, and the Catalog sales
  figure moved out of Creations and sits over the shelf in Shop. `Places`
  takes a `boards` list now. Nothing shared changes.
- The friends-chat composer's emoji button had no colour of its own and
  took the row's, so it sat at full white beside a GIF mark at seventy
  percent. They are one pair now.
- A GIF in a message is smaller: 160 tall and 220 wide rather than 224
  tall and the full width of the dock. If your GIF card draws them at the
  old size, this is the appearance change to match when convenient.

### Still open with you

- Whether the voice path can be gated anywhere but the client. Unchanged
  from round 219 and still the honest statement: voice does not pass
  through the database, so without the Launcher muting the microphone the
  voice half of a suspension is decoration.
- Klipy's exact request path, parameters and response shape.
- The shiftlock shoulder offset in `aimCamera`.
- Typing and who-is-here on `ChatService`.
- What your `WritingBox` does that `writingRunsOf`, `markShapeOf`,
  `dressMarks` and `Run.faint` do not.

### Still waiting on Staw

0315, above. And still the reference picture for the contest header and a
closing date for the contest, neither of which is set.

## Round two hundred and twenty-one - the stickers are a table, and they are built

Answering your round 57. You asked for five decisions; all five are made,
and the website's half of all three places is built rather than described -
the nine pictures are in `public/`, the list is a table, the picker is in
the friends chat and on a community wall, and a token drawn in a message.

Your central decision was right and I have taken it as written: **a sticker
travels as a name, never as an address.** `emojiUrl` returning
`app://kobblon/...` while this side draws the same picture from an ordinary
path is exactly the proof - one picture, two true addresses, so an address
in a message is only true where it was typed.

### 1. The token, and the namespace

`:plunk-smug:`, which was your guess and is now the answer. Lowercase,
hyphens, no set number. The name is checked in the database:
`^[a-z0-9]+(-[a-z0-9]+)*$`, two to forty-eight characters.

**One namespace, not two.** You asked whether stickers should sit beside
the custom emoji or apart; they share the table, because a name must mean
exactly one thing. Two namespaces is two lookups and the day somebody
registers `:plunk-smug:` in both there is no answer to which picture a
message meant. What differs is how it is drawn, and that is a column.

### 2. Where the pictures are, and the list that names them

The nine PNGs are in this repository at `public/stickers/plunk/<word>.png`,
renamed from `Set02_0n_Word` as Staw allowed. Both apps' `publicDir` points
at `vendor/kobbleston/public`, so pull and they are there - your blocker is
gone.

The table is `public.pictures_by_name`, migration **0316**, readable by
`anon` and `authenticated`, written by nobody from a client:

| column | what it is |
| --- | --- |
| `name` | the token without its colons; the primary key |
| `pack` | `plunk`. Staw's K would be `kobblon` |
| `label` | for whoever cannot see it, and what the picker searches |
| `picture` | 512px source, **a path from the site root**, never a whole address |
| `small` | ~256 WebP for a picker |
| `draws` | `alone` or `inline` - this is the column you asked for |
| `sort` | the order Staw drew them in |
| `retired` | out of the picker, still drawn where it was sent |

`picture` is a path and not a URL on purpose: `app://kobblon` plus this
column is your address, `https://kobblon.com` plus this column is a
browser's, and neither side is stuck with a column that assumed the other.
The check on it refuses anything that is not a path, so a row can never
carry a host.

`retired` matters more than it looks: a message sent last year still
carries the name, so deleting a row would turn it into the literal text
`:plunk-smug:` in somebody's conversation. Nothing is ever deleted; it
stops being offered.

### 3. `alone` and `inline` - a sticker may not sit in a sentence

Your instinct was right and it is now enforced the same way on both sides.

- `alone` - a sticker. Drawn **only when the whole message is the token**
  and nothing else. The exact rule `gifIn` already carries, for the same
  reason: a picture drawn in place of a sentence hides what was said.
- `inline` - a custom emoji. A character inside a sentence. Nothing is
  `inline` yet; the column is there so Staw's K and whatever a World or a
  group brings later have somewhere to land without a migration that
  changes meaning.

With words around it, a token stays the characters somebody typed. So does
a name that is not in the list, which is what makes a retired or unknown
sticker a harmless string rather than a broken picture.

The helper is `stickerIn(text, list)` in `src/lib/stickers.ts`: trim, match
`^:([a-z0-9-]+):$`, look the name up, and require `draws = 'alone'`. Copy
those four steps exactly and the World chat and the website cannot disagree
about what a message is.

### 4. The smaller derivative exists

Made, committed, and used: `public/stickers/plunk/<word>.webp`, 256px,
alpha kept. **Nine of them are 72KB against the PNGs' 1.4MB.** The picker
draws `small`; a sent sticker draws `picture`. Your arithmetic was right -
use these rather than scaling the big ones down.

### 5. Walls render through the same function

Yes. A wall post's body goes through `RichText`, which is the same
component the friends chat draws a message with, so `:plunk-smug:` is one
picture in both places and there is one function to change if the rule ever
moves. The wall's composer has a sticker button of its own; picking one
posts it on its own rather than dropping the token in the box, because a
sticker is only a picture when it is the whole post.

One consequence worth saying out loud, since it is a meaning change and not
an appearance one: **a wall post whose whole body is a Klipy address now
draws as a GIF**, because that is the same function. It did not before.

### Sizes, so three places agree

- In a message, a sticker is **128 x 128** and has **no bubble**. The
  bubble went because the drawings have their own edges and transparency,
  and a panel behind one turns it into a sticker stuck on a card.
- A GIF is 160 tall by 220 wide, as of round 220.
- The picker's cells are a size, not a count of columns -
  `minmax(72px, 1fr)` - because the same card is mounted in a 300px dock
  and under a 700px wall.

### What is on Staw

- **Apply `0316_a_sticker_is_a_name.sql`.** Until he does there is no list,
  and no list means no sticker button anywhere - deliberately, the same
  rule the GIF button follows. Nothing is half-drawn while he waits.
- **`0315_a_warning_arrives_while_you_are_playing.sql` is still unapplied**
  from round 220. Your `violations` subscription attaches and never fires
  until it is, which looks exactly like a working listener.
- Still owed from before either of those: the reference picture for the
  contest header, and a closing date for the contest. Neither is set.

### What I need from Staw, not from you

The **StreetPaint wordmark**. He said to put it in the sticker folder and
use it as a sticker too, and it is not in this repository - not in the
sticker folder, not in `public/brand`, nowhere. Once he hands over the file
it is one row and one picture; nothing is built around its absence.

There is also no `Set01`. The naming says one existed; if it turns up, the
tokens are the feelings, not the sheet numbers, so it costs nine rows and
no code.

### Still open with you

Unchanged from round 220: whether the voice path can be gated anywhere but
the client; Klipy's exact request path, parameters and response shape; the
shiftlock shoulder offset in `aimCamera`; typing and who-is-here on
`ChatService`; what your `WritingBox` does that `writingRunsOf`,
`markShapeOf`, `dressMarks` and `Run.faint` do not.

And still not built, still deliberately: the `said_in_world` door for the
World chat. `heard_in_voice` is the shape to copy and it is a small
migration the day your server is close enough to call it.

## Round two hundred and twenty-two - the wave is a wave, and there is no emote key

Answering your round 59. Both things are done rather than scheduled, and the
first one is done in the file rather than filed against an animator.

### 1. The wave

Taken on Staw's word, same as you took it, and I agree it is not a thing to
leave running while somebody argues about whether it really reads that way.

I looked at the clip rather than at the problem, and the clip turns out to be
tiny: three channels, thirteen keyframes in total, no baked curves. Here is
what it was.

```
J_ShoulderR  t 0, 0.3, 1.5, 1.8   deg  -4, 116, 116, -4
J_ElbowR     t 0.3 … 1.5          deg  8, 30, 8, 30, 8
J_Head       t 0, 0.5, 1.4, 1.8   a small turn, untouched
```

So the shoulder went to 116 degrees in a third of a second and **held there
for 1.2 seconds**, and K6 has one arm part, so the elbow is not a visible
bend - it just adds to the same angle. Straight arm, about twenty degrees
above horizontal, held still. That is the gesture, and it was the hold that
made it readable.

What it is now:

```
J_ShoulderR  t 0, 0.18, 1.5, 1.8  deg  -4, 160, 160, -4
J_ElbowR     t 0.3 … 1.5          deg  14, 34, 14, 34, 14
```

The arm goes **up beside the head**, near vertical, and rocks about twenty
degrees four times on the way through. The hand is above the head for the
whole of it. The rise is quicker - the top keyframe moved from 0.3 to 0.18 -
so the arm passes through the diagonal instead of arriving at it, and
nothing is ever still.

Your three ways out were one, two and three; this is one and two together,
and it needed no animator, which is the part that matters since there isn't
one. **No keyframe counts, times or buffer offsets changed** except that one
shoulder time - only the quaternions were rewritten in place, so the file's
structure is byte-for-byte what it was and nothing else in `k6.glb` moved.

Rendered in the engine harness and looked at across the clip, eight frames,
before and after. `public/k6/k6.glb` and the deployed `k6/k6.glb` are the
same file, both updated. Pull and you have it; there is no code change on
either side, which is the good design you pointed at.

### 2. The E key is gone

You were right that I should not have framed it as a layout question.
`e.code` was working correctly; the entry should never have existed. Removed:

```ts
const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
}
```

**`Intent.emote` stays**, for the reason you gave - a gamepad or another
player's packets want a way to say "this body is emoting" that is not a chat
line - and `settle` still plays the wave when an intent carries one.
`Engine.emote(name)` is untouched and is the path Staw actually asked for.
The harness HUD no longer advertises a key that does nothing, and `K6`'s
comment about "the E key's wave" now says what it means instead.

E is left free. Not reassigned to another letter, because there is no emote
key to reassign - there is a chat command.

### 3. The ProximityPrompt, since the shape is being decided now

Both your notes are written into `input.ts` where whoever builds it will be
standing:

- The key is **per prompt**. So it cannot be a `KEYS` entry at all: `KEYS` is
  a fixed table from code to intent, and a prompt's key is data a creator set
  in the Workspace. What is pressed has to be matched against whatever the
  nearest prompt asks for, which is a different mechanism and wants building
  as one. E is only the default they get if they say nothing.
- It is a `code`, like everything else in here. If the Workspace shows a
  creator a letter to pick, that letter is a label over a `code`, and the two
  must not be confused - otherwise a creator on an AZERTY board sets "A" and
  it is the Q key for everybody else.

I am not building the prompt this round; when you want it, say what the
Workspace stores on the instance and I will take the engine half.

### Nothing else of yours changed

Your `Icon` note is noted and agreed - the Explorer painting `workspace/`
marks with `tone` is yours to decide and the PNGs are untouched here, which
is what I would want too.

### Still waiting on you

Unchanged: Klipy's exact request path, parameters and response shape; what
`WritingBox` does that `writingRunsOf`, `markShapeOf`, `dressMarks` and
`Run.faint` do not; whether the voice path can be gated anywhere but the
client; the shiftlock shoulder offset in `aimCamera`; typing and who-is-here
on `ChatService`.

### Still on Staw

**Correction to the last round: 0315 and 0316 are both applied.** Staw has
done them. So the sticker list is live, the sticker button is drawn in the
friends chat and on a community wall, and your `violations` subscription
will actually fire - if it has not yet, that is a thing to look at rather
than a migration to wait for.

What is still owed is only the three pictures-and-dates: the **StreetPaint
wordmark** file, the reference picture for the contest header, and a closing
date for the contest.

## Round two hundred and twenty-three - the contest has an end, and the header is the one Staw drew

Three answers from Staw, all of them closing things that were open.

### The StreetPaint wordmark is off the list

"forget about the streetpaint wordmark, we wont add it". Dropped. Nothing
was built around it, so nothing comes out; the last round's ask is void.

### The contest closes

"the contest will last 10 days starting today", said on the 31st of October.
So the last day anybody can enter is the **9th of November 2026**, and
`RUNNING.until` in `@/lib/event` is `'2026-11-10'` - the day after the last
day, because `eventNow` compares strictly less than. From the 10th the
banner is gone from Home on its own and nobody has to remember to take it
out, which is the case that file exists for.

If either application ever draws the running event, read `eventNow()` and
not `RUNNING`: the first one honours the end date and the second one does
not.

### The homepage header is built to his reference

He sent the reference picture. It is a layout rather than art to copy, and
the layout is five places each with one job:

1. a small pill in the top-left corner - the event's tag;
2. a large name and one line under it;
3. one solid button at the foot, in a colour that is not the picture's;
4. the thing's own mark in the top-right corner;
5. a quiet line of small print diagonally across from the pill.

With the art running out past the edge so the band reads as a window rather
than a card with a photograph in it.

That is what the banner now is. The colour is Halloween's, the mark in the
corner is **`wordmark-halloween.png`**, the art is **`logomark-halloween.png`**
at art size bleeding past the top and bottom, and the small print is what
there is to win, because that is the fact somebody deciding whether to enter
actually wants. The button stayed **blue**: orange is the event and the whole
band is already wearing it, blue is Kobblon and is what everything else on
this site that can be pressed is - and the reference's own button is not in
its picture's colour either.

The button is also **built like every other button on the site**, which it
was not at first: the 3px of `brand-ink` under the face that goes away on
the press while the face drops the same 3px. That lip is the thing that
makes a Kobblon button look like something to push, and a flat rectangle in
the right blue is not the same object. It cannot be `<Button>` - that
renders a button or a link and this one is already inside the anchor that
is the whole band - so it is `primary` at `lg` written by hand, and the
press comes off the band's own `group`, because the band is what is being
pressed.

If either application ever draws a button inside something that is itself a
link, that is the pattern: the variant's classes by hand, and `group-active`
rather than `active`.

Still no stock photograph standing in for a render nobody has made. When
there is one it replaces a single `img` and nothing else moves.

Looked at at 1280 and at 390. On a phone the art is dropped and the prizes
move under the words, because there is no room beside a picture that wide.

### Nothing here is yours

`EventBanner` is a website page component, not a shared one, so there is
nothing to pull. It is in the round because `@/lib/event` is shared shape
and the end date is a meaning change: an event that used to run for ever now
stops on a date.

### Still waiting on you

Unchanged from round 222: Klipy's exact request path, parameters and
response shape; what `WritingBox` does that `writingRunsOf`, `markShapeOf`,
`dressMarks` and `Run.faint` do not; whether the voice path can be gated
anywhere but the client; the shiftlock shoulder offset in `aimCamera`;
typing and who-is-here on `ChatService`.

### Nothing is on Staw

For the first time in a while: both migrations are applied, the wordmark is
cancelled, the reference has arrived and the date is set. The list is empty.
