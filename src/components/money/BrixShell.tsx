import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  faGift, faReceipt, faRankingStar, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import type { KobIcon } from '@/components/brand/Icon'
import { CurrencyMark } from '@/components/brand/Currency'
import { Page } from '@/components/layout/AppShell'
import { useAuth } from '@/hooks/useAuth'
import { useNewQuests } from '@/hooks/useNewQuests'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The four Brix pages, under one roof.
 *
 * Staw: "i want a redesign, uniformization, polishing, of all of the brix
 * pages". They had been written one at a time and it showed - Quests opened
 * with a plain header, transactions opened with a balance panel in the
 * corner, codes opened with a back link to transactions, and nothing told
 * you the other three existed. Four pages that are one place now: the same
 * top, the same balance, and a rail that says where you are and what else
 * is here.
 *
 * The underline is measured rather than drawn per tab, so it slides from
 * one to the next instead of blinking off and on. Somebody who has asked
 * their system for less motion gets the same rail with nothing moving.
 */

/* `ours` is one of Staw's drawings, which `Glyph` prefers over the Font
   Awesome one behind it. The quest laurel and the Brix mark are his; there
   is no drawing of a receipt or a gift, so those two stay Font Awesome. */
export const BRIX_TABS: { to: string; label: string; icon: IconDefinition; ours?: KobIcon }[] = [
  { to: '/quests', label: 'Quests', icon: faWandMagicSparkles, ours: 'laurel-quest' },
  { to: '/leaderboards', label: 'Leaderboards', icon: faRankingStar },
  { to: '/brix', label: 'My transactions', icon: faReceipt },
  { to: '/brix/codes', label: 'Redeem a code', icon: faGift },
]


function Rail() {
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const unseen = useNewQuests(profile?.id)
  const track = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null)

  const at = (to: string) => (to === '/brix' ? pathname === '/brix' : pathname.startsWith(to))

  useLayoutEffect(() => {
    const place = () => {
      const here = track.current?.querySelector<HTMLElement>('[data-here="true"]')
      if (!here) return setBar(null)
      setBar({ left: here.offsetLeft, width: here.offsetWidth })
      /* On a phone the rail is wider than the screen and the tab you are on
         can be off the right-hand edge. The rail is scrolled by hand rather
         than with `scrollIntoView`, which walks up the ancestors and drags
         the whole header sideways with it. */
      const rail = track.current
      if (rail && rail.scrollWidth > rail.clientWidth) {
        rail.scrollTo({
          left: here.offsetLeft - (rail.clientWidth - here.offsetWidth) / 2,
          behavior: 'smooth',
        })
      }
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [pathname])

  return (
    <div
      ref={track}
      className="relative -mx-4 flex gap-1 overflow-x-auto px-4 kob-scroll sm:mx-0 sm:px-0"
    >
      {BRIX_TABS.map((tab) => {
        const here = at(tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            data-here={here}
            aria-current={here ? 'page' : undefined}
            className={cn(
              'relative shrink-0 rounded-t-xl px-3.5 py-2.5 text-sm font-bold transition-colors sm:px-4',
              here ? 'text-white' : 'text-white/45 hover:text-white/80',
            )}
          >
            <Glyph icon={tab.icon} name={tab.ours} className="mr-2 inline-block h-3.5 w-3.5 align-[-2px]" />
            {tab.label}
            {tab.to === '/quests' && unseen > 0 && (
              <span
                className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5"
                aria-label={`${unseen} new`}
              >
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-bright" />
              </span>
            )}
          </Link>
        )
      })}

      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-ink-line" />
      {bar && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 h-0.5 rounded-full bg-brand-bright transition-[left,width] duration-300 ease-out"
          style={{ left: bar.left, width: bar.width }}
        />
      )}
    </div>
  )
}

export function BrixShell({
  title, lead, icon, ours, actions, children,
}: {
  title: string
  /** A short line, where a page has one worth saying. */
  lead?: ReactNode
  icon: IconDefinition
  /** One of Staw's, where there is one for what this page is. */
  ours?: KobIcon
  actions?: ReactNode
  children: ReactNode
}) {
  const { profile } = useAuth()
  const balance = profile?.pixels ?? 0

  return (
    <Page className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
        {/* Two lights rather than a flat panel: the brand one behind the
            words, a cooler one behind the balance, so the two halves of the
            header read as two things. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-brand/25 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-space/15 blur-3xl"
        />

        <div className="relative flex flex-wrap items-end justify-between gap-5 p-5 pb-4 sm:p-8 sm:pb-5">
          <div className="min-w-0">
            {/* The kicker carries the mark itself. The page's own glyph is
                beside the title in the rail below; the word up here is the
                currency, so the thing next to it is the currency. */}
            <p className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.3em] text-white/40">
              <CurrencyMark className="h-4 w-4" />
              {currency.plural}
            </p>
            <h1 className="mt-3 flex items-center gap-3 font-display text-3xl font-extrabold leading-[0.95] sm:text-4xl">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink-raised text-base text-brand-bright">
                <Glyph icon={icon} name={ours} className="h-5 w-5" />
              </span>
              {title}
            </h1>
            {lead && <p className="mt-2 max-w-md text-sm text-muted">{lead}</p>}
            {actions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
          </div>

          <div className="rounded-2xl border border-ink-line bg-ink-raised/80 px-5 py-4 backdrop-blur-sm">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Your balance
            </p>
            <p className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold tabular-nums">
              <CurrencyMark className="h-7 w-7" />
              {formatCount(balance)}
            </p>
          </div>
        </div>

        <div className="relative px-5 sm:px-8">
          <Rail />
        </div>
      </header>

      {/* Keyed on nothing: each page mounts its own children, and the one
          animation here is the page arriving under a rail that stayed put. */}
      <div>{children}</div>
    </Page>
  )
}
