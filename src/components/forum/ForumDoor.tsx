import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * The door into the forum: three dots, in blue, on nothing.
 *
 * Staw: "for the dots thing when u arrive on the forum page i want it to be
 * like discourse's 3 dots loading thing (in blue)", and then: "i want that
 * everytime you go onto the forum page (like the homepage of the forums)
 * theres the three blue dots loading onto a blank screen".
 *
 * Everytime is the word that changed this. It used to play once a session
 * and only when the forum was entered from inside the site - both of those
 * were me being careful about making somebody wait, and both are gone.
 * What is left is the rule as asked: arriving at the forum's front page
 * shows the dots, every time, cold load included.
 *
 * **It is the front page only.** A category, a thread and the form for
 * starting one do not get it, because Staw named the homepage and because a
 * curtain between a thread and the board it is on is a curtain in the way
 * of reading. The shell decides that by mounting this on `/forum` and
 * nowhere else, which is also what makes it play again: leaving the front
 * page unmounts it, so coming back is a new arrival rather than a component
 * being asked to replay itself.
 *
 * **It is a real wait, not a timed one.** `waiting` is the shell's own
 * loading flag, so the dots are up while the boards are actually being
 * fetched and come down when they land. The floor underneath it is there
 * so a cached answer does not make the screen flash once and move on - a
 * curtain that appears and vanishes inside a frame reads as a glitch, not
 * as loading. Nothing holds it beyond that.
 *
 * Blue is Kobblon, so the dots are brand rather than Discourse's grey.
 *
 * Why three plain elements and not a canvas: three dots is three elements.
 * CSS does this without a frame loop.
 *
 * Never for somebody who asked for less motion - they get the page.
 */

/** Short enough not to be a toll gate, long enough not to strobe. */
const FLOOR = 450

/** How long the backdrop takes to fade once it is allowed to. */
const FADE = 380

export function ForumDoor({ waiting = false }: { waiting?: boolean }) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(() => !reduced)
  const [lifting, setLifting] = useState(false)
  /*
   * When the dots went up. Set at mount rather than read from a prop,
   * because the floor is measured from the arrival and the arrival is this
   * component existing.
   */
  const since = useRef(Date.now())

  useEffect(() => {
    if (!open || lifting) return
    /*
     * Asked again every time `waiting` changes rather than captured once:
     * the thing that decides when this comes down is the fetch, and the
     * fetch finishes after this effect first ran. A timeout set up front
     * from the value at mount would be the trap this project keeps falling
     * into - a value captured before the thing that decides it exists.
     */
    if (waiting) return

    const left = Math.max(0, FLOOR - (Date.now() - since.current))
    const fade = setTimeout(() => setLifting(true), left)
    return () => clearTimeout(fade)
  }, [open, lifting, waiting])

  useEffect(() => {
    if (!lifting) return
    const gone = setTimeout(() => setOpen(false), FADE)
    return () => clearTimeout(gone)
  }, [lifting])

  if (!open) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-ink transition-opacity"
      style={{ opacity: lifting ? 0 : 1, transitionDuration: `${FADE}ms` }}
    >
      <span className="flex items-center gap-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-brand-bright"
            style={{
              animation: 'forum-dot 1.05s ease-in-out infinite',
              /* Each one a beat behind the last, which is what makes three
                 dots read as one thing travelling rather than three things
                 blinking. */
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </span>
    </div>
  )
}
