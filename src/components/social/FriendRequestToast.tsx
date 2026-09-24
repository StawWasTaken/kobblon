import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserPlus, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { Verified, isVerified } from '@/components/brand/Verified'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { respondToFriendRequest } from '@/lib/api'
import { profileLink } from '@/lib/links'
import { cn } from '@/lib/cn'

/*
 * A friend request, arriving while somebody is doing something else.
 *
 * This is the card the Launcher shows in a World, drawn here so that the
 * one in a World and the one on the website are the same card rather than
 * two people's idea of one. Copy it; do not redraw it.
 *
 * The shape is fixed: who it is on the left, what happened beside them, and
 * the two answers along the bottom where a thumb or a cursor already is.
 * Accept is the brand blue, not the green -- the green means Play and
 * means nothing else.
 */

export type Asking = {
  request_id: string
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_admin: boolean
  sent_at: string
}

export function FriendRequestCard({
  asking, onAnswered, onDismiss,
}: {
  asking: Asking
  onAnswered: (accepted: boolean) => void
  onDismiss: () => void
}) {
  const [busy, setBusy] = useState(false)

  const answer = async (accept: boolean) => {
    setBusy(true)
    try {
      await respondToFriendRequest(asking.request_id, accept)
      onAnswered(accept)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className={cn(
        'w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-ink-line bg-ink-card',
        'shadow-pop animate-slide-up',
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <Link to={profileLink(asking)} onClick={onDismiss} className="shrink-0">
          <PersonAvatar person={asking} size="lg" square />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-display text-base font-extrabold">
            {asking.display_name}
            {isVerified(asking) && <Verified className="text-[11px]" />}
          </p>
          {/* Not truncated: the sentence is the whole point of the card. */}
          <p className="flex items-center gap-1.5 text-sm leading-snug text-muted">
            <FontAwesomeIcon icon={faUserPlus} className="shrink-0 text-xs" />
            Sent you a friend request
          </p>
        </div>

        <button
          onClick={onDismiss}
          aria-label="Later"
          className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-lg text-white/35 transition-colors hover:bg-white/10 hover:text-white"
        >
          <FontAwesomeIcon icon={faXmark} className="text-xs" />
        </button>
      </div>

      {/*
        * Two answers, side by side and the same width, because neither is
        * the one somebody is being pushed towards.
        */}
      <div className="grid grid-cols-2 border-t border-ink-line">
        <button
          onClick={() => void answer(false)}
          disabled={busy}
          className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          <FontAwesomeIcon icon={faXmark} className="text-xs" />
          Decline
        </button>
        <button
          onClick={() => void answer(true)}
          disabled={busy}
          className="flex items-center justify-center gap-2 border-l border-ink-line bg-brand py-3 text-sm font-bold text-onbrand transition-colors hover:bg-brand-bright disabled:opacity-40"
        >
          <FontAwesomeIcon icon={faCheck} className="text-xs" />
          Accept
        </button>
      </div>
    </article>
  )
}

/**
 * Watches for one arriving and puts the card up.
 *
 * The row realtime hands over is two ids and a status, which is not enough
 * to draw anybody, so `request_from` fetches the name and the picture. That
 * call refuses a request that was not sent to you, so nothing here has to
 * check.
 */
export function FriendRequestWatcher() {
  const { profile } = useAuth()
  const toast = useToast()
  const [queue, setQueue] = useState<Asking[]>([])

  useEffect(() => {
    if (!profile) return
    let live = true

    const channel = supabase
      .channel(`requests:${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${profile.id}`,
      }, async (payload) => {
        const row = payload.new as { id: string; status: string }
        if (row.status !== 'pending') return

        const { data } = await supabase.rpc('request_from', { which: row.id })
        const asking = (data as Asking[] | null)?.[0]
        // Two of the same person cannot stack up on top of each other.
        if (live && asking) {
          setQueue((all) => (all.some((one) => one.request_id === asking.request_id)
            ? all
            : [...all, asking]))
        }
      })
      .subscribe()

    return () => {
      live = false
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  if (!queue.length) return null

  const drop = (id: string) => setQueue((all) => all.filter((one) => one.request_id !== id))

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-3 sm:left-auto sm:right-4 sm:translate-x-0">
      {queue.map((asking) => (
        <div key={asking.request_id} className="pointer-events-auto">
          <FriendRequestCard
            asking={asking}
            onDismiss={() => drop(asking.request_id)}
            onAnswered={(accepted) => {
              drop(asking.request_id)
              toast(accepted
                ? `You and ${asking.display_name} are friends.`
                : 'Declined.')
            }}
          />
        </div>
      ))}
    </div>
  )
}
