/*
 * Builds K6, the Kobblon avatar.
 *
 * Six body parts, no more: an arm carries its hand and a leg carries its
 * foot, because a hand that is its own part is a hand somebody has to dress
 * separately for the rest of the platform's life.
 *
 *   K6
 *   ├─ Head
 *   ├─ Torso
 *   ├─ LeftArm    (arm and hand, one mesh)
 *   ├─ RightArm   (arm and hand, one mesh)
 *   ├─ LeftLeg    (leg and foot, one mesh)
 *   └─ RightLeg   (leg and foot, one mesh)
 *
 * Underneath, it is a real humanoid skeleton. The bones inside a limb are an
 * implementation detail of the rig; the six parts above are what Kobblon, the
 * Catalog and anybody dressing an avatar ever see.
 *
 * Run: node tools/k6/build-k6.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Gltf } from './gltf.mjs'
import { box, ball, chunk, join, bind } from './geometry.mjs'
import { animations } from './animations.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/* ------------------------------------------------------------- the shape */

/**
 * K6 is ten stons tall, standing on the floor with its feet at zero. Every
 * number below is a ston, so the avatar and the world are measured the same
 * way and nobody has to remember a scale factor.
 */
const H = {
  legTop: 4.4,
  torsoTop: 8.0,
  headTop: 10.0,
}

/*
 * The v.02 rig, from Staw's drawing. Three notes on it, and each one is a
 * shape rather than a style:
 *
 *   Spherical head pivot  -- the head is a ball, and it turns on its own
 *                            centre rather than on the corner of a cube.
 *   Chunky limb geometry  -- limbs are thick and their edges are taken off,
 *                            so an arm catches light along its length
 *                            instead of ending in a hard line.
 *   Symmetrical torso     -- the same from either side and from either end,
 *                            slightly tapered so it is a body rather than a
 *                            crate.
 *
 * The balls at the shoulders and hips are in the drawing and are not
 * decoration: they are where the limb turns, and showing the pivot is what
 * keeps a raised arm from opening a gap you can see through.
 */
const R = {
  head: 1.18,
  shoulder: 0.52,
  hip: 0.6,
}

const shape = {
  head: join([
    ball({ at: [0, H.torsoTop + R.head * 0.86, 0], radius: R.head }),
  ]),
  torso: join([
    chunk({
      at: [0, (H.legTop + H.torsoTop) / 2, 0],
      size: [3.0, H.torsoTop - H.legTop, 1.5],
      // Narrower at the shoulders than at the waist by a hair, which is what
      // stops a symmetrical torso reading as a crate.
      taper: 0.94,
      bevel: 0.1,
    }),
    // The neck, so the head has something to sit on rather than floating.
    chunk({ at: [0, H.torsoTop + 0.16, 0], size: [0.85, 0.5, 0.85], bevel: 0.2 }),
  ]),
  arm: (side) => join([
    // The ball it turns on, at the corner it shares with the torso.
    ball({ at: [side * 1.72, H.torsoTop - 0.28, 0], radius: R.shoulder }),
    // shoulder to wrist
    chunk({
      at: [side * 1.95, (H.torsoTop + 4.9) / 2, 0],
      size: [1.0, H.torsoTop - 4.9, 1.0],
      bevel: 0.16,
    }),
    // the hand, part of the same body part rather than a seventh one
    chunk({ at: [side * 1.95, 4.4, 0.05], size: [1.1, 1.0, 1.15], bevel: 0.22 }),
  ]),
  leg: (side) => join([
    ball({ at: [side * 0.72, H.legTop - 0.1, 0], radius: R.hip }),
    // hip to ankle
    chunk({
      at: [side * 0.72, 2.45, 0],
      size: [1.3, 3.9, 1.3],
      bevel: 0.14,
    }),
    // the foot, part of the same body part
    chunk({ at: [side * 0.72, 0.25, 0.22], size: [1.35, 0.5, 1.9], bevel: 0.18 }),
  ]),
}

/* ------------------------------------------------------------ the skeleton */

/**
 * Where each joint sits when K6 is standing still. A joint is a point; the
 * bone is the gap between a joint and its parent, which is why there is no
 * length written anywhere.
 */
export const skeleton = [
  // Prefixed because the parts own the plain names: a mesh called Head and a
  // bone called Head are two things with one name, and a loader will rename
  // one of them behind your back.
  { name: 'J_Root', at: [0, 0, 0], parent: null },
  { name: 'J_Hips', at: [0, H.legTop, 0], parent: 'J_Root' },
  { name: 'J_Spine', at: [0, H.legTop + 1.3, 0], parent: 'J_Hips' },
  { name: 'J_Chest', at: [0, H.legTop + 2.6, 0], parent: 'J_Spine' },
  { name: 'J_Neck', at: [0, H.torsoTop, 0], parent: 'J_Chest' },
  { name: 'J_Head', at: [0, H.torsoTop + 0.35, 0], parent: 'J_Neck' },

  { name: 'J_ShoulderL', at: [1.95, H.torsoTop - 0.3, 0], parent: 'J_Chest' },
  { name: 'J_ElbowL', at: [1.95, H.legTop + 1.6, 0], parent: 'J_ShoulderL' },
  { name: 'J_ShoulderR', at: [-1.95, H.torsoTop - 0.3, 0], parent: 'J_Chest' },
  { name: 'J_ElbowR', at: [-1.95, H.legTop + 1.6, 0], parent: 'J_ShoulderR' },

  { name: 'J_HipL', at: [0.72, H.legTop, 0], parent: 'J_Hips' },
  { name: 'J_KneeL', at: [0.72, 2.3, 0], parent: 'J_HipL' },
  { name: 'J_AnkleL', at: [0.72, 0.5, 0], parent: 'J_KneeL' },
  { name: 'J_HipR', at: [-0.72, H.legTop, 0], parent: 'J_Hips' },
  { name: 'J_KneeR', at: [-0.72, 2.3, 0], parent: 'J_HipR' },
  { name: 'J_AnkleR', at: [-0.72, 0.5, 0], parent: 'J_KneeR' },
]

const index = Object.fromEntries(skeleton.map((bone, i) => [bone.name, i]))

/* ------------------------------------------------------------ the binding */

/**
 * Which bones own which part of which mesh. The bands overlap at a joint so
 * the geometry bends there rather than tearing.
 */
const binding = {
  head: [{ from: -99, to: 99, joint: index.J_Head }],
  torso: [
    { from: -99, to: H.legTop + 1.3, joint: index.J_Hips },
    { from: H.legTop + 1.3, to: H.legTop + 2.6, joint: index.J_Spine, blendWith: index.J_Chest },
    { from: H.legTop + 2.6, to: 99, joint: index.J_Chest },
  ],
  armL: [
    { from: -99, to: H.legTop + 1.6, joint: index.J_ElbowL },
    { from: H.legTop + 1.6, to: H.legTop + 2.4, joint: index.J_ElbowL, blendWith: index.J_ShoulderL },
    { from: H.legTop + 2.4, to: 99, joint: index.J_ShoulderL },
  ],
  armR: [
    { from: -99, to: H.legTop + 1.6, joint: index.J_ElbowR },
    { from: H.legTop + 1.6, to: H.legTop + 2.4, joint: index.J_ElbowR, blendWith: index.J_ShoulderR },
    { from: H.legTop + 2.4, to: 99, joint: index.J_ShoulderR },
  ],
  legL: [
    { from: -99, to: 0.8, joint: index.J_AnkleL },
    { from: 0.8, to: 2.3, joint: index.J_KneeL },
    { from: 2.3, to: 3.2, joint: index.J_KneeL, blendWith: index.J_HipL },
    { from: 3.2, to: 99, joint: index.J_HipL },
  ],
  legR: [
    { from: -99, to: 0.8, joint: index.J_AnkleR },
    { from: 0.8, to: 2.3, joint: index.J_KneeR },
    { from: 2.3, to: 3.2, joint: index.J_KneeR, blendWith: index.J_HipR },
    { from: 3.2, to: 99, joint: index.J_HipR },
  ],
}

/* ---------------------------------------------------------------- colours */

/**
 * The default K6 is Kobblon blue with a lighter head, which is the avatar
 * before anybody has dressed it. Every part is its own material so a colour
 * can be changed per body part without touching the mesh.
 */
const colours = {
  head: [0.98, 0.79, 0.24, 1],
  torso: [0.11, 0.2, 0.91, 1],
  armL: [0.98, 0.79, 0.24, 1],
  armR: [0.98, 0.79, 0.24, 1],
  legL: [0.16, 0.17, 0.24, 1],
  legR: [0.16, 0.17, 0.24, 1],
}

/* ----------------------------------------------------------------- build */

function inverseBind(bone) {
  // Every bone rests unrotated, so the inverse bind is a plain translation
  // back to the origin. Column major, as glTF wants it.
  const [x, y, z] = bone.at
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]
}

export function buildK6() {
  const gltf = new Gltf()

  // -- the bones, as nodes, each holding only its offset from its parent
  const boneNodes = skeleton.map((bone) => {
    const parent = bone.parent ? skeleton[index[bone.parent]] : null
    const at = parent
      ? [bone.at[0] - parent.at[0], bone.at[1] - parent.at[1], bone.at[2] - parent.at[2]]
      : bone.at
    return gltf.node({ name: bone.name, translation: at })
  })

  skeleton.forEach((bone, i) => {
    if (!bone.parent) return
    const parent = gltf.json.nodes[boneNodes[index[bone.parent]]]
    parent.children = [...(parent.children ?? []), boneNodes[i]]
  })

  // -- the skin every part shares, so one pose moves the whole avatar
  const skin = gltf.json.skins.push({
    name: 'K6',
    joints: boneNodes,
    skeleton: boneNodes[0],
    inverseBindMatrices: gltf.floats(skeleton.flatMap(inverseBind), 'MAT4', undefined),
  }) - 1

  // -- the six parts, and only six
  const parts = [
    { name: 'Head', geometry: shape.head, bands: binding.head, colour: colours.head },
    { name: 'Torso', geometry: shape.torso, bands: binding.torso, colour: colours.torso },
    { name: 'LeftArm', geometry: shape.arm(1), bands: binding.armL, colour: colours.armL },
    { name: 'RightArm', geometry: shape.arm(-1), bands: binding.armR, colour: colours.armR },
    { name: 'LeftLeg', geometry: shape.leg(1), bands: binding.legL, colour: colours.legL },
    { name: 'RightLeg', geometry: shape.leg(-1), bands: binding.legR, colour: colours.legR },
  ]

  const partNodes = parts.map((part) => {
    const skinning = bind(part.geometry, part.bands)
    const mesh = gltf.json.meshes.push({
      name: part.name,
      primitives: [{
        attributes: {
          POSITION: gltf.floats(part.geometry.positions, 'VEC3'),
          NORMAL: gltf.floats(part.geometry.normals, 'VEC3'),
          JOINTS_0: gltf.ubytes(skinning.joints),
          WEIGHTS_0: gltf.floats(skinning.weights, 'VEC4'),
        },
        indices: gltf.ushorts(part.geometry.indices),
        material: gltf.material({
          name: part.name,
          pbrMetallicRoughness: {
            baseColorFactor: part.colour,
            metallicFactor: 0,
            roughnessFactor: 0.75,
          },
        }),
      }],
    }) - 1

    return gltf.node({ name: part.name, mesh, skin })
  })

  const root = gltf.node({ name: 'K6', children: [boneNodes[0], ...partNodes] })
  gltf.json.scenes[0].nodes = [root]

  // -- the animations, which are engine assets rather than one game's props
  for (const clip of animations({ skeleton, index })) {
    const samplers = []
    const channels = []

    for (const track of clip.tracks) {
      const input = gltf.floats(track.times, 'SCALAR', undefined)
      const output = gltf.floats(track.values.flat(), 'VEC4', undefined)
      samplers.push({ input, output, interpolation: 'LINEAR' })
      channels.push({
        sampler: samplers.length - 1,
        target: { node: boneNodes[track.joint], path: 'rotation' },
      })
    }

    gltf.json.animations.push({ name: clip.name, samplers, channels })
  }

  return gltf
}

const out = resolve(here, '../../public/k6/k6.glb')
mkdirSync(dirname(out), { recursive: true })
const built = buildK6()
writeFileSync(out, built.glb())

console.log(`K6 written to ${out}`)
console.log(`  parts       ${built.json.meshes.length} (${built.json.meshes.map((m) => m.name).join(', ')})`)
console.log(`  bones       ${built.json.skins[0].joints.length}`)
console.log(`  animations  ${built.json.animations.map((a) => a.name).join(', ')}`)
console.log(`  size        ${(built.glb().byteLength / 1024).toFixed(1)} kB`)
