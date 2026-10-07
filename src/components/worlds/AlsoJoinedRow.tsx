import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faThumbsUp, faUser } from '@fortawesome/free-solid-svg-icons'
import { worldLink } from '@/lib/links'
import { formatCount } from '@/lib/format'
import type { AlsoJoined } from '@/lib/api'

/**
 * Worlds the people who played this one also played.
 *
 * Drawn with each World's **emblem** rather than its wide cover, because
 * Staw asked for that and because the alternative is a landscape picture
 * squeezed into a square, which is a landscape picture with its ends cut
 * off. A World with no emblem falls back to its cover rather than showing
 * nothing - plain is fine, missing is not.
 *
 * The row draws nothing at all when there is nothing to recommend. This is
 * built from what people actually did, so a quiet World has no answer, and
 * an empty shelf of placeholders would be a worse answer than none.
 */
export function AlsoJoinedRow({ worlds }: { worlds: AlsoJoined[] }) {
  if (!worlds.length) return null

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-ink-strong">People also join</h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {worlds.map((world) => {
          const up = world.like_count ?? 0
          const down = world.dislike_count ?? 0
          const score = up + down ? Math.round((up / (up + down)) * 100) : null
          const picture = world.emblem_url ?? world.cover_url

          return (
            <Link
              key={world.id}
              to={worldLink(world)}
              className="group min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="aspect-square overflow-hidden rounded-2xl border border-ink-line bg-ink-sunken transition-colors group-hover:border-brand/70">
                {picture ? (
                  <img
                    src={picture}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-black text-ink-soft">
                    {world.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <p className="mt-2 truncate text-sm font-semibold text-ink-strong">{world.name}</p>

              <div className="mt-1 flex items-center gap-3 text-xs text-ink-soft">
                {score !== null && (
                  <span className="inline-flex items-center gap-1">
                    <FontAwesomeIcon icon={faThumbsUp} />
                    {score}%
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faUser} />
                  {formatCount(world.playing ?? 0)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
