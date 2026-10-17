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
  }
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
  const left = began === undefined ? 0 : Math.max(0, REVEAL_MS - (Date.now() - began))

  coming = window.setTimeout(() => {
    coming = 0
    document.getElementById('boot')?.remove()
  }, left)
}
