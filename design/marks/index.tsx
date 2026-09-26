/*
 * Every sort of thing a World holds, drawn by Staw.
 *
 * In `design/` because that is the one directory both windows already
 * vendor, beside the preset and the tokens, so there is never a second set -
 * which is what a shared Button was, right up until it was not.
 *
 * ## Whose these are
 *
 * Staw's. They were a monochrome stroke set I drew, and that was the wrong
 * call about whose job it is: the marks are part of Kobblon's identity
 * rather than a utility detail, and he has a style for them. **When a new
 * element is added, ask him for its mark rather than drawing a placeholder.**
 *
 * ## Why they are pictures rather than paths
 *
 * They arrived as artwork rather than as source, so each is his drawing at
 * 64 across - four times the largest size a tree row ever uses, which keeps
 * them crisp on a dense screen, and a twentieth of the weight they came at.
 * If the drawing files ever arrive, these become paths and nothing that
 * imports this file has to change.
 *
 * The consequence worth knowing: these are full colour and do not take the
 * colour of the row they sit on, so a selected row keeps its mark in red,
 * green and blue over the selection. That is how Studio's tree looks too.
 */

import cylinder from './art/cylinder.png'
import decal from './art/decal.png'
import group from './art/group.png'
import light from './art/light.png'
import meshpart from './art/meshpart.png'
import part from './art/part.png'
import sound from './art/sound.png'
import soundservice from './art/soundservice.png'
import sphere from './art/sphere.png'
import texture from './art/texture.png'
import truss from './art/truss.png'
import wedge from './art/wedge.png'
import world from './art/world.png'

type MarkProps = { className?: string }

/*
 * One picture, at the size of the text beside it.
 *
 * `1.15em` rather than `1em`: these are drawings with their own margins
 * inside the square, so matching the line's height exactly leaves them
 * visibly smaller than the words they sit against.
 */
/*
 * Decorative, and it has to say so.
 *
 * The first version gave each picture an `aria-label` naming the element,
 * which reads well on its own and is wrong in place: a row's name is built
 * from everything inside it, so every row became "Part Part" and nothing
 * could be found by the name it shows. The row's own text already says what
 * it is; the mark is there to be recognised, not read.
 */
function Art({ src, className }: MarkProps & { src: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ width: '1.15em', height: '1.15em', objectFit: 'contain' }}
    />
  )
}

/* ------------------------------------------------------------- the shapes */

export const PartMark = (p: MarkProps) => <Art {...p} src={part} />
export const WedgeMark = (p: MarkProps) => <Art {...p} src={wedge} />
export const CylinderMark = (p: MarkProps) => <Art {...p} src={cylinder} />
export const SphereMark = (p: MarkProps) => <Art {...p} src={sphere} />
export const TrussMark = (p: MarkProps) => <Art {...p} src={truss} />
export const MeshMark = (p: MarkProps) => <Art {...p} src={meshpart} />

/* ------------------------------------------------- what goes on the shapes */

export const DecalMark = (p: MarkProps) => <Art {...p} src={decal} />
export const TextureMark = (p: MarkProps) => <Art {...p} src={texture} />
export const LightMark = (p: MarkProps) => <Art {...p} src={light} />
export const SoundMark = (p: MarkProps) => <Art {...p} src={sound} />
export const SoundServiceMark = (p: MarkProps) => <Art {...p} src={soundservice} />

/* --------------------------------------------------------- the furniture */

export const GroupMark = (p: MarkProps) => <Art {...p} src={group} />
export const WorldMark = (p: MarkProps) => <Art {...p} src={world} />

/**
 * Spawn, which has no drawing yet.
 *
 * Kept as the stroke it was rather than borrowing one of the others, so it
 * is visibly the odd one out until Staw draws it - a mark that looked
 * finished would be a mark nobody remembers to replace.
 */
export const SpawnMark = ({ className }: MarkProps) => (
  <svg
    viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor"
    strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" className={className}
  >
    <ellipse cx="8" cy="11.5" rx="5.5" ry="2.5" />
    <path d="M8 2v6" />
    <path d="M5.75 6L8 8.25 10.25 6" />
  </svg>
)
