import * as THREE from 'three'
import type { Solid } from './controller'

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

export type WorldBlock = {
  /** A name a script can look it up by, later. */
  id?: string
  kind: 'box'
  at: Vec3
  size: Vec3
  /** Turn around Y, in degrees, because a person is going to type this. */
  turn?: number
  colour?: string
  /** False for decoration you can walk through. */
  solid?: boolean
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

export type WorldPart = WorldBlock | WorldGroup

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

    return {
      id: part.id ? String(part.id) : undefined,
      kind: 'box',
      at: vec(part.at, [0, 0, 0]),
      size: vec(part.size, [1, 1, 1]),
      turn: number(part.turn, 0),
      colour: typeof part.colour === 'string' ? part.colour : '#6c7080',
      solid: part.solid !== false,
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

  // One geometry, many meshes: a World of boxes should cost one buffer.
  const unit = new THREE.BoxGeometry(1, 1, 1)
  const materials = new Map<string, THREE.MeshStandardMaterial>()

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

    const colour = part.colour ?? '#6c7080'
    let material = materials.get(colour)
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85 })
      materials.set(colour, material)
    }

    const mesh = new THREE.Mesh(unit, material)
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

/** The old name, while anything still says it. */
export const buildExperience = buildWorld
