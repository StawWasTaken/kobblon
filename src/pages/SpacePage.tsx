import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell, faStar, faFlag, faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { ReportDialog } from '@/components/social/ReportDialog'
import { BadgeTile } from '@/components/spaces/BadgeGrid'
import { BadgeManager } from '@/components/spaces/BadgeManager'
import { RatingBar } from '@/components/spaces/RatingBar'
import { Carousel } from '@/components/spaces/Carousel'
import { categoryLabels } from '@/components/spaces/SpaceCard'
import { RefImage } from '@/components/create/RefImage'
import { profileLink, spaceLink } from '@/lib/links'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useExactTitle, useSocialCard } from '@/hooks/useTitle'
import {
  addressNow, getSpace, getSpaceStats, listSpaceBadges, spaceById,
  toggleSpaceFlag,
} from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Verified } from '@/components/brand/Verified'
import { AdBanner } from '@/components/ads/AdBanner'
import { PersonAvatar } from '@/components/ui/PersonAvatar'

const tabs = ['About', 'Badges'] as const
type Tab = (typeof tabs)[number]

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 flex-1 px-3 py-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white/90">{value}</p>
    </div>
  )
}

export default function SpacePage() {
  const { username: nameParam = '', slug: slugParam = '', id } = useParams()
  const navigate = useNavigate()

  const byId = useAsync(async () => (id ? spaceById(Number(id)) : null), [id])
  const username = id ? byId.data?.owner_username ?? '' : nameParam
  const slug = id ? byId.data?.slug ?? '' : slugParam
  const { profile } = useAuth()
  const toast = useToast()

  const { data: space, error, loading, reload } = useAsync(
    async () => (username && slug ? getSpace(username, slug) : null),
    [username, slug],
  )

  useExactTitle(space ? `${space.name} - Visit on Kobblon` : null)
  useSocialCard({
    title: space ? `${space.name} - Kobblon` : null,
    description: space?.description
      ?? (space?.owner ? `A Space on Kobblon by ${space.owner.display_name}.` : null),
    image: space?.cover_url ?? space?.emblem_url ?? null,
  })

  // The old owner/slug address still works, and hands you the numbered one.
  useEffect(() => {
    if (!id && space?.content_id) navigate(spaceLink(space), { replace: true })
  }, [id, space?.content_id, navigate])

  // A Space that has been renamed carries its new name in the address.
  useCanonicalPath(id && space?.content_id === Number(id) ? spaceLink(space) : null)

  // An address from before a rename still lands, rather than in a 404.
  useEffect(() => {
    if (id || loading || space || !username || !slug) return
    let live = true
    void addressNow('space', slug).then((now) => {
      if (live && now && now !== slug) navigate(`/u/${username}/${now}`, { replace: true })
    })
    return () => { live = false }
  }, [id, loading, space, username, slug, navigate])
  const stats = useAsync(
    async () => (space ? getSpaceStats(space.id) : null),
    [space?.id, profile?.id],
  )
  const badges = useAsync(
    async () => (space ? listSpaceBadges(space.id) : []),
    [space?.id],
  )

  const [tab, setTab] = useState<Tab>('About')

  const [reporting, setReporting] = useState(false)



  const flag = async (
    table: 'space_likes' | 'space_dislikes' | 'space_favorites' | 'space_watchers',
    on: boolean,
  ) => {
    if (!space || !profile) return
    try {
      await toggleSpaceFlag(table, space.id, profile.id, on)
      stats.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    }
  }

  if (loading) {
    return (
      <Page className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Skeleton className="aspect-[16/9] w-full" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Page>
    )
  }

  if (error) return <Page><ErrorState message={error} onRetry={reload} /></Page>

  if (!space) {
    return (
      <Page>
        <Card>
          <EmptyState
            mood="noResults"
            title="No Space here"
            body={`@${username} does not have a Space called "${slug}", or it is not published yet.`}
            action={<Button to="/discover">Discover Spaces</Button>}
          />
        </Card>
      </Page>
    )
  }

  const owner = space.owner
  const isOwner = profile?.id === space.owner_id
  // The cover leads, then whatever thumbnails have been added.
  /*
   * The pictures of this Space. The first of them is the cover, so it is not
   * added again on the front of the list.
   */
  const shots = (space.thumbnail_urls?.length
    ? space.thumbnail_urls
    : [space.cover_url].filter(Boolean) as string[])
  const numbers = stats.data

  return (
    <>
      <Page>
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <Carousel images={shots} alt={`Pictures of ${space.name}`} />

          <div className="flex flex-col">
            <div className="flex items-start gap-3">
              {space.emblem_url && (
                <RefImage
                  value={space.emblem_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl border border-ink-line object-cover"
                />
              )}
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                  {space.name}
                </h1>
                {owner && (
                  <Link
                    to={profileLink(owner)}
                    className="mt-1 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
                  >
                    <span className="relative">
                      <PersonAvatar person={owner} size="xs" />
                    </span>
                    By <span className="font-bold text-white">{owner.display_name}</span>
                    {owner.is_admin && (
                      <Verified />
                    )}
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{categoryLabels[space.category]}</Badge>
              {!space.is_published && <Badge tone="warm">Draft</Badge>}
              {space.content_id && <Badge tone="neutral">SPC-{space.content_id}</Badge>}
            </div>

            <div className="mt-auto pt-8">
              {/* There is nothing to enter any more: the 2D Space runtime
                  has gone, and what replaces it is an experience played in
                  the Launcher. This page is the overview until then. */}
              <p className="rounded-2xl border border-ink-line bg-ink-raised px-4 py-3 text-center text-sm leading-relaxed text-muted">
                Kobblon Spaces are being replaced by experiences, which are
                built in Creator and played in the Launcher. This one is kept
                here to read.
              </p>

              <div className="mt-3 flex items-start justify-center gap-5">
                <Tooltip label={numbers?.i_favorite ? 'Saved' : 'Save this Space'} side="top">
                  <button
                    onClick={() => flag('space_favorites', !numbers?.i_favorite)}
                    disabled={!profile}
                    aria-pressed={numbers?.i_favorite}
                    className={cn(
                      'flex shrink-0 flex-col items-center gap-1 text-[11px] font-bold transition-colors disabled:opacity-40',
                      numbers?.i_favorite ? 'text-amber-300' : 'text-white/60 hover:text-white',
                    )}
                  >
                    <FontAwesomeIcon icon={faStar} className="text-base" />
                    Favourite
                  </button>
                </Tooltip>

                <Tooltip label="Get told when this Space is updated" side="top">
                  <button
                    onClick={() => flag('space_watchers', !numbers?.i_watch)}
                    disabled={!profile}
                    aria-pressed={numbers?.i_watch}
                    className={cn(
                      'flex shrink-0 flex-col items-center gap-1 text-[11px] font-bold transition-colors disabled:opacity-40',
                      numbers?.i_watch ? 'text-link' : 'text-white/60 hover:text-white',
                    )}
                  >
                    <FontAwesomeIcon icon={faBell} className="text-base" />
                    Notify
                  </button>
                </Tooltip>

                <RatingBar
                  likes={numbers?.likes ?? space.like_count}
                  dislikes={numbers?.dislikes ?? space.dislike_count}
                  iLike={Boolean(numbers?.i_like)}
                  iDislike={Boolean(numbers?.i_dislike)}
                  disabled={!profile}
                  onLike={() => flag('space_likes', !numbers?.i_like)}
                  onDislike={() => flag('space_dislikes', !numbers?.i_dislike)}
                />
              </div>

              {isOwner && (
                <div className="mt-4 grid gap-2">
                  <Button variant="ghost" block icon={faPenToSquare} to={`/create/spaces/${space.id}/edit`}>
                    Configure
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Tabs
          look="line"
          className="mt-8"
          label="Which part of this Space"
          value={tab}
          onChange={setTab}
          options={tabs.map((name) => ({ value: name, label: name }))}
        />

        {tab === 'About' && (
          <div className="mt-6">
            <h2 className="text-lg font-bold">Description</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap leading-relaxed text-white/70">
              {space.description || 'The person who made this has not described it yet.'}
            </p>

            <div className="mt-6 flex flex-wrap border-y border-ink-line">
              <Stat label="Active" value={formatCount(numbers?.active_now ?? 0)} />
              <Stat label="Visits" value={formatCount(numbers?.visits ?? space.visit_count)} />
              <Stat label="Favourites" value={formatCount(numbers?.favorites ?? space.favorite_count)} />
              <Stat label="Created" value={new Date(space.created_at).toLocaleDateString()} />
              <Stat label="Updated" value={timeAgo(space.updated_at)} />
              <Stat label="Genre" value={space.genre} />
            </div>

            {profile && !isOwner && (
              <div className="mt-2 text-right">
                <button
                  onClick={() => setReporting(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger/80 hover:text-danger"
                >
                  <FontAwesomeIcon icon={faFlag} className="text-[10px]" />
                  Report Abuse
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'Badges' && (
          <div className="mt-6 space-y-6">
            {isOwner && (
              <BadgeManager
                spaceId={space.id}
                badges={badges.data ?? []}
                onChanged={badges.reload}
              />
            )}

            {!badges.loading && !badges.data?.filter((b) => b.is_enabled).length && !isOwner && (
              <Card>
                <EmptyState
                  mood="emptyBox"
                  title="No badges here"
                  body="This Space does not hand any out yet."
                />
              </Card>
            )}

            {!!badges.data?.length && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {badges.data
                  .filter((badge) => badge.is_enabled || isOwner)
                  .map((badge) => <BadgeTile key={badge.id} badge={badge} />)}
              </div>
            )}
          </div>
        )}

        <AdBanner className="mt-10" quiet />
      </Page>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="space"
        targetId={space.id}
        targetName={space.name}
      />
    </>
  )
}
