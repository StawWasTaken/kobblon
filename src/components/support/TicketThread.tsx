import { useState } from 'react'
import { faPaperPlane, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Note } from '@/components/ui/Note'
import { Confirm } from '@/components/ui/Confirm'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { closeTicket, getTicket, listTicketMessages, replyTicket } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { asset } from '@/lib/asset'
import { timeAgo } from '@/lib/format'
import { lookOf, topics } from '@/pages/Support'
import { cn } from '@/lib/cn'

/**
 * The face Kobblon answers with.
 *
 * The site's own favicon, the same file the browser tab shows - not a
 * drawing of it. Staw: "just use the favicon we're using for the website but
 * as the pfp (like same image)". A second mark drawn to look like the first
 * is a second mark to keep in step, and it was already out of step.
 */
export function KobblonFace({ className }: { className?: string }) {
  return (
    <img
      src={asset('/brand/favicon.png')}
      alt=""
      aria-hidden="true"
      className={cn('h-9 w-9 shrink-0 rounded-xl', className)}
    />
  )
}

/**
 * One ticket, both sides of it, in a popup card.
 *
 * It was a page of its own at `/support/:id`. A conversation with support is
 * something you glance at and close, not somewhere you navigate to and have
 * to find your way back from - so it opens over the list and the list is
 * still there behind it. The address still works, because a link in an email
 * has to land somewhere: `/support/:id` opens the list with this card on top
 * of it.
 */
export function TicketThread({
  number,
  onClose,
  onChanged,
}: {
  number: number
  onClose: () => void
  onChanged?: () => void
}) {
  const { profile } = useAuth()
  const toast = useToast()

  const ticket = useAsync(async () => (number ? getTicket(number) : null), [number])
  const thread = useAsync(async () => (number ? listTicketMessages(number) : []), [number])

  const [words, setWords] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)

  const send = async () => {
    setSending(true)
    try {
      /* As themselves. This is the person's own help page, and a moderator
         reading their own ticket here is a person, not the house. */
      await replyTicket(number, words.trim(), false)
      setWords('')
      thread.reload()
      ticket.reload()
      onChanged?.()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not send.', 'error')
    } finally {
      setSending(false)
    }
  }

  const close = async () => {
    try {
      await closeTicket(number)
      toast('Closed. You can always write again.', 'info')
      ticket.reload()
      onChanged?.()
      setClosing(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  const one = ticket.data
  const look = lookOf(one?.status ?? '')
  const shut = one?.status === 'closed'
  const topic = topics.find((t) => t.value === one?.topic)?.label ?? 'Support'

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        size="lg"
        title={one?.subject ?? 'Ticket'}
        description={one ? `${topic} · opened ${timeAgo(one.created_at)}` : undefined}
        footer={
          one && !shut ? (
            <>
              <Button size="sm" variant="ghost" icon={faCheck} onClick={() => setClosing(true)}>
                This is sorted
              </Button>
              <Button
                icon={faPaperPlane}
                onClick={send}
                loading={sending}
                disabled={!words.trim()}
              >
                Send
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>Close</Button>
          )
        }
      >
        {ticket.loading && <Skeleton className="h-40 rounded-2xl" />}
        {ticket.error && <ErrorState message={ticket.error} onRetry={ticket.reload} />}

        {!ticket.loading && !ticket.error && !one && (
          <EmptyState
            mood="noResults"
            title="No ticket here"
            body="There is no ticket of yours with that number."
          />
        )}

        {one && (
          <div className="space-y-4">
            {/* Where it stands, said once, at the top. */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide',
                  look.look,
                )}
              >
                {look.word}
              </span>
              <span className="text-xs text-muted">Last moved {timeAgo(one.updated_at)}</span>
            </div>

            <div className="space-y-3">
              {thread.loading && <Skeleton className="h-24 rounded-2xl" />}
              {thread.error && <ErrorState message={thread.error} onRetry={thread.reload} />}

              {thread.data?.map((message) => (
                <Card
                  key={message.id}
                  className={cn(
                    'flex gap-4 p-4',
                    message.from_staff && 'border-brand-bright/30 bg-brand/[0.07]',
                  )}
                >
                  <span className="shrink-0">
                    {message.from_staff ? (
                      <KobblonFace />
                    ) : (
                      <Avatar
                        src={avatarOf(profile)}
                        personId={profile?.id}
                        name={profile?.display_name ?? 'You'}
                        size="sm"
                        className="rounded-xl"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">
                        {message.from_staff ? 'Kobblon' : 'You'}
                      </span>
                      <span className="ml-auto text-xs text-muted">
                        {timeAgo(message.created_at)}
                      </span>
                    </span>
                    <span className="mt-1.5 block whitespace-pre-wrap leading-relaxed text-white/75">
                      {message.body}
                    </span>
                  </span>
                </Card>
              ))}
            </div>

            {shut ? (
              <Note>This ticket is closed. Open a new one if it comes back.</Note>
            ) : (
              <textarea
                value={words}
                onChange={(e) => setWords(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Write back"
                aria-label="Write back"
                className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
              />
            )}
          </div>
        )}
      </Dialog>

      <Confirm
        open={closing}
        onClose={() => setClosing(false)}
        onConfirm={close}
        title="Close this ticket?"
        lead="It leaves our queue. You can open a new one whenever you like."
        confirmText="Close it"
      />
    </>
  )
}
