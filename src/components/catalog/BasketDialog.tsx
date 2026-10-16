/*
 * The basket, as a card.
 *
 * Its own component rather than markup inside the Catalog page, for the
 * reason every shared piece here is: it has to be mountable with nothing
 * around it. It takes its lines and what to do when somebody buys, and it
 * neither reads the basket nor spends anybody's Brix - so the page owns the
 * decision and this owns what it looks like.
 *
 * The rule it is built to is the server's: buying takes every item or none.
 * Four items, the Brix run out on the third, and somebody owning two of a
 * set with no idea which two is the thing a basket must never do.
 */
import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faShirt, faXmark, faBasketShopping } from '@fortawesome/free-solid-svg-icons'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { CurrencyMark } from '@/components/brand/Currency'
import {
  takeOutOfBasket, emptyBasket, BASKET_MOST, type BasketLine,
} from '@/hooks/useBasket'

export function BasketDialog({ open, onClose, lines, paying, balance, onBuy }: {
  open: boolean
  onClose: () => void
  lines: BasketLine[]
  paying: boolean
  /** What they hold, so the card can answer what this leaves. */
  balance: number
  onBuy: () => void
}) {
  const total = lines.reduce((sum, one) => sum + one.price, 0)
  const short = balance < total
  const left = balance - total

  /*
   * One press asked for the whole basket, same as the card a single thing
   * gets. Staw: "also add one for when theres stuff to the basket". A
   * basket is the larger spend of the two and was the one that went through
   * on a single press.
   *
   * It is a second state of this card rather than a dialog over a dialog:
   * what is being agreed to is the list already on screen, and covering it
   * to ask about it is asking somebody to remember what they cannot see.
   */
  const [sure, setSure] = useState(false)
  useEffect(() => { if (!open) setSure(false) }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your basket"
      description={`Up to ${BASKET_MOST} things. Buying takes all of them or none of them.`}
      footer={lines.length ? sure ? (
        <>
          <Button variant="ghost" disabled={paying} onClick={() => setSure(false)}>
            Back
          </Button>
          <Button
            variant="yes"
            icon={faBasketShopping}
            loading={paying}
            disabled={short}
            onClick={onBuy}
          >
            {short ? 'Not enough Brix' : 'Yes, buy them'}
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => emptyBasket()}>Empty it</Button>
          <Button variant="yes" icon={faBasketShopping} onClick={() => setSure(true)}>
            {/*
              * The mark, never the word. Staw: a button saying "for Brix"
              * should not exist anywhere - the icon is the word.
              */}
            {total > 0
              ? <>Buy all for <CurrencyMark className="mx-0.5" />{total}</>
              : 'Take all of them'}
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={onClose}>Close</Button>
      )}
    >
      {sure && lines.length > 0 && (
        <div className="mb-3 rounded-xl border border-brand/40 bg-brand/10 p-3">
          <p className="text-sm font-bold">
            {lines.length === 1 ? 'Buy this one' : `Buy all ${lines.length}`}
            {total > 0 ? <> for <CurrencyMark className="mx-0.5" />{total}?</> : '?'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {short
              ? <>That is more than the <CurrencyMark className="mx-0.5" />{balance} you hold.</>
              : total > 0
                ? <>That leaves you <CurrencyMark className="mx-0.5" />{left}.</>
                : 'They are free, and they are yours straight away.'}
          </p>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing in it. Put something aside from the Catalog and it waits here.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-raised p-2"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-media">
                {line.picture
                  ? <img src={line.picture} alt="" className="h-full w-full object-contain" />
                  : <Glyph icon={faShirt} className="text-white/25" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{line.name}</span>
                <span className="block text-xs capitalize text-muted">{line.kind}</span>
              </span>
              <span className="shrink-0 text-sm font-bold">
                {line.price > 0
                  ? <><CurrencyMark className="mr-0.5" />{line.price}</>
                  : 'Free'}
              </span>
              <button
                type="button"
                aria-label={`Take ${line.name} out`}
                onClick={() => takeOutOfBasket(line.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
              >
                <Glyph icon={faXmark} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
