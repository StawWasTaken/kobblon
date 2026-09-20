import * as THREE from 'three'

/**
 * The shapes a part can be.
 *
 * A 2015 game is mostly boxes and wedges and cannot be built without wedges,
 * so those two matter most. Each is a unit shape, scaled by the part's size,
 * which keeps one geometry in memory however many parts use it.
 */
export type Shape = 'box' | 'wedge' | 'cylinder' | 'sphere'

export const SHAPES: Shape[] = ['box', 'wedge', 'cylinder', 'sphere']

export const isShape = (value: unknown): value is Shape =>
  typeof value === 'string' && (SHAPES as string[]).includes(value)

/**
 * A wedge: a box with its top edge pulled to one side, so it is a ramp
 * rising towards +Z. Written by hand because three.js has no wedge, and as
 * six faces with hard normals so it reads as built rather than as moulded.
 */
function wedge() {
  const geometry = new THREE.BufferGeometry()

  // Low edge at -Z, high edge at +Z, both at the part's full width.
  const positions = new Float32Array([
    // sloped face
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // back, the tall end
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // bottom
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
    // right triangle
    0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    // left triangle
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  ])

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

/**
 * One geometry per shape, shared by every part that wants it. Kept here
 * rather than made per World so opening a second World costs nothing.
 */
const made = new Map<Shape, THREE.BufferGeometry>()

export function geometryFor(shape: Shape): THREE.BufferGeometry {
  const had = made.get(shape)
  if (had) return had

  const geometry =
    shape === 'wedge' ? wedge()
    : shape === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24)
    : shape === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16)
    : new THREE.BoxGeometry(1, 1, 1)

  made.set(shape, geometry)
  return geometry
}
