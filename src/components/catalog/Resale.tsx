/*
 * The market in a limited: what it is going for, who is offering one, and
 * the way to put yours up.
 *
 * Staw: "people who own limited items can resell them and affect the average
 * price too (economy system)". Only a limited has a market, and that is the
 * point of one - a thing you can still buy from its maker has a price, and
 * the shop never runs out.
 *
 * Every number here is the database's. The average is of sales, not of
 * offers: offers are what people hope for.
 */
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTag, faArrowTrendUp } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { CurrencyMark } from '@/components/brand/Currency'
import { BuyButton } from '@/components/money/BuyButton'
import {
  resalePrices, resaleOffers, listResale, cancelResale, buyResale,
} from '@/lib/api'
import { formatCount } from '@/lib/format'

export function Resale({ itemId, owned, canTrade, onChanged }: {
  itemId: string
  /** Whether this person has one to sell. */
  owned: boolean
  /** Signed in and not a guest; the server decides for real. */
  canTrade: boolean
  onChanged: () => void
}) {
  const say = useToast()
  const prices = useAsync(async () => resalePrices(itemId), [itemId])
  const offers = useAsync(async () => resaleOffers(itemId), [itemId])

  const [asking, setAsking] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const mine = (offers.data ?? []).find((one) => one.mine)

  const run = async (what: string, doIt: () => Promise<unknown>, said: string) => {
    setBusy(what)
    try {
      await doIt()
      say(said, 'success')
      prices.reload()
      offers.reload()
      onChanged()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-base font-extrabold">
        <FontAwesomeIcon icon={faArrowTrendUp} className="text-white/50" />
        Going for
      </h2>

      {prices.loading ? <Skeleton className="h-10" /> : (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="text-muted">Cheapest now </span>
            {prices.data?.cheapest
              ? <><CurrencyMark className="mx-0.5" />{formatCount(prices.data.cheapest)}</>
              : <span className="text-muted">nobody is selling</span>}
          </span>
          <span>
            <span className="text-muted">Average of the last sales </span>
            {prices.data?.average
              ? <><CurrencyMark className="mx-0.5" />{formatCount(prices.data.average)}</>
              : <span className="text-muted">none yet</span>}
          </span>
          <span className="text-muted">
            {formatCount(prices.data?.sold ?? 0)} sold
          </span>
        </div>
      )}

      {/* Yours to put up, or to take back. */}
      {owned && canTrade && (
        mine ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-line bg-ink-raised p-2.5 text-sm">
            <span>
              You are asking <CurrencyMark className="mx-0.5" />{formatCount(mine.price)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              loading={busy === 'cancel'}
              onClick={() => void run('cancel', () => cancelResale(mine.id), 'Taken back.')}
            >
              Take it back
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="Sell yours for"
              type="number"
              min={1}
              value={asking}
              onChange={(e) => setAsking(e.target.value)}
              className="w-36"
            />
            <Button
              variant="subtle"
              icon={faTag}
              loading={busy === 'list'}
              disabled={!asking || Number(asking) < 1}
              onClick={() => void run('list', async () => {
                await listResale(itemId, Math.round(Number(asking)))
                setAsking('')
              }, 'It is up for sale.')}
            >
              Offer it
            </Button>
          </div>
        )
      )}

      {/* Everybody else's offers, cheapest first. */}
      {offers.loading ? <Skeleton className="h-16" /> : !offers.data?.length ? (
        <p className="text-sm text-muted">Nobody is offering one right now.</p>
      ) : (
        <ul className="space-y-1.5">
          {offers.data.map((offer) => (
            <li
              key={offer.id}
              className="flex items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {offer.mine ? 'You' : offer.seller_display_name}
              </span>
              {offer.mine ? (
                <span className="text-muted">
                  <CurrencyMark className="mr-0.5" />{formatCount(offer.price)}
                </span>
              ) : (
                <BuyButton
                  size="sm"
                  price={offer.price}
                  loading={busy === offer.id}
                  disabled={!canTrade || owned}
                  onClick={() => void run(offer.id, () => buyResale(offer.id), 'It is yours.')}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
