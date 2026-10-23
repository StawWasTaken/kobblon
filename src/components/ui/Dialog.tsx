import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/**
 * The popup card that most Kobblon interactions live in: focus is trapped
 * while it is open, Escape closes it, and the page behind it stops scrolling.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  head,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  /**
   * Drawn instead of the title and description, for a card whose top is the
   * thing itself rather than a label for it - a sanction's crest and verdict,
   * a form's progress. The close button stays wherever this goes, because a
   * popup that can only be left by guessing at Escape is not a popup.
   *
   * `title` is still required and still the accessible name: a screen reader
   * reads the card out by it, and a crest says nothing to one.
   */
  head?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const panel = useRef<HTMLDivElement>(null)

  /*
   * onClose is nearly always written inline at the call site, so it is a new
   * function on every render. Holding it in a ref keeps the effect below
   * tied to `open` alone: otherwise every keystroke in a field re-ran the
   * whole thing, which moved focus back to the top of the card and made it
   * impossible to type.
   */
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close.current()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)

    // Land on the first thing somebody would type in, not on the close
    // button, and only when the card opens. A field marked `data-nofocus` is
    // skipped: on the report card the only box is the optional one, and
    // focusing it puts the cursor past the question the card is asking.
    const first = panel.current?.querySelector<HTMLElement>(
      'input:not([type="file"]):not([data-nofocus]), textarea:not([data-nofocus])',
    )
    first?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full animate-pop-in rounded-t-2xl border border-ink-line bg-ink-card shadow-pop sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-sm',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        {head ? (
          <div className="relative overflow-hidden rounded-t-2xl border-b border-ink-line">
            {head}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-black/25 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/45 hover:text-white"
            >
              <Glyph icon={faXmark} />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-4 border-b border-ink-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Glyph icon={faXmark} />
            </button>
          </div>
        )}
        <div className="max-h-[65vh] overflow-y-auto px-5 py-5 kob-scroll sm:max-h-[70vh]">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-ink-line px-5 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
