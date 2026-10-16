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

// The mark the document paints on its own, before any of this arrived. It has
// done its job once there is something real to look at.
document.getElementById('boot')?.remove()
