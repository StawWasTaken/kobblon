import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faCaretDown, faCheck } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

export type SelectOption = { value: string; label: string; note?: string }

/*
 * What floats above what: a popup card sits at 50, a menu at 85, a tooltip
 * and the calendar at 80, and a list of options at 90. A select is always
 * opened from inside something else, the calendar included, so it has to be
 * above everything or its options come out behind the thing that opened it.
 */

/**
 * Our own dropdown rather than a native select, so it looks the same on every
 * machine. Keyboard behaviour matches what people expect from a listbox:
 * arrows move, Enter picks, Escape closes.
 */
export function Select({
  value, options, onChange, label, className, disabled, align = 'left',
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  label: string
  className?: string
  disabled?: boolean
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value) ?? null

  useEffect(() => {
    if (!open) return
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!root.current?.contains(target) && !list.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, options, value])

  /*
   * The list is drawn into the body rather than inside whatever card the
   * select happens to sit in, so nothing clips it, and it flips above the
   * button when there is no room below.
   */
  useLayoutEffect(() => {
    if (!open) return

    const place = () => {
      const anchor = root.current?.getBoundingClientRect()
      if (!anchor) return
      const height = list.current?.offsetHeight ?? 240
      const below = window.innerHeight - anchor.bottom
      const goUp = below < height + 12 && anchor.top > below
      const width = Math.max(anchor.width, 180)
      const left = align === 'right'
        ? Math.min(anchor.right - width, window.innerWidth - width - 8)
        : Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))

      setBox({
        left,
        top: goUp ? Math.max(8, anchor.top - height - 6) : anchor.bottom + 6,
        width,
      })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, align, options.length])

  useEffect(() => {
    if (!open) return
    list.current?.querySelectorAll('[role="option"]')[active]
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const pick = (next: string) => {
    setOpen(false)
    if (next !== value) onChange(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setOpen(true); return
    }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length) }
    if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[active].value) }
  }

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-left text-sm font-semibold transition-colors disabled:opacity-40',
          open ? 'border-brand-bright bg-ink-hover' : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
        )}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? 'Choose'}</span>
        <Glyph
          icon={faCaretDown}
          className={cn('shrink-0 text-xs text-white/45 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && createPortal(
        <div
          ref={list}
          role="listbox"
          aria-label={label}
          style={box ? { left: box.left, top: box.top, width: box.width } : { opacity: 0 }}
          className="fixed z-[90] max-h-64 overflow-y-auto rounded-xl border border-ink-line bg-ink-card py-1 shadow-pop animate-pop-in kob-scroll"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(option.value)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold transition-colors',
                index === active ? 'bg-ink-hover text-white' : 'text-white/75',
              )}
            >
              <Glyph
                icon={faCheck}
                className={cn('w-3 shrink-0 text-xs', option.value === value ? 'text-link' : 'opacity-0')}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.note && <span className="shrink-0 text-xs text-muted">{option.note}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
