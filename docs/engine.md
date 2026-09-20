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

## What is not built yet

In the order it is likely to be needed: scripting, sound, shadows, a Creator
that writes manifests, a Launcher that runs them, deep linking from the
website, and multiplayer. Multiplayer comes last on purpose, after the
single-player runtime is boring.
