import { useEffect, useRef, useState } from 'react'
import {
  faFlag, faFaceAngry, faBullhorn, faEyeSlash, faHandFist, faUserSecret,
  faGavel, faCircleQuestion, faLock, faPaperPlane, faChevronRight, faArrowLeft,
  faCheck, faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useMaybeAuth } from '@/hooks/useAuth'
import { submitReport } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * Reporting something, as three steps that slide.
 *
 * Staw asked for "a mix of polytoria report cards, roblox report cards and
 * discord report cards", with animation and sliding. What each of those
 * actually does, under the paint:
 *
 * - **Discord** asks one question at a time, in rows with a chevron, and the
 *   answer to the first decides the second. That is the shape here.
 * - **Roblox** keeps the thing being reported pinned where you can see it,
 *   so you cannot lose track of what you are accusing.
 * - **Polytoria** shows you the finished report before it goes, and makes
 *   the last press the only one that sends.
 *
 * The last of those is the reason for the third step and not decoration: a
 * report is a thing said about a person, and the card it is written in
 * should make you read it once before it leaves.
 *
 * The slide is two animations, not one. A step going back enters from the
 * left; a step going forward enters from the right. One animation for both
 * directions reads as a stack of screens rather than a place you are moving
 * around in, and the back button stops feeling like back.
 */

type Reason = {
  value: string
  label: string
  blurb: string
  icon: IconDefinition
  /** The second question. Discord's trick: the first answer picks the list. */
  kinds: string[]
}

const reasons: Reason[] = [
  {
    value: 'harassment',
    label: 'Harassment or bullying',
    blurb: 'Somebody is going after a person rather than disagreeing with them.',
    icon: faFaceAngry,
    kinds: [
      'Insults or name-calling',
      'Following somebody around the platform',
      'Getting other people to pile on',
      'Bringing up something private to needle them',
    ],
  },
  {
    value: 'spam',
    label: 'Spam, or an ad hiding what it is',
    blurb: 'Repeated, automated, or pretending to be something it is not.',
    icon: faBullhorn,
    kinds: [
      'The same thing posted over and over',
      'An advert dressed up as a normal post',
      'Links somewhere off Kobblon',
      'A scam, or asking for account details',
    ],
  },
  {
    value: 'sexual',
    label: 'Sexual content',
    blurb: 'Kobblon is for everybody, including people far younger than you.',
    icon: faEyeSlash,
    kinds: [
      'A sexual image, look, or build',
      'Sexual talk in chat',
      'Sexual talk aimed at somebody young',
      'A link to it somewhere else',
    ],
  },
  {
    value: 'violence',
    label: 'Threats or violence',
    blurb: 'Somebody said they would do something, or cheered somebody who did.',
    icon: faHandFist,
    kinds: [
      'A threat to hurt somebody',
      'Celebrating real violence',
      'Hate towards a group of people',
      'Self-harm, or talking somebody into it',
    ],
  },
  {
    value: 'impersonation',
    label: 'Pretending to be someone',
    blurb: 'Wearing another person as a costume, which is how people get fooled.',
    icon: faUserSecret,
    kinds: [
      'Pretending to be another member',
      'Pretending to be Kobblon staff',
      "Passing somebody else's work off as theirs",
      'A copy of a Community or World, made to confuse',
    ],
  },
  {
    value: 'illegal',
    label: 'Something illegal',
    blurb: 'The kind of thing that is not only against our rules.',
    icon: faGavel,
    kinds: [
      'A child is being put at risk',
      'Selling something that cannot be sold',
      'Stolen accounts or stolen work',
      'Something somebody should see today',
    ],
  },
  {
    value: 'other',
    label: 'Something else',
    blurb: 'None of these fit. Tell us in your own words.',
    icon: faCircleQuestion,
    kinds: [],
  },
]

/** What the thing is, in a word, for the line under the name. */
const thingWord: Record<string, string> = {
  profile: 'An account',
  space: 'A World',
  message: 'A message',
  ad: 'An advert',
  asset: 'An upload',
  community: 'A Community',
  style: 'A look',
  avatar_item: 'An avatar item',
  outfit: 'An outfit',
}

/** One tappable row. The list on every step is made of these. */
function Row({
  icon, label, blurb, picked, onClick, delay,
}: {
  icon?: IconDefinition
  label: string
  blurb?: string
  picked?: boolean
  onClick: () => void
  delay: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'group flex w-full animate-row-in items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
        picked
          ? 'border-danger/50 bg-danger/10'
          : 'border-ink-line bg-ink-raised hover:border-ink-line/80 hover:bg-ink-hover',
      )}
    >
      {icon && (
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors',
            picked
              ? 'border-danger/50 bg-danger/15 text-danger'
              : 'border-ink-line bg-ink-card text-white/45 group-hover:text-white/70',
          )}
        >
          <Glyph icon={icon} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug">{label}</span>
        {blurb && <span className="mt-0.5 block text-xs leading-snug text-muted">{blurb}</span>}
      </span>
      <Glyph
        icon={faChevronRight}
        className="shrink-0 text-xs text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60"
      />
    </button>
  )
}

export function ReportDialog({
  open, onClose, targetType, targetId, targetName,
}: {
  open: boolean
  onClose: () => void
  targetType: 'profile' | 'space' | 'message' | 'ad' | 'asset' | 'community' | 'style' | 'avatar_item' | 'outfit'
  targetId: string
  targetName: string
}) {
  /* Not `useAuth`: that throws without a provider, and this card is opened
     from an asset page the Workspace can mount. Null means nobody told us. */
  const auth = useMaybeAuth()
  const profile = auth?.profile ?? null
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [way, setWay] = useState<'next' | 'back'>('next')
  const [reason, setReason] = useState<Reason | null>(null)
  const [kind, setKind] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [pending, setPending] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  /* A card that is closed and opened again is a new report. Without this it
     kept the last one's reason and words, so reporting a second thing began
     half filled in with something said about the first. */
  useEffect(() => {
    if (!open) return
    setStep(0)
    setWay('next')
    setReason(null)
    setKind(null)
    setDetails('')
  }, [open])

  /* Step two can be longer than step one, and the card scrolls. Landing
     halfway down a question you have not read yet is disorienting, so each
     step starts at its own top. */
  const go = (to: number, direction: 'next' | 'back') => {
    setWay(direction)
    setStep(to)
    body.current?.closest('.kob-scroll')?.scrollTo({ top: 0 })
  }

  const pickReason = (one: Reason) => {
    setReason(one)
    setKind(null)
    go(one.kinds.length ? 1 : 2, 'next')
  }

  const send = async () => {
    if (!profile || !reason) return
    setPending(true)
    try {
      /* The table holds a reason and free text, so the second answer rides
         on the first line of the details. It is the sentence a moderator
         reads first either way; it is not quietly dropped. */
      const said = [kind, details.trim()].filter(Boolean).join('\n\n')
      await submitReport({
        reporterId: profile.id, targetType, targetId, reason: reason.value, details: said,
      })
      toast('Sent. A moderator reads every one of these.', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That report did not send.', 'error')
    } finally {
      setPending(false)
    }
  }

  const steps = ['What happened', 'Which of these', 'Check it over']
  const hint = [
    'Pick the closest one. A moderator reads it either way.',
    'Narrow it down, or go back and pick differently.',
    !profile ? 'Sign in and you can send this.' : 'Nobody is told that you sent this.',
  ][step]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Report ${targetName}`}
      size="lg"
      head={
        <div className="relative bg-gradient-to-br from-danger/15 to-ink-card px-5 pb-4 pt-5">
          <div className="flex items-start gap-4 pr-10">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-danger/40 bg-danger/15 text-danger">
              <Glyph icon={faFlag} className="text-lg" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                {thingWord[targetType] ?? 'Something'} · private
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-extrabold leading-tight">
                Report {targetName}
              </h2>
            </div>
          </div>
          {/* Three steps, named. A bar with no words on it tells you how far
              along you are and nothing about where you are going. */}
          <div className="mt-4 flex gap-1.5">
            {steps.map((name, i) => (
              <div key={name} className="min-w-0 flex-1">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      'h-full rounded-full bg-danger transition-[width,opacity] duration-300 ease-out',
                      i < step ? 'w-full opacity-50' : i === step ? 'w-full' : 'w-0',
                    )}
                  />
                </div>
                <p
                  className={cn(
                    'mt-1.5 truncate text-[10px] font-extrabold uppercase tracking-wide transition-colors',
                    i === step ? 'text-white/80' : 'text-white/30',
                  )}
                >
                  {name}
                </p>
              </div>
            ))}
          </div>
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          <p className="order-first w-full min-w-0 text-sm text-muted sm:order-none sm:w-auto sm:flex-1">
            {hint}
          </p>
          {step === 0 ? (
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          ) : (
            <Button
              variant="ghost"
              icon={faArrowLeft}
              onClick={() => go(step === 2 && reason && !reason.kinds.length ? 0 : step - 1, 'back')}
            >
              Back
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="danger"
              icon={faPaperPlane}
              loading={pending}
              disabled={!profile || !reason}
              onClick={send}
            >
              Send report
            </Button>
          )}
        </div>
      }
    >
      <div ref={body}>
        {/* `key` is the step, so React builds a new element and the entry
            animation runs again. Without it the markup is patched in place
            and nothing moves. */}
        <div key={step} className={way === 'next' ? 'animate-step-next' : 'animate-step-back'}>
          {step === 0 && (
            <div className="space-y-4">
              {!profile && (
                <p className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
                  <Glyph icon={faLock} className="mt-0.5 shrink-0 text-sm text-muted" />
                  <span>
                    Reports are tied to the account that sends them, so we can come back to
                    you and so nobody can bury somebody under a hundred of them.{' '}
                    <a href="/login" className="font-bold text-link hover:underline">Sign in</a>{' '}
                    and this card will send.
                  </span>
                </p>
              )}
              <div className="space-y-2">
                {reasons.map((one, i) => (
                  <Row
                    key={one.value}
                    icon={one.icon}
                    label={one.label}
                    blurb={one.blurb}
                    picked={reason?.value === one.value}
                    onClick={() => pickReason(one)}
                    delay={i * 35}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 1 && reason && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-danger/40 bg-danger/15 text-danger">
                  <Glyph icon={reason.icon} />
                </span>
                <p className="min-w-0 flex-1 text-sm font-bold leading-snug">{reason.label}</p>
              </div>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                Which of these is it
              </h3>
              <div className="space-y-2">
                {reason.kinds.map((one, i) => (
                  <Row
                    key={one}
                    label={one}
                    picked={kind === one}
                    onClick={() => { setKind(one); go(2, 'next') }}
                    delay={i * 35}
                  />
                ))}
                <Row
                  label="None of these, exactly"
                  blurb="You can say what it was on the next step."
                  onClick={() => { setKind(null); go(2, 'next') }}
                  delay={reason.kinds.length * 35}
                />
              </div>
            </div>
          )}

          {step === 2 && reason && (
            <div className="space-y-5">
              {/* Roblox keeps the thing on screen through the whole flow. It
                  is the one line of this card that stops a misfire. */}
              <div className="rounded-xl border border-ink-line bg-ink-raised p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  You are reporting
                </p>
                <p className="mt-1 truncate font-display text-base font-extrabold">{targetName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {thingWord[targetType] ?? 'Something'} on Kobblon
                </p>
                <div className="mt-3 space-y-2 border-t border-ink-line pt-3">
                  <button
                    type="button"
                    onClick={() => go(0, 'back')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/5"
                  >
                    <Glyph icon={reason.icon} className="shrink-0 text-sm text-danger" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{reason.label}</span>
                    <Glyph icon={faPenToSquare} className="shrink-0 text-xs text-white/35" />
                  </button>
                  {kind && (
                    <button
                      type="button"
                      onClick={() => go(1, 'back')}
                      className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/5"
                    >
                      <Glyph icon={faCheck} className="shrink-0 text-sm text-white/35" />
                      <span className="min-w-0 flex-1 truncate text-sm text-white/75">{kind}</span>
                      <Glyph icon={faPenToSquare} className="shrink-0 text-xs text-white/35" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="report-details" className="mb-1.5 block text-sm font-bold">
                  Anything else
                  <span className="ml-1.5 font-medium text-white/30">optional</span>
                </label>
                <textarea
                  id="report-details"
                  data-nofocus
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Where it was, when, and what we should be looking at."
                  className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
                />
                <p className="mt-1.5 text-xs text-muted">
                  It will not slow anything down, but it is usually what decides it.
                </p>
              </div>

              {/* What actually happens, said plainly. A report that disappears
                  into a toast and is never mentioned again is why people stop
                  sending them. */}
              <p className="text-sm leading-relaxed text-muted">
                A moderator reads it. The person is not told who reported them, and you will
                not hear the outcome - what was done about somebody else is their business,
                not a notification. If it needs more from you, we will write to you on
                Support.
              </p>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
