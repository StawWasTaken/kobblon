import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass, faXmark, faLayerGroup, faUser, faShapes, faUsers, faShirt,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

/** The same tabs the search page opens on, so the two always agree. */
export const searchScopes: { tab: string; label: string; icon: IconDefinition }[] = [
  { tab: 'spaces', label: 'Worlds', icon: faLayerGroup },
  { tab: 'people', label: 'People', icon: faUser },
  { tab: 'create', label: 'Creator Marketplace', icon: faShapes },
  { tab: 'style', label: 'Style', icon: faShirt },
  { tab: 'communities', label: 'Communities', icon: faUsers },
]

/**
 * Each kind of thing is searched where it lives: Spaces in Discover, people
 * on People, Communities on Communities, content in the marketplace, things
 * to wear in the Style shop. The bar hands you over to the right one with
 * your words already in its box, rather than showing five thin copies of
 * those pages on one results screen.
 */
const destinations: Record<string, (query: string) => string> = {
  spaces: (q) => `/discover?q=${encodeURIComponent(q)}`,
  people: (q) => `/people?q=${encodeURIComponent(q)}`,
  communities: (q) => `/communities?q=${encodeURIComponent(q)}`,
  create: (q) => `/create/marketplace?q=${encodeURIComponent(q)}`,
  style: (q) => `/style?q=${encodeURIComponent(q)}`,
}


export function SearchBar({ className }: { className?: string }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [])


  const go = (tab: string) => {
    const query = term.trim()
    if (!query) return
    setOpen(false)
    navigate((destinations[tab] ?? destinations.spaces)(query))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % searchScopes.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + searchScopes.length) % searchScopes.length) }
    if (e.key === 'Escape') setOpen(false)
  }

  const showing = open && term.trim().length > 0

  return (
    <div ref={root} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); go(searchScopes[active].tab) }}
      >
        <label htmlFor="app-search" className="sr-only">Search Kobblon</label>
        <FontAwesomeIcon
          icon={faMagnifyingGlass}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-onbrand/50"
        />
        <input
          id="app-search"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search"
          autoComplete="off"
          role="combobox"
          aria-expanded={showing}
          aria-controls="search-scopes"
          className="h-9 w-full rounded-lg border border-onbrand/15 bg-field pl-9 pr-9 text-sm text-onbrand placeholder:text-onbrand/45 transition-colors focus:border-brand-bright"
        />
        {term && (
          <button
            type="button"
            onClick={() => { setTerm(''); setOpen(false) }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-onbrand/45 hover:text-onbrand"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}
      </form>

      {showing && (
        <ul
          id="search-scopes"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 animate-pop-in overflow-hidden rounded-lg border border-ink-line bg-ink-card py-1 shadow-pop"
        >
          {searchScopes.map((scope, i) => (
            <li key={scope.tab}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(scope.tab)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                  i === active ? 'bg-ink-hover' : 'hover:bg-ink-hover',
                )}
              >
                <FontAwesomeIcon icon={scope.icon} className="w-4 text-onbrand/45" />
                <span className="truncate font-bold text-onbrand">{term.trim()}</span>
                <span className="text-onbrand/45">in {scope.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
