import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/**
 * A panel that comes in from the right edge and holds one thing in full.
 *
 * `Dialog`'s sibling, and the difference is what each is for: a dialog
 * interrupts to ask something short, and a drawer holds a long thing - a
 * support ticket with its whole conversation, a report with its history -
 * beside the list it came from. A queue where opening a row covers the
 * queue is a queue you lose your place in every time you look at
 * something.
 *
 * Everything `Dialog` does, it does: focus is trapped, Escape closes it,
 * the page behind stops scrolling, and focus goes back where it was. It is
 * a portal onto `document.body` and takes no provider and no router, so
 * the Workspace can mount it in a panel.
 *
 * On a narrow screen it is a sheet from the bottom instead, because a
 * 28rem panel on a phone is the whole phone.
 */
export function Drawer({
  open, onClose, title, subtitle, badge, children, footer, width = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  /** Sits beside the title: a status pill, an urgency mark. */
  badge?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg'
}) {
  const panel = useRef<HTMLDivElement>(null)

  /*
   * Held in a ref for the reason Dialog holds it: onClose is written
   * inline at nearly every call site, so it is a new function every
   * render, and an effect tied to it re-runs on every keystroke in the
   * reply box and throws focus back to the top.
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
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end">
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
          'relative flex h-full w-full animate-slide-in flex-col border-l border-ink-line bg-ink-card shadow-pop',
          width === 'md' ? 'sm:max-w-xl' : 'sm:max-w-3xl',
        )}
      >
        <div className="flex items-start gap-4 border-b border-ink-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-extrabold">{title}</h2>
              {badge}
            </div>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 kob-scroll">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-ink-line px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
