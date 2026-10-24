import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faArrowRight, faShieldHalved, faStore, faEye, faUserAstronaut, faBolt, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Signature } from '@/components/brand/Signature'
import { Showcase } from '@/components/landing/Showcase'
import { Commercial } from '@/components/landing/Commercial'
import { WorldStage } from '@/components/landing/WorldStage'
import { CreatorShelf } from '@/components/landing/CreatorShelf'
import { CommunityRow } from '@/components/landing/CommunityRow'
import { CatalogShelf } from '@/components/landing/CatalogShelf'
import { Band, Lane } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { Parallax } from '@/components/about/Parallax'
import { Floaters } from '@/components/about/Floaters'
import { Title } from '@/components/about/Type'
import { useAsync } from '@/hooks/useAsync'
import { useForceDark } from '@/hooks/useTheme'
import { getPlatformStats, listAssets, listCommunities, listWorlds, avatarShelf } from '@/lib/api'
import { currency } from '@/lib/currency'
import { asset } from '@/lib/asset'
import { formatCount } from '@/lib/format'
import type { MarketAsset } from '@/types/db'

/*
 * The front door.
 *
 * It is built out of the same pieces as the At Kobblon pages - `Band`,
 * `Reveal`, `Parallax`, the type scale - and it deliberately does not say
 * what they say. At Kobblon explains what this is; this page shows the
 * stock. Everything down it is live: the Worlds are the trending ones, the
 * shelf is what people actually uploaded, the Communities are the biggest
 * ones that exist. A front page that argues is a brochure, and a front page
 * that shows what is in the building is a shop with the lights on.
 *
 * Which is also why nothing here is invented. Where there is nothing to
 * show, the section says so in one line instead of showing a mock-up of
 * what it would look like if there were.
 */

/* ------------------------------------------------------------------ parts */

/**
 * The top of a section: a number, a kicker, a heading with one word in the
 * brand colour, and the way through.
 *
 * The numbering is this page's own device and not the About side's - these
 * are stops on a tour of a real catalogue, and a tour has an order.
 */
function Opening({
  number, kicker, title, accent, body, to, action,
}: {
  number: string
  kicker: string
  title: string
  accent: string
  body: string
  to: string
  action: string
}) {
  return (
    <Reveal>
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-7">
        <div className="max-w-xl">
          <p className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/35">
            <span className="font-display text-base tabular-nums text-brand-bright">{number}</span>
            <span className="h-px w-8 bg-white/20" />
            {kicker}
          </p>

          <Title className="mt-4">
            {title}
            <span className="block text-brand-bright">{accent}</span>
          </Title>

          <p className="mt-5 text-base leading-relaxed text-white/55">{body}</p>
        </div>

        <Link
          to={to}
          className="group inline-flex items-center gap-3 rounded-full border border-white/12 px-6 py-3 text-sm font-extrabold uppercase tracking-wide transition-colors hover:border-brand-bright hover:bg-brand/15"
        >
          {action}
          <Glyph
            icon={faArrowRight}
            className="text-xs transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>
    </Reveal>
  )
}

function Ticker({ icon, value, label }: { icon: IconDefinition; value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-3">
      <Glyph icon={icon} className="text-sm text-white/40" />
      <span className="font-display text-xl font-extrabold tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-wide text-white/40">{label}</span>
    </span>
  )
}

/**
 * What a section says when there is genuinely nothing in it yet.
 *
 * One line and a border, which is the whole point: an empty shelf dressed
 * up with artwork reads as a feature, and this has to read as "nobody has
 * done this yet, and you could be the first".
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

/* --------------------------------------------------------------- the page */

export default function Landing() {
  useForceDark()
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

  return (
    <div className="bg-ink text-white">
      {/*
        * The picture and the sign-up, in the shape Staw asked for. The bar
        * above it is PublicLayout's, which already carried the log-in
        * fields - a second one here would have been two bars saying the
        * same thing, which is what nearly happened.
        */}
      <Showcase />

      {/* ---------------------------------------------------------- numbers */}
      {/*
        * A strip and not the four counting tiles the At Kobblon page uses.
        * Same four numbers, and they are the only thing the two pages have
        * in common, so they are presented as a line of live readings rather
        * than as a second set of the same cards.
        */}
      {!stats.loading && stats.data && (
        <section className="border-b border-white/5 bg-white/[0.02]">
          <Lane>
            <div className="flex flex-wrap items-center gap-x-12 gap-y-4 py-6">
              <Ticker
                icon={faLayerGroup}
                value={formatCount(stats.data.published_spaces)}
                label={stats.data.published_spaces === 1 ? 'World' : 'Worlds'}
              />
              <Ticker icon={faEye} value={formatCount(stats.data.total_visits)} label="Visits" />
              <Ticker
                icon={faUserAstronaut}
                value={formatCount(stats.data.total_accounts)}
                label="People"
              />
              <Ticker icon={faBolt} value={formatCount(stats.data.people_online)} label="Online now" />
            </div>
          </Lane>
        </section>
      )}

      {/* ----------------------------------------------------------- Worlds */}
      <Band tone="night">
        <Opening
          number="01"
          kicker="Worlds"
          title="Somewhere"
          accent="to go tonight"
          body="Somebody's own place, built the way they wanted it. Walk in, leave a mark, come back tomorrow."
          to="/discover"
          action="Find a World"
        />

        <div className="mt-14">
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
      </Band>

      {/* The advert, under the fold, loaded only when asked for. */}
      <Commercial />

      {/* ----------------------------------------------------------- Create */}
      <Band tone="raised" edge>
        <Opening
          number="02"
          kicker="Kobblon Create"
          title="Built from"
          accent="real work"
          body={`Decals, sounds, video and fonts, made by people here and checked before anybody sees them. Take what you need, and sell what you make for ${currency.plural}.`}
          to="/create/marketplace"
          action="Open the marketplace"
        />
      </Band>

      {/* Full width, because a shelf should run off the edge of the page. */}
      <div className="-mt-10 bg-ink-raised/60 pb-24 sm:pb-32">
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
        <Opening
          number="03"
          kicker="Communities"
          title="People to"
          accent="build with"
          body="Fan clubs, build teams and hobby corners, each with its own wall, ranks, events and funds."
          to="/communities"
          action="Browse Communities"
        />

        <div className="mt-14">
          {!communities.loading && !biggest.length ? (
            <Nothing>No Communities yet. Start the first one and people can join it.</Nothing>
          ) : (
            <CommunityRow communities={biggest} loading={communities.loading} />
          )}
        </div>
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
            <p className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/35">
              <span className="font-display text-base tabular-nums text-brand-bright">04</span>
              <span className="h-px w-8 bg-white/20" />
              Style
            </p>
            <Title className="mt-4">
              Wear it
              <span className="block text-brand-bright">everywhere</span>
            </Title>
            <p className="mt-5 text-base leading-relaxed text-white/60">
              Hats, hair and whatever else people make, worn on your own picture. Put one on and
              it comes with you into every World you walk into.
            </p>
            <Button className="mt-7" to="/catalog" icon={faStore}>Open the shop</Button>
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
            <Title className="mt-7">
              Built to be
              <span className="block text-brand-bright">worth trusting</span>
            </Title>
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

      {/* ------------------------------------------------------------ close */}
      {/*
        * A World behind the last ask rather than a flat brand-coloured
        * banner: the page opened on something somebody built and it closes
        * on one too.
        */}
      <section className="relative isolate overflow-hidden border-t border-white/[0.08]">
        <Parallax strength={70} className="absolute inset-0 -z-10">
          <img
            src={asset('/brand/landing-towers.webp')}
            alt=""
            aria-hidden="true"
            className="h-[115%] w-full object-cover object-center"
          />
        </Parallax>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink/85 via-ink/75 to-ink" />

        <Lane>
          <div className="py-28 text-center sm:py-36">
            <Reveal>
              <Title level={1}>
                It is free, and it
                <span className="block text-brand-bright">takes five minutes</span>
              </Title>
            </Reveal>
            <Reveal delay={120}>
              <p className="mx-auto mt-6 max-w-md leading-relaxed text-white/60">
                Make an account and the whole website opens: building, selling, Communities,
                people.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Button size="lg" variant="yes" to="/signup">Make an account</Button>
                <Button size="lg" variant="subtle" to="/login">Log in</Button>
              </div>
            </Reveal>
            <Reveal delay={260}>
              <p className="mt-6 text-sm font-semibold text-white/35">
                For people aged 15 and over.
              </p>
            </Reveal>
          </div>
        </Lane>
      </section>
    </div>
  )
}
