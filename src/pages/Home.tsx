import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCompass, faChevronLeft, faChevronRight, faEye,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { FriendsRail } from '@/components/social/FriendsRail'
import { worldIcon } from '@/lib/naming'
import { AdBanner } from '@/components/ads/AdBanner'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  listFavouriteWorlds, listMemberCommunities, listWorlds, myWorlds,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { communityLink, worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import { Emblem } from '@/components/community/Emblem'
import type { World } from '@/types/db'

/** A row that slides, with the arrows only where there is a mouse to use them. */
function Row({ title, children, more }: {
  title: string
  children: React.ReactNode
  more?: { to: string; label: string }
}) {
  const track = useRef<HTMLDivElement>(null)

  const nudge = (way: 1 | -1) => {
    track.current?.scrollBy({ left: way * (track.current.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <section className="mb-9">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">{title}</h2>
        {more && (
          <Link to={more.to} className="text-xs font-bold text-link hover:underline">
            {more.label}
          </Link>
        )}
        <div className="ml-auto hidden gap-1 sm:flex">
          {([-1, 1] as const).map((way) => (
            <button
              key={way}
              onClick={() => nudge(way)}
              aria-label={way === -1 ? `Scroll ${title} left` : `Scroll ${title} right`}
              className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-card text-white/60 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <FontAwesomeIcon icon={way === -1 ? faChevronLeft : faChevronRight} className="text-xs" />
            </button>
          ))}
        </div>
      </div>

      <div
        ref={track}
        className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 kob-scroll"
      >
        {children}
      </div>
    </section>
  )
}

/**
 * A World being suggested: its emblem, its name, and how many have been.
 *
 * The emblem is what a World chose to be known by, so it is what a rail of
 * them shows. Nothing here is a judgement about the World; it is a shelf.
 */
function Suggestion({ world }: { world: World }) {
  return (
    <article className="w-64 shrink-0 sm:w-72">
      <Link
        to={worldLink(world)}
        className="block aspect-[16/9] overflow-hidden rounded-xl border border-ink-line bg-media"
      >
        {world.cover_url ? (
          <img
            src={world.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <FontAwesomeIcon icon={worldIcon} className="text-2xl text-white/20" />
          </span>
        )}
      </Link>
      <p className="mt-1.5 truncate text-sm font-bold">{world.name}</p>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <FontAwesomeIcon icon={faEye} />
        {formatCount(world.visit_count ?? 0)}
      </p>
    </article>
  )
}

export default function Home() {
  useTitle('Home')
  const { profile } = useAuth()

  const mine = useAsync(async () => (profile ? myWorlds() : []), [profile?.id])
  /*
   * What is being played, until there is something worth calling a
   * recommendation. A shelf that says "trending" and means it beats a
   * personalised one that has nothing to personalise from.
   */
  const suggested = useAsync(() => listWorlds({ sort: 'trending', limit: 24 }), [profile?.id])
  const saved = useAsync(
    async () => (profile ? listFavouriteWorlds(profile.id) : []),
    [profile?.id],
  )
  const communities = useAsync(
    async () => (profile ? listMemberCommunities(profile.id) : []),
    [profile?.id],
  )

  const shown = suggested.data ?? []
  const first = shown.slice(0, 8)
  const rest = shown.slice(8, 24)

  return (
    <Page>
      <h1 className="mb-6 font-display text-3xl font-extrabold sm:text-4xl">Home</h1>

      <FriendsRail />

      <Row title="Being played right now" more={{ to: '/discover', label: 'Discover more' }}>
        {suggested.loading
          ? [0, 1, 2, 3].map((i) => (
            <div key={i} className="w-64 shrink-0 sm:w-72">
              <Skeleton className="aspect-[16/9] rounded-xl" />
            </div>
          ))
          : first.map((world) => <Suggestion key={world.id} world={world} />)}
      </Row>

      {!suggested.loading && !shown.length && (
        <Card className="mb-9">
          <EmptyState
            mood="construction"
            title="Nothing to suggest yet"
            body="When people publish Worlds, the ones worth a look land here."
            action={<Button to="/discover" icon={faCompass}>See what there is</Button>}
          />
        </Card>
      )}

      {!!mine.data?.length && (
        <Row title="Your Worlds" more={{ to: '/create/worlds', label: 'All of them' }}>
          {mine.data.map((world) => <Suggestion key={world.id} world={world} />)}
        </Row>
      )}

      <AdBanner className="mb-9" quiet />

      {rest.length > 0 && (
        <>
          <Row title="More to look at">
            {rest.slice(0, 8).map((world) => <Suggestion key={world.id} world={world} />)}
          </Row>

          {rest.length > 8 && (
            <Row title="Still more">
              {rest.slice(8).map((world) => <Suggestion key={world.id} world={world} />)}
            </Row>
          )}
        </>
      )}

      {!!saved.data?.length && (
        <Row title="Saved" more={{ to: '/library', label: 'Your library' }}>
          {saved.data.map((world) => <Suggestion key={world.id} world={world} />)}
        </Row>
      )}

      {!!communities.data?.length && (
        <Row title="Your Communities" more={{ to: '/communities', label: 'See all' }}>
          {communities.data.map((community) => (
            <Link
              key={community.id}
              to={communityLink(community)}
              className={cn(
                'flex w-44 shrink-0 items-center gap-3 rounded-xl border border-ink-line bg-ink-card p-3',
                'transition-colors hover:border-brand/60',
              )}
            >
              <Emblem src={community.icon_url} name={community.name} className="h-10 w-10 text-xs" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{community.name}</span>
                <span className="block text-xs text-muted">
                  {formatCount(community.member_count)} members
                </span>
              </span>
            </Link>
          ))}
        </Row>
      )}
    </Page>
  )
}
