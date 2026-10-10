/*
 * The support queue.
 *
 * Tickets have been writable since 0072 and readable by a moderator the
 * whole time, and there has never been a screen that reads them. People
 * have been writing in and nobody was shown it arrived. 0206 put
 * `wants_human` on a ticket - "i want my ticket to be reviewed by a
 * human" - which puts it at the front of a queue that did not exist.
 * This is the queue.
 *
 * It is ordered the way the database orders it (`ticket_queue`, 0212):
 * anything marked for a person first, then whoever has waited longest.
 * The page does not sort it and does not filter it - a queue a browser
 * reorders is a queue two moderators see differently.
 *
 * Opening one is a drawer rather than a dialog on purpose: a ticket is a
 * conversation, it is long, and covering the queue with it means losing
 * your place every time you look at something.
 */
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt, faLifeRing, faClock, faCircleCheck, faPaperPlane, faArrowUp,
  faEnvelope, faDesktop, faMobileScreen, faTabletScreenButton, faGamepad,
  faRocket, faCircleQuestion, faUser, faHourglassHalf, faInbox,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Drawer } from '@/components/ui/Drawer'
import { StatTile } from '@/components/ui/StatTile'
import { Tabs } from '@/components/ui/Tabs'
import { Skeleton, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import {
  ticketQueue, ticketCounts, setTicketStatus, listTicketMessages, replyTicket,
} from '@/lib/api'
import type { TicketRow } from '@/lib/api'
import type { TicketStatus, TicketMessage } from '@/types/db'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

const deviceIcon: Record<string, IconDefinition> = {
  computer: faDesktop,
  phone: faMobileScreen,
  tablet: faTabletScreenButton,
  console: faGamepad,
  launcher: faRocket,
  other: faCircleQuestion,
}

const statusLook: Record<TicketStatus, { word: string; tone: 'brand' | 'warm' | 'space' | 'neutral' }> = {
  open: { word: 'Open', tone: 'brand' },
  in_progress: { word: 'Being looked at', tone: 'brand' },
  answered: { word: 'Replied', tone: 'space' },
  escalated: { word: 'Passed up', tone: 'warm' },
  closed: { word: 'Closed', tone: 'neutral' },
}

const topicWord: Record<string, string> = {
  account: 'Account', money: 'Brix and money', safety: 'Safety', bug: 'Something broken',
  creator: 'Making things', privacy: 'Privacy', other: 'Something else',
}

export function SupportQueue() {
  const say = useToast()
  const [which, setWhich] = useState<'open' | 'urgent' | 'closed' | 'all'>('open')
  const [open, setOpen] = useState<TicketRow | null>(null)

  const queue = useAsync(async () => ticketQueue(which), [which])
  const counts = useAsync(async () => ticketCounts(), [])

  const after = () => { queue.reload(); counts.reload() }

  const move = async (ticket: number, status: TicketStatus, said: string) => {
    try {
      await setTicketStatus(ticket, status)
      say(said, 'success')
      setOpen((one) => (one && one.id === ticket ? { ...one, status } : one))
      after()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    }
  }

  const sums = counts.data

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        What people have written in about. Anything marked{' '}
        <span className="font-bold text-amber-300">urgent</span> asked for a person
        rather than waiting their turn, so it sits at the top. Nothing automated answers
        these — every one of them is read by whoever opens this panel.
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        <StatTile icon={faInbox} value={sums?.open_now ?? null} label="Still open" />
        <StatTile
          icon={faBolt}
          value={sums?.urgent ?? null}
          label="Asked for a person"
          className={sums?.urgent ? 'border-amber-400/40 bg-amber-400/[0.07]' : undefined}
        />
        <StatTile icon={faHourglassHalf} value={sums?.waiting ?? null} label="Waiting on us" />
        <StatTile icon={faCircleCheck} value={sums?.closed_today ?? null} label="Closed today" />
      </div>

      <Tabs
        label="Which tickets"
        value={which}
        onChange={(next) => setWhich(next as typeof which)}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'urgent', label: 'Urgent' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'Everything' },
        ]}
      />

      {queue.loading ? <Skeleton className="h-40" />
        : queue.error ? <ErrorState message={queue.error} onRetry={queue.reload} />
        : !queue.data?.length ? (
          <p className="py-10 text-center text-sm text-muted">
            Nothing here. {which === 'open' ? 'Every ticket has been answered.' : ''}
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.data.map((one, i) => (
              <li
                key={one.id}
                className="animate-row-in"
                /*
                 * Staggered by hand rather than by a library: the delay is
                 * the only thing an animation library would be doing here,
                 * and it is capped so a queue of eighty does not take four
                 * seconds to finish arriving.
                 */
                style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}
              >
                <TicketLine one={one} onOpen={() => setOpen(one)} />
              </li>
            ))}
          </ul>
        )}

      {open && (
        <TicketDrawer
          one={open}
          onClose={() => setOpen(null)}
          onMove={move}
          onReplied={after}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------- one row */

export function TicketLine({ one, onOpen }: { one: TicketRow; onOpen: () => void }) {
  const look = statusLook[one.status]

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 text-left transition-colors',
        one.wants_human && one.status !== 'closed'
          ? 'border-amber-400/40 bg-amber-400/[0.06] hover:border-amber-400/70'
          : 'border-ink-line bg-ink-raised hover:border-white/25',
      )}
    >
      {one.wants_human && one.status !== 'closed' && (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-200 shadow-[0_0_18px_-4px_rgba(251,191,36,0.6)]">
          <FontAwesomeIcon icon={faBolt} />
          Urgent
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold">{one.subject}</span>
          <Badge tone={look.tone}>{look.word}</Badge>
          {one.waiting_on_us && one.status !== 'closed' && (
            <Badge tone="warm">Waiting on us</Badge>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faUser} />
            {one.first_name ?? one.username ?? 'somebody'}
            {one.username && <span className="text-white/40">@{one.username}</span>}
          </span>
          <span>{topicWord[one.topic] ?? one.topic}</span>
          {one.device && (
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={deviceIcon[one.device] ?? faCircleQuestion} />
              {one.device}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faClock} />
            {timeAgo(one.updated_at)}
          </span>
          {one.replies > 1 && <span>{one.replies} messages</span>}
        </span>
        {one.opener && (
          <span className="mt-1 block truncate text-xs text-white/55">{one.opener}</span>
        )}
      </span>
    </button>
  )
}

/* ----------------------------------------------------------- one ticket */

export function TicketDrawer({ one, onClose, onMove, onReplied }: {
  one: TicketRow
  onClose: () => void
  onMove: (ticket: number, status: TicketStatus, said: string) => Promise<void>
  onReplied: () => void
}) {
  const say = useToast()
  const [words, setWords] = useState('')
  const [sending, setSending] = useState(false)
  const talk = useAsync(async () => listTicketMessages(one.id), [one.id])

  const send = async () => {
    const body = words.trim()
    if (body.length < 2) return
    setSending(true)
    try {
      await replyTicket(one.id, body)
      say('Sent. They get it by letter as well.', 'success')
      setWords('')
      talk.reload()
      onReplied()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not send.', 'error')
    } finally {
      setSending(false)
    }
  }

  const look = statusLook[one.status]

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={one.subject}
      badge={
        <>
          <Badge tone={look.tone}>{look.word}</Badge>
          {one.wants_human && (
            <Badge tone="warm" icon={faBolt}>Asked for a person</Badge>
          )}
        </>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>#{one.id}</span>
          <span>{topicWord[one.topic] ?? one.topic}</span>
          <span>opened {timeAgo(one.created_at)}</span>
        </span>
      }
      footer={
        <>
          <Button
            size="sm"
            variant="subtle"
            icon={faLifeRing}
            onClick={() => onMove(one.id, 'in_progress', 'Marked as being looked at.')}
            disabled={one.status === 'in_progress'}
          >
            I am on this
          </Button>
          <Button
            size="sm"
            variant="subtle"
            icon={faArrowUp}
            onClick={() => onMove(one.id, 'escalated', 'Passed up.')}
            disabled={one.status === 'escalated'}
          >
            Pass it up
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={faCircleCheck}
            className="ml-auto"
            onClick={() => onMove(one.id, 'closed', 'Closed.')}
            disabled={one.status === 'closed'}
          >
            Close it
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ------------------------------------------------- who wrote it */}
        <Card className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          <Fact label="Who" icon={faUser}>
            {one.first_name ?? '—'}
            {one.username && <span className="text-muted"> · @{one.username}</span>}
          </Fact>
          <Fact label="Write back to" icon={faEnvelope}>
            {one.contact_email ?? <span className="text-muted">They left none</span>}
          </Fact>
          <Fact label="What they were on" icon={deviceIcon[one.device ?? 'other'] ?? faCircleQuestion}>
            {one.device ?? <span className="text-muted">Not said</span>}
          </Fact>
          <Fact label="Last moved" icon={faClock}>{timeAgo(one.updated_at)}</Fact>
        </Card>

        {/* ------------------------------------------------ the conversation */}
        {talk.loading ? <Skeleton className="h-32" />
          : talk.error ? (
            /*
             * Said rather than spun. A failed fetch left as a skeleton is a
             * drawer that looks like it is still loading for ever, and the
             * one thing a moderator needs to know is that they are not
             * looking at the whole conversation.
             */
            <ErrorState message={talk.error} onRetry={talk.reload} />
          ) : (
          <ul className="space-y-2">
            {(talk.data ?? []).map((m: TicketMessage) => (
              <li
                key={m.id}
                className={cn(
                  'rounded-2xl border px-4 py-3',
                  m.from_staff
                    ? 'border-brand/35 bg-brand/10'
                    : 'border-ink-line bg-ink-raised',
                )}
              >
                <p className="mb-1 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted">
                  {m.from_staff ? 'Kobblon' : (one.first_name ?? one.username ?? 'Them')}
                  <span className="font-normal normal-case tracking-normal">
                    {timeAgo(m.created_at)}
                  </span>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                  {m.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* ------------------------------------------------------- writing back */}
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-muted">
              Write back
            </span>
            <textarea
              value={words}
              onChange={(e) => setWords(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="They see this exactly as you write it, and get it as a letter too."
              className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
            />
          </label>
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 text-xs text-muted">
              Replying marks the ticket as answered.
            </p>
            <Button
              size="sm"
              icon={faPaperPlane}
              loading={sending}
              disabled={words.trim().length < 2}
              onClick={send}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

function Fact({ label, icon, children }: {
  label: string
  icon: IconDefinition
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted">
        <FontAwesomeIcon icon={icon} />
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold">{children}</p>
    </div>
  )
}
