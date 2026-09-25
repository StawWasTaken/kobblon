import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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
   * Whether this part is held in place.
   *
   * **Nothing acts on this yet.** There is no part physics, so every part
   * is anchored whatever this says. It is read and kept so that a World
   * that means it does not lose it, and so that the day physics arrives
   * nobody has to go back through their Worlds saying it again. Anything
   * showing this to a person should say as much rather than implying a
   * part will fall.
   */
  anchored?: boolean
  /**
   * Anything in the file this engine has not learned, carried rather than
   * understood. See `keepUnknown`: it exists so that opening and saving a
   * World in an application built against an older engine does not quietly
   * delete what a newer one wrote.
   */
  more?: Record<string, unknown>
  /**
   * A model from the Catalog, by content id, such as `MDL-1042`.
   *
   * A field rather than a kind of its own, so that everything already
   * written keeps working on it with no special case: it is placed, sized,
   * turned, coloured, made solid and carries decals exactly like any other
   * part, and `size` scales the loaded geometry to fill that box. A part
   * that names a model nobody can fetch is still a part — it is drawn as
   * its shape, which is the honest answer and not an empty space where
   * somebody's building used to be.
   *
   * Resolved through `resolveAsset` like every other piece of content. A
   * World never names an address.
   */
  mesh?: string
  /**
   * What is on this part. Decals, today.
   *
   * A picture is a thing in its own right rather than a field, because that
   * is what it is: it has a face, it will have a colour and a transparency
   * and an offset, and somebody has to be able to see it in the tree, select
   * it, and delete it without deleting the wall. A field can hold one
   * picture and cannot be selected.
   */
  children?: (WorldDecal | WorldSound | WorldLight)[]
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
  /**
   * How big the picture is on the face, as a multiple of the face itself.
   *
   * A decal covers the face it is on, whatever shape either of them is: a
   * picture on a wall forty stons by eight is forty stons by eight. One is
   * the whole face, two is twice that and hangs over the edges, `[2, 1]` is
   * wider than the wall and the right height.
   */
  scale?: [number, number]
  /** Where it sits on the face, in face widths. 0 is the middle. */
  offset?: [number, number]
  /** Anything this engine has not learned, carried rather than understood. */
  more?: Record<string, unknown>
  /**
   * How many times the picture repeats across the face, and up it.
   *
   * This is the whole of the difference between a Decal and a Texture:
   * absent means once, which is a decal, and present means the picture
   * tiles. A Texture is a decal that repeats — one node, one field, rather
   * than a second kind that would have to learn everything a decal already
   * knows about faces, offsets, tints and transparency.
   *
   * It is a count rather than a size on purpose: `[4, 2]` is four across
   * and two up whatever the part is scaled to, so a wall that is stretched
   * gets bigger bricks rather than more of them. A World that wants the
   * other behaviour multiplies by the part's size itself, where it knows
   * what it meant.
   */
  repeat?: [number, number]
}

/**
 * A sound.
 *
 * As a child of a part it comes from that part and fades with distance. In a
 * World's own list it is everywhere at once, which is what ambience is.
 */
export type WorldSound = {
  id?: string
  kind: 'sound'
  /** The Catalog id, such as SND-1064. */
  sound: string
  /** 0 is silent, 1 is as recorded. */
  volume?: number
  loop?: boolean
  /**
   * Whether it should be playing once it has loaded.
   *
   * Loaded and playing are deliberately two things. A World fetches what it
   * needs when it opens; what is audible at a given moment is a separate
   * question, and it is the one a script will answer later. Bolting that
   * split on afterwards means every sound in every World is already wrong.
   */
  playing?: boolean
  /** How far away it can still be heard, in stons. Positional sounds only. */
  reach?: number
  /** Anything this engine has not learned, carried rather than understood. */
  more?: Record<string, unknown>
}

/**
 * A light.
 *
 * One kind with a `light` on it rather than three kinds, because a person
 * setting one up is changing what a light *is*, not deleting one thing and
 * inserting another. Properties shows the fields the chosen sort uses and
 * leaves the rest alone.
 *
 * A light belongs to a part the way a sound does: it sits where the part is,
 * turns when the part turns, and goes when the part goes. In a World's own
 * list it is the World's light rather than anybody's.
 */
export type WorldLight = {
  id?: string
  kind: 'light'
  /**
   * `point` throws light in every direction. `spot` throws a cone the way
   * `turn` is pointing. `surface` is the face of the part it is on, glowing
   * — a panel or a strip rather than a bulb.
   */
  light: 'point' | 'spot' | 'surface'
  colour?: string
  /** How hard it burns. 1 is a lamp; 0 is off without being off. */
  brightness?: number
  /** How far it carries, in stons. */
  range?: number
  /** The width of a spot's cone, in degrees. Ignored by the others. */
  angle?: number
  /** Which way a spot or a surface faces. */
  turn?: Vec3
  /** Which face a surface sits on. */
  face?: Face
  /**
   * Off is off. A light that is off still exists, still has its colour and
   * its place, and costs nothing until a script turns it on.
   */
  on?: boolean
  /** Anything this engine has not learned, carried rather than understood. */
  more?: Record<string, unknown>
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
  /** Anything this engine has not learned, carried rather than understood. */
  more?: Record<string, unknown>
  at: Vec3
  turn?: number
  parts: WorldPart[]
}

export type WorldPart = WorldBlock | WorldGroup | WorldDecal | WorldSound | WorldLight

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
  /**
   * How far a player may pull the camera back.
   *
   * A World decides how much of itself is seen at once: a corridor is not a
   * hillside. The near end is the engine's, because it is where the camera
   * enters somebody's head and that is not a creative decision.
   */
  camera?: { zoom?: { most?: number } }
  /** Sounds that are not anywhere in particular. Ambience. */
  sounds?: WorldSound[]
  blocks: WorldPart[]
  /**
   * Parts that move as one thing.
   *
   * Each group is a list of part ids. A weld is the one thing here that is
   * not a field on a part, because it is a relationship between two of them
   * rather than a property of either.
   *
   * **Nothing acts on this yet**, and it is written down rather than acted
   * on deliberately: there is no part physics in the engine at all, so an
   * unanchored part does not fall and a welded pair has nothing to fall
   * together with. The shape is agreed now so that Worlds saved today still
   * mean what they said when physics lands, rather than the field being
   * designed twice and the first set of files being wrong.
   */
  welds?: string[][]
  /** Anything this engine has not learned, carried rather than understood. */
  more?: Record<string, unknown>
}

/** The old name, while anything still says it. */
export type ExperienceManifest = WorldManifest

/** What a Catalog id is allowed to look like. Never an address. */
const NAMED = /^[A-Za-z0-9_-]{1,64}$/

/** A sound out of a file, believing none of it. */
function readSound(raw: any): WorldSound | null {
  if (!raw || typeof raw !== 'object') return null
  const sound = typeof raw.sound === 'string' ? raw.sound : null
  if (!sound || !NAMED.test(sound)) return null
  const number = (value: unknown, fallback: number) =>
    (Number.isFinite(value) ? Number(value) : fallback)
  return {
    id: raw.id ? String(raw.id) : undefined,
    kind: 'sound',
    sound,
    volume: THREE.MathUtils.clamp(number(raw.volume, 1), 0, 1),
    loop: raw.loop === true,
    // Silent until something says otherwise: a World that opens shouting is
    // a World nobody keeps open.
    playing: raw.playing === true,
    reach: THREE.MathUtils.clamp(number(raw.reach, 40), 1, 4000),
    more: keepUnknown(raw, ['id', 'kind', 'sound', 'volume', 'loop', 'playing', 'reach']),
  }
}

/**
 * How many real lights a World may have burning at once.
 *
 * Every one of them costs every material that might be lit by it, so this
 * is not a taste limit, it is the difference between a World that runs and
 * one that does not. Said out loud here so the Workspace can show it and
 * refuse the two hundred and first rather than shipping a World that
 * crawls on somebody else's machine.
 */
export const MOST_LIGHTS = 32

/** A light out of a file, believing none of it. */
function readLight(raw: any): WorldLight | null {
  if (!raw || typeof raw !== 'object') return null
  const sorts = ['point', 'spot', 'surface']
  const light = sorts.includes(raw.light) ? raw.light as WorldLight['light'] : 'point'
  const number = (value: unknown, fallback: number) =>
    (Number.isFinite(value) ? Number(value) : fallback)
  const turn = Array.isArray(raw.turn) && raw.turn.length === 3
    && raw.turn.every((one: unknown) => Number.isFinite(one))
    ? [raw.turn[0], raw.turn[1], raw.turn[2]] as Vec3
    : undefined
  return {
    id: raw.id ? String(raw.id) : undefined,
    kind: 'light',
    light,
    colour: typeof raw.colour === 'string' ? raw.colour : '#ffffff',
    brightness: THREE.MathUtils.clamp(number(raw.brightness, 1), 0, 20),
    range: THREE.MathUtils.clamp(number(raw.range, 40), 0.1, 2000),
    angle: THREE.MathUtils.clamp(number(raw.angle, 45), 1, 89),
    turn,
    face: FACES.includes(raw.face) ? raw.face as Face : 'front',
    // On unless the file says otherwise: somebody who adds a light wants a
    // light.
    on: raw.on !== false,
    more: keepUnknown(raw, [
      'id', 'kind', 'light', 'colour', 'brightness', 'range', 'angle', 'turn',
      'face', 'on',
    ]),
  }
}

/**
 * Whatever a file said that this reader has not learned.
 *
 * The reader rebuilds a manifest out of the fields it knows, which means a
 * field it does not know is gone the moment a World is opened and saved. For
 * an application that opens and saves Worlds all day that is not a missing
 * feature, it is silent data loss: somebody's work disappears and nothing
 * says so.
 *
 * So anything unrecognised is kept to one side and handed back. It is never
 * read, never executed, never given to three.js — it is carried. The caps
 * are because this is user content like everything else here: a file cannot
 * make the reader hold a megabyte of nonsense per part.
 *
 * Values are copied rather than referenced, so nothing downstream can reach
 * back into the file's own objects.
 */
const MOST_UNKNOWN_KEYS = 32
const DEEPEST_UNKNOWN = 6

function keepUnknown(raw: any, known: string[]): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const copy = (value: unknown, depth: number): unknown => {
    if (depth > DEEPEST_UNKNOWN) return undefined
    if (value === null) return null
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      // A string long enough to be a payload is not a property.
      return typeof value === 'string' && value.length > 4096 ? undefined : value
    }
    if (Array.isArray(value)) {
      return value.slice(0, 256).map((one) => copy(one, depth + 1)).filter((one) => one !== undefined)
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {}
      let count = 0
      for (const [key, one] of Object.entries(value as object)) {
        if (count >= MOST_UNKNOWN_KEYS) break
        // Nothing that could reach a prototype travels.
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
        const kept = copy(one, depth + 1)
        if (kept === undefined) continue
        out[key] = kept
        count += 1
      }
      return out
    }
    // Functions, symbols and anything else a parser cannot have produced.
    return undefined
  }

  const out: Record<string, unknown> = {}
  let count = 0
  for (const [key, value] of Object.entries(raw)) {
    if (known.includes(key)) continue
    if (count >= MOST_UNKNOWN_KEYS) break
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    const kept = copy(value, 0)
    if (kept === undefined) continue
    out[key] = kept
    count += 1
  }

  return Object.keys(out).length ? out : undefined
}

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

    if (part.kind === 'sound') return readSound(part)
    if (part.kind === 'light') return readLight(part)

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
        more: keepUnknown(part, ['id', 'kind', 'at', 'turn', 'parts']),
      }
    }

    const held = (value: unknown) => THREE.MathUtils.clamp(number(value, 0), 0, 1)

    /** Two numbers, or nothing, which is not the same as two zeroes. */
    const pair = (value: unknown, least: number, most: number): [number, number] | undefined => {
      if (!Array.isArray(value) || value.length !== 2) return undefined
      if (!value.every((one) => Number.isFinite(one))) return undefined
      return [
        THREE.MathUtils.clamp(Number(value[0]), least, most),
        THREE.MathUtils.clamp(Number(value[1]), least, most),
      ]
    }

    /*
     * A decal used to be a field on the part. Files written that way still
     * open: it is read as the one child it always meant.
     */
    const asChild = (raw: any): WorldDecal | WorldSound | WorldLight | null => {
      if (!raw || typeof raw !== 'object') return null
      if (raw.kind === 'sound') return readSound(raw)
      if (raw.kind === 'light') return readLight(raw)

      const picture = typeof raw.picture === 'string' ? raw.picture
        : typeof raw.id === 'string' ? raw.id
        : null
      if (!picture || !NAMED.test(picture)) return null
      if (!FACES.includes(raw.face)) return null
      return {
        // An old file's `id` was the picture, not a name for the decal.
        id: typeof raw.picture === 'string' && raw.id ? String(raw.id) : undefined,
        kind: 'decal',
        picture,
        face: raw.face as Face,
        transparency: THREE.MathUtils.clamp(number(raw.transparency, 0), 0, 1),
        colour: typeof raw.colour === 'string' ? raw.colour : '#ffffff',
        scale: pair(raw.scale, 0.01, 20),
        offset: pair(raw.offset, -10, 10),
        /*
         * Capped at 512 across and up. A tile count is a number a person
         * types, and a thousand of them across a wall is a moire pattern
         * and a graphics card doing nothing useful.
         */
        repeat: pair(raw.repeat, 0.01, 512),
        more: keepUnknown(raw, [
          'id', 'kind', 'picture', 'face', 'transparency', 'colour', 'scale',
          'offset', 'repeat',
        ]),
      }
    }

    const children = [
      ...(Array.isArray(part.children) ? part.children : []),
      ...(part.decal ? [part.decal] : []),
    ]
      .map(asChild)
      .filter(Boolean)
      .slice(0, 12) as (WorldDecal | WorldSound | WorldLight)[]

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
      // A Catalog id, never an address. Same rule as a decal, a sound and
      // the sky.
      mesh: typeof part.mesh === 'string' && NAMED.test(part.mesh) ? part.mesh : undefined,
      // Kept, not acted on. See the field.
      anchored: part.anchored === undefined ? undefined : part.anchored !== false,
      children,
      more: keepUnknown(part, [
        'id', 'kind', 'shape', 'at', 'size', 'turn', 'colour', 'material',
        'transparency', 'reflectance', 'solid', 'mesh', 'anchored', 'children',
        'decal',
      ]),
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
    camera: {
      zoom: {
        // A World may pull the camera further back, never further in.
        most: Number.isFinite(data.camera?.zoom?.most)
          ? THREE.MathUtils.clamp(Number(data.camera?.zoom?.most), ZOOM_NEAR, 400)
          : undefined,
      },
    },
    sounds: (Array.isArray(data.sounds) ? data.sounds : [])
      .map((one) => readSound(one))
      .filter(Boolean)
      .slice(0, 32) as WorldSound[],
    blocks: data.blocks.map((one) => readPart(one, 0)).filter(Boolean) as WorldPart[],
    /*
     * Groups of part ids that move as one. Read and kept; nothing acts on
     * them, because nothing falls yet. A group of fewer than two parts is
     * not a weld, and the counts are capped for the same reason everything
     * else here is: a file is somebody else's writing.
     */
    welds: (Array.isArray(data.welds) ? data.welds : [])
      .filter((group: unknown) => Array.isArray(group))
      .map((group: unknown[]) => group
        .filter((one) => typeof one === 'string' && NAMED.test(one))
        .slice(0, 256) as string[])
      .filter((group: string[]) => group.length > 1)
      .slice(0, 1024),
    more: keepUnknown(data, [
      'format', 'id', 'name', 'by', 'spawn', 'sky', 'light', 'camera',
      'sounds', 'blocks', 'welds',
    ]),
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

/** One plane, shared by every decal: they differ by where they are put. */
const DECAL_FACE = new THREE.PlaneGeometry(1, 1)

/** How far off the surface a picture sits, in stons. */
const GAP = 0.02

/**
 * How close the camera may come, and how far it goes when a World is quiet.
 *
 * The near end is the engine's rather than the World's: it is the distance
 * at which the camera is inside somebody's head, and that is arithmetic, not
 * a creative decision.
 */
export const ZOOM_NEAR = 0.5
export const ZOOM_FAR = 34

/**
 * Puts a decal against one side of the part that owns it, at the size it
 * should be.
 *
 * Just off the surface rather than on it, because two surfaces in the same
 * place fight over which is in front and the loser disappears. The gap is a
 * fixed distance in the World, not a fraction of the part: a part is scaled,
 * so the same local offset on a thin part is a thousandth of a ston, which
 * is below what a depth buffer can tell apart. Dividing by the part's own
 * size is what keeps the gap the same wherever it is used.
 *
 * A decal covers the face it is on. The plane is a unit square parented to
 * the part, so the part's own scale already stretches it across the whole
 * face: a scale of one by one is exactly the face, whatever shape the face
 * is and whatever shape the picture is.
 *
 * It used to counter-scale that away and hold the picture at its original
 * proportions, which meant a sign stopped being a sign the moment somebody
 * resized the thing it was painted on. A decal on a long wall is meant to
 * come out long. `scale` multiplies the face, and `offset` slides it across
 * in face widths.
 */
export function layDecal(picture: THREE.Mesh, decal: WorldDecal, size: Vec3) {
  const [sx, sy, sz] = size.map((one) => Math.max(Math.abs(one), 0.001))
  const half = Math.PI / 2

  picture.position.set(0, 0, 0)
  picture.rotation.set(0, 0, 0)

  const face = decal.face
  if (face === 'front') picture.position.z = 0.5 + GAP / sz
  else if (face === 'back') {
    picture.position.z = -(0.5 + GAP / sz)
    picture.rotation.y = Math.PI
  } else if (face === 'right') {
    picture.position.x = 0.5 + GAP / sx
    picture.rotation.y = half
  } else if (face === 'left') {
    picture.position.x = -(0.5 + GAP / sx)
    picture.rotation.y = -half
  } else if (face === 'top') {
    picture.position.y = 0.5 + GAP / sy
    picture.rotation.x = -half
  } else {
    picture.position.y = -(0.5 + GAP / sy)
    picture.rotation.x = half
  }

  // One is the whole face. Anything else is somebody asking for it.
  const [times, tall] = decal.scale ?? [1, 1]
  picture.scale.set(times, tall, 1)

  const [right, above] = decal.offset ?? [0, 0]
  // In the picture's own frame, so that it slides across the face it is on
  // rather than along the World.
  if (right) picture.translateX(right)
  if (above) picture.translateY(above)
}

/**
 * One light, of whichever sort it says it is.
 *
 * `surface` has no direct equivalent in three.js's forward renderer, so it
 * is a RectAreaLight: a lit panel rather than a bulb, which is what somebody
 * asking for a glowing face means. It is the one sort that ignores range,
 * because an area light falls off by its own arithmetic.
 *
 * A light that is off, or past the World's budget, comes back as an empty in
 * the same place. Nothing downstream has to know which it got.
 */
let areaLightsReady = false

function lightFor(part: WorldLight, allowed: boolean): THREE.Object3D {
  /*
   * An area light is the one sort three.js will not draw without being
   * handed its lookup tables first. Done once, and only if a World asks for
   * one, because it is a couple of hundred kilobytes of numbers nobody who
   * has not used a surface light should pay for.
   */
  if (part.light === 'surface' && !areaLightsReady) {
    RectAreaLightUniformsLib.init()
    areaLightsReady = true
  }

  const colour = new THREE.Color(part.colour ?? '#ffffff')
  const brightness = part.brightness ?? 1
  const range = part.range ?? 40
  const off = part.on === false || !allowed || brightness <= 0

  const here: THREE.Object3D = off ? new THREE.Object3D()
    : part.light === 'spot' ? new THREE.SpotLight(
      colour, brightness, range, ((part.angle ?? 45) * Math.PI) / 180, 0.4, 1.4)
    : part.light === 'surface' ? new THREE.RectAreaLight(colour, brightness, 4, 4)
    : new THREE.PointLight(colour, brightness, range, 1.4)

  here.name = part.id ?? 'Light'

  /*
   * A spot and a panel both point somewhere. three.js aims a spot at a
   * target object rather than by rotation, so it gets one, parented to
   * itself so it travels with the part.
   */
  if (part.turn) {
    here.rotation.set(
      (part.turn[0] * Math.PI) / 180,
      (part.turn[1] * Math.PI) / 180,
      (part.turn[2] * Math.PI) / 180,
    )
  }
  if (here instanceof THREE.SpotLight) {
    here.target.position.set(0, 0, -1)
    here.add(here.target)
  }

  return here
}

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

  /** How many are actually burning, against MOST_LIGHTS. */
  let lit = 0

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

    // A decal is placed by its part, below, because it belongs to one.
    if (part.kind === 'decal') return

    /*
     * A sound is not a shape. It is still somewhere: an empty that rides the
     * part it belongs to, so that whatever ends up making the noise has a
     * position to read and moves when the part moves.
     */
    if (part.kind === 'sound') {
      const here = new THREE.Object3D()
      here.name = part.id ?? 'Sound'
      into.add(here)
      partOf.set(here, part)
      if (part.id) named.set(part.id, here)
      return
    }

    if (part.kind === 'light') {
      /*
       * Past the budget a light is still in the tree, still selectable,
       * still saved — it simply is not burning. Dropping it would lose
       * somebody's work; drawing it would lose everybody's frame rate.
       */
      const here = lightFor(part, lit < MOST_LIGHTS)
      if (part.on !== false && lit < MOST_LIGHTS) lit += 1
      into.add(here)
      partOf.set(here, part)
      if (part.id) named.set(part.id, here)
      return
    }

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

    /*
     * Pictures, as things sitting on the part rather than as its material.
     *
     * Parenting is the whole point: a child of the part inherits the part's
     * scale, so resizing a wall resizes what is written on it. A material
     * cannot do that, and a material can hold one picture per face, and a
     * material cannot be selected, renamed or deleted in an Explorer.
     */
    for (const child of part.children ?? []) {
      if (child.kind === 'sound' || child.kind === 'light') {
        place(child, mesh)
        continue
      }
      const decal = child
      const picture = new THREE.Mesh(
        DECAL_FACE,
        new THREE.MeshStandardMaterial({
          transparent: true,
          opacity: 1 - (decal.transparency ?? 0),
          color: decal.colour ?? '#ffffff',
          // It sits on a surface, so it must win the depth test against it
          // without being pushed into the part behind.
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      )
      // Nothing to show until its picture arrives. On the mesh rather than
      // the material: hiding the material and revealing the mesh is two
      // different flags, and the picture never appears.
      picture.visible = false
      picture.name = decal.id ?? 'Decal'
      layDecal(picture, decal, part.size)
      mesh.add(picture)

      partOf.set(picture, decal)
      if (decal.id) named.set(decal.id, picture)
    }

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
 * Puts the models on.
 *
 * A separate pass for the same reason the pictures are: a World appears and
 * then its models arrive, rather than a blank screen while a megabyte of
 * geometry is fetched. A part that names a model keeps its shape until the
 * model is there, and keeps it for ever if the model never comes.
 *
 * The loaded geometry is scaled into the part's box, so a model resizes with
 * the same gizmo as everything else and a decal on it still lands on the
 * face it was put on. The part keeps its own material: a Kobblon part is
 * coloured by its part, which is what makes a hundred of the same model in a
 * hundred colours one download.
 */
export async function applyMeshes(
  built: BuiltWorld,
  resolveAsset?: (id: string) => Promise<string | null>,
) {
  if (!resolveAsset) return

  const loader = new GLTFLoader()
  const jobs: Promise<void>[] = []

  for (const [object, part] of built.partOf) {
    if (part.kind !== 'box' || !part.mesh) continue
    const mesh = object as THREE.Mesh

    jobs.push((async () => {
      const url = await resolveAsset(part.mesh!).catch(() => null)
      if (!url) return

      const model = await loader.loadAsync(url).catch(() => null)
      if (!model) return

      /*
       * Everything in the file as one geometry, in the file's own space,
       * and then squeezed into the unit box the part's scale expands. A
       * model that came out of Blender at two hundred units tall and one
       * that came out at 0.4 both end up the size of the part, which is the
       * only behaviour a person placing one expects.
       */
      const pieces: THREE.BufferGeometry[] = []
      model.scene.updateMatrixWorld(true)
      model.scene.traverse((one) => {
        if (!(one instanceof THREE.Mesh)) return
        const piece = one.geometry.clone()
        piece.applyMatrix4(one.matrixWorld)
        pieces.push(piece)
      })
      if (!pieces.length) return

      const whole = mergeGeometries(pieces)
      if (!whole) return
      whole.computeBoundingBox()
      const box = whole.boundingBox!
      const span = new THREE.Vector3()
      box.getSize(span)
      const middle = new THREE.Vector3()
      box.getCenter(middle)

      whole.translate(-middle.x, -middle.y, -middle.z)
      whole.scale(
        1 / Math.max(span.x, 1e-6),
        1 / Math.max(span.y, 1e-6),
        1 / Math.max(span.z, 1e-6),
      )
      if (!whole.attributes.normal) whole.computeVertexNormals()

      mesh.geometry = whole
    })())
  }

  await Promise.all(jobs)
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

  const jobs: Promise<void>[] = []

  for (const [object, part] of built.partOf) {
    if (part.kind !== 'decal') continue
    const picture = object as THREE.Mesh

    jobs.push((async () => {
      /*
       * An id is whatever the Catalog calls a thing. That is a content tag
       * like IMG-1070 on the site, and a row's uuid underneath, and the
       * engine takes either: resolving one is the client's business, and the
       * client is the only thing that knows which it has.
       */
      const url = await resolveAsset(part.picture).catch(() => null)
      if (!url) return

      const image = await loader.loadAsync(url).catch(() => null)
      if (!image) return

      image.colorSpace = THREE.SRGBColorSpace

      /*
       * A Texture is a decal that repeats. Without a count the picture is
       * laid once and clamped, which is a decal; with one it tiles, and
       * clamping has to be turned off or the edge pixel smears instead of
       * the picture starting again.
       */
      const [across, up] = part.repeat ?? [1, 1]
      if (across !== 1 || up !== 1) {
        image.wrapS = THREE.RepeatWrapping
        image.wrapT = THREE.RepeatWrapping
        image.repeat.set(Math.max(across, 0.001), Math.max(up, 0.001))
      }

      const material = picture.material as THREE.MeshStandardMaterial
      material.map = image
      material.needsUpdate = true

      /*
       * Only now is the picture's shape known, so only now can it be fitted.
       * The part's scale is on the parent mesh, which is where the stretch
       * this undoes comes from.
       */
      /*
       * The picture's own proportions are no longer anybody's business:
       * it covers the face it is on. This still re-lays it, because a
       * decal is hidden until its picture arrives.
       */
      const size = (picture.parent?.scale.toArray() ?? [1, 1, 1]) as Vec3
      layDecal(picture, part, size)
      // Nothing was shown while it loaded, rather than a blank white square.
      picture.visible = true
    })())
  }

  await Promise.all(jobs)
}
/** The old name, while anything still says it. */
export const buildExperience = buildWorld
