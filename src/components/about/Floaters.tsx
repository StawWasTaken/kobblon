import { Icon, type UiIcon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/cn'

/**
 * Staw's reactions, floating around a band.
 *
 * These are the only colour on the At Kobblon pages that is not brand
 * blue, and they are doing a job rather than decorating: a page about a
 * platform full of people should have some of those people's noise on it.
 * Scattered, not arranged - a neat row of them would read as a feature
 * list of available reactions.
 *
 * Three rules keep them from becoming clutter:
 *
 *   * **Behind everything and out of the way.** They are the band's
 *     background, never beside the text, and they never take a click.
 *   * **Gone on a phone.** There is no room beside a paragraph at 390
 *     pixels, and a reaction behind body text is a reaction on top of it.
 *   * **Still under reduced motion.** They stay where they are rather
 *     than bobbing.
 *
 * The colours come from `FACE_COLOUR` in the reactions bar rather than
 * from a value typed here. The drawings themselves are white line art -
 * `tone={null}` would put five white smudges on a dark page, and a yellow
 * written out here is the second yellow in the product the day somebody
 * changes the first one.
 *
 * Positions are written out rather than random, because random means the
 * one time it stacks two of them in the same corner nobody finds out
 * until it is on the site.
 */
/*
 * In the gutters, never in the column. `Lane` is six units wide inside a
 * window that is wider than that, so anything inside about eight per cent
 * of either edge is beside the text rather than behind it - which is the
 * difference between atmosphere and a face sitting on a heading.
 */
const SPOTS: { at: UiIcon; face: keyof typeof FACE_COLOUR; css: string; size: string; delay: string }[] = [
  { at: 'reaction-fire', face: 'fire', css: 'left-[2%] top-[14%]', size: 'h-11 w-11', delay: '0s' },
  { at: 'reaction-heart-eyes', face: 'heart-eyes', css: 'right-[3%] top-[9%]', size: 'h-12 w-12', delay: '0.9s' },
  { at: 'reaction-sunglasses', face: 'sunglasses', css: 'left-[5%] bottom-[12%]', size: 'h-10 w-10', delay: '1.8s' },
  { at: 'reaction-laugh', face: 'laugh', css: 'right-[6%] bottom-[18%]', size: 'h-11 w-11', delay: '2.6s' },
]

export function Floaters({ className }: { className?: string }) {
  const reduced = useReducedMotion()

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block', className)}
    >
      {SPOTS.map((one) => (
        <span
          key={one.at}
          style={reduced ? undefined : { animationDelay: one.delay }}
          className={cn('absolute opacity-70', one.css, !reduced && 'animate-bob')}
        >
          <Icon name={one.at} tone={FACE_COLOUR[one.face]} className={one.size} />
        </span>
      ))}
    </div>
  )
}
