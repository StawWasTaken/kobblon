import { useMemo } from 'react'
import { cutEmoji, hasEmoji, TWEMOJI } from '@/lib/twemoji'

/*
 * Somebody's words, with the emoji in them drawn as Twemoji.
 *
 * Two rules it keeps, and both are the reason this is a component rather
 * than a pass over the page:
 *
 * **It never renders markup.** The text is split into pieces and the pieces
 * are rendered - React escapes every one, the way it always does. There is
 * no `dangerouslySetInnerHTML` here and there must never be. The usual way
 * of doing this is `twemoji.parse(html)`, which hands somebody's words to
 * the browser as HTML, and that is one bad day from rendering somebody's
 * script.
 *
 * **It does not touch the DOM React owns.** The other usual way is a
 * `MutationObserver` over the body, swapping text nodes as they appear.
 * That works until React updates a node it no longer recognises, and then
 * it throws somewhere else entirely - which is the worst kind of bug to
 * leave for somebody: a crash with no relation to its cause.
 *
 * An emoji that has no picture falls back to the character, because a
 * missing image is worse than the system's own drawing of it.
 */
export function Emoji({
  children,
  className,
  /**
   * How big beside the type. `1em` is right in a line of text; a name in a
   * heading wants the same thing and gets it for free.
   */
  size = '1.15em',
}: {
  children: string | null | undefined
  className?: string
  size?: string
}) {
  const text = children ?? ''
  const pieces = useMemo(() => (hasEmoji(text) ? cutEmoji(text) : null), [text])

  if (!pieces) return <>{text}</>

  return (
    <span className={className}>
      {pieces.map((piece, at) =>
        piece.emoji ? (
          <img
            key={at}
            src={piece.url}
            alt={piece.emoji}
            title={piece.emoji}
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{ width: size, height: size }}
            className="inline-block select-none align-[-0.15em]"
            /*
             * Back to the character if the file is not there. One emoji
             * Twemoji has not drawn yet should look like that emoji, not
             * like a broken page.
             */
            onError={(event) => {
              const img = event.currentTarget
              const instead = document.createElement('span')
              instead.textContent = piece.emoji!
              img.replaceWith(instead)
            }}
          />
        ) : (
          <span key={at}>{piece.text}</span>
        ),
      )}
    </span>
  )
}

/** Where the pictures come from, for a page that wants to say so. */
export const emojiCredit = TWEMOJI.credit

/**
 * The same, for a string going somewhere that cannot hold an element -
 * a `title`, an `alt`, a document title.
 *
 * It does nothing at all, deliberately: the character is already the best
 * thing to put there, and this exists so a caller does not reach for
 * `Emoji` in a place that would render `[object Object]`.
 */
export const plainEmoji = (text: string) => text
