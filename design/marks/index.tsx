/*
 * Every sort of thing a World holds, drawn.
 *
 * In `design/` because that is the one directory both windows already
 * vendor, beside the preset and the tokens. They were drawn in the
 * Workspace, which is the only place a World tree is shown today, and they
 * live here so that the day the website shows one there is no second set -
 * which is what a shared Button was, right up until it was not.
 *
 * The Explorer used a general icon set, and a general icon set does not have
 * a lattice beam, a wedge, a spawn point or a soundservice - so several rows
 * shared a mark and the tree stopped being readable at a glance, which is
 * the only thing a tree icon is for. Staw asked for each element to have its
 * own, twice, and he was right the first time.
 *
 * One file, one weight, one language: a 16 unit box, a single stroke of
 * `currentColor`, no fill, nothing that needs a gradient or a second colour
 * to be understood. They are drawn as the thing seen in three quarter view
 * where that reads, and as a plain symbol where it does not - a sound is not
 * a shape, so it is not drawn as one.
 *
 * `currentColor` matters: a selected row tints its mark with everything else
 * rather than staying the one bright thing on a blue band.
 *
 * Neoclassic the way the rest of Kobblon is - primitive, few lines, and
 * legible at twelve pixels because that is the size it is actually used at.
 */

type MarkProps = { className?: string }

/* The one set of attributes every mark shares, so they cannot drift apart a
   stroke at a time. */
function Mark({ children, className }: MarkProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

/* ------------------------------------------------------------- the shapes */

/** A Part: a box in three quarter view, which is what a part is. */
export const PartMark = (p: MarkProps) => (
  <Mark {...p}>
    <path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7z" />
    <path d="M2.5 4.5L8 7.5l5.5-3M8 7.5v7" />
  </Mark>
)

/** A Wedge: the ramp, seen from the side it rises towards. */
export const WedgeMark = (p: MarkProps) => (
  <Mark {...p}>
    <path d="M2 13L13 3v10z" />
    <path d="M13 3l-2.5 1.5M2 13h11" />
  </Mark>
)

/** A Cylinder: the barrel, with the ellipse that says it is round. */
export const CylinderMark = (p: MarkProps) => (
  <Mark {...p}>
    <path d="M3.5 4v8M12.5 4v8" />
    <ellipse cx="8" cy="4" rx="4.5" ry="2" />
    <path d="M3.5 12a4.5 2 0 0 0 9 0" />
  </Mark>
)

/** A Sphere: a circle with the one line that stops it being a circle. */
export const SphereMark = (p: MarkProps) => (
  <Mark {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M2.4 6.2a9 9 0 0 0 11.2 0" />
  </Mark>
)

/**
 * A Truss: the lattice, in the fewest lines that still read as one.
 *
 * Two uprights, a ring at each bay line, and an X in every bay. The bracing
 * is the whole idea - it is what makes this a truss rather than a ladder -
 * so it carries full weight and the rungs would go first if this ever had
 * to be smaller.
 *
 * It was a single zigzag and read as a letter Z at any size above a tree
 * row. Crossed bracing reads as a lattice, which is what it is.
 */
export const TrussMark = (p: MarkProps) => (
  <Mark {...p}>
    <path d="M4 2v12M12 2v12" />
    <path d="M4 2h8M4 8h8M4 14h8" />
    <path d="M4 2l8 6M12 2l-8 6M4 8l8 6M12 8l-8 6" />
  </Mark>
)

/**
 * A MeshPart: a shape made of triangles, which is true of every mesh and of
 * nothing else here.
 *
 * Deliberately not the box. A Part is a box and a MeshPart is not a Part
 * with extras - it has geometry where a Part has a shape, and the mark
 * should be saying that before anybody reads the label.
 *
 * The first attempt was a hexagon with three lines out of its middle, which
 * is exactly how the Part cube is drawn, so the two read as the same thing
 * at every size. This one is an irregular solid with chords across it: the
 * silhouette is not a box and the lines inside do not meet in the middle.
 */
export const MeshMark = (p: MarkProps) => (
  <Mark {...p}>
    <path d="M8 1.8L12.6 4l1.4 4.8-3 4.2-5.4.4L2.2 9.6 2.8 4.4z" />
    <path d="M2.8 4.4L11 13M12.6 4L5.6 13.4M2.2 9.6L12.6 4" />
  </Mark>
)

/* ------------------------------------------------- what goes on the shapes */

/** A Decal: a picture, which is a frame with something in it. */
export const DecalMark = (p: MarkProps) => (
  <Mark {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <circle cx="5.75" cy="6.5" r="1" />
    <path d="M2.5 11.5l3.5-3 2.5 2 2-1.5 3 2.5" />
  </Mark>
)

/**
 * A Texture: the same picture, tiled.
 *
 * Four of it rather than one, because repeating is the entire difference
 * between the two and the tree is where somebody tells them apart.
 */
export const TextureMark = (p: MarkProps) => (
  <Mark {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </Mark>
)

/** A Light: a bulb throwing light, drawn as the throwing. */
export const LightMark = (p: MarkProps) => (
  <Mark {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8" />
    <path d="M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" />
  </Mark>
)

/**
 * A Sound: waves leaving something, without the speaker.
 *
 * A sound is not a shape, so it is not drawn as one. The arcs are the part
 * that means "this makes noise"; a speaker cabinet would be drawing the
 * hardware rather than the thing.
 */
export const SoundMark = (p: MarkProps) => (
  <Mark {...p}>
    <path d="M3 6.25h2.25L8.5 3.5v9L5.25 9.75H3z" />
    <path d="M11 6a3.2 3.2 0 0 1 0 4" />
    <path d="M13 4a6 6 0 0 1 0 8" />
  </Mark>
)

/** SoundService: the World's own sound, so the waves come off the World. */
export const SoundServiceMark = (p: MarkProps) => (
  <Mark {...p}>
    <circle cx="6" cy="8" r="4" />
    <path d="M2.2 6.6h7.6M2.2 9.4h7.6M6 4a7 7 0 0 0 0 8M6 4a7 7 0 0 1 0 8" />
    <path d="M12.4 5.6a4 4 0 0 1 0 4.8" />
  </Mark>
)

/* --------------------------------------------------------- the furniture */

/** A Group: things stacked, which is what a group is. */
export const GroupMark = (p: MarkProps) => (
  <Mark {...p}>
    <path d="M8 1.8l5.5 2.7L8 7.2 2.5 4.5z" />
    <path d="M2.5 8L8 10.7 13.5 8" />
    <path d="M2.5 11.5L8 14.2l5.5-2.7" />
  </Mark>
)

/**
 * Spawn: where somebody arrives.
 *
 * A ring on the ground with an arrow coming down into it. Drawn as the place
 * rather than as a person, because the thing in the tree is the spot and not
 * whoever is standing on it.
 */
export const SpawnMark = (p: MarkProps) => (
  <Mark {...p}>
    <ellipse cx="8" cy="11.5" rx="5.5" ry="2.5" />
    <path d="M8 2v6" />
    <path d="M5.75 6L8 8.25 10.25 6" />
  </Mark>
)

/**
 * The World itself: the ground and what is above it.
 *
 * A globe would say "the internet". This says "a place with a sky", which is
 * what a World is and what the row at the top of the tree stands for.
 */
export const WorldMark = (p: MarkProps) => (
  <Mark {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M2.2 9.5h11.6" />
    <path d="M5.2 3a8 8 0 0 0 0 10M10.8 3a8 8 0 0 1 0 10" />
  </Mark>
)
