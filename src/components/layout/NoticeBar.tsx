/*
 * A word from Kobblon, across the top of the site.
 *
 * Staw: "announcements that display as a green topbar under the actual real
 * topbar (that you can close if u want)".
 *
 * Two things are deliberate:
 *
 *   * **It is text and an address, never markup.** The notice is written by
 *     the house today; a line that is rendered as HTML is a line that can do
 *     anything tomorrow. The link is a separate field, checked in the
 *     database to be a path here or an https address - `javascript:` is the
 *     one that matters.
 *   * **Closing it is remembered in this browser**, by the notice's id. A
 *     table of who dismissed what is a row per person per notice to record
 *     something nobody will ever ask about - and a notice that comes back
 *     when you reload is a notice people learn to hate.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faBullhorn } from '@fortawesome/free-solid-svg-icons'
import { noticeNow, type SiteNotice } from '@/lib/api'
import { cn } from '@/lib/cn'

const CLOSED = 'kobblon.notice.closed'

const closedAlready = (id: string) => {
  try {
    return localStorage.getItem(CLOSED) === id
  } catch {
    // Private windows and blocked storage both land here, and showing the
    // notice is the right answer when we cannot tell.
    return false
  }
}

const tones: Record<SiteNotice['tone'], string> = {
  good: 'border-space/40 bg-space/15 text-space-bright',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  plain: 'border-ink-line bg-ink-card text-white/80',
}

export function NoticeBar() {
  const [notice, setNotice] = useState<SiteNotice | null>(null)

  useEffect(() => {
    let live = true
    void noticeNow()
      .then((found) => {
        if (!live) return
        if (found && !closedAlready(found.id)) setNotice(found)
      })
      .catch(() => {})
    return () => { live = false }
  }, [])

  if (!notice) return null

  const close = () => {
    try { localStorage.setItem(CLOSED, notice.id) } catch { /* nothing to do */ }
    setNotice(null)
  }

  const words = notice.link_words || 'Have a look'
  const outside = notice.link?.startsWith('https://')

  return (
    <div className={cn('border-b px-4 py-2 text-sm', tones[notice.tone])}>
      <div className="mx-auto flex max-w-[86rem] items-center gap-3">
        <FontAwesomeIcon icon={faBullhorn} className="shrink-0 text-xs" />
        <p className="min-w-0 flex-1">
          <span className="font-bold">{notice.body}</span>
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
          onClick={close}
          aria-label="Close this notice"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/10"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>
    </div>
  )
}
