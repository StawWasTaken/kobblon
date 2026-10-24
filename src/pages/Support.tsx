import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faHeadset, faPlus, faScaleBalanced, faScroll, faArrowRight, faCircleInfo,
  faDesktop, faMobileScreen, faTabletScreenButton, faGamepad, faRocket,
  faCircleQuestion, faCheck, faUser, faEnvelope,
  faBolt, faArrowLeft, faPaperPlane,
  faBriefcase, faHandshake, faChartLine, faNewspaper, faRightToBracket,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { Panel, Group, Line } from '@/components/settings/Panel'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { Tickbox } from '@/components/ui/Tickbox'
import { Tiles } from '@/components/ui/Tiles'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { listTickets, openTicket } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TicketThread } from '@/components/support/TicketThread'
import type { Ticket, TicketDevice, TicketKind, TicketTopic } from '@/types/db'

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

/**
 * The business form's own list.
 *
 * Staw: "for business its for other companies (not individuals, excepted
 * investors but we're not a public traded company, so investors invest into
 * kobblon without receiving stuff back unless negociated directly with the
 * CEO of Kobblon, Staw) if u wanna invest in kobblon or make a partnership,
 * or if u have issues with some of our content on the platform".
 *
 * So four, and `other`, which is the one value both forms share. The note
 * under Investing is the part that matters and the part a prettier form
 * would have left out: there is nothing on sale here, and saying so on the
 * form is the difference between an enquiry and a misunderstanding.
 */
export const businessTopics: {
  value: TicketTopic; label: string; short: string; note: string; icon: IconDefinition
}[] = [
  {
    value: 'invest', short: 'Investing', label: 'Investing in Kobblon',
    note: 'Kobblon is not a publicly traded company and nothing here is on sale. An investment buys nothing back unless it is negotiated directly with Staw, Kobblon’s CEO.',
    icon: faChartLine,
  },
  {
    value: 'partner', short: 'Partnership', label: 'A partnership',
    note: 'Working together on something: your game, your brand, your event, ours.',
    icon: faHandshake,
  },
  {
    value: 'content', short: 'Content', label: 'Content on the platform',
    note: 'Something of yours is on Kobblon, or something on Kobblon is a problem for you.',
    icon: faScaleBalanced,
  },
  {
    value: 'press', short: 'Press', label: 'Press and media',
    note: 'You are writing or filming something about Kobblon.',
    icon: faNewspaper,
  },
  {
    value: 'other', short: 'Other', label: 'Something else',
    note: 'Anything the list above does not cover.',
    icon: faBriefcase,
  },
]

/** Both lists, for anywhere that has a topic and needs its word. */
export const topicWord = (topic: string) =>
  [...topics, ...businessTopics].find((one) => one.value === topic)?.label ?? topic

/* --------------------------------------------------------------- the steps */

/**
 * The form is two forms, and the first step is which.
 *
 * Staw: "theres two categories like for the players users etc and 'business'
 * ... and its a cool sliding thing". The slider was already there - four
 * steps, one at a time - so this is a step in front of it and two different
 * runs of steps behind it. A company is not asked what device it was on, and
 * a player is not asked for their job title.
 *
 * Named steps rather than numbered ones, because the two runs are different
 * lengths and `at === 2` meaning "device" on one form and "your message" on
 * the other is the kind of thing that reads fine and sends the wrong field.
 */
type Step = 'who' | 'topic' | 'said' | 'device' | 'you'

const stepsOf = (kind: TicketKind | null): Step[] =>
  kind === 'business'
    ? ['who', 'topic', 'said', 'you']
    : ['who', 'topic', 'said', 'device', 'you']

const STEP_NAME: Record<Step, string> = {
  who: 'Who',
  topic: 'About',
  said: 'Message',
  device: 'Device',
  you: 'You',
}

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
function Progress({ steps, at, done, go }: {
  steps: Step[]
  at: number
  done: boolean[]
  go: (i: number) => void
}) {
  return (
    <ol className="flex gap-1.5">
      {steps.map((step, i) => {
        const here = i === at
        const reachable = i <= at || done.slice(0, i).every(Boolean)
        return (
          <li key={step} className="min-w-0 flex-1">
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
                <span className="truncate">{STEP_NAME[step]}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** One of the two boxes on the first step. */
function WhoBox({ picked, onPick, icon, title, lead, points }: {
  picked: boolean
  onPick: () => void
  icon: IconDefinition
  title: string
  lead: string
  points: string[]
}) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      className={cn(
        'flex h-full flex-col rounded-2xl border p-4 text-left transition-colors',
        picked
          ? 'border-brand-bright bg-brand/20'
          : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
      )}
    >
      <span className="flex items-center gap-2.5">
        <Glyph
          icon={icon}
          className={cn('text-lg', picked ? 'text-brand-bright' : 'text-white/40')}
        />
        <span className="font-display text-base font-extrabold">{title}</span>
      </span>
      <span className="mt-2 block text-sm leading-relaxed text-white/60">{lead}</span>
      <span className="mt-3 block space-y-1">
        {points.map((one) => (
          <span key={one} className="flex items-start gap-2 text-xs text-white/45">
            <Glyph icon={faCheck} className="mt-[3px] shrink-0 text-[9px] text-space" />
            <span>{one}</span>
          </span>
        ))}
      </span>
    </button>
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
 * So it is one step at a time, and the ticks at the top are now worth
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
 * that has taken a Workspace panel down three times. `signedIn` is a prop
 * for the same reason, and it decides whether an email is optional: with no
 * account behind the ticket, the address is the only way back, so the server
 * insists on one and the form says so rather than letting the send fail.
 */
export function TicketCard({
  open, username, signedIn, startKind, onClose, onSend, sending,
}: {
  open: boolean
  username?: string | null
  /**
   * Which of the two boxes is already picked. For the row on the page that
   * says "business enquiries": the first step still shows, with its answer
   * in it, so nobody is dropped into a form without being told which one
   * they are filling in.
   */
  startKind?: TicketKind | null
  /**
   * Whether there is a session behind this. Defaults to whether a username
   * was given, which is what every caller before 0293 meant by it.
   */
  signedIn?: boolean
  onClose: () => void
  onSend: (card: {
    kind: TicketKind
    topic: TicketTopic
    subject: string
    body: string
    contact_email: string | null
    first_name: string | null
    device: TicketDevice | null
    wants_human: boolean
    org: string | null
    org_role: string | null
  }) => void
  sending?: boolean
}) {
  const [kind, setKind] = useState<TicketKind | null>(startKind ?? null)
  const [at, setAt] = useState(0)
  /* How far anybody has actually got. The last step is optional for a
     signed-in player, so without this it ticks itself green before it has
     been seen - a form congratulating somebody for answering a question it
     never asked. */
  const [furthest, setFurthest] = useState(0)
  const go = (i: number) => { setAt(i); setFurthest((f) => Math.max(f, i)) }
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [again, setAgain] = useState('')
  const [org, setOrg] = useState('')
  const [orgRole, setOrgRole] = useState('')
  const [device, setDevice] = useState<TicketDevice | null>(null)
  const [topic, setTopic] = useState<TicketTopic | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [wantsHuman, setWantsHuman] = useState(false)

  const here = signedIn ?? !!username
  const business = kind === 'business'
  const list = business ? businessTopics : topics
  const steps = stepsOf(kind)

  /*
   * When an address is the only way back, it is required rather than
   * offered: nobody signed in, or a company that will be answered by mail
   * either way. The server refuses the ticket without one, so the form has
   * to ask for it on the same terms.
   */
  const mustMail = !here || business
  const emailGiven = email.trim().length > 0
  const emailOk = emailGiven
    ? looksLikeEmail(email) && email.trim() === again.trim()
    : !mustMail
  const named = !business || (firstName.trim().length > 0 && org.trim().length > 0)
  const said = subject.trim().length >= 3 && body.trim().length >= 10

  /* One per step, in the strip's order. `ready` is all of them. */
  const lastStep = steps.length - 1
  const done = steps.map((step, i) => {
    if (step === 'who') return !!kind
    if (step === 'topic') return !!topic
    if (step === 'said') return said
    if (step === 'device') return !!device
    return emailOk && named && furthest >= i
  })
  const ready = done.every(Boolean)
  const last = at === lastStep
  const step = steps[at]

  /*
   * What the footer says when the step is not finished. It names the thing
   * that is missing rather than printing "required": a person who has typed
   * a subject and no description should be told which half is short, not
   * that the form is unhappy with them in general.
   */
  const wrongEmail = step === 'you' && emailGiven && !emailOk
  const missing =
    step === 'who' ? 'Pick which one of these you are.'
    : step === 'topic' ? 'Pick the one that fits best.'
    : step === 'said'
      ? subject.trim().length < 3
        ? 'A line saying what it is about.'
        : 'A few more words about what happened.'
    : step === 'device' ? 'Pick what you were on.'
    : business && !firstName.trim() ? 'Your name, so we know who we are writing to.'
    : business && !org.trim() ? 'The name of the company.'
    : emailGiven && !looksLikeEmail(email) ? 'That does not look like an email address.'
    : emailGiven ? 'The two emails do not match.'
    : 'An email address, because it is the only way back to you.'

  const topicHere = list.find((one) => one.value === topic)

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
              {step === 'who' ? 'Kobblon will be glad to hear from you.'
                : step === 'topic' ? 'What is this about?'
                : step === 'said' ? 'Tell us what happened.'
                : step === 'device' ? 'What were you using at the time?'
                : business ? 'Who you are, and where to write back.'
                : 'How we reach you, if we need to.'}
            </p>
          </div>
          <Progress steps={steps} at={at} done={done} go={go} />
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
                if (!kind || !topic) return
                if (kind === 'player' && !device) return
                onSend({
                  kind,
                  topic,
                  subject: subject.trim(),
                  body: body.trim(),
                  contact_email: emailGiven ? email.trim() : null,
                  first_name: firstName.trim() || null,
                  device: kind === 'business' ? null : device,
                  wants_human: wantsHuman,
                  org: kind === 'business' ? org.trim() || null : null,
                  org_role: kind === 'business' ? orgRole.trim() || null : null,
                })
              }}
            >
              Send it
            </Button>
          ) : (
            <Button icon={faArrowRight} disabled={!done[at]} onClick={() => go(at + 1)}>
              Next
            </Button>
          )}
        </div>
      }
    >
      {step === 'who' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <WhoBox
            picked={kind === 'player'}
            onPick={() => {
              /* Picking the other one mid-form clears the answer that does
                 not carry: the two lists share only `other`, and a topic
                 from the wrong list is refused by the server. */
              if (kind !== 'player') setTopic(null)
              setKind('player')
              go(1)
            }}
            icon={faUser}
            title="I use Kobblon"
            lead="You play, build, or have an account with us."
            points={[
              'Signing in, names, money, moderation',
              'Something is broken, or somebody is a problem',
              'Uploads, selling, your work elsewhere',
            ]}
          />
          <WhoBox
            picked={kind === 'business'}
            onPick={() => {
              if (kind !== 'business') setTopic(null)
              setKind('business')
              go(1)
            }}
            icon={faBriefcase}
            title="Business"
            lead="A company writing to Kobblon. Investors too, and nobody else writing for themselves."
            points={[
              'Investing in Kobblon, or a partnership',
              'Your content on the platform, or ours',
              'Press and media',
            ]}
          />
        </div>
      )}

      {step === 'topic' && (
        <div className="space-y-3">
          {/*
            * Picking one does not move the form on, and that is a change.
            * It used to jump straight to the next step, which meant the
            * line under the tiles - what this topic actually covers - was
            * drawn for about a tenth of a second and read by nobody. On
            * the business form that line is the one that says Kobblon is
            * not publicly traded and an investment buys nothing back, so
            * it has to survive being looked at.
            */}
          <Tiles
            label="What it is about"
            value={topic}
            onChange={setTopic}
            options={list.map((one) => ({
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

      {step === 'said' && (
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
              {business ? 'What you would like to talk about' : 'What happened'}
            </label>
            <textarea
              id="ticket-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              maxLength={4000}
              placeholder={business
                ? 'Who you are, what you have in mind, and what you are hoping for from us.'
                : 'What you did, what you expected, and what happened instead.'}
              className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
            />
            <p className="mt-1.5 text-xs text-muted">{4000 - body.length} characters left.</p>
          </div>

          {!business && (
            <Tickbox
              on={wantsHuman}
              onChange={setWantsHuman}
              label="Have a person read this one"
            />
          )}
        </div>
      )}

      {step === 'device' && (
        <Tiles
          label="What you were on"
          value={device}
          onChange={(value) => { setDevice(value); go(at + 1) }}
          options={devices}
        />
      )}

      {step === 'you' && (
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
            {business
              ? 'We answer business enquiries by email. Nothing here is published and nothing is passed on.'
              : here
                ? 'The reply lands on this ticket and in your inbox either way. An email is only needed if the account itself is the problem - then it is the way back.'
                : 'You are not signed in, so this ticket has no page of its own to come back to. The reply goes to the address you give here, and nowhere else.'}
          </p>

          <Input
            label={business ? 'Your name' : 'First name (optional)'}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={60}
            placeholder={business ? 'Who we are writing to' : 'What we should call you'}
          />

          {business && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Company"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                maxLength={120}
                placeholder="Who you are writing for"
              />
              <Input
                label="Your role there (optional)"
                value={orgRole}
                onChange={(e) => setOrgRole(e.target.value)}
                maxLength={120}
                placeholder="What you do there"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={mustMail ? 'Email' : 'Email (optional)'}
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
              {here ? 'We will write there as well as here.' : 'We will write there.'}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}

export default function Support() {
  useTitle('Support')
  const { profile } = useAuth()
  const toast = useToast()

  const tickets = useAsync(async () => (profile ? listTickets() : []), [profile?.id])

  const [writing, setWriting] = useState(false)
  const [sending, setSending] = useState(false)
  const [opened, setOpened] = useState(0)
  /* Which box the card opens with, for the row that says "business". */
  const [asKind, setAsKind] = useState<TicketKind | null>(null)

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

  const startWriting = (kind: TicketKind | null = null) => {
    setAsKind(kind)
    setOpened((n) => n + 1)
    setWriting(true)
  }

  const send = async (filled: Parameters<Parameters<typeof TicketCard>[0]['onSend']>[0]) => {
    setSending(true)
    try {
      await openTicket(filled)
      toast(
        profile
          ? 'Sent. The reply lands here and in your inbox.'
          : 'Sent. We will write to the address you gave.',
        'success',
      )
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
    <AboutShell
      hero={
        <Lane className="flex min-h-[34vh] flex-col justify-center py-16">
          <Reveal>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-bright">
              Support
            </p>
            <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[0.98] tracking-tight">
              Write to us.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              {profile
                ? 'Everything you send, and everything we say back, stays on this page. A reply lands here and in your inbox.'
                : 'An account is not needed. Tell us where to write back and the reply goes there - and if you are a company, there is a form of your own on the first step.'}
            </p>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-8 flex flex-wrap gap-3">
              {/*
                * No `GuestGate` and no `disabled={!profile}` any more. The
                * page is readable and writable without an account since
                * 0293, which is the only honest arrangement for a support
                * page: the person who cannot sign in is exactly the person
                * who needs it.
                */}
              <Button icon={faPlus} size="lg" variant="yes" onClick={() => startWriting()} disabled={writing}>
                New ticket
              </Button>
              <Button
                icon={faBriefcase}
                size="lg"
                variant="subtle"
                onClick={() => startWriting('business')}
                disabled={writing}
              >
                Business enquiry
              </Button>
            </div>
          </Reveal>
        </Lane>
      }
    >
      <Band tone="raised" edge>
        <Lane className="space-y-8">
      {/* The two places most people actually meant to go, in the shape
          Settings uses for exactly this. */}
      <Group>
        {/*
          * Account standing is a signed-in page and stays one - everything
          * on it is about one account and it is reached from the account
          * menu. So the row is only here for somebody who has an account to
          * look at, rather than being a door into a page that would bounce
          * them to the landing page.
          */}
        {profile && (
          <Line
            label="Where you stand"
            note="A decision against your account is appealed there, not here."
            icon={faScaleBalanced}
            to="/standing"
          />
        )}
        <Line
          label="Policies"
          note="Every policy, split by subject, each with the day it last changed."
          icon={faScroll}
          to="/policies"
        />
        {!profile && (
          <Line
            label="Sign in"
            note="With an account, every ticket and every reply is on this page instead of only in your email."
            icon={faRightToBracket}
            to="/login"
          />
        )}
      </Group>

      {!profile ? (
        /*
          * Nothing to list. A ticket written without an account is readable
          * by staff and by nobody else - `user_id = auth.uid()` is null
          * rather than true - so there is no list to show here, and saying
          * that plainly is better than an empty box that looks broken.
          */
        <Panel title="Where the reply goes">
          <Card className="space-y-3 p-5">
            <p className="text-sm leading-relaxed text-white/70">
              You are writing without an account, so this page has nothing to list: a
              ticket sent that way is held for support and shown to nobody else, not even
              to the next person on this page. The reply goes to the address you give on
              the form.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              Signed in, every ticket and every reply sits here instead, and in your inbox.
            </p>
          </Card>
        </Panel>
      ) : (
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
                <Button icon={faPlus} onClick={() => startWriting()}>
                  Write to us
                </Button>
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
                      {ticket.kind === 'business' && (
                        <span className="inline-flex items-center gap-1.5 font-bold text-space-bright">
                          <Glyph icon={faBriefcase} className="text-[10px]" />
                          {ticket.org ?? 'Business'}
                        </span>
                      )}
                      {ticket.kind === 'business' && <span aria-hidden="true">·</span>}
                      <span>{topicWord(ticket.topic)}</span>
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
      )}

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
        signedIn={!!profile}
        startKind={asKind}
        sending={sending}
        onClose={() => setWriting(false)}
        onSend={send}
      />
        </Lane>
      </Band>
    </AboutShell>
  )
}
