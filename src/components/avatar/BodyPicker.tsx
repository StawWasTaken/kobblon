/*
 * The body, flat, as a thing you click on.
 *
 * Staw's shape: a row of named buttons is a list of words about a body, and
 * what somebody wants is to point at the leg they mean. So the parts are
 * drawn in the proportions the rig actually uses - read from `BODY`, not
 * drawn by eye, so a change to the rig moves this with it - and each one is
 * painted the colour it currently is. That makes the picker its own legend:
 * what you see here is what the avatar beside it looks like.
 *
 * More than one can be chosen at once, because "both arms and both legs the
 * same" is most of what anybody does and six trips through a swatch list to
 * say it is six trips too many.
 */
import { BODY, type BodyPart } from '@/engine'
import { cn } from '@/lib/cn'

/** The six, laid out as the body stands. Sizes come from the rig. */
const LAYOUT: { part: BodyPart; x: number; y: number }[] = (() => {
  const gap = 0.22
  const headY = 0
  const torsoY = headY + BODY.Head.h + gap
  const legY = torsoY + BODY.Torso.h + gap
  const armX = BODY.Torso.w / 2 + gap
  return [
    { part: 'Head', x: -BODY.Head.w / 2, y: headY },
    { part: 'Torso', x: -BODY.Torso.w / 2, y: torsoY },
    { part: 'LeftArm', x: -armX - BODY.LeftArm.w, y: torsoY },
    { part: 'RightArm', x: armX, y: torsoY },
    { part: 'LeftLeg', x: -BODY.LeftLeg.w - gap / 2, y: legY },
    { part: 'RightLeg', x: gap / 2, y: legY },
  ]
})()

/*
 * The box the whole thing sits in, worked out rather than written down: the
 * arms are the widest point and the legs the lowest, and both move when the
 * rig changes.
 */
const EDGE = 0.4
const LEFT = Math.min(...LAYOUT.map((one) => one.x)) - EDGE
const RIGHT = Math.max(...LAYOUT.map((one) => one.x + BODY[one.part].w)) + EDGE
const BOTTOM = Math.max(...LAYOUT.map((one) => one.y + BODY[one.part].h)) + EDGE

export const BODY_LABELS: Record<BodyPart, string> = {
  Head: 'Head', Torso: 'Torso', LeftArm: 'Left arm',
  RightArm: 'Right arm', LeftLeg: 'Left leg', RightLeg: 'Right leg',
}

export function BodyPicker({ colours, chosen, onChoose, className }: {
  /** What each part is now, so the picker shows the body rather than a key. */
  colours: Record<string, string>
  chosen: readonly BodyPart[]
  /** Called with the part pressed; the page decides what choosing means. */
  onChoose: (part: BodyPart) => void
  className?: string
}) {
  return (
    <svg
      viewBox={`${LEFT} ${-EDGE} ${RIGHT - LEFT} ${BOTTOM + EDGE}`}
      className={cn('w-full select-none', className)}
      role="group"
      aria-label="The parts of your body"
    >
      {LAYOUT.map(({ part, x, y }) => {
        const on = chosen.includes(part)
        return (
          <g key={part}>
            <rect
              x={x} y={y} width={BODY[part].w} height={BODY[part].h}
              rx={0.26}
              fill={colours[part] ?? '#8d95a6'}
              stroke={on ? '#3a50ff' : 'rgba(10,12,20,0.85)'}
              strokeWidth={on ? 0.22 : 0.1}
              className="cursor-pointer transition-[stroke] duration-150"
              onClick={() => onChoose(part)}
              role="checkbox"
              aria-checked={on}
              aria-label={BODY_LABELS[part]}
            >
              <title>{BODY_LABELS[part]}</title>
            </rect>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Whether a body would read as nobody wearing anything.
 *
 * Staw's rule, and his reason: Kobblon is less strict than the places it
 * grew up beside, and that is not the same as letting somebody walk around
 * as a single flat colour from head to foot. One colour everywhere is the
 * one shape that reads as bare skin whatever the colour is.
 *
 * Said here and said again in the database. This one only saves somebody the
 * round trip - the rule lives in `set_body_colours`, because a rule a page
 * keeps is a rule anybody with a console does not have.
 */
export function readsAsBare(colours: Record<string, string>): boolean {
  const all = (Object.keys(BODY) as BodyPart[]).map(
    (part) => (colours[part] ?? '').toLowerCase(),
  )
  return all.every((one) => one && one === all[0])
}
