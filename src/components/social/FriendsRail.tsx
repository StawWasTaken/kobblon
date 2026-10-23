import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Skeleton } from '@/components/ui/States'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { peopleList } from '@/lib/api'
import { profileLink } from '@/lib/links'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { FriendPeek } from '@/components/social/FriendPeek'

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
    <section className="mb-10 sm:mb-12">
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
            <Glyph icon={faArrowRight} className="text-[10px]" />
          </Link>
        )}
      </div>

      {/*
        * A grid that wraps and stops, not a track that slides.
        *
        * The gap is wide on purpose - Staw, looking at it beside the row he
        * drew it from: "fix the spacing cuz its too small". Faces this size
        * with four pixels of air between them read as one strip rather than
        * as people, and the names underneath run into each other.
        */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-7 sm:grid-cols-6 sm:gap-x-8 lg:grid-cols-9">
        <Link
          to="/friends"
          className="group flex flex-col items-center gap-2.5 text-center"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full border border-ink-line bg-ink-card text-2xl text-white/50 transition-colors group-hover:bg-ink-hover group-hover:text-white">
            {/* Staw's own, by its name: this is the one that means
                wanting to add somebody. A bare plus says "another of
                these" and this is not another of these. */}
            <Glyph icon={faPlus} name="add-user" />
          </span>
          <span className="truncate text-xs font-semibold text-white/70">Add Friends</span>
        </Link>

        {loading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2.5">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}

        {friends.slice(0, SHOWN).map((friend) => (
          <FriendPeek key={friend.id} friend={friend}>
            <Link
              to={profileLink(friend)}
              className="flex flex-col items-center gap-2.5 text-center"
            >
              <PersonAvatar person={friend} size="2xl" className="mx-auto h-20 w-20" />
              <span className="w-full truncate text-sm font-semibold text-white/80">
                {friend.display_name}
              </span>
            </Link>
          </FriendPeek>
        ))}
      </div>
    </section>
  )
}
