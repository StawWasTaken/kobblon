import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import App from './App'
import { watchForMissingPieces } from './lib/lazyPage'
import './index.css'

config.autoAddCss = false

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
