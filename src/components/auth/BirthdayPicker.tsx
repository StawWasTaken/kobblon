import { useEffect, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faCakeCandles, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const thisYear = new Date().getFullYear()
const years = Array.from({ length: 90 }, (_, i) => thisYear - i)

const daysIn = (month: number, year: number) =>
  month ? new Date(year || 2000, month, 0).getDate() : 31

export type Birthday = { day: string; month: string; year: string }

export const emptyBirthday: Birthday = { day: '', month: '', year: '' }

export const birthdayToDate = (b: Birthday) =>
  b.day && b.month && b.year
    ? `${b.year}-${b.month.padStart(2, '0')}-${b.day.padStart(2, '0')}`
    : ''

/** One scrolling column of the picker. */
function Column({
  label, options, value, onSelect,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onSelect: (next: string) => void
}) {
  const list = useRef<HTMLDivElement>(null)

  // Open on what is already chosen rather than at the top of a long list.
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="border-b border-ink-line px-2 pb-2 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div
        ref={list}
        role="listbox"
        aria-label={label}
        className="h-48 overflow-y-auto p-1 kob-scroll"
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(option.value)}
              className={cn(
                'w-full rounded-md px-2 py-1.5 text-center text-sm font-semibold transition-colors',
                selected ? 'bg-brand text-white' : 'text-white/70 hover:bg-ink-hover hover:text-white',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function BirthdayPicker({
  value,
  onChange,
  error,
}: {
  value: Birthday
  onChange: (next: Birthday) => void
  error?: string | null
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const complete = Boolean(value.day && value.month && value.year)
  const summary = complete
    ? `${value.day} ${months[Number(value.month) - 1]} ${value.year}`
    : 'Pick your birthday'

  // A shorter month drops a day that cannot exist in it.
  const set = (patch: Partial<Birthday>) => {
    const next = { ...value, ...patch }
    if (Number(next.day) > daysIn(Number(next.month), Number(next.year))) next.day = ''
    onChange(next)
  }

  return (
    <div ref={root} className="relative">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Birthday</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Birthday"
        className={cn(
          'flex h-11 w-full items-center gap-3 rounded-xl border px-3.5 text-sm font-semibold transition-colors',
          error ? 'border-danger/60' : 'border-ink-line',
          open ? 'border-brand-bright bg-ink-hover' : 'bg-ink-raised hover:bg-ink-hover',
        )}
      >
        <Glyph icon={faCakeCandles} className="text-white/35" />
        <span className={cn('flex-1 text-left', !complete && 'text-white/35')}>{summary}</span>
        <Glyph
          icon={faChevronDown}
          className={cn('text-xs text-white/40 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 animate-pop-in overflow-hidden rounded-xl border border-ink-line bg-ink-card shadow-pop">
          <div className="flex divide-x divide-ink-line">
            <Column
              label="Month"
              value={value.month}
              onSelect={(month) => set({ month })}
              options={months.map((name, i) => ({ value: String(i + 1), label: name.slice(0, 3) }))}
            />
            <Column
              label="Day"
              value={value.day}
              onSelect={(day) => set({ day })}
              options={Array.from(
                { length: daysIn(Number(value.month), Number(value.year)) },
                (_, i) => ({ value: String(i + 1), label: String(i + 1) }),
              )}
            />
            <Column
              label="Year"
              value={value.year}
              onSelect={(year) => set({ year })}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={!complete}
            className="w-full border-t border-ink-line py-2.5 text-sm font-bold text-white transition-colors hover:bg-ink-hover disabled:text-white/30"
          >
            {complete ? 'Done' : 'Pick all three'}
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  )
}
