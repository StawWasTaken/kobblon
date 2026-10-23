import { Menu } from '@/components/ui/Menu'
import { CurrencyMark } from '@/components/brand/Currency'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { faReceipt, faGift, faRankingStar, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '@/hooks/useAuth'
import { useNewQuests } from '@/hooks/useNewQuests'

/**
 * What you have, and what you can do about it.
 *
 * Pressing the number used to drop you in settings, which is where the
 * balance happened to live rather than where somebody looking at their money
 * wants to be. It opens what you can do about it instead: where to earn it,
 * where it went, how to redeem a code, and where everybody stands.
 *
 * Quests leads, because it is the only one of the four that answers "how do
 * I get more", which is what somebody pressing their own balance is usually
 * asking.
 *
 * Staw took "Spend Brix" off it: it went to the Style shop, which is one of
 * several places Brix are spent and not the obvious one, so the entry was a
 * guess dressed as a destination. The Leaderboard took its place.
 *
 * The blue dot is a real count - quests that went up since this account last
 * opened the board - so it goes out by looking rather than by being pressed.
 */
export function CurrencyBalance({ amount }: { amount: number }) {
  const { profile } = useAuth()
  const unseen = useNewQuests(profile?.id)

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
          {unseen > 0 && (
            /* The ring is the top bar's own colour, not a shadow: the bar is
               blue on the house theme and some other colour on the seasonal
               ones, and a blue dot on a blue bar is a dot nobody sees. */
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-bright ring-2 ring-onbrand"
              aria-label={`${unseen} new ${unseen === 1 ? 'quest' : 'quests'}`}
            />
          )}
        </span>
      }
      items={[
        {
          label: unseen > 0 ? `Quests · ${unseen} new` : 'Quests',
          icon: faWandMagicSparkles,
          ours: 'laurel-quest',
          to: '/quests',
        },
        { label: 'Leaderboards', icon: faRankingStar, to: '/leaderboards' },
        { label: 'My transactions', icon: faReceipt, to: '/brix' },
        { label: 'Redeem a code', icon: faGift, to: '/brix/codes' },
      ]}
    />
  )
}
