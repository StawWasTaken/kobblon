/*
 * Body parts: the shapes a part of the body can be, beyond the plain block.
 *
 * Staw: "we want to be able to sell bodyparts too (kobblon only can upload
 * some)". A body part is not a thing worn over the body - it *is* the body,
 * which is why it is here and not in `clothes.ts`, and why there is no file
 * to upload. A shape is geometry, and geometry somebody uploads is a model
 * that has to agree with the skeleton, the clothing wrap, every accessory
 * socket and the camera. That is a pipeline, not a form field.
 *
 * So a body part names a shape this file knows how to build, and Kobblon
 * chooses from the shapes that exist. Nothing here implies a control the
 * runtime cannot honour.
 *
 * **The box a shape lives in never changes.** `BODY` is what the clothing
 * template is measured against, where each socket sits and what the camera
 * frames; a shape may move the surface around inside that box and may not
 * leave it. That is what keeps a shirt fitting a narrower torso instead of
 * floating off it, and it is the same rule Roblox's own body parts follow.
 */
import * as THREE from 'three'
import { BODY, type BodyPart } from './clothes'

export type BodyShape = {
  /** Which part of the body it replaces. */
  part: BodyPart
  /** What it is called where somebody picks one. */
  label: string
  build: (size: { w: number; h: number; d: number }) => THREE.BufferGeometry
}

/**
 * Pulls a box in at the waist and lets it out again at the hips.
 *
 * Built by moving the vertices of the rounded box rather than by turning a
 * profile: the box already has the rounded edges every other part has, and a
 * lathe would have given the one part people look hardest at a different
 * surface from the arms either side of it.
 *
 * `narrow` is how far in the waist comes, as a fraction of the half width.
 * `shoulder` and `hip` take the ends in or let them out, and are zero on
 * the one shape there is: the block's own width at the top and the bottom,
 * tight in the middle, is exactly what was asked for.
 */
function tapered(
  size: { w: number; h: number; d: number },
  { narrow, shoulder, hip, waistAt }:
  { narrow: number; shoulder: number; hip: number; waistAt: number },
) {
  /*
   * A plain box with the sides divided, not the rounded one every other part
   * is built from.
   *
   * `RoundedBoxGeometry`'s segment count is the rounding of the corners and
   * nothing else: however high it goes, the sides still have vertices only
   * at the top and the bottom, so there is nothing in the middle to pull in.
   * Measured rather than assumed, after two rounds of tuning numbers that
   * could not have had any effect - the part came out 1.80 wide at the top
   * and 1.80 at the bottom with a waist asked for in between.
   *
   * What is lost is the 0.075 rounding on the edges, which at this size is
   * under a pixel on a card and invisible beside the arms.
   */
  const box = new THREE.BoxGeometry(size.w, size.h, size.d, 2, 24, 2)
  const at = box.getAttribute('position') as THREE.BufferAttribute

  for (let i = 0; i < at.count; i += 1) {
    const y = at.getY(i)
    // 1 at the top of the part, 0 at the bottom.
    const up = y / size.h + 0.5
    /*
     * One curve, read at three heights: the shoulders, the waist and the
     * hips. `waistAt` is where the narrowest point sits - above the middle,
     * because a waist is above a hip and a torso whose thinnest point is
     * halfway up reads as an hourglass rather than a person.
     */
    /*
     * Each side measured against its own half, not against the longer of
     * the two: with one divisor the shorter side never reaches the end of
     * the curve, so the hips kept a third of the waist's pinch and came out
     * narrower than the shoulders on a shape whose whole point is that they
     * are not.
     */
    const toWaist = up > waistAt
      ? (up - waistAt) / (1 - waistAt)
      : (waistAt - up) / waistAt
    const pinch = narrow * (1 - Math.min(1, toWaist) ** 2)
    const ends = up > waistAt
      ? shoulder * ((up - waistAt) / (1 - waistAt)) ** 2
      : -hip * ((waistAt - up) / waistAt) ** 2

    /*
     * Width only. Staw: "its normal blocky torso like the regular torso but
     * in the middle on each side it gets tight, like a waist". The sides
     * come in; the chest and the back stay where the block has them, so it
     * is the same torso from the front and a waist from the side rather
     * than a smaller person.
     */
    at.setX(i, at.getX(i) * (1 - pinch - ends))
  }

  at.needsUpdate = true
  box.computeVertexNormals()
  return box
}

/**
 * Every shape there is, by the name a Catalog row carries in `shape`.
 *
 * The name is written into the database, so it is a thing that cannot be
 * renamed afterwards without orphaning whatever was sold under it. A shape
 * that is withdrawn is left here and stops being offered.
 */
export const BODY_SHAPES: Record<string, BodyShape> = {
  'torso-girl': {
    part: 'Torso',
    label: 'Girl torso',
    build: (size) => tapered(size, {
      narrow: 0.2, shoulder: 0, hip: 0, waistAt: 0.5,
    }),
  },
}

/** The shape a part should be, or nothing for the plain block. */
export type WornShapes = Partial<Record<BodyPart, string>>

/**
 * Which part of the body a wardrobe slot is.
 *
 * The wardrobe speaks in slots, lower case, because that is what a row in
 * `avatar_worn` says; the rig speaks in parts. One table, here, for the same
 * reason `socketFor` exists: a caller left to map between them is a second
 * opinion about what a torso is.
 */
export const PART_FOR_SLOT: Record<string, BodyPart> = {
  torso: 'Torso',
}

/** The same table read the other way, for a page that has the shape. */
export const SLOT_FOR_PART: Record<string, string> = Object.fromEntries(
  Object.entries(PART_FOR_SLOT).map(([slot, part]) => [part, slot]),
)

/** Whether a name is one this build knows, which a row from the database is not. */
export function shapeFor(name: string | null | undefined): BodyShape | null {
  if (!name) return null
  return BODY_SHAPES[name] ?? null
}

/** What the plain block of a part looks like, for a shape that is taken off. */
export function sizeOf(part: BodyPart) {
  return BODY[part]
}
