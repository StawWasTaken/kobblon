/*
 * Clothes on K6: a flat picture wrapped round a body.
 *
 * Staw's brief, and it is the right one: a shirt is not a model, it is an
 * image laid onto the body by a template - the same picture every creator
 * draws into, with a known place for the front of the torso, the back, each
 * side of each arm. Trousers are the same thing over the torso and the legs.
 * A face is a picture on the front of the head. None of it is geometry: the
 * body never changes shape, only what is painted on it.
 *
 * Two things follow from that and they are the whole of this file.
 *
 * **The template and the wrapping have to be one fact.** If the layout a
 * creator draws into is written down in one place and the coordinates that
 * read it are written down in another, they drift, and the drift shows up as
 * everybody's shirt being a few pixels off round the arms. So the regions
 * below are measured from the body itself, the template picture is drawn
 * from those regions, and the texture coordinates are computed from the same
 * regions. One source, three uses.
 *
 * **A body part is treated as a box.** K6's parts are rounded, not boxy, but
 * every one of them is box-shaped enough that a triangle can be assigned to
 * whichever of the six faces its normal points along most. That is what
 * makes a flat template wrap a soft shape - the rounding at a corner takes
 * pixels from both sides of the seam, which is what you want.
 *
 * No DOM beyond a canvas it is handed, and no imports from the website: the
 * Workspace vendors this whole folder.
 */
import * as THREE from 'three'

/** The six sides of a part, in the order the template lays them out. */
export const SIDES = ['left', 'front', 'right', 'back', 'top', 'bottom'] as const
export type Side = (typeof SIDES)[number]

/**
 * How big each part is. In stons, and the only place these numbers live.
 *
 * Everything that cares about the body's shape reads them: the geometry that
 * is built from them, the template a creator downloads, the coordinates that
 * wrap that template round a part. Change a number here and all three move
 * together, which is the entire reason for them being here and nowhere else.
 *
 * The figure they describe: legs half the height, torso and arms the same
 * length as each other, a head a little wider than it is deep. Ten stons
 * tall in total, which is `K6_HEIGHT`, which is what the camera and the
 * collision box are built around - so this table and that constant have to
 * agree, and there is a check that says so.
 *
 * They are flat numbers rather than a formula because a person looking at an
 * avatar and saying "the head is too big" wants to change the head, not
 * discover which multiplier the head came out of.
 */
export const BODY = {
  /*
   * A cylinder rather than a box, so the numbers mean slightly different
   * things: `w` and `d` are the two widths it is drawn across, and they are
   * equal because a head is round. The template still reads them as the
   * sides of a box, which is right - a face is laid onto the front, and
   * wrapping a cylinder is the same job as wrapping the box it sits in.
   */
  Head: { w: 2.6, h: 2.4, d: 2.6 },
  Torso: { w: 3.6, h: 3.6, d: 1.8 },
  /*
   * Two legs are exactly as wide as the torso, which is what stops it
   * looking heavy: at 1.7 each they came to 3.4 against a 3.6 torso, and
   * that fifth of a ston of overhang reads as a belly rather than as a
   * narrower stance.
   *
   * And the arms are the legs. Staw asked for them to be literally the
   * same, and they are the same four numbers - one shape used twice rather
   * than two shapes that have to be kept in step.
   */
  LeftArm: { w: 1.8, h: 3.7, d: 1.8 },
  RightArm: { w: 1.8, h: 3.7, d: 1.8 },
  LeftLeg: { w: 1.8, h: 3.7, d: 1.8 },
  RightLeg: { w: 1.8, h: 3.7, d: 1.8 },
} as const

export type BodyPart = keyof typeof BODY

/** What a shirt covers, and what trousers cover. Staw: trousers, not pants. */
export const COVERS = {
  shirt: ['Torso', 'LeftArm', 'RightArm'],
  trousers: ['Torso', 'LeftLeg', 'RightLeg'],
} as const

export type Clothing = keyof typeof COVERS

/**
 * How many pixels one ston of body is worth on a template.
 *
 * Big enough that a drawn seam is a few pixels rather than one, small enough
 * that a template is an image somebody can open. 48 puts the front of a
 * torso at 142 by 188, which is about what a person expects to be given.
 */
export const PIXELS_PER_STON = 48

/** A rectangle on the template, in pixels, top-left origin. */
export type Region = { x: number; y: number; w: number; h: number }

/** Every region of one kind of template, and how big the sheet is. */
export type Template = {
  kind: Clothing
  width: number
  height: number
  regions: Record<string, Region>
}

const key = (part: BodyPart, side: Side) => `${part}.${side}`

/**
 * Where everything sits on a template.
 *
 * Each part gets a strip: the four sides in a row, left to right, with the
 * top and bottom stacked above and below the front. It is the shape a person
 * recognises as "a thing unfolded", and it keeps the front - the only face
 * most people draw - in the middle where it is easy to find.
 */
export function templateFor(kind: Clothing): Template {
  const regions: Record<string, Region> = {}
  const pad = 8
  let y = pad
  let widest = 0

  for (const part of COVERS[kind]) {
    const { w, h, d } = BODY[part]
    const across = Math.round(w * PIXELS_PER_STON)
    const deep = Math.round(d * PIXELS_PER_STON)
    const tall = Math.round(h * PIXELS_PER_STON)

    // The row of four, and the lid and floor above and below the front.
    const row = y + deep
    let x = pad
    for (const side of ['left', 'front', 'right', 'back'] as const) {
      const wide = side === 'left' || side === 'right' ? deep : across
      regions[key(part, side)] = { x, y: row, w: wide, h: tall }
      if (side === 'front') {
        regions[key(part, 'top')] = { x, y, w: across, h: deep }
        regions[key(part, 'bottom')] = { x, y: row + tall, w: across, h: deep }
      }
      x += wide
    }

    widest = Math.max(widest, x + pad)
    y = row + tall + deep + pad
  }

  return { kind, width: widest, height: y, regions }
}

/**
 * Which side of its box a triangle is on, from the way it faces.
 *
 * The same reasoning as the box projection in `meshes.ts`, and deliberately
 * not shared with it: that one invents coordinates for a model that arrived
 * without any, where this one puts a known body into a known template. They
 * look alike and they answer different questions, and merging them would
 * mean one of the two getting a flag it has to be read with.
 */
function sideOf(nx: number, ny: number, nz: number): Side {
  const ax = Math.abs(nx)
  const ay = Math.abs(ny)
  const az = Math.abs(nz)
  if (ay >= ax && ay >= az) return ny >= 0 ? 'top' : 'bottom'
  if (ax >= az) return nx >= 0 ? 'left' : 'right'
  return nz >= 0 ? 'front' : 'back'
}

/**
 * Writes the texture coordinates that put a template onto a part.
 *
 * Into `uv1`, not `uv`. The body keeps whatever coordinates it was modelled
 * with, so a shirt can be taken off and the part is exactly as it was, and
 * so a future body texture and a shirt are not fighting over one channel.
 * The material reads it by setting `map.channel = 1`.
 *
 * `middle` is where the part sits in the body, so that a vertex can be
 * placed within its own box: the geometry is in body space, not part space,
 * and without this every part would be mapped as though it were standing at
 * the origin.
 */
export function wrapToTemplate(
  geometry: THREE.BufferGeometry,
  part: BodyPart,
  sheet: Template,
  middle: THREE.Vector3,
) {
  const position = geometry.getAttribute('position')
  if (!position) return
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const normal = geometry.getAttribute('normal')

  const { w, h, d } = BODY[part]
  const half = { x: w / 2, y: h / 2, z: d / 2 }
  const uv = new Float32Array(position.count * 2)

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i) - middle.x
    const y = position.getY(i) - middle.y
    const z = position.getZ(i) - middle.z

    const side = sideOf(normal.getX(i), normal.getY(i), normal.getZ(i))
    const region = sheet.regions[key(part, side)]
    if (!region) continue

    /*
     * Across and down the face, each from 0 to 1.
     *
     * Which way round each face reads is settled by standing outside it and
     * asking which way body space runs across your view. From the front
     * that is +X; from the back it is -X; from the avatar's left it is -Z
     * and from its right +Z. Getting the sign wrong does not break
     * anything - it hands every creator a shirt with their lettering
     * backwards, which they would reasonably report as their own mistake.
     *
     * Worth saying how the first version got all four wrong and looked
     * right: the test texture had a B on it, and a B at the size a torso
     * renders at cannot be told from its own mirror image. An F can.
     */
    let across: number
    let down: number
    if (side === 'front') { across = 0.5 + x / w; down = 0.5 - y / h }
    else if (side === 'back') { across = 0.5 - x / w; down = 0.5 - y / h }
    else if (side === 'left') { across = 0.5 - z / d; down = 0.5 - y / h }
    else if (side === 'right') { across = 0.5 + z / d; down = 0.5 - y / h }
    else if (side === 'top') { across = 0.5 + x / w; down = 0.5 + z / d }
    else { across = 0.5 + x / w; down = 0.5 - z / d }

    const u = (region.x + across * region.w) / sheet.width
    // Pixels count down the sheet and texture coordinates count up it.
    const v = 1 - (region.y + down * region.h) / sheet.height
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }

  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2))
  void half
}

/**
 * The template a creator draws into, as a picture.
 *
 * Drawn from the same regions the wrapping reads, so it cannot describe a
 * layout the body does not actually use. Every region is outlined and named,
 * because an unlabelled template is a puzzle: somebody draws a sleeve, puts
 * it on, and finds it on the back of the other arm.
 */
export function drawTemplate(sheet: Template, canvas: HTMLCanvasElement) {
  canvas.width = sheet.width
  canvas.height = sheet.height
  const brush = canvas.getContext('2d')
  if (!brush) return canvas

  brush.clearRect(0, 0, sheet.width, sheet.height)
  brush.font = '11px system-ui, sans-serif'
  brush.textBaseline = 'top'

  for (const [name, region] of Object.entries(sheet.regions)) {
    const [part, side] = name.split('.')
    brush.fillStyle = side === 'front' ? 'rgba(27,52,232,0.10)' : 'rgba(255,255,255,0.05)'
    brush.fillRect(region.x, region.y, region.w, region.h)
    brush.strokeStyle = 'rgba(27,52,232,0.55)'
    brush.lineWidth = 1
    brush.strokeRect(region.x + 0.5, region.y + 0.5, region.w - 1, region.h - 1)
    brush.fillStyle = 'rgba(20,24,40,0.75)'
    brush.fillText(side, region.x + 4, region.y + 4)
    if (side === 'front') brush.fillText(part, region.x + 4, region.y + 18)
  }

  return canvas
}
