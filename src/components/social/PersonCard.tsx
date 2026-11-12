import { Link } from 'react-router-dom'
import { faHeart, faPlay } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { NameMarks } from '@/components/brand/Verified'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { StatusDot, presenceWords } from '@/components/ui/StatusDot'
import { Tooltip } from '@/components/ui/Tooltip'
import { useLivePresence, useWhereabout } from '@/hooks/usePresenceStore'
import { FriendPeek } from '@/components/social/FriendPeek'
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
          <Glyph icon={faHeart} className="shrink-0 text-[11px] text-brand-bright" />
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
      <NameMarks person={person} className="text-[11px]" />
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
          <span className="shrink-0 rounded-lg bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
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
  person, note, bio, tag, actions, menu, quiet, friend, square, className,
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
  square?: boolean
  className?: string
}) {
  return (
    <li
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border-2 bg-ink-card p-4 transition-colors',
        friend ? 'border-space/40 hover:border-space/70' : 'border-ink-line hover:border-brand/60',
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
        <FriendPeek friend={person} className="shrink-0">
          <Link to={profileLink(person)} className="block">
            <PersonAvatar
              person={person}
              size="lg"
              square={square}
              className="h-14 w-14"
              ring="ring-ink-card"
            />
          </Link>
        </FriendPeek>

        <div className="min-w-0 flex-1 pr-6">
          <PersonName person={person} />
          <p className="truncate text-xs text-muted">@{person.username}</p>
          <PersonLine person={person} note={note} className="mt-1" />
        </div>
      </div>

      {bio && (
        <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-white/55">
          {person.bio || <span className="text-white/25">Nothing written yet.</span>}
        </p>
      )}

      {tag && <div className="flex flex-wrap items-center gap-1.5">{tag}</div>}

      {actions && <div className="flex items-center gap-2">{actions}</div>}
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

  return (
    <FriendPeek friend={person}>
      <Link
        to={profileLink(person)}
        // Wider than the face it holds, so a name has somewhere to sit and
        // the dot on one picture is nowhere near the next one.
        className="block rounded-xl p-2 text-center transition-colors hover:bg-ink-hover"
      >
        <PersonAvatar
          person={person}
          size={big ? '2xl' : 'xl'}
          className={cn('mx-auto', big && 'h-16 w-16 sm:h-20 sm:w-20')}
          ring="ring-ink"
        />
        {/*
          * The name wraps rather than being cut.
          *
          * This row is a heart, a name and up to three marks on one line,
          * and `truncate` on the name meant the marks took their width
          * first and the name got whatever was left - Kobblon's own card
          * read "Kob..." beside three badges. Staw: "i dont like how we
          * dont see the full displayname here".
          *
          * Two goes at keeping the marks on the name's own line failed for
          * the same reason: a face in this grid is about a hundred and
          * twenty pixels wide, and "Kobblon" with three marks after it does
          * not fit in one. Flex put them on a third line; inline text put
          * them on a second. Either way they orphan, and which names orphan
          * depends on how long a name happens to be, so a row of friends
          * read as ragged.
          *
          * So the marks have a line of their own, always, for everybody.
          * The name gets up to two lines in a fixed `h-9` cell and is never
          * cut; the marks sit centred under it in a fixed `h-4`; the handle
          * is therefore at the same height on every face in the row whether
          * somebody wears three marks or none. The heart stays with the
          * name, because it is about this list rather than about them.
          */}
        <p className="mt-2 flex h-9 items-center justify-center overflow-hidden text-center text-sm font-bold leading-tight">
          <span className="line-clamp-2 break-words">
            {person.best && (
              <Glyph
                icon={faHeart}
                className="mr-1 inline-block align-[-0.1em] text-[10px] text-brand-bright"
                title="Best friends"
              />
            )}
            {person.display_name}
          </span>
        </p>
        <p className="flex h-4 items-center justify-center">
          <NameMarks person={person} className="text-[11px]" />
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
          <p className="flex items-center justify-center gap-1 truncate text-[11px] font-bold text-space-bright">
            <Glyph icon={faPlay} className="shrink-0 text-[8px]" />
            <span className="truncate">{where.world_name}</span>
          </p>
        ) : (
          <p className="truncate text-[11px] text-muted">@{person.username}</p>
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
