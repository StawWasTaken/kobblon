import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faGift, faCircleXmark, faChevronDown,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Card } from '@/components/ui/Card'
import { PixelField } from '@/components/brand/PixelField'
import { Button } from '@/components/ui/Button'
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
 * Staw asked for the box itself to be the page: one field in the middle,
 * letters spaced out the way a code is written, the agreement line under it,
 * and the questions beside it rather than in front of it. No placeholder
 * code either - a real one printed in the box is a code given away.
 */

/**
 * What a code may contain, which Staw settled: lower case letters and
 * digits, nothing else. "welcome26", "spookytreat5". So the field takes
 * what it is given and keeps only that, rather than letting somebody type
 * a space or a capital and be told no by the database afterwards.
 */
const tidy = (said: string) => said.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Asked and answered. Nothing here promises anything the site does not do. */
const questions: { q: string; a: string }[] = [
  {
    q: 'Where do codes come from?',
    a: `Kobblon events, announcements, and anything worth celebrating. Most of them go out in the #codes channel on our Discord. They are never sold and never traded.`,
  },
  {
    q: 'What does a code look like?',
    a: 'Lower case letters and numbers, no spaces and no capitals, like welcome26. The box keeps your typing to that.',
  },
  {
    q: 'How many times can I use one?',
    a: 'Once per account. A code this account has already taken is refused.',
  },
  {
    q: 'Mine was refused. Why?',
    a: 'It has run out, it has closed, or this account has had it. The box says which of the three.',
  },
  {
    q: `Where do the ${currency.plural} go?`,
    a: 'Onto your balance as soon as the code takes, and onto your transactions as a line you can go back and read.',
  },
  {
    q: 'Somebody is offering me a code.',
    a: 'Nobody on Kobblon will ever ask for your password or your account in exchange for one. Report anybody who does.',
  },
]

function Question({ one }: { one: { q: string; a: string } }) {
  return (
    <details className="group border-b border-ink-line last:border-0 open:bg-ink-raised/60">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-bold transition-colors hover:bg-ink-hover">
        <span className="min-w-0 flex-1 group-open:text-brand-bright">{one.q}</span>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-ink-raised text-muted transition-transform duration-200 group-open:rotate-180 group-open:bg-brand/20 group-open:text-brand-bright">
          <Glyph icon={faChevronDown} className="h-3 w-3" />
        </span>
      </summary>
      {/* The answer slides rather than appearing, which is the one bit of
          movement an accordion needs to read as one. */}
      <p className="animate-step-next px-5 pb-4 text-sm text-muted">{one.a}</p>
    </details>
  )
}

export default function BrixCodes() {
  useTitle('Redeem a code')
  const { refreshProfile } = useAuth()

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
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:items-start">
        {/* ------------------------------------------------- the box */}
        <Card className="relative overflow-hidden">
          <PixelField className="opacity-25" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-card/40 via-ink-card/80 to-ink-card"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/25 blur-3xl"
          />

          <div className="relative mx-auto flex min-h-[34rem] w-full max-w-xl flex-col items-center justify-center px-5 py-12 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl border border-brand/40 bg-brand/15 text-2xl text-brand-bright shadow-[0_0_40px_rgba(27,52,232,0.35)]">
              <Glyph icon={faGift} />
            </span>

            <h2 className="mt-6 font-display text-3xl font-extrabold sm:text-4xl">Enter your code</h2>
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-white/35">
              letters and numbers
            </p>

            <label className="mt-7 block w-full">
              <span className="sr-only">Your code</span>
              <input
                value={code}
                onChange={(e) => setCode(tidy(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') void redeem() }}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={32}
                placeholder="------"
                aria-label="Your code"
                className="h-[4.5rem] w-full rounded-2xl border-2 border-ink-line bg-ink-raised text-center font-mono text-2xl font-extrabold lowercase tracking-[0.35em] text-white outline-none transition-[border-color,box-shadow] placeholder:text-white/15 focus:border-brand-bright focus:shadow-[0_0_0_4px_rgba(27,52,232,0.25)]"
              />
            </label>

            <Button
              onClick={redeem}
              loading={busy}
              disabled={busy || !code.trim()}
              size="lg"
              className="mt-4 h-14 w-full text-base tracking-wide"
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
                    ? 'mt-5 w-full animate-pop-in overflow-hidden rounded-2xl border border-space/40 bg-gradient-to-br from-space/20 to-ink-raised p-5'
                    : 'mt-5 w-full animate-pop-in rounded-2xl border border-danger/40 bg-danger/10 p-4'
                }
              >
                {said.good ? (
                  <>
                    {!!said.reward && (
                      <p className="flex items-center justify-center gap-2 font-display text-4xl font-extrabold tabular-nums text-space-bright">
                        <CurrencyMark className="h-8 w-8" />
                        {formatCount(said.reward)}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-bold">{said.words}</p>
                  </>
                ) : (
                  <p className="flex items-center justify-center gap-3 text-sm font-bold">
                    <Glyph icon={faCircleXmark} className="shrink-0 text-danger" />
                    {said.words}
                  </p>
                )}
              </div>
            )}

            <p className="mt-6 text-xs text-muted">
              By redeeming a code you agree to the{' '}
              <Link to="/terms" className="font-bold text-white/70 hover:text-white">Terms of Use</Link>
              {', the '}
              <Link to="/policies/money" className="font-bold text-white/70 hover:text-white">
                {currency.plural} policy
              </Link>
              {' and the '}
              <Link to="/guidelines" className="font-bold text-white/70 hover:text-white">
                community guidelines
              </Link>
              . One go per account.
            </p>
          </div>
        </Card>

        {/* ------------------------------------------------- questions */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <h2 className="border-b border-ink-line px-5 py-4 font-display text-base font-extrabold">
              Frequently asked questions
            </h2>
            {questions.map((one) => <Question key={one.q} one={one} />)}
          </Card>
        </div>
      </div>
    </BrixShell>
  )
}
