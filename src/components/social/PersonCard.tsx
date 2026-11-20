import { Link } from 'react-router-dom'
import { faHeart, faPlay, faHammer } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { NameMarks } from '@/components/brand/Verified'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { StatusDot, presenceWords } from '@/components/ui/StatusDot'
import { Tooltip } from '@/components/ui/Tooltip'
import { useLivePresence, useWhereabout } from '@/hooks/usePresenceStore'
import { FriendPeek } from '@/components/social/FriendPeek'
import { ThoughtLine, ThoughtOver, faceOf } from '@/components/profile/Thought'
import { useThought } from '@/hooks/useThoughtStore'
import { nameOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * One person, drawn one way, everywhere people are listed.
 *
 * There were three of these: a card on the friends page, a near-identical
 * card on People with a square picture and a bio, and a grid of faces on a
 * profile with no marks and no dot on it at all. So somebody's friends read
 * as three different kinds of thing depending on which door you came
 * through, and the profile's "See all" led to a page that looked nothing
 * like the row it came from.
 *
 * Staw, on the friends page before this: "it sucks". What made it so is the
 * same thing that made the three disagree - nobody owned the person. This
 * file owns the person: the face, the name with whatever it wears, and the
 * line that says where they are. A page adds what only it knows, which is
 * the buttons and the reason the person is in its list.
 */
export type Somebody = {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  avatar_changed_at?: string | null
  content_id?: number | null
  bio?: string | null
  /** The line over their head. Drawn without its bubble in a list. */
  thought?: string | null
  /** The face beside it, one of the eleven. */
  thought_face?: string | null
  /** A best friend, who is first in the list and says so. */
  best?: boolean
  /** Still a friend, kept quiet. */
  i_ignore?: boolean
  is_online?: boolean
  in_space_id?: string | null
  activity?: string | null
  last_seen_at?: string | null
  closed_at?: string | null
  is_banned?: boolean | null
  is_verified?: boolean | null
  is_admin?: boolean | null
  is_moderator?: boolean | null
  is_superadmin?: boolean | null
  has_staff_badge?: boolean | null
}

/**
 * The name, with the heart that says why they are at the top and whatever
 * marks their account wears. A link, always, because a name you cannot press
 * teaches people not to press names.
 */
export function PersonName({ person, className, size = 'base' }: {
  person: Somebody
  className?: string
  size?: 'sm' | 'base'
}) {
  return (
    <Link to={profileLink(person)} className={cn('flex items-center gap-1.5 hover:text-link', className)}>
      {/* A list that silently reorders itself is a list somebody thinks is
          broken, so the reason is on the row. */}
      {person.best && (
        <Tooltip label="Best friends" side="top">
          <Glyph icon={faHeart} className="shrink-0 text-mini text-brand-bright" />
        </Tooltip>
      )}
      <span
        className={cn(
          'truncate font-display font-extrabold leading-tight',
          size === 'sm' ? 'text-sm' : 'text-base',
        )}
      >
        {nameOf(person)}
      </span>
      <NameMarks person={person} className="text-mini" />
    </Link>
  )
}

/**
 * Where somebody is, in one line: what they are doing if they are here, when
 * they last were if they are not.
 *
 * It asks presence at the moment of drawing rather than reading the flag the
 * row arrived with - `is_online` on a row goes stale the moment the page
 * stops fetching, which is how a heading saying "Around now" ended up over
 * three people each labelled Offline.
 */
export function PersonLine({ person, note, className }: {
  person: Somebody
  /** What this list knows that presence does not: when they asked, when they were blocked. */
  note?: string
  className?: string
}) {
  const presence = useLivePresence(person)
  const here = presence !== 'offline'
  /*
   * The World by name, when somebody on the screen has asked the roster
   * where these people are. "In a World" tells you nothing you can act on
   * and the name does, so the name wins whenever there is one.
   */
  const where = useWhereabout(person.id)

  /*
   * What they are thinking stands where the word Online would be, which is
   * what a status is and where Discord puts one. Two things it never
   * covers: the note this list came with, and the World they are in - a
   * name you can act on beats a line somebody wrote this morning.
   */
  const mind = useThought(person.id)
  /* Nothing is shown for somebody who is not here, the way a status is. */
  const thought = presence === 'offline' ? undefined : mind?.body?.trim()

  /*
   * What they are thinking stands where the word Online would be, which is
   * what a status is and where Discord puts one.
   *
   * It does not lose what they are doing: in a World the dot is replaced by
   * the console mark in green, and in the Workspace by the hammer in
   * orange, so the row still says playing or building - Staw: "instead of
   * 'In a world' or 'on workspace/creator hub' theres a console icon in
   * green with a white dot next to it and then the text of ur thought".
   *
   * The note a list came with still wins over all of it: "wants to be your
   * friend" is why the row is on the screen at all.
   */
  if (!note && thought) {
    const doing = where || presence === 'in-space' ? 'playing' : presence === 'building' ? 'building' : null
    /*
     * A reaction stands in for the dot. Staw: "instead of using the blue
     * dot you use only that reaction cuz it looks weird". Two marks saying
     * they are here, and the one on the picture already said it.
     */
    const wearing = faceOf(mind?.face)

    return (
      <p className={cn('flex items-center gap-1.5 text-xs text-white/70', className)}>
        {doing === 'playing' ? (
          <Icon name="playing" label="Playing" tone="#1CAE71" className="h-3.5 w-3.5 shrink-0" />
        ) : doing === 'building' ? (
          <Glyph icon={faHammer} className="shrink-0 text-mini text-warn-bright" aria-label="Building" />
        ) : !wearing ? (
          <StatusDot presence={presence} size="md" />
        ) : null}

        {/* The dot between the mark and the words, so the two read as two
            things rather than a label and its icon. */}
        {doing && !wearing && <span className="h-1 w-1 shrink-0 rounded-full bg-white/50" />}

        <ThoughtLine thought={thought} face={mind?.face} className="min-w-0" />

        {person.i_ignore && (
          <Tooltip label="You are ignoring this person" side="top">
            <span className="shrink-0 rounded-lg bg-white/10 px-1.5 py-0.5 text-tiny font-bold uppercase tracking-wide text-muted">
              Ignored
            </span>
          </Tooltip>
        )}
      </p>
    )
  }

  return (
    <p className={cn('flex items-center gap-1.5 text-xs', className)}>
      <StatusDot presence={presence} size="md" />
      <span
        className={cn(
          'truncate',
          presence === 'in-space' ? 'text-space-bright' : here ? 'text-white/70' : 'text-muted',
        )}
      >
        {note
          ?? (where
            ? `Playing ${where.world_name}`
            : here
              ? presenceWords[presence]
              : person.last_seen_at
                ? `Last seen ${timeAgo(person.last_seen_at)}`
                : 'Offline')}
      </span>
      {person.i_ignore && (
        <Tooltip label="You are ignoring this person" side="top">
          <span className="shrink-0 rounded-lg bg-white/10 px-1.5 py-0.5 text-tiny font-bold uppercase tracking-wide text-muted">
            Ignored
          </span>
        </Tooltip>
      )}
    </p>
  )
}

/**
 * One person, on a card: the face at a size worth looking at, the name under
 * nothing else, where they are on its own line, and the doors along the
 * bottom where the eye lands last.
 *
 * The "..." only appears on hover or when something in it has focus, because
 * six of them in a grid is a row of dots and nothing else.
 */
export function PersonCard({
  person, note, bio, tag, actions, menu, quiet, friend, mine, square, className,
}: {
  person: Somebody
  note?: string
  /** Shown on the browse grid, where a stranger's own words are the point. */
  bio?: boolean
  /** A word this list wants on the person, such as the rank they hold. */
  tag?: React.ReactNode
  actions?: React.ReactNode
  menu?: React.ReactNode
  /** Drawn back: somebody blocked, or somebody being ignored. */
  quiet?: boolean
  /** A friend gets the green edge, because green is yes. */
  friend?: boolean
  /**
   * Your own card, in a list of other people. Brand blue round it, which
   * is the colour of where you are - the same thing the rail does to the
   * page you are on. It is not a second kind of card: the shape, the size
   * and the slots are everybody's, and only the edge says which one is
   * you.
   */
  mine?: boolean
  square?: boolean
  className?: string
}) {
  return (
    <li
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border-2 bg-ink-card p-4 transition-colors',
        mine
          ? 'border-brand/50 hover:border-brand/80'
          : friend ? 'border-space/40 hover:border-space/70' : 'border-ink-line hover:border-brand/60',
        quiet && 'opacity-70',
        className,
      )}
    >
      {menu && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {menu}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/*
          * No hover card on a card.
          *
          * Staw: "the hover profile should only be for the first one" -
          * the rows and face grids. A card is already the long answer to
          * "who is this"; opening a second, smaller one on top of it is
          * the same information twice, over itself.
          */}
        {/*
          * No floating thought bubble here either. It belongs over a face
          * with room above it - the grid on a profile, the row on the home
          * page - and on a card there is a border eight pixels above the
          * picture, so it drew itself through the edge and over the name.
          * The thought is already under the name, which is where Staw put
          * it: "i want that the text itself replaces the online text".
          */}
        <Link to={profileLink(person)} className="shrink-0">
          <PersonAvatar
            person={person}
            size="lg"
            square={square}
            className="h-14 w-14"
            ring="ring-ink-card"
          />
        </Link>

        <div className="min-w-0 flex-1 pr-6">
          <div className="flex min-w-0 items-center gap-2">
            <PersonName person={person} className="min-w-0" />
            {tag}
          </div>
          <p className="truncate text-xs text-muted">@{person.username}</p>
          <PersonLine person={person} note={note} className="mt-1" />
        </div>
      </div>

      {bio && (
        <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-white/55">
          {person.bio || <span className="text-white/25">Nothing written yet.</span>}
        </p>
      )}

      {actions && (
        <div className="flex items-center gap-2 border-t-2 border-ink-line pt-3 [&>*]:flex-1">
          {actions}
        </div>
      )}
    </li>
  )
}

/**
 * One person as a face with a name under it, for the places that show a few
 * of somebody's people rather than all of them.
 *
 * Same face, same marks, same dot as the card: this is the small end of the
 * one design, not a second one. It used to be a picture and a name and
 * nothing else, so a verified account looked unverified on a profile and
 * verified one press later.
 */
export function PersonFace({ person, big }: {
  person: Somebody
  /** The home page's row, where the faces are the first thing on the page. */
  big?: boolean
}) {
  const where = useWhereabout(person.id)
  const around = useLivePresence(person) !== 'offline'
  const mind = useThought(person.id)

  return (
    <FriendPeek friend={person}>
      <Link
        to={profileLink(person)}
        // Wider than the face it holds, so a name has somewhere to sit and
        // the dot on one picture is nowhere near the next one.
        className="block rounded-xl p-2 text-center transition-colors hover:bg-ink-hover"
      >
        {/* A face this size carries the bubble; the ones in a chat list do
            not, which is where the line beside the name does the job. */}
        <ThoughtOver
          thought={around ? mind?.body : null}
          face={mind?.face}
          small
          className="mx-auto w-max"
        >
          <PersonAvatar
            person={person}
            size={big ? '2xl' : 'xl'}
            className={cn('mx-auto', big && 'h-16 w-16 sm:h-20 sm:w-20')}
            ring="ring-ink"
          />
        </ThoughtOver>
        {/*
          * The name and its marks, on one line, with the handle under it.
          *
          * This took four goes. Staw, on the version that cut the name:
          * "i dont like how we dont see the full displayname here"; on the
          * versions that wrapped: "i want that the displaynames + badges be
          * on a single line and the username under is too far away".
          *
          * Both are the same constraint - a face in this grid is about a
          * hundred and twenty pixels wide - so the answer is not where to
          * put the overflow, it is to need less of it. The name is 13px and
          * the marks are 9px, which fits a name like Kobblon with all three
          * of them and leaves the handle sitting directly underneath. One
          * line, always, for everybody, so a row of faces is level without
          * anything being held at a fixed height.
          *
          * The name truncates and the marks do not, because at that point
          * the name is long enough that the start of it is what identifies
          * somebody; the full name is one hover away on the card behind the
          * face. The heart stays with the name - it is about this list
          * rather than about them.
          */}
        <p className="mt-2 flex items-center justify-center gap-1 text-note font-bold leading-tight">
          {person.best && (
            <Glyph
              icon={faHeart}
              className="shrink-0 text-mark text-brand-bright"
              title="Best friends"
            />
          )}
          <span className="truncate">{person.display_name}</span>
          <NameMarks person={person} className="text-mark" />
        </p>
        {/*
          * The World under the name, when they are in one.
          *
          * Staw: "under the display name of the user (in the friendslists)
          * you should put the world theyre playing". It takes the handle's
          * line rather than adding one, so a row of faces stays a row -
          * a line that only some of them have makes a grid of six sit at
          * four different heights. The handle is one press away on the
          * card behind the face, and a World somebody is in right now is
          * the half worth reading on a friends list.
          */}
        {where ? (
          <p className="flex items-center justify-center gap-1 truncate text-mini font-bold text-space-bright">
            <Glyph icon={faPlay} className="shrink-0 text-nib" />
            <span className="truncate">{where.world_name}</span>
          </p>
        ) : (
          <p className="truncate text-mini text-muted">@{person.username}</p>
        )}
      </Link>
    </FriendPeek>
  )
}

/**
 * A grid of faces that stops, not a track that slides sideways.
 *
 * Staw: "you shouldnt have to scroll left or right to see all of your
 * friends ... but just have a limit max that we can display with a view
 * all". The cap is the caller's, so the heading's count is the real one and
 * this draws only what it was handed. Three on a phone, because eight at
 * three across is three rows of circles between somebody's About and their
 * Communities.
 */
export function FaceGrid({ people, className }: { people: Somebody[]; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-6 max-sm:[&>:nth-child(n+4)]:hidden sm:grid-cols-5 lg:grid-cols-8',
        className,
      )}
    >
      {people.map((person) => <PersonFace key={person.id} person={person} />)}
    </div>
  )
}

/** The grid the cards sit in, so every list of people is the same width. */
export function PersonGrid({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return <ul className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>{children}</ul>
}
