import { Picture } from '@/components/brand/Picture'
import { ClipShelf } from '@/components/clips/ClipCard'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faFlag, faFilm, faXmark, faSpinner, faDownload, faUsers, faCompass,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { NameMarks } from '@/components/brand/Verified'
import { Reactions } from '@/components/social/Reactions'
import { reactionsOn, inTheKlub } from '@/lib/api'
import { WorldGallery, type Shot } from '@/components/worlds/WorldStage'
import { WorldPanel } from '@/components/worlds/WorldPanel'
import { ReportDialog } from '@/components/social/ReportDialog'
import { ServersTab } from '@/components/worlds/ServersTab'
import { AlsoJoinedRow } from '@/components/worlds/AlsoJoinedRow'
import { WorldThings } from '@/components/worlds/WorldThings'
import { AdBanner } from '@/components/ads/AdBanner'
import { WorldCard } from '@/components/worlds/WorldCard'
import { Band } from '@/components/ui/Band'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useCanonicalPath } from '@/hooks/useCanonicalPath'
import { useParty } from '@/hooks/useParty'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  alsoJoined, badgesOf, clipsInWorld, clipPoster, doIWatchWorld, favouriteWorld, friendsInServers, getWorld, myWorldStanding,
  passesOf, playingNow, recommendedWorlds, serversOf, setWorldOpinion, watchWorld,
  worldFileUrl, worldGenres, worldMedia,
  partyIsGoingTo,
  type PlayerThere,
} from '@/lib/api'
import { play, editInWorkspace } from '@/lib/app'
import { profileLink, worldLink } from '@/lib/links'
import { deviceLabels, worldTag } from '@/lib/kinds'
import { DEFAULT_WORLD_THUMBNAIL, worldEmblem } from '@/lib/worldart'
import { asset } from '@/lib/asset'

/*
 * A World, on the website.
 *
 * Built around one idea: the World is the biggest thing on its own page. The
 * art runs the full width as a stage, the name and whoever made it sit on
 * the art, and Play sits there with them - so the first thing on the page is
 * the World and the second is the way in. Under that, one ribbon of numbers
 * across the page instead of a table down the side, and then the World's
 * own parts straight down, each under a heading that says how much of it
 * there is. No side rail, no tabs, nothing folded away.
 *
 * Pressing Play hands its number to the Launcher, which is what actually
 * runs it, and nothing here pretends a browser tab can. Everything on this
 * page is a real number somebody can change; a page that draws a likes bar
 * nothing writes to is a drawing of a page.
 */

/** The four ways of looking at a World, the way a profile has three. */
type WorldTab = 'Servers' | 'Badges' | 'Store'

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
      <div className="relative w-full max-w-sm rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-7 text-center shadow-pop animate-pop-in">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Glyph icon={faXmark} />
        </button>

        {/*
          * Kobblon's own mark, not a stand-in for one, and built like a
          * button: `border-2` with a `border-b-[5px]` bottom in
          * `brand-deep`. Staw wanted the mark on this card to be "a 3d
          * thing + stroke too (like the bleu button)" - it sits directly
          * above one, and a flat square over a block reads as a picture
          * that was dropped on top rather than part of the card.
          *
          * The stroke is on the frame and the art is clipped by it, so the
          * mark's own blue runs right up to the edge with no gap.
          */}
        <span className="mx-auto block h-16 w-16 overflow-hidden rounded-2xl border-2 border-b-[5px] border-brand-deep">
          <img src={asset('/brand/favicon.png')} alt="" className="h-full w-full object-cover" />
        </span>

        {state === 'opening' ? (
          <>
            <p className="mt-5 font-display text-lg font-extrabold leading-snug">
              Kobblon is opening. Get ready!
            </p>
            {/* Blue: the green is Play's and nothing else's. */}
            <div className="mt-5 grid h-11 place-items-center rounded-xl border-2 border-b-[5px] border-brand-deep bg-brand text-on-art">
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

export default function WorldPage() {
  const { id = '' } = useParams()
  /*
   * `?server=` is somebody arriving from a shared room link. It opens the
   * Servers tab on that room and lights it; it is not a permission and
   * never was - `join_world_server` over HTTPS decides whether this
   * account may be in there, as it always has.
   */
  const [query] = useSearchParams()
  const sentTo = query.get('server')
  const number = Number(id)
  const { profile } = useAuth()
  const { party } = useParty()
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
  /* Which rooms somebody they know is in. Signed out there is nobody to
     look for, and the function is not granted to anon, so it is not asked. */
  const mates = useAsync(
    async () => (thing && profile ? friendsInServers(thing.id) : {}),
    [thing?.id, profile?.id],
  )
  const alsoPlayed = useAsync(async () => (thing ? alsoJoined(thing.id) : []), [thing?.id])
  const badges = useAsync(async () => (thing ? badgesOf(thing.id) : []), [thing?.id])
  const clips = useAsync(async () => (thing ? clipsInWorld(thing.id, 8) : []), [thing?.id])
  /* What to play next. Its own genre first, then the busiest of the rest. */
  const suggested = useAsync(
    async () => (thing ? recommendedWorlds(thing.id, thing.genre, 8) : []),
    [thing?.id, thing?.genre],
  )
  const passes = useAsync(async () => (thing ? passesOf(thing.id) : []), [thing?.id])

  const [tab, setTab] = useState<WorldTab>('Servers')
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

  /*
   * A shared server link hands straight over.
   *
   * Staw: "the link to a server when u open it it leads to the game but
   * instantly makes you join this server". So arriving with `?server=`
   * opens the Launcher on that room rather than waiting for a second
   * press - the person already pressed something, it was the link.
   *
   * It waits for the server list rather than firing on the address alone,
   * and does nothing if that room is not in it: a link to a room that has
   * since closed should leave somebody on the page, not open an
   * application to be refused by it. Once per visit, hence the flag -
   * without it every reload of the list would hand over again.
   *
   * And as everywhere else: the room in the link is a hint.
   * `join_world_server` decides whether this account may be in it.
   */
  const handedOver = useRef(false)
  useEffect(() => {
    if (!sentTo || handedOver.current || !thing || !servers.data) return
    if (!servers.data.some((one) => one.id === sentTo)) return
    handedOver.current = true
    setHanding('opening')
    void play(thing.id, () => setHanding('missing'), sentTo)
  }, [sentTo, thing?.id, servers.data])

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
        <Skeleton className="aspect-[16/10] rounded-2xl sm:aspect-[2/1] lg:aspect-[21/8]" />
        <Skeleton className="mt-4 h-20 rounded-2xl" />
        <Skeleton className="mt-6 h-32 rounded-xl" />
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

  /*
   * Staw: "make that you can only rate worlds after youve visited them."
   *
   * `visited` comes from `world_visits`, which only `join_world_server`
   * writes - so this is a real record of having turned up, not something a
   * page can award itself. Greying the thumbs out here is a courtesy;
   * `set_world_opinion` refuses the vote either way (0327).
   *
   * Somebody who already rated a World keeps the ability to take it back,
   * for the same reason the function allows it: a vote you cannot remove
   * is worse than one you should not have been able to cast.
   */
  const canRate = Boolean(profile) && (standing.data?.visited || opinion !== null)
  const owner = thing.owner

  /* The emblem leads, because it is what a World chose to be known by. */
  const shots: Shot[] = [
    { id: 'emblem', kind: 'image' as const, url: thing.cover_url ?? DEFAULT_WORLD_THUMBNAIL },
    ...(media.data ?? []).map((one) => ({
      id: one.id,
      kind: one.kind,
      url: worldFileUrl(one.path),
    })),
  ]

  const genre = genres.data?.find((one) => one.id === thing.genre)

  /*
   * Friends in a server of this World at this moment.
   *
   * `friendsInServers` answers per room, and a person can only be in one
   * of them, but the rooms are read one at a time and a friend who moves
   * between two reads can land in both - so this is deduplicated by id
   * rather than flattened.
   */
  const byRoom = (mates.data ?? {}) as Record<string, PlayerThere[]>
  const friendsHere: PlayerThere[] = Object.values(byRoom)
    .flat()
    .filter((one, i, all) => all.findIndex((other) => other.id === one.id) === i)

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
     * A party follows its leader.
     *
     * Pressing play while you are leading one says where the party is
     * going, and the Launcher takes everybody there. It is said before the
     * hand-over rather than after, so the others are told while this
     * machine is still opening its own copy.
     *
     * If it fails there is nothing to tell anybody: this person still
     * goes, and a party that did not follow is better than a play button
     * that refused to work.
     */
    if (party?.leader_id === profile?.id) {
      void partyIsGoingTo(thing.id, room ?? null).catch(() => {})
    }
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


  /* Only the parts that have something in them, or that this person could
     put something into, take a heading. */
  const badgeCount = badges.data?.length ?? 0
  const passCount = passes.data?.length ?? 0

  /*
   * Staw: "put the badges & store stuff even if there no badges &
   * gamepasses yet." Both tabs are always there now, whoever is looking.
   * A World that hands out nothing and sells nothing says so inside the
   * tab, which is a different sentence from a World where that part of the
   * page does not exist - and the switcher stopped being the same shape
   * from one World to the next, which is what made it feel broken.
   */

  return (
    <>
      <Page>
        {/*
          * A World page built like a shop window.
          *
          * Staw, after seeing the proposal: ship it. So the stage is gone
          * from here - the art owns two thirds of the width and the panel
          * beside it owns the decision, which is the arrangement a person
          * arriving from Discover actually needs: what it is, whether
          * anybody is in it, and the way in, all in one eyeful.
          *
          * Everything in the panel is a number something real writes.
          * There is no "latest update" block, which the proposal drew:
          * nothing on this platform writes patch notes yet, and a block
          * that would always say the same thing is a drawing of a feature.
          */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-brand sm:h-14 sm:w-14">
              <Picture src={worldEmblem(thing)} alt={thing.name} className="h-full w-full" />
            </div>

            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black leading-tight sm:text-3xl">
                {thing.name}
              </h1>

              {owner ? (
                <Link
                  to={profileLink(owner)}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
                >
                  <PersonAvatar person={owner} size="xs" />
                  {/* The handle. Staw, round 350: a creation credits the
                      name that is actually theirs, not the label. */}
                  By <span className="font-bold text-white/80">@{owner.username}</span>
                  <NameMarks person={owner} />
                </Link>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  By <span className="font-bold text-white/80">
                    {thing.creator_username ? `@${thing.creator_username}` : (thing.creator_name ?? 'Kobblon')}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* What it is, in chips: the genre it was filed under and what it
              runs on. Both are set by whoever made it, so a World with
              neither simply has no chips rather than an empty rail. */}
          <div className="flex flex-wrap gap-1.5">
            {genre && <Chip>{genre.label}</Chip>}
            {(thing.devices ?? []).map((one) => (
              <Chip key={one}>{deviceLabels[one]}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <WorldGallery shots={shots} name={thing.name} />

          {/* The panel that does something: the rating, the way in, what it
              is, and the numbers - in the order somebody reads them. */}
          <WorldPanel
            description={thing.description}
            likes={counts.likes}
            dislikes={counts.dislikes}
            opinion={opinion}
            canRate={canRate}
            whyNotRate={!profile
              ? 'Sign in to rate this World.'
              : 'Play this World before rating it.'}
            onLike={like}
            onDislike={dislike}
            onPlay={() => start()}
            favourited={favourited}
            onFavourite={keep}
            notify={notify}
            onNotify={tell}
            signedIn={!!profile}
            mine={mine}
            editTo={`/create/worlds/${worldTag(thing.content_id) || thing.id}`}
            onWorkspace={() => { void editInWorkspace(thing.id, () => setHanding('missing')) }}
            onCopyLink={() => {
              void navigator.clipboard?.writeText(window.location.href)
              toast('Link copied.', 'success')
            }}
            onReport={() => setReporting(true)}
            playingNow={playing_now}
            visits={thing.visit_count}
            favourites={counts.favourites}
            updatedAt={thing.updated_at}
            publishedAt={thing.published_at}
            friendsHere={friendsHere}
          />
        </div>

        {/*
          * Faces, under the window.
          *
          * Staw: "worlds keep the dislikes & likes only, but klub users can
          * also click a third button to add reactions to worlds". The bar
          * is a rating and a rating has to be one number; a face says
          * something the number cannot, and it does not move the number.
          * The server refuses a non-member, so this only saves somebody a
          * round trip.
          */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <Reactions
            what="world"
            which={thing.id}
            counts={faces.data ?? []}
            canReact={!!profile && !profile.is_guest && inKlub}
            whyNot={!profile
              ? 'Sign in to react.'
              : 'Reacting to a World is a Klub Kobblon thing.'}
            onChanged={faces.reload}
          />

          {profile && !mine && (
            <button
              onClick={() => setReporting(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger/80 hover:text-danger"
            >
              <Glyph icon={faFlag} className="text-tiny" />
              Report Abuse
            </button>
          )}
        </div>

        {/*
          * About, Servers, Badges and Store, the way a profile holds About,
          * Creations and Shop.
          *
          * Staw: "for the world shop & badges, we still need to put them
          * somewhere, like a switcher (like we have for the players
          * profiles)". A World has four kinds of thing in it and only one of
          * them is what somebody came for; stacked down the page they made
          * everything under the first one feel like an appendix. A tab that
          * has nothing in it and that you could not fill is not drawn at all
          * rather than drawn empty.
          */}
        <Tabs
          look="line"
          className="mt-8"
          label="Who is in this World, and what it has"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Servers', label: 'Servers', count: servers.data?.length ?? null },
            { value: 'Badges', label: 'Badges', count: badgeCount },
            { value: 'Store', label: 'Store', count: passCount },
          ]}
        />

        <div className="mt-6 space-y-8">
          {tab === 'Servers' && (
            <ServersTab
              servers={servers.data ?? []}
              friends={mates.data ?? {}}
              name={thing.name}
              signedIn={!!profile}
              busy={servers.loading || mates.loading}
              onRefresh={() => { servers.reload(); mates.reload() }}
              onJoin={(server) => start(server.id)}
              highlight={sentTo}
              onShare={(server) => {
                const link = `${window.location.origin}${window.location.pathname}?server=${server.id}`
                void navigator.clipboard?.writeText(link)
                toast('Link to this server copied.', 'success')
              }}
            />
          )}

          {tab === 'Badges' && (
            <WorldThings
              kind="badges"
              badges={badges.data ?? []}
              mine={mine}
              worldId={thing.id}
              worldNumber={worldTag(thing.content_id)}
            />
          )}

          {tab === 'Store' && (
            <WorldThings
              kind="shop"
              passes={passes.data ?? []}
              mine={mine}
              worldId={thing.id}
              worldNumber={worldTag(thing.content_id)}
            />
          )}

          {/*
            * What people kept out of it.
            *
            * Under the switcher, because a clip taken in this World is
            * about the World rather than about About. It is the cheapest
            * advertising this platform has: somebody else's thirty seconds,
            * with the Play button underneath.
            */}
          <Band
            id="clips"
            icon={faFilm}
            title="Clips from this World"
            hide={!clips.data?.length}
          >
            <ClipShelf clips={clips.data ?? []} posterOf={clipPoster} />
          </Band>

          {/* Under the switcher rather than inside it: what else to play is
              true of the page, not of the tab somebody happens to be on. */}
          <Band
            id="also"
            icon={faUsers}
            title="People who play this also play"
            hide={!alsoPlayed.data?.length}
          >
            <AlsoJoinedRow worlds={alsoPlayed.data ?? []} bare />
          </Band>

          <AdBanner size="banner" quiet />

          {/* What to play next, at the end of the page where somebody who
              has read all of it is deciding. Nothing at all is not an empty
              state, so a quiet platform simply has no row here. */}
          <Band
            id="more"
            icon={faCompass}
            title="You might like"
            to="/discover"
            all="Discover"
            hide={!suggested.loading && !suggested.data?.length}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {suggested.loading
                ? Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-56 rounded-2xl" />
                ))
                : (suggested.data ?? []).slice(0, 8).map((one) => (
                  <WorldCard key={one.id} world={one} />
                ))}
            </div>
          </Band>
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

/** What a World is, in a word: its genre, and what it runs on. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border-2 border-ink-line bg-ink-card px-3 py-1 text-xs font-bold text-white/70">
      {children}
    </span>
  )
}
