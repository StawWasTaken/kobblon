/*
 * Reading a mesh file, in the one place that knows how.
 *
 * The card drawn at upload and the viewer on an item's page are the same
 * question asked twice — which loader does this file want, where is the
 * model once it is loaded, and how far back does a camera stand to see all
 * of it. That was written twice the day the viewer arrived, and a format
 * added to one copy and not the other is a file Kobblon accepts and then
 * cannot draw.
 *
 * It lives in the engine rather than beside the website's other helpers
 * because the engine imports it and the engine has no `@/` imports at all -
 * it is vendored whole by the Workspace, and a dependency on the website's
 * lib folder is a dependency the Workspace has no way to satisfy. The
 * website reaches it through `@/lib/mesh`, which is this file under its
 * older name.
 *
 * No provider, no router and no DOM beyond the canvas it is handed.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

/**
 * What counts as a mesh by its name.
 *
 * The extensions here, `kindAccepts.mesh` in `@/lib/kinds` and
 * `expected_extensions('mesh')` in the database are three statements of one
 * fact, and the database is the one that decides — the other two only say no
 * earlier and more politely.
 */
export const meshFormats = /\.(glb|gltf|obj)$/i

/** The formats a mesh may arrive in. */
export type MeshFormat = 'gltf' | 'obj'

/**
 * Which format an address holds.
 *
 * Only ever a guess, and a guess that is wrong exactly where it matters
 * most: `URL.createObjectURL` hands back `blob:https://host/<uuid>` with no
 * name and no extension, so every OBJ somebody uploads looks like glTF here
 * and goes to the wrong reader. A signed address can hide the name behind a
 * query string too.
 *
 * So this is the fallback, not the answer. Anywhere the real filename is in
 * hand - an upload, a row with its `file_path` - pass the format instead of
 * letting it be sniffed.
 */
export const formatOf = (nameOrUrl: string): MeshFormat =>
  /\.obj(\?|#|$)/i.test(nameOrUrl) ? 'obj' : 'gltf'

/**
 * Whether a model brings its own materials.
 *
 * An OBJ carries geometry and nothing else: no materials, no texture, no
 * units. A glTF can carry all three.
 *
 * Worth knowing, and **not** the test for whether to apply a Decal. A Decal
 * somebody attached is an instruction and wins over whatever the file
 * brought; this only says what is there to begin with, which decides what a
 * model with *no* Decal looks like. Getting those two confused is what made
 * a .glb with a Decal attached render grey.
 */
export const carriesMaterials = (format: MeshFormat) => format !== 'obj'

/** Loads whichever kind of file this is, and hands back the model. */
export async function loadMesh(
  src: string,
  format: MeshFormat = formatOf(src),
): Promise<THREE.Object3D> {
  const model = await readMesh(src, format)
  if (!hasSomethingToDraw(model)) {
    releaseMesh(model)
    throw new Error('There is no geometry in this file.')
  }
  return model
}

async function readMesh(src: string, format: MeshFormat): Promise<THREE.Object3D> {
  if (format === 'obj') {
    const group = await new OBJLoader().loadAsync(src)
    /*
     * OBJLoader gives every part a white MeshPhongMaterial when there is no
     * .mtl, and a white plastic shine reads as a rendering fault rather than
     * as an untextured model. Standard material, slightly off-white, no
     * shine: it looks like an undressed model, which is what it is.
     */
    group.traverse((one) => {
      const part = one as THREE.Mesh
      if (!part.isMesh) return
      for (const old of [part.material].flat()) (old as THREE.Material)?.dispose?.()
      part.material = new THREE.MeshStandardMaterial({
        color: '#c9cedb', roughness: 0.75, metalness: 0,
      })
    })
    return group
  }

  const model = await new GLTFLoader().loadAsync(src)
  return model.scene
}

/**
 * Whether there is actually anything in here to draw.
 *
 * `OBJLoader` does not throw on a file that is not an OBJ - text is text, and
 * a file with no `v` lines in it parses to a group with nothing inside.
 * Without this the viewer treats that as a success and shows an empty frame
 * inviting you to drag it, and the upload card draws a blank JPEG instead of
 * declining to draw one. Both look like the model is at fault.
 */
export function hasSomethingToDraw(model: THREE.Object3D) {
  let found = false
  model.traverse((one) => {
    const part = one as THREE.Mesh
    if (part.isMesh && (part.geometry?.getAttribute('position')?.count ?? 0) > 0) {
      found = true
    }
  })
  return found
}

/**
 * Dresses every surface in a picture.
 *
 * A Decal somebody attached is an instruction, so this paints over whatever
 * the file brought. `carriesMaterials` is not the test for calling it.
 *
 * Two things here are per-format, and getting either wrong looks like the
 * texture never arrived.
 *
 * **Which way up.** glTF bakes its texture coordinates for WebGL, counting
 * from the bottom, so a glTF texture must not be flipped. Everything else -
 * OBJ among them - is read by three.js with the ordinary convention, where
 * flipping is what makes it right. This file flipped *everything* off, so
 * every OBJ wore its Decal upside down: a label on a can, a wrapper on a
 * burger, both there and both unreadable, which reads as broken rather than
 * as inverted.
 *
 * **Whether there are coordinates at all.** An OBJ exported without `vt`
 * lines has no `uv` attribute, and a material with a map on geometry with no
 * uv samples one corner of the picture for every pixel: the model turns a
 * single flat colour. That is indistinguishable from "the texture did not
 * load", and it was the more common of the two. So when a part has no
 * coordinates, it is given some - see `projectUv`.
 */
export function wearTexture(
  model: THREE.Object3D,
  picture: THREE.Texture,
  format: MeshFormat = 'gltf',
) {
  picture.flipY = format !== 'gltf'
  picture.colorSpace = THREE.SRGBColorSpace
  picture.needsUpdate = true
  model.traverse((one) => {
    const part = one as THREE.Mesh
    if (!part.isMesh) return
    if (part.geometry && !part.geometry.getAttribute('uv')) projectUv(part.geometry)
    for (const old of [part.material].flat()) (old as THREE.Material)?.dispose?.()
    part.material = new THREE.MeshStandardMaterial({
      map: picture, roughness: 0.7, metalness: 0,
    })
  })
}

/**
 * Texture coordinates for geometry that arrived with none.
 *
 * Box projection: each triangle is lit from whichever of the three axes its
 * normal points along most, and its two remaining coordinates become the
 * picture's. It is not what an artist would have authored - a seam shows
 * where the dominant axis changes - but it wraps a picture round a shape
 * recognisably, which is the whole difference between a textured model and a
 * flat-coloured one.
 *
 * Deliberately not a guess at the author's intent. A model whose own `vt`
 * lines exist is left completely alone; this only ever runs where the choice
 * is between this and nothing.
 */
export function projectUv(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position')
  if (!position || position.count === 0) return

  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return

  const span = new THREE.Vector3().subVectors(box.max, box.min)
  // A flat shape spans nothing on one axis; dividing by it gives NaN, and a
  // NaN coordinate draws nothing at all.
  const safe = (n: number) => (n > 1e-6 ? n : 1)

  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const normal = geometry.getAttribute('normal')

  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))

    /*
     * Which way round each face goes.
     *
     * Two faces pointing opposite ways along one axis read the same two
     * coordinates, so without this a picture with writing on it comes out
     * backwards on one of them - which looks like a fault in the model
     * rather than a property of flattening a box onto a picture.
     *
     * Whether to flip is not one rule for all three axes, it is whichever
     * way the picture's left-to-right lands when you stand outside that face
     * and look at it. From outside +X, the screen's right is -Z, so a `u`
     * taken from +Z runs backwards and that face flips; from outside -X it
     * already runs the right way. On Z it is the other way round. Y is left
     * alone: a top and a bottom have no agreed reading direction, and a
     * Decal with writing on it is not put on them on purpose.
     */
    let u: number, v: number
    let flip = false
    if (nx >= ny && nx >= nz) {
      u = (z - box.min.z) / safe(span.z); v = (y - box.min.y) / safe(span.y)
      flip = normal.getX(i) > 0
    } else if (ny >= nx && ny >= nz) {
      u = (x - box.min.x) / safe(span.x); v = (z - box.min.z) / safe(span.z)
    } else {
      u = (x - box.min.x) / safe(span.x); v = (y - box.min.y) / safe(span.y)
      flip = normal.getZ(i) < 0
    }
    if (flip) u = 1 - u
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/**
 * Where a camera stands to see all of something, whatever shape it is.
 *
 * From the model's own bounding sphere rather than its height, so a tall
 * thing and a wide thing both fill the frame. Returns the middle as well,
 * because that is what the camera looks at and what a turntable turns
 * around.
 */
export function frameMesh(model: THREE.Object3D, camera: THREE.PerspectiveCamera) {
  const around = new THREE.Box3().setFromObject(model)
  const middle = around.getCenter(new THREE.Vector3())
  const reach = Math.max(around.getBoundingSphere(new THREE.Sphere()).radius, 0.001)

  camera.near = reach / 100
  camera.far = reach * 100
  camera.updateProjectionMatrix()

  // Far enough that the whole sphere is inside the cone of vision, with a
  // little air around it.
  const away = (reach * 1.35) / Math.sin((camera.fov * Math.PI) / 360)
  return { middle, reach, away }
}

/**
 * Where to stand to look at a model, and the thing nobody can know.
 *
 * **A mesh file does not say which way it faces.** There is no field for it
 * in OBJ and none in glTF, and the exporters disagree: Blender writes one
 * forward axis by default and plenty of people change it, so one artist's
 * front is another's back. Anything that claims to find the front is
 * guessing.
 *
 * So this is a stated default rather than a discovery, chosen because it is
 * the one that fits Kobblon's own content, and it is the *same* default for
 * the card and for the viewer - which matters more than which way it points.
 * A card taken from one angle and a viewer that opens on another makes the
 * same model look like two models.
 *
 * Where it matters, a creator sets it: the mesh panel takes the card from
 * whatever angle they have turned the model to. That is the only answer that
 * is actually right, because the only one who knows which side is the front
 * is the person who made it.
 */
export const LOOK_YAW = Math.PI
export const LOOK_PITCH = 0.38

/** The camera's place, from the middle of a model and how far back to stand. */
export function lookFrom(
  middle: THREE.Vector3,
  away: number,
  yaw = LOOK_YAW,
  pitch = LOOK_PITCH,
) {
  const flat = Math.cos(pitch) * away
  return new THREE.Vector3(
    middle.x + Math.sin(yaw) * flat,
    middle.y + Math.sin(pitch) * away,
    middle.z + Math.cos(yaw) * flat,
  )
}

/** Enough light to read a shape by, from above and in front, with a fill. */
export function lightForLooking(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d95a6, 2.2))
  const sun = new THREE.DirectionalLight(0xffffff, 2.4)
  sun.position.set(6, 10, 8)
  scene.add(sun)
}

/**
 * Gives back what a model holds.
 *
 * Not optional housekeeping: a WebGL context is a scarce thing and a browser
 * allows a handful at once, so leaking them means the fifth mesh somebody
 * looks at in a session silently draws nothing at all.
 */
export function releaseMesh(model: THREE.Object3D) {
  model.traverse((one) => {
    const part = one as THREE.Mesh
    part.geometry?.dispose?.()
    for (const material of [part.material].flat()) {
      const worn = material as THREE.MeshStandardMaterial
      worn?.map?.dispose?.()
      worn?.dispose?.()
    }
  })
}
