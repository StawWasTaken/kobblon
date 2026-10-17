import { Wordmark } from '@/components/brand/Wordmark'
import type { Appearance } from '@/lib/appearances'
import { cn } from '@/lib/cn'

/**
 * What the site looks like wearing one, drawn small.
 *
 * Staw, of the first version: "the appearance system just sucks". Part of
 * that was the swatch - a strip of the bar's colour with the wordmark on
 * it, which tells somebody the bar is orange and nothing else. An
 * appearance now reaches the cards, the lines and the links as well, and
 * the only honest way to show that is to draw the page.
 *
 * So this is the page: the bar, the rail with a selected entry on it, two
 * cards and the buttons. Nothing here is a picture - it is the real tokens
 * on real elements, inside `data-appearance`, which means it cannot drift
 * from the site the way a screenshot of it would. It is also why the
 * buttons are in: brand blue and Space green sit in the drawing looking
 * exactly as they do everywhere else, which is the promise that a season
 * does not touch them.
 *
 * `data-theme` is not set here. The preview is in the mode the person is
 * actually in, because an appearance and the mode apply at once and showing
 * them the dark one while they sit in daylight would be a lie about what
 * pressing it does.
 */
export function AppearancePreview({ which, className }: { which: Appearance; className?: string }) {
  return (
    <span
      data-appearance={which}
      className={cn('block select-none overflow-hidden bg-ink', className)}
      aria-hidden="true"
    >
      <span className="flex h-7 items-center justify-between bg-chrome px-2">
        <Wordmark to={null} always className="h-3" />
        <span className="h-3 w-3 rounded-full bg-onbrand/25" />
      </span>

      <span className="flex h-[4.5rem]">
        <span className="flex w-1/4 flex-col gap-1 bg-chrome p-1.5">
          <span className="h-2 rounded-full bg-brand" />
          <span className="h-2 rounded-full bg-onbrand/20" />
          <span className="h-2 w-3/4 rounded-full bg-onbrand/20" />
        </span>

        <span className="flex flex-1 flex-col gap-1.5 p-2">
          <span className="flex flex-1 flex-col justify-center gap-1 rounded-md border border-ink-line bg-ink-card p-1.5">
            <span className="h-1.5 w-2/3 rounded-full bg-white/70" />
            <span className="h-1.5 w-1/2 rounded-full bg-muted/60" />
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-8 rounded-full bg-brand" />
            <span className="h-3 w-6 rounded-full bg-space" />
            <span className="ml-auto h-1.5 w-8 rounded-full bg-link/70" />
          </span>
        </span>
      </span>
    </span>
  )
}
