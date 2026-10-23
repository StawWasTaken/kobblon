import { useState } from 'react'
import { faGift, faReceipt, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BackLink } from '@/components/ui/BackLink'
import { Kobby } from '@/components/brand/Kobby'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { redeemCode } from '@/lib/api'
import { currency } from '@/lib/currency'

/**
 * Taking a code.
 *
 * The database decides everything: whether the code is real, whether it is
 * still going, whether you have had it, and what it is worth. This page types
 * it in and says what came back, which is the whole of its job.
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
    <Page className="space-y-5">
      <BackLink to="/brix">Back to your transactions</BackLink>

      <PageHeader
        kicker={currency.plural}
        icon={faGift}
        title="Redeem a code"
        lead={`Codes turn up in Kobblon events, from the people who run them, and now and then for no reason at all. One go each.`}
      />

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
            disabled={busy || !code.trim()}
            className="w-full"
          >
            {busy ? 'One moment' : 'Redeem'}
          </Button>

          {said && (
            <div
              className={
                said.good
                  ? 'rounded-xl border border-space/40 bg-space/10 p-4'
                  : 'rounded-xl border border-danger/40 bg-danger/10 p-4'
              }
              role="status"
            >
              <p className="text-sm font-bold">{said.words}</p>
              {said.good && !!said.reward && (
                <p className="mt-1 text-sm text-muted">
                  {currency.amount(said.reward)} added to your account.
                </p>
              )}
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted">
            Capital letters and spaces do not matter. A code can be taken once per account, and
            some run out or stop working on a date.
          </p>
        </Card>

        <Card className="flex flex-wrap items-center gap-5 p-5">
          <Kobby mood="notification" size="md" bob={false} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-extrabold">Where codes come from</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Kobblon hands them out at events, in announcements, and alongside things worth
              celebrating. Nobody on Kobblon will ever ask you for your password in exchange
              for one, and anybody who does is worth reporting.
            </p>
            <Button className="mt-4" variant="subtle" icon={faReceipt} to="/brix">
              See what you have spent
            </Button>
          </div>
        </Card>
      </div>
    </Page>
  )
}
