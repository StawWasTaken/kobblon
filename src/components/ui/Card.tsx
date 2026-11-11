import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A card: a block with a thickness, not a rectangle with a hairline.
 *
 * Staw: "instead of thin strokes, we want thick strokes, and a more
 * gamification about stuff". Three things carry that here and they work
 * together, so changing one on its own looks like a mistake:
 *
 *   * **A stroke you can see.** `border-2` on a line colour that was lifted
 *     at the same time. The old one was a 1px hairline barely a shade off
 *     the card it bounded, which is why the page read as a dashboard.
 *   * **A front face.** The bottom stroke is 4px where the others are 2, so
 *     the card reads as a block seen slightly from above rather than as an
 *     outline. This started life as a hard offset shadow - a brick's side
 *     face, no blur - and that version was drawn, looked at and thrown
 *     away: on a page this close to black there is nothing darker to put
 *     under a card, and the two were indistinguishable side by side. A
 *     thicker bottom edge is the same idea in the one form a dark page can
 *     actually show, and it is what the buttons have always done.
 *   * **Corners a brick could have.** `xl` rather than `2xl`: still round,
 *     no longer a pill.
 *
 * It does not lift on hover, because most cards here are not buttons. A
 * card that is one adds `hover:-translate-y-0.5`, which is the block being
 * picked up rather than fading.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 border-b-4 border-ink-line bg-ink-card',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-extrabold">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
