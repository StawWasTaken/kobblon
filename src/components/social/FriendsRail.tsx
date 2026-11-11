import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Skeleton } from '@/components/ui/States'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { peopleList } from '@/lib/api'
import { PersonFace } from '@/components/social/PersonCard'
import { presenceNow, usePresenceVersion, useWhereabouts } from '@/hooks/usePresenceStore'

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
  usePresenceVersion()
  const { profile } = useAuth()
  const { data, loading } = useAsync(
    async () => (profile ? peopleList(profile.id, 'friends') : []),
    [profile?.id],
  )

  /* Where they are, asked once for the rail, so a friend in a World sorts
     to the front of it and the dot on their face says so. */
  useWhereabouts(data ?? [])

  /*
   * Best friends first, then whoever is here, asked the same way the dot on
   * each face is asked. The heart on a face is the reason a list reorders
   * itself, and a list that reorders itself without saying why is a list
   * somebody thinks is broken.
   */
  const friends = (data ?? [])
    .slice()
    .sort((a, b) =>
      Number(Boolean(b.best)) - Number(Boolean(a.best))
      || Number(presenceNow(b) !== 'offline') - Number(presenceNow(a) !== 'offline'))

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
        *
        * Four across on a phone rather than three, and smaller faces there.
        * okayCooki3, with six friends: "if i had alot of friends i would
        * have to keep on scrolling down and it will make it very hard to
        * scroll down to the end." Three columns of eighty-pixel faces put
        * nine cells into three tall rows before the rest of the home page
        * started; four columns of sixty-four put eight into two.
        *
        * Eight, because the ninth cell is hidden on a phone - the row holds
        * Add Friends plus eight faces, which is one clean row at the widest
        * and would have been two and a stray at the narrowest. "See all" is
        * right there, and this row was never the list.
        *
        * On a phone it is Add Friends and two faces, one row of three and
        * nothing under it. okayCooki3, who filed this twice: "i think
        * instead of it being more crammed together there should just be 2
        * of the person's friends (on mobile) shown then when they click see
        * all they can see all their friends". Four columns of eight faces
        * was two rows of small circles with the names touching - the fix
        * last time was to cram less, and he is right that the answer was
        * fewer rather than tighter. The phone cells are wider for it, so
        * the faces are bigger than they were at four across.
        *
        * Held back with `hidden` rather than a shorter slice, so the same
        * markup serves both widths: turning the phone and back is a
        * repaint, not a refetch.
        */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-6 max-sm:[&>:nth-child(n+4)]:hidden sm:grid-cols-6 sm:gap-x-8 sm:gap-y-7 lg:grid-cols-9">
        {/*
          * Add Friends is one of the cells, so it is built like one.
          *
          * Staw: 'the "add friends" isnt lined up'. It was: this drew its
          * own stack - a bare circle with a small label under it - while
          * every face beside it is a `PersonFace`, which pads itself by two
          * and writes a bold name with a quiet line under that. Same row,
          * two different boxes, so the circle sat lower than the faces and
          * the label sat higher than the names.
          *
          * It now carries the face's padding, the face's avatar size and
          * the face's two lines, so the circles share a top edge and the
          * words share a baseline. The second line is what the plus is
          * for rather than filler: a row with nothing under the label
          * would put this cell's words back on their own height.
          */}
        <Link
          to="/friends"
          className="group block rounded-xl p-2 text-center transition-colors hover:bg-ink-hover"
        >
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-ink-line bg-ink-card text-xl text-white/50 transition-colors group-hover:border-brand-bright/60 group-hover:bg-ink-hover group-hover:text-white sm:h-20 sm:w-20 sm:text-2xl">
            {/* Staw's own, by its name: this is the one that means
                wanting to add somebody. A bare plus says "another of
                these" and this is not another of these. */}
            <Glyph icon={faPlus} name="add-user" />
          </span>
          <p className="mt-2 truncate text-sm font-bold">Add Friends</p>
          <p className="truncate text-[11px] text-muted">Find somebody</p>
        </Link>

        {loading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="p-2 text-center">
              <Skeleton className="mx-auto h-16 w-16 rounded-full sm:h-20 sm:w-20" />
              <Skeleton className="mx-auto mt-2 h-4 w-16" />
              <Skeleton className="mx-auto mt-1 h-3 w-12" />
            </div>
          ))}

        {/*
          * The same face as everywhere else, at the home page's size.
          *
          * This row drew its own: a picture and a name and nothing else, so
          * a verified account read as unverified here and verified one
          * press later, a best friend sorted to the front with nothing
          * saying why, and the World somebody was in - which this row asks
          * the roster for already - was never printed. One owner for the
          * person, which is what `PersonFace` is for.
          */}
        {friends.slice(0, SHOWN).map((friend) => (
          <PersonFace key={friend.id} person={friend} big />
        ))}
      </div>
    </section>
  )
}
