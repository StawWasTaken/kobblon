import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay, faDesktop, faStar, faFlag, faArrowRight, faSliders,
} from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Tabs } from '@/components/ui/Tabs'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { RatingBar } from '@/components/spaces/RatingBar'
import { ReportDialog } from '@/components/social/ReportDialog'
import { WorldGallery, type Shot } from '@/components/worlds/WorldGallery'
import { AdBanner } from '@/components/ads/AdBanner'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  favouriteWorld, getWorld, myWorldStanding, setWorldOpinion, worldFileUrl, worldGenres,
  worldMedia,
} from '@/lib/api'
import { play } from '@/lib/app'
import { worldLink } from '@/lib/links'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * A World, on the website.
 *
 * The website is where you find a thing, look at it and decide. Pressing
 * Play hands its number to the Launcher, which is what actually runs it, and
 * nothing here pretends a browser tab can.
 *
 * Everything on this page is a real number somebody can change. A page that
 * draws a likes bar nothing writes to is a picture of a page.
 */

const tabs = ['About', 'Details'] as const
type Tab = (typeof tabs)[number]

/** How grown up a World says it is, in words rather than a rating code. */
const maturities: Record<string, string> = {
  everyone: 'Everyone',
  mild: 'Mild',
  moderate: 'Moderate',
  strong: 'Strong',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 flex-1 px-3 py-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white/90">{value}</p>
    </div>
  )
}

export default function WorldPage() {
  const { id = '' } = useParams()
  const number = Number(id)
  const { profile } = useAuth()
  const toast = useToast()

  const world = useAsync(async () => (number ? getWorld(number) : null), [number])
  const thing = world.data

  const media = useAsync(async () => (thing ? worldMedia(thing.id) : []), [thing?.id])
  const genres = useAsync(worldGenres, [])
  const standing = useAsync(
    async () => (thing && profile ? myWorldStanding(thing.id) : null),
    [thing?.id, profile?.id],
  )

  const [tab, setTab] = useState<Tab>('About')
  const [missing, setMissing] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [busy, setBusy] = useState(false)

  useCanonicalPath(thing?.content_id === number ? worldLink(thing) : null)
  useTitle(thing?.name ?? 'World')
  useSocialCard({
    title: thing ? `${thing.name} - Kobblon` : null,
    description: thing?.description
      ?? (thing ? `A World on Kobblon by ${thing.creator_name ?? 'somebody'}.` : null),
    image: thing?.cover_url ?? null,
  })

  if (world.loading) {
    return (
      <Page>
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <Skeleton className="aspect-[16/9] rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Page>
    )
  }

  if (world.error) {
    return <Page width="narrow"><ErrorState message={world.error} onRetry={world.reload} /></Page>
  }

  if (!thing) {
    return (
      <Page width="narrow">
        <Card>
          <EmptyState
            mood="noResults"
            title="No World here"
            body="There is nothing at that address. It may have been taken down."
            action={<Button to="/discover">See what else there is</Button>}
          />
        </Card>
      </Page>
    )
  }

  const mine = Boolean(profile && thing.owner_id && profile.id === thing.owner_id)

  /* The emblem leads, because it is what a World chose to be known by. */
  const shots: Shot[] = [
    ...(thing.cover_url ? [{ id: 'emblem', kind: 'image' as const, url: thing.cover_url }] : []),
    ...(media.data ?? []).map((one) => ({
      id: one.id,
      kind: one.kind,
      url: worldFileUrl(one.path),
    })),
  ]

  const genre = genres.data?.find((one) => one.id === thing.genre)

  /** Nothing is written until the database has agreed to it. */
  const say = async (what: () => Promise<void>) => {
    if (!profile) return
    setBusy(true)
    try {
      await what()
      await Promise.all([standing.reload(), world.reload()])
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const opinion = standing.data?.opinion ?? null
  const favourited = Boolean(standing.data?.favourited)

  return (
    <>
      <Page>
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <WorldGallery shots={shots} name={thing.name} />

          <div className="flex flex-col">
            <div className="flex items-start gap-3">
              {thing.cover_url && (
                <img
                  src={thing.cover_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl border border-ink-line object-cover"
                />
              )}
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                  {thing.name}
                </h1>
                <p className="mt-1 text-sm text-white/70">
                  By <span className="font-bold text-white">{thing.creator_name ?? 'Kobblon'}</span>
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {genre && <Badge tone="brand">{genre.label}</Badge>}
              <Badge tone="neutral">
                Maturity: {maturities[thing.maturity ?? 'everyone'] ?? 'Everyone'}
              </Badge>
              {thing.content_id && <Badge tone="neutral">WLD-{thing.content_id}</Badge>}
            </div>

            <div className="mt-auto pt-8">
              <Button
                size="lg"
                block
                icon={faPlay}
                onClick={() => play(thing.id, () => setMissing(true))}
              >
                Play
              </Button>

              <div className="mt-4 flex items-start justify-center gap-6">
                <Tooltip
                  label={profile ? (favourited ? 'Saved' : 'Save this World') : 'Sign in to save it'}
                  side="top"
                >
                  <button
                    onClick={() => void say(() =>
                      favouriteWorld(thing.id, profile!.id, !favourited))}
                    disabled={!profile || busy}
                    aria-pressed={favourited}
                    className={cn(
                      'flex shrink-0 flex-col items-center gap-1 text-[11px] font-bold',
                      'transition-colors disabled:opacity-40',
                      favourited ? 'text-amber-300' : 'text-white/60 hover:text-white',
                    )}
                  >
                    <FontAwesomeIcon icon={faStar} className="text-base" />
                    {formatCount(thing.favourite_count ?? 0)}
                  </button>
                </Tooltip>

                <RatingBar
                  likes={thing.like_count}
                  dislikes={thing.dislike_count ?? 0}
                  iLike={opinion === true}
                  iDislike={opinion === false}
                  disabled={!profile || busy}
                  onLike={() => void say(() =>
                    setWorldOpinion(thing.id, opinion === true ? null : true))}
                  onDislike={() => void say(() =>
                    setWorldOpinion(thing.id, opinion === false ? null : false))}
                />
              </div>

              {mine && (
                <Button
                  variant="ghost"
                  block
                  icon={faSliders}
                  className="mt-4"
                  to={`/create/worlds/${thing.id}`}
                >
                  Configure
                </Button>
              )}
            </div>
          </div>
        </div>

        <Tabs
          look="line"
          className="mt-8"
          label="Which part of this World"
          value={tab}
          onChange={setTab}
          options={tabs.map((name) => ({ value: name, label: name }))}
        />

        {tab === 'About' && (
          <div className="mt-6">
            <h2 className="text-lg font-bold">Description</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap leading-relaxed text-white/70">
              {thing.description || 'Whoever built this has not described it yet.'}
            </p>

            <div className="mt-6 flex flex-wrap border-y border-ink-line">
              <Stat label="Visits" value={formatCount(thing.visit_count)} />
              <Stat label="Favourites" value={formatCount(thing.favourite_count ?? 0)} />
              <Stat label="Likes" value={formatCount(thing.like_count)} />
              <Stat
                label="Published"
                value={thing.published_at ? timeAgo(thing.published_at) : 'Not yet'}
              />
              <Stat label="Genre" value={genre?.label ?? 'Not set'} />
            </div>

            {profile && !mine && (
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

        {tab === 'Details' && (
          <div className="mt-6 space-y-4">
            <Card className="flex flex-wrap items-center gap-4 p-5">
              <FontAwesomeIcon icon={worldIcon} className="text-lg text-brand-bright" />
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
                Worlds run in the Kobblon Launcher, not in a browser tab. Pressing Play opens it.
              </p>
              <Link
                to="/download"
                className="flex items-center gap-2 text-sm font-bold text-link hover:underline"
              >
                Get the Launcher
                <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
              </Link>
            </Card>

            <div className="flex flex-wrap border-y border-ink-line">
              <Stat label="Number" value={`WLD-${thing.content_id}`} />
              <Stat label="Engine" value={`Version ${thing.runtime_version}`} />
              <Stat
                label="Maturity"
                value={maturities[thing.maturity ?? 'everyone'] ?? 'Everyone'}
              />
            </div>
          </div>
        )}

        <AdBanner className="mt-10" quiet />
      </Page>

      {/* Nothing happened, so say so rather than leaving somebody pressing. */}
      <Dialog
        open={missing}
        onClose={() => setMissing(false)}
        title="You need the Kobblon Launcher"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            Worlds run in the Launcher rather than in a browser. If you have it already, it
            may just be slow to open: give it a moment and press Play again.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setMissing(false)}>Close</Button>
            <Button icon={faDesktop} to="/download">Get the Launcher</Button>
          </div>
        </div>
      </Dialog>

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="space"
        targetId={thing.id}
        targetName={thing.name}
      />
    </>
  )
}
