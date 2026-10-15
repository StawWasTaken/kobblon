import { useEffect, useId, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

export type PickerOption = { value: string; label: string }

/**
 * A listbox we control the look of, rather than a native select that the
 * browser skins its own way on every platform.
 */
export function Picker({
  value,
  options,
  placeholder,
  label,
  columns = 1,
  invalid,
  onChange,
  className,
}: {
  value: string
  options: PickerOption[]
  placeholder: string
  label: string
  columns?: number
  invalid?: boolean
  onChange: (next: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const index = Math.max(0, options.findIndex((o) => o.value === value))
    setActive(index)

    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const commit = (index: number) => {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(active); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
  }

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors',
          invalid ? 'border-danger/60' : 'border-ink-line',
          open ? 'border-brand-bright bg-ink-hover' : 'bg-ink-raised hover:bg-ink-hover',
          selected ? 'text-white' : 'text-white/35',
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <Glyph
          icon={faChevronDown}
          className={cn('text-xs text-white/40 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          ref={list}
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
          className={cn(
            'absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 animate-pop-in overflow-y-auto rounded-lg border border-ink-line bg-ink-card p-1 shadow-pop kob-scroll',
            columns > 1 && 'grid gap-1',
          )}
          style={columns > 1 ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(index)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-sm font-semibold transition-colors',
                    isSelected
                      ? 'bg-brand text-white'
                      : index === active
                        ? 'bg-ink-hover text-white'
                        : 'text-white/70',
                  )}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
