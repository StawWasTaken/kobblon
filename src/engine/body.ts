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
  // legs 0 -> 3.7
  LeftLeg: { bone: 'J_HipL', middle: [0.85, 1.85, 0] },
  RightLeg: { bone: 'J_HipR', middle: [-0.85, 1.85, 0] },
  // torso 3.7 -> 7.3
  Torso: { bone: 'J_Chest', middle: [0, 5.5, 0] },
  // arms beside it, same top and bottom
  LeftArm: { bone: 'J_ShoulderL', middle: [2.55, 5.5, 0] },
  RightArm: { bone: 'J_ShoulderR', middle: [-2.55, 5.5, 0] },
  // head 7.3 -> 9.7
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

    const box = new RoundedBoxGeometry(
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
