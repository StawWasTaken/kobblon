import { useState } from 'react'
import {
  faGift, faCircleCheck, faCircleXmark, faWandMagicSparkles, faRankingStar,
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

/**
 * Taking a code.
 *
 * The database decides everything: whether the code is real, whether it is
 * still going, whether you have had it, and what it is worth. This page types
 * it in and says what came back, which is the whole of its job.
 *
 * What it says back is the part that was worth redrawing. A code that worked
 * used to print a line of text the same size as the note underneath it, so
 * the best thing that happens on this page looked like a form validation
 * message. It is a reward now, with the amount counting up into it, and a
 * refusal is plainly a refusal rather than the same box in another colour.
 */
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
    <BrixShell
      icon={faGift}
      title="Redeem a code"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <Card className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              Your code
            </span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void redeem() }}
              placeholder="welcome26"
              autoComplete="off"
              spellCheck={false}
              aria-label="Your code"
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

          {/* Keyed on what was said, so a second go at a code animates again
              rather than silently swapping the words in place. */}
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

        </Card>

        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-5 p-5">
            <Kobby mood="notification" size="md" bob={false} />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-extrabold">One go per account</h2>
              <p className="mt-1 text-sm text-muted">
                Nobody here will ask for your password for a code.
              </p>
            </div>
          </Card>

          {/* A code is a one-off. The two things that are not are worth
              saying here rather than leaving this page as a dead end. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand-bright">
                <Glyph icon={faWandMagicSparkles} />
              </span>
              <h3 className="mt-3 font-display text-base font-extrabold">Quests</h3>
              <Button className="mt-3" variant="subtle" to="/quests">The board</Button>
            </Card>

            <Card className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-space/15 text-space-bright">
                <Glyph icon={faRankingStar} />
              </span>
              <h3 className="mt-3 font-display text-base font-extrabold">Leaderboards</h3>
              <Button className="mt-3" variant="subtle" to="/leaderboards">Where you stand</Button>
            </Card>
          </div>
        </div>
      </div>
    </BrixShell>
  )
}
