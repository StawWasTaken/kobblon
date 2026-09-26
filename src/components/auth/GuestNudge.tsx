import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { asset } from '@/lib/asset'

/*
 * A word to somebody looking around as a guest.
 *
 * A guest account is real — it has their name, their friends, whatever they
 * have made — but it has no email and no password, so it lives in this
 * browser and nowhere else. Clear the browser, or come back on a phone, and
 * it is gone with everything in it. That is worth saying out loud, once in a
 * while, rather than the day it happens.
 *
 * The shape is the one from opening a World, because somebody has seen that
 * one already and will not read a new kind of box. What it says is true:
 * keeping the account keeps everything, which is what `claimAccount` does,
 * and the things it lists as locked are the things `GuestGate` actually
 * locks today.
 */

/** Left alone for this long after arriving, before the first word. */
const FIRST = 4 * 60 * 1000
/** And this long between one and the next, however many pages they open. */
const AGAIN = 25 * 60 * 1000

/*
 * Remembered in the browser, because that is exactly as long as the guest
 * account itself lasts: a nudge nobody can escape is worse than no nudge,
 * and a nudge that forgets it spoke is the same thing wearing a hat.
 */
const SAID = 'kobblon.guest.nudged'

const lastSaid = () => {
  try {
    return Number(window.localStorage.getItem(SAID) ?? 0)
  } catch {
    // A browser with storage turned off gets one nudge a page and no more.
    return Date.now()
  }
}

const rememberSaid = () => {
  try {
    window.localStorage.setItem(SAID, String(Date.now()))
  } catch {
    // Nothing to be done, and nothing worth breaking a page over.
  }
}

export function GuestNudge() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  const guest = profile?.is_guest === true
  // Not while they are already in the middle of making one.
  const busy = pathname.startsWith('/signup') || pathname.startsWith('/login')

  useEffect(() => {
    if (!guest || busy) return

    const since = Date.now() - lastSaid()
    const wait = lastSaid() === 0 ? FIRST : Math.max(AGAIN - since, 0)

    const timer = window.setTimeout(() => {
      setOpen(true)
      rememberSaid()
    }, wait)

    return () => window.clearTimeout(timer)
  }, [guest, busy])

  if (!open || !guest) return null

  const close = () => setOpen(false)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-ink-line bg-ink-card p-7 text-center shadow-pop animate-pop-in">
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <img src={asset('/brand/favicon.png')} alt="" className="mx-auto h-14 w-14 rounded-2xl" />

        <h2 className="mt-4 font-display text-lg text-white">Keep what you have made</h2>

        <p className="mt-2 text-sm leading-relaxed text-white/65">
          You are looking around as a guest. This account has no email and no password,
          so it lives in this browser only — clear it, or come back on another machine,
          and everything in it is gone.
        </p>

        <ul className="mt-4 space-y-1.5 text-left text-sm text-white/65">
          <li className="flex gap-2">
            <span className="text-space-bright">•</span>
            Keeping it keeps everything: your name, your friends, your Worlds.
          </li>
          <li className="flex gap-2">
            <span className="text-space-bright">•</span>
            And it unlocks what guests cannot do — uploading to Create, making a
            Community, buying things, redeeming codes.
          </li>
        </ul>

        <div className="mt-6 space-y-2">
          <Button to="/signup" size="lg" block onClick={close}>
            Make it an account
          </Button>
          <Button variant="ghost" block onClick={close}>
            Not now
          </Button>
        </div>

        <p className="mt-3 text-xs text-white/40">
          It takes a name, a birthday and a password. Nothing you have done is lost.
        </p>
      </div>
    </div>
  )
}
