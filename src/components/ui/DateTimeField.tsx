import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCalendarDay, faChevronLeft, faChevronRight, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Monday-first weeks, with the days either side of the month filled in. */
function monthGrid(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - lead)

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return day
  })
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The value the form keeps: "2026-09-18T19:21", the same shape as before. */
export const toLocalValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`

/** The day on its own: "2026-09-18", which is what a `date` column holds. */
export const toDayValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/*
 * Read back by hand rather than with `new Date(value)`.
 *
 * `new Date('2026-11-05')` is midnight UTC, which west of Greenwich is the
 * 4th - so a field that only ever shows a day would show the day before the
 * one somebody pressed, in half the world. The time version has no such
 * problem (a value with no zone on it is already read as local), but both
 * go through here so there is one answer rather than two.
 */
function readValue(value: string): Date | null {
  if (!value) return null
  const [day, clock] = value.split('T')
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return null
  const [hours, minutes] = (clock ?? '').split(':').map(Number)
  return new Date(y, m - 1, d, hours || 0, minutes || 0, 0, 0)
}

/**
 * A date, and a time when the field is asking for one, in our own hand
 * rather than whatever the browser draws.
 *
 * Staw: "i want all of our designs btw to be uniformized so for the date
 * stuff it has to be our own design". The browser's own picker is the one
 * control on the site nothing can style: Chrome draws a grey card with its
 * own type, its own blue and a greyed Sunday column, in the middle of a
 * panel built out of our surfaces. So there is one calendar here and the
 * three places that wanted a day - a version's start, an event's last day,
 * a quest's end - all open this.
 *
 * The calendar is Monday-first, the time is two of our own lists, and
 * there is nothing to type in the wrong order.
 */
function Field({
  value, onChange, label, labelNote, min, clearable, className, withTime, placeholder,
}: {
  value: string
  onChange: (next: string) => void
  label?: string
  labelNote?: string
  min?: Date
  clearable?: boolean
  className?: string
  withTime: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ left: number; top: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  const chosen = readValue(value)
  const [view, setView] = useState(() => chosen ?? new Date())

  useEffect(() => { if (chosen) setView(chosen) }, [value])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!root.current?.contains(target) && !pop.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Drawn into the page so a card cannot clip it, and flipped up when low.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = root.current?.getBoundingClientRect()
      if (!anchor) return
      const height = pop.current?.offsetHeight ?? 380
      const width = pop.current?.offsetWidth ?? 320
      const below = window.innerHeight - anchor.bottom
      setBox({
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
        top: below < height + 12 && anchor.top > below
          ? Math.max(8, anchor.top - height - 6)
          : anchor.bottom + 6,
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, view])

  const give = (date: Date) => onChange(withTime ? toLocalValue(date) : toDayValue(date))

  const pick = (day: Date) => {
    const next = new Date(day)
    next.setHours(chosen?.getHours() ?? 19, chosen?.getMinutes() ?? 0, 0, 0)
    give(next)
    /* A field asking only for a day has nothing left to decide once one is
     * pressed, so it closes itself; one asking for a time does not, because
     * the hour is underneath and closing on the day would hide it. */
    if (!withTime) setOpen(false)
  }

  const setTime = (hours: number, minutes: number) => {
    const next = chosen ? new Date(chosen) : new Date()
    next.setHours(hours, minutes, 0, 0)
    give(next)
  }

  const shown = chosen
    ? chosen.toLocaleString('en-GB', withTime
      ? {
          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }
      : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder ?? (withTime ? 'Pick a date and time' : 'Pick a date')

  const today = new Date()

  return (
    <div ref={root} className={className}>
      {!!label && (
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          {label}
          {labelNote && <span className="ml-1.5 font-semibold normal-case text-white/35">{labelNote}</span>}
        </p>
      )}

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
          className={cn(
            'flex h-11 flex-1 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-semibold transition-colors',
            open ? 'border-brand-bright bg-ink-hover' : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
            !chosen && 'text-white/35',
          )}
        >
          <Glyph icon={faCalendarDay} className="text-xs" />
          <span className="min-w-0 flex-1 truncate">{shown}</span>
        </button>

        {clearable && chosen && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Clear ${label ?? 'the date'}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-ink-line text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
          >
            <Glyph icon={faXmark} />
          </button>
        )}
      </div>

      {open && createPortal(
        <div
          ref={pop}
          role="dialog"
          aria-label={label ?? 'Pick a date'}
          style={box ? { left: box.left, top: box.top } : { opacity: 0 }}
          className="fixed z-[80] w-[20rem] animate-pop-in rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-3 shadow-pop"
        >
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              aria-label="Previous month"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faChevronLeft} />
            </button>

            <p className="flex-1 text-center text-sm font-extrabold">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </p>

            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              aria-label="Next month"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faChevronRight} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((day) => (
              <span key={day} className="py-1 text-[11px] font-bold text-muted">{day}</span>
            ))}

            {monthGrid(view).map((day) => {
              const outside = day.getMonth() !== view.getMonth()
              const past = min ? day < new Date(min.getFullYear(), min.getMonth(), min.getDate()) : false
              const picked = chosen ? sameDay(day, chosen) : false

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={past}
                  onClick={() => pick(day)}
                  aria-pressed={picked}
                  className={cn(
                    'grid h-9 place-items-center rounded-lg text-sm font-semibold transition-colors',
                    picked
                      ? 'bg-brand text-white'
                      : past
                        ? 'text-white/20'
                        : outside
                          ? 'text-white/30 hover:bg-ink-hover'
                          : 'text-white/80 hover:bg-ink-hover',
                    !picked && sameDay(day, today) && 'ring-1 ring-brand-bright',
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          {withTime && (
            <div className="mt-3 flex items-center gap-2 border-t border-ink-line pt-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">Time</span>

              {/* Our own lists here too, rather than two native selects
                  sitting in the middle of a card we drew. */}
              <div className="ml-auto flex items-center gap-1.5">
                <Select
                  label="Hour"
                  value={String(chosen?.getHours() ?? 19)}
                  onChange={(next) => setTime(Number(next), chosen?.getMinutes() ?? 0)}
                  className="w-20"
                  options={Array.from({ length: 24 }, (_, h) => ({
                    value: String(h), label: pad(h),
                  }))}
                />

                <span className="font-bold text-white/40">:</span>

                <Select
                  label="Minute"
                  value={String(chosen ? Math.floor(chosen.getMinutes() / 5) * 5 : 0)}
                  onChange={(next) => setTime(chosen?.getHours() ?? 19, Number(next))}
                  className="w-20"
                  align="right"
                  options={Array.from({ length: 12 }, (_, i) => i * 5).map((m) => ({
                    value: String(m), label: pad(m),
                  }))}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => { pick(new Date()); setOpen(false) }}
              className="h-9 flex-1 rounded-lg bg-ink-hover text-xs font-bold text-white/70 transition-colors hover:text-white"
            >
              {withTime ? 'Now' : 'Today'}
            </button>
            {clearable && !!chosen && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="h-9 flex-1 rounded-lg bg-ink-hover text-xs font-bold text-white/70 transition-colors hover:text-white"
              >
                Clear it
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 flex-1 rounded-lg bg-brand text-xs font-bold text-white transition-colors hover:bg-brand-bright"
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/** A date and a time: "2026-09-18T19:21". */
export function DateTimeField(props: Omit<Parameters<typeof Field>[0], 'withTime'>) {
  return <Field {...props} withTime />
}

/** A day on its own: "2026-09-18", the shape a `date` column holds. */
export function DateField(props: Omit<Parameters<typeof Field>[0], 'withTime'>) {
  return <Field {...props} withTime={false} />
}
