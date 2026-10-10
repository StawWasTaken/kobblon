/*
 * Ctrl+K, and the console stops being ten panels you have to find.
 *
 * One box over everything: type a few letters of a panel and press
 * Enter, or type a name and go straight to that person's record. It is
 * the same list the rail shows and the same rank rules decide it - a
 * panel you may not open is not offered here either, because a shortcut
 * that shows you a door you cannot walk through is worse than no
 * shortcut.
 *
 * Deliberately not a global shortcut for the whole site: Ctrl+K is a
 * browser shortcut in several places and taking it everywhere for the
 * sake of ten staff is rude to everybody else. It is live while the
 * console is open and nowhere else.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faUser, faArrowTurnDown } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

export type CommandPanel = { name: string; icon: IconDefinition; blurb: string }

export function CommandBar({ panels, onGo, onFindPerson }: {
  /** Only the panels this rank may open. The rail decides that, not this. */
  panels: CommandPanel[]
  onGo: (name: string) => void
  /** Jumps to People with the box already filled in and searched. */
  onFindPerson: (term: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState(0)
  const box = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((was) => !was)
        setTerm('')
        setPicked(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (open) box.current?.focus() }, [open])

  const said = term.trim()
  const hits = useMemo(
    () => panels.filter((one) =>
      !said
      || one.name.toLowerCase().includes(said.toLowerCase())
      || one.blurb.toLowerCase().includes(said.toLowerCase())),
    [panels, said],
  )

  /* A name is the other thing anybody types in here, so it is always last. */
  const rows: { key: string; run: () => void; icon: IconDefinition; title: string; note: string }[] = [
    ...hits.map((one) => ({
      key: `panel:${one.name}`,
      run: () => onGo(one.name),
      icon: one.icon,
      title: one.name,
      note: one.blurb,
    })),
    ...(said ? [{
      key: 'person',
      run: () => onFindPerson(said),
      icon: faUser,
      title: `Find “${said}”`,
      note: 'Searches People for a name, a handle or an account number',
    }] : []),
  ]

  const here = Math.min(picked, Math.max(0, rows.length - 1))

  const move = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPicked((n) => (n + 1) % rows.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setPicked((n) => (n - 1 + rows.length) % rows.length) }
    if (e.key === 'Enter' && rows[here]) {
      e.preventDefault()
      rows[here].run()
      setOpen(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-ink-line bg-ink-card shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-ink-line px-4 py-3">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="text-muted" />
          <input
            ref={box}
            value={term}
            onChange={(e) => { setTerm(e.target.value); setPicked(0) }}
            onKeyDown={move}
            placeholder="Jump to a panel, or find somebody"
            aria-label="Jump to a panel, or find somebody"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
          />
          <kbd className="rounded-md border border-ink-line px-1.5 py-0.5 text-[10px] font-bold text-muted">
            Esc
          </kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto p-2 kob-scroll">
          {!rows.length && (
            <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches that.</li>
          )}
          {rows.map((one, i) => (
            <li key={one.key}>
              <button
                type="button"
                onMouseEnter={() => setPicked(i)}
                onClick={() => { one.run(); setOpen(false) }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                  i === here ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
                )}
              >
                <FontAwesomeIcon
                  icon={one.icon}
                  className={cn('w-4 shrink-0', i === here ? 'text-brand-bright' : 'text-muted')}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{one.title}</span>
                  <span className="block truncate text-xs text-muted">{one.note}</span>
                </span>
                {i === here && (
                  <FontAwesomeIcon icon={faArrowTurnDown} className="shrink-0 text-xs text-muted" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
