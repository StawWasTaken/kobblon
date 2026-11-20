import { useState } from 'react'
import {
  faBell, faCirclePlay, faEllipsis, faPen, faStar, faThumbsDown, faThumbsUp,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { formatCount, playedFor, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * A World page built like a shop window.
 *
 * Staw's idea three: right now a World page is a picture and a Play button,
 * where a Steam page is a row of screenshots, what it is in one line, tags,
 * how many are in there now, what changed in the last update, and what
 * people say about it. We already hold nearly all of that - media, patch
 * notes, likes, visits, the live roster, badges, passes - arranged as tabs,
 * which is four filing cabinets rather than a window.
 *
 * This is the proposal, drawn so it can be looked at before it replaces
 * anything. Everything in it is a number this platform already writes,
 * except reviews, which do not exist yet and are the one new thing the idea
 * asks for.
 */
export type StoreReview = {
  id: string
  who: string
  avatar?: string | null
  liked: boolean
  seconds: number
  at: string
  body: string
}

export function WorldStorePage({
  name, creator, description, tags, shots, playing, visits, favourites,
  updated, updatedNote, friends, reviews, badges, passes, className,
}: {
  name: string
  creator: string
  description: string
  tags: string[]
  shots: string[]
  playing: number
  visits: number
  favourites: number
  updated: string
  updatedNote: string
  friends: { name: string; avatar?: string | null }[]
  reviews: StoreReview[]
  badges: { id: string; name: string; icon_url?: string | null; held?: boolean }[]
  passes: { id: string; name: string; price: number }[]
  className?: string
}) {
  const [shot, setShot] = useState(0)
  const liked = reviews.filter((one) => one.liked).length
  const share = reviews.length ? Math.round((liked / reviews.length) * 100) : 0

  return (
    <div className={cn('mx-auto w-full max-w-6xl px-4 py-8', className)}>
      {/* The name first and alone, because the window below is pictures. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            by <span className="font-bold text-white/80">@{creator}</span>
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
          <div className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
            <img
              src={shots[shot]}
              alt=""
              className="aspect-video w-full object-cover"
            />
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
          <p className="text-sm leading-relaxed text-white/75 line-clamp-4">{description}</p>

          <Button variant="yes" size="lg" icon={faCirclePlay} className="w-full">
            Play
          </Button>

          <div className="flex gap-2">
            <Button variant="subtle" icon={faStar} className="flex-1" aria-label="Favourite" />
            <Button variant="subtle" icon={faBell} className="flex-1" aria-label="Get told" />
            <Button variant="subtle" icon={faEllipsis} className="flex-1" aria-label="More" />
          </div>

          <dl className="mt-1 space-y-1.5 border-t-2 border-ink-line pt-3 text-sm">
            <Row label="Playing now" value={formatCount(playing)} live={playing > 0} />
            <Row label="Visits" value={formatCount(visits)} />
            <Row label="Saved" value={formatCount(favourites)} />
            <Row label="Updated" value={timeAgo(updated)} />
          </dl>

          {!!friends.length && (
            <div className="border-t-2 border-ink-line pt-3">
              <p className="text-tiny font-extrabold uppercase tracking-wide text-muted">
                Friends who play
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

      {/* -------------------------------------------------- what it holds */}
      {(!!badges.length || !!passes.length) && (
        <section className="mt-8 grid gap-5 sm:grid-cols-2">
          {!!badges.length && (
            <div>
              <h2 className="font-display text-xl font-extrabold">Badges</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {badges.map((one) => (
                  <span
                    key={one.id}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border-2 border-ink-line bg-ink-card px-3 py-2 text-sm font-bold',
                      !one.held && 'opacity-60',
                    )}
                  >
                    <span className={cn(
                      'grid h-7 w-7 place-items-center rounded-full',
                      one.held ? 'bg-brand text-on-art' : 'bg-ink-hover text-white/35',
                    )}>
                      <Glyph icon={faStar} className="text-tiny" />
                    </span>
                    {one.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!!passes.length && (
            <div>
              <h2 className="font-display text-xl font-extrabold">Store</h2>
              <div className="mt-3 space-y-2">
                {passes.map((one) => (
                  <div
                    key={one.id}
                    className="flex items-center gap-3 rounded-xl border-2 border-ink-line bg-ink-card px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{one.name}</span>
                    <Button size="sm" variant="brand">{formatCount(one.price)} Brix</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------- reviews */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold">What people say</h2>
          <Button size="sm" variant="subtle" icon={faPen}>Write a review</Button>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4">
          <span className="font-display text-3xl font-extrabold tabular-nums text-yes-bright">
            {share}%
          </span>
          <p className="text-sm text-white/70">
            of {formatCount(reviews.length)} reviews are positive
          </p>
        </div>

        <ul className="mt-3 space-y-3">
          {reviews.map((one) => (
            <li
              key={one.id}
              className="rounded-2xl border-2 border-ink-line bg-ink-card p-4"
            >
              <div className="flex items-center gap-2.5">
                <Avatar src={one.avatar ?? undefined} name={one.who} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{one.who}</p>
                  <p className="text-xs text-muted">
                    {playedFor(one.seconds)} played · {timeAgo(one.at)}
                  </p>
                </div>
                <span className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                  one.liked ? 'bg-yes/20 text-yes-bright' : 'bg-danger/15 text-danger',
                )}>
                  <Glyph icon={one.liked ? faThumbsUp : faThumbsDown} className="text-sm" />
                </span>
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                {one.body}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Row({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-white/55">{label}</dt>
      <dd className={cn(
        'font-extrabold tabular-nums',
        live ? 'text-yes-bright' : 'text-white/85',
      )}>
        {value}
      </dd>
    </div>
  )
}
