/*
 * A word from Kobblon, across the top of the site.
 *
 * Staw: "announcements that display as a green topbar under the actual real
 * topbar (that you can close if u want)", and later: "be plain
 * green/blue/red/orange/white (the person who writes the announcement
 * decides of that) ... and also theres like stripes slightly transparent
 * for texture".
 *
 * So the colour is somebody's choice rather than a mood the site decides,
 * and it is the whole bar rather than a tint of it: a flat panel in that
 * colour, white words on it, and the diagonal stripes laid over the top at
 * low strength. The stripes are a gradient rather than an image, which is
 * worth saying because the obvious way to draw them is a PNG and a PNG
 * cannot be five colours.
 *
 * Three things are deliberate:
 *
 *   * **It is text and an address, never markup.** The notice is written by
 *     the house today; a line that is rendered as HTML is a line that can do
 *     anything tomorrow. The link is a separate field, checked in the
 *     database to be a path here or an https address - `javascript:` is the
 *     one that matters.
 *   * **Closing it is remembered in this browser**, by the notice's id. A
 *     table of who dismissed what is a row per person per notice to record
 *     something nobody will ever ask about - and a notice that comes back
 *     when you reload is a notice people learn to hate. Two can be up at
 *     once, so what is remembered is a small list rather than one id.
 *   * **Two is the ceiling and the database holds it.** This draws what it
 *     is handed.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faXmark, faBullhorn } from '@fortawesome/free-solid-svg-icons'
import { noticesNow, type NoticeColour, type SiteNotice } from '@/lib/api'
import { cn } from '@/lib/cn'

const CLOSED = 'kobblon.notice.closed'

/** The ids closed in this browser. A short list; two can be up at once. */
function alreadyClosed(): string[] {
  try {
    const held = JSON.parse(localStorage.getItem(CLOSED) ?? '[]')
    return Array.isArray(held) ? held.filter((one) => typeof one === 'string') : []
  } catch {
    // Private windows, blocked storage and the single id the old version
    // wrote all land here, and showing the notice is the right answer when
    // we cannot tell.
    return []
  }
}

function rememberClosed(id: string) {
  try {
    // Only the last few, so this cannot grow for ever on a browser that has
    // been here a year.
    localStorage.setItem(CLOSED, JSON.stringify([...alreadyClosed(), id].slice(-20)))
  } catch { /* nothing to do */ }
}

/*
 * Flat colour, and the words on it chosen to be readable on that colour
 * rather than on the dark behind it. White is the one that takes dark text,
 * which is the whole reason it is a map and not a hue.
 */
export const noticeColours: Record<NoticeColour, { panel: string; ink: string; stripe: string }> = {
  green:  { panel: 'bg-space',        ink: 'text-white',  stripe: 'rgba(255,255,255,0.10)' },
  blue:   { panel: 'bg-brand',        ink: 'text-white',  stripe: 'rgba(255,255,255,0.10)' },
  red:    { panel: 'bg-danger',       ink: 'text-white',  stripe: 'rgba(255,255,255,0.10)' },
  orange: { panel: 'bg-[#F08A24]',    ink: 'text-white',  stripe: 'rgba(255,255,255,0.12)' },
  white:  { panel: 'bg-[#F4F4F6]',    ink: 'text-ink',    stripe: 'rgba(0,0,0,0.055)' },
}

/* A notice written before the colours existed still has to be a colour. */
const oldNames: Record<string, NoticeColour> = {
  good: 'green', warn: 'orange', plain: 'white',
}

const colourOf = (tone: string): NoticeColour =>
  tone in noticeColours ? tone as NoticeColour : oldNames[tone] ?? 'blue'

/**
 * The stripes. 45 degrees, the same width apart the whole way across, and
 * drawn with a hard stop between each band so they are stripes rather than
 * a smear.
 */
export function noticeStripes(colour: string) {
  return `repeating-linear-gradient(135deg, ${colour} 0 14px, transparent 14px 28px)`
}

/** One of them, drawn where it is put. The bar fixes the stack, not this. */
export function NoticeLine({ notice, onClose }: { notice: SiteNotice; onClose?: () => void }) {
  const look = noticeColours[colourOf(notice.tone)]
  const words = notice.link_words || 'Have a look'
  const outside = notice.link?.startsWith('https://')

  return (
    <div className={cn('relative overflow-hidden', look.panel, look.ink)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: noticeStripes(look.stripe) }}
      />
      <div className="relative flex items-center gap-3 px-4 py-2.5 pr-12 text-sm sm:px-6 sm:pr-14">
        <Glyph icon={faBullhorn} className="shrink-0 text-sm opacity-80" />
        <p className="min-w-0 flex-1 font-semibold">
          {notice.body}
          {notice.link && (
            outside ? (
              <a
                href={notice.link}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-2 font-bold underline underline-offset-2"
              >
                {words}
              </a>
            ) : (
              <Link to={notice.link} className="ml-2 font-bold underline underline-offset-2">
                {words}
              </Link>
            )
          )}
        </p>
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close this notice"
          className={cn(
            'absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg transition-colors sm:right-3',
            look.ink === 'text-ink' ? 'hover:bg-black/10' : 'hover:bg-white/20',
          )}
        >
          <Glyph icon={faXmark} />
        </button>
      </div>
    </div>
  )
}

/*
 * How much of the top of the page the notices are using.
 *
 * Staw: "the announcement topbar shall follow the topbar (like as if its
 * apart of it)", and then: "its going ontop of the sidebar i want it to
 * stop at the sidebar ... i want the topbars to push the page under
 * itself". So it is fixed under the real bar rather than sitting at the top
 * of the page and scrolling away with it; it starts where the rail ends, so
 * the rail runs the full height of the window under the bar and the notice
 * sits beside it rather than over it; and once it is fixed, it covers
 * whatever is behind it unless everything below knows how tall it is. One can be up, or two, or none, and closing one changes it while
 * the page is open, so a number written into a class would be wrong within
 * a second of being right. The shell reads this variable instead.
 */
const HEIGHT = '--notice-height'

export function NoticeBar() {
  const [notices, setNotices] = useState<SiteNotice[]>([])
  const box = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let live = true
    void noticesNow()
      .then((found) => {
        if (!live) return
        const closed = alreadyClosed()
        setNotices(found.filter((one) => !closed.includes(one.id)))
      })
      .catch(() => {})
    return () => { live = false }
  }, [])

  /*
   * Measured rather than counted: a long notice wraps to two lines on a
   * phone, and the page below has to start under where it actually ends.
   */
  useEffect(() => {
    const here = box.current
    const root = document.documentElement
    if (!here) {
      root.style.setProperty(HEIGHT, '0px')
      return
    }
    const measure = () => root.style.setProperty(HEIGHT, `${here.offsetHeight}px`)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(here)
    return () => {
      watch.disconnect()
      root.style.setProperty(HEIGHT, '0px')
    }
  }, [notices.length])

  if (!notices.length) return null

  return (
    <div
      ref={box}
      className="fixed right-0 top-14 z-30 divide-y divide-black/10 shadow-lg shadow-black/20 left-0 lg:left-56"
    >
      {notices.map((one) => (
        <NoticeLine
          key={one.id}
          notice={one}
          onClose={() => {
            rememberClosed(one.id)
            setNotices((held) => held.filter((other) => other.id !== one.id))
          }}
        />
      ))}
    </div>
  )
}
