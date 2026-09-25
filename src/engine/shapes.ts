import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The shapes a part can be.
 *
 * A 2015 game is mostly boxes and wedges and cannot be built without wedges,
 * so those two matter most. Each is a unit shape, scaled by the part's size,
 * which keeps one geometry in memory however many parts use it.
 */
export type Shape = 'box' | 'wedge' | 'cylinder' | 'sphere' | 'truss'

export const SHAPES: Shape[] = ['box', 'wedge', 'cylinder', 'sphere', 'truss']

export const isShape = (value: unknown): value is Shape =>
  typeof value === 'string' && (SHAPES as string[]).includes(value)

/**
 * A wedge: a box with its top edge pulled to one side, so it is a ramp
 * rising towards +Z. Written by hand because three.js has no wedge.
 *
 * A triangular prism: the cross section is the triangle low at -Z, high at
 * +Z, and it is closed by a sloped face, a tall back, a bottom and two side
 * triangles. Eight triangles, five faces, filling its box exactly.
 *
 * Every one of those eight used to be wound the wrong way round. A triangle
 * wound backwards is culled from outside and drawn from inside, so the wedge
 * read as an open box: you saw through the slope to the inside of the far
 * face. `computeVertexNormals` works off the winding too, so the normals
 * were inward as well and the lighting was wrong on top of it. This is the
 * whole of that bug — the shape was never the wrong size, it was inside out.
 *
 * Counter-clockwise seen from outside, which is what three.js calls front.
 */
function wedge() {
  const geometry = new THREE.BufferGeometry()

  // Low edge at -Z, high edge at +Z, both at the part's full width.
  const positions = new Float32Array([
    // sloped face, facing up and towards -Z
    -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
    // back, the tall end, facing +Z
    -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    // bottom, facing down
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    // right triangle, facing +X
    0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    // left triangle, facing -X
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
  ])

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  boxProject(geometry)
  return geometry
}

/**
 * Gives a geometry UVs by projecting each triangle down its own strongest
 * axis. Crude, and right for shapes made of flat faces: a wedge's slope gets
 * a pattern that runs up it rather than a smear.
 */
function boxProject(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const uv = new Float32Array(position.count * 2)

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))

    let u = x
    let v = y
    if (nx > ny && nx > nz) { u = z; v = y }
    else if (ny > nx && ny > nz) { u = x; v = z }

    uv[i * 2] = u + 0.5
    uv[i * 2 + 1] = v + 0.5
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/**
 * How long one bay of a truss is, in stons, and how thick its bars are.
 *
 * Fixed rather than settable, and that is the point: two trusses standing
 * beside each other line up, and a tower built out of three parts reads as
 * one tower. Somebody who wants a different rhythm can ask later, and then
 * it is a field; making it a field now means no two trusses ever match.
 */
export const TRUSS_BAY = 4
const TRUSS_BAR = 0.5

/**
 * A truss: a lattice you can climb, that repeats rather than stretches.
 *
 * Every other shape here is a unit geometry that the part's own scale
 * stretches. A truss cannot be, because the shape *is* the pattern: a
 * stretched truss says how long the part is rather than what it is made of,
 * which is the same mistake as a stretched brick texture and worse, because
 * you can see through it.
 *
 * So this is built for the size it is asked for — a part ten stons tall gets
 * two and a half bays, one twenty stons tall gets five — and then divided
 * back through that size, because the mesh is still scaled by it. Bars keep
 * one thickness whatever the part does; only the count changes.
 *
 * It runs up the Y axis, like a tower. Lay one on its side by turning the
 * part, the way everything else here is turned.
 */
function truss(size: [number, number, number]): THREE.BufferGeometry {
  const [sx, sy, sz] = size.map((one) => Math.max(Math.abs(one), TRUSS_BAR * 2)) as [number, number, number]

  // At least one bay: a part shorter than a bay is a stub of truss, not an
  // empty box.
  const bays = Math.max(1, Math.round(sy / TRUSS_BAY))
  const bay = sy / bays

  const bars: THREE.BufferGeometry[] = []
  const put = (
    width: number, height: number, depth: number,
    at: [number, number, number], turn = 0, axis: 'x' | 'z' = 'z',
  ) => {
    const bar = new THREE.BoxGeometry(width, height, depth)
    if (turn) {
      bar.applyMatrix4(axis === 'z'
        ? new THREE.Matrix4().makeRotationZ(turn)
        : new THREE.Matrix4().makeRotationX(turn))
    }
    bar.translate(at[0], at[1], at[2])
    bars.push(bar)
  }

  const legX = (sx - TRUSS_BAR) / 2
  const legZ = (sz - TRUSS_BAR) / 2

  // The four legs, corner to corner, the whole length.
  for (const x of [-legX, legX]) {
    for (const z of [-legZ, legZ]) put(TRUSS_BAR, sy, TRUSS_BAR, [x, 0, z])
  }

  for (let i = 0; i < bays; i += 1) {
    const middle = -sy / 2 + bay * (i + 0.5)
    const top = -sy / 2 + bay * (i + 1)

    /*
     * A diagonal across each of the four faces, alternating its lean bay by
     * bay so the lattice zigzags rather than leaning one way for ever.
     */
    const lean = i % 2 === 0 ? 1 : -1
    const flat = Math.hypot(sx - TRUSS_BAR, bay)
    const deep = Math.hypot(sz - TRUSS_BAR, bay)
    const angleX = Math.atan2(bay * lean, sx - TRUSS_BAR)
    const angleZ = Math.atan2(bay * lean, sz - TRUSS_BAR)

    for (const z of [-legZ, legZ]) {
      put(flat, TRUSS_BAR, TRUSS_BAR, [0, middle, z], angleX - Math.PI / 2 + Math.PI / 2, 'z')
    }
    for (const x of [-legX, legX]) {
      put(TRUSS_BAR, TRUSS_BAR, deep, [x, middle, 0], -angleZ, 'x')
    }

    // A ring at the top of every bay but the last, which the legs already
    // close.
    if (i < bays - 1) {
      put(sx, TRUSS_BAR, TRUSS_BAR, [0, top, -legZ])
      put(sx, TRUSS_BAR, TRUSS_BAR, [0, top, legZ])
      put(TRUSS_BAR, TRUSS_BAR, sz, [-legX, top, 0])
      put(TRUSS_BAR, TRUSS_BAR, sz, [legX, top, 0])
    }
  }

  const whole = mergeGeometries(bars, false) ?? new THREE.BoxGeometry(1, 1, 1)
  for (const bar of bars) bar.dispose()

  // Back into the unit box the part's scale will expand, so the bars come
  // out the thickness they were built at.
  whole.scale(1 / sx, 1 / sy, 1 / sz)
  return whole
}

/** Trusses, by the size they were built for. */
const trusses = new Map<string, THREE.BufferGeometry>()

/**
 * One geometry per shape, shared by every part that wants it. Kept here
 * rather than made per World so opening a second World costs nothing.
 */
const made = new Map<Shape, THREE.BufferGeometry>()

export function geometryFor(shape: Shape): THREE.BufferGeometry {
  const had = made.get(shape)
  if (had) return had

  const geometry =
    // A truss has no one geometry; this is the one bay somebody gets for
    // asking without a size, and tiledGeometry is where a real one is made.
    shape === 'truss' ? truss([4, TRUSS_BAY, 4])
    : shape === 'wedge' ? wedge()
    : shape === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24)
    : shape === 'sphere' ? new THREE.SphereGeometry(0.5, 24, 16)
    : new THREE.BoxGeometry(1, 1, 1)

  made.set(shape, geometry)
  return geometry
}

/**
 * The same shape, with its pattern repeating by how big the part actually is.
 *
 * This is the part that cannot be skipped. A pattern stretched to fit says
 * how big a part is rather than what it is made of, so a wall of four bricks
 * beside a wall of four hundred looks wrong without anybody being able to say
 * why. The repeat is folded into the UVs rather than into the texture, so one
 * texture serves every part and a box gets it right on each face separately:
 * a floor ten stons across and two thick is not the same on the top as it is
 * on the side.
 *
 * Cached by shape and size, because a World repeats its sizes constantly.
 */
const tiled = new Map<string, THREE.BufferGeometry>()

export function tiledGeometry(
  shape: Shape,
  size: [number, number, number],
  tilesPerSton: number,
): THREE.BufferGeometry {
  /*
   * A truss is the one shape whose geometry depends on how big it is, so it
   * is built here where the size is known rather than cached by name in
   * geometryFor. Its own bars carry the pattern; a material laid over the
   * top of them repeats per bar, which is what a painted girder looks like.
   */
  if (shape === 'truss') {
    const [tx, ty, tz] = size.map((one) => Math.round(Math.abs(one) * 4) / 4)
    const key = `truss|${tx}|${ty}|${tz}`
    const had = trusses.get(key)
    if (had) return had
    const made = truss([tx, ty, tz])
    trusses.set(key, made)
    return made
  }

  const plain = geometryFor(shape)
  if (tilesPerSton <= 0) return plain

  // Rounded, or a World of slightly different sizes fills the cache.
  const [sx, sy, sz] = size.map((one) => Math.round(Math.abs(one) * 4) / 4)
  const key = `${shape}|${sx}|${sy}|${sz}|${tilesPerSton}`
  const had = tiled.get(key)
  if (had) return had

  const geometry = plain.clone()
  const uv = geometry.getAttribute('uv')
  if (!uv) return plain

  /** How many repeats across a face that spans these two dimensions. */
  const across = (u: number, v: number): [number, number] =>
    [u * tilesPerSton, v * tilesPerSton]

  if (shape === 'box') {
    // three.js lays a box out as +x, -x, +y, -y, +z, -z, four corners each.
    const faces: [number, number][] = [
      across(sz, sy), across(sz, sy),
      across(sx, sz), across(sx, sz),
      across(sx, sy), across(sx, sy),
    ]
    for (let face = 0; face < 6; face += 1) {
      const [ru, rv] = faces[face]
      for (let corner = 0; corner < 4; corner += 1) {
        const at = face * 4 + corner
        uv.setXY(at, uv.getX(at) * ru, uv.getY(at) * rv)
      }
    }
  } else if (shape === 'cylinder') {
    // Around the side is a circumference, not a width.
    const [ru, rv] = across(Math.PI * sx, sy)
    for (let at = 0; at < uv.count; at += 1) {
      uv.setXY(at, uv.getX(at) * ru, uv.getY(at) * rv)
    }
  } else if (shape === 'sphere') {
    const [ru, rv] = across(Math.PI * sx, (Math.PI * sy) / 2)
    for (let at = 0; at < uv.count; at += 1) {
      uv.setXY(at, uv.getX(at) * ru, uv.getY(at) * rv)
    }
  } else {
    // A wedge's UVs were projected per face, so they scale with the part.
    const [ru, rv] = across(sx, sy)
    for (let at = 0; at < uv.count; at += 1) {
      uv.setXY(at, uv.getX(at) * ru, uv.getY(at) * rv)
    }
  }

  uv.needsUpdate = true
  tiled.set(key, geometry)
  return geometry
}
