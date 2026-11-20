import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faBell, faBookmark, faChevronLeft, faChevronRight, faClockRotateLeft, faEllipsis,
  faEye, faPlay, faStar,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { NameMarks } from '@/components/brand/Verified'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { RatingBar } from '@/components/worlds/RatingBar'
import { ServersTab } from '@/components/worlds/ServersTab'
import { WorldThings } from '@/components/worlds/WorldThings'
import type { PlayerThere, RunningServer, WorldBadge, WorldPass } from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * A World page built like a shop window.
 *
 * Staw's idea three: right now a World page is a picture and a Play button,
 * where a Steam page is a row of screenshots, what it is in one line, tags,
 * how many are in there now, what changed in the last update, and what the
 * World holds. We already write every number in here.
 *
 * Second pass, to Staw's notes on the first:
 *
 * - **No reviews.** The like and dislike this platform already has stays,
 *   as `RatingBar`, which is the same component the World page uses now.
 *   Reviews were the one thing in the first draft with no table behind it
 *   and he does not want them.
 * - **The description moved under the buttons**, because the buttons are
 *   what somebody came for and the paragraph is what they read if the
 *   buttons did not already decide it.
 * - **Our icons**, through `Glyph`, which swaps in Staw's drawings for the
 *   star, the bell, the thumbs and Brix. The Play triangle stays Font
 *   Awesome's on purpose: `playing` is a person beside a triangle - it is
 *   the "in a World right now" mark - and putting a little person inside a
 *   Play button says the wrong thing.
 * - **The Servers / Badges / Store switch stays**, under the window, the
 *   same `Tabs` the World page has today.
 * - **Arrows on the gallery**, either side of the big picture.
 *
 * Still a proposal: nothing routes here. `tools/site/worldstore-preview`
 * mounts it.
 */
export function WorldStorePage({
  name, creator, creatorId, description, tags, shots, playing, visits, favourites,
  updated, updatedNote, friends, likes, dislikes, badges, passes, servers, inServers,
  worldId, mine, className,
}: {
  name: string
  creator: string
  /** Who to ask about for the marks after the handle, where one is in hand. */
  creatorId?: string | null
  description: string
  tags: string[]
  shots: string[]
  playing: number
  visits: number
  favourites: number
  updated: string
  updatedNote: string
  /** Friends **in there right now**, not friends who have ever played it. */
  friends: { name: string; avatar?: string | null }[]
  likes: number
  dislikes: number
  badges: WorldBadge[]
  passes: WorldPass[]
  servers: RunningServer[]
  /** Which friends are in which room, by server id - what `ServersTab` wants. */
  inServers: Record<string, PlayerThere[]>
  worldId: string
  /** Whether this World is yours, which is what puts the make buttons in. */
  mine: boolean
  className?: string
}) {
  const [shot, setShot] = useState(0)
  const [tab, setTab] = useState<'Servers' | 'Badges' | 'Store'>('Servers')
  const [iLike, setILike] = useState<boolean | null>(null)

  const step = (by: number) => setShot((was) => (was + by + shots.length) % shots.length)

  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 py-8', className)}>
      {/* The name first and alone, because the window below is pictures. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{name}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
            by
            <Link to={`/@${creator}`} className="inline-flex items-center gap-1.5 hover:text-white">
              <span className="font-bold text-white/80">@{creator}</span>
              {/* The marks come from the database, so in the bare preview
                  there is nobody to ask and nothing is drawn. */}
              <NameMarks id={creatorId ?? undefined} username={creator} />
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((one) => (
            <span
              key={one}
              className="rounded-full border-2 border-ink-line bg-ink-card px-3 py-1 text-xs font-bold text-white/70"
            >
              {one}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------- the window */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="group relative overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
            <img src={shots[shot]} alt="" className="aspect-video w-full object-cover" />

            {shots.length > 1 && (
              <>
                <Arrow side="left" onClick={() => step(-1)} />
                <Arrow side="right" onClick={() => step(1)} />
                <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 text-mini font-bold text-white/85 backdrop-blur-sm">
                  {shot + 1} / {shots.length}
                </span>
              </>
            )}
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto kob-scroll">
            {shots.map((one, i) => (
              <button
                key={one + i}
                onClick={() => setShot(i)}
                aria-label={`Picture ${i + 1}`}
                className={cn(
                  'h-14 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                  i === shot ? 'border-brand' : 'border-ink-line hover:border-brand/50',
                )}
              >
                <img src={one} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* The panel that does something. Steam puts the buy box here and
            it is the right place: everything you came to press, in one
            column, at eye level. */}
        <aside className="flex min-w-0 flex-col gap-3 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4">
          <RatingBar
            likes={likes + (iLike === true ? 1 : 0)}
            dislikes={dislikes + (iLike === false ? 1 : 0)}
            iLike={iLike === true}
            iDislike={iLike === false}
            onLike={() => setILike((was) => (was === true ? null : true))}
            onDislike={() => setILike((was) => (was === false ? null : false))}
          />

          {/* Play is the width Staw sent, not the width of the column: a
              button that fills its box reads as a banner. The three beside
              it are the same height, so the row is one block. */}
          <div className="flex items-stretch gap-2">
            <Button variant="yes" size="lg" icon={faPlay} className="w-40 shrink-0">
              Play
            </Button>
            <Side label="Save this World" icon={faStar} />
            <Side label="Get told when it changes" icon={faBell} />
            <Side label="More" icon={faEllipsis} />
          </div>

          <p className="text-sm leading-relaxed text-white/75">{description}</p>

          {/*
            * The four numbers, each with the mark that means it elsewhere
            * on this platform: Staw's `playing` for people in there now,
            * the Library's bookmark for saves, an eye for visits and a
            * turned-back clock for the last update.
            */}
          <dl className="space-y-2 border-t-2 border-ink-line pt-3 text-sm">
            <Row mark={<Icon name="playing" className="h-4 w-4" />} label="Playing now" value={formatCount(playing)} live={playing > 0} />
            <Row mark={<Glyph icon={faEye} />} label="Visits" value={formatCount(visits)} />
            <Row mark={<Glyph icon={faBookmark} />} label="Saved" value={formatCount(favourites)} />
            <Row mark={<Glyph icon={faClockRotateLeft} />} label="Updated" value={timeAgo(updated)} />
          </dl>

          {!!friends.length && (
            <div className="border-t-2 border-ink-line pt-3">
              {/* Named for what it actually is: the friends who are in a
                  server of this World at this moment, which is the thing
                  worth interrupting somebody for. */}
              <p className="text-tiny font-extrabold uppercase tracking-wide text-muted">
                Friends in there now
              </p>
              <div className="mt-2 flex -space-x-2">
                {friends.slice(0, 6).map((one) => (
                  <Avatar key={one.name} src={one.avatar ?? undefined} name={one.name} size="sm" />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* --------------------------------------------- what just changed */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-extrabold">Latest update</h2>
        <div className="mt-3 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4">
          <p className="text-xs font-bold text-muted">{timeAgo(updated)}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
            {updatedNote}
          </p>
        </div>
      </section>

      {/* ------------------------------------- the switch, kept as it is */}
      <Tabs
        look="line"
        className="mt-8"
        label="Who is in it, and what it has"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'Servers', label: 'Servers', count: servers.length },
          { value: 'Badges', label: 'Badges', count: badges.length },
          { value: 'Store', label: 'Store', count: passes.length },
        ]}
      />

      {/* The three panels are the ones the World page already draws -
          `ServersTab` and `WorldThings` - because Staw wants their design
          kept. Nothing here is a second version of them. */}
      <div className="mt-5">
        {tab === 'Servers' && (
          <ServersTab
            servers={servers}
            friends={inServers}
            name={name}
            signedIn
            onRefresh={() => {}}
          />
        )}

        {tab === 'Badges' && (
          <WorldThings kind="badges" badges={badges} mine={mine} worldId={worldId} />
        )}

        {tab === 'Store' && (
          <WorldThings kind="shop" passes={passes} mine={mine} worldId={worldId} />
        )}
      </div>
    </div>
  )
}

function Arrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous picture' : 'Next picture'}
      className={cn(
        'absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full',
        'border-2 border-white/20 bg-black/55 text-white/85 backdrop-blur-sm transition-colors',
        'hover:bg-black/80 hover:text-white',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <Glyph icon={side === 'left' ? faChevronLeft : faChevronRight} />
    </button>
  )
}

function Side({ label, icon }: { label: string; icon: typeof faStar }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid flex-1 place-items-center rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised text-white/75 transition-colors hover:border-brand/60 hover:text-white"
    >
      <Glyph icon={icon} on={false} />
    </button>
  )
}

function Row({ mark, label, value, live }: {
  mark: React.ReactNode
  label: string
  value: string
  live?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-white/55">
        <span className={cn('grid h-5 w-5 shrink-0 place-items-center', live ? 'text-space' : 'text-white/45')}>
          {mark}
        </span>
        {label}
      </dt>
      <dd className={cn(
        'font-extrabold tabular-nums',
        live ? 'text-space' : 'text-white/85',
      )}>
        {value}
      </dd>
    </div>
  )
}
