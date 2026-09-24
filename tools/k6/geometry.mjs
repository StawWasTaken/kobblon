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
 * A box with real rounded edges.
 *
 * This is the whole K6 v.02 shape language: faces that are flat and almost
 * smooth, edges that are softly rounded, nothing that reads as a sphere and
 * nothing that ends in a hard line. A head, an arm and a torso are the same
 * primitive at different sizes and different roundings.
 *
 * It is built by projection rather than by faking normals, which is what
 * the first attempt did and why it had a seam at every joint. Each point on
 * a cube is clamped to the inner box, then pushed back out by the radius
 * along the direction it was pushed in. Where a point is already inside the
 * inner box the face stays exactly flat; near an edge it curves; the normal
 * is that same direction, so lighting is correct rather than approximated.
 */
export function rounded({ at, size, radius = 0.25, steps = 6 }) {
  const [cx, cy, cz] = at
  const half = [size[0] / 2, size[1] / 2, size[2] / 2]

  // The radius can never eat more than the smallest half-side, or the box
  // turns inside out.
  const r = Math.min(radius, Math.min(...half) * 0.98)
  const inner = half.map((h) => Math.max(h - r, 0))

  const positions = []
  const normals = []
  const indices = []

  /* u and v walk across a face; the third axis is pinned to the face. */
  const faces = [
    { axis: 0, sign: 1 }, { axis: 0, sign: -1 },
    { axis: 1, sign: 1 }, { axis: 1, sign: -1 },
    { axis: 2, sign: 1 }, { axis: 2, sign: -1 },
  ]

  for (const { axis, sign } of faces) {
    const u = (axis + 1) % 3
    const v = (axis + 2) % 3
    const first = positions.length / 3

    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps; j += 1) {
        const a = (i / steps) * 2 - 1
        const b = (j / steps) * 2 - 1

        const point = []
        point[axis] = sign * half[axis]
        point[u] = a * half[u]
        point[v] = b * half[v]

        // Clamp into the inner box, then push back out by the radius.
        const held = point.map((value, k) => Math.max(-inner[k], Math.min(inner[k], value)))
        const away = point.map((value, k) => value - held[k])
        const length = Math.hypot(...away)
        const n = length > 1e-6 ? away.map((value) => value / length) : [0, 0, 0]
        n[axis] = length > 1e-6 ? n[axis] : sign

        positions.push(
          cx + held[0] + n[0] * r,
          cy + held[1] + n[1] * r,
          cz + held[2] + n[2] * r,
        )
        normals.push(n[0], n[1], n[2])
      }
    }

    const row = steps + 1
    for (let i = 0; i < steps; i += 1) {
      for (let j = 0; j < steps; j += 1) {
        const a = first + i * row + j
        const b = a + row
        // Wound so the face points outwards on both signs.
        if (sign > 0) indices.push(a, b, a + 1, a + 1, b, b + 1)
        else indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }

  return { positions, normals, indices }
}
