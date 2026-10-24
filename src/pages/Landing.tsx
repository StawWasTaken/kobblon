import { Link } from 'react-router-dom'
import { faArrowRight, faStore } from '@fortawesome/free-solid-svg-icons'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { Signature } from '@/components/brand/Signature'
import { Commercial } from '@/components/landing/Commercial'
import { WorldChart } from '@/components/landing/WorldChart'
import { CreatorShelf } from '@/components/landing/CreatorShelf'
import { CommunityWall } from '@/components/landing/CommunityWall'
import { CatalogShelf } from '@/components/landing/CatalogShelf'
import { JoinPanel } from '@/components/landing/JoinPanel'
import { Band, Lane } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { StatTile } from '@/components/about/Tally'
import { PixelGrid } from '@/components/about/Motif'
import { BandHead, Title } from '@/components/about/Type'
import { PixelField } from '@/components/brand/PixelField'
import { useAsync } from '@/hooks/useAsync'
import { getPlatformStats, listAssets, listCommunities, listWorlds, avatarShelf } from '@/lib/api'
import { asset } from '@/lib/asset'
import type { MarketAsset } from '@/types/db'

/*
 * The front door, built for this page rather than assembled out of the
 * other ones.
 *
 * Staw's note on the version before this: "you taking elements from
 * multiple pages and shoving them together". He was right - it opened with
 * a held title copied off What is Kobblon, then asked for an account in a
 * whole band of its own, then explained each section in three sentences
 * before showing it. Three faults, and they are the three rules this page
 * is now written to:
 *
 *   * **The ask is in the opening.** Somebody who lands here either leaves
 *     or signs up, so the form is the first thing on the page, beside the
 *     line, rather than a band they have to reach. There is no second
 *     sign-up band.
 *   * **A band is a heading and the thing itself.** One short line, at
 *     most. If the stock needs a paragraph to be worth looking at, the
 *     stock is the problem.
 *   * **Nothing is written over somebody's cover.** The Worlds are a chart,
 *     the Communities are cards, the Catalog shows the real 2D cards.
 *
 * It is still the At Kobblon *design* - `Band`, the type scale, `Reveal`,
 * the drift on pictures, the floating faces - and deliberately not the At
 * Kobblon *page*: those explain Kobblon, this one shows the stock, live,
 * and says so plainly where there is none.
 */

/** The World in the opening, and who made it. */
const SHOWING = {
  world: 'Kobblon HQ',
  builder: 'kobblon',
  picture: '/brand/landing-towers.webp',
}

/**
 * What keeps the place worth being in, from the What is Kobblon page.
 *
 * Staw asked for the closing band to be based on that one, and the four
 * controls are the honest version of "built to be worth trusting": each of
 * these is a button that exists in the product today.
 */
const safety: { icon: KobIcon; name: string; body: string }[] = [
  { icon: 'report', name: 'Report', body: 'Anything, anywhere, and it goes to a person. Who reported it is never shown.' },
  { icon: 'remove-user', name: 'Block', body: 'They cannot write to you, find you, or follow you into a World.' },
  { icon: 'cross-user', name: 'Ignore', body: 'Quieter than a block: you simply stop seeing them.' },
  { icon: 'admin', name: 'Moderation', body: 'Decisions come with a reason, and every one of them can be appealed.' },
]

/**
 * What a section says when there is genuinely nothing in it yet.
 *
 * One line and a dashed border, which is the whole point: an empty shelf
 * dressed up with artwork reads as a feature, and this has to read as
 * "nobody has done this yet, and you could be the first".
 */
function Nothing({ children }: { children: string }) {
  return (
    <Reveal>
      <p className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-7 py-8 leading-relaxed text-white/50">
        {children}
      </p>
    </Reveal>
  )
}

export default function Landing() {
  const stats = useAsync(getPlatformStats, [])
  const spaces = useAsync(() => listWorlds({ sort: 'trending', limit: 5 }), [])
  /*
   * A shelf of one kind of thing is not a shelf, it is a shelf of fonts.
   * Each kind is asked for on its own and they are dealt out in turn, so what
   * runs along the page is a mix whatever people happened to upload last.
   */
  const assets = useAsync(async () => {
    const kinds = ['image', 'audio', 'video', 'font', 'mesh', 'build'] as const
    const lots = await Promise.all(
      kinds.map((kind) => listAssets({ kind, limit: 6 }).catch(() => [])),
    )

    const mixed: MarketAsset[] = []
    for (let i = 0; i < 6; i += 1) {
      for (const lot of lots) if (lot[i]) mixed.push(lot[i])
    }
    return mixed.slice(0, 18)
  }, [])
  const communities = useAsync(() => listCommunities(''), [])
  // Things to wear. The Catalog is open to anybody, logged in or not.
  const style = useAsync(() => avatarShelf(null, undefined, 14).catch(() => []), [])

  const biggest = [...(communities.data ?? [])]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 4)
  const it = stats.data

  return (
    <div className="bg-ink text-white">
      {/* ------------------------------------------------------- the opening */}
      {/*
        * The line and the form, side by side, over something somebody built.
        * Not held, not scrolled in: a form that arrives as you scroll is a
        * form you cannot click, and this one is the point of the page.
        */}
      <section className="relative overflow-hidden">
        <Parallax strength={70} className="absolute inset-0">
          <img
            src={asset(SHOWING.picture)}
            alt={`${SHOWING.world}, built on Kobblon`}
            className="h-[112%] w-full object-cover object-[50%_38%]"
          />
        </Parallax>
        <PixelField className="opacity-25" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70rem_40rem_at_20%_0%,rgba(27,52,232,0.45),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/75 to-ink" />

        <Lane className="grid items-center gap-12 pb-20 pt-28 sm:pt-32 lg:grid-cols-[1fr_24rem] lg:gap-16 lg:pb-28">
          <div>
            <Reveal>
              <h1 className="font-display text-[clamp(2.6rem,6.4vw,5.25rem)] font-extrabold leading-[0.95] tracking-tight drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">
                Somebody built this.
                <br />
                <span className="text-brand-bright">Walk in</span>.
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-7 max-w-md text-lg leading-relaxed text-white/60">
                Worlds, made by the people here.
              </p>
            </Reveal>
            <Reveal delay={200}>
              {/* One action. The card beside it already carries "already
                  have an account?", and two of those on one screen is a
                  front page arguing with itself. */}
              <div className="mt-8">
                <Button to="/discover" variant="yes" size="lg">Start playing</Button>
              </div>
            </Reveal>

            {/* The credit, the way Roblox credited a builder on theirs: the
                claim above made checkable, with a page you can open. */}
            <Reveal delay={260}>
              <p className="mt-12 font-display text-sm text-white/60">
                {SHOWING.world}
                <span className="block text-xs text-white/40">
                  Built by{' '}
                  <Link to={`/u/${SHOWING.builder}`} className="text-white/60 hover:text-white hover:underline">
                    @{SHOWING.builder}
                  </Link>
                </span>
              </p>
            </Reveal>
          </div>

          <Reveal delay={90}>
            <JoinPanel />
          </Reveal>
        </Lane>
      </section>

      {/* ---------------------------------------------------------- numbers */}
      {it && (
        <Band tone="raised" edge tight decor={<Floaters />}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile value={it.published_spaces} label="Worlds published" icon="world" />
            <StatTile value={it.total_visits} label="Visits" icon="click" delay={70} />
            <StatTile value={it.total_accounts} label="People" icon="people" delay={140} />
            <StatTile value={it.people_online} label="Online now" icon="circle-user" delay={210} />
          </div>
        </Band>
      )}

      {/* ----------------------------------------------------------- Worlds */}
      <Band tone="night" edge>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <BandHead eyebrow="Being played" title="Worlds" />
            <Button to="/discover" variant="subtle" iconRight={faArrowRight}>Find a World</Button>
          </div>
        </Reveal>

        <div className="mt-10">
          {!spaces.loading && !spaces.data?.length ? (
            <Nothing>
              Nobody has published a World yet. Yours would be the first one on this page.
            </Nothing>
          ) : (
            <WorldChart
              worlds={(spaces.data ?? []).slice(0, 4)}
              loading={spaces.loading || !spaces.data?.length}
            />
          )}
        </div>
      </Band>

      {/* The advert, under the fold, loaded only when asked for. */}
      <Commercial />

      {/* ----------------------------------------------------------- Create */}
      {/*
        * Heading, the shelf, the way in. The shelf runs off both edges of
        * the window - a marketplace that stops at the text column looks
        * like a list of four things - so the band holds the words and the
        * shelf sits under it at full width.
        */}
      <Band tone="raised" edge className="pb-0 sm:pb-0">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <BandHead eyebrow="Marketplace" title="Made here, by hand." />
            <Button to="/create/marketplace" variant="subtle" iconRight={faArrowRight}>
              Open the marketplace
            </Button>
          </div>
        </Reveal>
      </Band>

      <div className="bg-ink-raised/60 pb-16 pt-10 sm:pb-24">
        {!assets.loading && !assets.data?.length ? (
          <Lane>
            <Nothing>The marketplace is empty. Upload the first image, sound or font.</Nothing>
          </Lane>
        ) : (
          <CreatorShelf items={assets.data ?? []} loading={assets.loading} />
        )}
      </div>

      {/* ------------------------------------------------------ Communities */}
      <Band tone="night" edge decor={<Floaters />}>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <BandHead eyebrow="Communities" title="Hang out together." />
            <Button to="/communities" variant="subtle" iconRight={faArrowRight}>
              Browse Communities
            </Button>
          </div>
        </Reveal>

        <div className="mt-10">
          {!communities.loading && !biggest.length ? (
            <Nothing>No Communities yet. Start the first one and people can join it.</Nothing>
          ) : (
            <CommunityWall communities={biggest} loading={communities.loading} />
          )}
        </div>
      </Band>

      {/* ---------------------------------------------------------- Catalog */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div className="min-w-0">
            {!style.loading && !style.data?.length ? (
              <Nothing>
                The Catalog is filling up. Verified accounts are making the first things for it.
              </Nothing>
            ) : (
              <CatalogShelf items={style.data ?? []} loading={style.loading} />
            )}
          </div>

          <Reveal delay={90}>
            <BandHead
              eyebrow="Catalog"
              title="Wear it everywhere."
              lead="Put something on and it comes with you into every World."
            />
            <Button className="mt-8" to="/catalog" icon={faStore}>Open the Catalog</Button>
          </Reveal>
        </div>
      </Band>

      {/* ----------------------------------------------------------- safety */}
      {/*
        * Based on the safety band on What is Kobblon, which Staw asked for:
        * the four controls as they are there, because naming the button
        * somebody can press is the only version of "worth trusting" that is
        * checkable. The signed note stays - it is his.
        */}
      <Band tone="night" edge>
        <Reveal>
          <BandHead eyebrow="Safety" title="Our People Come First" />
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {safety.map((one, at) => (
            <Reveal key={one.name} delay={at * 70} className="h-full">
              <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-ink-card/50 p-7">
                <PixelGrid from="bottom-right" className="opacity-30" />
                <Icon name={one.icon} tone="currentColor" className="relative h-7 w-7 text-brand-bright" />
                <p className="relative mt-5 font-display text-xl font-extrabold">{one.name}</p>
                <p className="relative mt-3 leading-relaxed text-white/55">{one.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-bold">
            <Button to="/policies/moderation" variant="subtle">How moderation works</Button>
            <Link to="/policies/guidelines" className="text-link hover:underline">Community Guidelines</Link>
            <Link to="/policies/terms" className="text-link hover:underline">Terms of Service</Link>
            <Link to="/policies/privacy" className="text-link hover:underline">Privacy</Link>
          </div>
        </Reveal>

        {/* Staw's own note, signed, which is the one thing on this page that
            is a person speaking rather than the database. */}
        <Reveal delay={260}>
          <div className="mt-16 max-w-xl border-t border-white/10 pt-8">
            <Title className="text-[clamp(1.5rem,2.4vw,2rem)]">Fifteen and over.</Title>
            <p className="mt-4 leading-relaxed text-white/55">
              Uploads are screened when they arrive and a person looks at anything the check is
              unsure about. Every World runs shut off from the rest of the site, so what somebody
              builds cannot reach anybody else's account.
            </p>
            <p className="mt-8 text-sm text-white/45">Signed,</p>
            <Signature className="mt-1 w-fit" />
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/40">
              CEO of Kobblon
            </p>
          </div>
        </Reveal>
      </Band>
    </div>
  )
}
