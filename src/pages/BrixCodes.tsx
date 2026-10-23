import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faGift, faCircleCheck, faCircleXmark, faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Kobby } from '@/components/brand/Kobby'
import { CurrencyMark } from '@/components/brand/Currency'
import { BrixShell } from '@/components/money/BrixShell'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { redeemCode } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { currency } from '@/lib/currency'

/**
 * Taking a code.
 *
 * The database decides everything: whether the code is real, whether it is
 * still going, whether you have had it, and what it is worth. This page types
 * it in and says what came back, which is the whole of its job.
 *
 * Staw asked for the shape Roblox's own redeem page has, simpler: the box on
 * the left with the balance under it, and a short list of places to go on
 * the right instead of paragraphs explaining the page to somebody who is
 * already on it.
 */

/** The list on the right. Every one of these is a page that exists. */
const elsewhere: { to: string; label: string }[] = [
  { to: '/quests', label: 'Earn more from quests' },
  { to: '/leaderboards', label: 'See where you stand' },
  { to: '/brix', label: 'Your transactions' },
  { to: '/support', label: 'A code would not take' },
]

export default function BrixCodes() {
  useTitle('Redeem a code')
  const { profile, refreshProfile } = useAuth()

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<{ good: boolean; words: string; reward?: number } | null>(null)

  const redeem = async () => {
    if (!code.trim()) return
    setBusy(true)
    setSaid(null)
    try {
      const answer = await redeemCode(code)
      setSaid({ good: true, words: answer.message, reward: answer.reward })
      setCode('')
      await refreshProfile()
    } catch (err) {
      setSaid({ good: false, words: err instanceof Error ? err.message : 'That did not work.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <BrixShell icon={faGift} title="Redeem a code">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
        {/* --------------------------------------------------- the box */}
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                Code
              </span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void redeem() }}
                placeholder="welcome26"
                autoComplete="off"
                spellCheck={false}
                aria-label="Code"
                className="font-mono tracking-wide"
              />
            </label>

            <Button
              icon={faCircleCheck}
              onClick={redeem}
              loading={busy}
              disabled={busy || !code.trim()}
              className="w-full"
            >
              Redeem
            </Button>

            {/* Keyed on what was said, so a second go at a code animates
                again rather than silently swapping the words in place. */}
            {said && (
              <div
                key={said.words}
                role="status"
                className={
                  said.good
                    ? 'animate-pop-in overflow-hidden rounded-2xl border border-space/40 bg-gradient-to-br from-space/20 to-ink-raised p-5 text-center'
                    : 'animate-pop-in rounded-2xl border border-danger/40 bg-danger/10 p-4'
                }
              >
                {said.good ? (
                  <>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-space/40 bg-space/15 text-space-bright">
                      <Glyph icon={faGift} className="text-lg" />
                    </span>
                    {!!said.reward && (
                      <p className="mt-3 flex items-center justify-center gap-2 font-display text-3xl font-extrabold tabular-nums text-space-bright">
                        <CurrencyMark className="h-7 w-7" />
                        {formatCount(said.reward)}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold">{said.words}</p>
                  </>
                ) : (
                  <p className="flex items-start gap-3 text-sm font-bold">
                    <Glyph icon={faCircleXmark} className="mt-0.5 shrink-0 text-danger" />
                    {said.words}
                  </p>
                )}
              </div>
            )}

            {/* The one line of small print this page needs, and the balance
                under it the way the reference has its credit. */}
            <p className="border-t border-ink-line pt-4 text-xs text-muted">
              One go per account.{' '}
              <Link to="/terms" className="font-bold text-white/70 hover:text-white">Terms</Link>
              {' · '}
              <Link to="/privacy" className="font-bold text-white/70 hover:text-white">Privacy</Link>
            </p>
            <p className="flex items-center gap-2 font-display text-base font-extrabold">
              Your {currency.plural}
              <span className="ml-auto flex items-center gap-1.5 tabular-nums">
                <CurrencyMark className="h-4 w-4" />
                {formatCount(profile?.pixels ?? 0)}
              </span>
            </p>
          </Card>
        </div>

        {/* ------------------------------------------------ the sidebar */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <h2 className="border-b border-ink-line px-5 py-3.5 font-display text-base font-extrabold">
              Elsewhere
            </h2>
            {elsewhere.map((one) => (
              <Link
                key={one.to}
                to={one.to}
                className="flex items-center gap-3 border-b border-ink-line px-5 py-3.5 text-sm font-bold transition-colors last:border-0 hover:bg-ink-hover"
              >
                <span className="min-w-0 flex-1 truncate">{one.label}</span>
                <Glyph icon={faChevronRight} className="h-3 w-3 shrink-0 text-muted" />
              </Link>
            ))}
          </Card>

          <Card className="relative flex items-center gap-5 overflow-hidden bg-gradient-to-br from-brand/25 to-ink-card p-6">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-space/20 blur-3xl"
            />
            <Kobby mood="notification" size="lg" bob={false} />
            <p className="relative font-display text-2xl font-extrabold leading-tight">
              Codes turn up at events.
            </p>
          </Card>
        </div>
      </div>
    </BrixShell>
  )
}
