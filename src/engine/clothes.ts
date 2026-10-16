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
 * The grid the sheet is drawn on, in pixels.
 *
 * A body part a ston deep is one cell; two stons is two. The body happens to
 * come in whole cells at 64 to the half-ston, which is what makes a fixed
 * grid possible at all and is not a coincidence - K6's proportions were
 * chosen to be the familiar ones.
 */
export const CELL = 64

/**
 * Still exported under its old name, because the Workspace reads it.
 *
 * It was the scale the first sheet was laid out at - every region worked out
 * from the part's real size in stons. The sheet is a fixed grid now, so this
 * is the conversion that grid happens to use rather than the thing the
 * layout is built from.
 */
export const PIXELS_PER_STON = CELL / 1.8

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

/** The sheet, which is one size whatever is being made. */
export const SHEET = { width: 585, height: 559 }

/**
 * Where everything sits on a template.
 *
 * **The layout everybody already has.** Staw, holding up a shirt sheet from
 * somewhere else: "if i upload this to kobblon then it will work and become
 * a proper shirt". That is the requirement and it is the right one - the
 * people who will make clothes for Kobblon have been making them for years
 * and have the files to prove it. A layout of our own would be correct,
 * original, and would throw all of that away on the first day.
 *
 * So these are the numbers that sheet actually uses, measured off one
 * rather than invented: 585 by 559, a 64 pixel grid, the torso unfolded
 * across the top and the two limbs unfolded side by side underneath it. A
 * torso panel is 128 wide and 128 tall with 64 wide sides; a limb panel is
 * 64 by 128.
 *
 * Two details are easy to get wrong and both show up as a sleeve on back to
 * front. **The limbs are mirrored**: the lid and floor of the left one sit
 * over its fourth panel and the right one's over its first, so the two
 * inner faces meet in the middle of the sheet. And **the order across is
 * not the same for the two of them** either, for the same reason.
 *
 * It fits K6 because K6 is the familiar shape: a torso two wide, two tall
 * and one deep, and limbs one by two by one.
 *
 * This replaces the layout the first Kobblon templates were drawn against.
 * Anything uploaded before today was painted into a sheet that no longer
 * exists and will be laid on the body by this one; on a platform this age
 * that is a handful of items, and it is worth saying rather than working
 * around.
 */

/** The torso's six panels, which are the same on a shirt and on trousers. */
const TORSO_PANELS: Record<Side, Region> = {
  top: { x: 231, y: 10, w: 128, h: 64 },
  left: { x: 167, y: 74, w: 64, h: 128 },
  front: { x: 231, y: 74, w: 128, h: 128 },
  right: { x: 359, y: 74, w: 64, h: 128 },
  back: { x: 423, y: 74, w: 128, h: 128 },
  bottom: { x: 231, y: 202, w: 128, h: 64 },
}

/*
 * A limb's four faces, in the order they lie across its block, and which of
 * those four the lid and floor sit over. The avatar's left limb and its
 * right one are mirror images of each other on the sheet.
 */
const LIMBS = [
  { at: 16, across: ['back', 'left', 'front', 'right'] as Side[], flapAt: 3 },
  { at: 313, across: ['left', 'front', 'right', 'back'] as Side[], flapAt: 0 },
]

const LIMB_ROW = 346
const LIMB_LID = 282
const LIMB_FLOOR = 474

export function templateFor(kind: Clothing): Template {
  const regions: Record<string, Region> = {}
  const [body, ...limbs] = COVERS[kind]

  for (const side of SIDES) {
    regions[key(body as BodyPart, side)] = { ...TORSO_PANELS[side] }
  }

  limbs.forEach((part, nth) => {
    const { at, across, flapAt } = LIMBS[nth]
    across.forEach((side, column) => {
      const x = at + column * CELL
      regions[key(part as BodyPart, side)] = { x, y: LIMB_ROW, w: CELL, h: CELL * 2 }
      if (column === flapAt) {
        regions[key(part as BodyPart, 'top')] = { x, y: LIMB_LID, w: CELL, h: CELL }
        regions[key(part as BodyPart, 'bottom')] = { x, y: LIMB_FLOOR, w: CELL, h: CELL }
      }
    })
  })

  return { kind, width: SHEET.width, height: SHEET.height, regions }
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
 *
 * Staw asked for it to be "a bit more like roblox but without copying them,
 * and also make it aesthetic". What that means in practice is three things
 * their sheet gets right and the first version here did not: the front of
 * each part reads as the front at a glance, every panel says which way is
 * up, and the whole sheet is one picture rather than a scatter of boxes.
 *
 * So each part is a strip with its name down the side, the front panel is
 * the only one filled in the brand colour, the seams between panels are
 * drawn as hairlines rather than full boxes, and there is a centre line and
 * a corner tick on each panel - which is the thing you actually need when
 * lining a pocket up with the one on the other side.
 *
 * Everything drawn here ends up in the texture if the creator does not paint
 * over it, so it is all kept faint on purpose. Guides, not decoration.
 */
export function drawTemplate(sheet: Template, canvas: HTMLCanvasElement) {
  canvas.width = sheet.width
  canvas.height = sheet.height
  const brush = canvas.getContext('2d')
  if (!brush) return canvas

  brush.clearRect(0, 0, sheet.width, sheet.height)
  brush.textBaseline = 'top'

  /*
   * Grouped back into parts, because the sheet is laid out as one strip per
   * part and the drawing wants to say so - a name down the side of a strip
   * and a box around it, neither of which a loop over loose regions can do.
   */
  const strips = new Map<string, Region[]>()
  for (const [name, region] of Object.entries(sheet.regions)) {
    const part = name.split('.')[0]
    const had = strips.get(part)
    if (had) had.push(region)
    else strips.set(part, [region])
  }

  for (const [part, regions] of strips) {
    const left = Math.min(...regions.map((one) => one.x))
    const right = Math.max(...regions.map((one) => one.x + one.w))
    const top = Math.min(...regions.map((one) => one.y))
    const bottom = Math.max(...regions.map((one) => one.y + one.h))

    // The strip's own ground, so a part reads as one object unfolded.
    brush.fillStyle = 'rgba(255,255,255,0.035)'
    brush.fillRect(left, top, right - left, bottom - top)

    /*
     * The part's name, large and faint, in the band the lid leaves empty -
     * on whichever side of the strip the lid is not. The limbs are mirrored,
     * so a fixed corner puts the name inside a sleeve on one of them.
     */
    const lid = sheet.regions[`${part}.top`]
    const lidLeftOfMiddle = lid
      ? lid.x + lid.w / 2 < (left + right) / 2
      : true
    brush.save()
    brush.fillStyle = 'rgba(27,52,232,0.12)'
    brush.font = '700 22px system-ui, sans-serif'
    brush.textAlign = lidLeftOfMiddle ? 'right' : 'left'
    brush.textBaseline = 'bottom'
    brush.fillText(
      part.toUpperCase(),
      lidLeftOfMiddle ? right - 4 : left + 4,
      (lid ? lid.y + lid.h : top + 34) - 6,
    )
    brush.restore()
    brush.textBaseline = 'top'
  }

  for (const [name, region] of Object.entries(sheet.regions)) {
    const [part, side] = name.split('.')
    const front = side === 'front'

    brush.fillStyle = front ? 'rgba(27,52,232,0.12)' : 'rgba(255,255,255,0.045)'
    brush.fillRect(region.x, region.y, region.w, region.h)

    // The seam. A hairline, in the brand colour on the front and grey
    // elsewhere, so the panel somebody is looking for is the lit one.
    brush.strokeStyle = front ? 'rgba(27,52,232,0.55)' : 'rgba(140,150,180,0.35)'
    brush.lineWidth = 1
    brush.strokeRect(region.x + 0.5, region.y + 0.5, region.w - 1, region.h - 1)

    /*
     * The centre line, dashed, down every panel. This is the guide that
     * does real work: a logo on the chest and a stripe down a sleeve are
     * both "find the middle", and counting pixels on a template is how
     * everybody's first shirt ends up a little to the left.
     */
    const middle = Math.round(region.x + region.w / 2) + 0.5
    brush.save()
    brush.setLineDash([3, 5])
    brush.strokeStyle = front ? 'rgba(27,52,232,0.30)' : 'rgba(140,150,180,0.18)'
    brush.beginPath()
    brush.moveTo(middle, region.y + 3)
    brush.lineTo(middle, region.y + region.h - 3)
    brush.stroke()
    brush.restore()

    /*
     * A tick in the top two corners: which end is up, without a word for
     * it. A panel upside down is the mistake that survives being looked at,
     * because a sleeve is nearly symmetrical and a stripe does not care.
     */
    brush.strokeStyle = front ? 'rgba(27,52,232,0.5)' : 'rgba(140,150,180,0.3)'
    brush.beginPath()
    brush.moveTo(region.x + 0.5, region.y + 7.5)
    brush.lineTo(region.x + 0.5, region.y + 0.5)
    brush.lineTo(region.x + 7.5, region.y + 0.5)
    brush.moveTo(region.x + region.w - 7.5, region.y + 0.5)
    brush.lineTo(region.x + region.w - 0.5, region.y + 0.5)
    brush.lineTo(region.x + region.w - 0.5, region.y + 7.5)
    brush.stroke()

    brush.font = `${front ? 700 : 500} 10px system-ui, sans-serif`
    brush.fillStyle = front ? 'rgba(27,52,232,0.85)' : 'rgba(120,130,160,0.8)'
    brush.fillText(side.toUpperCase(), region.x + 4, region.y + 4)
    if (front) {
      brush.fillStyle = 'rgba(27,52,232,0.6)'
      brush.font = '500 10px system-ui, sans-serif'
      brush.fillText(part, region.x + 4, region.y + 17)
    }
  }

  /*
   * The sheet's own label, in the gap at the top left where no region sits.
   * A downloaded file that says what it is and how big it is saves the one
   * question everybody asks after resizing it by accident.
   */
  brush.font = '700 10px system-ui, sans-serif'
  brush.fillStyle = 'rgba(27,52,232,0.45)'
  brush.fillText(`KOBBLON ${sheet.kind.toUpperCase()} ${sheet.width}x${sheet.height}`, 2, 1)

  return canvas
}
