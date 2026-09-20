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
