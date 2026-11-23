import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { faCreditCard, faGift } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Card } from '@/components/ui/Card'
import { BackLink } from '@/components/ui/BackLink'
import { Confirm } from '@/components/ui/Confirm'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { CurrencyMark } from '@/components/brand/Currency'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { buyKlub, klubPlans, myKlub } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * How you are paying: a page, not a popup.
 *
 * Staw wanted it as its own screen with the way back at the top, the same
 * one a Catalog item has. Buying a membership is not a yes/no over the top
 * of the prices - it is the step where somebody checks what they picked.
 *
 * Both ways of paying ask before they take anything, cards included, so
 * the card path is already the right shape the day there is a processor
 * behind it. Today that row is off: there is none, and a card form with
 * nothing behind it is the fake functionality this project has a rule
 * against.
 */

const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`

/** One way to pay. Grey, pressable, with what it costs written on it. */
function Way({ icon, title, note, flag, on, onPick }: {
  icon: React.ReactNode
  title: string
  note?: string
  /** A word where the row is not available: Paused. */
  flag?: string
  on: boolean
  onPick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={!on}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-2 border-b-4 px-4 py-3.5 text-left transition-colors',
        on
          ? 'border-ink-line bg-ink-raised hover:border-brand hover:bg-brand/10'
          : 'cursor-not-allowed border-ink-line bg-ink-raised/50 opacity-60',
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        {note && <span className="block text-xs text-muted">{note}</span>}
      </span>
      {flag && (
        <span className="shrink-0 rounded-full border-2 border-ink-line px-2 py-0.5 text-mini font-extrabold uppercase tracking-wide text-muted">
          {flag}
        </span>
      )}
    </button>
  )
}

export default function KlubPay() {
  const { plan: code } = useParams<{ plan: string }>()
  const { profile } = useAuth()
  const toast = useToast()
  const go = useNavigate()

  const plans = useAsync(() => klubPlans(), [])
  const mine = useAsync(async () => (profile ? myKlub() : null), [profile?.id])

  /** Which way is being confirmed, if any. */
  const [asking, setAsking] = useState<'brix' | 'card' | null>(null)

  const plan = (plans.data ?? []).find((one) => one.code === code) ?? null
  useTitle(plan ? `${plan.label} of Klub Kobblon` : 'Klub Kobblon')

  const here = mine.data
  const afford = plan && here ? here.brix >= plan.brix : true
  const running = here && here.tier !== 'none' && here.until

  const pay = async () => {
    if (!plan) return
    try {
      const until = await buyKlub(plan.code)
      toast(`In the Klub until ${new Date(until).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long', year: 'numeric',
      })}.`, 'success')
      go('/klub')
    } catch (err) {
      toast((err as Error).message)
      throw err
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <BackLink to="/klub">Back to Klub Kobblon</BackLink>

      {plans.error && <ErrorState message="The plans did not load." />}
      {plans.loading && <Skeleton className="h-64" />}
      {plans.data && !plan && (
        <EmptyState title="No such plan" body="It may have been taken off." />
      )}

      {plan && (
        <>
          <h1 className="font-display text-2xl font-extrabold leading-none sm:text-3xl">
            How you are paying
          </h1>

          <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
            {/* What you picked. */}
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <Icon name="klub-badge" className="h-8 w-8" />
                <div className="min-w-0">
                  <p className="font-display text-lg font-extrabold leading-tight">
                    {plan.label}
                  </p>
                  <p className="text-xs text-muted">Klub Kobblon</p>
                </div>
              </div>

              <dl className="mt-5 space-y-2.5 border-t-2 border-ink-line pt-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">To pay</dt>
                  <dd className="font-display text-xl font-extrabold tabular-nums">
                    {euros(plan.cents)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">In Brix</dt>
                  <dd className="inline-flex items-center gap-1.5 font-bold tabular-nums">
                    <CurrencyMark className="h-[0.95em] w-[0.95em]" />
                    {formatCount(plan.brix)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">It buys</dt>
                  <dd className="font-bold">{plan.months} months</dd>
                </div>
              </dl>

              <p className="mt-4 text-xs leading-snug text-muted">
                {running
                  ? 'Added to the end of what you already have, not instead of it.'
                  : 'It starts the moment it is paid for.'}
              </p>
            </Card>

            {/* How. */}
            <div>
              <p className="text-mini font-extrabold uppercase tracking-wide text-muted">
                Select payment
              </p>
              <div className="mt-2 space-y-2">
                <Way
                  icon={<Glyph icon={faCreditCard} className="text-muted" />}
                  title="Credit or debit card"
                  note={euros(plan.cents)}
                  flag="Paused"
                  on={false}
                />
                <Way
                  icon={<CurrencyMark className="h-5 w-5" />}
                  title="Pay in Brix"
                  note={
                    here && !afford
                      ? `${formatCount(plan.brix)} Brix - you have ${formatCount(here.brix)}`
                      : `${formatCount(plan.brix)} Brix`
                  }
                  flag={here && !afford ? 'Short' : undefined}
                  on={Boolean(profile) && !profile?.is_guest && afford}
                  onPick={() => setAsking('brix')}
                />
              </div>

              {!profile && (
                <p className="mt-3 text-xs text-muted">Log in to pay for a membership.</p>
              )}
            </div>
          </div>
        </>
      )}

      <Confirm
        open={asking !== null}
        onClose={() => setAsking(null)}
        onConfirm={pay}
        tone="primary"
        icon={asking === 'card' ? faCreditCard : faGift}
        title={plan ? `Pay for ${plan.label.toLowerCase()} of Klub?` : 'Pay for Klub?'}
        lead={
          plan
            ? asking === 'card'
              ? `${euros(plan.cents)} on your card, now.`
              : `${formatCount(plan.brix)} Brix, taken now.`
            : undefined
        }
        points={plan ? [
          `${plan.months} months of Klub Kobblon.`,
          running
            ? 'Added to the end of what you already have.'
            : 'It starts straight away.',
          'There is no refund once it is paid.',
        ] : undefined}
        confirmText={asking === 'card' ? 'Pay by card' : 'Pay in Brix'}
      />
    </div>
  )
}
