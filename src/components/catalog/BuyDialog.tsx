/*
 * Asking before the Brix move.
 *
 * It was the site's generic `Confirm` with the price written into a bullet
 * list, which reads as a warning about a mistake rather than as a receipt
 * somebody is about to agree to. A purchase is worth its own card: the thing
 * being bought with its picture, what it costs, what that leaves, and one
 * button.
 *
 * It owns no money and makes no decision. The page hands it a thing and what
 * to do if yes, so it can be mounted anywhere - the item page, a shelf card,
 * the Workspace - and so the only place that spends Brix stays the server.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShirt, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { CurrencyMark } from '@/components/brand/Currency'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

export function BuyDialog({
  open, onClose, onBuy, busy, name, kind, price, picture, balance, note,
}: {
  open: boolean
  onClose: () => void
  onBuy: () => void | Promise<void>
  busy?: boolean
  name: string
  kind?: string
  price: number
  picture?: string | null
  /** What they hold now, so "what this leaves" is answered on the card. */
  balance: number
  /** One extra line, for a limited closing or anything else worth saying. */
  note?: string
}) {
  const short = balance < price
  const left = balance - price

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Buy ${name}?`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="yes" loading={busy} disabled={short} onClick={() => void onBuy()}>
            {short ? 'Not enough Brix' : 'Buy it'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-ink-raised">
            {picture
              ? <img src={picture} alt="" className="h-full w-full object-contain p-1" />
              : <FontAwesomeIcon icon={faShirt} className="text-2xl text-white/25" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-extrabold">{name}</p>
            {kind && <p className="text-xs capitalize text-muted">{kind}</p>}
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold">
              {price > 0
                ? <><CurrencyMark />{formatCount(price)}</>
                : <span className="text-space-bright">Free</span>}
            </p>
          </div>
        </div>

        {/*
          * What it costs and what it leaves, as two lines of one sum. The
          * second is the one somebody actually wants and the one a price tag
          * never answers.
          */}
        <dl className="space-y-1.5 rounded-xl border border-ink-line bg-ink-raised p-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">You have</dt>
            <dd className="inline-flex items-center gap-1 font-semibold">
              <CurrencyMark />{formatCount(balance)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-ink-line pt-1.5">
            <dt className="text-muted">{short ? 'You are short' : 'This leaves'}</dt>
            <dd className={cn(
              'inline-flex items-center gap-1 font-bold',
              short ? 'text-danger' : 'text-white',
            )}>
              <CurrencyMark />{formatCount(Math.abs(left))}
            </dd>
          </div>
        </dl>

        {note && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 text-amber-300" />
            <span>{note}</span>
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-muted">
          It is yours to keep and you can put it on straight away. Brix are
          spent the moment you press, and a purchase is not undone.
        </p>
      </div>
    </Dialog>
  )
}
