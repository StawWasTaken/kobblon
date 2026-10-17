import { useState } from 'react'
import { Logomark } from '@/components/brand/Wordmark'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * The wait, with Staw's reveal on it.
 *
 * Two marks in one place: the logomark, which is an inline drawing and is
 * therefore already here, and the reveal, which is half a megabyte of GIF
 * and is not. The reveal fades in over the logomark the moment it has
 * loaded and the logomark fades out under it. A wait that is over in 200ms
 * shows the still mark and nothing flickers; a wait long enough to notice
 * gets the animation, which is when it is worth having.
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
    <span className={cn('grid place-items-center', className)}>
      <Logomark
        className={cn(
          'col-start-1 row-start-1 h-10 transition-opacity duration-200',
          drawing ? 'opacity-0' : 'animate-bob opacity-100',
        )}
      />
      <img
        src={asset('/brand/logo-reveal.gif')}
        alt=""
        width={420}
        height={215}
        className={cn(
          'col-start-1 row-start-1 h-40 w-auto select-none transition-opacity duration-200',
          drawing ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={() => setDrawing(true)}
      />
    </span>
  )
}
