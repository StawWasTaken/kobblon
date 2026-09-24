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
  children?: (WorldDecal | WorldSound)[]
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
   * How big the picture is on the face, as a multiple of its fitted size.
   *
   * A picture keeps its own proportions by default: a square picture on a
   * wall forty stons by eight is a square picture, not a smear forty stons
   * wide. One fills the face in its longest direction; two is twice that and
   * hangs over the edges; `[2, 1]` is deliberately stretched, which is a
   * thing somebody sometimes wants.
   */
  scale?: [number, number]
  /** Where it sits on the face, in face widths. 0 is the middle. */
  offset?: [number, number]
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

export type WorldPart = WorldBlock | WorldGroup | WorldDecal | WorldSound

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
  }
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
    const asChild = (raw: any): WorldDecal | WorldSound | null => {
      if (!raw || typeof raw !== 'object') return null
      if (raw.kind === 'sound') return readSound(raw)

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
      }
    }

    const children = [
      ...(Array.isArray(part.children) ? part.children : []),
      ...(part.decal ? [part.decal] : []),
    ]
      .map(asChild)
      .filter(Boolean)
      .slice(0, 12) as (WorldDecal | WorldSound)[]

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
      if (child.kind === 'sound') {
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
