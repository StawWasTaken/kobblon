import { useEffect, useState } from 'react'
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
  quiet = false,
}: {
  label?: string
  className?: string
  /**
   * Hold the mark back for half a second.
   *
   * A page of this site arrives in a couple of hundred milliseconds once
   * the document is up, and a four-second reveal started and killed inside
   * that window reads as a glitch rather than as a wait. So a wait inside
   * the site shows nothing until it is long enough to be worth saying
   * something about. The document's own wait is never quiet: it is the
   * one Staw wants the film to play right through.
   */
  quiet?: boolean
}) {
  const show = useAfterAMoment(quiet ? 500 : 0)

  return (
    <div className={cn('grid min-h-dvh place-items-center bg-ink px-6', className)}>
      <div className="flex flex-col items-center">
        {show && <LoadingMark />}
        <span className="sr-only">{label}</span>
        {show && <TakingTooLong />}
      </div>
    </div>
  )
}

/** True once `ms` has gone by, and straight away when there is nothing to wait for. */
function useAfterAMoment(ms: number) {
  const [yet, setYet] = useState(ms === 0)

  useEffect(() => {
    if (ms === 0) return
    const timer = window.setTimeout(() => setYet(true), ms)
    return () => window.clearTimeout(timer)
  }, [ms])

  return yet
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

/**
 * A way out of a wait that is not going to end.
 *
 * A loading screen with nothing behind it is the worst thing this site can
 * show, because it looks like it is working. Staw: "you refresh and the
 * page doesn't load any more". The causes are fixed where they are - a
 * rejected session read, a request that never answers - but a screen that
 * waits for ever should also be able to say so, because the next cause
 * will be a different one.
 */
function TakingTooLong() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12_000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!slow) return null

  return (
    <div className="mt-6 max-w-sm text-center">
      <p className="text-sm text-muted">
        This is taking longer than it should. Loading the page again usually
        fixes it.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white"
      >
        Load it again
      </button>
    </div>
  )
}
