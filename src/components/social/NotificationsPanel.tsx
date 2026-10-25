import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faUserPlus, faUserCheck, faHeart, faComment, faCircleInfo, faDoorOpen, faCalendarDay, faGavel,
  faShieldHalved,
  faCheckDouble, faBell, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { worldIcon } from '@/lib/naming'
import { worldLink } from '@/lib/links'
import { Avatar } from '@/components/ui/Avatar'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Kobby } from '@/components/brand/Kobby'
import { Pointer } from '@/components/ui/Pointer'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listNotifications, markNotificationsRead , houseAccount} from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { Notification } from '@/types/db'
import { avatarOf } from '@/lib/avatars'
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
  friend_accepted: { icon: faUserCheck, tint: 'bg-space text-white', ring: 'ring-space/40' },
  // Best friends wear the heart the lists wear, so the two read as one thing.
  best_friend_request: { icon: faHeart, tint: 'bg-brand text-onbrand', ring: 'ring-brand/40' },
  best_friend_accepted: { icon: faHeart, tint: 'bg-space text-white', ring: 'ring-space/40' },
  space_like: { icon: faHeart, tint: 'bg-danger text-white', ring: 'ring-danger/40' },
  space_visit: { icon: faDoorOpen, tint: 'bg-brand-deep text-white', ring: 'ring-brand/30' },
  message: { icon: faComment, tint: 'bg-brand-bright text-onbrand', ring: 'ring-brand/40' },
  system: { icon: faCircleInfo, tint: 'bg-ink-raised text-white/70', ring: 'ring-ink-line' },
  event_started: { icon: faCalendarDay, tint: 'bg-brand-deep text-white', ring: 'ring-brand/30' },
  world_updated: { icon: worldIcon, tint: 'bg-space text-white', ring: 'ring-space/40' },
  content_removed: { icon: faGavel, tint: 'bg-danger text-white', ring: 'ring-danger/40' },
  forum_reply: { icon: faComment, tint: 'bg-brand-deep text-white', ring: 'ring-brand/30' },
  forum_staff: { icon: faShieldHalved, tint: 'bg-space text-white', ring: 'ring-space/40' },
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
function markFor(kind: string) {
  return marks[kind as Notification['kind']] ?? marks.system
}

/** Said as a sentence, with whoever did it in bold at the front of it. */
function words(n: Notification) {
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

/** Today, yesterday, and everything before that. */
function whenGroup(iso: string) {
  const then = new Date(iso)
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (then.getTime() >= midnight) return 'Today'
  if (then.getTime() >= midnight - 86_400_000) return 'Yesterday'
  return 'Before that'
}

function Line({ n, onClose }: { n: Notification; onClose: () => void }) {
  const mark = markFor(n.kind)
  const said = words(n)
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

  return (
    <Link
      to={linkFor(n)}
      onClick={onClose}
      className={cn(
        'group relative flex items-start gap-3 border-b border-ink-line/60 px-4 py-3 transition-colors last:border-0',
        n.is_read ? 'hover:bg-ink-hover' : 'bg-brand/[0.07] hover:bg-brand/[0.12]',
      )}
    >
      {/* Unread is a lit edge rather than a dot to go looking for. */}
      {!n.is_read && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-brand-bright" />
      )}

      <span className="relative shrink-0">
        {/*
          * A notification with no actor was sent by the platform, so it
          * wears the platform's face rather than the letter K - which is
          * what Staw was looking at.
          */}
        <Avatar
          src={n.actor ? avatarOf(n.actor) : house?.avatar_url ?? null}
          personId={n.actor_id ?? house?.id}
          changedAt={n.actor ? undefined : house?.avatar_changed_at}
          name={n.actor?.display_name ?? house?.display_name ?? 'Kobblon'}
          size="md"
        />
        <span
          className={cn(
            'absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-[10px] ring-2 ring-ink-card',
            mark.tint,
          )}
        >
          <Glyph icon={mark.icon} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug text-white/90">
          {said.who && <span className="font-bold text-white">{said.who} </span>}
          {/* An address in the words is a link you can press, and nothing
              here is ever rendered as markup. */}
          {typeof said.rest === 'string' ? <Linkify>{said.rest}</Linkify> : said.rest}
        </span>
        <span className="mt-1 flex items-center gap-2 text-xs text-muted">
          {timeAgo(n.created_at)}
          {!n.is_read && (
            <span className="rounded-md bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-bright">
              New
            </span>
          )}
        </span>
      </span>
    </Link>
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
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [readNow, setReadNow] = useState(false)

  const { data, error, loading, reload } = useAsync(
    async () => (profile && open ? listNotifications(profile.id) : []),
    [profile?.id, open],
  )

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

  const rows = data ?? []
  const unread = rows.filter((n) => !n.is_read)
  const shown = tab === 'unread' ? unread : rows

  const groups = useMemo(() => {
    const out: { name: string; rows: Notification[] }[] = []
    for (const row of shown) {
      const name = whenGroup(row.created_at)
      const last = out[out.length - 1]
      if (last?.name === name) last.rows.push(row)
      else out.push({ name, rows: [row] })
    }
    return out
  }, [shown])

  const waiting = rows.filter((n) => n.kind === 'friend_request').length

  const card = useRef<HTMLDivElement>(null)
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

      <div
        ref={card}
        className="absolute right-2 top-[3.25rem] z-50 w-[min(94vw,25rem)] animate-pop-in overflow-hidden rounded-2xl border border-ink-line bg-ink-card shadow-pop sm:right-5"
      >
        {/* ------------------------------------------------------- header */}
        <div className="relative overflow-hidden border-b border-ink-line bg-ink-raised px-4 py-3">
          <div className="relative flex items-center gap-3">
            <Kobby mood="notification" size="sm" bob={false} className="h-10" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-extrabold leading-tight">Notifications</h2>
              <p className="text-xs text-muted">
                {unread.length
                  ? `${unread.length} new`
                  : readNow ? 'All caught up' : 'Nothing new'}
              </p>
            </div>

            <Tabs
              label="Which notifications"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: 'New', count: unread.length || null },
              ]}
            />
          </div>
        </div>

        {/* A friend request is a thing to answer rather than a thing to read,
            so it gets its own way through. */}
        {waiting > 0 && (
          <Link
            to="/friends?list=requests"
            onClick={onClose}
            className="flex items-center gap-2.5 border-b border-ink-line bg-brand/10 px-4 py-2.5 text-sm font-bold transition-colors hover:bg-brand/20"
          >
            <Glyph icon={faUserGroup} className="text-brand-bright" />
            {waiting === 1 ? 'One person is waiting on you' : `${waiting} people are waiting on you`}
          </Link>
        )}

        {/* --------------------------------------------------------- list */}
        <div className="max-h-[27rem] overflow-y-auto kob-scroll">
          {loading && (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          )}

          {error && <ErrorState message={error} onRetry={reload} />}

          {!loading && !error && !shown.length && (
            <EmptyState
              mood="notification"
              title={tab === 'unread' ? 'Nothing new' : 'Nothing yet'}
              body={
                tab === 'unread'
                  ? 'You have read everything. The rest is under All.'
                  : 'When people add you, message you or walk into your Worlds, it turns up here.'
              }
            />
          )}

          {groups.map((group) => (
            <section key={group.name}>
              <h3 className="sticky top-0 z-10 border-b border-ink-line/60 bg-ink-card/95 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted backdrop-blur">
                {group.name}
              </h3>
              {group.rows.map((n) => <Line key={n.id} n={n} onClose={onClose} />)}
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
            {!!unread.length && (
              <button
                onClick={() => {
                  if (!profile) return
                  void markNotificationsRead(profile.id).then(() => { setReadNow(true); onReadAll(); reload() })
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-link transition-colors hover:underline"
              >
                <Glyph icon={faCheckDouble} />
                Mark all read
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
