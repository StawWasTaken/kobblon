import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faXmark, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { MediaPlayer } from '@/components/create/MediaPlayer'
import { forumImageUrl, isForumClip } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * An attachment, big.
 *
 * Staw: "when you click on an image or video it opens it in bigger view but
 * i dont want to be able to open the image in a new tab, same thing for
 * vids, and its the same image/video player design that we have on the
 * website".
 *
 * So the thumbnail is a button rather than a link now, and a clip is played
 * by `MediaPlayer` - the player Create and the front page already use -
 * rather than by the browser's own controls, which are a different set of
 * shapes in every browser and ours in none of them.
 *
 * **What "not in a new tab" is and is not.** What is gone is the invitation:
 * no `<a href>`, no middle click, no "open in new tab" on the link, and
 * `controlsList="nodownload"` takes the save button off the player's own
 * menu. What is not gone, and cannot be, is the file: the `forum` bucket is
 * public, every attachment is a plain address, and anybody who wants the
 * address can read it out of the page. Saying otherwise here would be
 * promising something the runtime does not do. If an attachment ever must
 * not be fetchable by its address, that is a private bucket and signed
 * URLs, which is a different change in a different place.
 */
export function Lightbox({
  paths, at, onMove, onClose, urlOf = forumImageUrl,
}: {
  paths: string[]
  /** Which one is open, or null when nothing is. */
  at: number | null
  onMove: (next: number) => void
  onClose: () => void
  /**
   * How a stored path becomes an address. The bucket's own, unless
   * something mounting this outside the website has another - which is the
   * one thing in here that reaches for a global, and this project has been
   * bitten three times by a component that assumed its surroundings.
   */
  urlOf?: (path: string) => string
}) {
  const open = at !== null && at >= 0 && at < paths.length

  /*
   * Escape and the arrows, asked of the window rather than of the panel.
   *
   * The panel is not what has focus after a click on a thumbnail - the
   * thumbnail is - so a handler on the panel hears nothing until somebody
   * tabs into it. The effect is re-asked on every change of `at`, because
   * the arrows need the *current* index: capturing it once is the trap this
   * project keeps falling into, and here it would mean the right arrow
   * always going to the second picture.
   */
  const step = useCallback((by: number) => {
    if (at === null) return
    onMove((at + by + paths.length) % paths.length)
  }, [at, paths.length, onMove])

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', key)

    /* The page behind does not scroll while this is over it. */
    const had = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', key)
      document.body.style.overflow = had
    }
  }, [open, step, onClose])

  if (!open) return null
  const path = paths[at]
  const url = urlOf(path)
  const many = paths.length > 1

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attachment"
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/95 p-4 backdrop-blur-sm sm:p-10"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-white/70 transition-colors hover:bg-white/15 hover:text-white sm:right-5 sm:top-5"
      >
        <Glyph icon={faXmark} />
      </button>

      {many && (
        <>
          <Arrow side="left" onPress={() => step(-1)} />
          <Arrow side="right" onPress={() => step(1)} />
        </>
      )}

      {/* The click that opened this must not be the click that closes it. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-5xl flex-col items-center gap-4"
      >
        {isForumClip(path) ? (
          <MediaPlayer src={url} kind="video" className="w-full" />
        ) : (
          <img
            src={url}
            alt="Attached to this post"
            draggable={false}
            className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
          />
        )}

        {many && (
          <p className="text-xs font-bold tabular-nums text-white/40">
            {at + 1} / {paths.length}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Arrow({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onPress() }}
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      className={cn(
        'absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl bg-white/[0.07] text-white/70 transition-colors hover:bg-white/15 hover:text-white',
        side === 'left' ? 'left-2 sm:left-5' : 'right-2 sm:right-5',
      )}
    >
      <Glyph icon={side === 'left' ? faChevronLeft : faChevronRight} />
    </button>
  )
}
