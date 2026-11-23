import { useState } from 'react'
import { faGift } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { CurrencyMark } from '@/components/brand/Currency'
import { KlubMark } from '@/components/brand/Verified'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  claimKlubOffer, klubOffers, klubPlans, myKlub,
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
  /* The reaction face itself, and with no `tone` it is painted the colour
     of the row rather than its own yellow: the coloured one is what a face
     looks like once somebody has pressed it. */
  { title: 'Reacting to Worlds and clips', face: 'reaction-smile' as const },
] as const

export default function Klub() {
  useTitle('Klub Kobblon')
  const { profile } = useAuth()
  const toast = useToast()

  const plans = useAsync(() => klubPlans(), [])
  const offers = useAsync(() => klubOffers(), [])
  const mine = useAsync(async () => (profile ? myKlub() : null), [profile?.id])

  const [busy, setBusy] = useState(false)

  const here = mine.data
  const running = here && here.tier !== 'none'

  /* Cheapest by the month, worked out from the rows rather than written
     into one of them, so it follows a price change on its own. */
  const best = (plans.data ?? []).reduce<KlubPlan | null>(
    (low, one) => (!low || one.cents / one.months < low.cents / low.months ? one : low), null,
  )?.code

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
                <span className={cn(
                  'absolute -top-3 left-5 rounded-full border-2 px-2.5 py-0.5 text-mini font-extrabold uppercase tracking-wide',
                  /* The cheapest by the month is the one Kobblon is
                     pointing at, so it is the one in Kobblon's blue. */
                  best === plan.code
                    ? 'border-brand-deep bg-brand text-on-art'
                    : 'border-ink-line bg-ink-raised text-muted',
                )}>
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
              <Button
                variant={best === plan.code ? 'primary' : 'subtle'}
                block
                className="mt-4"
                to={`/klub/pay/${plan.code}`}
              >
                Choose
              </Button>
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
                  : <Icon name={perk.face} className="h-5 w-5 text-brand-bright" />}
              </span>
              <span className="text-sm font-bold">{perk.title}</span>
            </Card>
          ))}
        </div>
      </section>

    </div>
  )
}
