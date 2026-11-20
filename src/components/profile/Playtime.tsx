import { Link } from 'react-router-dom'
import { faAward, faClock } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Skeleton } from '@/components/ui/States'
import { formatCount, playedFor } from '@/lib/format'
import { worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import type { Playtime } from '@/lib/api'

/*
 * Hours, and a score.
 *
 * Steam's hook is the hours and Xbox's is the number; a profile with
 * neither is a page you look at once. This is both, in one block: what
 * somebody has put into this platform, and what they have to show for it.
 *
 * It knows nothing about where the numbers came from, so it mounts on its
 * own under `tools/site` - the rule this project has broken three times is
 * a shared piece that wants a provider the application cannot give it.
 */
export function Playtime({ worlds, total, score, loading, className }: {
  worlds: Playtime[]
  /** Seconds, everything included - Worlds that are no longer published too. */
  total: number
  /** Ten a badge. */
  score: number
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-[4.5rem] rounded-2xl" />
          <Skeleton className="h-[4.5rem] rounded-2xl" />
        </div>
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    )
  }

  /* The longest one sets the bar, so the shape of the list says at a glance
     where the time actually went. */
  const most = worlds.reduce((high, one) => Math.max(high, one.seconds), 0)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-3">
        <Tile icon={faClock} label="Played" value={playedFor(total)} />
        <Tile icon={faAward} label="Score" value={formatCount(score)} />
      </div>

      {!!worlds.length && (
        <ul className="space-y-1.5">
          {worlds.map((one) => (
            <li key={one.world_id}>
              <Link
                to={worldLink({
                  content_id: one.content_id ?? 0,
                  slug: one.slug,
                  name: one.name,
                })}
                className="group relative flex items-center gap-3 overflow-hidden rounded-xl border-2 border-ink-line bg-ink-card px-3 py-2 transition-colors hover:border-brand/60"
              >
                {/* How far along the row the time goes. Behind the words,
                    quiet enough to read through, and never the whole row:
                    a bar that fills its track reads as a row somebody
                    selected rather than as the longest one. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-brand/10 transition-[width]"
                  style={{ width: `${most ? Math.max(6, (one.seconds / most) * 92) : 0}%` }}
                />
                {one.cover_url ? (
                  <img
                    src={one.cover_url}
                    alt=""
                    loading="lazy"
                    className="relative h-8 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="relative h-8 w-12 shrink-0 rounded-md bg-ink-raised" />
                )}
                <span className="relative min-w-0 flex-1 truncate text-sm font-bold">
                  {one.name}
                </span>
                <span className="relative shrink-0 text-sm font-extrabold tabular-nums text-white/70">
                  {playedFor(one.seconds)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Tile({ icon, label, value }: {
  icon: typeof faClock
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-tiny font-extrabold uppercase tracking-wide text-muted">
        <Glyph icon={icon} className="text-tiny" />
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-extrabold tabular-nums sm:text-2xl">
        {value}
      </p>
    </div>
  )
}
