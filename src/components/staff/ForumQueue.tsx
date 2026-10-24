/*
 * The forum, from the console.
 *
 * Staw: "we'll also need to upgrade our admin panel for the new forum &
 * other stuff". The forum has had moderation functions since it was built
 * and no screen to use them from: pinning, locking and removing were
 * reachable only from the topic itself, and a removed topic was reachable
 * from nowhere at all, because every reading function on the forum filters
 * `not is_removed`. Staff could take something down and then had no way to
 * look at what they had taken down, or to put it back.
 *
 * So this reads `forum_staff_topics` (0295), which is the one door that
 * does not filter, and it has a Removed tab because that tab is the whole
 * reason the function exists.
 *
 * Two notes on what the buttons do. Remove here is `take_down_forum`
 * (0294), not `forum_remove`: the second is the author deleting their own
 * and says nothing to anybody, the first writes the violation, tells the
 * person and points them at their standing so they can appeal. And before
 * 0294 a forum report's Remove button raised *invalid input syntax for
 * type uuid* every time, because a forum id is a bigint and `take_down`
 * casts to uuid - so this panel is also the first place that removal has
 * ever actually worked.
 */
import { useState } from 'react'
import {
  faThumbtack, faLock, faLockOpen, faTrashCan, faRotateLeft, faComments,
  faEye, faHeart, faReply, faClock, faCircleCheck, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Note } from '@/components/ui/Note'
import { Tabs } from '@/components/ui/Tabs'
import { Textarea } from '@/components/ui/Input'
import { Skeleton, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import {
  forumStaffTopics, forumRestore, forumSetFlags, takeDownForum,
} from '@/lib/api'
import type { ForumTopic } from '@/types/db'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

type Which = 'all' | 'live' | 'removed' | 'locked' | 'pinned'

/**
 * The reasons a forum post comes down.
 *
 * The same five the report triage offers, said for a thread rather than
 * for a person, plus a free line. A removal with no words cannot be
 * appealed, so the reason is required and the button stays off until there
 * is one.
 */
const REASONS = [
  'Off the rules for this board',
  'Rude to somebody',
  'Spam or advertising',
  'Not safe for the people here',
  'Private information about somebody',
] as const

export function ForumQueue() {
  const say = useToast()
  const [which, setWhich] = useState<Which>('all')
  const [taking, setTaking] = useState<ForumTopic | null>(null)

  const queue = useAsync(async () => forumStaffTopics({ which, limit: 60 }), [which])

  const act = async (what: () => Promise<void>, said: string) => {
    try {
      await what()
      say(said, 'success')
      queue.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <Note>
        Removing a topic here tells its author why and writes it into their
        standing, so they can appeal it. The author deleting their own is a
        different thing and does neither.
      </Note>

      <Tabs
        label="Which topics"
        value={which}
        onChange={(next) => setWhich(next as Which)}
        options={[
          { value: 'all', label: 'Everything' },
          { value: 'live', label: 'Live' },
          { value: 'removed', label: 'Removed' },
          { value: 'locked', label: 'Locked' },
          { value: 'pinned', label: 'Pinned' },
        ]}
      />

      {queue.loading ? <Skeleton className="h-40" />
        : queue.error ? <ErrorState message={queue.error} onRetry={queue.reload} />
        : !queue.data?.length ? (
          <p className="py-10 text-center text-sm text-muted">
            {which === 'removed'
              ? 'Nothing has been taken down.'
              : 'No topics here yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.data.map((one, i) => (
              <li
                key={one.id}
                className="animate-row-in"
                style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
              >
                <TopicLine
                  one={one}
                  onPin={() => act(
                    () => forumSetFlags(one.id, { pinned: !one.is_pinned }),
                    one.is_pinned ? 'Unpinned.' : 'Pinned to its board.',
                  )}
                  onLock={() => act(
                    () => forumSetFlags(one.id, { locked: !one.is_locked }),
                    one.is_locked ? 'Open again.' : 'Locked. Nobody can reply.',
                  )}
                  onRestore={() => act(
                    () => forumRestore('topic', one.id),
                    'Back on its board, and the author has been told.',
                  )}
                  onTakeDown={() => setTaking(one)}
                />
              </li>
            ))}
          </ul>
        )}

      <TakeDown
        one={taking}
        onClose={() => setTaking(null)}
        onDone={() => { setTaking(null); queue.reload() }}
      />
    </div>
  )
}

/* ---------------------------------------------------------------- one row */

/* Exported so `tools/site/staff-queues-preview.tsx` can draw a removed one,
 * a pinned one and a plain one together with no database behind it. */
export function TopicLine({ one, onPin, onLock, onRestore, onTakeDown }: {
  one: ForumTopic
  onPin: () => void
  onLock: () => void
  onRestore: () => void
  onTakeDown: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-3 transition-colors',
        one.is_removed
          ? 'border-rose-500/40 bg-rose-500/[0.06]'
          : 'border-ink-line bg-ink-raised hover:border-white/25',
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="space">{one.category_name}</Badge>
            {one.is_pinned && <Badge tone="brand" icon={faThumbtack}>Pinned</Badge>}
            {one.is_locked && <Badge tone="warm" icon={faLock}>Locked</Badge>}
            {one.is_removed && <Badge tone="danger" icon={faTrashCan}>Removed</Badge>}
            {one.answer_id && <Badge tone="brand" icon={faCircleCheck}>Answered</Badge>}
          </span>

          <p className="mt-1.5 truncate font-bold">{one.title}</p>

          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Avatar
                src={one.author_avatar}
                name={one.author_name}
                personId={one.author_id}
                size="xs"
              />
              {one.author_name}
              <span className="text-white/40">@{one.author_username}</span>
            </span>
            <span className="flex items-center gap-1.5"><Glyph icon={faReply} />{one.reply_count}</span>
            <span className="flex items-center gap-1.5"><Glyph icon={faHeart} />{one.like_count}</span>
            <span className="flex items-center gap-1.5"><Glyph icon={faEye} />{one.view_count}</span>
            <span className="flex items-center gap-1.5">
              <Glyph icon={faClock} />
              {timeAgo(one.last_post_at)}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 flex-wrap items-center gap-2">
          {/* A removed topic has no board to be pinned to, so the only
              thing offered on one is putting it back. */}
          {one.is_removed ? (
            <Button size="sm" variant="ghost" icon={faRotateLeft} onClick={onRestore}>
              Restore
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={faThumbtack}
                onClick={onPin}
              >
                {one.is_pinned ? 'Unpin' : 'Pin'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={one.is_locked ? faLockOpen : faLock}
                onClick={onLock}
              >
                {one.is_locked ? 'Unlock' : 'Lock'}
              </Button>
              <Button size="sm" variant="danger" icon={faTrashCan} onClick={onTakeDown}>
                Remove
              </Button>
            </>
          )}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------ taking one down */

function TakeDown({ one, onClose, onDone }: {
  one: ForumTopic | null
  onClose: () => void
  onDone: () => void
}) {
  const say = useToast()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!one || !reason.trim()) return
    setBusy(true)
    try {
      await takeDownForum('forum_topic', one.id, reason.trim())
      say('Taken down, and the author has been told why.', 'success')
      setReason('')
      onDone()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={!!one}
      onClose={() => { setReason(''); onClose() }}
      title="Take this topic down"
      description={one ? `“${one.title}” by @${one.author_username}` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setReason(''); onClose() }}>
            Leave it up
          </Button>
          <Button
            variant="danger"
            icon={faTrashCan}
            onClick={send}
            disabled={!reason.trim()}
            loading={busy}
          >
            Take it down
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-muted">
          <span className="mt-0.5 text-amber-300"><Glyph icon={faTriangleExclamation} /></span>
          The author reads this word for word, and it is what an appeal
          argues against. Say the thing, not the rule number.
        </p>

        <div className="flex flex-wrap gap-2">
          {REASONS.map((said) => (
            <button
              key={said}
              type="button"
              onClick={() => setReason(said)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                reason === said
                  ? 'border-brand-bright bg-brand/25 text-white'
                  : 'border-ink-line bg-ink-raised text-muted hover:border-white/25',
              )}
            >
              {said}
            </button>
          ))}
        </div>

        <Textarea
          label="Why it came down"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Say why, in a sentence."
        />
      </div>
    </Dialog>
  )
}

/* The glyph the console's rail uses for this panel. */
export const forumPanelIcon = faComments
