import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band } from '@/components/about/Band'
import { Hero } from '@/components/about/Hero'
import { Reveal } from '@/components/about/Reveal'
import { Figure } from '@/components/about/Figure'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { BandHead } from '@/components/about/Type'
import { InsideNav } from '@/components/about/InsideNav'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'
import { currency } from '@/lib/currency'

/**
 * Economy, the third of the three Inside Kobblon pages.
 *
 * Every way money moves on this page is a real transaction kind on
 * `pixel_transactions` - daily, code, sale, purchase, donation, the listing
 * and platform fees, ad budget and ad earnings. Nothing here describes an
 * economy we are planning.
 *
 * Two things this page deliberately does not do. It does not print the fee
 * percentages: those are set in the database and shown on the form that
 * charges them, and a figure repeated here is a figure that drifts. And it
 * does not say anything about buying Brix with real money, because you
 * cannot, and the day that changes it gets written here properly rather
 * than being hinted at now.
 */

const ways: { icon: KobIcon; name: string; body: string }[] = [
  {
    icon: 'clock-user',
    name: 'Turn up',
    body: 'The daily is there every day you come back. It is small and it adds up.',
  },
  {
    icon: 'laurel-quest',
    name: 'Do a quest',
    body: 'Set by Kobblon and by the people who build the Worlds. Some are a minute, some are a project.',
  },
  {
    icon: 'assets',
    name: 'Sell what you make',
    body: 'A shirt, a mesh, a sound, a World pass. Somebody buys it and the Brix are yours, minus the fee shown on the form.',
  },
  {
    icon: 'discount',
    name: 'Redeem a code',
    body: 'We hand them out on Discord, in the forum and at events. Paste it in and it is on your balance.',
  },
]

const spend = [
  ['The Catalog', 'Clothes, faces, gear - all of it uploaded by somebody who made it.'],
  ['Other people', 'Tip a creator whose World you lost an afternoon in. It goes straight to them.'],
  ['Your own name', 'A username change costs Brix, once a day. Deliberately not free.'],
  ['Getting seen', 'Put Brix behind an ad for your World and it shows up where people are looking.'],
]

export default function InsideEconomy() {
  useAtTitle('Economy')
  useSocialCard({
    title: 'Economy - Kobblon',
    description: 'What Kobblon runs on. Earned playing and selling, spent on what other people made.',
    image: null,
  })

  return (
    <AboutShell
      hero={(
        <Hero
          eyebrow="Inside Kobblon"
          title={<>Make something good. <span className="text-brand-bright">Get paid in it.</span></>}
          lead={`${currency.plural} is what Kobblon runs on. You earn it by turning up and by making things people want, and you spend it on what everybody else made. It stays inside, and it keeps moving.`}
          actions={(
            <>
              <Button to="/catalog" variant="yes" size="lg">Spend some</Button>
              <Button to="/brix/codes" variant="subtle" size="lg">Redeem a code</Button>
            </>
          )}
          art={(
            <Parallax strength={40}>
              <Figure
                src="/about/brix.webp"
                alt="A blue Kobblon brick"
                ratio="tall"
              />
            </Parallax>
          )}
        />
      )}
    >
      {/* ------------------------------------------------------- getting it */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead
            eyebrow="Earning"
            title="Four ways in, and none of them is a wallet."
            lead={`You cannot buy ${currency.plural} with money. Everything on your balance got there because you showed up or because somebody wanted what you made.`}
          />
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {ways.map((one, at) => (
            <Reveal key={one.name} delay={at * 70}>
              <div className="flex h-full gap-4 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
                <Icon name={one.icon} className="h-9 w-9 shrink-0" />
                <div>
                  <p className="font-display text-lg font-extrabold">{one.name}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{one.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Band>

      {/* -------------------------------------------------------- spending it */}
      <Band tone="raised" edge decor={<Floaters />}>
        <Reveal className="relative z-10">
          <BandHead
            eyebrow="Spending"
            title="And it all goes somewhere."
            lead="Nearly every Brix you spend lands on another person's balance. That is the whole design."
          />
        </Reveal>
        <div className="relative z-10 mt-12 grid gap-4 sm:grid-cols-2">
          {spend.map(([name, body], at) => (
            <Reveal key={name} delay={at * 70}>
              <div className="h-full rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6">
                <p className="font-display text-lg font-extrabold">{name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={320}>
          <div className="relative z-10 mt-8 flex flex-wrap gap-3">
            <Button to="/brix" variant="subtle">My balance</Button>
            <Button to="/catalog" variant="ghost">The Catalog</Button>
          </div>
        </Reveal>
      </Band>

      {/* ------------------------------------------------------- the receipts */}
      <Band tone="night" edge>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <BandHead
              eyebrow="Every single movement"
              title="You can see where all of it went."
              lead="Every earn, every spend, every fee is a line on your own ledger with a date and a reason on it. No rounding, no disappearing, nothing we will not show you."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/brix" variant="subtle">My transactions</Button>
              <Button to="/policies/money" variant="ghost">The money policy</Button>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <Parallax strength={34}>
              <Figure
                src="/about/brix.webp"
                alt="A blue Kobblon brick"
                ratio="square"
              />
            </Parallax>
          </Reveal>
        </div>
      </Band>

      <InsideNav not="economy" />
    </AboutShell>
  )
}
