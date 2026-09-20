# The Kobblon Engine, K6, and what runs where

Kobblon is one platform with three clients, and only one of them runs
experiences.

```
Web        social, discovery, profiles, Catalog, account      never runs an experience
Launcher   plays experiences                                  holds the engine
Creator    makes and tests experiences                        holds the same engine
```

The website points at experiences. It does not run them, and nothing in
`src/engine` is imported by the site.

## The stack, and why

Everything here is already TypeScript on Vite, so the engine is **three.js**
(`three`, WebGL today, the same API in front of WebGPU later).

- One language and one build for the site, the engine, Creator and Launcher.
- Creator and Launcher can both be a desktop shell around the same engine
  bundle, which is what keeps "it worked in Creator" from becoming a support
  ticket.
- glTF is the asset format, which means K6 opens in Blender the day somebody
  wants to take the model further by hand.

There is one runtime. There will not be a second one.

## Stons

Kobblon measures in stons. One ston is 0.2 metres, K6 is ten stons tall, and
gravity is written in stons per second squared. The engine does not convert at
its edges: a number in a scene file, a number in the physics and a number a
creator types are the same number.

## K6

K6 is the avatar. It has exactly six body parts:

```
K6
├─ Head
├─ Torso
├─ LeftArm    arm and hand, one mesh
├─ RightArm   arm and hand, one mesh
├─ LeftLeg    leg and foot, one mesh
└─ RightLeg   leg and foot, one mesh
```

A hand is part of its arm and a foot is part of its leg. There is no seventh
part and no eighth, because a hand that is its own part is a hand the Catalog,
the inventory, the avatar editor and every experience have to dress separately
for the rest of the platform's life.

Underneath, it is a real skinned humanoid rig: sixteen joints, prefixed `J_`
so no bone shares a name with a body part. Those joints are the rig's own
business. The six parts above are what Kobblon, the Catalog and anything
dressing an avatar ever see.

**K6 is generated, not modelled.** `tools/k6/` builds the model, the skeleton,
the skinning and the animations and writes `public/k6/k6.glb`, about 38 kB.
Nothing was downloaded and nothing was traced: the geometry is boxes placed by
a script, which is also why K6 can be reshaped by editing numbers rather than
by opening a 3D package.

```
node tools/k6/build-k6.mjs       # rebuild the avatar
npm run k6:look                  # a page that renders it in every pose
```

Animations ship with the avatar rather than with an experience: `idle`,
`walk`, `run`, `jump`, `fall`, `land`, `wave`.

### Kobby is not K6

Kobby is the mascot, and lives in the branding. K6 is the playable avatar.
They share an identity and nothing else.

## The engine

`src/engine`, and it knows nothing about the website.

```
units.ts        stons, gravity, how big K6 is
input.ts        keyboard and mouse to an Intent, and nothing else
controller.ts   an upright box that walks, falls, slides along walls, climbs steps
k6.ts           loading, cloning, painting and animating the avatar
experience.ts   the manifest format, read defensively, built into a scene
engine.ts       the loop that puts those together, plus the camera
```

The controller is deliberately not a physics engine. An avatar is a box that
slides, stands and falls, which covers every movement an experience needs
before it needs ragdolls. A real solver goes behind the same calls later.

`Engine.tick(dt, intent)` is public so a test can step the world at a fixed
rate instead of racing a clock. That is how the checks below work.

## An experience

An experience is content the engine reads, not a program it installs. A V1
manifest is JSON: a spawn, some light, and a list of boxes.

```
public/experiences/first-ground.json
```

This is what lets the Launcher stay still while experiences move. Changing an
experience changes a file; only a change to the runtime needs a new Launcher.

Everything in a manifest is read as untrusted content: `readManifest` checks
the format, caps the size, and replaces anything it does not recognise with a
default rather than believing it.

## Running it

```
npm run engine:dev      the runtime on its own, with a debug overlay
npm run engine:check    drives it headlessly and asserts what it did
```

`engine:check` is not a smoke test. It steps the real runtime and asserts that
the experience loads, K6 has six parts, gravity lands it on the spawn pad,
walking holds walking speed, running is faster, a wall stops it, a jump leaves
the ground and comes back, and the stairs get climbed rather than bumped into.

## The sky

A World names its sky by Catalog id, never by address: a manifest that can
name any host is a manifest that can point every player at anything. Whoever
runs the World decides what an id means, through `resolveAsset`, so Creator
can answer with a file that has not been published yet.

The art is a horizontal cross: four faces in a row, top above the second and
bottom below it, corners unused.

`buildSky(manifest, resolveAsset)` is exported, so an editor drawing its own
scene with its own camera puts up the same background the runtime will
without borrowing the engine to do it. A picture that will not load never
stops a World opening: the colour is the fallback, always.

## What a part can be

```
shape         box, wedge, cylinder, sphere
material      plastic, wood, metal, brick, grass, sand, concrete, glass, neon
colour        the creator's; the material decides how it answers light
transparency  0 solid, 1 invisible
reflectance   0 flat, 1 a mirror
decal         { id, face } — a Catalog id, never an address
```

A material is an enum rather than a texture library on purpose: a creator
picks from a list they can hold in their head, every World costs the same to
load, and there is nothing there to moderate. Glass is see-through on its own
and neon carries its own light, so a creator gets both without knowing what a
shader is.

**Each one carries a pattern, drawn rather than downloaded.** Nine materials
that differ only in how shiny they are are nine coloured boxes with different
highlights: a material reads as itself because you can see the courses in the
brick. `textures.ts` draws a small greyscale pattern per material on a canvas
at load, which buys three things a texture pack does not: nothing to
download, no seam to get wrong, and no licence to honour. The last matters,
because Kobblon redistributes every file it ships and most free texture sites
permit use but not redistribution.

The pattern is greyscale and multiplies the creator's colour, so brick in
Kobblon blue is still recognisably brick.

**The repeat is per part, and it is the part that decides whether a World
looks right.** `TILES_PER_STON` says how often a pattern repeats across one
ston, and the repeat is folded into the UVs when the geometry is scaled
rather than into the texture. So one texture serves every part, and a box
gets it right on each face separately: a floor forty stons across and two
thick shows forty of something on top and two on its edge. A pattern
stretched to fit would say how big a part is instead of what it is made of,
and a wall of four bricks beside a wall of four hundred is what makes a World
look wrong without anybody being able to say why.

Metal keeps a moderate metalness because a metal with nothing to reflect
renders black, and a World is not required to have a sky. When one does, the
sky becomes the scene's environment, so metal reflects it. `reflectance` is
separate and goes further, because a creator asking for a mirror is asking on
purpose.

Decals are a pass of their own, `applyDecals(built, resolveAsset)`, because a
World should appear and then have its pictures arrive rather than wait for
them. On a box the picture goes on the named face and the other five keep the
plain material; on any other shape it wraps, which is what somebody means by
putting a decal on a sphere. An editor calls the same function with its own
resolver, so a picture shows before it is published.

## What collides, and what only looks like it

**Every shape collides as its bounding box.** A wedge looks like a ramp and
stops you like a step. A sphere rolls nowhere and blocks a square. This is
worth knowing before building a World around a ramp.

It is not an oversight to be patched in the controller: an upright box that
slides along axes cannot describe a slope, and bolting one special case on
buys a ramp that works and a cylinder that still does not. What fixes it is a
real solver, which is the same work that makes a part fall when it is not
anchored. Both are in the same decision, and it has not been made yet.

## What is not built yet

In the order it is likely to be needed: scripting, sound, shadows, a Creator
that writes manifests, a Launcher that runs them, deep linking from the
website, and multiplayer. Multiplayer comes last on purpose, after the
single-player runtime is boring.
