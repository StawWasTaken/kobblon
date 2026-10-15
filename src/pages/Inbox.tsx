import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faEnvelopeOpenText, faGavel, faLock, faHeadset, faScroll, faBullhorn,
  faCheckDouble, faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { CurrencyMark } from '@/components/brand/Currency'
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
 */

const kindLook: Record<MailKind, { icon: IconDefinition; word: string; tone: string }> = {
  moderation: { icon: faGavel, word: 'Moderation', tone: 'text-amber-300' },
  security: { icon: faLock, word: 'Security', tone: 'text-danger' },
  support: { icon: faHeadset, word: 'Support', tone: 'text-link' },
  policy: { icon: faScroll, word: 'Policy', tone: 'text-white/70' },
  announcement: { icon: faBullhorn, word: 'Kobblon', tone: 'text-brand-bright' },
  money: { icon: faEnvelopeOpenText, word: 'Money', tone: 'text-space-bright' },
}

function LetterCard({ letter, onOpen }: { letter: Letter; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const look = kindLook[letter.kind]

  const toggle = () => {
    setOpen((was) => !was)
    if (!letter.is_read) onOpen()
  }

  return (
    <Card
      className={cn(
        'overflow-hidden border-l-2 p-0 transition-colors',
        letter.is_read ? 'border-l-transparent' : 'border-l-brand-bright',
      )}
    >
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-ink-hover"
      >
        <span
          className={cn(
            'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink-raised',
            look.tone,
          )}
        >
          {letter.kind === 'money'
            ? <CurrencyMark className="h-4 w-4" />
            : <Glyph icon={look.icon} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {look.word}
            </span>
            {!letter.is_read && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-onbrand">
                New
              </span>
            )}
            <span className="ml-auto text-xs text-muted">{timeAgo(letter.created_at)}</span>
          </span>
          <span
            className={cn(
              'mt-1 block font-display text-lg font-extrabold leading-snug',
              letter.is_read && 'text-white/75',
            )}
          >
            {letter.subject}
          </span>
          {!open && (
            <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted">
              {letter.body}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-ink-line px-5 pb-5 pt-4">
          <p className="whitespace-pre-wrap leading-relaxed text-white/75">{letter.body}</p>
          {letter.link && (
            <Link
              to={letter.link}
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-link hover:underline"
            >
              Go to it
              <Glyph icon={faArrowRight} className="text-xs" />
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}

export default function Inbox() {
  useTitle('Inbox')
  const { profile } = useAuth()
  const mail = useAsync(async () => (profile ? listMail() : []), [profile?.id])
  const [tab, setTab] = useState<'all' | 'new'>('all')

  const all = mail.data ?? []
  const unread = all.filter((one) => !one.is_read).length
  const shown = useMemo(
    () => (tab === 'new' ? all.filter((one) => !one.is_read) : all),
    [all, tab],
  )

  const open = async (letter: Letter) => {
    if (letter.is_read) return
    await readLetter(letter.id)
    window.dispatchEvent(new Event('kobblon:mail'))
    mail.reload()
  }

  const readEverything = async () => {
    await readAllMail()
    window.dispatchEvent(new Event('kobblon:mail'))
    mail.reload()
  }

  return (
    <Page width="narrow" className="space-y-6">
      <PageHeader
        kicker="From Kobblon"
        icon={faEnvelopeOpenText}
        title="Inbox"
        lead="Decisions, security notices and replies from support. Never another person."
        actions={
          <>
            <Tabs
              value={tab}
              onChange={setTab}
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

      {mail.loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      )}
      {mail.error && <ErrorState message={mail.error} onRetry={mail.reload} />}

      {!mail.loading && !shown.length && (
        <Card>
          <EmptyState
            mood="emptyBox"
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

      <div className="space-y-3">
        {shown.map((letter) => (
          <LetterCard key={letter.id} letter={letter} onOpen={() => open(letter)} />
        ))}
      </div>
    </Page>
  )
}
