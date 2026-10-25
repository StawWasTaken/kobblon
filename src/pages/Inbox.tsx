import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faEnvelopeOpenText, faGavel, faLock, faHeadset, faScroll, faBullhorn,
  faCheckDouble, faArrowRight, faArrowLeft, faInbox,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { CurrencyMark } from '@/components/brand/Currency'
import { Kobby } from '@/components/brand/Kobby'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { listMail, readAllMail, readLetter } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Letter, MailKind } from '@/types/db'

/*
 * Post from Kobblon itself.
 *
 * Deliberately not the bell. A moderation decision, a security notice or a
 * reply from support cannot be allowed to scroll past behind six people
 * liking a Space, so official post has its own table, its own count and its
 * own address, and nothing in a browser can write to it.
 *
 * Staw, 25 October: "redesign the inbox". What it was: one column of cards
 * that each unfolded where they stood, so reading the fourth letter pushed
 * the first three off the top of the screen and going back to one meant
 * finding it again. It is a list and a reading pane now, which is the shape
 * every inbox has for the same reason - the list is how you choose and the
 * pane is how you read, and a card that is both keeps losing your place.
 *
 * On a phone there is only room for one of the two, so it is the list until
 * you pick something and the letter after that, with the way back at the
 * top. That is the same behaviour, not a second design: the pane is simply
 * the whole width when the width is all there is.
 */

const kindLook: Record<MailKind, {
  icon: IconDefinition
  word: string
  /** The letter's own colour, used for its mark and its edge. */
  tint: string
  edge: string
}> = {
  moderation: { icon: faGavel, word: 'Moderation', tint: 'text-amber-300', edge: 'bg-amber-300' },
  security: { icon: faLock, word: 'Security', tint: 'text-danger', edge: 'bg-danger' },
  support: { icon: faHeadset, word: 'Support', tint: 'text-link', edge: 'bg-link' },
  policy: { icon: faScroll, word: 'Policy', tint: 'text-white/70', edge: 'bg-white/50' },
  announcement: { icon: faBullhorn, word: 'Kobblon', tint: 'text-brand-bright', edge: 'bg-brand-bright' },
  money: { icon: faEnvelopeOpenText, word: 'Money', tint: 'text-space-bright', edge: 'bg-space-bright' },
}

/** The mark a letter wears, in its own colour. */
function Mark({ kind, size = 'md' }: { kind: MailKind; size?: 'sm' | 'md' }) {
  const look = kindLook[kind]
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl border border-ink-line bg-ink-raised',
        size === 'sm' ? 'h-9 w-9' : 'h-11 w-11',
        look.tint,
      )}
    >
      {kind === 'money'
        ? <CurrencyMark className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
        : <Glyph icon={look.icon} />}
    </span>
  )
}

/*
 * One line in the list.
 *
 * Unread is carried by three things at once - the stripe down the edge, the
 * weight of the subject and the dot - because one of them on its own was the
 * dot, and a dot is what somebody misses.
 */
function LetterLine({ letter, active, onPick }: {
  letter: Letter
  active: boolean
  onPick: () => void
}) {
  const look = kindLook[letter.kind]

  return (
    <button
      onClick={onPick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'relative flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
        active ? 'bg-ink-hover' : 'hover:bg-ink-hover/60',
      )}
    >
      {!letter.is_read && (
        <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-[3px]', look.edge)} />
      )}

      <Mark kind={letter.kind} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-[11px] font-extrabold uppercase tracking-wide', look.tint)}>
            {look.word}
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-muted">{timeAgo(letter.created_at)}</span>
          {!letter.is_read && (
            <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-brand-bright" />
          )}
        </span>
        <span
          className={cn(
            'mt-0.5 block truncate text-sm leading-snug',
            letter.is_read ? 'font-semibold text-white/70' : 'font-extrabold text-white',
          )}
        >
          {letter.subject}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{letter.body}</span>
      </span>
    </button>
  )
}

/** The letter itself, open. */
function Reading({ letter, onBack }: { letter: Letter; onBack: () => void }) {
  const look = kindLook[letter.kind]
  const when = new Date(letter.created_at)

  return (
    <div className="space-y-3">
      {/* The way back, where the list is not beside it. Above the letter
          rather than inside its header: in the header it sat against the
          subject and squeezed it onto three lines at the one width it is
          ever drawn at. */}
      <Button size="sm" variant="ghost" icon={faArrowLeft} onClick={onBack} className="lg:hidden">
        All letters
      </Button>

      <Card className="overflow-hidden p-0">
        <div className="flex items-start gap-4 border-b border-ink-line bg-ink-raised p-5">
          <Mark kind={letter.kind} />

          <div className="min-w-0 flex-1">
            <p className={cn('text-[11px] font-extrabold uppercase tracking-wide', look.tint)}>
              {look.word}
            </p>
            <h2 className="mt-1 font-display text-xl font-extrabold leading-snug">
              {letter.subject}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {when.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              {' at '}
              {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="p-5">
          <p className="whitespace-pre-wrap leading-relaxed text-white/80">{letter.body}</p>

          {letter.link && (
            <Link
              to={letter.link}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-4 py-2.5 text-sm font-bold text-link transition-colors hover:bg-ink-hover"
            >
              Go to it
              <Glyph icon={faArrowRight} className="text-xs" />
            </Link>
          )}
        </div>
      </Card>
    </div>
  )
}

export default function Inbox() {
  useTitle('Inbox')
  const { profile } = useAuth()
  const mail = useAsync(async () => (profile ? listMail() : []), [profile?.id])
  const [tab, setTab] = useState<'all' | 'new'>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const all = mail.data ?? []
  const unread = all.filter((one) => !one.is_read).length
  const shown = useMemo(
    () => (tab === 'new' ? all.filter((one) => !one.is_read) : all),
    [all, tab],
  )

  /*
   * The newest letter is open to begin with, on a laptop.
   *
   * Not on a phone: there the pane is the whole screen, so choosing for
   * somebody would be opening a letter they did not ask for and hiding the
   * list behind it. `lg` is the same breakpoint the layout uses, read once
   * at mount rather than watched - the two-pane view only needs an opinion
   * about where to start.
   */
  useEffect(() => {
    if (openId !== null || !shown.length) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    setOpenId(shown[0].id)
  }, [shown, openId])

  const letter = shown.find((one) => one.id === openId)
    ?? all.find((one) => one.id === openId)
    ?? null

  const pick = async (one: Letter) => {
    setOpenId(one.id)
    if (one.is_read) return
    await readLetter(one.id)
    window.dispatchEvent(new Event('kobblon:mail'))
    mail.reload()
  }

  const readEverything = async () => {
    await readAllMail()
    window.dispatchEvent(new Event('kobblon:mail'))
    mail.reload()
  }

  const empty = !mail.loading && !shown.length

  return (
    <Page className="space-y-6">
      <PageHeader
        kicker="From Kobblon"
        icon={faEnvelopeOpenText}
        title="Inbox"
        lead="Decisions, security notices and replies from support. Never another person."
        actions={
          <>
            <Tabs
              value={tab}
              onChange={(next) => { setTab(next); setOpenId(null) }}
              label="Which letters"
              options={[
                { value: 'all', label: 'Everything', count: all.length || null },
                { value: 'new', label: 'Unread', count: unread || null },
              ]}
            />
            {unread > 0 && (
              <Button size="sm" variant="ghost" icon={faCheckDouble} onClick={readEverything}>
                Mark all read
              </Button>
            )}
          </>
        }
      />

      {mail.error && <ErrorState message={mail.error} onRetry={mail.reload} />}

      {mail.loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      )}

      {empty && !mail.error && (
        <Card>
          <EmptyState
            mood="noResults"
            title={tab === 'new' ? 'Nothing unread' : 'No post yet'}
            body={
              tab === 'new'
                ? 'You have read everything Kobblon has sent you.'
                : 'Kobblon writes here when something happens to your account.'
            }
            action={
              tab === 'new'
                ? <Button variant="subtle" onClick={() => setTab('all')}>Show everything</Button>
                : <Button variant="subtle" to="/standing">Where you stand</Button>
            }
          />
        </Card>
      )}

      {!mail.loading && !mail.error && !!shown.length && (
        <div className="grid gap-5 lg:grid-cols-[19rem,1fr] lg:items-start">
          {/* The list. On a phone it steps aside once a letter is open. */}
          <Card
            className={cn(
              'overflow-hidden p-0 lg:sticky lg:top-20',
              letter && 'hidden lg:block',
            )}
          >
            <p className="flex items-center gap-2 border-b border-ink-line px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              <Glyph icon={faInbox} className="text-brand-bright" />
              {shown.length} letter{shown.length === 1 ? '' : 's'}
            </p>

            <div className="max-h-[32rem] divide-y divide-ink-line overflow-y-auto lg:max-h-[36rem]">
              {shown.map((one) => (
                <LetterLine
                  key={one.id}
                  letter={one}
                  active={one.id === openId}
                  onPick={() => void pick(one)}
                />
              ))}
            </div>
          </Card>

          {/* The reading pane. */}
          {letter ? (
            <Reading letter={letter} onBack={() => setOpenId(null)} />
          ) : (
            <Card className="hidden lg:block">
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <Kobby mood="notification" size="md" />
                <h3 className="mt-5 text-lg font-extrabold">Pick a letter</h3>
                <p className="mt-1.5 max-w-xs text-sm text-muted">
                  Everything Kobblon has written to you is on the left.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </Page>
  )
}
