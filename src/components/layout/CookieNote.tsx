import { useState } from 'react'
import { Link } from 'react-router-dom'
import { faCookieBite } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'

/*
 * The storage note, in the bottom left corner.
 *
 * One card for the whole of the At Kobblon side and the landing page, which
 * is why it lives here rather than in any of them: it is the same sentence
 * on every page it appears on, and a second copy of it would be a second
 * wording within a month.
 *
 * What it says is what the site actually does. Kobblon sets no cookies of
 * its own and no advertising or tracking cookies at all - the session, the
 * theme, the basket and a handful of "you have already seen this" marks sit
 * in the browser's own storage, on the device, and are never sent anywhere.
 * So the card tells somebody that rather than asking them to consent to
 * tracking that does not happen, and it does not pretend to offer a
 * choice: there is nothing to switch off, because none of it is set for
 * anybody's benefit but the visitor's.
 *
 * Dismissal is kept in the same storage the card is about, which is the
 * joke and also the only honest place for it. A private window, or storage
 * the visitor has blocked, means the card comes back - that is correct, and
 * every read and write here is wrapped because both of those throw.
 */
const SAID = 'kob.cookies.read'

function alreadyRead() {
  try {
    return localStorage.getItem(SAID) === '1'
  } catch {
    return false
  }
}

export function CookieNote() {
  const [read, setRead] = useState(alreadyRead)

  if (read) return null

  const close = () => {
    try { localStorage.setItem(SAID, '1') } catch { /* private windows */ }
    setRead(true)
  }

  return (
    <aside
      aria-label="How Kobblon uses your browser's storage"
      className="fixed bottom-4 left-4 z-50 w-[min(calc(100vw-2rem),20rem)] rounded-3xl border border-white/10 bg-ink-card/95 p-4 shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)] backdrop-blur-xl sm:bottom-6 sm:left-6"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-brand/20 text-brand-bright">
          <Glyph icon={faCookieBite} className="text-base" />
        </span>
        <p className="font-display text-base font-extrabold leading-tight">
          We use cookies
        </p>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-white/60">
        Only the kind that keeps you signed in and remembers what you
        picked. Nothing for advertisers, nothing that follows you elsewhere.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={close}>Okay</Button>
        <Link
          to="/policies/privacy"
          className="text-[13px] font-bold text-white/50 transition-colors hover:text-brand-bright"
        >
          Privacy policy
        </Link>
      </div>
    </aside>
  )
}
