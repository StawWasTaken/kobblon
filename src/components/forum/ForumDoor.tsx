import { useEffect, useState } from 'react'
import { useNavigationType } from 'react-router-dom'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * The door into the forum: three dots, in blue.
 *
 * Staw: "for the dots thing when u arrive on the forum page i want it to be
 * like discourse's 3 dots loading thing (in blue)". So it is the one
 * everybody who has waited on a forum knows - three dots in a row, each
 * swelling and fading a beat after the one before it - rather than the field
 * of flying squares that was here first. That one was a curtain; this is a
 * forum loading, which is what is actually happening.
 *
 * Blue is Kobblon, so the dots are brand rather than Discourse's grey.
 *
 * Why three plain elements and not a canvas: three dots is three elements.
 * The canvas was there because two hundred animating divs is two hundred
 * composited layers; three is three, and CSS does it without a frame loop.
 *
 * **Not on a cold load.** Arriving at kobblon.com/forum from a link, the
 * site's own boot screen has already covered the arrival, and a second wait
 * the moment it lifts is two in a row before anybody has read a word. So it
 * plays when the forum is *entered* - a link followed from inside the site,
 * which is what `PUSH` means - and not when the browser loaded the page.
 * Back and forward are `POP` too, and a wait on the back button is a wait in
 * somebody's way.
 *
 * **Once a session, and never for somebody who asked for less motion.**
 * `sessionStorage` is the right memory for it: it lasts as long as the visit
 * and not a minute longer, so coming back tomorrow is an arrival again.
 */
const SEEN = 'kob.forum.door'

/** Long enough to read as loading, short enough not to be a toll gate. */
const RUN = 900

function alreadyIn() {
  try {
    return sessionStorage.getItem(SEEN) === '1'
  } catch {
    /* A private window, or storage somebody has blocked. The door simply
       opens every time, which is a worse experience and not a broken one. */
    return false
  }
}

export function ForumDoor() {
  const reduced = useReducedMotion()
  /*
   * Decided once, at mount, from storage - not read again on every render.
   * The value that decides this changes the moment the door opens, and a
   * component that re-reads it mid-flight closes its own curtain.
   */
  const how = useNavigationType()
  const [open, setOpen] = useState(() => how === 'PUSH' && !alreadyIn() && !reduced)
  const [lifting, setLifting] = useState(false)

  useEffect(() => {
    if (!open) return
    try { sessionStorage.setItem(SEEN, '1') } catch { /* see above */ }

    /* The backdrop fades before the dots are taken away, so the page is
       already there behind the last of them. */
    const fade = setTimeout(() => setLifting(true), RUN)
    const gone = setTimeout(() => setOpen(false), RUN + 420)
    return () => { clearTimeout(fade); clearTimeout(gone) }
  }, [open])

  if (!open) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-ink transition-opacity duration-[420ms]"
      style={{ opacity: lifting ? 0 : 1 }}
    >
      <span className="flex items-center gap-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-brand-bright"
            style={{
              animation: 'forum-dot 1.05s ease-in-out infinite',
              /* Each one a third of a beat behind the last, which is what
                 makes three dots read as one thing travelling rather than
                 three things blinking. */
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </span>
    </div>
  )
}
