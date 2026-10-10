import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHeadset, faPlus, faScaleBalanced, faScroll, faArrowRight, faCircleInfo,
  faDesktop, faMobileScreen, faTabletScreenButton, faGamepad, faRocket,
  faCircleQuestion, faPaperPlane, faCheck, faUser, faEnvelope,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GuestGate } from '@/components/ui/GuestGate'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { listTickets, openTicket } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
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
  answered: { word: 'Replied', look: 'border-space/40 bg-space/10 text-space-bright' },
  closed: { word: 'Closed', look: 'border-white/15 bg-white/[0.06] text-white/55' },
}

/** An email, loosely. The server checks it too, and neither check is proof. */
const looksLikeEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim())

/* ------------------------------------------------------- one numbered step */

export function Step({ n, title, note, children, done }: {
  n: number
  title: string
  note?: string
  children: React.ReactNode
  done?: boolean
}) {
  return (
    <section className="relative flex gap-4 pb-7 last:pb-0">
      {/* The line down the side, so the card reads as a sequence. */}
      <span className="absolute bottom-0 left-[15px] top-9 w-px bg-ink-line last:hidden" />
      <span
        className={cn(
          'relative grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-extrabold',
          done
            ? 'border-space/50 bg-space/15 text-space-bright'
            : 'border-ink-line bg-ink-raised text-white/70',
        )}
      >
        {done ? <FontAwesomeIcon icon={faCheck} className="text-xs" /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <h3 className="font-display text-lg font-extrabold leading-none">{title}</h3>
        {note && <p className="mt-1.5 text-sm leading-relaxed text-muted">{note}</p>}
        <div className="mt-3">{children}</div>
      </div>
    </section>
  )
}

/** The tile row the device and category pick from, which is the visual bit. */
export function Tiles<T extends string>({ value, onChange, options, label }: {
  value: T | null
  onChange: (value: T) => void
  options: { value: T; label: string; icon: IconDefinition }[]
  label: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={label}>
      {options.map((one) => {
        const picked = one.value === value
        return (
          <button
            key={one.value}
            type="button"
            aria-pressed={picked}
            onClick={() => onChange(one.value)}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors',
              picked
                ? 'border-brand-bright bg-brand/20 text-white'
                : 'border-ink-line bg-ink-raised text-white/70 hover:bg-ink-hover',
            )}
          >
            <FontAwesomeIcon
              icon={one.icon}
              className={cn('text-base', picked ? 'text-brand-bright' : 'text-white/40')}
            />
            <span className="min-w-0 truncate">{one.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The card itself, which the page opens and nothing else needs.
 *
 * It is its own component so it can be mounted on its own under
 * `tools/site/` and looked at - and because the page should not be the only
 * place this shape exists. It takes no provider it cannot be given: the
 * username is a prop rather than a `useAuth` call, which is the mistake that
 * has taken a Workspace panel down three times.
 */
export function TicketCard({ username, onCancel, onSend, sending }: {
  username?: string | null
  onCancel: () => void
  onSend: (card: {
    topic: TicketTopic
    subject: string
    body: string
    contact_email: string | null
    first_name: string | null
    device: TicketDevice
  }) => void
  sending?: boolean
}) {
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [again, setAgain] = useState('')
  const [device, setDevice] = useState<TicketDevice | null>(null)
  const [topic, setTopic] = useState<TicketTopic | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const emailGiven = email.trim().length > 0
  const emailOk = !emailGiven || (looksLikeEmail(email) && email.trim() === again.trim())
  const ready = !!topic && !!device && emailOk
    && subject.trim().length >= 3 && body.trim().length >= 10

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-ink-line bg-ink-raised px-5 py-4 sm:px-7">
        <FontAwesomeIcon icon={faPaperPlane} className="text-brand-bright" />
        <h2 className="font-display text-xl font-extrabold">Contact us</h2>
        <span className="ml-auto text-xs font-bold text-muted">Four steps</span>
      </div>

      <div className="px-5 py-6 sm:px-7">
        <Step
          n={1}
          title="Who you are"
          note="Your account is already attached to this ticket. The email is only needed if the account itself is the problem — leave it empty otherwise."
          done={emailOk && emailGiven}
        >
          <div className="space-y-3">
            {username && (
              <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-raised px-4 py-3">
                <FontAwesomeIcon icon={faUser} className="text-sm text-brand-bright" />
                <p className="min-w-0 flex-1 text-sm">
                  Writing as <span className="font-bold">@{username}</span>
                </p>
                <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  Signed in
                </span>
              </div>
            )}

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

            {emailGiven && !looksLikeEmail(email) && (
              <p className="text-sm font-semibold text-amber-300">
                That does not look like an email address.
              </p>
            )}
            {emailGiven && looksLikeEmail(email) && email.trim() !== again.trim() && (
              <p className="text-sm font-semibold text-amber-300">
                The two emails do not match.
              </p>
            )}
            {emailGiven && emailOk && (
              <p className="flex items-center gap-2 text-sm font-semibold text-space-bright">
                <FontAwesomeIcon icon={faEnvelope} className="text-xs" />
                We will write back to that address as well as here.
              </p>
            )}
          </div>
        </Step>

        <Step
          n={2}
          title="What you were on"
          note="It halves the questions we have to ask you back."
          done={!!device}
        >
          <Tiles label="What you were on" value={device} onChange={setDevice} options={devices} />
        </Step>

        <Step n={3} title="What it is about" done={!!topic}>
          <Tiles
            label="What it is about"
            value={topic}
            onChange={setTopic}
            options={topics.map((one) => ({
              value: one.value, label: one.short, icon: one.icon,
            }))}
          />
          {topic && (
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              {topics.find((one) => one.value === topic)?.note}
            </p>
          )}
        </Step>

        <Step
          n={4}
          title="Describe your issue"
          note="What you did, what you expected, and what happened instead."
          done={subject.trim().length >= 3 && body.trim().length >= 10}
        >
          <div className="space-y-3">
            <Input
              label="In one line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={140}
              placeholder="The short version"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              maxLength={4000}
              placeholder="Take as long as you need. The more of it we have, the fewer times we have to write back asking."
              aria-label="Describe your issue"
              className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
            />
            <p className="text-xs text-muted">{4000 - body.length} characters left.</p>
          </div>
        </Step>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-line bg-ink-raised px-5 py-4 sm:px-7">
        <p className="min-w-0 flex-1 text-sm text-muted">
          {ready
            ? 'Ready to send. A person reads it.'
            : 'Fill in the four steps above and Continue switches on.'}
        </p>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          icon={faArrowRight}
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
            })
          }}
        >
          Continue
        </Button>
      </div>
    </Card>
  )
}

export default function Support() {
  useTitle('Support')
  const { profile } = useAuth()
  const toast = useToast()

  const tickets = useAsync(async () => (profile ? listTickets() : []), [profile?.id])

  const [writing, setWriting] = useState(false)
  const [sending, setSending] = useState(false)
  const card = useRef<HTMLDivElement>(null)

  /* Opening the card scrolls to it, because on a phone it opens off-screen. */
  useEffect(() => {
    if (writing) card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [writing])

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
    <Page width="narrow" className="space-y-6">
      <PageHeader
        kicker="Help"
        icon={faHeadset}
        title="Support"
        lead="Write to a person at Kobblon. Everything you send and everything we say back stays on this page."
        actions={
          <GuestGate action="write to support">
            <Button
              icon={faPlus}
              onClick={() => setWriting(true)}
              disabled={!profile || writing}
            >
              New ticket
            </Button>
          </GuestGate>
        }
      />

      {/* The two things most people are actually looking for. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/standing"
          className="flex items-start gap-4 rounded-2xl border border-ink-line bg-ink-card p-5 transition-colors hover:bg-ink-hover"
        >
          <FontAwesomeIcon icon={faScaleBalanced} className="mt-1 text-lg text-brand-bright" />
          <span className="min-w-0">
            <span className="block font-bold">Where you stand</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-muted">
              A decision against your account is appealed there, not here.
            </span>
          </span>
        </Link>
        <Link
          to="/policies"
          className="flex items-start gap-4 rounded-2xl border border-ink-line bg-ink-card p-5 transition-colors hover:bg-ink-hover"
        >
          <FontAwesomeIcon icon={faScroll} className="mt-1 text-lg text-brand-bright" />
          <span className="min-w-0">
            <span className="block font-bold">The rules</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-muted">
              Every policy, split by subject, each with the day it last changed.
            </span>
          </span>
        </Link>
      </div>

      {/* ------------------------------------------------------ the ticket card */}
      {writing && (
        <div ref={card}>
          <TicketCard
            username={profile?.username}
            sending={sending}
            onCancel={() => setWriting(false)}
            onSend={send}
          />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-extrabold">Your tickets</h2>

        {tickets.loading && <Skeleton className="h-24 rounded-2xl" />}
        {tickets.error && <ErrorState message={tickets.error} onRetry={tickets.reload} />}

        {!tickets.loading && !tickets.data?.length && (
          <Card>
            <EmptyState
              mood="emptyBox"
              title="Nothing open"
              body="You have not written to us. If something is wrong, say so and a person reads it."
              action={
                <GuestGate action="write to support">
                  <Button icon={faPlus} onClick={() => setWriting(true)} disabled={!profile}>
                    Write to us
                  </Button>
                </GuestGate>
              }
            />
          </Card>
        )}

        {tickets.data?.map((ticket) => {
          const look = statusLook[ticket.status]
          const was = devices.find((one) => one.value === ticket.device)
          return (
            <Link key={ticket.id} to={`/support/${ticket.id}`} className="block">
              <Card className="flex flex-wrap items-center gap-3 p-5 transition-colors hover:bg-ink-hover">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                      {topics.find((one) => one.value === ticket.topic)?.label ?? ticket.topic}
                    </span>
                    <span className="text-xs text-muted">·</span>
                    <span className="text-xs text-muted">
                      Last moved {timeAgo(ticket.updated_at)}
                    </span>
                    {was && (
                      <>
                        <span className="text-xs text-muted">·</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <FontAwesomeIcon icon={was.icon} className="text-[10px]" />
                          {was.label}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="mt-1 block truncate font-bold">{ticket.subject}</span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide',
                    look.look,
                  )}
                >
                  {look.word}
                </span>
                <FontAwesomeIcon icon={faArrowRight} className="text-xs text-muted" />
              </Card>
            </Link>
          )
        })}
      </section>

      <p className="flex items-start gap-3 rounded-2xl border border-ink-line bg-ink-card p-5 text-sm leading-relaxed text-muted">
        <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
        Kobblon will never ask you for your password, and never asks for it here. Anybody who
        does is not us, whatever the message looks like.
      </p>
    </Page>
  )
}
