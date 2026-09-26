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
 * The Workspace imports this too, so it has no provider, no router and no
 * DOM beyond the canvas it is handed.
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
 * units. Worth knowing rather than guessing, because a model that arrives
 * with its own materials must not have them overwritten by the Decal it
 * wears, and one that arrives bare has nothing to overwrite.
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
 * Only for a model that brought no materials of its own. A glTF has its own,
 * and a Decal painted over them would throw away what its author made.
 *
 * `flipY` off because glTF and OBJ both count texture coordinates from the
 * bottom and three.js counts from the top, which is the difference between a
 * texture and the same texture upside down.
 */
export function wearTexture(model: THREE.Object3D, picture: THREE.Texture) {
  picture.flipY = false
  picture.colorSpace = THREE.SRGBColorSpace
  model.traverse((one) => {
    const part = one as THREE.Mesh
    if (!part.isMesh) return
    for (const old of [part.material].flat()) (old as THREE.Material)?.dispose?.()
    part.material = new THREE.MeshStandardMaterial({
      map: picture, roughness: 0.7, metalness: 0,
    })
  })
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
