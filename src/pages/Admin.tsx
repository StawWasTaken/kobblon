/*
 * The Kobblon account's panel.
 *
 * One place to moderate from, rather than a migration for every flagged word
 * and a SQL editor for everything else. Staw asked for people, notifications,
 * Brix, deletion, the verified badge and the flagged words, and this is all
 * six with nothing in it that does not work.
 *
 * Everything here draws a button; the database decides whether pressing it
 * does anything. `is_admin` in this file chooses what to render and nothing
 * more, because a check in a browser is a decoration - anybody can open the
 * console and call the function this page calls. Each one refuses a caller
 * who is not staff and writes down what was done, which is why the record at
 * the bottom is a section rather than an afterthought.
 */
import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserShield, faBell, faTrash, faCircleCheck, faBan, faShieldHalved,
  faMagnifyingGlass, faPlus, faScroll, faSpinner, faFilter, faUserSlash,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Navigate } from 'react-router-dom'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Confirm } from '@/components/ui/Confirm'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { CurrencyMark } from '@/components/brand/Currency'
import { avatarOf } from '@/lib/avatars'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  deleteAccountAsStaff, deleteFlaggedTerm, findPeopleAsStaff, listAdminLog,
  listFlaggedTerms, moveBrixAsStaff, notifyAsStaff, notifyEveryone,
  saveFlaggedTerm, setStanding, tryFlaggedTerm,
} from '@/lib/api'
import type { AdminLogEntry, FlaggedTerm, StaffPerson } from '@/lib/api'

type Section = 'People' | 'Announce' | 'Words' | 'Record'

const sections: { name: Section; icon: IconDefinition; blurb: string }[] = [
  { name: 'People', icon: faUserShield, blurb: 'Standing, Brix, and removing an account' },
  { name: 'Announce', icon: faBell, blurb: 'A word from Kobblon, to one person or everybody' },
  { name: 'Words', icon: faFilter, blurb: 'What the moderation system catches' },
  { name: 'Record', icon: faScroll, blurb: 'What staff have done' },
]

/* ------------------------------------------------------------------ people */

export function PersonRow({ person, onChanged }: {
  person: StaffPerson
  onChanged: () => void
}) {
  const say = useToast()
  const [busy, setBusy] = useState(false)
  const [brix, setBrix] = useState('')
  const [note, setNote] = useState('')
  const [saying, setSaying] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [why, setWhy] = useState('')

  /*
   * Every action goes through here so that a failure is shown rather than
   * swallowed. The refusals in the database are written to be read by a
   * person - "An admin cannot be deleted from here." - so the message is
   * shown as it came rather than replaced with something vaguer.
   */
  const run = async (what: string, doIt: () => Promise<void>) => {
    setBusy(true)
    try {
      await doIt()
      say(what, 'success')
      onChanged()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const amount = Number.parseInt(brix, 10)
  const canMove = Number.isFinite(amount) && amount !== 0

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <Avatar src={avatarOf(person)} name={person.display_name ?? person.username} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            <span className="truncate">{person.display_name ?? person.username}</span>
            {person.is_admin && <Badge tone="brand">Admin</Badge>}
            {person.is_moderator && !person.is_admin && <Badge tone="brand">Moderator</Badge>}
            {person.is_verified && <Badge tone="space">Verified</Badge>}
            {person.is_suspended && <Badge tone="danger">Suspended</Badge>}
            {person.is_guest && <Badge>Guest</Badge>}
          </p>
          <p className="truncate text-xs text-muted">
            @{person.username} · #{person.content_id} · here {timeAgo(person.created_at)}
          </p>
        </div>
        <p className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
          <CurrencyMark />
          {formatCount(person.pixels)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="subtle"
          disabled={busy}
          onClick={() => run(
            person.is_verified ? 'Badge taken back.' : 'Verified.',
            () => setStanding(person.id, { verified: !person.is_verified }),
          )}
        >
          <FontAwesomeIcon icon={faCircleCheck} />
          {person.is_verified ? 'Unverify' : 'Verify'}
        </Button>

        <Button
          size="sm"
          variant="subtle"
          disabled={busy}
          onClick={() => run(
            person.is_moderator ? 'No longer a moderator.' : 'Now a moderator.',
            () => setStanding(person.id, { moderator: !person.is_moderator }),
          )}
        >
          <FontAwesomeIcon icon={faShieldHalved} />
          {person.is_moderator ? 'Remove mod' : 'Make mod'}
        </Button>

        <Button size="sm" variant="subtle" disabled={busy} onClick={() => setSaying(true)}>
          <FontAwesomeIcon icon={faBell} />
          Notify
        </Button>

        {/* An admin cannot be suspended or deleted from here, and the
            database says so too. Not drawing the buttons saves somebody
            pressing one to find out. */}
        {!person.is_admin && (
          <>
            <Button
              size="sm"
              variant={person.is_suspended ? 'subtle' : 'danger'}
              disabled={busy}
              onClick={() => run(
                person.is_suspended ? 'Suspension lifted.' : 'Suspended.',
                () => setStanding(person.id, { suspended: !person.is_suspended }),
              )}
            >
              <FontAwesomeIcon icon={person.is_suspended ? faBan : faUserSlash} />
              {person.is_suspended ? 'Unsuspend' : 'Suspend'}
            </Button>

            <Button size="sm" variant="danger" disabled={busy} onClick={() => setRemoving(true)}>
              <FontAwesomeIcon icon={faTrash} />
              Delete
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40 shrink-0">
          <Input
            label="Brix"
            value={brix}
            onChange={(e) => setBrix(e.target.value)}
            placeholder="250, or -250"
            inputMode="numeric"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Input
            label="Why"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Shown only in the record"
          />
        </div>
        <Button
          size="sm"
          disabled={busy || !canMove}
          onClick={() => run('Balance changed.', async () => {
            const left = await moveBrixAsStaff(person.id, amount, note || undefined)
            setBrix('')
            setNote('')
            // Said out loud because it may not be what was asked for:
            // taking more than somebody has takes what they have.
            say(`${person.username} now holds ${formatCount(left)}.`, 'info')
          })}
        >
          {amount < 0 ? 'Take' : 'Give'}
        </Button>
      </div>

      <Dialog
        open={saying}
        onClose={() => setSaying(false)}
        title={`A word to @${person.username}`}
        description="It arrives in their Inbox as a notification from Kobblon."
      >
        <NoteSender
          onSend={async (message) => {
            await notifyAsStaff(person.id, message)
            setSaying(false)
            say('Sent.', 'success')
          }}
        />
      </Dialog>

      <Confirm
        open={removing}
        onClose={() => { setRemoving(false); setWhy('') }}
        onConfirm={() => run('Account deleted.', async () => {
          await deleteAccountAsStaff(person.id, why)
          setRemoving(false)
          setWhy('')
        })}
        title={`Delete @${person.username}?`}
        lead="This cannot be undone."
        points={[
          'Their account, profile and everything hanging off it goes.',
          'Their uploads, Worlds and Communities go with it.',
          'The record keeps their name and your reason. Nothing else survives.',
        ]}
        confirmText="Delete for good"
      >
        <Input
          label="Why"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Required. Kept in the record."
        />
      </Confirm>
    </Card>
  )
}

export function PeopleSection() {
  const say = useToast()
  const [search, setSearch] = useState('')
  const [people, setPeople] = useState<StaffPerson[] | null>(null)
  const [looking, setLooking] = useState(false)

  const look = useCallback(async (term: string) => {
    setLooking(true)
    try {
      setPeople(await findPeopleAsStaff(term))
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not look.', 'error')
    } finally {
      setLooking(false)
    }
  }, [say])

  return (
    <div className="space-y-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); void look(search) }}
      >
        <div className="min-w-0 flex-1">
          <Input
            label="Find somebody"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="A name, a handle, or the number on their profile"
          />
        </div>
        <Button type="submit" disabled={looking}>
          <FontAwesomeIcon icon={looking ? faSpinner : faMagnifyingGlass} spin={looking} />
          Look
        </Button>
      </form>

      {people === null && (
        <p className="py-8 text-center text-sm text-muted">
          Search for somebody, or press Look with the box empty for the newest accounts.
        </p>
      )}
      {people?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">Nobody matches that.</p>
      )}
      {people?.map((person) => (
        <PersonRow key={person.id} person={person} onChanged={() => void look(search)} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- announcing */

const LONGEST = 500

/** The box itself, shared by the one-person dialog and the everybody panel. */
function NoteSender({ onSend, action = 'Send' }: {
  onSend: (message: string) => Promise<void>
  action?: string
}) {
  const say = useToast()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    try {
      await onSend(message.trim())
      setMessage('')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not send.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        label="What it says"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, LONGEST))}
        placeholder="Kobblon will be down for an hour this evening."
        rows={4}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={cn(
          'font-display text-xs uppercase tracking-wider',
          message.length >= LONGEST ? 'text-danger' : 'text-muted',
        )}>
          {LONGEST - message.length} left
        </span>
        <Button variant="yes" disabled={busy || !message.trim()} onClick={() => void send()}>
          {busy ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faBell} />}
          {action}
        </Button>
      </div>
    </div>
  )
}

export function AnnounceSection() {
  const say = useToast()
  const [confirming, setConfirming] = useState('')

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div>
          <h2 className="font-display text-sm uppercase tracking-wider">Everybody</h2>
          <p className="text-sm text-muted">
            One notification to every account that is not a guest and not suspended.
            A guest account lives in one browser and is usually gone before anybody
            reads it.
          </p>
        </div>
        <NoteSender
          action="Send to everybody"
          onSend={async (message) => { setConfirming(message) }}
        />
      </Card>

      <Confirm
        open={Boolean(confirming)}
        onClose={() => setConfirming('')}
        onConfirm={async () => {
          try {
            const reached = await notifyEveryone(confirming)
            say(`Sent to ${formatCount(reached)} people.`, 'success')
          } catch (error) {
            say(error instanceof Error ? error.message : 'That did not send.', 'error')
          } finally {
            setConfirming('')
          }
        }}
        title="Send this to everybody?"
        lead="There is no way to take a notification back once it has landed."
        points={[
          'It goes to every account that is not a guest and not suspended.',
          'It arrives as a notification from Kobblon, with no staff name on it.',
        ]}
        confirmText="Send it"
      >
        <p className="rounded-xl border border-ink-line bg-ink-sunken p-3 text-sm">
          {confirming}
        </p>
      </Confirm>
    </div>
  )
}

/* ------------------------------------------------------------------ words */

const decisions = [
  { value: 'block', label: 'Block — refuse it outright' },
  { value: 'review', label: 'Review — let it through and flag it' },
  { value: 'ok', label: 'Allow — an exception to another pattern' },
] as const

export function WordsSection() {
  const say = useToast()
  const [terms, setTerms] = useState<FlaggedTerm[] | null>(null)
  const [editing, setEditing] = useState<Partial<FlaggedTerm> | null>(null)
  const [sample, setSample] = useState('')
  const [caught, setCaught] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setTerms(await listFlaggedTerms())
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not read the list.', 'error')
      setTerms([])
    }
  }, [say])

  // Loaded when the section is opened rather than with the page, because
  // three of the four sections have nothing to do with this list. In an
  // effect, not in the render: calling it while rendering sets state, which
  // renders again, which calls it again.
  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!editing?.pattern) return
    setBusy(true)
    try {
      await saveFlaggedTerm({
        id: editing.id ?? null,
        pattern: editing.pattern,
        decision: (editing.decision ?? 'block') as FlaggedTerm['decision'],
        reason: editing.reason ?? null,
        scope: editing.scope ?? 'all',
      })
      say('Saved.', 'success')
      setEditing(null)
      setCaught(null)
      setSample('')
      await load()
    } catch (error) {
      // A pattern that will not compile comes back with the reason Postgres
      // gave, which is far more use than "invalid".
      say(error instanceof Error ? error.message : 'That did not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const tone = (decision: string) =>
    decision === 'block' ? 'danger' : decision === 'review' ? 'warm' : 'space'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">
          Every pattern is a regular expression, matched without regard to case
          against names, descriptions and messages. Editing this list changes
          what Kobblon catches immediately — it used to take a migration.
        </p>
        <Button
          variant="yes"
          onClick={() => { setEditing({ decision: 'block', scope: 'all' }); setCaught(null) }}
        >
          <FontAwesomeIcon icon={faPlus} />
          Add
        </Button>
      </div>

      {terms === null && <Skeleton className="h-40" />}
      {terms?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          Nothing is being caught. Anything anybody types goes straight through.
        </p>
      )}

      <div className="space-y-2">
        {terms?.map((term) => (
          <Card key={term.id} className="flex flex-wrap items-center gap-3 p-3">
            <Badge tone={tone(term.decision)}>{term.decision}</Badge>
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{term.pattern}</code>
            <span className="text-xs text-muted">{term.reason}</span>
            <span className="font-display text-[10px] uppercase tracking-wider text-muted">
              {term.scope}
            </span>
            <Button size="sm" variant="subtle" onClick={() => { setEditing(term); setCaught(null) }}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                try {
                  await deleteFlaggedTerm(term.id)
                  say('Removed.', 'success')
                  await load()
                } catch (error) {
                  say(error instanceof Error ? error.message : 'Could not remove.', 'error')
                }
              }}
            >
              <FontAwesomeIcon icon={faTrash} />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit this pattern' : 'A new pattern'}
        description="Try it against a line of text before saving it. This list is read against everything anybody types."
      >
        <div className="space-y-3">
          <Input
            label="Pattern"
            value={editing?.pattern ?? ''}
            onChange={(e) => { setEditing({ ...editing, pattern: e.target.value }); setCaught(null) }}
            placeholder="(^|[^a-z])(word|another)"
            className="font-mono"
          />
          <Select
            label="What to do"
            value={editing?.decision ?? 'block'}
            onChange={(decision) => setEditing({ ...editing, decision: decision as FlaggedTerm['decision'] })}
            options={decisions.map((one) => ({ value: one.value, label: one.label }))}
          />
          <Input
            label="Reason"
            value={editing?.reason ?? ''}
            onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
            placeholder="Slur, Scam, Sexual content…"
          />

          {/* Trying it first, because this list runs against everything
              anybody types and a pattern that catches too much is only
              discovered through the people it wrongly refuses. */}
          <div className="space-y-2 rounded-xl border border-ink-line bg-ink-sunken p-3">
            <Input
              label="Try it against"
              value={sample}
              onChange={(e) => { setSample(e.target.value); setCaught(null) }}
              placeholder="A line of text"
            />
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="subtle"
                disabled={!editing?.pattern || !sample}
                onClick={async () => {
                  try {
                    setCaught(await tryFlaggedTerm(editing!.pattern!, sample))
                  } catch (error) {
                    say(error instanceof Error ? error.message : 'Bad pattern.', 'error')
                  }
                }}
              >
                Try it
              </Button>
              {caught !== null && (
                <Badge tone={caught ? 'danger' : 'space'}>
                  {caught ? 'Caught' : 'Let through'}
                </Badge>
              )}
            </div>
          </div>

          <Button variant="yes" disabled={busy || !editing?.pattern} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

/* ----------------------------------------------------------------- record */

export function RecordSection() {
  const [entries, setEntries] = useState<AdminLogEntry[] | null>(null)

  useEffect(() => {
    let wanted = true
    void listAdminLog()
      .then((rows) => { if (wanted) setEntries(rows) })
      .catch(() => { if (wanted) setEntries([]) })
    return () => { wanted = false }
  }, [])

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Everything staff have done, kept where the person who did it cannot
        edit it. A deleted account keeps its name here and nowhere else.
      </p>
      {entries === null && <Skeleton className="h-40" />}
      {entries?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">Nothing yet.</p>
      )}
      {entries?.map((entry) => (
        <Card key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm">
          <Badge>{entry.action}</Badge>
          {entry.subject_label && <span className="font-bold">@{entry.subject_label}</span>}
          <span className="min-w-0 flex-1 truncate text-xs text-muted">
            {Object.entries(entry.detail)
              .filter(([, value]) => value !== null && value !== '')
              .map(([key, value]) => `${key}: ${String(value)}`)
              .join(' · ')}
          </span>
          <span className="shrink-0 text-xs text-muted">{timeAgo(entry.created_at)}</span>
        </Card>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------- page */

export default function Admin() {
  const { profile, loading } = useAuth()
  const [section, setSection] = useState<Section>('People')
  useTitle('Staff', 'Kobblon')

  if (loading) return <Page><Skeleton className="h-96" /></Page>

  /*
   * Sent away rather than shown an empty panel. This is not what keeps
   * anybody out - the functions do that - it is so a page that would refuse
   * every button is not drawn at all.
   */
  if (!profile?.is_admin) return <Navigate to="/" replace />

  return (
    <Page className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white">
          <FontAwesomeIcon icon={faUserShield} />
        </span>
        <div>
          <h1 className="font-display text-xl">Staff</h1>
          <p className="text-sm text-muted">
            {sections.find((one) => one.name === section)?.blurb}
          </p>
        </div>
      </div>

      <Tabs
        look="line"
        label="What to work on"
        value={section}
        onChange={setSection}
        options={sections.map((one) => ({ value: one.name, label: one.name }))}
      />

      {section === 'People' && <PeopleSection />}
      {section === 'Announce' && <AnnounceSection />}
      {section === 'Words' && <WordsSection />}
      {section === 'Record' && <RecordSection />}
    </Page>
  )
}
