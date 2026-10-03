/*
 * Text with its links made clickable, and nothing else made anything.
 *
 * Staw: "if theres a link in it then u can CLICK on the link". The way that
 * is usually done is to turn the text into HTML, and that is the way this
 * does not do it: a notification body is written by somebody, and anything
 * that renders somebody's words as markup is one bad day from rendering
 * somebody's script.
 *
 * So the text is split on anything that looks like an address and the pieces
 * are rendered as text and as anchors. React escapes every piece, as it
 * always does. There is no `dangerouslySetInnerHTML` here and there must
 * never be.
 *
 * Only `https://` and plain `kobblon.com/...` are made into links. `http://`
 * is left as text - it is 2026 - and nothing else is touched at all, which
 * is what keeps `javascript:` from ever being one.
 */
import { Link } from 'react-router-dom'

const FINDER = /(https:\/\/[^\s<>"']+|(?:^|\s)kobblon\.com\/[^\s<>"']*)/gi

/** Our own addresses become in-site links, so they do not reload the site. */
const ourPath = (address: string): string | null => {
  try {
    const url = new URL(address.startsWith('http') ? address : `https://${address}`)
    if (url.hostname !== 'kobblon.com' && url.hostname !== 'www.kobblon.com') return null
    return `${url.pathname}${url.search}${url.hash}` || '/'
  } catch {
    return null
  }
}

export function Linkify({ children, className }: { children: string; className?: string }) {
  const pieces = children.split(FINDER)

  return (
    <>
      {pieces.map((piece, at) => {
        if (!piece) return null
        const trimmed = piece.trim()
        const looksLikeOne = /^(https:\/\/|kobblon\.com\/)/i.test(trimmed)
        if (!looksLikeOne) return <span key={at}>{piece}</span>

        const lead = piece.slice(0, piece.indexOf(trimmed[0]))
        const inside = ourPath(trimmed)

        return (
          <span key={at}>
            {lead}
            {inside ? (
              <Link to={inside} className={className ?? 'font-bold text-link hover:underline'}>
                {trimmed}
              </Link>
            ) : (
              <a
                href={trimmed}
                target="_blank"
                rel="noreferrer noopener nofollow"
                className={className ?? 'font-bold text-link hover:underline'}
              >
                {trimmed}
              </a>
            )}
          </span>
        )
      })}
    </>
  )
}
