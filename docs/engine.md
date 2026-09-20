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

`buildSky(manifest, resolveAsset)` is exported and returns a `Sky`:

```
colour        what to paint when there is no picture
box           a Skybox to add to a scene, or null
environment   the same picture as a cube, for scene.environment
```

It is a box in the scene rather than a background on purpose. A background
cube is centred on the camera, which puts the horizon exactly at eye level
wherever you stand. A box can be placed, and this one sits below the eye and
travels with it, so the horizon is lower and there is more sky above: what
standing outdoors actually looks like. `Skybox.follow(camera)` is what keeps
it there, and an editor calls it from its own loop.

The mesh is named `kobblon:sky` rather than `Sky`, because a creator is
allowed to call their World Sky and then looking the sky up by name finds
their World. `engine.skybox` is the accessor.

A picture that will not load never stops a World opening: the colour is the
fallback, always.

## What a part can be

```
shape         box, wedge, cylinder, sphere
material      smooth, plastic, stons, wood, planks, metal, plate, brick,
              grass, sand, pebble, slate, marble, concrete, glass, neon
colour        the creator's; the material decides how it answers light
transparency  0 solid, 1 invisible
reflectance   0 flat, 1 a mirror
children      decals: pictures on one face each
```

A material is an enum rather than a texture library on purpose: a creator
picks from a list they can hold in their head, every World costs the same to
load, and there is nothing there to moderate. Glass is see-through on its own
and neon carries its own light, so a creator gets both without knowing what a
shader is.

**Stons** is plastic with a ston on every ston: Kobblon's own version of the
square a brick toy has on top. That is the whole point of it, and it is why
the unit is called a ston. A part made of it says how big it is without
anybody having to click it.

Five of the materials are pictures rather than drawings: grass, stons,
brick, wood and planks are surfaces somebody recognises, and drawing
convincing grass on a canvas is a losing game. They are greyscale and they
multiply the colour a creator chose, so brick in Kobblon blue is still
recognisably brick, and they live in `public/engine/textures/`. An
application shipping the engine has its own copy and says where once:

```ts
import { setTextureBase } from '@kobblon/engine'
setTextureBase('app://engine/textures/')
```

Metal, sand, concrete and plastic stay drawn on a canvas at load. They are a
noise and a direction, they cost nothing to fetch, and there is no seam to
get wrong.

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

### A decal is a thing, not a field

```
{ kind: 'decal', picture: '<catalog id>', face: 'front',
  transparency?: 0, colour?: '#ffffff' }
```

Decals are children of a part rather than a property of one, because that is
what they are: a picture has a face, a tint and a transparency, and somebody
has to be able to see it in the tree, select it, and delete it without
deleting the wall underneath. A field holds one picture and cannot be
selected. A part may carry up to twelve.

A World written the old way, with `decal: { id, face }` on the part, still
opens: it is read as the one child it always meant.

A decal is a mesh parented to the part, sitting just off the face it names.
That is the point of parenting rather than painting: **a child inherits its
parent's scale, so resizing a wall resizes what is written on it.** A
material cannot do that, a material holds one picture per face, and a
material cannot be selected, renamed or deleted in an Explorer.

The gap between the picture and the surface is a fixed distance in the World,
converted into the part's own space by dividing by its size. The same local
offset on a thin part is a thousandth of a ston, which is below what a depth
buffer can tell apart, and the picture disappears.

**An id is whatever the Catalog calls a thing.** The engine never resolves one
itself, so it takes either shape: the content tag the Create pages show,
`IMG-1070`, or the row's uuid underneath. Which one a client holds is the
client's business.

They are applied in a pass of their own, `applyDecals(built, resolveAsset)`,
because a World should appear and then have its pictures arrive rather than
wait for them. On a box each decal takes the face it names and the others
keep the plain material; on any other shape the last one wraps it, which is
what somebody means by putting a picture on a sphere.

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
