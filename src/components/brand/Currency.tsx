import { currency } from '@/lib/currency'
import { Icon } from '@/components/brand/Icon'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The Brix mark.
 *
 * Staw: "i hope that youre truly using the brix icon cuz i dont want you to
 * reproduce it and use the reproduction i want you to use the original
 * image". It was a reproduction - a hand-drawn `<svg>` of a two stud brick,
 * close enough that nobody caught it, and not his drawing. It is his file
 * now, and the only one: every price on the site draws this.
 *
 * Drawn as a picture rather than a glyph, so it keeps its own colours. The
 * one place that cannot have them is a button whose text is a single colour
 * and whose background may be anything - `tone` is there for that, and
 * paints the mark as a mask so the shape is exact.
 */
export function CurrencyMark({ tone, className }: {
  tone?: string
  className?: string
}) {
  return (
    <Icon
      name="brix"
      tone={tone}
      className={cn('h-[1em] w-[1em]', className)}
    />
  )
}

/** A price: the mark, then the number, then nothing else. */
export function Price({
  amount, free = 'Free', className, markClassName,
}: {
  amount: number
  /** What nothing costs. Some places say Free, some say Take it. */
  free?: string
  className?: string
  markClassName?: string
}) {
  if (!amount) return <span className={className}>{free}</span>

  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={currency.amount(amount)}
    >
      <CurrencyMark className={markClassName ?? 'h-[0.9em] w-[0.9em]'} />
      {formatCount(amount)}
    </span>
  )
}
