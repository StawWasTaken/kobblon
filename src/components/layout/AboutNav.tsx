import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { faBars, faXmark, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Wordmark } from '@/components/brand/Wordmark'
import { Button } from '@/components/ui/Button'
import { UserMenu } from '@/components/layout/UserMenu'
import { useAuth } from '@/hooks/useAuth'
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
/*
 * Staw: "for the At Kobblon pages, can we reorder these, and theres a lil
 * too much maybe we should put categories".
 *
 * Six words across a bar is a list, and a list is read left to right until
 * something matches rather than looked at. So the four that somebody
 * actually arrives wanting stay in the bar - what this is, where everybody
 * is, where help is, and the install - and the two that are consulted
 * rather than visited go behind one word.
 *
 * Download stays last, because the install is what you do once the page
 * has answered the rest, so nothing follows it.
 *
 * **These are At Kobblon pages and nothing else.** Where a bar belongs to
 * one half of the site it carries that half's pages; the way across is a
 * door of its own, not another entry pretending to be a sibling of these.
 */
export type AboutLink = { to: string; label: string }
export type AboutEntry = AboutLink & { under?: AboutLink[] }

/** The pages behind "Company": true about Kobblon, read once, not visited. */
const COMPANY: AboutLink[] = [
  { to: '/inner-stock', label: 'Inner Stock' },
  { to: '/policies', label: 'Policies' },
]

export const ABOUT_NAV: AboutEntry[] = [
  { to: '/about', label: 'What is Kobblon' },
  { to: '/forum', label: 'Forum' },
  { to: '/support', label: 'Support' },
  { to: '/inner-stock', label: 'Company', under: COMPANY },
  { to: '/download', label: 'Download' },
]

/** Flat, for anything that wants every page on this side in order. */
export const ABOUT_LINKS: AboutLink[] = ABOUT_NAV.flatMap(
  (one) => (one.under ? one.under : [one]),
)

export function AboutNav({ className }: { className?: string }) {
  const { profile } = useAuth()
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
          {ABOUT_NAV.map((one) => (
            one.under
              ? <NavGroup key={one.label} entry={one} here={here} />
              : (
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
              )
          ))}
        </nav>

        {/*
         * Signed in, the two buttons are the one thing on this bar that is
         * wrong: telling somebody with an account to make one. So they
         * become their own picture and the same account menu the signed-in
         * pages have.
         *
         * `profile` is null while the session is still being read, which is
         * the Log in / Sign up pair for a fraction of a second on a reload.
         * Waiting instead would mean an empty space where the controls go
         * and then them appearing, which is worse: a bar that finishes
         * drawing twice reads as broken, and a stranger is the honest
         * default for somebody nobody has identified yet.
         */}
        {profile ? (
          <span className="ml-auto flex items-center gap-3">
            <UserMenu trigger="avatar" />
          </span>
        ) : (
          <>
            <Link
              to="/login"
              className="ml-auto text-sm font-bold text-white/55 transition-colors hover:text-brand-bright"
            >
              Log in
            </Link>
            <Button to="/signup" size="sm" variant="yes">Sign up</Button>
          </>
        )}
      </div>

      {open && (
        <nav className="border-t border-white/10 px-3 pb-3 pt-2 sm:hidden">
          {ABOUT_NAV.map((one) => (
            one.under
              ? (
                /* The group is a heading and its pages, not a menu inside a menu. */
                <div key={one.label} className="mt-2 border-t border-white/[0.06] pt-2">
                  <p className="px-4 pb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/30">
                    {one.label}
                  </p>
                  {one.under.map((page) => (
                    <Link
                      key={page.to}
                      to={page.to}
                      className={cn(
                        'block rounded-xl px-4 py-3 text-sm font-bold transition-colors',
                        here(page.to) ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {page.label}
                    </Link>
                  ))}
                </div>
              )
              : (
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
              )
          ))}
        </nav>
      )}
    </header>
  )
}

/**
 * One word in the bar that opens onto two pages.
 *
 * Hover opens it and so does a click, because a menu that only answers to
 * a pointer is a menu a phone and a keyboard cannot reach. It closes on
 * leaving, on Escape, and on following a link - and the links are real
 * links, so middle-click and open-in-new-tab still do what they do
 * everywhere else on the site.
 */
function NavGroup({ entry, here }: { entry: AboutEntry; here: (to: string) => boolean }) {
  const [open, setOpen] = useState(false)
  const inside = (entry.under ?? []).some((one) => here(one.to))

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
    >
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className={cn(
          'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
          inside || open ? 'text-white' : 'text-white/50 hover:text-white',
        )}
      >
        {entry.label}
        <Glyph
          icon={faChevronDown}
          className={cn('text-[0.6rem] transition-transform', open && 'rotate-180')}
        />
        <span
          className={cn(
            'absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-bright transition-opacity',
            inside ? 'opacity-100' : 'opacity-0',
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 w-48 pt-2">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-ink/95 p-1 shadow-pop backdrop-blur-xl">
            {(entry.under ?? []).map((one) => (
              <Link
                key={one.to}
                to={one.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm font-bold transition-colors',
                  here(one.to) ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                {one.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
