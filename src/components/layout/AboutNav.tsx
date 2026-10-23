import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Wordmark } from '@/components/brand/Wordmark'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * The bar across the About side.
 *
 * Staw's three kinds of page: the ones you use signed in, the ones that
 * sign an application in, and these - the pages that say what Kobblon is
 * to somebody who has not decided yet. They had three different headers
 * between them, which is how a side of a site stops looking like one site.
 * This is the one bar they share.
 */
export const ABOUT_LINKS = [
  { to: '/about', label: 'What Kobblon is' },
  { to: '/download', label: 'Download' },
  { to: '/policies', label: 'The rules' },
  { to: '/support', label: 'Support' },
]

export function AboutNav({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  const here = (to: string) => pathname.startsWith(to)

  return (
    <header className={cn('relative', className)}>
      <div className="flex items-center gap-5 py-6">
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 sm:hidden"
        >
          <Glyph icon={open ? faXmark : faBars} className="text-lg" />
        </button>

        <Wordmark to="/" className="h-6" always />

        <nav className="ml-6 hidden items-center gap-6 sm:flex">
          {ABOUT_LINKS.map((one) => (
            <Link
              key={one.to}
              to={one.to}
              className={cn(
                'text-sm font-semibold transition-colors',
                here(one.to) ? 'text-white' : 'text-white/50 hover:text-white',
              )}
            >
              {one.label}
            </Link>
          ))}
        </nav>

        <Link
          to="/login"
          className="ml-auto text-sm font-bold text-white/55 transition-colors hover:text-white"
        >
          Log in
        </Link>
        <Button to="/signup" size="sm" variant="yes">Sign up</Button>
      </div>

      {open && (
        <nav className="absolute inset-x-0 top-full z-20 rounded-2xl border border-white/10 bg-ink-card p-2 sm:hidden">
          {ABOUT_LINKS.map((one) => (
            <Link
              key={one.to}
              to={one.to}
              onClick={() => setOpen(false)}
              className={cn(
                'block rounded-xl px-4 py-3 text-sm font-bold transition-colors',
                here(one.to) ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              {one.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
