/*
 * Boxes, and the weights that bind them to bones.
 *
 * K6 is built from boxes on purpose: Kobblon is a brick, the silhouette
 * should read at a distance, and a blocky avatar stays legible at the polygon
 * count a browser can afford for a dozen of them at once.
 *
 * Everything here is in stons, Kobblon's unit. One ston is 0.2 metres, so a
 * ten ston avatar is two metres tall.
 */

/** The six faces of a box, each with its own four corners so normals stay hard. */
const FACES = [
  { n: [0, 0, 1], c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], c: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { n: [1, 0, 0], c: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 1, 0], c: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { n: [0, -1, 0], c: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
]

/**
 * A box given as its middle and its full size, in the avatar's own space.
 * `taper` shrinks the top face, which is what keeps a limb from reading as a
 * plank.
 */
export function box({ at, size, taper = 1 }) {
  const [cx, cy, cz] = at
  const [sx, sy, sz] = size
  const positions = []
  const normals = []
  const indices = []

  for (const face of FACES) {
    const first = positions.length / 3
    for (const [x, y, z] of face.c) {
      const narrow = y > 0 ? taper : 1
      positions.push(
        cx + (x * sx * narrow) / 2,
        cy + (y * sy) / 2,
        cz + (z * sz * narrow) / 2,
      )
      normals.push(...face.n)
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  return { positions, normals, indices }
}

/** Sticks several boxes together into one part's geometry. */
export function join(parts) {
  const positions = []
  const normals = []
  const indices = []
  for (const part of parts) {
    const offset = positions.length / 3
    positions.push(...part.positions)
    normals.push(...part.normals)
    indices.push(...part.indices.map((i) => i + offset))
  }
  return { positions, normals, indices }
}

/**
 * Binds every vertex to at most two bones by how far up the limb it sits.
 *
 * A limb has a bone at each end of it and a band in the middle where the two
 * share the vertex. That band is what lets an elbow bend instead of shearing,
 * and it is the difference between a rig and six boxes flying in formation.
 */
export function bind(geometry, bands) {
  const joints = []
  const weights = []

  for (let i = 0; i < geometry.positions.length; i += 3) {
    const y = geometry.positions[i + 1]
    const band = bands.find((one) => y >= one.from && y <= one.to) ?? bands[bands.length - 1]

    if (band.blendWith === undefined) {
      joints.push(band.joint, 0, 0, 0)
      weights.push(1, 0, 0, 0)
      continue
    }

    // How far through the blending band this vertex is, 0 at the bottom.
    const through = (y - band.from) / Math.max(band.to - band.from, 1e-6)
    const mine = 1 - through
    joints.push(band.joint, band.blendWith, 0, 0)
    weights.push(mine, 1 - mine, 0, 0)
  }

  return { joints, weights }
}

/**
 * A ball.
 *
 * The v.02 head is a sphere rather than a cube, and the shoulders and hips
 * are visible balls that a limb turns on. Kept coarse on purpose: this is a
 * brick toy, not a figurine, and a head made of four hundred triangles
 * reads no rounder at the size anybody sees it.
 */
export function ball({ at, radius, rings = 10, segments = 14 }) {
  const [cx, cy, cz] = at
  const positions = []
  const normals = []
  const indices = []

  for (let ring = 0; ring <= rings; ring += 1) {
    const phi = (ring / rings) * Math.PI
    for (let seg = 0; seg <= segments; seg += 1) {
      const theta = (seg / segments) * Math.PI * 2
      const nx = Math.sin(phi) * Math.cos(theta)
      const ny = Math.cos(phi)
      const nz = Math.sin(phi) * Math.sin(theta)
      positions.push(cx + nx * radius, cy + ny * radius, cz + nz * radius)
      normals.push(nx, ny, nz)
    }
  }

  const row = segments + 1
  for (let ring = 0; ring < rings; ring += 1) {
    for (let seg = 0; seg < segments; seg += 1) {
      const a = ring * row + seg
      const b = a + row
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  return { positions, normals, indices }
}

/**
 * A box with its edges taken off.
 *
 * "Chunky limb geometry" is the v.02 note, and what stops a chunky limb
 * reading as a plank is that its edges catch light rather than ending in a
 * line. Built as a box whose corner vertices are pulled in by `bevel` and
 * given their own normals, which is the cheapest rounding that still reads:
 * no extra faces, no smoothing group to get wrong.
 */
export function chunk({ at, size, bevel = 0.12, taper = 1 }) {
  const [cx, cy, cz] = at
  const [sx, sy, sz] = size
  const positions = []
  const normals = []
  const indices = []

  // How far in from each face the bevel starts, as a fraction of that side.
  const inset = Math.min(Math.max(bevel, 0), 0.4)

  for (const face of FACES) {
    const first = positions.length / 3
    for (const [x, y, z] of face.c) {
      const narrow = y > 0 ? taper : 1
      // Pull the corner in along the two axes the face does not point down.
      const pull = (axis, value) => (face.n[axis] === 0 ? value * (1 - inset) : value)
      positions.push(
        cx + (pull(0, x) * sx * narrow) / 2,
        cy + (pull(1, y) * sy) / 2,
        cz + (pull(2, z) * sz * narrow) / 2,
      )
      /*
       * The normal leans towards the corner it belongs to, so the edge
       * between two faces catches a highlight instead of being a hard line.
       */
      const lean = [
        face.n[0] + (face.n[0] === 0 ? x * inset * 2 : 0),
        face.n[1] + (face.n[1] === 0 ? y * inset * 2 : 0),
        face.n[2] + (face.n[2] === 0 ? z * inset * 2 : 0),
      ]
      const length = Math.hypot(...lean) || 1
      normals.push(lean[0] / length, lean[1] / length, lean[2] / length)
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  return { positions, normals, indices }
}
