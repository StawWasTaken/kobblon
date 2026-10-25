import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Hop } from '@/components/ui/Hop'
import { Pointer } from '@/components/ui/Pointer'
import { Glyph } from '@/components/brand/Glyph'
import type { KobIcon } from '@/components/brand/Icon'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

export type MenuItem = {
  label: string
  icon?: IconDefinition
  /**
   * Name one of ours outright, where Staw drew the thing this entry is.
   *
   * The Font Awesome icon stays as the fallback, the way it does in the
   * rail: `Glyph` takes both and prefers ours.
   */
  ours?: KobIcon
  to?: string
  onSelect?: () => void
  danger?: boolean
  /**
   * Draw a line above this one.
   *
   * A menu with "Copy link" and "Block" the same distance apart is a menu
   * somebody picks the wrong thing out of. The line is where the quiet
   * entries end and the ones that change something begin.
   */
  separated?: boolean
}

const WIDTH = 224

/** The menu behind a "..." button. */
export function Menu({
  label, trigger, items, align = 'right', arrow = false,
}: {
  label: string
  trigger: ReactNode
  items: MenuItem[]
  align?: 'left' | 'right'
  /**
   * Draw the little arrow pointing back at the button.
   *
   * Asked for rather than always: this menu is also the "..." on a card,
   * where the button is already the thing your finger is on and the arrow
   * is noise. It earns its place on a menu that opens out of a row of
   * buttons that all look alike - the top bar.
   */
  arrow?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<
    { left: number; top: number; point: number; up: boolean } | null
  >(null)
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
      const put = Math.max(8, left)
      setBox({
        left: put,
        top: goUp ? anchor.top - height - 6 : anchor.bottom + 6,
        /* Where the button's middle is, in the menu's own pixels, kept
           inside the corners so the arrow never grows out of a rounded
           edge. */
        point: Math.min(Math.max(anchor.left + anchor.width / 2 - put, 14), WIDTH - 14),
        up: goUp,
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
        <>
        {arrow && box && (
          <Pointer
            side={box.up ? 'bottom' : 'top'}
            /* Over the list and half on its edge, so the square's two drawn
               sides continue the card's border and its fill hides the line
               they cross. Under it the border ran straight through the
               arrow's base and the two read as separate things. */
            className="z-[86]"
            style={{
              position: 'fixed',
              left: box.left + box.point - 6,
              top: box.up ? undefined : box.top - 6,
              bottom: box.up ? window.innerHeight - box.top - 1 : undefined,
            }}
          />
        )}
        <div
          ref={list}
          role="menu"
          style={{ left: box?.left ?? -9999, top: box?.top ?? -9999, width: WIDTH }}
          className="fixed z-[85] animate-pop-in overflow-hidden rounded-xl border border-ink-line bg-ink-card py-1 shadow-pop"
        >
          {items.map((item, at) => {
            const body = (
              <>
                {item.icon && <Glyph icon={item.icon} name={item.ours} className="w-4" />}
                {item.label}
              </>
            )
            const tone = item.danger ? 'text-danger' : 'text-white/80 hover:text-white'
            /* Never above the first entry: a line there is a line against
               the top of the card. */
            const rule = item.separated && at > 0
              ? 'mt-1 border-t border-ink-line pt-1'
              : undefined

            return item.to ? (
              <Hop
                key={item.label}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(itemClass, tone, rule)}
              >
                {body}
              </Hop>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => { setOpen(false); item.onSelect?.() }}
                className={cn(itemClass, tone, rule)}
              >
                {body}
              </button>
            )
          })}
        </div>
        </>,
        document.body,
      )}
    </div>
  )
}
