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

/** Cuts a cross into the six faces, in the order a cube wants them. */
export function cutCross(image: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement[] {
  const across = Math.floor(image.width / 4)
  const down = Math.floor(image.height / 3)
  const face = Math.min(across, down)

  return FACES.map(([, column, row]) => {
    const canvas = document.createElement('canvas')
    canvas.width = face
    canvas.height = face
    const paint = canvas.getContext('2d')
    paint?.drawImage(image, column * across, row * down, across, down, 0, 0, face, face)
    return canvas
  })
}

/** How far the sky sits below the eye, as a share of its own size. */
const DROP = 0.22

/** How big the box is. Inside the camera's far plane, outside any World. */
const SPAN = 3000

/**
 * The sky, as something in the scene rather than as a background.
 *
 * A background cube is centred on the camera, which puts the horizon exactly
 * at eye level wherever you stand. A box you can place is not: sitting it
 * below the eye drops the horizon and shows more sky above, which is what
 * standing outdoors actually looks like.
 */
export class Skybox {
  readonly object: THREE.Mesh

  constructor(faces: HTMLCanvasElement[]) {
    const materials = faces.map((face) => {
      const texture = new THREE.CanvasTexture(face)
      texture.colorSpace = THREE.SRGBColorSpace
      return new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        // It is behind everything and it is not lit by anything.
        depthWrite: false,
        fog: false,
      })
    })

    this.object = new THREE.Mesh(new THREE.BoxGeometry(SPAN, SPAN, SPAN), materials)
    /*
     * Not "Sky": a creator is allowed to call their World that, and then
     * looking the sky up by name finds their World instead. This name cannot
     * be typed into Creator.
     */
    this.object.name = 'kobblon:sky'
    this.object.renderOrder = -1
    this.object.frustumCulled = false
  }

  /** Keeps the sky around whoever is looking, and below their eye. */
  follow(camera: THREE.Camera) {
    this.object.position.set(
      camera.position.x,
      camera.position.y - SPAN * DROP,
      camera.position.z,
    )
  }

  dispose() {
    this.object.removeFromParent()
    this.object.geometry.dispose()
    for (const material of this.object.material as THREE.Material[]) material.dispose()
  }
}

export type Sky = {
  /** What to paint behind everything when there is no picture. */
  colour: THREE.Color
  /** The sky itself, to add to a scene. Null when the World names none. */
  box: Skybox | null
  /**
   * Something for `scene.environment`, so that metal has something to
   * reflect: the sky's picture as a cube when it has one, and six faces
   * built from its colour when it does not.
   */
  environment: THREE.CubeTexture | null
}

/**
 * Something for metal to reflect when a World names no sky.
 *
 * A metal with nothing around it renders black, and most Worlds set a
 * colour rather than a picture, so most Worlds had black metal. Six small
 * faces built from that colour, the top lighter and the bottom darker, are
 * enough: metal picks up a sky above and a ground below and reads as metal.
 * It is not a reflection of the World, and it is not pretending to be.
 *
 * Sixty four square, and that size is not arbitrary. Eight square renders
 * as no environment at all: the faces upload, the cube is on the scene, and
 * nothing reflects. Measured rather than reasoned about.
 */
function skyFromColour(colour: THREE.Color): THREE.CubeTexture | null {
  if (typeof document === 'undefined') return null

  const SIDE = 64

  const face = (shade: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = SIDE
    canvas.height = SIDE
    const paint = canvas.getContext('2d')
    if (!paint) return canvas
    const tinted = colour.clone()
    // Towards white above, towards black below, around the colour itself.
    tinted.lerp(new THREE.Color(shade > 0 ? 0xffffff : 0x000000), Math.abs(shade))
    paint.fillStyle = `#${tinted.getHexString()}`
    paint.fillRect(0, 0, SIDE, SIDE)
    return canvas
  }

  // The order three.js wants: +x, -x, +y, -y, +z, -z.
  const sides = [face(0), face(0), face(0.45), face(-0.55), face(0), face(0)]
  const cube = new THREE.CubeTexture(sides as unknown as HTMLImageElement[])
  cube.needsUpdate = true
  cube.colorSpace = THREE.SRGBColorSpace
  return cube
}

/**
 * The sky a World asks for: its picture if it names one, its colour if it
 * does not, and its colour again if the picture cannot be had. A World must
 * never fail to open because a background would not load.
 */
export async function buildSky(
  manifest: WorldManifest,
  resolveAsset?: ResolveAsset,
): Promise<Sky> {
  const colour = new THREE.Color(manifest.sky?.colour ?? '#0f1016')
  const plain: Sky = { colour, box: null, environment: skyFromColour(colour) }

  const id = manifest.sky?.decal
  if (!id || !resolveAsset) return plain

  const url = await resolveAsset(id).catch(() => null)
  if (!url) return plain

  const image = await fetchImage(url)
  if (!image || !image.width || !image.height) return plain

  const faces = cutCross(image)

  const environment = new THREE.CubeTexture(faces)
  environment.needsUpdate = true
  environment.colorSpace = THREE.SRGBColorSpace

  return { colour, box: new Skybox(faces), environment }
}
