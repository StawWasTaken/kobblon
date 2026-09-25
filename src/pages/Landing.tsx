import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight, faShieldHalved, faStore, faEye, faUserAstronaut, faBolt, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Wordmark } from '@/components/brand/Wordmark'
import { Signature } from '@/components/brand/Signature'
import { Kobby } from '@/components/brand/Kobby'
import { JoinPanel } from '@/components/landing/JoinPanel'
import { WorldStage } from '@/components/landing/WorldStage'
import { CreatorShelf } from '@/components/landing/CreatorShelf'
import { CommunityRow } from '@/components/landing/CommunityRow'
import { StyleShelf } from '@/components/landing/StyleShelf'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useForceDark } from '@/hooks/useTheme'
import { getPlatformStats, listAssets, listCommunities, listWorlds, styleShop } from '@/lib/api'
import { currency } from '@/lib/currency'
import { asset } from '@/lib/asset'
import { formatCount } from '@/lib/format'
import type { MarketAsset } from '@/types/db'

/* ------------------------------------------------------------------ parts */

/**
 * The top of a section: a number, a kicker, a heading with one word in the
 * brand colour, and the way through. It stands on its own line with the work
 * underneath it, so nothing is squeezed against anything else.
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
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
      <div className="max-w-xl">
        <p className="flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/35">
          <span className="font-display text-base tabular-nums text-brand-bright">{number}</span>
          <span className="h-px w-8 bg-white/20" />
          {kicker}
        </p>

        <h2 className="mt-4 font-display text-4xl font-extrabold leading-[0.92] sm:text-6xl">
          {title}
          <span className="block text-brand-bright">{accent}</span>
        </h2>

        <p className="mt-5 text-base leading-relaxed text-white/55">{body}</p>
      </div>

      <Link
        to={to}
        className="group inline-flex items-center gap-3 rounded-full border border-white/12 px-6 py-3 text-sm font-extrabold uppercase tracking-wide transition-colors hover:border-brand-bright hover:bg-brand/15"
      >
        {action}
        <FontAwesomeIcon
          icon={faArrowRight}
          className="text-xs transition-transform group-hover:translate-x-1"
        />
      </Link>
    </div>
  )
}

function Ticker({ icon, value, label }: { icon: IconDefinition; value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-3">
      <FontAwesomeIcon icon={icon} className="text-sm text-white/40" />
      <span className="font-display text-xl font-extrabold tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-wide text-white/40">{label}</span>
    </span>
  )
}

/* --------------------------------------------------------------- the page */

export default function Landing() {
  useForceDark()
  const navigate = useNavigate()
  const { signInAsGuest } = useAuth()
  const [guestPending, setGuestPending] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const enterAsGuest = async () => {
    setGuestPending(true)
    setGuestError(null)
    try {
      await signInAsGuest()
      navigate('/home')
    } catch {
      setGuestError('Guest mode is not switched on for this site yet.')
    } finally {
      setGuestPending(false)
    }
  }

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
  const style = useAsync(() => styleShop({ limit: 14 }).catch(() => []), [])

  const biggest = [...(communities.data ?? [])]
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, 8)

  return (
    <div className="bg-ink text-white">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b-[6px] border-brand-ink">
        <img
          src={asset('/brand/banner3.png')}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-brand-deep/80 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-ink via-brand-ink/90 to-brand-ink/40" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-brand-ink/95 to-transparent" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_24rem] lg:gap-20">
          <div>
            <Wordmark to={null} className="h-9 sm:h-12" />

            {/* Sized so each line holds together instead of breaking after
                "Make" once the form is beside it. */}
            <h1 className="mt-8 font-display text-5xl font-extrabold leading-[0.86] sm:text-6xl xl:text-7xl">
              <span className="block whitespace-nowrap">Make Something</span>
              <span className="block whitespace-nowrap">Nobody Else Has</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/70">
              Kobblon is a place to build your own corner of the internet, fill it with
              whatever you want, and let people walk in.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" variant="subtle" to="/discover">Look around first</Button>
              <button
                onClick={enterAsGuest}
                disabled={guestPending}
                className="text-sm font-bold text-white/70 underline-offset-4 hover:text-white hover:underline disabled:opacity-60"
              >
                {guestPending ? 'One moment' : 'Or play as a guest'}
              </button>
            </div>
            {guestError && <p className="mt-3 text-sm text-danger">{guestError}</p>}

            <p className="mt-5 text-xs text-white/45">Free, and for people aged 15 and over.</p>
          </div>

          {/* The form itself, rather than a button that goes to a form. */}
          <JoinPanel />
        </div>
      </section>

      {/* ---------------------------------------------------------- numbers */}
      {!stats.loading && stats.data && (
        <section className="border-b border-white/5 bg-white/[0.02]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-12 gap-y-4 px-4 py-6 sm:px-8">
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
        </section>
      )}

      {/* ----------------------------------------------------------- Spaces */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 sm:py-32">
        <Opening
          number="01"
          kicker="Worlds"
          title="Somewhere"
          accent="To Go"
          body="Every Space is somebody's own page, built the way they wanted it. Walk in, look around, leave a mark, and come back when they have changed it."
          to="/discover"
          action="Find a World"
        />

        <div className="mt-14">
          {!spaces.loading && !spaces.data?.length ? (
            <div className="flex items-center gap-5 rounded-[1.75rem] border border-white/10 bg-ink-card p-6">
              <Kobby mood="construction" size="sm" bob={false} />
              <p className="text-sm text-white/55">
                Nobody has published a World yet. Yours would be the first one here.
              </p>
            </div>
          ) : (
            <WorldStage
              worlds={(spaces.data ?? []).slice(0, 3)}
              loading={spaces.loading || !spaces.data?.length}
            />
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- Create */}
      <section className="border-y border-white/5 bg-white/[0.02] py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <Opening
            number="02"
            kicker="Kobblon Create"
            title="Built From"
            accent="Real Work"
            body={`Decals, sounds, video and fonts, made by people here and checked before anybody sees them. Take what you need, use it by its number, and sell what you make for ${currency.plural}.`}
            to="/create/marketplace"
            action="Open the marketplace"
          />
        </div>

        {/* Full width, because a shelf should run off the edge of the page. */}
        <div className="mt-14">
          {!assets.loading && !assets.data?.length ? (
            <div className="mx-auto flex max-w-6xl items-center gap-5 rounded-[1.75rem] border border-white/10 bg-ink-card p-6">
              <Kobby mood="emptyBox" size="sm" bob={false} />
              <p className="text-sm text-white/55">
                The marketplace is empty. Upload the first image, sound or font.
              </p>
            </div>
          ) : (
            <CreatorShelf items={assets.data ?? []} loading={assets.loading} />
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ Communities */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8 sm:py-32">
        <Opening
          number="03"
          kicker="Communities"
          title="People To"
          accent="Build With"
          body="Fan clubs, build teams and hobby corners, each with its own wall, its own ranks, its own events, its own funds and its own Worlds."
          to="/communities"
          action="Browse Communities"
        />

        <div className="mt-16">
          {!communities.loading && !biggest.length ? (
            <div className="flex items-center gap-5 rounded-[1.75rem] border border-white/10 bg-ink-card p-6">
              <Kobby mood="emptyBox" size="sm" bob={false} />
              <p className="text-sm text-white/55">
                No Communities yet. Start the first one and people can join it.
              </p>
            </div>
          ) : (
            <CommunityRow communities={biggest} loading={communities.loading} />
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ Style */}
      <section className="border-y border-white/5 bg-white/[0.02] py-24 sm:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          {/* The catalogue, coming down the page on its own. */}
          <div className="min-w-0">
            {!style.loading && !style.data?.length ? (
              <div className="flex items-center gap-5 rounded-[1.75rem] border border-white/10 bg-ink-card p-6">
                <Kobby mood="style" size="sm" bob={false} />
                <p className="text-sm text-white/55">
                  The shop is filling up. Verified accounts are making the first things for it.
                </p>
              </div>
            ) : (
              <StyleShelf items={style.data ?? []} loading={style.loading} />
            )}
          </div>

          <div>
            <Kobby mood="style" size="lg" bob={false} />
            <p className="mt-6 flex items-center gap-3 font-display text-xs font-extrabold uppercase tracking-[0.3em] text-white/40">
              <span className="text-brand-bright">04</span>
              <span className="h-px w-8 bg-white/20" />
              Style
            </p>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-[0.92] sm:text-5xl">
              Express your
              <span className="block text-brand-bright">own style</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/60">
              Hats, hair and whatever else people make, worn on your own picture. Put one on and
              you wear it everywhere you turn up on Kobblon.
            </p>
            <Button className="mt-7" to="/style" icon={faStore}>Open the shop</Button>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- safety */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <span className="grid h-16 w-16 place-items-center rounded-2xl border-b-4 border-brand-ink bg-brand text-2xl text-onbrand shadow-pop">
              <FontAwesomeIcon icon={faShieldHalved} />
            </span>
            <h2 className="mt-7 font-display text-4xl font-extrabold leading-[0.92] sm:text-5xl">
              Built to be
              <span className="block text-brand-bright">worth trusting</span>
            </h2>
            <div className="mt-6 flex flex-wrap gap-4 text-sm font-bold">
              <Link to="/policies/guidelines" className="text-link hover:underline">Community Guidelines</Link>
              <Link to="/policies/terms" className="text-link hover:underline">Terms of Service</Link>
              <Link to="/policies/privacy" className="text-link hover:underline">Privacy</Link>
            </div>
          </div>

          <div className="space-y-6 text-white/60">
            <p className="leading-relaxed">
              Kobblon is for people aged 15 and over. Uploads are screened when they arrive and
              a person looks at anything the check is unsure about.
            </p>
            <p className="leading-relaxed">
              Every Space runs shut off from the rest of the site, so what somebody builds cannot
              reach anybody else&rsquo;s account.
            </p>
            <p className="leading-relaxed">
              Nothing on this page is invented. The numbers are the platform&rsquo;s own, and when
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
        </div>
      </section>

      {/* ------------------------------------------------------------ close */}
      <section className="relative overflow-hidden border-t-[6px] border-brand-ink">
        <img
          src={asset('/brand/topbar.png')}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-brand-ink/70" />

        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-8 sm:py-28">
          <h2 className="font-display text-4xl font-extrabold leading-[0.9] sm:text-6xl">
            <span className="block">Make Something</span>
            <span className="block">Nobody Else Has</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-white/70">
            Free, takes five minutes, and nobody is going to build it for you.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button size="lg" to="/signup">Sign Up</Button>
            <Button size="lg" variant="subtle" to="/login">Log In</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
