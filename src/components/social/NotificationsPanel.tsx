import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserPlus, faUserCheck, faHeart, faComment, faCircleInfo, faDoorOpen, faCalendarDay,
  faCheckDouble, faBell, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { worldIcon } from '@/lib/naming'
import { worldLink } from '@/lib/links'
import { Avatar } from '@/components/ui/Avatar'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Kobby } from '@/components/brand/Kobby'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listNotifications, markNotificationsRead } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { Notification } from '@/types/db'
import { avatarOf } from '@/lib/avatars'
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
  space_like: { icon: faHeart, tint: 'bg-danger text-white', ring: 'ring-danger/40' },
  space_visit: { icon: faDoorOpen, tint: 'bg-brand-deep text-white', ring: 'ring-brand/30' },
  message: { icon: faComment, tint: 'bg-brand-bright text-onbrand', ring: 'ring-brand/40' },
  system: { icon: faCircleInfo, tint: 'bg-ink-raised text-white/70', ring: 'ring-ink-line' },
  event_started: { icon: faCalendarDay, tint: 'bg-brand-deep text-white', ring: 'ring-brand/30' },
  world_updated: { icon: worldIcon, tint: 'bg-space text-white', ring: 'ring-space/40' },
}

/** Said as a sentence, with whoever did it in bold at the front of it. */
function words(n: Notification) {
  const who = n.actor?.display_name ?? 'Somebody'
  switch (n.kind) {
    case 'friend_request': return { who, rest: 'sent you a friend request' }
    case 'friend_accepted': return { who, rest: 'accepted your friend request' }
    case 'space_like': return { who, rest: `liked ${n.space?.name ?? 'your World'}` }
    case 'space_visit': return { who, rest: `walked into ${n.space?.name ?? 'your World'}` }
    case 'message': return { who, rest: 'sent you a message' }
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
  if (n.kind === 'friend_request') return '/friends?list=requests'
  if (n.kind === 'friend_accepted') return '/friends'
  if (n.kind === 'message') return '/friends'
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
  const mark = marks[n.kind]
  const said = words(n)

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
        <Avatar src={avatarOf(n.actor)} name={n.actor?.display_name ?? 'K'} size="md" />
        <span
          className={cn(
            'absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-[10px] ring-2 ring-ink-card',
            mark.tint,
          )}
        >
          <FontAwesomeIcon icon={mark.icon} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug text-white/90">
          {said.who && <span className="font-bold text-white">{said.who} </span>}
          {said.rest}
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
  open, onClose, onReadAll,
}: {
  open: boolean
  onClose: () => void
  onReadAll: () => void
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

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      <div className="absolute right-2 top-[3.25rem] z-50 w-[min(94vw,25rem)] animate-pop-in overflow-hidden rounded-2xl border border-ink-line bg-ink-card shadow-pop sm:right-5">
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
            <FontAwesomeIcon icon={faUserGroup} className="text-brand-bright" />
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
            <FontAwesomeIcon icon={faBell} className="text-xs text-muted" />
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
                <FontAwesomeIcon icon={faCheckDouble} />
                Mark all read
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
