import * as THREE from 'three'
import type { Solid } from './controller'
import { isShape, tiledGeometry, type Shape } from './shapes'
import { isMaterial, materialFor, type Material } from './materials'
import { TILES_PER_STON } from './textures'

/**
 * What a World is.
 *
 * Content and data, executed by the engine. Not a program, not a bundle, and
 * not something that needs a new Launcher when it changes: an experience is a
 * manifest the runtime already knows how to read, which is the whole reason
 * the Launcher can stay still while experiences move.
 *
 * This is V1 and is meant to grow. Everything in it is declarative on
 * purpose, so that the same file can be written by Creator, checked on a
 * server, and read by a runtime that does not trust whoever wrote it.
 */

export type Vec3 = [number, number, number]

/** Which side of a part a picture goes on. */
export type Face = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'

export const FACES: Face[] = ['top', 'bottom', 'front', 'back', 'left', 'right']

export type WorldBlock = {
  /** A name a script can look it up by, later. */
  id?: string
  kind: 'box'
  /** What it is. A box when a World does not say. */
  shape?: Shape
  at: Vec3
  size: Vec3
  /** Turn around Y, in degrees, because a person is going to type this. */
  turn?: number
  colour?: string
  /** How the colour answers light. Plastic when a World does not say. */
  material?: Material
  /** 0 is solid, 1 is invisible. */
  transparency?: number
  /** 0 is flat, 1 is a mirror. */
  reflectance?: number
  /** False for decoration you can walk through. */
  solid?: boolean
  /**
   * What is on this part. Decals, today.
   *
   * A picture is a thing in its own right rather than a field, because that
   * is what it is: it has a face, it will have a colour and a transparency
   * and an offset, and somebody has to be able to see it in the tree, select
   * it, and delete it without deleting the wall. A field can hold one
   * picture and cannot be selected.
   */
  children?: WorldDecal[]
}

/**
 * A picture on one face of a part.
 *
 * Named by Catalog id, never by address, for the same reason the sky is: a
 * World that can name any host is a World that can make every player fetch
 * anything.
 */
export type WorldDecal = {
  id?: string
  kind: 'decal'
  /** The Catalog id of the picture. */
  picture: string
  face: Face
  /** 0 is solid, 1 is invisible. */
  transparency?: number
  /** Tints the picture. White leaves it alone. */
  colour?: string
}

/**
 * A thing made of things.
 *
 * A group has its own place and turn, and everything inside it is placed
 * relative to that. Move the group and the whole thing moves; save the group
 * and the whole thing saves. It is what an Explorer shows as one row and what
 * a creator exports as one file.
 *
 * Groups may contain groups. The depth is capped, because a file that nests
 * a thousand deep is a file that was written to break a reader.
 */
export type WorldGroup = {
  id?: string
  kind: 'group'
  at: Vec3
  turn?: number
  parts: WorldPart[]
}

export type WorldPart = WorldBlock | WorldGroup | WorldDecal

/** The old name, while anything still says it. */
export type ExperienceBlock = WorldBlock

export type WorldManifest = {
  /** The format this file was written for, so an old file can be recognised. */
  format: 1
  id: string
  name: string
  by?: string
  /** Where K6 arrives, in stons. */
  spawn: { at: Vec3; facing?: number }
  sky?: {
    colour?: string
    fog?: number
    /**
     * A Catalog id for a sky, resolved by whoever is running this. The
     * manifest never holds an address: a file that can name any host is a
     * file that can point every player at anything.
     */
    decal?: string
  }
  light?: { sun?: number; ambient?: number; from?: Vec3 }
  blocks: WorldPart[]
}

/** The old name, while anything still says it. */
export type ExperienceManifest = WorldManifest

/** Nothing here trusts the file: a manifest is user content like any other. */
export function readManifest(raw: unknown): WorldManifest {
  const data = raw as Partial<WorldManifest>
  if (!data || typeof data !== 'object') throw new Error('That World is not readable.')
  if (data.format !== 1) throw new Error('That World was made for another version of Kobblon.')
  if (!Array.isArray(data.blocks)) throw new Error('That World has nothing in it.')

  const vec = (value: unknown, fallback: Vec3): Vec3 => (
    Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n))
      ? [value[0], value[1], value[2]] as Vec3
      : fallback
  )

  const number = (value: unknown, fallback: number) =>
    (Number.isFinite(value) ? Number(value) : fallback)

  /** Everything in a manifest is somebody else's writing, so nothing is believed. */
  let counted = 0
  const MOST = 20000
  const DEEP = 8

  const readPart = (part: any, depth: number): WorldPart | null => {
    if (!part || typeof part !== 'object') return null
    counted += 1
    if (counted > MOST) throw new Error('That World is too big to open.')

    if (part.kind === 'group') {
      if (depth >= DEEP) return null
      const parts = Array.isArray(part.parts)
        ? part.parts.map((one: unknown) => readPart(one, depth + 1)).filter(Boolean) as WorldPart[]
        : []
      return {
        id: part.id ? String(part.id) : undefined,
        kind: 'group',
        at: vec(part.at, [0, 0, 0]),
        turn: number(part.turn, 0),
        parts,
      }
    }

    const held = (value: unknown) => THREE.MathUtils.clamp(number(value, 0), 0, 1)

    /*
     * A decal used to be a field on the part. Files written that way still
     * open: it is read as the one child it always meant.
     */
    const asChild = (raw: any): WorldDecal | null => {
      if (!raw || typeof raw !== 'object') return null
      const picture = typeof raw.picture === 'string' ? raw.picture
        : typeof raw.id === 'string' ? raw.id
        : null
      if (!picture || !/^[A-Za-z0-9_-]{1,64}$/.test(picture)) return null
      if (!FACES.includes(raw.face)) return null
      return {
        // An old file's `id` was the picture, not a name for the decal.
        id: typeof raw.picture === 'string' && raw.id ? String(raw.id) : undefined,
        kind: 'decal',
        picture,
        face: raw.face as Face,
        transparency: THREE.MathUtils.clamp(number(raw.transparency, 0), 0, 1),
        colour: typeof raw.colour === 'string' ? raw.colour : '#ffffff',
      }
    }

    const children = [
      ...(Array.isArray(part.children) ? part.children : []),
      ...(part.decal ? [part.decal] : []),
    ]
      .map(asChild)
      .filter(Boolean)
      .slice(0, 12) as WorldDecal[]

    return {
      id: part.id ? String(part.id) : undefined,
      kind: 'box',
      shape: isShape(part.shape) ? part.shape : 'box',
      at: vec(part.at, [0, 0, 0]),
      size: vec(part.size, [1, 1, 1]),
      turn: number(part.turn, 0),
      colour: typeof part.colour === 'string' ? part.colour : '#6c7080',
      material: isMaterial(part.material) ? part.material : 'plastic',
      transparency: held(part.transparency),
      reflectance: held(part.reflectance),
      solid: part.solid !== false,
      children,
    }
  }

  return {
    format: 1,
    id: String(data.id ?? 'untitled'),
    name: String(data.name ?? 'Untitled'),
    by: data.by ? String(data.by) : undefined,
    spawn: {
      at: vec(data.spawn?.at, [0, 4, 0]),
      facing: number(data.spawn?.facing, 0),
    },
    sky: {
      colour: typeof data.sky?.colour === 'string' ? data.sky.colour : undefined,
      fog: Number.isFinite(data.sky?.fog) ? Number(data.sky?.fog) : undefined,
      // An id, never an address. The runtime resolves it.
      decal: typeof data.sky?.decal === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(data.sky.decal)
        ? data.sky.decal
        : undefined,
    },
    light: data.light ?? {},
    blocks: data.blocks.map((one) => readPart(one, 0)).filter(Boolean) as WorldPart[],
  }
}

export type BuiltWorld = {
  manifest: WorldManifest
  group: THREE.Group
  solids: Solid[]
  /** Parts that were given an id, for scripts and for Creator to select. */
  named: Map<string, THREE.Object3D>
  /**
   * Which part each object came from.
   *
   * An editor raycasts the scene and gets a mesh back; this says what it is.
   * Counting on the order of `group.children` matching the manifest happens
   * to work today and is not something the engine promises.
   */
  partOf: Map<THREE.Object3D, WorldPart>
}

/** The old name, while anything still says it. */
export type BuiltExperience = BuiltWorld

/** Turns a manifest into something in a scene. */
export function buildWorld(manifest: WorldManifest): BuiltWorld {
  const root = new THREE.Group()
  root.name = manifest.name
  const solids: Solid[] = []
  const named = new Map<string, THREE.Object3D>()
  const partOf = new Map<THREE.Object3D, WorldPart>()

  /*
   * One geometry per shape and one material per combination, shared by every
   * part that wants them. A World of ten thousand bricks holds one brick.
   */
  const materials = new Map<string, THREE.Material>()

  const place = (part: WorldPart, into: THREE.Object3D) => {
    if (part.kind === 'group') {
      const group = new THREE.Group()
      group.position.set(...part.at)
      if (part.turn) group.rotation.y = (part.turn * Math.PI) / 180
      into.add(group)
      partOf.set(group, part)
      if (part.id) named.set(part.id, group)
      for (const inside of part.parts) place(inside, group)
      return
    }

    /*
     * A decal has no body of its own: it is a picture on the part it belongs
     * to, put there by applyDecals once it has been fetched. It is in the
     * tree so an editor can select it; it is not in the scene on its own.
     */
    if (part.kind === 'decal') return

    const material = materialFor({
      colour: part.colour ?? '#6c7080',
      material: part.material ?? 'plastic',
      transparency: part.transparency ?? 0,
      reflectance: part.reflectance ?? 0,
    }, materials)

    const shape = part.shape ?? 'box'
    const mesh = new THREE.Mesh(
      tiledGeometry(shape, part.size, TILES_PER_STON[part.material ?? 'plastic'] ?? 0),
      material,
    )
    mesh.position.set(...part.at)
    mesh.scale.set(...part.size)
    if (part.turn) mesh.rotation.y = (part.turn * Math.PI) / 180
    mesh.castShadow = true
    mesh.receiveShadow = true
    into.add(mesh)

    partOf.set(mesh, part)
    if (part.id) named.set(part.id, mesh)

    if (part.solid) {
      // A group's transform is in here too, which is why this waits until
      // the mesh is in the scene rather than reading the numbers.
      mesh.updateWorldMatrix(true, false)
      solids.push({ box: new THREE.Box3().setFromObject(mesh) })
    }
  }

  for (const part of manifest.blocks) place(part, root)

  return { manifest, group: root, solids, named, partOf }
}

/**
 * Puts the pictures on.
 *
 * A separate pass because a decal has to be fetched and building a World does
 * not wait for the network: a World appears, then its pictures arrive. An
 * editor calls this too, with its own resolver, so a decal shows before it
 * has been published.
 */
export async function applyDecals(
  built: BuiltWorld,
  resolveAsset?: (id: string) => Promise<string | null>,
) {
  if (!resolveAsset) return

  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')

  /** Three's box faces are +x, -x, +y, -y, +z, -z, in that order. */
  const SIDE: Record<Face, number> = {
    right: 0, left: 1, top: 2, bottom: 3, front: 4, back: 5,
  }

  const jobs: Promise<void>[] = []

  for (const [object, part] of built.partOf) {
    if (part.kind !== 'box' || !part.children?.length) continue
    const mesh = object as THREE.Mesh
    const plain = mesh.material as THREE.Material
    const shape = part.shape ?? 'box'

    /*
     * A box has six faces to address, so its materials become an array and
     * each decal replaces the one it names. Anything else has a single
     * surface, so the last decal wraps it, which is what somebody means by
     * putting a picture on a sphere.
     */
    const faces: THREE.Material[] = shape === 'box'
      ? Array.from({ length: 6 }, () => plain)
      : [plain]

    let painted = false

    jobs.push((async () => {
      for (const decal of part.children ?? []) {
        const url = await resolveAsset(decal.picture).catch(() => null)
        if (!url) continue

        const picture = await loader.loadAsync(url).catch(() => null)
        if (!picture) continue
        picture.colorSpace = THREE.SRGBColorSpace

        const faced = (plain as THREE.MeshStandardMaterial).clone()
        faced.map = picture
        if (decal.colour && decal.colour !== '#ffffff') faced.color.set(decal.colour)
        if (decal.transparency) {
          faced.transparent = true
          faced.opacity = 1 - decal.transparency
        }
        faced.needsUpdate = true

        faces[shape === 'box' ? SIDE[decal.face] : 0] = faced
        painted = true
      }

      if (painted) mesh.material = shape === 'box' ? faces : faces[0]
    })())
  }

  await Promise.all(jobs)
}

/** The old name, while anything still says it. */
export const buildExperience = buildWorld
