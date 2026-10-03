import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { faHeadset, faPaperPlane, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { Logomark } from '@/components/brand/Wordmark'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { closeTicket, getTicket, listTicketMessages, replyTicket } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { timeAgo } from '@/lib/format'
import { statusLook, topics } from '@/pages/Support'
import { cn } from '@/lib/cn'

/*
 * One ticket, both sides of it.
 *
 * Kobblon's side is drawn as Kobblon rather than as whichever moderator
 * happened to answer: support speaks for the platform, and putting a name and
 * a face on a moderation reply is how moderators get followed around.
 */
export default function SupportTicket() {
  const { id = '' } = useParams()
  const number = Number(id)
  const { profile } = useAuth()
  const toast = useToast()

  const ticket = useAsync(async () => (number ? getTicket(number) : null), [number])
  const thread = useAsync(async () => (number ? listTicketMessages(number) : []), [number])

  const [words, setWords] = useState('')
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)

  useTitle(ticket.data?.subject ?? 'Ticket')

  const send = async () => {
    setSending(true)
    try {
      await replyTicket(number, words.trim())
      setWords('')
      thread.reload()
      ticket.reload()
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
      setClosing(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  if (ticket.loading) {
    return <Page width="narrow"><Skeleton className="h-64 rounded-2xl" /></Page>
  }

  if (ticket.error) {
    return <Page width="narrow"><ErrorState message={ticket.error} onRetry={ticket.reload} /></Page>
  }

  if (!ticket.data) {
    return (
      <Page width="narrow">
        <Card>
          <EmptyState
            mood="noResults"
            title="No ticket here"
            body="There is no ticket of yours with that number."
            action={<Button to="/support">Your tickets</Button>}
          />
        </Card>
      </Page>
    )
  }

  const one = ticket.data
  const look = statusLook[one.status]
  const shut = one.status === 'closed'

  return (
    <Page width="narrow" className="space-y-5">
      <PageHeader
        kicker={topics.find((t) => t.value === one.topic)?.label ?? 'Support'}
        icon={faHeadset}
        title={one.subject}
        lead={`Opened ${timeAgo(one.created_at)}.`}
        actions={
          <>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide',
                look.look,
              )}
            >
              {look.word}
            </span>
            {!shut && (
              <Button size="sm" variant="ghost" icon={faCheck} onClick={() => setClosing(true)}>
                This is sorted
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-3">
        {thread.loading && <Skeleton className="h-24 rounded-2xl" />}
        {thread.error && <ErrorState message={thread.error} onRetry={thread.reload} />}

        {thread.data?.map((message) => (
          <Card
            key={message.id}
            className={cn(
              'flex gap-4 p-5',
              message.from_staff && 'border-brand-bright/30 bg-brand/[0.07]',
            )}
          >
            <span className="shrink-0">
              {message.from_staff ? (
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-ink-line bg-ink-raised">
                  <Logomark className="h-5 w-5" />
                </span>
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
                <span className="ml-auto text-xs text-muted">{timeAgo(message.created_at)}</span>
              </span>
              <span className="mt-1.5 block whitespace-pre-wrap leading-relaxed text-white/75">
                {message.body}
              </span>
            </span>
          </Card>
        ))}
      </div>

      {shut ? (
        <Card className="p-5 text-sm leading-relaxed text-muted">
          This ticket is closed. If it comes back, open a new one and say it is about this
          ticket.
        </Card>
      ) : (
        <Card className="space-y-3 p-5">
          <textarea
            value={words}
            onChange={(e) => setWords(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Write back"
            aria-label="Write back"
            className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
          />
          <div className="flex justify-end">
            <Button
              icon={faPaperPlane}
              onClick={send}
              loading={sending}
              disabled={!words.trim()}
            >
              Send
            </Button>
          </div>
        </Card>
      )}

      <Confirm
        open={closing}
        onClose={() => setClosing(false)}
        onConfirm={close}
        title="Close this ticket?"
        lead="It stops being on our queue. You can open a new one whenever you like."
        confirmText="Close it"
      />
    </Page>
  )
}
