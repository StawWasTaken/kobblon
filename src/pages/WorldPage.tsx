import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay, faStar, faFlag, faSliders, faAward, faBagShopping, faServer,
  faXmark, faSpinner, faDownload,
} from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { Verified, isVerified } from '@/components/brand/Verified'
import { RatingBar } from '@/components/worlds/RatingBar'
import { WorldGallery, type Shot } from '@/components/worlds/WorldGallery'
import { ReportDialog } from '@/components/social/ReportDialog'
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
import { profileLink, worldLink } from '@/lib/links'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

/*
 * A World, on the website.
 *
 * The website is where you find a thing, look at it and decide. Pressing
 * Play hands its number to the Launcher, which is what actually runs it, and
 * nothing here pretends a browser tab can.
 *
 * Everything on this page is a real number somebody can change. A page that
 * draws a likes bar nothing writes to is a drawing of a page.
 */

const tabs = ['About', 'Badges', 'Shop', 'Servers'] as const
type Tab = (typeof tabs)[number]

const tabIcons: Record<Tab, typeof faAward> = {
  About: worldIcon,
  Badges: faAward,
  Shop: faBagShopping,
  Servers: faServer,
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 flex-1 px-3 py-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-white/90">{value}</p>
    </div>
  )
}

/**
 * The small window that says what is happening when Play is pressed.
 *
 * Pressing Play in a browser looks like nothing happening: the page stays
 * still while a desktop application takes a moment to come up. This is the
 * only thing standing between that and somebody pressing Play four times,
 * so it says one thing and gets out of the way.
 */
function Handover({
  state, onClose,
}: {
  state: 'off' | 'opening' | 'missing'
  onClose: () => void
}) {
  if (state === 'off') return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-ink-line bg-ink-card p-7 text-center shadow-pop animate-pop-in">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {/* Kobblon's own mark, not a stand-in for one. */}
        <img
          src={asset('/brand/favicon.png')}
          alt=""
          className="mx-auto h-14 w-14 rounded-2xl"
        />

        {state === 'opening' ? (
          <>
            <p className="mt-5 font-display text-lg font-extrabold leading-snug">
              Kobblon is opening. Get ready!
            </p>
            {/* Blue: the green is Play's and nothing else's. */}
            <div className="mt-5 grid h-11 place-items-center rounded-xl bg-brand text-white">
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
          </>
        ) : (
          <>
            <p className="mt-5 font-display text-lg font-extrabold leading-snug">
              Get the Kobblon Launcher to play Worlds
            </p>
            <Button block icon={faDownload} to="/download" className="mt-5">
              Get the Launcher
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/** A tab that has nothing in it yet, saying what will be in it. */
function Waiting({ tab, name }: { tab: Tab; name: string }) {
  const words: Record<string, { title: string; body: string }> = {
    Badges: {
      title: 'No badges yet',
      body: `Badges are things ${name} hands out for doing something in it. Whoever built it has not made any.`,
    },
    Shop: {
      title: 'Nothing for sale',
      body: `Passes and items ${name} sells would be here. This one sells nothing.`,
    },
    Servers: {
      title: 'No servers running',
      body: `Where people are playing ${name} right now. Nobody is in it at the moment.`,
    },
  }
  const said = words[tab]
  if (!said) return null

  return (
    <Card className="mt-6">
      <EmptyState mood="emptyBox" title={said.title} body={said.body} />
    </Card>
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
  const [handing, setHanding] = useState<'off' | 'opening' | 'missing'>('off')
  const [reporting, setReporting] = useState(false)

  /*
   * What this person has said, held here rather than read back from the
   * server after every press. Pressing like should colour the thumb and
   * move the number, now; reloading the whole page to find out what you
   * just did is the page arguing with you.
   */
  const [opinion, setOpinion] = useState<boolean | null>(null)
  const [favourited, setFavourited] = useState(false)
  const [counts, setCounts] = useState({ likes: 0, dislikes: 0, favourites: 0 })

  useEffect(() => {
    if (!thing) return
    setCounts({
      likes: thing.like_count ?? 0,
      dislikes: thing.dislike_count ?? 0,
      favourites: thing.favourite_count ?? 0,
    })
  }, [thing?.id, thing?.like_count, thing?.dislike_count, thing?.favourite_count])

  useEffect(() => {
    setOpinion(standing.data?.opinion ?? null)
    setFavourited(Boolean(standing.data?.favourited))
  }, [standing.data])

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
      <Page width="narrow">
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
  const owner = thing.owner

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

  /**
   * A press moves the page first and tells the database after.
   *
   * If the database refuses, what was on screen is put back, because a
   * number that stays wrong is worse than one that flickers.
   */
  const say = async (change: () => void, undo: () => void, write: () => Promise<void>) => {
    if (!profile) return
    change()
    try {
      await write()
    } catch (err) {
      undo()
      toast((err as Error).message)
    }
  }

  const like = () => {
    const was = opinion
    const want = was === true ? null : true
    void say(
      () => {
        setOpinion(want)
        setCounts((n) => ({
          ...n,
          likes: n.likes + (want === true ? 1 : 0) - (was === true ? 1 : 0),
          dislikes: n.dislikes - (was === false ? 1 : 0),
        }))
      },
      () => {
        setOpinion(was)
        setCounts((n) => ({
          ...n,
          likes: n.likes - (want === true ? 1 : 0) + (was === true ? 1 : 0),
          dislikes: n.dislikes + (was === false ? 1 : 0),
        }))
      },
      () => setWorldOpinion(thing.id, want),
    )
  }

  const dislike = () => {
    const was = opinion
    const want = was === false ? null : false
    void say(
      () => {
        setOpinion(want)
        setCounts((n) => ({
          ...n,
          dislikes: n.dislikes + (want === false ? 1 : 0) - (was === false ? 1 : 0),
          likes: n.likes - (was === true ? 1 : 0),
        }))
      },
      () => {
        setOpinion(was)
        setCounts((n) => ({
          ...n,
          dislikes: n.dislikes - (want === false ? 1 : 0) + (was === false ? 1 : 0),
          likes: n.likes + (was === true ? 1 : 0),
        }))
      },
      () => setWorldOpinion(thing.id, want),
    )
  }

  const keep = () => {
    const want = !favourited
    void say(
      () => {
        setFavourited(want)
        setCounts((n) => ({ ...n, favourites: n.favourites + (want ? 1 : -1) }))
      },
      () => {
        setFavourited(!want)
        setCounts((n) => ({ ...n, favourites: n.favourites + (want ? -1 : 1) }))
      },
      () => favouriteWorld(thing.id, profile!.id, want),
    )
  }

  const start = () => {
    setHanding('opening')
    play(thing.id, () => setHanding('missing'))
  }

  return (
    <>
      {/*
        * Narrow on purpose. Stretched across a wide screen the emblem is a
        * billboard and the column beside it is mostly air; this is a page
        * about one thing and it reads better held together.
        */}
      <Page width="narrow">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <WorldGallery shots={shots} name={thing.name} />

          {/*
            * Everything that decides whether somebody presses Play, in one
            * column, with Play at the bottom of it where the thumb lands.
            */}
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                {thing.name}
              </h1>

              {owner ? (
                <Link
                  to={profileLink(owner)}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
                >
                  <PersonAvatar person={owner} size="xs" />
                  By <span className="font-bold text-white">{owner.display_name}</span>
                  {isVerified(owner) && <Verified />}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-white/70">
                  By <span className="font-bold text-white">{thing.creator_name ?? 'Kobblon'}</span>
                </p>
              )}

              {genre && (
                <p className="mt-2 text-sm text-muted">{genre.label}</p>
              )}
            </div>

            {thing.description && (
              <p className="line-clamp-3 text-sm leading-relaxed text-white/55">
                {thing.description}
              </p>
            )}

            <div className="mt-auto">
              <Button size="lg" block variant="enter" onClick={start}>
                <FontAwesomeIcon icon={faPlay} />
                <span className="font-display text-lg font-extrabold">Play</span>
              </Button>

              <div className="mt-4 flex items-start justify-center gap-6">
                <Tooltip
                  label={profile ? (favourited ? 'Saved' : 'Save this World') : 'Sign in to save it'}
                  side="top"
                >
                  <button
                    onClick={keep}
                    disabled={!profile}
                    aria-pressed={favourited}
                    className={cn(
                      'flex shrink-0 flex-col items-center gap-1 text-[11px] font-bold',
                      'transition-colors disabled:opacity-40',
                      favourited ? 'text-amber-300' : 'text-white/60 hover:text-white',
                    )}
                  >
                    <FontAwesomeIcon icon={faStar} className="text-base" />
                    {formatCount(counts.favourites)}
                  </button>
                </Tooltip>

                <RatingBar
                  likes={counts.likes}
                  dislikes={counts.dislikes}
                  iLike={opinion === true}
                  iDislike={opinion === false}
                  disabled={!profile}
                  onLike={like}
                  onDislike={dislike}
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
          options={tabs.map((name) => ({ value: name, label: name, icon: tabIcons[name] }))}
        />

        {tab === 'About' && (
          <div className="mt-6">
            <h2 className="font-display text-lg font-extrabold">Description</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap leading-relaxed text-white/70">
              {thing.description || 'Whoever built this has not described it yet.'}
            </p>

            <div className="mt-6 flex flex-wrap border-y border-ink-line">
              <Stat label="Visits" value={formatCount(thing.visit_count)} />
              <Stat label="Favourites" value={formatCount(counts.favourites)} />
              <Stat label="Likes" value={formatCount(counts.likes)} />
              <Stat
                label="Published"
                value={thing.published_at ? timeAgo(thing.published_at) : 'Not yet'}
              />
              <Stat
                label="Updated"
                value={thing.updated_at ? timeAgo(thing.updated_at) : 'Never'}
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

        {tab !== 'About' && <Waiting tab={tab} name={thing.name} />}

        <AdBanner className="mt-10" quiet />
      </Page>

      <Handover state={handing} onClose={() => setHanding('off')} />

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
