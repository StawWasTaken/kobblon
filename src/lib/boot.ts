/*
 * The document's own loading screen, and who is allowed to take it down.
 *
 * There are two waits on a cold load and they used to be separate: the mark
 * in `app.html`, which is up from the first byte, and React's own
 * `LoadingScreen`, which goes up while the session is read. The first came
 * down the moment React drew anything, the second went up a frame later,
 * and both of them are the same four seconds of film - so what Staw
 * actually saw on reloading any page was the reveal starting, stopping a
 * fifth of the way in, and starting again from the beginning.
 *
 * So there is one wait now, the document's, and this is the lock on it.
 * Anything that still needs it holds it; it comes down when the last hold
 * is released, and not before the film has had the one full play Staw asked
 * for: "i want that the gif get the time to play at least once fully and
 * then it loads".
 *
 * The clock starts when the image loads rather than when the document
 * parses, because that is when the first frame is actually drawn - an
 * uncached reveal on a slow line would otherwise have most of its play
 * counted while it was still arriving.
 */

/** How long one play of `logo-reveal.gif` takes, in milliseconds. */
export const REVEAL_MS = 3950

declare global {
  interface Window {
    /** When the reveal's first frame was drawn. `app.html` sets it. */
    __kobBootAt?: number
    /** Set by `main.tsx`, so the document's rescue knows the bundle ran. */
    __kobUp?: boolean
  }
}

/*
 * The full play is for arriving, not for every reload.
 *
 * Staw: "i want that the loading screen take time to show the loading gif
 * to be played fully at least once ONLY when you arrive onto the website,
 * like if you are already on the website and that you refresh then it only
 * takes the time to load instead of having a timer preset". A reload is a
 * fresh document and looks identical from in here - except for the one
 * thing that survives it and does not survive a new tab, which is session
 * storage. So the first load in a tab gets the film and every load after it
 * in that tab gets out of the way as soon as the page is ready.
 */
const SEEN = 'kobblon.reveal-seen'

function alreadyWatched() {
  try {
    return sessionStorage.getItem(SEEN) === '1'
  } catch {
    // A blocked store means every load looks like the first, which is the
    // side to err on: the film is the thing he asked for.
    return false
  }
}

function watched() {
  try { sessionStorage.setItem(SEEN, '1') } catch { /* nothing to do */ }
}

/* Starts at one: the document itself holds it until `App` has committed. */
let holds = 1
let coming = 0

/** Whether the document's wait is still on screen. */
export function bootIsUp() {
  return !!document.getElementById('boot')
}

/** Keep the wait up. Every hold has to be released. */
export function holdBoot() {
  holds += 1
  if (coming) {
    window.clearTimeout(coming)
    coming = 0
  }
}

/** Let go. The wait comes down once nothing holds it and the film has run. */
export function releaseBoot() {
  holds = Math.max(0, holds - 1)
  if (holds || coming) return

  const began = window.__kobBootAt
  const left = began === undefined || alreadyWatched()
    ? 0
    : Math.max(0, REVEAL_MS - (Date.now() - began))
  watched()

  coming = window.setTimeout(() => {
    coming = 0
    document.getElementById('boot')?.remove()
  }, left)
}
