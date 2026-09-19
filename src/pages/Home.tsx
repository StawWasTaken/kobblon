import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCompass, faEllipsis, faBan, faChevronLeft, faChevronRight, faEye, faThumbsUp,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { FriendsRail } from '@/components/social/FriendsRail'
import { EmblemTile } from '@/components/spaces/EmblemTile'
import { coverFor, fallbackFor } from '@/components/spaces/SpaceCard'
import { AdBanner } from '@/components/ads/AdBanner'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useAssetRef } from '@/hooks/useSignedUrl'
import { useTitle } from '@/hooks/useTitle'
import { useToast } from '@/components/ui/Toast'
import {
  hideSpace, listFavoriteSpaces, listMemberCommunities, listRecentlyVisited, listRecommended,
  listSpacesByOwner,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { communityLink, spaceLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import { Emblem } from '@/components/community/Emblem'
import type { Space } from '@/types/db'
import { overlayButton } from '@/lib/overlay'

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
 * A Space being suggested: the picture of the place rather than its badge,
 * because somewhere you have never been is a picture, not a mark you know.
 * The one thing you can do to a suggestion is refuse it.
 */
function Suggestion({ space, onNotInterested }: {
  space: Space
  onNotInterested: () => void
}) {
  const picture = useAssetRef(coverFor(space)) ?? fallbackFor(space)
  const [menu, setMenu] = useState(false)
  const up = space.like_count ?? 0
  const down = space.dislike_count ?? 0
  const score = up + down ? Math.round((up / (up + down)) * 100) : null

  return (
    <article className="group relative w-64 shrink-0 sm:w-72">
      <Link
        to={spaceLink(space)}
        className="block aspect-[16/9] overflow-hidden rounded-xl bg-media ring-1 ring-ink-line transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:ring-brand/70"
      >
        <img src={picture} alt="" loading="lazy" className="h-full w-full object-cover" />
      </Link>

      <p className="mt-1.5 truncate text-sm font-bold">{space.name}</p>
      <p className="flex items-center gap-3 text-[11px] font-bold text-muted">
        {score !== null && (
          <span className="inline-flex items-center gap-1">
            <FontAwesomeIcon icon={faThumbsUp} />
            {score}%
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <FontAwesomeIcon icon={faEye} />
          {formatCount(space.visit_count ?? 0)}
        </span>
      </p>

      <button
        onClick={() => setMenu((was) => !was)}
        aria-label={`Options for ${space.name}`}
        className={cn(
          'absolute right-2 top-2 h-7 w-7 text-xs opacity-0',
          'focus-visible:opacity-100 group-hover:opacity-100',
          overlayButton,
        )}
      >
        <FontAwesomeIcon icon={faEllipsis} />
      </button>

      {menu && (
        <div className="absolute right-2 top-10 z-20 w-44 overflow-hidden rounded-xl border border-ink-line bg-ink-card shadow-pop">
          <button
            onClick={() => { setMenu(false); onNotInterested() }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold text-white/80 hover:bg-ink-hover hover:text-white"
          >
            <FontAwesomeIcon icon={faBan} />
            Not interested
          </button>
        </div>
      )}
    </article>
  )
}

export default function Home() {
  useTitle('Home')
  const { profile } = useAuth()
  const toast = useToast()

  const mine = useAsync(
    async () => (profile ? listSpacesByOwner(profile.id, true) : []),
    [profile?.id],
  )
  const suggested = useAsync(() => listRecommended(24), [profile?.id])
  const visited = useAsync(
    async () => (profile ? listRecentlyVisited(14) : []),
    [profile?.id],
  )
  const saved = useAsync(
    async () => (profile ? listFavoriteSpaces(profile.id) : []),
    [profile?.id],
  )
  const communities = useAsync(
    async () => (profile ? listMemberCommunities(profile.id) : []),
    [profile?.id],
  )

  const [refused, setRefused] = useState<string[]>([])

  const notInterested = async (space: Space) => {
    setRefused((all) => [...all, space.id])
    try {
      await hideSpace(space.id)
      toast(`${space.name} will not be suggested again.`, 'info')
    } catch {
      setRefused((all) => all.filter((id) => id !== space.id))
      toast('That did not save.', 'error')
    }
  }

  const shown = (suggested.data ?? []).filter((space) => !refused.includes(space.id))
  const first = shown.slice(0, 8)
  const rest = shown.slice(8, 24)

  return (
    <Page>
      <h1 className="mb-6 font-display text-3xl font-extrabold sm:text-4xl">Home</h1>

      <FriendsRail />

      <Row title="Recommended for you" more={{ to: '/discover', label: 'Discover more' }}>
        {suggested.loading
          ? [0, 1, 2, 3].map((i) => (
            <div key={i} className="w-64 shrink-0 sm:w-72">
              <Skeleton className="aspect-[16/9] rounded-xl" />
            </div>
          ))
          : first.map((space) => (
            <Suggestion key={space.id} space={space} onNotInterested={() => notInterested(space)} />
          ))}
      </Row>

      {!suggested.loading && !shown.length && (
        <Card className="mb-9">
          <EmptyState
            mood="construction"
            title="Nothing to suggest yet"
            body="When people publish Spaces, the ones worth a look land here."
            action={<Button to="/discover" icon={faCompass}>See what there is</Button>}
          />
        </Card>
      )}

      {!!visited.data?.length && (
        <Row title="Recently visited" more={{ to: '/library', label: 'Your library' }}>
          {visited.data.map((space) => <EmblemTile key={space.id} space={space} />)}
        </Row>
      )}

      {!!mine.data?.length && (
        <Row title="Your Spaces" more={{ to: '/library', label: 'All of them' }}>
          {mine.data.map((space) => <EmblemTile key={space.id} space={space} />)}
        </Row>
      )}

      <AdBanner className="mb-9" quiet />

      {rest.length > 0 && (
        <>
          <Row title="More to look at">
            {rest.slice(0, 8).map((space) => (
              <Suggestion key={space.id} space={space} onNotInterested={() => notInterested(space)} />
            ))}
          </Row>

          {rest.length > 8 && (
            <Row title="Still more">
              {rest.slice(8).map((space) => (
                <Suggestion key={space.id} space={space} onNotInterested={() => notInterested(space)} />
              ))}
            </Row>
          )}
        </>
      )}

      {!!saved.data?.length && (
        <Row title="Saved" more={{ to: '/library', label: 'Your library' }}>
          {saved.data.map((space) => <EmblemTile key={space.id} space={space} />)}
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
