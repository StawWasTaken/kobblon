import { useEffect, useState } from 'react'
import {
  faArrowRight, faCreditCard, faFaceSmile, faGift, faLock,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Note } from '@/components/ui/Note'
import { Confirm } from '@/components/ui/Confirm'
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
  type KlubOffer, type KlubPlan, type MyKlub,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * Klub Kobblon.
 *
 * The membership has existed in the database since 0235 and there has
 * never been a way to get one. This is that way, and the two things Staw
 * wants the launch to carry: a free year for anybody who turns up before
 * January, and three months on the house over Christmas for anybody whose
 * membership is already running.
 *
 * Two rules this page is built around.
 *
 * **Nothing here decides anything.** The prices come from `klub_plans`,
 * the windows from `klub_offers`, and whether an offer is open to *you*
 * from `my_klub`. A page that works out its own eligibility is a page that
 * offers a free year to somebody who cannot have one, and a page that
 * sends its own price is a page that sets it.
 *
 * **Nothing here is promised that does not work.** The perks listed are
 * the two the database actually enforces today. Cards are named because
 * people ask, and said to be paused, because there is no card processor
 * and a card field with nothing behind it is the fake functionality this
 * project has a rule against.
 */

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

/** A hundred Brix to the euro, which is how the plans are priced. */
const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`

/** What a plan works out at by the month, which is the thing worth comparing. */
const byTheMonth = (plan: KlubPlan) => Math.round(plan.brix / plan.months)

/** The two things a membership does today. Both enforced by the server. */
const perks = [
  {
    mark: <KlubMark className="h-6 w-6" />,
    title: 'The hard hat by your name',
    says: 'Gold, everywhere your name is written: your profile, the forum, chat, a World page. It goes the day your membership runs out and comes back the day it starts again.',
  },
  {
    icon: faFaceSmile,
    title: 'Reacting to Worlds and clips',
    says: 'The faces under a World and under a clip are a Klub thing. Posts and comments are everybody; these two are yours.',
  },
] as const

/** One length of Klub, with what it costs and what that is by the month. */
function Plan({ plan, best, mine, onBuy, busy }: {
  plan: KlubPlan
  /** The cheapest by the month, worked out from the rows rather than written. */
  best: boolean
  mine: MyKlub | null
  onBuy: () => void
  busy: boolean
}) {
  const afford = mine ? mine.brix >= plan.brix : true

  return (
    <Card className={cn(
      'relative flex flex-col p-5',
      best && 'border-brand',
    )}>
      {plan.flag && (
        <span className={cn(
          'absolute -top-3 left-5 rounded-full border-2 px-2.5 py-0.5 text-mini font-extrabold uppercase tracking-wide',
          best ? 'border-brand-deep bg-brand text-on-art' : 'border-ink-line bg-ink-raised text-muted',
        )}>
          {plan.flag}
        </span>
      )}

      <p className="font-display text-lg font-extrabold">{plan.label}</p>

      <p className="mt-3 flex items-center gap-1.5 font-display text-2xl font-extrabold tabular-nums">
        <CurrencyMark className="h-[0.8em] w-[0.8em]" />
        {formatCount(plan.brix)}
      </p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
        <CurrencyMark className="h-[0.9em] w-[0.9em]" />
        {formatCount(byTheMonth(plan))} a month
      </p>

      <p className="mt-3 border-t border-ink-line/70 pt-3 text-xs text-muted">
        {euros(plan.cents)} by card, once cards are back.
      </p>

      <div className="mt-4 flex-1" />

      <GuestGate action="buy Klub">
        <Button
          variant={best ? 'primary' : 'ghost'}
          block
          disabled={busy || (mine !== null && !afford)}
          onClick={onBuy}
        >
          {mine && !afford ? 'Not enough Brix' : 'Pay in Brix'}
        </Button>
      </GuestGate>
    </Card>
  )
}

export default function Klub() {
  useTitle('Klub Kobblon')
  const { profile } = useAuth()
  const toast = useToast()

  const plans = useAsync(() => klubPlans(), [])
  const offers = useAsync(() => klubOffers(), [])
  const mine = useAsync(async () => (profile ? myKlub() : null), [profile?.id])

  const [buying, setBuying] = useState<KlubPlan | null>(null)
  const [busy, setBusy] = useState(false)
  /** What turning up just earned, if anything. */
  const [won, setWon] = useState<KlubOffer | null>(null)

  /*
   * Turning up is the whole offer, so taking it happens on arrival rather
   * than behind a button somebody has to notice.
   *
   * Which offers are open to this account is asked for at the moment of
   * use, not held: `mine.data.offers` is worked out by the server on the
   * same call that says where the membership stands, so a year claimed in
   * another tab is already gone by the time this runs.
   */
  useEffect(() => {
    const open = mine.data?.offers ?? []
    if (!profile || open.length === 0) return
    let wanted = true

    void (async () => {
      for (const code of open) {
        const answer = await claimKlubOffer(code).catch(() => 'wrong' as const)
        if (!wanted) return
        if (answer === 'given') {
          const offer = (offers.data ?? []).find((one) => one.code === code) ?? null
          setWon(offer)
          mine.reload()
          return
        }
      }
    })()

    return () => { wanted = false }
  }, [profile?.id, mine.data?.offers?.join(',')])

  const buy = async () => {
    if (!buying) return
    setBusy(true)
    try {
      const until = await buyKlub(buying.code)
      mine.reload()
      toast(`In the Klub until ${day(until)}.`, 'success')
      setBuying(null)
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const here = mine.data
  const running = here && here.tier !== 'none'
  const cheapest = (plans.data ?? []).reduce<KlubPlan | null>(
    (low, one) => (!low || byTheMonth(one) < byTheMonth(low) ? one : low), null,
  )

  /* The offers worth drawing: the ones whose window is open today. */
  const now = Date.now()
  const live = (offers.data ?? []).filter(
    (one) => now >= Date.parse(one.opens) && now < Date.parse(one.closes),
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">

      {/* ---------------------------------------------------------- the top */}
      <section className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
        <div className="relative px-5 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/25 via-transparent to-transparent" />
          <div className="relative">
            <Icon name="klub-badge" className="h-12 w-12" />
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-none sm:text-4xl">
              Klub Kobblon
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              The membership. A gold hard hat by your name and the run of the things
              that are the Klub's, for as long as it runs.
            </p>

            {here && (
              <p className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-xl border-2 border-ink-line bg-ink-raised px-3.5 py-2 text-sm">
                {running ? <KlubMark className="h-5 w-5" /> : <Glyph icon={faLock} className="text-muted" />}
                <span className="font-bold">
                  {here.tier === 'life'
                    ? 'You are in the Klub for life.'
                    : running
                      ? `${here.is_trial ? 'Your free Klub' : 'Your Klub'} runs to ${day(here.until!)}.`
                      : 'You are not in the Klub.'}
                </span>
              </p>
            )}

            {!profile && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button to="/signup" variant="yes">Make an account</Button>
                <Button to="/login" variant="ghost">Log in</Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- the offers */}
      {won && (
        <Note tone="yes" icon={faGift}>
          <span>
            <strong className="font-extrabold">{won.title}.</strong>{' '}
            {won.months === 12
              ? 'A year of Klub Kobblon, on the house, for turning up early.'
              : `${won.months} months added to the end of your membership.`}{' '}
            {here?.until && `It runs to ${day(here.until)}.`}
          </span>
        </Note>
      )}

      {live.length > 0 && (
        <section className="space-y-3">
          {live.map((offer) => {
            const open = (here?.offers ?? []).includes(offer.code)
            return (
              <div
                key={offer.code}
                className={cn(
                  'flex flex-wrap items-center gap-4 rounded-2xl border-2 border-b-4 px-5 py-4',
                  open ? 'border-space-deep bg-space/15' : 'border-ink-line bg-ink-card',
                )}
              >
                <span className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
                  open ? 'bg-space-bright text-on-art' : 'bg-ink-raised text-muted',
                )}>
                  <Glyph icon={faGift} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-extrabold">{offer.title}</p>
                  <p className="mt-0.5 text-sm leading-snug text-muted">{offer.says}</p>
                  <p className="mt-1 text-xs text-muted">
                    Open until {day(offer.closes)}.
                  </p>
                </div>
                {!profile && (
                  <Button to="/login" variant="yes" icon={faArrowRight}>
                    Log in and take it
                  </Button>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* -------------------------------------------------------- the perks */}
      <section>
        <h2 className="font-display text-xl font-extrabold">What it gets you</h2>
        <p className="mt-1 text-sm text-muted">
          Two things, and this is the whole list. More will be added, and nothing is
          written here that does not already work.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {perks.map((perk) => (
            <Card key={perk.title} className="flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-raised">
                {'mark' in perk ? perk.mark : <Glyph icon={perk.icon} className="text-brand-bright" />}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-extrabold">{perk.title}</span>
                <span className="mt-1 block text-sm leading-snug text-muted">{perk.says}</span>
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- the plans */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold">What it costs</h2>
            <p className="mt-1 text-sm text-muted">
              The longer the plan, the less it is by the month.
            </p>
          </div>
          {here && (
            <p className="inline-flex items-center gap-1.5 rounded-xl border-2 border-ink-line bg-ink-card px-3 py-1.5 text-sm font-bold tabular-nums">
              <CurrencyMark className="h-[0.9em] w-[0.9em]" />
              {formatCount(here.brix)}
              <span className="font-normal text-muted">yours</span>
            </p>
          )}
        </div>

        {plans.error && <ErrorState message="The plans did not load." />}
        {plans.loading && <Skeleton className="mt-4 h-40" />}

        {plans.data && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.data.map((plan) => (
              <Plan
                key={plan.code}
                plan={plan}
                best={cheapest?.code === plan.code}
                mine={here}
                busy={busy}
                onBuy={() => setBuying(plan)}
              />
            ))}
          </div>
        )}

        <Note className="mt-4" icon={faCreditCard}>
          Cards are paused. Brix works today; credit and debit cards are being set up
          and this page will say so the day they are on.
        </Note>
      </section>

      <Confirm
        open={buying !== null}
        onClose={() => { if (!busy) setBuying(null) }}
        onConfirm={() => void buy()}
        title={buying ? `${buying.label} of Klub` : 'Klub'}
        lead={
          buying
            ? `${formatCount(buying.brix)} Brix, taken now. It is added to the end of what you already have, not instead of it.`
            : undefined
        }
        confirmText={busy ? 'Paying…' : 'Pay in Brix'}
        icon={faGift}
        tone="primary"
      />
    </div>
  )
}
