import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import {
  faBell, faBookmark, faClockRotateLeft, faCube, faEllipsis, faEye, faFlag,
  faFlagCheckered, faLink, faPlay, faSliders, faStar,
} from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { Tooltip } from '@/components/ui/Tooltip'
import { RatingBar } from '@/components/worlds/RatingBar'
import type { PlayerThere } from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The panel beside a World's pictures: everything you came to press, and
 * the numbers that decide it for you.
 *
 * Its own component rather than markup inside the page for the reason the
 * project keeps relearning - a page that fetches cannot be looked at
 * without a database behind it, and this is the part of the World page
 * worth looking at. `tools/site/worldpanel-preview` mounts it with nothing
 * around it.
 *
 * It holds no state and asks nothing: every number and every handler is
 * handed to it, so the page stays the one place that knows how a World is
 * read and written.
 */
export function WorldPanel({
  description, likes, dislikes, opinion, canRate, whyNotRate,
  onLike, onDislike, onPlay, favourited, onFavourite, notify, onNotify,
  signedIn, mine, editTo, onWorkspace, onCopyLink, onReport,
  playingNow, visits, favourites, updatedAt, publishedAt, friendsHere,
}: {
  description: string | null | undefined
  likes: number
  dislikes: number
  opinion: boolean | null
  canRate: boolean
  whyNotRate?: string
  onLike: () => void
  onDislike: () => void
  onPlay: () => void
  favourited: boolean
  onFavourite: () => void
  notify: boolean
  onNotify: () => void
  signedIn: boolean
  mine: boolean
  /** Where the owner edits this World's page. */
  editTo: string
  onWorkspace: () => void
  onCopyLink: () => void
  onReport: () => void
  playingNow: number
  visits: number
  favourites: number
  updatedAt: string | null | undefined
  publishedAt: string | null | undefined
  friendsHere: PlayerThere[]
}) {
  return (
      <aside className="flex min-w-0 flex-col gap-3 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4">
        <RatingBar
          likes={likes}
          dislikes={dislikes}
          iLike={opinion === true}
          iDislike={opinion === false}
          disabled={!canRate}
          why={whyNotRate}
          onLike={onLike}
          onDislike={onDislike}
        />

        {/* Play is the width Staw sent, not the width of the column:
            a button that fills its box reads as a banner. The three
            beside it are the same height, so the row is one block. */}
        <div className="flex items-stretch gap-2">
          <Button
            size="lg"
            variant="enter"
            onClick={onPlay}
            className="w-40 shrink-0"
          >
            <Glyph icon={faPlay} />
            <span className="font-display text-lg font-extrabold">Play</span>
          </Button>

          <Tooltip
            label={signedIn ? (favourited ? 'Saved' : 'Save this World') : 'Sign in to save it'}
            side="top"
          >
            <button
              onClick={onFavourite}
              disabled={!signedIn}
              aria-pressed={favourited}
              aria-label="Save this World"
              className={cn(
                'grid flex-1 place-items-center rounded-xl border-2 border-b-4 border-ink-line',
                'bg-ink-raised transition-colors disabled:opacity-40',
                favourited ? 'text-gem-bright' : 'text-white/70 hover:border-brand/60 hover:text-white',
              )}
            >
              <Glyph icon={faStar} on={favourited} />
            </button>
          </Tooltip>

          <Tooltip
            label={signedIn
              ? (notify
                ? 'You will be told when this World changes'
                : 'Get told when this World changes')
              : 'Sign in to be told'}
            side="top"
          >
            <button
              onClick={onNotify}
              disabled={!signedIn}
              aria-pressed={notify}
              aria-label="Get told when this World changes"
              className={cn(
                'grid flex-1 place-items-center rounded-xl border-2 border-b-4 border-ink-line',
                'bg-ink-raised transition-colors disabled:opacity-40',
                notify ? 'text-link' : 'text-white/70 hover:border-brand/60 hover:text-white',
              )}
            >
              <Glyph icon={faBell} />
            </button>
          </Tooltip>

          <Menu
            label="More"
            align="right"
            className="flex flex-1 [&>button]:h-full [&>button]:w-full"
            trigger={
              <span className="grid h-full w-full place-items-center rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised text-white/70 transition-colors hover:border-brand/60 hover:text-white">
                <Glyph icon={faEllipsis} />
              </span>
            }
            items={[
              {
                label: 'Copy link',
                icon: faLink,
                onSelect: onCopyLink,
              },
              ...(mine ? [
                { label: 'Edit the page', icon: faSliders, to: editTo },
                {
                  label: 'Open in Workspace',
                  icon: faCube,
                  onSelect: onWorkspace,
                },
              ] : []),
              { label: 'Report abuse', icon: faFlag, danger: true, onSelect: onReport },
            ]}
          />
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
          {description || 'Whoever built this has not described it yet.'}
        </p>

        {/* The numbers, each with the mark that means it elsewhere on
            this platform: Staw's `playing` for people in there now, the
            Library's bookmark for saves, an eye for visits, a clock
            turned back for the last update. */}
        <dl className="space-y-2 border-t-2 border-ink-line pt-3 text-sm">
          <Fact
            mark={<Icon name="playing" className="h-4 w-4" />}
            label="Playing now"
            value={formatCount(playingNow)}
            live={playingNow > 0}
          />
          <Fact mark={<Glyph icon={faEye} />} label="Visits" value={formatCount(visits)} />
          <Fact mark={<Glyph icon={faBookmark} />} label="Saved" value={formatCount(favourites)} />
          <Fact
            mark={<Glyph icon={faClockRotateLeft} />}
            label="Updated"
            value={updatedAt ? timeAgo(updatedAt) : 'Never'}
          />
          <Fact
            mark={<Glyph icon={faFlagCheckered} />}
            label="Published"
            value={publishedAt ? timeAgo(publishedAt) : 'Not yet'}
          />
        </dl>

        {/* Friends in a server of this World at this moment - not
            friends who have ever played it. The two are different
            numbers and only this one is worth interrupting somebody
            for. */}
        {!!friendsHere.length && (
          <div className="border-t-2 border-ink-line pt-3">
            <p className="text-tiny font-extrabold uppercase tracking-wide text-muted">
              Friends in there now
            </p>
            <div className="mt-2 flex -space-x-2">
              {friendsHere.slice(0, 6).map((one) => (
                <Avatar
                  key={one.id}
                  size="sm"
                  personId={one.id}
                  src={one.avatar_url}
                  changedAt={one.avatar_changed_at}
                  name={one.display_name ?? one.username}
                />
              ))}
              {friendsHere.length > 6 && (
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink-line bg-ink-raised text-mini font-bold">
                  +{friendsHere.length - 6}
                </span>
              )}
            </div>
          </div>
        )}
      </aside>
  )
}

/** One number in the panel, with the mark that means it everywhere else. */
function Fact({ mark, label, value, live }: {
  mark: React.ReactNode
  label: string
  value: string
  live?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-white/55">
        <span className={cn(
          'grid h-5 w-5 shrink-0 place-items-center',
          live ? 'text-space' : 'text-white/45',
        )}>
          {mark}
        </span>
        {label}
      </dt>
      <dd className={cn('font-extrabold tabular-nums', live ? 'text-space' : 'text-white/85')}>
        {value}
      </dd>
    </div>
  )
}
