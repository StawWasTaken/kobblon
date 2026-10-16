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
 * front. **The limbs are mirrored**: the lid and floor sit over the front on
 * both, but the row runs the opposite way round the limb on each - so the
 * order across is not the same for the two of them.
 *
 * Which way round each runs is the part that has now been wrong twice. It
 * was a column out first, which put the front down the sides. Then the two
 * rows ran the same way round, which is not a mirror at all: it kept the
 * front and back where they belonged and swapped each limb's inner face
 * with its outer one. Staw: "the sides of the arms & legs that were
 * supposed being the inside sides were replaced by the ones on the
 * outside". The two faces it swaps are nearly the same on most garments,
 * which is why a seam or a stripe down a leg is the first thing that shows
 * it.
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
  top: { x: 231, y: 8, w: 128, h: 64 },
  left: { x: 165, y: 74, w: 64, h: 128 },
  front: { x: 231, y: 74, w: 128, h: 128 },
  right: { x: 361, y: 74, w: 64, h: 128 },
  back: { x: 427, y: 74, w: 128, h: 128 },
  bottom: { x: 231, y: 204, w: 128, h: 64 },
}

/*
 * A limb's four faces, in the order they lie across its block, and which of
 * those four the lid and floor sit over. The avatar's left limb and its
 * right one are mirror images of each other on the sheet.
 *
 * The panels are 64 wide with two pixels between them, which is why the
 * pitch is 66 and not the cell size. Those two pixels are where the sheet
 * draws its own lines, so that nothing a creator can see sits inside a
 * panel and ends up printed on the garment.
 */
const LIMBS: Record<'left' | 'right', { at: number; across: Side[]; flapAt: number }> = {
  /*
   * **The lid sits over the front.** That is the one rule the whole sheet is
   * laid out by, and it is how the torso reads too: the panel under the
   * cross's top flap is the front, and the row runs left, front, right, back
   * from there. The first version of this table was a column out on both
   * limbs - the lid was over the front and the faces were written down as
   * though it were over a side - so a pair of trousers came out with its
   * front down the sides of the legs. Staw: "the front is on the sides for
   * some reason".
   *
   * Keyed by which arm or leg it is, and not by the order the parts happen
   * to be listed in, because the sheet puts the avatar's **right** limb on
   * the left of the page. Reading them off in list order put every sleeve on
   * the wrong arm - it survives being looked at, because a sleeve is nearly
   * symmetrical and most shirts do not care until one of them does.
   */
  right: { at: 19, across: ['left', 'back', 'right', 'front'], flapAt: 3 },
  left: { at: 308, across: ['front', 'left', 'back', 'right'], flapAt: 0 },
}

/** Panel to panel across a strip: 64 of panel and 2 of gap. */
const PITCH = CELL + 2

const LIMB_ROW = 355
const LIMB_LID = 289
const LIMB_FLOOR = 485

export function templateFor(kind: Clothing): Template {
  const regions: Record<string, Region> = {}
  const [body, ...limbs] = COVERS[kind]

  for (const side of SIDES) {
    regions[key(body as BodyPart, side)] = { ...TORSO_PANELS[side] }
  }

  for (const part of limbs) {
    const { at, across, flapAt } = LIMBS[part.startsWith('Right') ? 'right' : 'left']
    across.forEach((side, column) => {
      const x = at + column * PITCH
      regions[key(part as BodyPart, side)] = { x, y: LIMB_ROW, w: CELL, h: CELL * 2 }
      if (column === flapAt) {
        regions[key(part as BodyPart, 'top')] = { x, y: LIMB_LID, w: CELL, h: CELL }
        regions[key(part as BodyPart, 'bottom')] = { x, y: LIMB_FLOOR, w: CELL, h: CELL }
      }
    })
  }

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
 * layout the body does not actually use.
 *
 * **The panels are empty, and that is the whole design.** Staw, holding up
 * the sheet everybody already draws into: "same exact template as roblox but
 * make it a different design for the images on it - the stuff that are not
 * apart of the clothing". The layout is the one every creator has muscle
 * memory for, down to the two pixels between panels; everything this file
 * draws - the field, the lines, the names, the notes - sits outside the
 * panels, in those two pixels and in the margins the layout leaves over.
 *
 * So nothing here can end up on a garment. The first version of this drew
 * faint guides inside each panel, which is a guide on the sheet and a ghost
 * on the shirt of anybody who did not paint over every corner of it.
 *
 * The panels are cleared to transparent rather than filled white, because a
 * clear pixel is now a clear pixel on the body: a sleeveless shirt is a
 * sheet with the sleeve panels left alone.
 */
export function drawTemplate(sheet: Template, canvas: HTMLCanvasElement) {
  canvas.width = sheet.width
  canvas.height = sheet.height
  const brush = canvas.getContext('2d')
  if (!brush) return canvas

  const FIELD = '#e4e5ea'
  const LINE = '#bfc3cd'
  const QUIET = '#9aa1b0'
  const LOUD = '#c7cad3'
  const BRAND = '#1b34e8'
  const type = 'system-ui, -apple-system, Segoe UI, sans-serif'

  brush.clearRect(0, 0, sheet.width, sheet.height)
  brush.fillStyle = FIELD
  brush.fillRect(0, 0, sheet.width, sheet.height)
  brush.textBaseline = 'top'

  // Every panel punched out of the field, and a hairline round it drawn in
  // the gap beside it rather than on it.
  for (const region of Object.values(sheet.regions)) {
    brush.clearRect(region.x, region.y, region.w, region.h)
  }
  brush.strokeStyle = LINE
  brush.lineWidth = 1
  for (const region of Object.values(sheet.regions)) {
    brush.strokeRect(region.x - 0.5, region.y - 0.5, region.w + 1, region.h + 1)
  }

  /*
   * Each part's name, large and quiet, in the margin its lid leaves empty.
   *
   * Which margin is not fixed: the two limbs are mirrored, so a corner that
   * is open on one of them is a sleeve on the other. The name goes on the
   * side of the strip the lid is not, which is the one rule that holds for
   * all three strips and for trousers as well as shirts.
   */
  const strips = new Map<string, Region[]>()
  for (const [name, region] of Object.entries(sheet.regions)) {
    const part = name.split('.')[0]
    const had = strips.get(part)
    if (had) had.push(region)
    else strips.set(part, [region])
  }

  const body = COVERS[sheet.kind][0] as string
  const spaced = (word: string) => word.split('').join(' ')

  for (const [part, regions] of strips) {
    const left = Math.min(...regions.map((one) => one.x))
    const right = Math.max(...regions.map((one) => one.x + one.w))
    const lid = sheet.regions[`${part}.top`]
    const floor = sheet.regions[`${part}.bottom`]
    const band = part === body ? lid : floor
    if (!band) continue

    const lidIsLeft = lid ? lid.x + lid.w / 2 < (left + right) / 2 : true
    const words = part.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase()

    /*
     * Sized to the gap it is standing in rather than set once. The gap is
     * whatever the lid leaves over, which is not the same on the torso as on
     * a limb, and a name that is one letter too long for it gets that letter
     * cut off by the panel beside it.
     */
    const room = (lidIsLeft ? sheet.width - 16 - (band.x + band.w + 8) : band.x - 8 - 16)
    brush.save()
    brush.fillStyle = LOUD
    brush.textBaseline = 'middle'
    brush.textAlign = lidIsLeft ? 'right' : 'left'
    let size = 26
    brush.font = `700 ${size}px ${type}`
    while (size > 13 && brush.measureText(spaced(words)).width > room) {
      size -= 1
      brush.font = `700 ${size}px ${type}`
    }
    brush.fillText(
      spaced(words),
      lidIsLeft ? sheet.width - 16 : 16,
      band.y + band.h / 2,
    )
    brush.restore()
    brush.textBaseline = 'top'

    /*
     * And under a limb's name, the order its faces lie in across the sheet.
     * This is the thing people actually get wrong - the two arms do not
     * read the same way, and a sleeve drawn to the wrong order comes out on
     * the back of the other arm with no clue as to why.
     */
    if (part === body) continue
    const across = Object.entries(sheet.regions)
      .filter(([name, one]) => name.startsWith(`${part}.`) && one.h > CELL)
      .sort(([, one], [, other]) => one.x - other.x)
      .map(([name]) => name.split('.')[1])
    brush.save()
    brush.fillStyle = QUIET
    brush.font = `500 10px ${type}`
    brush.textAlign = lidIsLeft ? 'right' : 'left'
    brush.fillText(
      across.join('  ·  '),
      lidIsLeft ? sheet.width - 17 : 17,
      band.y + band.h / 2 + 20,
    )
    brush.restore()
  }

  /*
   * The corner that says what the file is. A sheet that has been resized by
   * accident is the commonest way a shirt comes out blurred, and the size is
   * the one thing nobody can read off the picture itself.
   */
  brush.save()
  brush.fillStyle = BRAND
  brush.fillRect(16, 16, 4, 40)
  brush.fillStyle = '#4a4f5e'
  brush.font = `800 20px ${type}`
  brush.fillText('KOBBLON', 28, 15)
  brush.fillStyle = QUIET
  brush.font = `600 11px ${type}`
  brush.fillText(`${sheet.kind.toUpperCase()} TEMPLATE`, 29, 39)
  brush.font = `500 10px ${type}`
  brush.fillText(`${sheet.width} × ${sheet.height}`, 29, 53)
  brush.restore()

  /*
   * The three things worth knowing, in the margin beside the torso. Said as
   * short lines rather than a paragraph: this is a picture somebody opens in
   * a paint program, not a page they read.
   */
  const notes = [
    'The empty squares are',
    'the garment. Everything',
    'else is this sheet',
    'talking to you, and is',
    'not painted on.',
    '',
    'Clear pixels stay clear',
    'on the avatar, so a gap',
    'here is skin or what is',
    'worn underneath, never',
    'white.',
    '',
    'Keep the size.',
    'Save as PNG.',
  ]
  brush.save()
  brush.fillStyle = QUIET
  brush.font = `500 11px ${type}`
  notes.forEach((line, nth) => brush.fillText(line, 17, 80 + nth * 15))
  brush.restore()

  /*
   * And last, the panels again.
   *
   * Everything above is laid out to keep clear of them, and this is the line
   * that makes that true rather than intended: a letter that strays into a
   * panel because a font fell back or a part got a longer name is a letter
   * printed on somebody's shirt. Cutting it off looks wrong on the sheet,
   * which is exactly where it should look wrong.
   */
  for (const region of Object.values(sheet.regions)) {
    brush.clearRect(region.x, region.y, region.w, region.h)
  }

  return canvas
}
