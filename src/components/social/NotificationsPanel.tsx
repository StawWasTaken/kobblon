import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { Picture } from '@/components/brand/Picture'
import {
  faUserPlus, faUserCheck, faHeart, faComment, faCircleInfo, faDoorOpen, faCalendarDay, faGavel,
  faShieldHalved,
  faCheckDouble, faBell, faUserGroup, faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { worldIcon } from '@/lib/naming'
import { worldLink } from '@/lib/links'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Kobby } from '@/components/brand/Kobby'
import { Pointer } from '@/components/ui/Pointer'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import {
  listNotifications, markNotificationsRead, houseAccount,
  standingWith, respondToFriendRequest, answerBestFriend,
  dismissNotification, friendsInServers,
} from '@/lib/api'
import { play } from '@/lib/app'
import { timeAgo } from '@/lib/format'
import type { Notification } from '@/types/db'
import { avatarOf } from '@/lib/avatars'
import { useHeadshot } from '@/hooks/useHeadshot'
import { DEFAULT_WORLD_EMBLEM } from '@/lib/worldart'
import { Linkify } from '@/components/ui/Linkify'
import { cn } from '@/lib/cn'

/*
 * What happened while you were out.
 *
 * The old card was a flat list of grey lines that all looked the same, so
 * nothing in it stood out and the unread ones were a dot you had to hunt for.
 * This one sorts itself into today, yesterday and before that, marks each
 * kind with its own colour, says who did it in their own name, and leaves the
 * unread ones plainly lit until you have seen them.
 */
const marks: Record<Notification['kind'], { icon: IconDefinition; tint: string; ring: string }> = {
  friend_request: { icon: faUserPlus, tint: 'bg-brand text-onbrand', ring: 'ring-brand/40' },
  friend_accepted: { icon: faUserCheck, tint: 'bg-space text-on-art', ring: 'ring-space/40' },
  // Best friends wear the heart the lists wear, so the two read as one thing.
  best_friend_request: { icon: faHeart, tint: 'bg-brand text-onbrand', ring: 'ring-brand/40' },
  best_friend_accepted: { icon: faHeart, tint: 'bg-space text-on-art', ring: 'ring-space/40' },
  space_like: { icon: faHeart, tint: 'bg-danger text-on-art', ring: 'ring-danger/40' },
  space_visit: { icon: faDoorOpen, tint: 'bg-brand-deep text-on-art', ring: 'ring-brand/30' },
  message: { icon: faComment, tint: 'bg-brand-bright text-onbrand', ring: 'ring-brand/40' },
  system: { icon: faCircleInfo, tint: 'bg-ink-raised text-white/70', ring: 'ring-ink-line' },
  event_started: { icon: faCalendarDay, tint: 'bg-brand-deep text-on-art', ring: 'ring-brand/30' },
  world_updated: { icon: worldIcon, tint: 'bg-space text-on-art', ring: 'ring-space/40' },
  content_removed: { icon: faGavel, tint: 'bg-danger text-on-art', ring: 'ring-danger/40' },
  forum_reply: { icon: faComment, tint: 'bg-brand-deep text-on-art', ring: 'ring-brand/30' },
  forum_staff: { icon: faShieldHalved, tint: 'bg-space text-on-art', ring: 'ring-space/40' },
  /*
   * Somebody holding a door open, which is the same picture `space_visit`
   * wears and deliberately not the same colour: one is somebody arriving
   * and this is somebody asking you to come. Blue, because it is an
   * invitation to play and blue is Kobblon.
   */
  world_invite: { icon: faDoorOpen, tint: 'bg-brand text-onbrand', ring: 'ring-brand/40' },
}

/*
 * The mark for a kind, and the house one for a kind this build has never
 * heard of.
 *
 * It used to be `marks[n.kind]` straight into `mark.icon`, and a kind the
 * table has and this map does not reads as `undefined.icon` - which is not
 * a missing icon, it is the whole panel refusing to render. `forum_reply`
 * was exactly that from the day the forum shipped: anybody who had been
 * replied to on the forum opened the bell and got nothing at all.
 *
 * So there is a fallback now, and the shape of the bug is worth keeping
 * written down: a migration can add a kind without this file knowing, and
 * a lookup that assumes it knows them all turns that into a blank panel.
 */
export function markFor(kind: string) {
  return marks[kind as Notification['kind']] ?? marks.system
}

/**
 * Said as a sentence, with whoever did it in bold at the front of it.
 *
 * Exported, with `markFor`, because the Workspace had its own copy of this
 * and a second copy of a wording function does what a second copy always
 * does: five kinds the site had been sending for months were not in theirs
 * at all and every one of them arrived over there as "Something happened on
 * Kobblon", and `space_visit` was "played" in one window and "walked into"
 * in the other. Both take a `Notification` and hand back data rather than
 * markup, so neither needs a provider, a router or Supabase.
 */
export function words(n: Notification) {
  const who = n.actor?.display_name ?? 'Somebody'
  switch (n.kind) {
    case 'friend_request': return { who, rest: 'sent you a friend request' }
    case 'friend_accepted': return { who, rest: 'accepted your friend request' }
    case 'best_friend_request': return { who, rest: 'wants to be best friends' }
    case 'best_friend_accepted': return { who, rest: 'is your best friend now' }
    case 'space_like': return { who, rest: `liked ${n.space?.name ?? 'your World'}` }
    case 'space_visit': return { who, rest: `walked into ${n.space?.name ?? 'your World'}` }
    case 'message': return { who, rest: 'sent you a message' }
    // Kobblon did this, and the body already says which thing and why.
    case 'content_removed': return { who: null, rest: n.body ?? 'Something was taken down' }
    /*
     * Both of these are written as the end of a sentence that starts with
     * the name - `replied to "…"`, `put you in charge of …` - so the body
     * is the whole of the rest and nothing is added to it here.
     */
    case 'forum_reply': return { who, rest: n.body ?? 'replied to you on the forum' }
    case 'forum_staff': return { who, rest: n.body ?? 'changed what you look after on the forum' }
    /*
     * The joined World first and the stored name second. `body` is a copy
     * taken when the invite was sent, so a World renamed since then keeps
     * the old name in the row; the join is what it is actually called now.
     */
    case 'world_invite': return {
      who,
      rest: `invited you to ${n.world?.name ?? n.body ?? 'a World'}`,
    }
    case 'world_updated': return {
      who,
      rest: n.body?.trim()
        ? `updated ${n.world?.name ?? 'a World'}: ${n.body.trim()}`
        : `updated ${n.world?.name ?? 'a World'}`,
    }
    default: return { who: null, rest: n.body ?? 'Something happened' }
  }
}

function linkFor(n: Notification) {
  /*
   * The address on the row wins when there is one. It is how a forum
   * notification knows which topic it is about, and asking the kind first
   * would mean a new kind needing a line here before it leads anywhere.
   */
  if (n.link) return n.link
  if (n.kind === 'friend_request') return '/friends?list=requests'
  if (n.kind === 'friend_accepted') return '/friends'
  /*
   * Straight to them, because the answer lives on their profile: a best
   * friend request is answered where the two of you are, not in a list of
   * requests from strangers.
   */
  if (n.kind === 'best_friend_request' || n.kind === 'best_friend_accepted') {
    return n.actor?.username ? `/u/${n.actor.username}` : '/friends'
  }
  if (n.kind === 'message') return '/friends'
  if (n.kind === 'content_removed') return '/standing'
  // Told about a World, so it leads to that World.
  if (n.world?.content_id) return worldLink(n.world as Parameters<typeof worldLink>[0])
  if (n.space && n.actor) return `/u/${n.actor.username}/${n.space.slug}`
  return '/home'
}

/**
 * Which rail a kind belongs to.
 *
 * Staw's note on the bell was three words - grouping, filtering, pressable -
 * and this is the filtering. Four families rather than thirteen kinds,
 * because a filter with one row behind it is a filter nobody presses, and
 * because what somebody is actually looking for is "people" or "my Worlds",
 * never `best_friend_accepted`.
 *
 * A kind this build has not heard of lands in Kobblon rather than nowhere:
 * the same fallback `markFor` has, for the same reason - a migration can
 * add a kind without this file knowing.
 */
export type NotifFamily = 'people' | 'worlds' | 'forum' | 'kobblon'

const FAMILY: Partial<Record<Notification['kind'], NotifFamily>> = {
  friend_request: 'people',
  friend_accepted: 'people',
  best_friend_request: 'people',
  best_friend_accepted: 'people',
  message: 'people',
  world_invite: 'people',
  space_like: 'worlds',
  space_visit: 'worlds',
  world_updated: 'worlds',
  forum_reply: 'forum',
  forum_staff: 'forum',
  system: 'kobblon',
  content_removed: 'kobblon',
  event_started: 'kobblon',
}

export function familyOf(kind: string): NotifFamily {
  return FAMILY[kind as Notification['kind']] ?? 'kobblon'
}

/** What the rail offers, and what each one is called. */
export type NotifFilter = 'all' | 'unread' | NotifFamily

const RAIL: { value: NotifFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'New' },
  { value: 'people', label: 'People' },
  { value: 'worlds', label: 'Worlds' },
  { value: 'forum', label: 'Forum' },
  { value: 'kobblon', label: 'Kobblon' },
]

/**
 * Several of the same thing, said once.
 *
 * Twelve people liking a World was twelve rows, which pushed everything
 * else off the card and read as noise rather than as twelve people liking
 * a World. A bundle is rows of the same kind about the same thing on the
 * same day: it wears the faces of up to three of them, says how many, and
 * leads where any one of them led.
 *
 * What it is "about" is the World or the Space where there is one, and the
 * person otherwise - so three messages from one friend are one row and
 * three messages from three friends are three. A kind with neither is
 * never bundled: `system` and `content_removed` each say their own thing
 * and stacking them would hide what was taken down.
 */
type Bundle = { key: string; rows: Notification[] }

const NEVER_BUNDLED = new Set(['system', 'content_removed', 'friend_request', 'best_friend_request'])

function aboutOf(n: Notification) {
  if (NEVER_BUNDLED.has(n.kind)) return null
  const what = n.world_id ?? n.space_id ?? n.actor_id
  return what ? `${n.kind}:${what}` : null
}

function bundle(rows: Notification[]): Bundle[] {
  const out: Bundle[] = []
  const byKey = new Map<string, Bundle>()
  for (const row of rows) {
    const about = aboutOf(row)
    const key = about ? `${about}:${whenGroup(row.created_at)}` : String(row.id)
    const had = about ? byKey.get(key) : undefined
    if (had) { had.rows.push(row); continue }
    const made = { key, rows: [row] }
    out.push(made)
    if (about) byKey.set(key, made)
  }
  return out
}

/** Who a bundle is from, deduplicated, newest first. */
function actorsOf(rows: Notification[]) {
  const seen = new Set<string>()
  const out: Notification[] = []
  for (const row of rows) {
    const id = row.actor_id ?? 'house'
    if (seen.has(id)) continue
    seen.add(id)
    out.push(row)
  }
  return out
}

/** Today, yesterday, and everything before that. */
function whenGroup(iso: string) {
  const then = new Date(iso)
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (then.getTime() >= midnight) return 'Today'
  if (then.getTime() >= midnight - 86_400_000) return 'Yesterday'
  return 'Before that'
}

/*
 * One thing that happened, as a row.
 *
 * Staw on the old one: the design "kinda sucks", and the card around it is
 * fine. It was right about where the fault was. Every row was a full-width
 * band with a hairline under it, the time sat under the words in the same
 * grey as the words, and the unread ones carried three separate marks at
 * once - a tint, a lit edge and a NEW chip - so the loudest thing on the
 * row was the row telling you it was unread rather than what happened.
 *
 * So: rows are their own blocks with air around them, the time goes to the
 * right where an eye scanning down finds it in one column, and unread is
 * said twice and no more - the tint and the lit edge.
 */
function Line({ n, also, settled, onClose, onOpen, onAnswer, onJoin, onDismiss }: {
  n: Notification
  /** The others in this bundle, newest first, this one not among them. */
  also?: Notification[]
  /**
   * This request has already been dealt with somewhere else.
   *
   * Staw: "what if ive accepted already a friend request". The bell is a
   * list of things that happened, not a list of things still open, so a
   * request answered on the friends page was still drawing Accept here -
   * and pressing it wrote to a row that no longer exists. Whoever mounts
   * the card says which are still open; this says so on the row and draws
   * no buttons.
   */
  settled?: 'accepted' | 'gone' | null
  onClose: () => void
  onOpen?: (n: Notification | null, href: string) => void
  onAnswer?: (n: Notification, yes: boolean) => void | Promise<void>
  /** Into the World, and into the room the one who asked is in. */
  onJoin?: (n: Notification) => void | Promise<void>
  /** Put this one away without going anywhere. */
  onDismiss?: (n: Notification) => void | Promise<void>
}) {
  const mark = markFor(n.kind)
  const said = words(n)
  const others = also ?? []
  const more = others.length
  const isRequest = n.kind === 'friend_request' || n.kind === 'best_friend_request'
  const answerable = !!onAnswer && isRequest && !settled
  const joinable = !!onJoin && n.kind === 'world_invite'
  const hasActions = answerable || joinable
  const [answered, setAnswered] = useState<'yes' | 'no' | null>(null)
  const [answering, setAnswering] = useState(false)
  /*
   * The house, for the ones nobody sent. Asked once for the whole site and
   * handed back from memory after that, so a list of twenty is one request.
   */
  type House = Awaited<ReturnType<typeof houseAccount>>
  const [house, setHouse] = useState<House>(null)
  useEffect(() => {
    if (n.actor) return
    let live = true
    void houseAccount().then((found) => { if (live) setHouse(found) })
    return () => { live = false }
  }, [n.actor])

  /*
   * A `<Link>` on the site, a `<button>` anywhere else.
   *
   * The Workspace has a bell and could not use this card for exactly one
   * reason: every row navigated to a website path, and over there a
   * `<Link>` needs a router it has not got. Wrapping it in a MemoryRouter
   * would have mounted it and made every row dead, which is worse - a row
   * that looks pressable and does nothing is the one thing this project
   * does not ship. So the caller says what a press does, and `linkFor`
   * works out the address either way.
   */
  const href = linkFor(n)

  /*
   * Their face, drawn where nothing is stored - the same hook `Avatar`
   * uses, asked here because this row frames it square rather than round.
   */
  const face = useHeadshot(
    n.actor_id ?? house?.id,
    n.actor ? avatarOf(n.actor) : house?.avatar_url ?? null,
    n.actor ? undefined : house?.avatar_changed_at,
  )

  /*
   * The row, rebuilt.
   *
   * Staw: a Kobblon vibe with an Xbox/Steam one over it, and "the rails
   * themselves need a huge redesign with proper buttons, images, texts".
   * The old row was a 40px face, one grey sentence and a timestamp - a
   * mailing list. A console tells you what happened by showing you the
   * thing it happened to.
   *
   * So each row is a block with the platform's own edge on it: a square
   * picture, the name of what this is about in the pixel font, the
   * sentence under it, the time and the way on at the right. Unread is the
   * blue lip and a lit band, which is how everything else on this site
   * says "this one".
   */
  const art = n.world
    ? (n.world.cover_url ?? n.world.emblem_url ?? null)
    : n.space
      ? (n.space.cover_url ?? n.space.emblem_url ?? null)
      : null

  /*
   * The sentence, with what the heading already said taken out of it.
   *
   * The heading is the World or the person this is about, so a row read
   * top to bottom was saying the name twice: "HaczkyEndre / HaczkyEndre
   * sent you a friend request", "First Ground / Malicia liked First
   * Ground". The name leads when there is a picture of a World beside it
   * and goes when the picture is the person's own face.
   */
  /* What the row is about, in two or three words, in the pixel font. */
  const heading = n.world?.name
    ?? n.space?.name
    ?? n.actor?.display_name
    ?? house?.display_name
    ?? 'Kobblon'

  const aboutAThing = !!(n.world || n.space)
  const rest = typeof said.rest === 'string' && aboutAThing && said.rest.endsWith(heading)
    ? `${said.rest.slice(0, -heading.length)}this`
    : said.rest

  const look = cn(
    'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border-2 border-b-4 px-3 py-2.5 text-left transition-colors',
    /* Unread is the lit band and a blue lip, not a blue card: seven
       unread used to be a wall of brand colour with the words inside it
       fighting for contrast. */
    n.is_read
      ? 'border-ink-line bg-ink-raised hover:border-brand/40'
      : 'border-ink-line bg-brand/[0.07] hover:bg-brand/[0.12]',
  )

  const inside = (
    <>
      {!n.is_read && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-bright" />
      )}

      {/* The picture: the World where there is one, the person otherwise,
          with the kind's mark sat on its corner. A World with no art of
          its own wears the platform's default drawing rather than a
          letter. */}
      <span className="relative shrink-0">
        {/*
          * One frame for both, and it is a square.
          *
          * A circle cropped the drawn headshots badly at this size - the
          * shoulders came through the bottom corners as two coloured
          * slivers, which is the "lil bug" Staw saw and is really the
          * round mask taking a bite out of a portrait that was never
          * round. A tile holds the whole picture, and it is the frame the
          * World rows already wear, so a list of both reads as one list.
          */}
        <span className="relative z-10 block h-12 w-12 overflow-hidden rounded-xl border-2 border-b-[3px] border-ink-line bg-ink">
          <Picture
            src={n.world || n.space
              ? (art ?? DEFAULT_WORLD_EMBLEM)
              : (face ?? DEFAULT_WORLD_EMBLEM)}
            alt={heading}
            className="h-full w-full"
          />
        </span>
        <span className="relative z-10 block">

          <span
            className={cn(
              'absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-tiny ring-2 ring-ink-raised',
              mark.tint,
            )}
          >
            <Glyph icon={mark.icon} />
          </span>
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold leading-tight">
            {heading}
          </span>
          <span className="shrink-0 text-tiny tabular-nums text-muted">
            {timeAgo(n.created_at)}
          </span>
        </span>

        <span className="mt-0.5 block text-xs leading-snug text-white/70">
          {said.who && aboutAThing && (
            <span className="font-bold text-white/85">
              {said.who}
              {!!more && (more === 1 ? ' and 1 other' : ` and ${more} others`)}
              {' '}
            </span>
          )}
          {!aboutAThing && !!more && (
            <span className="font-bold text-white/85">
              {more === 1 ? 'and 1 other, ' : `and ${more} others, `}
            </span>
          )}
          {/* An address in the words is a link you can press, and nothing
              here is ever rendered as markup. */}
          {typeof rest === 'string' ? <Linkify>{rest}</Linkify> : rest}
        </span>
      </span>

      {/* Who else, on the right, where a console puts the crowd: three
          faces and nothing more, because the sentence already says how
          many. The way on is said rather than implied - a row you can
          press should look like one even when nothing on it is a
          button. */}
      {!hasActions && (
        <span className="flex shrink-0 items-center gap-2">
          {!!more && (
            <span className="flex items-center -space-x-2">
              {others.slice(0, 3).map((other) => (
                <Avatar
                  key={other.id}
                  src={other.actor ? avatarOf(other.actor) : null}
                  personId={other.actor_id ?? undefined}
                  name={other.actor?.display_name ?? 'Kobblon'}
                  size="sm"
                />
              ))}
            </span>
          )}
          <Glyph
            icon={faChevronRight}
            className="text-muted transition-colors group-hover:text-white"
          />
        </span>
      )}
    </>
  )

  const press = onOpen ? (
    <button
      type="button"
      className={look}
      onClick={() => { onOpen(n, href); onClose() }}
    >
      {inside}
    </button>
  ) : (
    <Link to={href} onClick={onClose} className={look}>
      {inside}
    </Link>
  )

  /* Dealt with elsewhere: said once, quietly, instead of two buttons that
     would write to a row that is not there. */
  if (isRequest && settled) {
    return (
      <div className={cn(look, 'cursor-default')}>
        {inside}
        <span className="shrink-0 text-xs font-bold text-muted">
          {settled === 'accepted' ? 'Friends now' : 'Dealt with'}
        </span>
      </div>
    )
  }

  if (!hasActions) return press

  /*
   * A request is a thing to answer, so it is answered here, on the row.
   *
   * Staw's third word was "pressable". A friend request that only leads to
   * the page where you could answer it is a notification about a
   * notification - two presses and a page load to say yes to somebody.
   *
   * The whole row is not a link in this one case, because a button inside
   * a link is a button inside a link and the browser gives the press to
   * whichever it feels like. The picture and the name still lead to them:
   * that is what the small arrow on the right is for. Answering is the
   * caller's business, so this card still asks nothing of a database.
   */
  const answerLook = 'rounded-lg border-2 border-b-4 px-3 py-1.5 text-xs font-extrabold transition-colors disabled:opacity-50'

  return (
    <div className={cn(look, 'flex-col items-stretch gap-2 cursor-default')}>
      <span className="flex items-center gap-3">
        {inside}

        {onOpen ? (
          <button
            type="button"
            aria-label="Open"
            onClick={() => { onOpen(n, href); onClose() }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink-hover hover:text-white"
          >
            <Glyph icon={faChevronRight} />
          </button>
        ) : (
          <Link
            to={href}
            aria-label="Open"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink-hover hover:text-white"
          >
            <Glyph icon={faChevronRight} />
          </Link>
        )}
      </span>

      <span className="flex items-center gap-1.5 pl-[3.75rem]">
        {joinable ? (
          answered ? (
            <span className="text-xs font-bold text-muted">
              {answered === 'yes' ? 'On your way.' : 'Put away'}
            </span>
          ) : (
            <>
              {/* Straight into the room they are in, not merely to the
                  World's page - that is what being invited means. */}
              <button
                type="button"
                disabled={answering}
                onClick={() => {
                  setAnswering(true)
                  void Promise.resolve(onJoin?.(n))
                    .then(() => setAnswered('yes'))
                    .finally(() => setAnswering(false))
                }}
                className={cn(answerLook, 'border-space-deep bg-space text-on-art hover:bg-space-bright')}
              >
                Join
              </button>
              <button
                type="button"
                disabled={answering}
                onClick={() => {
                  setAnswering(true)
                  void Promise.resolve(onDismiss?.(n))
                    .then(() => setAnswered('no'))
                    .finally(() => setAnswering(false))
                }}
                className={cn(answerLook, 'border-ink-line bg-ink-card text-white/70 hover:text-white')}
              >
                Dismiss
              </button>
            </>
          )
        ) : answered ? (
          <span className="text-xs font-bold text-muted">
            {answered === 'yes' ? 'Accepted' : 'Turned down'}
          </span>
        ) : (
          <>
            <button
              type="button"
              disabled={answering}
              onClick={() => {
                setAnswering(true)
                void Promise.resolve(onAnswer?.(n, true))
                  .then(() => setAnswered('yes'))
                  .finally(() => setAnswering(false))
              }}
              className={cn(answerLook, 'border-space-deep bg-space text-on-art hover:bg-space-bright')}
            >
              Accept
            </button>
            <button
              type="button"
              disabled={answering}
              onClick={() => {
                setAnswering(true)
                void Promise.resolve(onAnswer?.(n, false))
                  .then(() => setAnswered('no'))
                  .finally(() => setAnswering(false))
              }}
              className={cn(answerLook, 'border-ink-line bg-ink-card text-white/70 hover:text-white')}
            >
              Decline
            </button>
          </>
        )}
      </span>
    </div>
  )
}

/**
 * The card itself, with the rows handed to it.
 *
 * Split out from the panel so it can be mounted on its own under
 * `tools/site/` with made-up rows: the panel reads Supabase and measures the
 * bell it came out of, neither of which exists on a bare page, and a card
 * that can only be looked at by signing in is a card nobody looks at. The
 * Workspace can mount this one too if it ever grows a bell.
 */
export function NotificationsCard({
  rows, loading, error, onRetry, tab, onTab, onClose, onMarkAll, readNow, onOpen, onAnswer,
  onJoin, onDismiss, settled, className,
}: {
  rows: Notification[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  tab: NotifFilter
  onTab: (next: NotifFilter) => void
  onClose: () => void
  onMarkAll?: () => void
  /** Everything has just been marked read, so the header says so. */
  readNow?: boolean
  /**
   * Where a row leads, for a window that is not the website.
   *
   * Handed the row and the address the site would have gone to. Given, the
   * rows are buttons and nothing in this card needs a router; left out,
   * they are `<Link>`s exactly as they were.
   *
   * The row is null for the one press that is not a notification: the
   * "waiting on you" strip in the header, which leads to the friends list.
   */
  onOpen?: (n: Notification | null, href: string) => void
  /**
   * Answering a friend request from the row itself.
   *
   * The card does not read or write anything, so whoever mounts it says
   * what yes and no do. Left out, the request rows are what they were: a
   * way through to the page where they can be answered.
   */
  onAnswer?: (n: Notification, yes: boolean) => void | Promise<void>
  /** Into the World and into the room the one who asked is in. */
  onJoin?: (n: Notification) => void | Promise<void>
  /** Put one row away without going anywhere. */
  onDismiss?: (n: Notification) => void | Promise<void>
  /**
   * Which request rows have already been dealt with, by notification id.
   *
   * Asked of whoever mounts the card rather than worked out here: the card
   * reads nothing, and only the thing holding a session can say whether
   * two people are friends by now.
   */
  settled?: Record<string, 'accepted' | 'gone'>
  className?: string
}) {
  const unread = rows.filter((n) => !n.is_read)
  const shown = tab === 'all'
    ? rows
    : tab === 'unread'
      ? unread
      : rows.filter((n) => familyOf(n.kind) === tab)

  const groups = useMemo(() => {
    const out: { name: string; bundles: Bundle[] }[] = []
    for (const made of bundle(shown)) {
      const name = whenGroup(made.rows[0].created_at)
      const last = out[out.length - 1]
      if (last?.name === name) last.bundles.push(made)
      else out.push({ name, bundles: [made] })
    }
    return out
  }, [shown])

  /* Only the ones still open: a request answered on the friends page was
     still being counted here, which is the bell telling you to go and do
     something that is already done. */
  const waiting = rows.filter((n) => n.kind === 'friend_request' && !settled?.[String(n.id)]).length

  return (
    <div
      className={cn(
        'w-[min(94vw,25rem)] overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card shadow-pop',
        className,
      )}
    >
      {/* ------------------------------------------------------- header */}
      <div className="relative overflow-hidden border-b border-ink-line bg-ink-raised px-4 py-3">
        <div className="relative flex items-center gap-3">
          {/* Staw: make the notification guy bigger. He is the only
              drawing on the card and at 40px he was a sticker on a
              header; at 64 he is what the card is. */}
          <Kobby mood="notification" size="md" bob={false} className="-my-1 h-16 max-w-[6rem] shrink-0" />
          {/*
            * The drawing is wide, so it is given a width rather than left to
            * take whatever its aspect wants; and the title truncates, because the tray will not shrink and the title will
            * not wrap: without this the title keeps its full width, the row
            * overflows, and the tabs are drawn straight over the word
            * "Notifications" on a narrow card.
            */}
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-extrabold leading-tight">Notifications</h2>
            <p className="truncate text-xs font-bold text-muted">
              {unread.length
                ? `${unread.length} new`
                : readNow ? 'All caught up' : 'Nothing new'}
            </p>
          </div>

        </div>

        {/*
          * The rail, under the title rather than beside it.
          *
          * Six words do not fit on a 25rem card next to a drawing and a
          * heading, and the two that were there - All and New - were the
          * whole of the filtering. These scroll sideways on a narrow card
          * and keep the one you are on in the site's blue, the same way
          * every other switch on the platform says "this one".
          */}
        <div className="relative mt-3 flex gap-1 overflow-x-auto kob-scroll">
          {RAIL.map((one) => {
            const count = one.value === 'unread'
              ? unread.length
              : one.value === 'all'
                ? 0
                : rows.filter((n) => familyOf(n.kind) === one.value).length
            if (one.value !== 'all' && one.value !== 'unread' && !count) return null
            return (
              <button
                key={one.value}
                type="button"
                onClick={() => onTab(one.value)}
                aria-current={tab === one.value}
                className={cn(
                  'shrink-0 rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors',
                  tab === one.value
                    ? 'border-brand-deep bg-brand text-on-art'
                    : 'border-ink-line bg-ink-card text-white/55 hover:text-white',
                )}
              >
                {one.label}
                {!!count && one.value !== 'all' && (
                  <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* A friend request is a thing to answer rather than a thing to read,
          so it gets its own way through. */}
      {waiting > 0 && (() => {
        const to = '/friends?list=requests'
        const look = 'flex min-w-0 flex-1 items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold transition-colors hover:bg-brand/20'
        const said = (
          <>
            <Glyph icon={faUserGroup} className="text-brand-bright" />
            {waiting === 1 ? 'One person is waiting on you' : `${waiting} people are waiting on you`}
          </>
        )
        /* The strip is a press too, so it follows the rows: a router's link
           on the site, and the caller's business anywhere else. A card that
           is router-free except for one row in its header is not
           router-free. */
        return (
          <div className="flex items-center border-b border-ink-line bg-brand/10">
            {onOpen ? (
              <button type="button" className={look} onClick={() => { onOpen(null, to); onClose() }}>
                {said}
              </button>
            ) : (
              <Link to={to} onClick={onClose} className={look}>{said}</Link>
            )}

            {/* Quieting the strip without answering anybody. Staw asked for
                it: being reminded is useful once and nagging after that. */}
            {!!onMarkAll && (
              <button
                type="button"
                onClick={onMarkAll}
                className="mr-3 shrink-0 rounded-lg border-2 border-b-[3px] border-ink-line bg-ink-card px-2.5 py-1 text-xs font-bold text-white/70 transition-colors hover:text-white"
              >
                Mark read
              </button>
            )}
          </div>
        )
      })()}

      {/* --------------------------------------------------------- list */}
      <div className="max-h-[27rem] overflow-y-auto kob-scroll">
        {loading && (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        )}

        {error && <ErrorState message={error} onRetry={onRetry} />}

        {!loading && !error && !shown.length && (
          <EmptyState
            mood="notification"
            title={tab === 'unread' ? 'Nothing new' : tab === 'all' ? 'Nothing yet' : 'Nothing here'}
            body={
              tab === 'unread'
                ? 'You have read everything. The rest is under All.'
                : tab === 'all'
                  ? 'When people add you, message you or walk into your Worlds, it turns up here.'
                  : 'Nothing of this sort lately. All has the rest.'
            }
          />
        )}

        {groups.map((group) => (
          <section key={group.name}>
            <h3 className="sticky top-0 z-10 border-b border-ink-line/60 bg-ink-card/95 px-4 py-1.5 text-mini font-bold uppercase tracking-wide text-muted backdrop-blur">
              {group.name}
            </h3>
            <div className="space-y-2 px-3 pb-2">
              {group.bundles.map((made) => {
                const [first, ...rest] = actorsOf(made.rows)
                return (
                  <Line
                    key={made.key}
                    n={first}
                    also={rest}
                    settled={settled?.[String(first.id)] ?? null}
                    onClose={onClose}
                    onOpen={onOpen}
                    onAnswer={onAnswer}
                    onJoin={onJoin}
                    onDismiss={onDismiss}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ------------------------------------------------------- footer */}
      {!!rows.length && (
        <div className="flex items-center gap-3 border-t border-ink-line px-4 py-2.5">
          <Glyph icon={faBell} className="text-xs text-muted" />
          <p className="min-w-0 flex-1 truncate text-xs text-muted">
            {rows.length} in the last while
          </p>
          {!!unread.length && !!onMarkAll && (
            <button
              type="button"
              onClick={onMarkAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-link transition-colors hover:underline"
            >
              <Glyph icon={faCheckDouble} />
              Mark all read
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function NotificationsPanel({
  open, onClose, onReadAll, anchor,
}: {
  open: boolean
  onClose: () => void
  onReadAll: () => void
  /**
   * The bell this card came out of, so the arrow can point at it.
   *
   * Measured rather than written into the card's own classes: the card is
   * pinned to the right-hand edge of the bar and the bell is three buttons
   * in from it, so where the point belongs depends on which of those
   * buttons are drawn - the balance and the name are both hidden on a
   * phone. A guessed offset would be right on a laptop and point at the
   * gear on a phone.
   */
  anchor?: React.RefObject<HTMLElement | null>
}) {
  const { profile } = useAuth()
  const [tab, setTab] = useState<NotifFilter>('all')
  const [readNow, setReadNow] = useState(false)

  const { data, error, loading, reload } = useAsync(
    async () => (profile && open ? listNotifications(profile.id) : []),
    [profile?.id, open],
  )

  /*
   * Which requests are still open.
   *
   * Asked once each time the card is opened, for the request rows only -
   * never held from a previous open. A notification is a record that
   * somebody asked; whether they are still waiting is a different
   * question with a different answer by now, and the bell was answering
   * the first one while drawing buttons for the second.
   */
  const [settled, setSettled] = useState<Record<string, 'accepted' | 'gone'>>({})

  useEffect(() => {
    if (!open || !profile) return
    const asks = (data ?? []).filter(
      (n) => n.kind === 'friend_request' && n.actor_id,
    )
    if (!asks.length) return setSettled({})

    let live = true
    void Promise.all(asks.map(async (n) => {
      try {
        const standing = await standingWith(n.actor_id as string)
        if (standing.are_friends) return [String(n.id), 'accepted' as const]
        if (!standing.request_received) return [String(n.id), 'gone' as const]
      } catch {
        /* Asked and not answered: the row keeps its buttons, and pressing
           one says so plainly rather than the row deciding on a guess. */
      }
      return null
    })).then((found) => {
      if (!live) return
      setSettled(Object.fromEntries(found.filter(Boolean) as [string, 'accepted' | 'gone'][]))
    })
    return () => { live = false }
  }, [open, profile, data])

  /*
   * Opening the card marks everything read after a moment, so the count on
   * the bell means something, but the lit edges stay for this look: being
   * told about something and losing sight of it in the same second is how you
   * miss it.
   */
  useEffect(() => {
    if (!open || !profile) return
    setReadNow(false)
    const timer = window.setTimeout(() => {
      markNotificationsRead(profile.id).then(() => { setReadNow(true); onReadAll() })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [open, profile, onReadAll])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const [point, setPoint] = useState<number | null>(null)

  /*
   * Where the arrow goes, measured from the bell and not from the card.
   *
   * The card is measured nowhere in here on purpose. It opens with
   * `animate-pop-in`, so a rect read on the render that opens it is a rect
   * read in the middle of a transform - the first version of this asked the
   * card where its top edge was, got a number eleven pixels down from where
   * it settles, and drew the arrow inside the card where nothing can see
   * it. The card's own position is two constants in its class list; the
   * only thing worth measuring is the button.
   *
   * It is the fifth time on this platform that a value was read before the
   * thing that decides it had finished deciding.
   */
  useLayoutEffect(() => {
    if (!open) return

    const place = () => {
      const bell = anchor?.current?.getBoundingClientRect()
      if (!bell) return setPoint(null)
      // The bar is pinned to the top of the window, so viewport pixels and
      // the header's own pixels are the same pixels.
      setPoint(bell.left + bell.width / 2)
    }

    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, anchor])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Outside the card, because the card hides its overflow to keep the
          header's corners - an arrow drawn inside it is an arrow clipped
          flat against the top edge. Under it, too: the card is opaque, so
          what is left showing is a triangle with the card's own border
          along its two edges rather than a diamond stuck to the header.

          `top` is the card's own `top-[3.25rem]` less half the square. */}
      {point !== null && (
        <Pointer
          bg="bg-ink-raised"
          className="z-[51]"
          style={{ left: point - 6, top: '2.875rem' }}
        />
      )}

      <NotificationsCard
        className="absolute right-2 top-[3.25rem] z-50 animate-pop-in sm:right-5"
        rows={data ?? []}
        loading={loading}
        error={error}
        onRetry={reload}
        tab={tab}
        onTab={setTab}
        onClose={onClose}
        readNow={readNow}
        /*
          * Yes and no, from the row.
          *
          * The row carries who asked, not which row of `friendships` the
          * asking is - so the id is fetched at the moment of pressing
          * rather than held from when the list was read. That is the trap
          * this project keeps falling into, and here it would bite for
          * real: a request answered on the friends page and then answered
          * again from a stale bell is a write against a row that is gone.
          */
        settled={settled}
        onDismiss={async (n) => {
          await dismissNotification(String(n.id))
          reload()
        }}
        /*
          * Into the room they are in, not merely to the World's page.
          *
          * Which room is asked for at the moment of pressing: an invite
          * sent twenty minutes ago knows the World and cannot know where
          * they are standing now. If they have left, this still opens the
          * World - a Join that refuses because the friend moved is worse
          * than one that takes you there anyway.
          */
        onJoin={async (n) => {
          const world = n.world_id
          if (!world) return
          let room: string | undefined
          try {
            const rooms = await friendsInServers(world)
            const found = Object.entries(rooms)
              .find(([, who]) => who.some((one) => one.id === n.actor_id))
            room = found?.[0]
          } catch {
            /* Not knowing which room is not a reason to refuse the World. */
          }
          void play(world, () => {}, room)
          await dismissNotification(String(n.id))
          reload()
        }}
        onAnswer={async (n, yes) => {
          const target = n.actor_id
          if (!target) return
          if (n.kind === 'best_friend_request') {
            await answerBestFriend(target, yes)
          } else {
            const standing = await standingWith(target)
            const id = standing.request_id
            if (!id) throw new Error('That request is no longer there.')
            await respondToFriendRequest(id, yes)
          }
          setSettled((was) => ({ ...was, [String(n.id)]: yes ? 'accepted' : 'gone' }))
          reload()
        }}
        onMarkAll={() => {
          if (!profile) return
          void markNotificationsRead(profile.id).then(() => { setReadNow(true); onReadAll(); reload() })
        }}
      />
    </>
  )
}
