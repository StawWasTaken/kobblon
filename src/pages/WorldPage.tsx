import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faPlay, faStar, faBell, faFlag, faSliders, faAward, faBagShopping, faServer,
  faXmark, faSpinner, faDownload, faEllipsis, faLink, faCube, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { SidePanel, Fact } from '@/components/ui/SidePanel'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { NameMarks } from '@/components/brand/Verified'
import { RatingBar } from '@/components/worlds/RatingBar'
import { Reactions } from '@/components/social/Reactions'
import { reactionsOn, inTheKlub } from '@/lib/api'
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

/*
 * A World, on the website.
 *
 * Staw wants what old Roblox felt like, in our paint: the name and whoever
 * made it at the top, the picture big on the left, everything you can do in
 * a column on the right, and then every part of the World straight down the
 * page - what it is, what it hands out, what it sells, who is in it. No
 * tabs, no side rail of summaries, nothing folded away. The page is long
 * because the World has that much in it, and reading down it is how you
 * find out what is there.
 *
 * Pressing Play hands its number to the Launcher, which is what actually
 * runs it, and nothing here pretends a browser tab can. Everything on this
 * page is a real number somebody can change.
 */

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
          <Glyph icon={faXmark} />
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
              <Glyph icon={faSpinner} spin />
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

/**
 * One part of a World, with its name and how much of it there is.
 *
 * A heading that says "Badges 4" is the whole reason old pages like this
 * worked: you can see what a World has from the page rather than by pressing
 * things to find out. Left out entirely when there is nothing in it and you
 * are not the one who could put something there.
 */
function Section({ id, icon, title, count, hide, children }: {
  id: string
  icon: IconDefinition
  title: string
  count: number
  hide?: boolean
  children: React.ReactNode
}) {
  if (hide) return null
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-2.5 flex items-center gap-2 font-display text-lg font-extrabold">
        <Glyph icon={icon} className="text-sm text-muted" />
        {title}
        {count > 0 && <span className="text-sm font-bold text-muted">{formatCount(count)}</span>}
      </h2>
      {children}
    </section>
  )
}

export default function WorldPage() {
  const { id = '' } = useParams()
  const number = Number(id)
  const { profile } = useAuth()
  const toast = useToast()

  const world = useAsync(async () => (number ? getWorld(number) : null), [number])
  const thing = world.data

  /*
   * The faces on this World, and whether this person may add one. The
   * membership is asked of the server rather than read off the profile,
   * so a membership that has run out stops working the day it runs out.
   */
  const faces = useAsync(
    async () => (thing ? reactionsOn('world', thing.id) : []),
    [world.data?.id],
  )
  const klub = useAsync(async () => (profile ? inTheKlub() : false), [profile?.id])
  const inKlub = klub.data ?? false

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

  const start = (room?: string) => {
    setHanding('opening')
    /*
     * `room` is which copy of the World, from the Servers tab - and it is
     * a hint, never a permission. Whether this account may be in that room
     * is decided by `join_world_server` over HTTPS, which is where it has
     * always been decided; a full room, a closed one or a private one
     * refuses there.
     */
    void play(thing.id, () => setHanding('missing'), room)
  }

  const playing_now = playing.data ?? 0

  return (
    <>
      <Page>
        {/* Who built it and what it is called, above everything, the way a
            thing with a maker is introduced. */}
        <div className="flex items-start gap-3 border-b border-ink-line pb-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-ink-line bg-gradient-to-br from-brand to-brand-deep sm:h-16 sm:w-16">
            {(thing.emblem_url ?? thing.cover_url) ? (
              <img
                src={thing.emblem_url ?? thing.cover_url ?? ''}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl font-black text-white/90">
                {thing.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="truncate font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              {thing.name}
            </h1>

            {owner ? (
              <Link
                to={profileLink(owner)}
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
              >
                <PersonAvatar person={owner} size="xs" />
                By <span className="font-bold text-white">{owner.display_name}</span>
                <NameMarks person={owner} />
              </Link>
            ) : (
              <p className="mt-1 text-sm text-white/70">
                By <span className="font-bold text-white">{thing.creator_name ?? 'Kobblon'}</span>
              </p>
            )}
          </div>

          <Menu
            label="More"
            align="right"
            trigger={
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-line text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                <Glyph icon={faEllipsis} />
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
                  onSelect: () => { void editInWorkspace(thing.id, () => setHanding('missing')) },
                },
              ] : []),
              { label: 'Report abuse', icon: faFlag, danger: true, onSelect: () => setReporting(true) },
            ]}
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          {/* The picture, and then the World itself, all the way down. */}
          <div className="min-w-0 space-y-6">
            <WorldGallery shots={shots} name={thing.name} />

            <SidePanel title="About this World">
              <p className="whitespace-pre-wrap leading-relaxed text-white/75">
                {thing.description || 'Whoever built this has not described it yet.'}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                {/* Only when somebody is in it. A row of zeroes on every quiet
                    World says the platform is empty, which is both true and
                    not worth printing. */}
                {playing_now > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-space/15 px-2.5 py-1 font-bold text-space">
                    <span className="h-1.5 w-1.5 rounded-full bg-space" />
                    {formatCount(playing_now)} playing
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

                {profile && !mine && (
                  <button
                    onClick={() => setReporting(true)}
                    className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-danger/80 hover:text-danger"
                  >
                    <Glyph icon={faFlag} className="text-[10px]" />
                    Report Abuse
                  </button>
                )}
              </div>
            </SidePanel>

            {/* Every section down the page, each one saying how much of it
                there is, so nothing is behind a press. */}
            <Section
              id="badges"
              icon={faAward}
              title="Badges"
              count={badges.data?.length ?? 0}
              hide={!mine && !badges.data?.length}
            >
              <WorldThings kind="badges" badges={badges.data ?? []} mine={mine} worldId={thing.id} />
            </Section>

            <Section
              id="shop"
              icon={faBagShopping}
              title="Store"
              count={passes.data?.length ?? 0}
              hide={!mine && !passes.data?.length}
            >
              <WorldThings kind="shop" passes={passes.data ?? []} mine={mine} worldId={thing.id} />
            </Section>

            <Section
              id="servers"
              icon={faServer}
              title="Servers"
              count={servers.data?.length ?? 0}
            >
              <ServerList
                servers={servers.data ?? []}
                name={thing.name}
                onJoin={(server) => start(server.id)}
              />
            </Section>

            <AlsoJoinedRow worlds={alsoPlayed.data ?? []} />
          </div>

          {/* Everything you can do about this World, in one column beside it. */}
          <aside className="space-y-4 max-lg:order-first">
            <Button size="lg" variant="enter" block onClick={() => start()}>
              <Glyph icon={faPlay} />
              <span className="font-display text-lg font-extrabold">Play</span>
            </Button>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-card px-3 py-2.5">
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
                  <Glyph icon={faStar} />
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
                  <Glyph icon={faBell} />
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

            {/*
              * The facts table old Roblox had down the right of every game,
              * and the thing people actually read before pressing Play.
              */}
            <SidePanel icon={faCircleInfo} title="Details">
              <dl>
                {playing_now > 0 && (
                  <Fact
                    label="Playing now"
                    value={<span className="text-space-bright">{formatCount(playing_now)}</span>}
                  />
                )}
                <Fact label="Visits" value={formatCount(thing.visit_count)} />
                <Fact label="Favourites" value={formatCount(counts.favourites)} />
                <Fact label="Likes" value={formatCount(counts.likes)} />
                <Fact label="Genre" value={genre?.label ?? 'Not set'} />
                <Fact
                  label="Published"
                  value={thing.published_at ? timeAgo(thing.published_at) : 'Not yet'}
                />
                <Fact label="Updated" value={thing.updated_at ? timeAgo(thing.updated_at) : 'Never'} />
              </dl>
            </SidePanel>

            {/*
              * Faces, beside the rating rather than instead of it.
              *
              * Staw: "worlds keep the dislikes & likes only, but klub users
              * can also click a third button to add reactions to worlds".
              * The bar is a rating and a rating has to be one number; a face
              * says something the number cannot, and it does not move the
              * number. The server refuses a non-member, so this only saves
              * somebody a round trip.
              */}
            <Reactions
              what="world"
              which={thing.id}
              counts={faces.data ?? []}
              canReact={!!profile && !profile.is_guest && inKlub}
              whyNot={!profile
                ? 'Sign in to react.'
                : 'Reacting to a World is a Kobblon Klub thing.'}
              onChanged={faces.reload}
            />

            <AdBanner size="tall" quiet className="hidden lg:block" />
          </aside>
        </div>
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
