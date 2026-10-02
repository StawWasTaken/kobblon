import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { CurrencyMark } from '@/components/brand/Currency'
import { formatCount } from '@/lib/format'
import type { ComponentProps } from 'react'

/*
 * The button that takes something.
 *
 * Staw's rule, in one place rather than on every page that happens to sell
 * something: if it costs Brix, the button says "Buy for" and then the Brix
 * mark and the number; if it is free, there is no mark at all - because a
 * currency mark next to the word Free is telling somebody about a price that
 * does not exist.
 *
 * "Buy for 40" rather than a bare "40", because a number on its own is a
 * label and not a sentence: it reads as what the thing costs, which the card
 * already said, instead of as the thing the button is about to do.
 *
 * Written as a component rather than written down as a rule, because a rule
 * about buttons is kept by whoever remembers it and the shop, the item page,
 * the Catalog row and the Marketplace were already saying "Get", "Take",
 * "Take it" and nothing at all for the same action.
 */
export function BuyButton({
  price, owned, ownedLabel = 'Owned', freeLabel = 'Take it',
  verb = 'Buy for', ...rest
}: {
  /** In Brix. Zero is free, and free is a different sentence. */
  price: number
  /** Already theirs: the button says so and does nothing. */
  owned?: boolean
  ownedLabel?: string
  freeLabel?: string
  /**
   * What the button is doing, before the price. "Buy for" nearly always;
   * a page that is renewing or topping up rather than buying says so.
   */
  verb?: string
} & Omit<ComponentProps<typeof Button>, 'children'>) {
  if (owned) {
    return (
      <Button variant="subtle" {...rest} disabled>
        <FontAwesomeIcon icon={faCheck} />
        {ownedLabel}
      </Button>
    )
  }

  if (price <= 0) {
    return <Button variant="yes" {...rest}>{freeLabel}</Button>
  }

  return (
    <Button {...rest}>
      <span>{verb}</span>
      <CurrencyMark />
      {formatCount(price)}
    </Button>
  )
}
