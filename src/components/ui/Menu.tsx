import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Hop } from '@/components/ui/Hop'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

export type MenuItem = {
  label: string
  icon?: IconDefinition
  to?: string
  onSelect?: () => void
  danger?: boolean
}

const WIDTH = 224

/** The menu behind a "..." button. */
export function Menu({
  label, trigger, items, align = 'right',
}: {
  label: string
  trigger: ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ left: number; top: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!root.current?.contains(target) && !list.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /*
   * The menu is drawn into the body rather than inside whatever card holds
   * the button, so a card that hides its overflow cannot cut it off. It
   * flips above the button when there is no room underneath.
   */
  useLayoutEffect(() => {
    if (!open) return

    const place = () => {
      const anchor = root.current?.getBoundingClientRect()
      if (!anchor) return
      const height = list.current?.offsetHeight ?? items.length * 42 + 8
      const below = window.innerHeight - anchor.bottom
      const goUp = below < height + 12 && anchor.top > below
      const left = align === 'right'
        ? Math.min(anchor.right - WIDTH, window.innerWidth - WIDTH - 8)
        : Math.min(anchor.left, window.innerWidth - WIDTH - 8)
      setBox({
        left: Math.max(8, left),
        top: goUp ? anchor.top - height - 6 : anchor.bottom + 6,
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align, items.length])

  // The icon takes the colour of its label rather than a grey of its own, so
  // a red entry reads red the whole way across.
  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-ink-hover'

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        {trigger}
      </button>

      {open && createPortal(
        <div
          ref={list}
          role="menu"
          style={{ left: box?.left ?? -9999, top: box?.top ?? -9999, width: WIDTH }}
          className="fixed z-[85] animate-pop-in overflow-hidden rounded-xl border border-ink-line bg-ink-card py-1 shadow-pop"
        >
          {items.map((item) => {
            const body = (
              <>
                {item.icon && <FontAwesomeIcon icon={item.icon} className="w-4" />}
                {item.label}
              </>
            )
            const tone = item.danger ? 'text-danger' : 'text-white/80 hover:text-white'

            return item.to ? (
              <Hop
                key={item.label}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(itemClass, tone)}
              >
                {body}
              </Hop>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => { setOpen(false); item.onSelect?.() }}
                className={cn(itemClass, tone)}
              >
                {body}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
