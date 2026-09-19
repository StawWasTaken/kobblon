import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane, faComments } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/States'
import { useAuth } from '@/hooks/useAuth'
import { listSpaceMessages, sendSpaceMessage } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import type { Space, SpaceMessage } from '@/types/db'
import { avatarOf } from '@/lib/avatars'
import { Verified } from '@/components/brand/Verified'

/**
 * The chat that comes with every Space. The owner decides whether it is on,
 * what it greets people with, and how fast they can talk; the filter decides
 * what actually gets through.
 */
export function SpaceChat({ space }: { space: Space }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<SpaceMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    listSpaceMessages(space.id)
      .then((rows) => active && setMessages(rows))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [space.id])

  useEffect(() => {
    const channel = supabase
      .channel(`world-chat:${space.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT', schema: 'public', table: 'space_messages',
          filter: `space_id=eq.${space.id}`,
        },
        async () => setMessages(await listSpaceMessages(space.id)))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [space.id])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  if (!space.chat_enabled) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-card px-4 py-6 text-sm text-muted">
        <FontAwesomeIcon icon={faComments} className="text-white/25" />
        Chat is turned off in this Space.
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !profile) return
    setSending(true)
    setError(null)
    try {
      await sendSpaceMessage(space.id, profile.id, body)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That message did not send.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-96 flex-col overflow-hidden rounded-xl border border-ink-line bg-ink-card">
      <header className="flex items-center gap-2 border-b border-ink-line px-4 py-3">
        <h3 className="text-sm font-extrabold">Space Chat</h3>
        {space.chat_slowmode_seconds > 0 && (
          <span className="text-xs text-muted">
            Slow mode: {space.chat_slowmode_seconds}s
          </span>
        )}
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3 kob-scroll">
        {space.chat_greeting && (
          <p className="rounded-lg border border-brand/40 bg-brand/15 px-3 py-2 text-sm text-[#b9c3ff]">
            {space.chat_greeting}
          </p>
        )}

        {loading && [0, 1].map((i) => <Skeleton key={i} className="h-8 w-2/3" />)}

        {!loading && !messages.length && (
          <p className="py-6 text-center text-sm text-muted">Nobody has said anything yet.</p>
        )}

        {messages.map((message) => (
          <div key={message.id} className="flex gap-2.5">
            <Avatar
              src={avatarOf(message.sender)}
              name={message.sender?.display_name ?? 'K'}
              size="xs"
              className="mt-0.5"
            />
            <p className="min-w-0 flex-1 text-sm leading-snug">
              <Link
                to={`/u/${message.sender?.username ?? ''}`}
                className="font-bold text-link hover:underline"
              >
                {message.sender?.display_name ?? 'Someone'}
              </Link>
              {message.sender?.is_admin && (
                <Verified className="ml-1 text-xs" />
              )}
              <span className="text-white/40"> · </span>
              <span className="whitespace-pre-wrap break-words text-white/80">{message.body}</span>
            </p>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="border-t border-ink-line p-2">
        {error && <p className="px-1 pb-2 text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="space-chat-draft">Message this Space</label>
          <input
            id="space-chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            disabled={!profile}
            placeholder={profile ? 'Say something' : 'Log in to chat'}
            className={cn(
              'h-9 min-w-0 flex-1 rounded-lg border border-ink-line bg-ink-raised px-3 text-sm',
              'placeholder:text-white/30 focus:border-brand-bright disabled:opacity-60',
            )}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-bright disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="text-xs" />
          </button>
        </div>
      </form>
    </div>
  )
}
