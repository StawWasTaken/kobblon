import { Glyph } from '@/components/brand/Glyph'
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
 * **One colour, whatever it costs.** This used to go green when a thing was
 * free and blue when it was not, which Staw rejected and was right to: a
 * button changing colour by price makes the colour mean price, and on this
 * site blue means "where you are" and green means "yes, do it". Two
 * identical rows of cards then came out two different colours for no reason
 * a person could name.
 *
 * **Green**, by Staw's later call: "make the buy buttons green". It was
 * blue, on the argument that twenty of these on a screen is twenty greens
 * and the ratio goes the wrong way. He has looked at the shop with both and
 * wants the yes - buying is the one thing a Catalog row is for, and it now
 * reads as the same yes as save, publish and play. A caller may still pass
 * its own `variant` where a page has a reason.
 *
 * Written as a component rather than written down as a rule, because a rule
 * about buttons is kept by whoever remembers it and the shop, the item page,
 * the Catalog row and the Marketplace were already saying "Get", "Take",
 * "Take it" and nothing at all for the same action.
 */
export function BuyButton({
  price, owned, ownedLabel = 'Owned', freeLabel = 'Take it',
  verb = 'Buy for', variant = 'yes', ...rest
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
    /*
     * Owned, and still a button when there is something to do.
     *
     * It was `disabled` unconditionally, which was right when "owned" only
     * ever meant "you cannot buy this twice" - and wrong the moment the
     * label became "Wear it": Kobblon owned a face and the control to put it
     * on was greyed out. A button is disabled because there is nothing to
     * do, never because of what it says.
     */
    return (
      <Button
        variant="subtle"
        {...rest}
        disabled={rest.disabled ?? !rest.onClick}
      >
        <Glyph icon={faCheck} />
        {ownedLabel}
      </Button>
    )
  }

  if (price <= 0) {
    return <Button variant={variant} {...rest}>{freeLabel}</Button>
  }

  return (
    <Button variant={variant} {...rest}>
      {/*
        * The mark and the number are one thing, so they are one element:
        * the button's own gap was landing between them and reading as
        * "Buy for ... 45" with a hole in the middle.
        */}
      <span>{verb}</span>
      <span className="inline-flex items-center gap-0.5">
        <CurrencyMark />
        {formatCount(price)}
      </span>
    </Button>
  )
}
