import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faHeadset, faPlus, faScaleBalanced, faScroll, faArrowRight, faCircleInfo,
  faDesktop, faMobileScreen, faTabletScreenButton, faGamepad, faRocket,
  faCircleQuestion, faCheck, faUser, faEnvelope,
  faBolt, faArrowLeft, faPaperPlane,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { Panel, Group, Line, PageTop } from '@/components/settings/Panel'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { GuestGate } from '@/components/ui/GuestGate'
import { Tickbox } from '@/components/ui/Tickbox'
import { Tiles } from '@/components/ui/Tiles'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, AT_KOBBLON } from '@/hooks/useTitle'
import { listTickets, openTicket } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TicketThread } from '@/components/support/TicketThread'
import type { Ticket, TicketDevice, TicketTopic } from '@/types/db'

/*
 * Writing to Kobblon.
 *
 * Staw showed me Roblox's Contact Us form and said "that is just a ticket
 * card thing". So it is one card, read top to bottom, in their order: who you
 * are, what you were on, what it is about, then what happened. Not a popup
 * with two fields in it, which is what this was.
 *
 * Three of those are already known for a signed-in person, so the card fills
 * them in and says so rather than making anybody type their own username
 * back at us. The email is the one that matters and the one Roblox asks
 * twice: when the account itself is the problem, it is the only way back.
 *
 * A ticket is a row and a reply is a row, so nothing said here disappears
 * into an address nobody reads. The reply also lands in the inbox, because a
 * person who wrote in about their account should not have to remember to come
 * back and check.
 */

/*
 * `label` is what a ticket in the list is called; `short` is what fits in a
 * tile. Two words rather than one truncated one, because "Something i…" in a
 * row of six tiles is a guess somebody has to make.
 */
export const topics: {
  value: TicketTopic; label: string; short: string; note: string; icon: IconDefinition
}[] = [
  { value: 'account', short: 'Account', label: 'My account', note: 'Signing in, names, email, deleting it.', icon: faUser },
  { value: 'money', short: 'Money', label: 'Money', note: 'A balance, a purchase, a movement that looks wrong.', icon: faCircleInfo },
  { value: 'safety', short: 'Safety', label: 'Safety', note: 'Somebody is a problem, or something needs looking at.', icon: faScaleBalanced },
  { value: 'bug', short: 'Broken', label: 'Something is broken', note: 'It does not work the way it should.', icon: faCircleQuestion },
  { value: 'creator', short: 'Creator', label: 'Creator', note: 'Uploads, selling, verification, your work elsewhere.', icon: faRocket },
  { value: 'privacy', short: 'Privacy', label: 'Privacy', note: 'What is held about you, and getting it removed.', icon: faScroll },
  { value: 'other', short: 'Other', label: 'Something else', note: 'Anything the list above does not cover.', icon: faHeadset },
]

const devices: { value: TicketDevice; label: string; icon: IconDefinition }[] = [
  { value: 'computer', label: 'Computer', icon: faDesktop },
  { value: 'launcher', label: 'Launcher', icon: faRocket },
  { value: 'phone', label: 'Phone', icon: faMobileScreen },
  { value: 'tablet', label: 'Tablet', icon: faTabletScreenButton },
  { value: 'console', label: 'Console', icon: faGamepad },
  { value: 'other', label: 'Other', icon: faCircleQuestion },
]

export const statusLook: Record<Ticket['status'], { word: string; look: string }> = {
  open: { word: 'Waiting on us', look: 'border-brand-bright/50 bg-brand/20 text-white' },
  in_progress: { word: 'Being looked at', look: 'border-brand-bright/40 bg-brand/10 text-white/80' },
  escalated: { word: 'Passed up', look: 'border-amber-400/50 bg-amber-400/10 text-amber-200' },
  answered: { word: 'Replied', look: 'border-space/40 bg-space/10 text-space-bright' },
  closed: { word: 'Closed', look: 'border-white/15 bg-white/[0.06] text-white/55' },
}

/**
 * The badge for a status, for any status.
 *
 * `statusLook[status]` was read straight, and a status the map has not heard
 * of is `undefined` - so `look.look` threw and the whole page would not draw.
 * That is not hypothetical: 0212 widened the server's statuses to include
 * `in_progress` and `escalated`, and a browser holding an older bundle reads
 * them the moment a staff member touches a ticket. A word nobody recognises
 * belongs in a neutral chip, not in a blank page.
 */
export const lookOf = (status: string) =>
  statusLook[status as Ticket['status']] ?? {
    word: String(status || 'Unknown').replace(/_/g, ' '),
    look: 'border-white/15 bg-white/[0.06] text-white/55',
  }

/** An email, loosely. The server checks it too, and neither check is proof. */
const looksLikeEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim())

/* The picker both this card and the report card use. Re-exported because
   the Workspace imports it from here, and moving a file should not be a
   round's worth of breakage on the other side. */
export { Tiles } from '@/components/ui/Tiles'

/* --------------------------------------------------------- the four steps */

/**
 * The names on the progress strip, in order. Short enough that four of them
 * fit across a phone, which is the only constraint on them.
 */
const STEP_NAMES = ['About', 'What happened', 'Device', 'You'] as const

/**
 * The strip across the top of the card: where you are, where you have been,
 * and how much is left.
 *
 * It is pressable, and that is the point of drawing it rather than printing
 * "Step 2 of 4". Going back is the thing somebody actually wants from a form
 * - to change the one answer they got wrong - and a Back button only reaches
 * the step behind. Forward is allowed only where everything before it is
 * answered, so the strip never promises a step the form will refuse to take.
 */
function Progress({ at, done, go }: {
  at: number
  done: boolean[]
  go: (i: number) => void
}) {
  return (
    <ol className="flex gap-1.5">
      {STEP_NAMES.map((name, i) => {
        const here = i === at
        const reachable = i <= at || done.slice(0, i).every(Boolean)
        return (
          <li key={name} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => go(i)}
              aria-current={here ? 'step' : undefined}
              className="w-full text-left disabled:cursor-default"
            >
              <span
                className={cn(
                  'block h-1 rounded-full transition-colors',
                  here ? 'bg-brand-bright' : done[i] ? 'bg-space' : 'bg-white/15',
                )}
              />
              <span
                className={cn(
                  'mt-1.5 flex items-center gap-1 truncate text-[11px] font-extrabold uppercase tracking-wide',
                  here ? 'text-white' : done[i] ? 'text-space-bright' : 'text-white/35',
                )}
              >
                {done[i] && !here && <Glyph icon={faCheck} className="text-[9px]" />}
                <span className="truncate">{name}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The card itself, as a popup.
 *
 * Staw: "i also want a proper redesign of the Contact us popup card". What
 * was wrong with it was not the paint. All four steps were on screen at once
 * inside a box that scrolls at 70vh, so the form was a column about two and a
 * half phone screens long with a numbered rail down the side of it counting
 * steps nobody was being walked through. A stepper that shows every step is
 * a long form wearing a stepper's clothes.
 *
 * So it is one step at a time, and the four ticks at the top are now worth
 * something: they are where you are, and they are how you get back to the
 * answer you want to change.
 *
 * The order changed with it. It used to open on "who you are", which is the
 * one part Kobblon already knows and the one part that is optional - a person
 * who clicked Contact us was met by a form asking for their email twice
 * before it asked what was wrong. Now it opens on what it is about and ends
 * on how to reach you, which is also the order the ticket is read in.
 *
 * It is its own component so it can be mounted on its own under
 * `tools/site/` and looked at - and it takes no provider it cannot be given:
 * the username is a prop rather than a `useAuth` call, which is the mistake
 * that has taken a Workspace panel down three times.
 */
export function TicketCard({ open, username, onClose, onSend, sending }: {
  open: boolean
  username?: string | null
  onClose: () => void
  onSend: (card: {
    topic: TicketTopic
    subject: string
    body: string
    contact_email: string | null
    first_name: string | null
    device: TicketDevice
    wants_human: boolean
  }) => void
  sending?: boolean
}) {
  const [at, setAt] = useState(0)
  /* How far anybody has actually got. The last step is optional, so without
     this it ticks itself green before it has been seen - a form congratulating
     somebody for answering a question it never asked. */
  const [furthest, setFurthest] = useState(0)
  const go = (i: number) => { setAt(i); setFurthest((f) => Math.max(f, i)) }
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [again, setAgain] = useState('')
  const [device, setDevice] = useState<TicketDevice | null>(null)
  const [topic, setTopic] = useState<TicketTopic | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [wantsHuman, setWantsHuman] = useState(false)

  const emailGiven = email.trim().length > 0
  const emailOk = !emailGiven || (looksLikeEmail(email) && email.trim() === again.trim())
  const said = subject.trim().length >= 3 && body.trim().length >= 10

  /* One per step, in the strip's order. `ready` is all four. */
  const done = [!!topic, said, !!device, emailOk && furthest >= 3]
  const ready = done.every(Boolean)
  const last = at === STEP_NAMES.length - 1

  /*
   * What the footer says when the step is not finished. It names the thing
   * that is missing rather than printing "required": a person who has typed
   * a subject and no description should be told which half is short, not
   * that the form is unhappy with them in general.
   */
  const wrongEmail = at === 3 && emailGiven && !emailOk
  const missing = [
    'Pick the one that fits best.',
    subject.trim().length < 3
      ? 'A line saying what it is about.'
      : 'A few more words about what happened.',
    'Pick what you were on.',
    emailGiven && !looksLikeEmail(email)
      ? 'That does not look like an email address.'
      : 'The two emails do not match.',
  ][at]

  const topicHere = topics.find((one) => one.value === topic)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Contact us"
      size="lg"
      head={
        <div className="space-y-3.5 bg-ink-raised px-5 py-4">
          <div className="pr-10">
            <h2 className="font-display text-xl font-extrabold leading-none">Contact us</h2>
            <p className="mt-1.5 text-sm text-muted">
              {[
                'What is this about?',
                'Tell us what happened.',
                'What were you using at the time?',
                'How we reach you, if we need to.',
              ][at]}
            </p>
          </div>
          <Progress at={at} done={done} go={go} />
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          <p className={cn(
            /* Above the buttons on a phone, beside them on a desktop. Under
               them, the sentence that says what is missing is the last thing
               on the card and the first thing a thumb covers. */
            'order-first w-full min-w-0 text-sm sm:order-none sm:w-auto sm:flex-1',
            /* A prompt is not an error. Amber is kept for the one thing on
               this form that can actually be wrong rather than unanswered:
               an email that does not parse, or two that do not match. */
            wrongEmail ? 'text-amber-300' : 'text-muted',
          )}>
            {done[at]
              ? last
                ? ready ? 'That is everything. Send it.' : 'Finish the ticked steps above.'
                : 'Looks good.'
              : missing}
          </p>

          <Button
            variant="ghost"
            icon={faArrowLeft}
            onClick={() => (at === 0 ? onClose() : setAt(at - 1))}
          >
            {at === 0 ? 'Cancel' : 'Back'}
          </Button>

          {last ? (
            <Button
              icon={faPaperPlane}
              loading={sending}
              disabled={!ready}
              onClick={() => {
                if (!topic || !device) return
                onSend({
                  topic,
                  subject: subject.trim(),
                  body: body.trim(),
                  contact_email: emailGiven ? email.trim() : null,
                  first_name: firstName.trim() || null,
                  device,
                  wants_human: wantsHuman,
                })
              }}
            >
              Send ticket
            </Button>
          ) : (
            <Button icon={faArrowRight} disabled={!done[at]} onClick={() => go(at + 1)}>
              Next
            </Button>
          )}
        </div>
      }
    >
      {at === 0 && (
        <div className="space-y-3">
          <Tiles
            label="What it is about"
            value={topic}
            onChange={(value) => { setTopic(value); go(1) }}
            options={topics.map((one) => ({
              value: one.value, label: one.short, icon: one.icon,
            }))}
          />
          {topicHere && (
            <p className="flex items-start gap-2.5 rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
              <Glyph icon={topicHere.icon} className="mt-0.5 shrink-0 text-sm text-brand-bright" />
              <span><span className="font-bold text-white">{topicHere.label}</span> · {topicHere.note}</span>
            </p>
          )}
        </div>
      )}

      {at === 1 && (
        <div className="space-y-3.5">
          <Input
            label="In one line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={140}
            placeholder="The short version"
          />
          <div>
            <label
              htmlFor="ticket-body"
              className="mb-1.5 block text-sm font-bold"
            >
              What happened
            </label>
            <textarea
              id="ticket-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              maxLength={4000}
              placeholder="What you did, what you expected, and what happened instead."
              className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
            />
            <p className="mt-1.5 text-xs text-muted">{4000 - body.length} characters left.</p>
          </div>

          <Tickbox
            on={wantsHuman}
            onChange={setWantsHuman}
            label="Have a person read this one"
          />
        </div>
      )}

      {at === 2 && (
        <Tiles
          label="What you were on"
          value={device}
          onChange={(value) => { setDevice(value); go(3) }}
          options={devices}
        />
      )}

      {at === 3 && (
        <div className="space-y-3.5">
          {username && (
            <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-raised px-4 py-3">
              <Glyph icon={faUser} className="text-sm text-brand-bright" />
              <p className="min-w-0 flex-1 text-sm">
                Writing as <span className="font-bold">@{username}</span>
              </p>
              <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                Signed in
              </span>
            </div>
          )}

          <p className="text-sm leading-relaxed text-muted">
            The reply lands on this ticket and in your inbox either way. An email is only
            needed if the account itself is the problem - then it is the way back.
          </p>

          <Input
            label="First name (optional)"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={60}
            placeholder="What we should call you"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={160}
              placeholder="you@example.com"
            />
            <Input
              label="Email again"
              type="email"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              maxLength={160}
              placeholder="The same one"
              disabled={!emailGiven}
            />
          </div>

          {emailGiven && emailOk && (
            <p className="flex items-center gap-2 text-sm font-semibold text-space-bright">
              <Glyph icon={faEnvelope} className="text-xs" />
              We will write there as well as here.
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}

export default function Support() {
  useTitle('Support', AT_KOBBLON)
  const { profile } = useAuth()
  const toast = useToast()

  const tickets = useAsync(async () => (profile ? listTickets() : []), [profile?.id])

  const [writing, setWriting] = useState(false)
  const [sending, setSending] = useState(false)
  const [opened, setOpened] = useState(0)

  /*
   * Which ticket is open on top of the list, if any.
   *
   * `/support/:id` still resolves here, because a link in a reply email has
   * to land somewhere - it opens the list with that card on top. Closing the
   * card puts the address back to `/support` rather than going back, so
   * closing it twice does not leave somebody on a page they already left.
   */
  const { id: fromAddress } = useParams()
  const navigate = useNavigate()
  const [reading, setReading] = useState<number | null>(
    Number(fromAddress) > 0 ? Number(fromAddress) : null,
  )
  const shutCard = () => {
    setReading(null)
    if (fromAddress) navigate('/support', { replace: true })
  }

  const startWriting = () => { setOpened((n) => n + 1); setWriting(true) }

  const send = async (filled: Parameters<Parameters<typeof TicketCard>[0]['onSend']>[0]) => {
    setSending(true)
    try {
      await openTicket(filled)
      toast('Sent. The reply lands here and in your inbox.', 'success')
      setWriting(false)
      tickets.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not send.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    /*
     * The site's own column, centred, with nothing capped inside it.
     *
     * It was held to 48rem for a day to sit at the width a settings panel
     * is read at - but a settings panel is narrow because a rail is beside
     * it, and these two have no rail, so the cap was a column pinned to the
     * left of a page with a third of it empty. Staw: "arent center-centered,
     * and too small in my opinion". Right on both counts: without a rail,
     * the page is the column.
     */
    <Page className="space-y-8">
      <PageTop
        title="Support"
        note="Write to us. Everything you send, and everything we say back, stays on this page."
        action={
          <GuestGate action="write to support">
            <Button icon={faPlus} onClick={startWriting} disabled={!profile || writing}>
              New ticket
            </Button>
          </GuestGate>
        }
      />

      {/* The two places most people actually meant to go, in the shape
          Settings uses for exactly this. */}
      <Group>
        <Line
          label="Where you stand"
          note="A decision against your account is appealed there, not here."
          icon={faScaleBalanced}
          to="/standing"
        />
        <Line
          label="The rules"
          note="Every policy, split by subject, each with the day it last changed."
          icon={faScroll}
          to="/policies"
        />
      </Group>

      <Panel
        title="Your tickets"
        note={
          tickets.data?.length
            ? 'A reply lands here and in your inbox.'
            : undefined
        }
      >
        {tickets.loading && <Skeleton className="h-24 rounded-2xl" />}
        {tickets.error && <ErrorState message={tickets.error} onRetry={tickets.reload} />}

        {!tickets.loading && !tickets.data?.length && !tickets.error && (
          <Card>
            <EmptyState
              mood="emptyBox"
              title="Nothing open"
              body="You have not written to us yet."
              action={
                <GuestGate action="write to support">
                  <Button icon={faPlus} onClick={startWriting} disabled={!profile}>
                    Write to us
                  </Button>
                </GuestGate>
              }
            />
          </Card>
        )}

        {!!tickets.data?.length && (
          <Group>
            {tickets.data.map((ticket) => {
              const look = lookOf(ticket.status)
              const was = devices.find((one) => one.value === ticket.device)
              return (
                <Line
                  key={ticket.id}
                  onClick={() => setReading(ticket.id)}
                  label={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {ticket.wants_human && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-300">
                          <Glyph icon={faBolt} className="text-[9px]" />
                          Urgent
                        </span>
                      )}
                      <span className="min-w-0">{ticket.subject}</span>
                    </span>
                  }
                  note={
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span>{topics.find((one) => one.value === ticket.topic)?.label ?? ticket.topic}</span>
                      <span aria-hidden="true">·</span>
                      <span>Last moved {timeAgo(ticket.updated_at)}</span>
                      {was && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Glyph icon={was.icon} className="text-[10px]" />
                            {was.label}
                          </span>
                        </>
                      )}
                    </span>
                  }
                  action={
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide',
                          look.look,
                        )}
                      >
                        {look.word}
                      </span>
                      <Glyph icon={faArrowRight} className="hidden text-xs text-muted sm:block" />
                    </span>
                  }
                />
              )
            })}
          </Group>
        )}
      </Panel>

      <p className="px-1 text-xs leading-relaxed text-muted">
        Kobblon never asks for your password, here or anywhere else.
      </p>

      {reading !== null && (
        <TicketThread number={reading} onClose={shutCard} onChanged={tickets.reload} />
      )}

      {/*
        * Keyed on how many times it has been opened, so a card that was
        * cancelled half-filled does not come back half-filled. The state
        * lives inside it; remounting is how it is cleared.
        */}
      <TicketCard
        key={opened}
        open={writing}
        username={profile?.username}
        sending={sending}
        onClose={() => setWriting(false)}
        onSend={send}
      />
    </Page>
  )
}
