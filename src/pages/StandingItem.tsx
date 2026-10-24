import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faChevronLeft, faGavel, faDiamond } from '@fortawesome/free-solid-svg-icons'
import { AboutShell } from '@/components/layout/AboutShell'
import { cn } from '@/lib/cn'
import { Band, Lane } from '@/components/about/Band'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  ActionTag, actionWord, blockWord, day, headlineOf, ruleWord, stamp,
} from '@/components/social/standing'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { fileAppeal, getAppeal, getViolation, myAppealState } from '@/lib/api'

/*
 * One decision, in full.
 *
 * The order is the order somebody reads it in: what we decided, then how the
 * appeal went, then what actually happened. The appeal timeline runs newest
 * first, because the thing you came back to check is the answer.
 */

function Moment({ title, at, children, last }: {
  title: string
  at: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && <span className="absolute left-[7px] top-5 h-full w-px bg-ink-line" />}
      <Glyph
        icon={faDiamond}
        className="relative mt-1 text-[15px] text-white/30"
      />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 text-sm tabular-nums text-muted">{stamp(at)}</p>
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-white/70">{children}</div>
      </div>
    </li>
  )
}

function Quoted({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <p className="mb-1.5 text-sm text-muted">{label}</p>}
      <div className="whitespace-pre-wrap rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
        {children}
      </div>
    </div>
  )
}

export default function StandingItem() {
  const { id = '' } = useParams()
  const number = Number(id)
  const toast = useToast()

  const decision = useAsync(async () => (number ? getViolation(number) : null), [number])
  const appeal = useAsync(async () => (number ? getAppeal(number) : null), [number])
  const state = useAsync(async () => (number ? myAppealState(number) : null), [number])

  const [writing, setWriting] = useState(false)
  const [words, setWords] = useState('')
  const [sending, setSending] = useState(false)

  useTitle(decision.data ? headlineOf(decision.data) : 'Decision')

  const send = async () => {
    setSending(true)
    try {
      await fileAppeal(number, words.trim())
      toast('Sent. Somebody who was not part of the decision will look at it.', 'success')
      setWriting(false)
      setWords('')
      appeal.reload()
      state.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not send.', 'error')
    } finally {
      setSending(false)
    }
  }

  if (decision.loading) {
    return (
      <Frame><Skeleton className="h-72 rounded-2xl" /></Frame>
    )
  }

  if (decision.error) {
    return (
      <Frame>
        <ErrorState message={decision.error} onRetry={decision.reload} />
      </Frame>
    )
  }

  if (!decision.data) {
    return (
      <Frame>
        <Card>
          <EmptyState
            mood="noResults"
            title="No decision here"
            body="There is no decision about your account with that number."
            action={<Button to="/standing">Account status</Button>}
          />
        </Card>
      </Frame>
    )
  }

  const one = decision.data
  const over = !!one.expires_at && new Date(one.expires_at) < new Date()
  const answered = appeal.data?.status === 'upheld' || appeal.data?.status === 'declined'

  return (
    <Frame className="space-y-6">
      <div>
        <Link
          to="/standing"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted transition-colors hover:text-white"
        >
          <Glyph icon={faChevronLeft} className="text-xs" />
          Account status
        </Link>

        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          {headlineOf(one)}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm tabular-nums text-muted">{stamp(one.created_at)}</p>
          <ActionTag one={one} />
        </div>
      </div>

      {/* --------------------------------------------------- appeal timeline */}
      {appeal.data && (
        <section>
          <h2 className="mb-3 font-display text-xl font-extrabold">Appeal timeline</h2>
          <Card className="p-5 sm:p-6">
            <ul>
              {answered && appeal.data.decided_at && (
                <Moment
                  title={
                    appeal.data.status === 'upheld'
                      ? 'We upheld an appeal you sent'
                      : 'We declined an appeal you sent'
                  }
                  at={appeal.data.decided_at}
                >
                  <p>
                    {appeal.data.status === 'upheld'
                      ? 'We looked again and took this decision back. Anything it switched off is back on.'
                      : 'We looked again. This decision stands.'}
                  </p>
                  {appeal.data.decision_note && (
                    <Quoted label="What we said:">{appeal.data.decision_note}</Quoted>
                  )}
                </Moment>
              )}

              <Moment title="We received an appeal you sent" at={appeal.data.created_at} last>
                <p>
                  {answered
                    ? 'It went to somebody who was not part of the decision.'
                    : 'It is with somebody who was not part of the decision. You will be told the outcome either way, here and in your inbox.'}
                </p>
                <Quoted label="What you sent:">{appeal.data.body}</Quoted>
              </Moment>
            </ul>
          </Card>
        </section>
      )}

      {/* ------------------------------------------------------ what happened */}
      <section>
        <h2 className="mb-3 font-display text-xl font-extrabold">What happened</h2>
        <Card className="divide-y divide-ink-line p-0">
          <div className="px-5 py-4">
            <p className="text-sm text-muted">Reason</p>
            <p className="mt-0.5 font-bold">{ruleWord[one.rule] ?? one.rule}</p>
          </div>

          <div className="px-5 py-4">
            <p className="text-sm text-muted">What we did</p>
            <p className="mt-0.5 font-bold">{actionWord[one.action]}</p>
          </div>

          {!!one.blocks?.length && (
            <div className="px-5 py-4">
              <p className="text-sm text-muted">What it switched off</p>
              <p className="mt-0.5 font-bold">
                {one.blocks.map((b) => blockWord[b] ?? b).join(', ')}
                {one.expires_at && (over ? ', which has since ended' : ` until ${day(one.expires_at)}`)}
              </p>
            </div>
          )}

          <div className="px-5 py-4">
            <p className="text-sm text-muted">What a moderator wrote</p>
            <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-white/75">
              {one.reason}
            </p>
          </div>

          {one.is_void && (
            <div className="px-5 py-4">
              <p className="text-sm text-muted">This was taken back</p>
              <p className="mt-1.5 leading-relaxed text-space-bright">
                {one.void_reason ?? 'An appeal was upheld, so this no longer counts against you.'}
              </p>
            </div>
          )}
        </Card>
      </section>

      {/* ------------------------------------------------------------ appeal */}
      {state.data?.may && (
        <Card className="space-y-4 p-5 sm:p-6">
          {writing ? (
            <>
              <div>
                <h2 className="font-display text-lg font-extrabold">
                  {state.data?.used ? 'Your second and last appeal' : 'Appeal this decision'}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  We look at what you were sanctioned for again, so it can be lifted, softened,
                  or made heavier if what we find is worse.
                </p>
              </div>
              <textarea
                value={words}
                onChange={(e) => setWords(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="What happened, from your side."
                aria-label="Your appeal"
                className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
              />
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-xs text-muted">
                  {words.trim().length < 20
                    ? `At least ${20 - words.trim().length} more characters.`
                    : `${2000 - words.length} left.`}
                </p>
                <Button variant="ghost" onClick={() => setWriting(false)}>Cancel</Button>
                <Button onClick={send} loading={sending} disabled={words.trim().length < 20}>
                  Send appeal
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Glyph icon={faGavel} className="text-lg text-brand-bright" />
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/65">
                {state.data?.used
                  ? 'You have one more go at this'
                  : 'Think this is wrong? Somebody who was not part of it reads your appeal'}
                {state.data?.closes_at && <>, until <span className="font-bold text-white">{day(state.data.closes_at)}</span></>}.
              </p>
              <Button variant="subtle" onClick={() => setWriting(true)}>Appeal this</Button>
            </div>
          )}
        </Card>
      )}
    </Frame>
  )
}

/**
 * One decision, on the At Kobblon chrome rather than the app's.
 *
 * Standing is read from a link in an email as often as from inside the
 * site, and it is on the side of Kobblon that explains itself: the same
 * bar, the same foot, the same dark. The column stays narrow, because a
 * single decision read line by line is the one place on this side a wide
 * measure would be wrong.
 */
function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <AboutShell>
      <Band tone="raised">
        <Lane className={cn('max-w-3xl', className)}>{children}</Lane>
      </Band>
    </AboutShell>
  )
}
