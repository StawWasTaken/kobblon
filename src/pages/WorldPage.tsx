import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay, faStar, faBell, faFlag, faSliders, faAward, faBagShopping, faServer,
  faXmark, faSpinner, faDownload, faEllipsis, faLink, faCube,
} from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Menu } from '@/components/ui/Menu'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { NameMarks } from '@/components/brand/Verified'
import { RatingBar } from '@/components/worlds/RatingBar'
import { WorldGallery, type Shot } from '@/components/worlds/WorldGallery'
import { ReportDialog } from '@/components/social/ReportDialog'
import { ServerList } from '@/components/worlds/ServerList'
import { AlsoJoinedRow } from '@/components/worlds/AlsoJoinedRow'
import { WorldThings } from '@/components/worlds/WorldThings'
import { AdBanner } from '@/components/ads/AdBanner'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  alsoJoined, badgesOf, doIWatchWorld, favouriteWorld, getWorld, myWorldStanding,
  passesOf, playingNow, serversOf, setWorldOpinion, watchWorld,
  worldFileUrl, worldGenres, worldMedia,
} from '@/lib/api'
import { play, editInWorkspace } from '@/lib/app'
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
  const watching = useAsync(
    async () => (thing && profile ? doIWatchWorld(thing.id) : false),
    [thing?.id, profile?.id],
  )

  /*
   * Who is in there now, and what the people who play it also play.
   *
   * Presence is a claim that expires, so this is asked again rather than
   * kept: a list held open for ten minutes is a list of people who left.
   */
  const servers = useAsync(async () => (thing ? serversOf(thing.id) : []), [thing?.id])
  const playing = useAsync(async () => (thing ? playingNow(thing.id) : 0), [thing?.id])
  const alsoPlayed = useAsync(async () => (thing ? alsoJoined(thing.id) : []), [thing?.id])
  const badges = useAsync(async () => (thing ? badgesOf(thing.id) : []), [thing?.id])
  const passes = useAsync(async () => (thing ? passesOf(thing.id) : []), [thing?.id])

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
  const [notify, setNotify] = useState(false)
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

  useEffect(() => {
    setNotify(Boolean(watching.data))
  }, [watching.data])

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

  const tell = () => {
    const want = !notify
    void say(
      () => setNotify(want),
      () => setNotify(!want),
      () => watchWorld(thing.id, profile!.id, want),
    )
  }

  const start = () => {
    setHanding('opening')
    void play(thing.id, () => setHanding('missing'))
  }

  return (
    <>
      {/*
        * A banner with the emblem sitting across its edge, rather than a
        * picture on the left and a column of facts on the right.
        *
        * Staw said the page looked too much like Roblox, and the two-column
        * card was the reason: it is their shape, and it makes every World
        * read as a product listing. This is the shape a profile has - a
        * thing with a face and a name - which is nearer what a World is,
        * and it gives the emblem somewhere to matter.
        *
        * The screenshots move down into About, where somebody who wants
        * them goes looking. The picture up here is the cover, behind the
        * words rather than beside them.
        */}
      <Page>
        <section className="overflow-hidden rounded-3xl border border-ink-line bg-ink-card">
          <div className="relative h-32 w-full sm:h-44">
            {thing.cover_url ? (
              <img src={thing.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-brand-deep to-ink-sunken" />
            )}
            {/* So the words stay readable over whatever somebody uploaded. */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-card via-ink-card/60 to-ink-card/10" />
          </div>

          <div className="relative px-5 pb-5 sm:px-7 sm:pb-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                {/*
                  * The emblem, half over the banner. Square, because that is
                  * what an emblem is; the cover is the wide one.
                  */}
                <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-ink-card bg-gradient-to-br from-brand to-brand-deep sm:-mt-12 sm:h-24 sm:w-24">
                  {(thing.emblem_url ?? thing.cover_url) ? (
                    <img
                      src={thing.emblem_url ?? thing.cover_url ?? ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display text-3xl font-black text-white/90">
                      {thing.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 pb-1">
                  <h1 className="truncate font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                    {thing.name}
                  </h1>

                  {owner ? (
                    <Link
                      to={profileLink(owner)}
                      className="mt-1.5 inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
                    >
                      <PersonAvatar person={owner} size="xs" />
                      By <span className="font-bold text-white">{owner.display_name}</span>
                      <NameMarks person={owner} />
                    </Link>
                  ) : (
                    <p className="mt-1.5 text-sm text-white/70">
                      By <span className="font-bold text-white">{thing.creator_name ?? 'Kobblon'}</span>
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {/*
                      * Only when somebody is in it. A row of zeroes on every
                      * quiet World says the platform is empty, which is both
                      * true and not worth printing.
                      */}
                    {(playing.data ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-space/15 px-2.5 py-1 font-bold text-space">
                        <span className="h-1.5 w-1.5 rounded-full bg-space" />
                        {formatCount(playing.data ?? 0)} playing
                      </span>
                    )}
                    {genre && (
                      <span className="rounded-full bg-white/5 px-2.5 py-1 font-semibold text-muted">
                        {genre.label}
                      </span>
                    )}
                    <span className="rounded-full bg-white/5 px-2.5 py-1 font-semibold text-muted">
                      {formatCount(thing.visit_count)} visits
                    </span>
                  </div>
                </div>
              </div>

              {/* Play, with the small things beside it rather than under it. */}
              <div className="flex shrink-0 flex-col gap-3 sm:min-w-[18rem]">
                <div className="flex items-center gap-2">
                  <Button size="lg" variant="enter" className="flex-1" onClick={start}>
                    <FontAwesomeIcon icon={faPlay} />
                    <span className="font-display text-lg font-extrabold">Play</span>
                  </Button>

                  <Menu
                    label="More"
                    align="right"
                    trigger={
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-line text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                        <FontAwesomeIcon icon={faEllipsis} />
                      </span>
                    }
                    items={[
                      {
                        label: 'Copy link',
                        icon: faLink,
                        onSelect: () => {
                          void navigator.clipboard?.writeText(window.location.href)
                          toast('Link copied.', 'success')
                        },
                      },
                      ...(mine ? [
                        { label: 'Edit the page', icon: faSliders, to: `/create/worlds/${thing.id}` },
                        {
                          label: 'Open in Workspace',
                          icon: faCube,
                          onSelect: () => editInWorkspace(thing.id, () => setHanding('missing')),
                        },
                      ] : []),
                      { label: 'Report abuse', icon: faFlag, danger: true, onSelect: () => setReporting(true) },
                    ]}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <Tooltip
                    label={profile ? (favourited ? 'Saved' : 'Save this World') : 'Sign in to save it'}
                    side="top"
                  >
                    <button
                      onClick={keep}
                      disabled={!profile}
                      aria-pressed={favourited}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 text-xs font-bold transition-colors disabled:opacity-40',
                        favourited ? 'text-amber-300' : 'text-white/60 hover:text-white',
                      )}
                    >
                      <FontAwesomeIcon icon={faStar} />
                      {formatCount(counts.favourites)}
                    </button>
                  </Tooltip>

                  <Tooltip
                    label={profile
                      ? (notify
                        ? 'You will be told when this World changes'
                        : 'Get told when this World changes')
                      : 'Sign in to be told'}
                    side="top"
                  >
                    <button
                      onClick={tell}
                      disabled={!profile}
                      aria-pressed={notify}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 text-xs font-bold transition-colors disabled:opacity-40',
                        notify ? 'text-link' : 'text-white/60 hover:text-white',
                      )}
                    >
                      <FontAwesomeIcon icon={faBell} />
                      Notify
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
              </div>
            </div>
          </div>
        </section>

        <Tabs
          look="line"
          className="mt-8"
          label="Which part of this World"
          value={tab}
          onChange={setTab}
          options={tabs.map((name) => ({ value: name, label: name, icon: tabIcons[name] }))}
        />

        {/*
          * One box for every tab.
          *
          * They were four different things before - About ran its own
          * left-aligned column while the other three were cards - so moving
          * between tabs moved the page under you and nothing lined up.
          * Each one is the same card in the same place now, which is what
          * "uniform" has to mean before anything inside it is worth
          * arguing about.
          */}
        <div className="mt-6">
          {tab === 'About' && (
            <Card className="p-5 sm:p-6">
              {/*
                * Centred and capped. Across the whole column one screenshot
                * is a 1088-pixel wall; left-aligned in a wide card it looks
                * like a mistake.
                */}
              <div className="mx-auto max-w-3xl">
                <WorldGallery shots={shots} name={thing.name} />
              </div>

              <div className="mx-auto mt-8 max-w-3xl">
                <h2 className="font-display text-lg font-extrabold">Description</h2>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/70">
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
            </Card>
          )}

          {tab === 'Badges' && (
            <WorldThings kind="badges" badges={badges.data ?? []} mine={mine} worldId={thing.id} />
          )}

          {tab === 'Shop' && (
            <WorldThings kind="shop" passes={passes.data ?? []} mine={mine} worldId={thing.id} />
          )}

          {tab === 'Servers' && (
            <ServerList servers={servers.data ?? []} name={thing.name} />
          )}
        </div>

        <AlsoJoinedRow worlds={alsoPlayed.data ?? []} />

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
