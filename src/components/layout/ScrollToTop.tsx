import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * A new page starts at the top of itself.
 *
 * The browser does this for you when a link loads a document; a router does
 * not, because nothing loaded - it swapped what is being drawn and left the
 * window where it was. Staw found it the obvious way: a link in the footer,
 * which is as far down a page as it is possible to be, and the new page
 * opens at the foot of itself with the reader looking at its footer.
 *
 * Going **back** is left alone on purpose. Returning to a list you were
 * halfway down and being thrown to the top of it is the other version of
 * this bug, and it is the more annoying one; `POP` is the browser restoring
 * a place somebody already had.
 *
 * A hash is left alone too, so `/policies/terms#appeals` still lands on the
 * section it names.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const how = useNavigationType()

  useEffect(() => {
    if (how === 'POP' || hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname, hash, how])

  return null
}
