import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Skeleton } from '@/components/ui/States'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { peopleList } from '@/lib/api'
import { profileLink } from '@/lib/links'
import { PersonAvatar } from '@/components/ui/PersonAvatar'

/**
 * How many faces a row shows before it says "See all".
 *
 * Staw: "you shouldnt have to scroll left or right to see all of your
 * friends ... but just have a limit max that we can display with a view all".
 * Which is right - a sideways scroller hides people behind a gesture nobody
 * makes, and the row that does this well shows a screenful and a way out.
 */
const SHOWN = 8

/** Friends across the top of the home page, online ones first. */
export function FriendsRail() {
  const { profile } = useAuth()
  const { data, loading } = useAsync(
    async () => (profile ? peopleList(profile.id, 'friends') : []),
    [profile?.id],
  )

  const friends = (data ?? [])
    .slice()
    .sort((a, b) => Number(b.is_online) - Number(a.is_online))

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">
          Friends {!loading && <span className="text-white/40">({friends.length})</span>}
        </h2>
        {!!friends.length && (
          <Link
            to="/friends"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-link hover:underline"
          >
            See all
            <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
          </Link>
        )}
      </div>

      {/* A grid that wraps and stops, not a track that slides. */}
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-9">
        <Link
          to="/friends"
          className="group flex flex-col items-center gap-2 text-center"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full border border-ink-line bg-ink-card text-2xl text-white/50 transition-colors group-hover:bg-ink-hover group-hover:text-white">
            <FontAwesomeIcon icon={faPlus} />
          </span>
          <span className="truncate text-xs font-semibold text-white/70">Add Friends</span>
        </Link>

        {loading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}

        {friends.slice(0, SHOWN).map((friend) => (
          <Link
            key={friend.id}
            to={profileLink(friend)}
            className="flex flex-col items-center gap-2 text-center"
          >
            <PersonAvatar person={friend} size="2xl" className="mx-auto h-20 w-20" />
            <span className="w-full truncate text-sm font-semibold text-white/80">
              {friend.display_name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
