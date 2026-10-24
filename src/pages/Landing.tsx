import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faArrowDown, faArrowRight, faShieldHalved, faStore,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Signature } from '@/components/brand/Signature'
import { Commercial } from '@/components/landing/Commercial'
import { WorldStage } from '@/components/landing/WorldStage'
import { CreatorShelf } from '@/components/landing/CreatorShelf'
import { CommunityRow } from '@/components/landing/CommunityRow'
import { CatalogShelf } from '@/components/landing/CatalogShelf'
import { JoinPanel } from '@/components/landing/JoinPanel'
import { Band, Lane } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { ScrollIn } from '@/components/about/ScrollIn'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { StatTile } from '@/components/about/Tally'
import { BandHead, Title } from '@/components/about/Type'
import { PixelField } from '@/components/brand/PixelField'
import { useAsync } from '@/hooks/useAsync'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { getPlatformStats, listAssets, listCommunities, listWorlds, avatarShelf } from '@/lib/api'
import { currency } from '@/lib/currency'
import { asset } from '@/lib/asset'
import type { MarketAsset } from '@/types/db'

/*
 * The front door, built out of the At Kobblon pieces.
 *
 * Staw, twice: it is to be the same design as those pages. So it is - the
 * held opening, `Band`, the type scale, `Reveal`, the drift on every
 * picture, the floating faces - and the bar above it is dark and goes
 * clear over the opening the way `AboutNav` does.
 *
 * What it is **not** is the same page. At Kobblon explains what Kobblon is;
 * this shows the stock. Everything down it is live: the Worlds are the
 * trending ones, the shelf is what people actually uploaded, the
 * Communities are the biggest ones that exist, and where there is nothing
 * yet it says so in one line rather than drawing a mock-up of what it would
 * look like if there were.
 */

/** The World in the opening, and who made it. */
const SHOWING = {
  world: 'Kobblon HQ',
  builder: 'kobblon',
  picture: '/brand/landing-towers.webp',
}

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
  const reduced = useReducedMotion()
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
  // Things to wear. The shop is open to anybody, logged in or not.
  const style = useAsync(() => avatarShelf(null, undefined, 14).catch(() => []), [])

  const biggest = [...(communities.data ?? [])]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 8)
  const it = stats.data

  return (
    <div className="bg-ink text-white">
      {/* ------------------------------------------------------- the opening */}
      {/*
        * Held still for a screen of scrolling, the way the What is Kobblon
        * page is: the wheel turns, the line arrives, and the page under it
        * only starts to move once the runway is spent. Sticky rather than
        * catching the wheel, and not held at all for somebody who asked for
        * less motion.
        */}
      <div
        className="relative"
        style={reduced ? undefined : { height: 'calc(100dvh + 100dvh)' }}
      >
        <div className={reduced ? 'relative overflow-hidden' : 'sticky top-0 h-dvh overflow-hidden'}>
          <Parallax strength={80} className="absolute inset-0">
            <img
              src={asset(SHOWING.picture)}
              alt={`${SHOWING.world}, built on Kobblon`}
              className="h-[112%] w-full object-cover object-[50%_38%]"
            />
          </Parallax>
          <PixelField className="opacity-25" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70rem_40rem_at_50%_-20%,rgba(27,52,232,0.4),transparent_65%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />

          <Lane className="flex h-full min-h-[34rem] flex-col justify-center py-24 text-center">
            <ScrollIn over={0.66}>
              <h1 className="font-display text-[clamp(2.6rem,7vw,5.5rem)] font-extrabold leading-[0.95] tracking-tight drop-shadow-[0_6px_30px_rgba(0,0,0,0.6)]">
                Somebody built this.
                <br />
                <span className="text-brand-bright">Walk in</span>.
              </h1>
            </ScrollIn>
            <Reveal delay={240}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button to="/discover" variant="yes" size="lg">Start playing</Button>
                <Button to="/signup" variant="subtle" size="lg">Make an account</Button>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <p className="mt-8 flex items-center justify-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/45">
                Keep going
                <Glyph icon={faArrowDown} className="text-xs" />
              </p>
            </Reveal>
          </Lane>

          {/*
            * The credit, the way Roblox credited a builder on theirs. It is
            * the claim above made checkable: a name, and a page you can open
            * to see what else they made.
            */}
          <p className="absolute bottom-5 left-0 w-full px-5 font-display text-sm text-white/70 sm:px-8">
            {SHOWING.world}
            <span className="block text-xs text-white/50">
              Built by{' '}
              <Link to={`/u/${SHOWING.builder}`} className="text-white/70 hover:text-white hover:underline">
                @{SHOWING.builder}
              </Link>
            </span>
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------- make one now */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_24rem] lg:gap-16">
          <Reveal>
            <BandHead
              eyebrow="Free, and it stays free"
              title="It takes about a minute."
              lead="One account opens the whole website: building, selling, Communities, people. Fifteen and over."
            />
            <p className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <Link to="/login" className="font-bold text-white underline-offset-4 hover:underline">
                Already have one? Log in
              </Link>
              <Link to="/download" className="font-bold text-white/60 underline-offset-4 hover:text-white hover:underline">
                Get the Launcher
              </Link>
            </p>
          </Reveal>

          <Reveal delay={120}>
            <JoinPanel />
          </Reveal>
        </div>
      </Band>

      {/* ---------------------------------------------------------- numbers */}
      {it && (
        <Band tone="night" edge decor={<Floaters />}>
          <Reveal>
            <BandHead eyebrow="Right now" title="Live, this minute." />
          </Reveal>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile value={it.published_spaces} label="Worlds published" icon="world" />
            <StatTile value={it.total_visits} label="Visits" icon="click" delay={70} />
            <StatTile value={it.total_accounts} label="People" icon="people" delay={140} />
            <StatTile value={it.people_online} label="Online now" icon="circle-user" delay={210} />
          </div>
        </Band>
      )}

      {/* ----------------------------------------------------------- Worlds */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead
            eyebrow="Worlds"
            title="Somewhere to go tonight."
            lead="Somebody's own place, built the way they wanted it. Walk in, leave a mark, come back tomorrow."
          />
        </Reveal>

        <div className="mt-12">
          {!spaces.loading && !spaces.data?.length ? (
            <Nothing>
              Nobody has published a World yet. Yours would be the first one on this page.
            </Nothing>
          ) : (
            <WorldStage
              worlds={(spaces.data ?? []).slice(0, 3)}
              loading={spaces.loading || !spaces.data?.length}
            />
          )}
        </div>

        <Reveal delay={120}>
          <div className="mt-10">
            <Button to="/discover" variant="subtle" iconRight={faArrowRight}>Find a World</Button>
          </div>
        </Reveal>
      </Band>

      {/* The advert, under the fold, loaded only when asked for. */}
      <Commercial />

      {/* ----------------------------------------------------------- Create */}
      <Band tone="raised" edge>
        <Reveal>
          <BandHead
            eyebrow="Kobblon Create"
            title="Built from real work."
            lead={`Meshes, decals, sounds and fonts, made by people here and checked before anybody sees them. Take what you need, and sell what you make for ${currency.plural}.`}
          />
        </Reveal>
      </Band>

      {/* Full width, because a shelf should run off the edge of the page. */}
      <div className="bg-ink-raised/60 pb-24 sm:pb-32">
        {!assets.loading && !assets.data?.length ? (
          <Lane>
            <Nothing>The marketplace is empty. Upload the first image, sound or font.</Nothing>
          </Lane>
        ) : (
          <CreatorShelf items={assets.data ?? []} loading={assets.loading} />
        )}
        <Lane>
          <Reveal>
            <div className="mt-12">
              <Button to="/create/marketplace" variant="subtle" iconRight={faArrowRight}>
                Open the marketplace
              </Button>
            </div>
          </Reveal>
        </Lane>
      </div>

      {/* ------------------------------------------------------ Communities */}
      <Band tone="night" edge decor={<Floaters />}>
        <Reveal>
          <BandHead
            eyebrow="Communities"
            title="People to build with."
            lead="Fan clubs, build teams and hobby corners, each with its own wall, ranks, events and funds."
          />
        </Reveal>

        <div className="mt-12">
          {!communities.loading && !biggest.length ? (
            <Nothing>No Communities yet. Start the first one and people can join it.</Nothing>
          ) : (
            <CommunityRow communities={biggest} loading={communities.loading} />
          )}
        </div>

        <Reveal delay={120}>
          <div className="mt-10">
            <Button to="/communities" variant="subtle" iconRight={faArrowRight}>
              Browse Communities
            </Button>
          </div>
        </Reveal>
      </Band>

      {/* ------------------------------------------------------------ Style */}
      <Band tone="raised" edge>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div className="min-w-0">
            {!style.loading && !style.data?.length ? (
              <Nothing>
                The shop is filling up. Verified accounts are making the first things for it.
              </Nothing>
            ) : (
              <CatalogShelf items={style.data ?? []} loading={style.loading} />
            )}
          </div>

          <Reveal delay={90}>
            <BandHead
              eyebrow="Style"
              title="Wear it everywhere."
              lead="Hats, hair and whatever else people make, worn on your own picture. Put one on and it comes with you into every World you walk into."
            />
            <Button className="mt-8" to="/catalog" icon={faStore}>Open the shop</Button>
          </Reveal>
        </div>
      </Band>

      {/* ----------------------------------------------------------- safety */}
      <Band tone="night" edge>
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <span className="grid h-16 w-16 place-items-center rounded-2xl border-b-4 border-brand-ink bg-brand text-2xl text-onbrand shadow-pop">
              <Glyph icon={faShieldHalved} />
            </span>
            <Title className="mt-7">Built to be worth trusting.</Title>
            <div className="mt-7 flex flex-wrap gap-4 text-sm font-bold">
              <Link to="/policies/guidelines" className="text-link hover:underline">Community Guidelines</Link>
              <Link to="/policies/terms" className="text-link hover:underline">Terms of Service</Link>
              <Link to="/policies/privacy" className="text-link hover:underline">Privacy</Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-6 text-white/60">
              <p className="leading-relaxed">
                Kobblon is for people aged 15 and over. Uploads are screened when they arrive and
                a person looks at anything the check is unsure about.
              </p>
              <p className="leading-relaxed">
                Every World runs shut off from the rest of the site, so what somebody builds cannot
                reach anybody else's account.
              </p>
              <p className="leading-relaxed">
                Nothing on this page is invented. The numbers are the platform's own, and when
                there is nothing to show, it says so.
              </p>

              <div className="pt-6">
                <p className="text-sm text-white/45">Signed,</p>
                <Signature className="mt-1 w-fit" />
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/40">
                  CEO of Kobblon
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Band>
    </div>
  )
}
