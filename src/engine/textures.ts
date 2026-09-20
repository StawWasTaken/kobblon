import * as THREE from 'three'
import type { Material } from './materials'

/**
 * What a material looks like, drawn rather than downloaded.
 *
 * Nine materials that differ only in how shiny they are are nine coloured
 * boxes with different highlights. A material reads as itself because of the
 * pattern on it: brick is brick because you can see the courses.
 *
 * Every pattern here is drawn on a canvas at load, greyscale, tiling by
 * construction, and multiplied against the colour the creator chose. That
 * buys three things a texture pack does not: nothing to download, no seam to
 * get wrong, and no licence to honour. The last one matters, because Kobblon
 * redistributes every file it ships and most free texture sites permit use
 * but not redistribution.
 */

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
  brick() {
    const { canvas, paint } = sheet()
    const random = seeded(7)
    const rows = 8
    const high = SIZE / rows
    const wide = SIZE / 4
    const mortar = 3

    paint.fillStyle = grey(0.72) // the mortar behind everything
    paint.fillRect(0, 0, SIZE, SIZE)

    for (let row = 0; row < rows; row += 1) {
      // Every other course is offset by half a brick, which is what makes a
      // wall read as a wall rather than as a grid.
      const shift = row % 2 === 0 ? 0 : wide / 2
      for (let column = -1; column <= 4; column += 1) {
        const x = column * wide + shift
        paint.fillStyle = grey(0.93 - random() * 0.16)
        paint.fillRect(x + mortar / 2, row * high + mortar / 2, wide - mortar, high - mortar)
      }
    }
    return canvas
  },

  wood() {
    const { canvas, paint } = sheet()
    const random = seeded(11)
    paint.fillStyle = grey(0.95)
    paint.fillRect(0, 0, SIZE, SIZE)

    // Grain: long wavering lines down the board.
    for (let i = 0; i < 90; i += 1) {
      const x = random() * SIZE
      paint.strokeStyle = grey(0.78 - random() * 0.22, 0.5)
      paint.lineWidth = 0.6 + random() * 1.8
      paint.beginPath()
      paint.moveTo(x, 0)
      for (let y = 0; y <= SIZE; y += 16) {
        paint.lineTo(x + Math.sin((y / SIZE) * Math.PI * 2 + i) * 3, y)
      }
      paint.stroke()
    }

    // The joins between boards, which is what says it is planks.
    for (const x of [0, SIZE / 2]) {
      paint.strokeStyle = grey(0.55, 0.8)
      paint.lineWidth = 2
      paint.beginPath()
      paint.moveTo(x, 0)
      paint.lineTo(x, SIZE)
      paint.stroke()
    }
    return canvas
  },

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

  grass() {
    const { canvas, paint } = sheet()
    const random = seeded(17)
    paint.fillStyle = grey(0.86)
    paint.fillRect(0, 0, SIZE, SIZE)

    // Blades, short and every which way.
    for (let i = 0; i < 1600; i += 1) {
      const x = random() * SIZE
      const y = random() * SIZE
      const length = 3 + random() * 6
      const lean = (random() - 0.5) * 4
      paint.strokeStyle = grey(0.6 + random() * 0.45, 0.6)
      paint.lineWidth = 1
      paint.beginPath()
      paint.moveTo(x, y)
      paint.lineTo(x + lean, y - length)
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
  brick: 0.25,
  wood: 0.18,
  metal: 0.12,
  grass: 0.3,
  sand: 0.22,
  concrete: 0.14,
  plastic: 0.1,
  glass: 0,
  neon: 0,
}

const drawn = new Map<Material, THREE.CanvasTexture | null>()

/** The pattern for a material, drawn once and then handed out. */
export function textureFor(material: Material): THREE.CanvasTexture | null {
  if (drawn.has(material)) return drawn.get(material) ?? null

  const draw = patterns[material]
  if (!draw || typeof document === 'undefined') {
    drawn.set(material, null)
    return null
  }

  const texture = new THREE.CanvasTexture(draw())
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  drawn.set(material, texture)
  return texture
}
