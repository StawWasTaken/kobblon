/*
 * K6's body: blocky, with the corners taken off.
 *
 * Staw, looking at the first rig: it is too round, and it looks nothing like
 * what Kobblon is. He is right. A soft organic body says one thing and a
 * world made of boxes says another, and the avatar standing in that world is
 * the one thing everybody looks at.
 *
 * So the parts are boxes with a small radius on the edges - blocky read from
 * across a street, softened enough up close that nothing has a razor edge.
 * The proportions do not change: they are measured off the rig the engine
 * was tuned around, so the camera heights, the collision box, the clothing
 * template and every attachment point keep meaning what they meant.
 *
 * **Why it is built here rather than modelled.** The parts are rigid - an
 * arm is one box that swings from the shoulder, not a tube that bends - so
 * the geometry is a box and the skinning is "every vertex belongs to one
 * bone". That is a few lines to generate and nothing to maintain, where a
 * modelled file is a binary nobody can read a diff of. It also means the
 * proportions live in code next to the template that wraps them, instead of
 * inside a `.glb` where changing them means re-exporting and re-measuring.
 *
 * The skeleton and the animations are the file's, and stay the file's.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BODY, type BodyPart } from './clothes'

/**
 * Where each part sits when the body is standing still, and which bone
 * carries it. Measured off the rig, in stons, as a height above the floor.
 */
export const PLACES: Record<BodyPart, { bone: string; middle: [number, number, number] }> = {
  /*
   * Stacked, not placed by eye. The legs stand on the floor, the torso
   * stands on the legs, the head stands on the torso, and the arms hang
   * beside the torso at the same height as it.
   *
   * Written out rather than computed so that each one can be read against
   * the sizes above with nothing more than addition - the first version
   * inherited these from the old rounded model, and the head overlapped the
   * torso by a quarter of a ston, which looked like a neck and was not one.
   */
  // Legs 0 -> 3.7, side by side, together exactly as wide as the torso.
  LeftLeg: { bone: 'J_HipL', middle: [0.9, 1.85, 0] },
  RightLeg: { bone: 'J_HipR', middle: [-0.9, 1.85, 0] },
  // Torso 3.7 -> 7.3.
  Torso: { bone: 'J_Chest', middle: [0, 5.5, 0] },
  // Arms beside it, hanging from the shoulder: the same box as a leg, so
  // its top is at the torso's top and its bottom falls a tenth below.
  LeftArm: { bone: 'J_ShoulderL', middle: [2.7, 5.45, 0] },
  RightArm: { bone: 'J_ShoulderR', middle: [-2.7, 5.45, 0] },
  // Head 7.3 -> 9.7.
  Head: { bone: 'J_Head', middle: [0, 8.5, 0] },
}

/**
 * How much of each edge is rounded.
 *
 * A fourteenth of the smallest part, so the softening reads the same on a
 * head as on an arm instead of swallowing the thin one. Large enough to
 * catch a highlight along every edge, far too small to make anything look
 * like a pill.
 */
const ROUNDING = 0.075
const SEGMENTS = 3

/**
 * A cylinder with its rims taken off, which is what a head is.
 *
 * Staw asked for a rounded cylinder, and three.js has a cylinder and a
 * capsule and nothing between them: a capsule's ends are hemispheres, which
 * on a head this short is a pill. So the profile is drawn - straight up the
 * side, a quarter circle into each flat end - and turned.
 *
 * `turns` is how many sides the circle has. Twenty-four is round at the size
 * a head is drawn and cheap enough that a World full of people is not paying
 * for it; at twelve the silhouette visibly has corners.
 */
function roundedCylinder(radius: number, height: number, corner: number, turns = 24) {
  const r = Math.max(0.01, radius)
  const h = Math.max(0.02, height)
  const c = Math.max(0.001, Math.min(corner, Math.min(r, h / 2) - 0.001))

  const profile: THREE.Vector2[] = []
  const steps = 4

  // Up from the middle of the flat bottom, round the bottom rim.
  profile.push(new THREE.Vector2(0, -h / 2))
  profile.push(new THREE.Vector2(r - c, -h / 2))
  for (let i = 1; i <= steps; i += 1) {
    const a = (Math.PI / 2) * (i / steps)
    profile.push(new THREE.Vector2(
      r - c + Math.sin(a) * c,
      -h / 2 + c - Math.cos(a) * c,
    ))
  }
  // Straight up the side, then round the top rim and in to the middle.
  profile.push(new THREE.Vector2(r, h / 2 - c))
  for (let i = 1; i <= steps; i += 1) {
    const a = (Math.PI / 2) * (i / steps)
    profile.push(new THREE.Vector2(
      r - c + Math.cos(a) * c,
      h / 2 - c + Math.sin(a) * c,
    ))
  }
  profile.push(new THREE.Vector2(0, h / 2))

  const turned = new THREE.LatheGeometry(profile, turns)
  turned.computeVertexNormals()
  return turned
}

/**
 * Replaces a rigged body's geometry with boxes, keeping its skeleton.
 *
 * Each part becomes one box bound entirely to one bone, which is what makes
 * it blocky in motion as well as at rest: an arm swings rather than bending,
 * the way a toy's does.
 *
 * Done to a clone, never to the loaded source - the source is handed out to
 * every avatar in a World, and rewriting its geometry would rebuild
 * everybody's body including the ones already standing somewhere.
 */
export function blockify(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return
    const part = mesh.name as BodyPart
    const place = PLACES[part]
    const size = BODY[part]
    if (!place || !size) return

    /*
     * The bone index is read from **this mesh's own skeleton**, not from the
     * first one found in the file.
     *
     * Each skinned mesh carries its own skeleton object, and nothing
     * promises two of them list their bones in the same order. In this file
     * they happen to agree, so taking the order from the first mesh worked;
     * it worked by luck, and a re-export that reordered one of them would
     * have pointed every vertex at the wrong bone.
     */
    const index = mesh.skeleton.bones.findIndex((bone) => bone.name === place.bone)
    if (index < 0) return

    /*
     * The head is turned, everything else is a box. The one part people
     * actually look at is the one worth a different shape.
     */
    const box = part === 'Head'
      ? roundedCylinder(size.w / 2, size.h, ROUNDING * 2)
      : new RoundedBoxGeometry(
        size.w, size.h, size.d, SEGMENTS,
        Math.min(ROUNDING, Math.min(size.w, size.d) / 2 - 0.001),
      )
    box.translate(place.middle[0], place.middle[1], place.middle[2])

    /*
     * Every vertex belongs to one bone, completely. A rigid part is the
     * whole point, and a weight shared across two bones is what gives the
     * soft shoulder this is replacing.
     */
    const count = box.getAttribute('position').count
    const skinIndex = new Uint16Array(count * 4)
    const skinWeight = new Float32Array(count * 4)
    for (let i = 0; i < count; i += 1) {
      skinIndex[i * 4] = index
      skinWeight[i * 4] = 1
    }
    box.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
    box.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))

    mesh.geometry.dispose()
    mesh.geometry = box
    /*
     * Deliberately not rebound. A skinned mesh's bind matrix and its
     * skeleton's bone inverses are one pair, made together; the geometry
     * above is written in the same space the file's was, so that pair is
     * still right. Swapping geometry does not change where a mesh is bound,
     * and calling `bind` again with a fresh matrix would pair the file's
     * bone inverses with a different bind space.
     */
    mesh.frustumCulled = false
  })
}

/**
 * Where a camera stands to take somebody's picture.
 *
 * Staw: a profile picture is a shot centred on the head, bigger, from the
 * front. So it is framed off the head's own place in the body table rather
 * than off the whole figure - a camera that framed the whole avatar and then
 * zoomed would move every time somebody put on a hat.
 *
 * Returned rather than applied, because the engine, the website and the
 * Workspace all want to take this picture and none of them should each
 * invent their own idea of what a headshot is.
 *
 * `fov` is in degrees. `room` is how much air to leave around the head. The
 * default takes in the top of the shoulders, which is what reads as a
 * portrait; tighter than about 1.4 the head touches all four edges and looks
 * like a mistake rather than a crop.
 */
export function headshot(fov = 30, room = 1.85) {
  const head = BODY.Head
  const place = PLACES.Head.middle
  // A hat sits above the head and a face is drawn on its front, so the shot
  // is centred a little above the middle of the head rather than on it.
  const middle = new THREE.Vector3(place[0], place[1] + head.h * 0.08, place[2])
  const reach = (Math.max(head.w, head.h) / 2) * room
  const away = reach / Math.sin((fov * Math.PI) / 360)
  return {
    middle,
    fov,
    // Straight on and very slightly above, which is how a person holds a
    // camera to somebody's face.
    position: new THREE.Vector3(middle.x, middle.y + away * 0.08, middle.z + away),
  }
}
