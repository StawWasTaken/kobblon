import { Menu } from '@/components/ui/Menu'
import { CurrencyMark } from '@/components/brand/Currency'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { faReceipt, faGift, faStore, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'

/**
 * What you have, and what you can do about it.
 *
 * Pressing the number used to drop you in settings, which is where the
 * balance happened to live rather than where somebody looking at their money
 * wants to be. It opens what you can do about it instead: where to earn it,
 * where it went, how to redeem a code, and where to spend it.
 *
 * Quests leads, because it is the only one of the four that answers "how do
 * I get more", which is what somebody pressing their own balance is usually
 * asking.
 */
export function CurrencyBalance({ amount }: { amount: number }) {
  return (
    <Menu
      label={`Your ${currency.plural}`}
      align="right"
      trigger={
        <span
          className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-bold text-onbrand transition-colors hover:bg-onbrand/15 sm:flex"
          aria-label={currency.amount(amount)}
        >
          <CurrencyMark />
          {formatCount(amount)}
        </span>
      }
      items={[
        { label: 'Quests', icon: faWandMagicSparkles, ours: 'laurel-quest', to: '/quests' },
        { label: 'My transactions', icon: faReceipt, to: '/brix' },
        { label: 'Redeem a code', icon: faGift, to: '/brix/codes' },
        { label: `Spend ${currency.plural}`, icon: faStore, to: '/style' },
      ]}
    />
  )
}
