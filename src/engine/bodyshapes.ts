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
 * A part built by cutting its silhouette and extruding it.
 *
 * Three attempts went into this and the first two are worth writing down,
 * because the obvious route does not work. `RoundedBoxGeometry`'s segment
 * count is the rounding of its corners and nothing else: at three segments
 * or at twelve, the flat faces have vertices only at the top and the
 * bottom, so there is nothing in the middle to pull in. Measured, twice,
 * after tuning numbers that could not have had any effect. A plain
 * `BoxGeometry` with its sides divided does take a waist - and loses every
 * rounded edge, which is what Staw saw: "ours is kinda ugly ngl and not
 * rounded like other body parts we made".
 *
 * So the silhouette is cut as a shape and extruded through the depth, with
 * the bevel doing the rounding. That gives both things at once: the sides
 * are wherever the profile says, and every edge is rounded like the arms
 * next to it. The profile is a list of straight lines rather than a curve,
 * because Staw asked for "something a bit more geometrical like for the
 * roblox girl torso" - straight diagonals meeting at the waist, not an
 * organic bulge.
 *
 * The depth arithmetic: the bevel adds `r` to each face, so the extrusion
 * is `d - 2r` deep and the shape is cut `r` inside the full width. What
 * comes out measures exactly the part's own box, which is not a nicety -
 * the clothing sheet is measured against that box.
 */
function extruded(
  size: { w: number; h: number; d: number },
  /**
   * How wide the part is at each height, as a fraction of its own box, cut
   * into the silhouette so the bevel rounds the diagonals properly.
   *
   * Width only, and that is a limit of the method rather than a taste: an
   * extrusion is one thickness all the way through, and bringing the chest
   * and the back in afterwards bends the flat face it was cut from - the
   * front of the torso came out as a fan of creased triangles, which is
   * what it looks like when a cap stops being flat. The reference does
   * narrow through the depth as well, by about the same amount; at this
   * size, against arms that do not, it is not worth a surface that reads as
   * broken.
   */
  profile: { up: number; across: number }[],
  round = 0.075,
) {
  const r = Math.min(round, Math.min(size.w, size.d) / 4)
  const half = size.w / 2 - r
  const top = size.h / 2 - r

  // Up the left side and down the right, so the outline closes.
  const line = new THREE.Shape()
  const sorted = [...profile].sort((a, b) => a.up - b.up)
  const at = (one: { up: number; across: number }) => ({
    x: half * one.across,
    y: -top + one.up * (top * 2),
  })

  const first = at(sorted[0])
  line.moveTo(-first.x, first.y)
  for (const one of sorted.slice(1)) {
    const point = at(one)
    line.lineTo(-point.x, point.y)
  }
  for (const one of [...sorted].reverse()) {
    const point = at(one)
    line.lineTo(point.x, point.y)
  }
  line.closePath()

  const made = new THREE.ExtrudeGeometry(line, {
    depth: size.d - r * 2,
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 1,
  })

  /*
   * Extruded forwards from zero, so it is moved back onto the middle. A
   * part that is half a depth out of its box wears its clothes half a depth
   * out of them too.
   */
  made.translate(0, 0, -(size.d - r * 2) / 2 - r)

  /*
   * Then made to measure exactly the part's own box.
   *
   * The arithmetic above gets within a hundredth and not closer: a bevel
   * grows the outline along the normal, and where two lines meet at a
   * corner the two growths add, so the shoulders end up a touch wider than
   * the width they were cut to. A hundredth of a ston is nothing to look at
   * and it is not nothing to the rule - the sheet is measured against the
   * box, and "inside the box" has to be true rather than nearly true.
   */
  made.computeBoundingBox()
  const box = made.boundingBox!
  const fit = (was: number, wanted: number) => (was > 0.0001 ? wanted / was : 1)
  made.translate(
    -(box.max.x + box.min.x) / 2,
    -(box.max.y + box.min.y) / 2,
    -(box.max.z + box.min.z) / 2,
  )
  made.scale(
    fit(box.max.x - box.min.x, size.w),
    fit(box.max.y - box.min.y, size.h),
    fit(box.max.z - box.min.z, size.d),
  )

  made.computeVertexNormals()
  return made
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
    /*
     * Full width at the shoulders and at the hips, straight in to the waist
     * and straight out again. The chest and the back do not move - it is
     * the same torso from the front and a waist from the side.
     *
     * The numbers are measured off the file Staw made rather than guessed:
     * the waist sits at 0.38 of the way up, not halfway, and it comes in to
     * 0.70 of the width and 0.68 of the depth. A waist halfway up reads as
     * an hourglass; his sits low, which is why it reads as a person.
     *
     * Measured and not used. The file is a Roblox Studio export and says so
     * in its first line - "This file is brought to you by Roblox
     * Corporation" - so what it gave us is its proportions, and the surface
     * is ours. It also could not have been used as it stands: a body part
     * here is geometry the engine builds, so that it keeps the bone it is
     * skinned to and the box the clothing sheet is measured against.
     */
    build: (size) => extruded(size, [
      { up: 0, across: 1 },
      { up: 0.38, across: 0.7 },
      { up: 1, across: 1 },
    ]),
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
