import { cn } from '@/lib/cn'

/**
 * The pixel grid, as a still.
 *
 * `PixelField` is a canvas with two waves running through it and it earns
 * that at the top of a page, where it is the one thing moving. Putting a
 * second and a third canvas inside cards further down the same page is how
 * a page starts dropping frames on a laptop, and it is also how the motif
 * stops meaning anything - a pattern that is everywhere is wallpaper.
 *
 * So this is the same grid, drawn with two repeating gradients and costing
 * nothing: fourteen pixel cells, two apart, brand blue, faded out along
 * whichever edge the caller names. It is Kobblon's texture, used the way a
 * texture should be - in the corner of a thing, under the content, at an
 * opacity you notice only when it is missing.
 */
export function PixelGrid({ from = 'top-left', className }: {
  /** Which corner the cells come from before they fade away. */
  from?: 'top-left' | 'top-right' | 'bottom-right'
  className?: string
}) {
  const fades = {
    'top-left': 'radial-gradient(120% 120% at 0% 0%, #000 0%, transparent 62%)',
    'top-right': 'radial-gradient(120% 120% at 100% 0%, #000 0%, transparent 62%)',
    'bottom-right': 'radial-gradient(120% 120% at 100% 100%, #000 0%, transparent 62%)',
  }

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 opacity-[0.55]', className)}
      style={{
        backgroundImage:
          'repeating-linear-gradient(to right, rgba(58,80,255,0.22) 0 12px, transparent 12px 14px),'
          + 'repeating-linear-gradient(to bottom, rgba(58,80,255,0.22) 0 12px, transparent 12px 14px)',
        backgroundSize: '14px 14px',
        WebkitMaskImage: fades[from],
        maskImage: fades[from],
      }}
    />
  )
}
