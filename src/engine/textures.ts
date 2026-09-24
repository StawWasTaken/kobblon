import * as THREE from 'three'
import type { Material } from './materials'

/**
 * What a material looks like.
 *
 * Materials that differ only in how shiny they are are coloured boxes with
 * different highlights. A material reads as itself because of the pattern on
 * it: brick is brick because you can see the courses.
 *
 * Two kinds of pattern, for two different reasons:
 *
 * - **Pictures**, for the materials whose whole point is a surface somebody
 *   recognises: grass, stons, brick, wood, planks. Drawing convincing grass
 *   on a canvas is a losing game, and these were made for Kobblon rather
 *   than taken from a texture site, so there is no licence to honour.
 * - **Drawn on a canvas**, for the rest. Sand, concrete and plastic are a
 *   noise and a direction, they cost nothing to download and there is no
 *   seam to get wrong.
 *
 * Glass carries no pattern at all, and that is the right answer for it: a
 * pane reads as a pane because you can see through it.
 *
 * Either way a pattern is greyscale and multiplies the colour the creator
 * chose, so brick in Kobblon blue is still recognisably brick.
 */

/**
 * Where the picture patterns are served from.
 *
 * The website serves them from its own `public`. An application shipping the
 * engine has its own copy on disk and says so once, at start up, rather than
 * every material asking where it is.
 */
let base = '/engine/textures/'

export function setTextureBase(where: string) {
  base = where.endsWith('/') ? where : `${where}/`
  // Anything already handed out was fetched from the old place.
  for (const [material, texture] of loaded) {
    texture?.dispose()
    loaded.delete(material)
  }
  for (const [material, texture] of bumps) {
    texture?.dispose()
    bumps.delete(material)
  }
}

export const PICTURED: Material[] = [
  'grass', 'stons', 'brick', 'cobble', 'wood', 'planks', 'plate', 'metal',
  'pebble', 'slate', 'marble', 'sand', 'concrete',
]

/** A repeatable random, so a pattern is the same every time it is drawn. */
function seeded(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

const SIZE = 256

function sheet() {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const paint = canvas.getContext('2d')!
  paint.fillStyle = '#ffffff'
  paint.fillRect(0, 0, SIZE, SIZE)
  return { canvas, paint }
}

/** Grey, where 1 is the colour untouched and 0 is black. */
const grey = (level: number, alpha = 1) => {
  const at = Math.round(THREE.MathUtils.clamp(level, 0, 1) * 255)
  return `rgba(${at}, ${at}, ${at}, ${alpha})`
}

/** Speckle, drawn with wrap-around so the edges meet. */
function speckle(
  paint: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  radius: number,
  dark: number,
) {
  for (let i = 0; i < count; i += 1) {
    const x = random() * SIZE
    const y = random() * SIZE
    const r = radius * (0.5 + random())
    paint.fillStyle = grey(1 - dark * random(), 0.5)
    for (const [ox, oy] of [[0, 0], [SIZE, 0], [-SIZE, 0], [0, SIZE], [0, -SIZE]]) {
      paint.beginPath()
      paint.arc(x + ox, y + oy, r, 0, Math.PI * 2)
      paint.fill()
    }
  }
}

const patterns: Partial<Record<Material, () => HTMLCanvasElement>> = {
  plastic() {
    const { canvas, paint } = sheet()
    const random = seeded(29)
    paint.fillStyle = grey(0.985)
    paint.fillRect(0, 0, SIZE, SIZE)
    // Almost nothing: enough to stop a flat face reading as a hole.
    speckle(paint, random, 900, 1.6, 0.05)
    return canvas
  },
}

/**
 * How many times a pattern repeats across one ston.
 *
 * This is the number that decides whether a World looks right. A pattern
 * stretched to fit a part says how big the part is instead of what it is made
 * of, and a wall of four bricks beside a wall of four hundred is what makes a
 * World look wrong without anybody being able to say why.
 */
export const TILES_PER_STON: Record<Material, number> = {
  /*
   * Halved twice on the way out, and put back where they were on the way
   * in: at a quarter of these numbers a brick was the size of a door and
   * a cobble was a boulder. Grass is the exception and stays where the
   * halving left it, because a lawn is the one surface that wants to be
   * big enough to read as ground rather than as a pattern.
   */
  brick: 0.2,
  cobble: 0.18,
  wood: 0.14,
  planks: 0.112,
  metal: 0.14,
  plate: 0.18,
  grass: 0.05,
  sand: 0.14,
  pebble: 0.2,
  slate: 0.12,
  marble: 0.112,
  concrete: 0.14,
  plastic: 0.12,
  /** Nothing on it, so nothing to repeat. */
  smooth: 0,
  /*
   * A quarter of a tile per ston, and the picture holds four across, which
   * puts exactly one ston on every ston. That is the whole point of the
   * material: a part's size can be counted by looking at it.
   */
  stons: 0.25,
  glass: 0,
  neon: 0,
}

const loaded = new Map<Material, THREE.Texture | null>()
const pictures = new THREE.TextureLoader()

/** Everything a pattern needs whether it was drawn or fetched. */
function dress(texture: THREE.Texture) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * How far the surface stands out of the face, per material.
 *
 * The normal map says which way the surface points; this says how much to
 * believe it. A stud stands proud of a part and a polished slab barely
 * does, and the difference between them is what stops every material
 * looking like the same lumpy rubber.
 */
const RELIEF: Partial<Record<Material, number>> = {
  stons: 1,
  cobble: 0.95,
  plate: 0.9,
  pebble: 0.85,
  brick: 0.8,
  planks: 0.7,
  grass: 0.6,
  slate: 0.55,
  sand: 0.5,
  wood: 0.4,
  marble: 0.25,
  concrete: 0.45,
  metal: 0.2,
}

const bumps = new Map<Material, THREE.Texture | null>()

/**
 * The bumps for a material: the same picture read as a height, worked out
 * ahead of time by tools/engine/bumps.py.
 *
 * This is the whole reason a brick wall looks like brick rather than like a
 * photograph of brick stuck to a flat face. Without it every surface in a
 * World catches light identically, which is what makes a blocky World look
 * like paper.
 */
export function bumpFor(material: Material): THREE.Texture | null {
  if (bumps.has(material)) return bumps.get(material) ?? null
  if (!PICTURED.includes(material) || !RELIEF[material]) {
    bumps.set(material, null)
    return null
  }
  const texture = dress(pictures.load(`${base}${material}-bump.webp`))
  // A normal map is directions, not colour, and must not be gamma corrected.
  texture.colorSpace = THREE.NoColorSpace
  bumps.set(material, texture)
  return texture
}

/** How much of the bump to believe, for whoever is building the material. */
export function reliefFor(material: Material) {
  return RELIEF[material] ?? 0
}

/**
 * The pattern for a material, made once and then handed out.
 *
 * A picture is returned before it has arrived: three.js hands back the
 * texture immediately and fills it in when the file lands, so a World is
 * standing while its surfaces are still loading rather than after.
 */
export function textureFor(material: Material): THREE.Texture | null {
  if (loaded.has(material)) return loaded.get(material) ?? null

  if (PICTURED.includes(material)) {
    const texture = dress(pictures.load(`${base}${material}.webp`))
    loaded.set(material, texture)
    return texture
  }

  const draw = patterns[material]
  if (!draw || typeof document === 'undefined') {
    loaded.set(material, null)
    return null
  }

  const texture = dress(new THREE.CanvasTexture(draw()))
  loaded.set(material, texture)
  return texture
}
