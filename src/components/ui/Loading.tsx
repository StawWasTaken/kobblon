import { useState } from 'react'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * The wait, with Staw's reveal on it.
 *
 * One mark. It had the still logomark underneath, fading out as the GIF
 * faded in, so that a wait too short to matter showed something rather than
 * nothing - and that was wrong on both counts Staw found: the blue mark was
 * what you actually saw on a quick load, and the two drawings are not the
 * same shape in the same box, so while both were up the logomark sat beside
 * the reveal rather than under it.
 *
 * So the reveal alone, faded in on `load` against the same dark the page is
 * going to be anyway. `app.html` preloads it, so by the time anything
 * React draws is waiting on something, it is in the cache.
 *
 * Nothing here needs a provider, a router or a session, so an application
 * can mount it on its own. `tools/site/loading-preview.html` is that, and
 * it is the check: if this ever grows a hook that needs the website around
 * it, that page goes blank and says so before a panel does.
 */
export function LoadingScreen({
  label = 'Loading Kobblon',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={cn('grid min-h-dvh place-items-center bg-ink', className)}>
      <LoadingMark />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** The mark on its own, for a wait inside a page rather than instead of one. */
export function LoadingMark({ className }: { className?: string }) {
  const [drawing, setDrawing] = useState(false)

  return (
    <img
      src={asset('/brand/logo-reveal.gif')}
      alt=""
      width={420}
      height={215}
      className={cn(
        'h-40 w-auto select-none transition-opacity duration-200',
        drawing ? 'opacity-100' : 'opacity-0',
        className,
      )}
      onLoad={() => setDrawing(true)}
    />
  )
}
