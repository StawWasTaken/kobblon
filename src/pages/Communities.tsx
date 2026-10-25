import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  faUsers, faSeedling, faPlus, faLayerGroup, faCircleCheck, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { BrowseHero } from '@/components/browse/BrowseHero'
import { BrowseRail, BrowseFrame, BrowseHeading } from '@/components/browse/BrowseRail'
import type { RailItem } from '@/components/browse/BrowseRail'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Verified } from '@/components/brand/Verified'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { listCommunities, listMemberCommunities } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { communityLink } from '@/lib/links'
import type { Community } from '@/types/db'
import { useTitle } from '@/hooks/useTitle'
import { useNewCommunity } from '@/components/community/NewCommunityDialog'
import { AdBanner } from '@/components/ads/AdBanner'

/*
 * Communities, put in order.
 *
 * What was wrong with it, in Staw's words: "the biggest" cards are three
 * different heights because the description sets them, and "just started" is
 * a second list of the same communities in a different shape. Both are the
 * same mistake - the page had two sections where it had one list, so the
 * same Community appeared twice on one screen wearing two different cards,
 * and whichever one you had just looked at, the other one looked like a bug.
 *
 * So there is one list and one card now, and the rail says which way you are
 * looking at it. A way of sorting is not a section: it does not deserve its
 * own heading, its own card shape and its own copy of the thing being
 * sorted.
 */

type Shelf = 'biggest' | 'new' | 'verified' | 'mine'

export default function Communities() {
  useTitle('Communities')
  const openNew = useNewCommunity()
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(term)
  const [shelf, setShelf] = useState<Shelf>('biggest')

  // The search lives in the address, so the bar at the top of the site can
  // hand a search over to this page and a result can be linked to.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(term)
      setParams(term ? { q: term } : {}, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, setParams])

  // /communities/new used to be a page of its own; it now lands here and
  // opens the popup, so a link somebody kept still does what they expect.
  useEffect(() => {
    if (params.get('new') === null) return
    openNew()
    setParams((now) => {
      const next = new URLSearchParams(now)
      next.delete('new')
      return next
    }, { replace: true })
  }, [params, openNew, setParams])

  const all = useAsync(() => listCommunities(debounced), [debounced])

  /*
   * The ones you are in, asked for separately because membership is not on
   * the browse row. Asked once rather than when the shelf is opened: the
   * rail shows the count, and a count that appears only after you press the
   * thing it is counting is no use for deciding whether to press it.
   */
  const mine = useAsync(
    async () => (profile && !profile.is_guest ? listMemberCommunities(profile.id) : []),
    [profile?.id, profile?.is_guest],
  )

  const found = all.data ?? []
  const mineIds = useMemo(
    () => new Set((mine.data ?? []).map((one) => one.id)),
    [mine.data],
  )

  /*
   * One list, sorted four ways. Nothing here slices the list down to six and
   * calls it a section - the page shows what it found, in the order you
   * asked for, which is the only honest thing a directory can do.
   */
  const shown = useMemo(() => {
    const rows = [...found]
    if (shelf === 'mine') {
      return rows.filter((one) => mineIds.has(one.id))
        .sort((a, b) => b.member_count - a.member_count)
    }
    if (shelf === 'verified') {
      return rows.filter((one) => one.is_verified)
        .sort((a, b) => b.member_count - a.member_count)
    }
    if (shelf === 'new') {
      return rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    }
    return rows.sort((a, b) => b.member_count - a.member_count)
  }, [found, shelf, mineIds])

  const items: RailItem<Shelf>[] = [
    {
      value: 'biggest',
      label: 'The biggest',
      icon: faLayerGroup,
      count: all.loading ? null : found.length,
    },
    {
      value: 'new',
      label: 'Just started',
      icon: faSeedling,
      count: all.loading ? null : found.length,
    },
    {
      value: 'verified',
      label: 'Verified',
      icon: faCircleCheck,
      count: all.loading ? null : found.filter((one) => one.is_verified).length,
    },
    ...(profile && !profile.is_guest
      ? [{
        value: 'mine' as const,
        label: 'Yours',
        icon: faUserGroup,
        count: mine.loading ? null : (mine.data?.length ?? 0),
      }]
      : []),
  ]

  const heading = shelf === 'mine'
    ? 'Communities you are in'
    : shelf === 'verified'
      ? 'Verified Communities'
      : shelf === 'new'
        ? 'Just started'
        : 'The biggest'

  return (
    <Page width="wide" className="space-y-6">
      <BrowseHero
        title="Communities"
        lead="Fan clubs, build teams, hobby corners."
        icon={faUsers}
        value={term}
        onChange={setTerm}
        placeholder="Search every Community"
        actions={<Button onClick={openNew} icon={faPlus}>Make one</Button>}
      />

      <BrowseFrame
        rail={
          <BrowseRail
            label="How to look through the Communities"
            items={items}
            value={shelf}
            onChange={setShelf}
            /* The advert at the foot of the rail rather than cut into the
               middle of the grid, which is what it was doing. */
            foot={<AdBanner size="tall" quiet />}
          />
        }
      >
        <BrowseHeading
          title={debounced ? 'Results' : heading}
          note={
            all.loading
              ? 'Looking…'
              : debounced
                ? `${formatCount(shown.length)} for "${debounced}"`
                : `${formatCount(shown.length)} ${shown.length === 1 ? 'Community' : 'Communities'}`
          }
        />

        {all.loading && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[11.5rem] rounded-2xl" />
            ))}
          </div>
        )}

        {all.error && <ErrorState message={all.error} onRetry={all.reload} />}

        {!all.loading && !all.error && !shown.length && (
          <Card className="p-5">
            <EmptyState
              mood="noResults"
              title={
                debounced
                  ? 'Kobby could not find anything'
                  : shelf === 'mine'
                    ? 'You are not in one yet'
                    : shelf === 'verified'
                      ? 'None verified yet'
                      : 'No Communities yet'
              }
              body={
                debounced
                  ? `Nothing matches "${debounced}".`
                  : shelf === 'mine'
                    ? 'Join one and it will be here, or start your own.'
                    : shelf === 'verified'
                      ? 'Verification is for Communities a lot of people are in.'
                      : 'Start the first one and people can join it.'
              }
              action={
                debounced
                  ? <Button variant="subtle" onClick={() => setTerm('')}>Clear the search</Button>
                  : shelf === 'biggest' || shelf === 'mine'
                    ? <Button onClick={openNew} icon={faPlus}>Make one</Button>
                    : <Button variant="subtle" onClick={() => setShelf('biggest')}>
                      Everything
                    </Button>
              }
            />
          </Card>
        )}

        {/* One card, one size, one grid. `auto-rows-fr` is what stops a
            long description making a tall card out of its row. */}
        {!all.loading && !!shown.length && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {shown.map((community) => (
              <CommunityTile
                key={community.id}
                community={community}
                joined={mineIds.has(community.id)}
              />
            ))}
          </div>
        )}

        {/* On a phone the rail's foot is hidden, so the one slot that says
            what it is when it is empty goes under the grid instead. */}
        {!all.loading && !!shown.length && <AdBanner className="mt-6 lg:hidden" quiet />}
      </BrowseFrame>
    </Page>
  )
}

/**
 * One Community, the same size whatever it says about itself.
 *
 * The emblem hangs over the cover rather than sitting under it, which is the
 * thing that makes a card read as composed rather than stacked - and the
 * reason the row holding it is `relative`, because the cover is positioned
 * and would otherwise be painted over the top of it.
 */
function CommunityTile({ community, joined }: {
  community: Community
  joined?: boolean
}) {
  return (
    <Link
      to={communityLink(community)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink-card transition-colors hover:border-brand/60"
    >
      <div className="relative h-24 shrink-0 overflow-hidden bg-media">
        {community.banner_url ? (
          <img
            src={community.banner_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          /* Not a grey rectangle. A Community with no banner still gets a
             card that looks like somebody made it. */
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-brand/35 via-ink-raised to-ink-raised"
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-ink-card via-ink-card/30 to-transparent" />

        {joined && (
          <span className="absolute right-3 top-3 rounded-lg bg-ink/75 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-space-bright backdrop-blur">
            Joined
          </span>
        )}
      </div>

      <div className="relative z-10 flex flex-col gap-2.5 px-4 pb-4">
        {/*
          * Stacked on a phone, side by side from `sm`.
          *
          * Two of these tiles fit across a phone, and side by side the
          * fifty-six pixel emblem left about eighty for the name: every
          * Community on the page read "Sta..." and "The ...", and the
          * member count broke across two lines. Under the emblem the name
          * gets the whole card.
          */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <span className="-mt-7 grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-deep font-display text-base font-extrabold ring-4 ring-ink-card">
            {community.icon_url
              ? <img src={community.icon_url} alt="" className="h-full w-full object-cover" />
              : community.name.slice(0, 2).toUpperCase()}
          </span>

          <span className="min-w-0 flex-1 sm:pt-0.5">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-bold">{community.name}</span>
              {community.is_verified && <Verified className="text-xs" />}
            </span>
            <span className="block text-xs text-muted">
              {formatCount(community.member_count)}{' '}
              {community.member_count === 1 ? 'member' : 'members'}
            </span>
          </span>
        </div>

        {/* Two lines of room whether or not there is anything to put in
            them, so a Community that says nothing and one that says plenty
            make the same card. */}
        <span className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-white/55">
          {community.description || 'No description yet.'}
        </span>
      </div>
    </Link>
  )
}
