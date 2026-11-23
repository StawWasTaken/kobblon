import { useState } from 'react'
import { faCreditCard, faFaceSmile, faGift } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { CurrencyMark } from '@/components/brand/Currency'
import { KlubMark } from '@/components/brand/Verified'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  buyKlub, claimKlubOffer, klubOffers, klubPlans, myKlub,
  type KlubPlan,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * Klub Kobblon.
 *
 * The prices come from `klub_plans`, the free windows from `klub_offers`,
 * and whether an offer is open to *you* from `my_klub`. Nothing on this
 * page decides any of it: a page that works out its own eligibility offers
 * a free year to somebody who cannot have one, and a page that sends its
 * own price sets it.
 *
 * Cards: there is no processor. The payment card says so where somebody
 * actually looks for it - after they have picked a plan - rather than in a
 * box above the prices.
 */

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`

/** By the month, which is the number worth comparing two plans on. */
const monthly = (plan: KlubPlan) => euros(Math.round(plan.cents / plan.months))

/** What a membership does. Both of these are enforced by the server. */
const perks = [
  { title: 'The gold hard hat by your name', mark: true },
  { title: 'Reacting to Worlds and clips', icon: faFaceSmile },
] as const

export default function Klub() {
  useTitle('Klub Kobblon')
  const { profile } = useAuth()
  const toast = useToast()

  const plans = useAsync(() => klubPlans(), [])
  const offers = useAsync(() => klubOffers(), [])
  const mine = useAsync(async () => (profile ? myKlub() : null), [profile?.id])

  const [paying, setPaying] = useState<KlubPlan | null>(null)
  const [busy, setBusy] = useState(false)

  const here = mine.data
  const running = here && here.tier !== 'none'

  /* The offers this account can take right now. The server says which. */
  const open = (offers.data ?? []).filter((one) => (here?.offers ?? []).includes(one.code))

  const take = async (code: string) => {
    setBusy(true)
    const answer = await claimKlubOffer(code).catch(() => 'wrong' as const)
    setBusy(false)
    if (answer === 'given') {
      mine.reload()
      toast('In the Klub. Enjoy.', 'success')
    } else if (answer === 'had') {
      toast('You have already had that one.')
    } else if (answer === 'shut') {
      toast('That offer has closed.')
    } else {
      toast('That offer is not for this account.')
    }
  }

  const buy = async () => {
    if (!paying) return
    setBusy(true)
    try {
      const until = await buyKlub(paying.code)
      mine.reload()
      toast(`In the Klub until ${day(until)}.`, 'success')
      setPaying(null)
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const afford = paying && here ? here.brix >= paying.brix : true

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">

      {/* ------------------------------------------------------------ top */}
      <header className="relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line">
        <img
          src="/brand/waves.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative p-5 sm:p-7">
          <div className="min-w-0">
            <Icon name="klub-badge" className="h-9 w-9" />
            <h1 className="mt-3 font-display text-3xl font-extrabold leading-none sm:text-4xl">
              Klub Kobblon
            </h1>
            <p className="mt-2 text-sm text-on-art/70">
              {running
                ? here!.tier === 'life'
                  ? 'Yours for life.'
                  : `${here!.is_trial ? 'Free' : 'Yours'} until ${day(here!.until!)}.`
                : 'The membership.'}
            </p>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- plans */}
      {plans.error && <ErrorState message="The plans did not load." />}
      {plans.loading && <Skeleton className="h-44" />}

      {plans.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.data.map((plan) => (
            <Card key={plan.code} className="relative flex flex-col p-5">
              {plan.flag && (
                <span className="absolute -top-3 left-5 rounded-full border-2 border-ink-line bg-ink-raised px-2.5 py-0.5 text-mini font-extrabold uppercase tracking-wide text-muted">
                  {plan.flag}
                </span>
              )}
              <p className="text-sm font-extrabold">{plan.label}</p>
              <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">
                {euros(plan.cents)}
              </p>
              <p className="mt-0.5 text-xs text-muted">{monthly(plan)} a month</p>
              <p className="mt-3 flex items-center gap-1 text-xs text-muted">
                <CurrencyMark className="h-[0.95em] w-[0.95em]" />
                {formatCount(plan.brix)} in Brix
              </p>
              <div className="flex-1" />
              <GuestGate action="buy Klub">
                <Button variant="subtle" block className="mt-4" onClick={() => setPaying(plan)}>
                  Choose
                </Button>
              </GuestGate>
            </Card>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------- offers */}
      {open.map((offer) => (
        <div
          key={offer.code}
          className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-b-4 border-space-deep bg-space/15 px-5 py-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-space-bright text-on-art">
            <Glyph icon={faGift} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-extrabold">{offer.title}</p>
            <p className="mt-0.5 text-sm text-muted">Open until {day(offer.closes)}.</p>
          </div>
          <Button variant="yes" disabled={busy} onClick={() => void take(offer.code)}>
            {offer.months === 12 ? 'Claim the free year' : `Claim ${offer.months} months`}
          </Button>
        </div>
      ))}

      {!profile && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-raised text-brand-bright">
            <Glyph icon={faGift} />
          </span>
          <p className="min-w-0 flex-1 text-sm font-bold">
            A free year of Klub is going. Log in to claim it.
          </p>
          <Button to="/login" variant="yes">Log in</Button>
        </div>
      )}

      {/* ---------------------------------------------------------- perks */}
      <section>
        <h2 className="font-display text-lg font-extrabold">What you get</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {perks.map((perk) => (
            <Card key={perk.title} className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-raised">
                {'mark' in perk
                  ? <KlubMark className="h-5 w-5" />
                  : <Glyph icon={perk.icon} className="text-brand-bright" />}
              </span>
              <span className="text-sm font-bold">{perk.title}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- paying */}
      <Dialog
        open={paying !== null}
        onClose={() => { if (!busy) setPaying(null) }}
        title="How you are paying"
        description={paying ? `${paying.label} of Klub Kobblon, ${euros(paying.cents)}.` : undefined}
      >
        <div className="space-y-2">
          {/*
            * Cards first, because that is where an eye goes, and disabled,
            * because there is no processor. A row that says "paused" and
            * cannot be pressed is honest about the same thing a card form
            * with nothing behind it would lie about.
            */}
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl border-2 border-ink-line bg-ink-raised/60 px-4 py-3 text-left opacity-60"
          >
            <Glyph icon={faCreditCard} className="w-5 text-muted" />
            <span className="min-w-0 flex-1 text-sm font-bold">Credit or debit card</span>
            <span className="rounded-full border-2 border-ink-line px-2 py-0.5 text-mini font-extrabold uppercase tracking-wide text-muted">
              Paused
            </span>
          </button>

          <button
            type="button"
            disabled={busy || !afford}
            onClick={() => void buy()}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors',
              afford
                ? 'border-ink-line bg-ink-raised hover:border-brand hover:bg-brand/10'
                : 'cursor-not-allowed border-ink-line bg-ink-raised/60 opacity-60',
            )}
          >
            <CurrencyMark className="h-5 w-5" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {busy ? 'Paying…' : 'Pay in Brix'}
              </span>
              <span className="block text-xs text-muted">
                {paying && `${formatCount(paying.brix)} Brix`}
                {here && !afford && ` - you have ${formatCount(here.brix)}`}
              </span>
            </span>
          </button>
        </div>
      </Dialog>
    </div>
  )
}
