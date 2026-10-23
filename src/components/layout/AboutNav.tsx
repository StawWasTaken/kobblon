import { useEffect, useState } from 'react'
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
 * to somebody who has not decided yet. This is the one bar they share.
 *
 * It sticks, and that is the part worth explaining. The About pages are
 * long now, several bands deep, and a sign-up button that scrolls away at
 * the top of a page whose whole job is to get somebody to sign up is the
 * button not being there. It rides along instead - transparent over the
 * hero so the pixel wash is not cut in half, and frosted the moment the
 * page moves, which is what keeps the links readable once a render of a
 * World is passing behind them.
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
  const [moved, setMoved] = useState(false)

  useEffect(() => {
    const onScroll = () => setMoved(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A link followed with the menu open leaves the menu open over the new page.
  useEffect(() => setOpen(false), [pathname])

  const here = (to: string) => pathname.startsWith(to)

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-colors duration-300',
        moved || open
          ? 'border-b border-white/[0.08] bg-ink/85 backdrop-blur-xl'
          : 'border-b border-transparent',
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-5 py-4 sm:px-8">
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

        <nav className="ml-7 hidden items-center gap-1 sm:flex">
          {ABOUT_LINKS.map((one) => (
            <Link
              key={one.to}
              to={one.to}
              className={cn(
                'relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                here(one.to) ? 'text-white' : 'text-white/50 hover:text-white',
              )}
            >
              {one.label}
              {/* The page you are on, marked under the word rather than behind it. */}
              <span
                className={cn(
                  'absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-bright transition-opacity',
                  here(one.to) ? 'opacity-100' : 'opacity-0',
                )}
              />
            </Link>
          ))}
        </nav>

        <Link
          to="/login"
          className="ml-auto text-sm font-bold text-white/55 transition-colors hover:text-brand-bright"
        >
          Log in
        </Link>
        <Button to="/signup" size="sm" variant="yes">Sign up</Button>
      </div>

      {open && (
        <nav className="border-t border-white/10 px-3 pb-3 pt-2 sm:hidden">
          {ABOUT_LINKS.map((one) => (
            <Link
              key={one.to}
              to={one.to}
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
