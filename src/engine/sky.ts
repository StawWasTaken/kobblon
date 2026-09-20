import * as THREE from 'three'
import type { WorldManifest } from './experience'

/**
 * What goes behind a World.
 *
 * Exported rather than kept inside the engine, because Creator's viewport
 * draws its own scene with its own camera and still has to show the same sky
 * somebody will see when they play. The alternative was fifteen lines of
 * cross cutting copied into the editor, which is how two skies start
 * disagreeing about which face is up.
 */

/** A World names a sky by Catalog id; whoever is running it decides what that means. */
export type ResolveAsset = (id: string) => Promise<string | null>

/**
 * Where each face sits in a horizontal cross.
 *
 * The familiar plus shape: four sides in a row, top above the second, bottom
 * below it, corners unused. Columns then rows, four across and three down.
 */
const FACES: [string, number, number][] = [
  ['px', 2, 1],
  ['nx', 0, 1],
  ['py', 1, 0],
  ['ny', 1, 2],
  ['pz', 1, 1],
  ['nz', 3, 1],
]

/** Loads a picture, and answers with nothing rather than throwing. */
function fetchImage(url: string) {
  return new Promise<HTMLImageElement | null>((done) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => done(image)
    image.onerror = () => done(null)
    image.src = url
  })
}

/** Cuts a cross into the six faces a cube texture wants. */
export function cutCross(image: HTMLImageElement | HTMLCanvasElement): THREE.CubeTexture {
  const across = Math.floor(image.width / 4)
  const down = Math.floor(image.height / 3)
  const face = Math.min(across, down)

  const sides = FACES.map(([, column, row]) => {
    const canvas = document.createElement('canvas')
    canvas.width = face
    canvas.height = face
    const paint = canvas.getContext('2d')
    paint?.drawImage(image, column * across, row * down, across, down, 0, 0, face, face)
    return canvas
  })

  const sky = new THREE.CubeTexture(sides)
  sky.needsUpdate = true
  sky.colorSpace = THREE.SRGBColorSpace
  return sky
}

/**
 * The background a World asks for: its sky if it names one, its colour if it
 * does not, and its colour again if the sky cannot be had. A World must never
 * fail to open because a picture would not load.
 */
export async function buildSky(
  manifest: WorldManifest,
  resolveAsset?: ResolveAsset,
): Promise<THREE.CubeTexture | THREE.Color> {
  const plain = new THREE.Color(manifest.sky?.colour ?? '#0f1016')

  const id = manifest.sky?.decal
  if (!id || !resolveAsset) return plain

  const url = await resolveAsset(id).catch(() => null)
  if (!url) return plain

  const image = await fetchImage(url)
  if (!image || !image.width || !image.height) return plain

  return cutCross(image)
}
