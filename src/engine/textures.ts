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
 *   recognises: grass, studs, brick, wood, planks. Drawing convincing grass
 *   on a canvas is a losing game, and these were made for Kobblon rather
 *   than taken from a texture site, so there is no licence to honour.
 * - **Drawn on a canvas**, for the rest. Metal, sand, concrete and plastic
 *   are a noise and a direction, they cost nothing to download and there is
 *   no seam to get wrong.
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
}

export const PICTURED: Material[] = ['grass', 'studs', 'brick', 'wood', 'planks']

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
  metal() {
    const { canvas, paint } = sheet()
    const random = seeded(13)
    paint.fillStyle = grey(0.92)
    paint.fillRect(0, 0, SIZE, SIZE)

    // Brushed, so the highlight travels along the grain.
    for (let i = 0; i < 400; i += 1) {
      const y = random() * SIZE
      paint.strokeStyle = grey(0.82 + random() * 0.18, 0.35)
      paint.lineWidth = 0.5 + random()
      paint.beginPath()
      paint.moveTo(0, y)
      paint.lineTo(SIZE, y)
      paint.stroke()
    }
    return canvas
  },

  sand() {
    const { canvas, paint } = sheet()
    const random = seeded(19)
    paint.fillStyle = grey(0.95)
    paint.fillRect(0, 0, SIZE, SIZE)
    speckle(paint, random, 3000, 1.1, 0.35)

    // Ripples, faint, the way wind leaves it.
    for (let i = 0; i < 14; i += 1) {
      const y = (i / 14) * SIZE
      paint.strokeStyle = grey(0.86, 0.35)
      paint.lineWidth = 2 + random() * 2
      paint.beginPath()
      paint.moveTo(0, y)
      for (let x = 0; x <= SIZE; x += 16) {
        paint.lineTo(x, y + Math.sin((x / SIZE) * Math.PI * 4 + i) * 3)
      }
      paint.stroke()
    }
    return canvas
  },

  concrete() {
    const { canvas, paint } = sheet()
    const random = seeded(23)
    paint.fillStyle = grey(0.93)
    paint.fillRect(0, 0, SIZE, SIZE)
    speckle(paint, random, 220, 9, 0.16)
    speckle(paint, random, 1400, 1.4, 0.3)
    return canvas
  },

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
  brick: 0.18,
  wood: 0.12,
  planks: 0.08,
  metal: 0.12,
  grass: 0.18,
  sand: 0.22,
  concrete: 0.14,
  plastic: 0.1,
  /*
   * A quarter of a tile per ston, and the picture holds four studs across,
   * which puts exactly one stud on every ston. That is the whole point of
   * the material: a part's size can be counted by looking at it.
   */
  studs: 0.25,
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
