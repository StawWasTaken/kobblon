import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import App from './App'
import { watchForMissingPieces } from './lib/lazyPage'
import './index.css'

config.autoAddCss = false

/*
 * Say we are here, for the rescue in `app.html` that is watching.
 *
 * It fires three seconds after the window has loaded and sends the address
 * to the root index if nothing in the bundle has run by then. This line is
 * the proof that something has.
 */
window.__kobUp = true

/*
 * And put the address back if we arrived that way.
 *
 * `/?to=/u/somebody` is the rescue's doing, not a real address, and React
 * Router must never see it: it would route to the landing page and then the
 * person would be somewhere they did not ask for. Replaced rather than
 * pushed, so Back does not walk into the query again.
 */
const rescued = new URLSearchParams(window.location.search).get('to')
if (rescued && rescued.startsWith('/') && !rescued.startsWith('//')) {
  window.history.replaceState(null, '', rescued)
}

// Publishing replaces the pieces this document fetches itself from. A tab
// that was open across a publish asks for one that has gone; this notices and
// fetches the current index instead of showing nothing.
watchForMissingPieces()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * The document's own mark is taken down by `App`, once React has actually
 * put something on screen.
 *
 * It used to come down here, on the line after `render` - and `render` only
 * *schedules* the work. So the mark went the moment the bundle ran, whether
 * or not anything replaced it, and if the first render threw, what was left
 * was an empty page. A boot screen that stays up until there is something
 * behind it can at least offer to reload; a blank one cannot.
 */
