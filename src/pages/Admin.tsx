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
  faMagnifyingGlass, faPlus, faScroll, faSpinner, faFilter, faUserSlash, faFileImage,
  faTag, faFlag, faGlobe, faBullhorn,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Link, Navigate } from 'react-router-dom'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { StaffMark } from '@/components/brand/Verified'
import { Dialog } from '@/components/ui/Dialog'
import { Confirm } from '@/components/ui/Confirm'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { CurrencyMark } from '@/components/brand/Currency'
import { avatarOf } from '@/lib/avatars'
import { formatCount, timeAgo } from '@/lib/format'
import { avatarKindLabels, kindLabels } from '@/lib/kinds'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'
import {
  deleteAccountAsStaff, deleteFlaggedTerm, findPeopleAsStaff, listAdminLog,
  listFlaggedTerms, moveBrixAsStaff, notifyAsStaff, notifyEveryone,
  saveFlaggedTerm, setStanding, tryFlaggedTerm,
  avatarReviewQueue, reviewAvatarItem, screeningQueue, reviewAsset,
  cardFor, previewUrl, saleNow, startCatalogSale, endCatalogSale,
  reportQueue, settleReport, wherePeopleAre, noticeNow, putUpNotice, takeDownNotice,
} from '@/lib/api'
import type { AdminLogEntry, FlaggedTerm, ReportRow, StaffPerson } from '@/lib/api'
import { PersonSheet } from '@/components/staff/PersonSheet'
import { WorldMap } from '@/components/staff/WorldMap'

type Section = 'People' | 'Reports' | 'Screening' | 'Sale' | 'Map' | 'Notice' | 'Announce' | 'Words' | 'Record'

const sections: { name: Section; icon: IconDefinition; blurb: string }[] = [
  { name: 'People', icon: faUserShield, blurb: 'Standing, Brix, and removing an account' },
  { name: 'Reports', icon: faFlag, blurb: 'What people have reported, and what was done' },
  { name: 'Screening', icon: faCircleCheck, blurb: 'What people have made, waiting on a decision' },
  { name: 'Sale', icon: faTag, blurb: 'Everything in the Catalog, cheaper, for a while' },
  { name: 'Map', icon: faGlobe, blurb: 'Roughly where people are, by the clock on their machine' },
  { name: 'Notice', icon: faBullhorn, blurb: 'A line across the top of the site, which anybody can close' },
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
        <Avatar src={avatarOf(person)} personId={person.id} name={person.display_name ?? person.username} size="sm" />
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

        {/*
          * The badge on its own, which hands out no power at all. Kept
          * beside the one that does, and worded so the difference is on the
          * button rather than in somebody's memory: a moderator already
          * wears the k, so this says so instead of offering to give them
          * one they have.
          */}
        <Button
          size="sm"
          variant="subtle"
          disabled={busy || person.is_moderator || person.is_admin}
          onClick={() => run(
            person.has_staff_badge ? 'Badge taken off.' : 'Badge given. It carries no power.',
            () => setStanding(person.id, { staffBadge: !person.has_staff_badge }),
          )}
        >
          <StaffMark className="text-[11px]" />
          {person.is_moderator || person.is_admin
            ? 'Wears the k'
            : person.has_staff_badge ? 'Take the k' : 'Give the k'}
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
  /** Whoever is open, which is how a list of names becomes a console. */
  const [open, setOpen] = useState<StaffPerson | null>(null)

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
        <div key={person.id} className="space-y-2">
          <PersonRow person={person} onChanged={() => void look(search)} />
          <button
            type="button"
            onClick={() => setOpen(open?.id === person.id ? null : person)}
            className="text-xs font-bold text-link hover:underline"
          >
            {open?.id === person.id ? 'Close the record' : 'Open the record'}
          </button>
          {open?.id === person.id && <PersonSheet person={person} />}
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- reports */

/**
 * What people have reported, and settling it.
 *
 * Staff only, decided in the database. A report says what it is about and
 * links to it, because a queue of reasons with no way to the thing is a
 * queue nobody works through.
 */
export function ReportsSection() {
  const say = useToast()
  const [which, setWhich] = useState<'open' | 'actioned' | 'dismissed' | 'all'>('open')
  const [busy, setBusy] = useState<number | null>(null)
  const reports = useAsync(async () => reportQueue(which, 200), [which])

  const settle = async (id: number, how: 'actioned' | 'dismissed') => {
    setBusy(id)
    try {
      await settleReport(id, how)
      say(how === 'actioned' ? 'Marked as dealt with.' : 'Dismissed.', 'success')
      reports.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const whereIsIt = (row: ReportRow) => {
    if (row.target_type === 'profile' && row.about_username) return `/u/${row.about_username}`
    if (row.target_type === 'avatar_item') return '/catalog'
    return null
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        What people have reported. Settling one says what staff did about it;
        it does not do it - taking something down or suspending somebody are
        their own doors, on purpose.
      </p>

      <Tabs
        label="Which reports"
        value={which}
        onChange={(next) => setWhich(next as typeof which)}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'actioned', label: 'Dealt with' },
          { value: 'dismissed', label: 'Dismissed' },
          { value: 'all', label: 'Everything' },
        ]}
      />

      {reports.loading ? <Skeleton className="h-40" /> : !reports.data?.length ? (
        <p className="py-8 text-center text-sm text-muted">Nothing here.</p>
      ) : reports.data.map((row) => {
        const to = whereIsIt(row)
        return (
          <Card key={row.id} className="flex flex-wrap items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <Badge tone={row.status === 'open' ? 'warm' : 'neutral'}>{row.reason}</Badge>
                <span className="text-sm font-bold">
                  {row.about_name ?? row.target_type}
                </span>
                {row.about_username && (
                  <span className="text-xs text-muted">@{row.about_username}</span>
                )}
                <span className="text-xs text-muted">{timeAgo(row.created_at)}</span>
              </p>
              {row.details && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{row.details}</p>
              )}
              <p className="mt-1 text-xs text-muted">
                Reported by{' '}
                {row.reporter_username
                  ? <Link to={`/u/${row.reporter_username}`} className="font-bold text-link hover:underline">@{row.reporter_username}</Link>
                  : 'somebody'}
                {to && (
                  <> · <Link to={to} className="font-bold text-link hover:underline">Open it</Link></>
                )}
              </p>
            </div>

            {row.status === 'open' && (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="yes"
                  loading={busy === row.id}
                  onClick={() => void settle(row.id, 'actioned')}
                >
                  Dealt with
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === row.id}
                  onClick={() => void settle(row.id, 'dismissed')}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- map */

/** Roughly where people are, and what that does and does not mean. */
export function MapSection() {
  const dots = useAsync(async () => wherePeopleAre(30), [])

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        A dot per time zone, sized by how many accounts have been seen there
        in the last month. The zone is what a browser reports - a setting on
        somebody's own machine - and a zone's coordinates are the zone's, not
        the person's. Kobblon asks no service where anybody is.
      </p>

      {dots.loading
        ? <Skeleton className="aspect-[2/1] w-full rounded-2xl" />
        : <WorldMap dots={dots.data ?? []} />}

      {!!dots.data?.length && (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {dots.data.slice(0, 12).map((one) => (
            <li key={one.zone} className="flex justify-between gap-3">
              <span className="truncate text-muted">{one.zone}</span>
              <span className="font-bold tabular-nums">{one.how_many}</span>
            </li>
          ))}
        </ul>
      )}
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

/* ---------------------------------------------------------------- screening */

/**
 * One thing waiting for a decision, Catalog or Marketplace.
 *
 * The two queues are different tables with different rules and the same job,
 * so they are one row component taking what both have: a picture, a name, a
 * maker, and the two buttons. Rejecting asks for a reason first - the note
 * is the whole of what the maker is told, and a rejection with nothing said
 * is somebody's work disappearing.
 */
export function ScreenRow({ picture, name, kind, description, maker, makerLink, when, onDecide }: {
  picture: string | null
  name: string
  kind: string
  description?: string | null
  maker: string
  makerLink: string
  when?: string | null
  onDecide: (decision: 'approved' | 'rejected', note?: string) => Promise<void>
}) {
  const say = useToast()
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null)
  const [note, setNote] = useState('')
  const [asking, setAsking] = useState(false)

  const decide = async (decision: 'approved' | 'rejected', reason?: string) => {
    setBusy(decision)
    try {
      await onDecide(decision, reason)
      say(decision === 'approved' ? 'Approved.' : 'Rejected.', 'success')
      setAsking(false)
      setNote('')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="flex flex-wrap items-start gap-4 p-3 sm:flex-nowrap">
      <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-ink-raised">
        {picture
          ? <img src={picture} alt="" className="h-full w-full object-contain" />
          : <FontAwesomeIcon icon={faFileImage} className="text-white/25" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold">{name}</span>
          <Badge>{kind}</Badge>
          {when && <span className="text-xs text-muted">{timeAgo(when)}</span>}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          by <Link to={makerLink} className="font-bold text-link hover:underline">@{maker}</Link>
        </p>
        {description && (
          <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-white/70">
            {description}
          </p>
        )}

        {asking && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why it is being turned down"
              className="w-full sm:w-80"
            />
            <Button
              variant="danger"
              size="sm"
              loading={busy === 'rejected'}
              disabled={!note.trim()}
              onClick={() => void decide('rejected', note.trim())}
            >
              Reject it
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>Cancel</Button>
          </div>
        )}
      </div>

      {!asking && (
        <div className="flex shrink-0 gap-2">
          {/* Green, because green is yes. */}
          <Button
            size="sm"
            variant="yes"
            icon={faCircleCheck}
            loading={busy === 'approved'}
            onClick={() => void decide('approved')}
          >
            Approve
          </Button>
          <Button size="sm" variant="danger" icon={faBan} onClick={() => setAsking(true)}>
            Reject
          </Button>
        </div>
      )}
    </Card>
  )
}

/**
 * The two queues.
 *
 * Staff asked for both in one place - "wether its for the catalog or for the
 * creator marketplace" - and they genuinely are one job, so they are one
 * panel with two lists rather than two pages somebody has to remember to
 * check. The count on each tab is the point of the panel: a queue you have
 * to open to find out whether it is empty is a queue that fills up.
 */
export function ScreeningSection() {
  const [queue, setQueue] = useState<'Catalog' | 'Marketplace'>('Catalog')

  const items = useAsync(async () => avatarReviewQueue(100), [])
  const uploads = useAsync(async () => screeningQueue(100), [])

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Everything a person has to look at. Most uploads never reach here -
        the screener approves or refuses them as they arrive - so what is
        waiting is what it could not decide.
      </p>

      <Tabs
        label="Which queue"
        value={queue}
        onChange={(next) => setQueue(next as 'Catalog' | 'Marketplace')}
        options={[
          { value: 'Catalog', label: `Catalog (${items.data?.length ?? 0})` },
          { value: 'Marketplace', label: `Marketplace (${uploads.data?.length ?? 0})` },
        ]}
      />

      {queue === 'Catalog' ? (
        items.loading ? <Skeleton className="h-40" />
          : !items.data?.length ? (
            <p className="py-8 text-center text-sm text-muted">Nothing waiting.</p>
          ) : items.data.map((item) => (
            <ScreenRow
              key={item.id}
              picture={cardFor(item)}
              name={item.name}
              kind={avatarKindLabels[item.kind] ?? item.kind}
              description={item.description}
              maker={item.creator_username ?? ''}
              makerLink={`/u/${item.creator_username}`}
              when={item.created_at}
              onDecide={async (decision, note) => {
                await reviewAvatarItem(item.id, decision, note)
                items.reload()
              }}
            />
          ))
      ) : uploads.loading ? <Skeleton className="h-40" />
        : !uploads.data?.length ? (
          <p className="py-8 text-center text-sm text-muted">Nothing waiting.</p>
        ) : uploads.data.map((one) => (
          <ScreenRow
            key={one.id}
            picture={previewUrl(one.preview_path ?? one.thumbnail_path)}
            name={one.name}
            kind={kindLabels[one.kind] ?? one.kind}
            description={one.description}
            maker={one.creator_username}
            makerLink={`/u/${one.creator_username}`}
            when={one.created_at}
            onDecide={async (decision, note) => {
              await reviewAsset(one.id, decision, note)
              uploads.reload()
            }}
          />
        ))}
    </div>
  )
}


/* -------------------------------------------------------------------- sale */

/**
 * A sale across the whole Catalog, for a while.
 *
 * One number and an end. Everything else - which items, what they come down
 * to, what happens to limiteds - is the database's, and deliberately not
 * offered here: a console that lets somebody choose "include limiteds" is a
 * console that lets somebody break the promise a limited makes.
 */
export function SaleSection() {
  const say = useToast()
  const [percent, setPercent] = useState('20')
  const [days, setDays] = useState('3')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)

  const sale = useAsync(async () => saleNow(), [])

  const start = async () => {
    setBusy(true)
    try {
      const until = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString()
      await startCatalogSale(Number(percent), until, why.trim() || undefined)
      say(`${percent}% off, for ${days} day${days === '1' ? '' : 's'}.`, 'success')
      setWhy('')
      sale.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    setBusy(true)
    try {
      await endCatalogSale()
      say('The sale is over.', 'success')
      sale.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Everything in the Catalog comes down by the same percentage until it
        ends. Limiteds keep their price - somebody paid what a limited cost
        because it was closing - and nothing ever comes down to nothing.
      </p>

      {sale.loading ? <Skeleton className="h-20" /> : sale.data ? (
        <Card className="flex flex-wrap items-center gap-3">
          <Badge tone="space">{sale.data.percent_off}% off</Badge>
          <span className="text-sm">
            until{' '}
            <span className="font-bold">
              {new Date(sale.data.ends_at).toLocaleString(undefined, {
                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </span>
          {sale.data.note && <span className="text-sm text-muted">{sale.data.note}</span>}
          <Button
            className="ml-auto"
            variant="danger"
            size="sm"
            loading={busy}
            onClick={() => void stop()}
          >
            End it now
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm font-bold">Nothing is on sale.</p>
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Percent off"
              type="number"
              min={1}
              max={75}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="w-28"
            />
            <Input
              label="For how many days"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-36"
            />
            <Input
              label="Why (shown on the Catalog)"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Halloween"
              className="w-full sm:w-72"
            />
            <Button
              variant="yes"
              loading={busy}
              disabled={!percent || !days}
              onClick={() => void start()}
            >
              Start it
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}


/* ------------------------------------------------------------- the notice */

/**
 * The green bar across the top of the site.
 *
 * Kobblon only, and the database says so - not a moderator. A notice is the
 * platform speaking in its own voice to everybody at once, which is a
 * different job from moderating.
 *
 * The link is its own field rather than something somebody writes into the
 * words, because then it can be checked: a path here or an https address,
 * and nothing else. The bar renders text and an anchor, never markup.
 */
export function NoticeSection() {
  const say = useToast()
  const live = useAsync(async () => noticeNow(), [])
  const [words, setWords] = useState('')
  const [link, setLink] = useState('')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState('7')
  const [busy, setBusy] = useState(false)

  const put = async () => {
    setBusy(true)
    try {
      await putUpNotice({
        words: words.trim(),
        link: link.trim() || null,
        linkWords: label.trim() || null,
        tone: 'good',
        until: days
          ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      say('It is up.', 'success')
      setWords('')
      setLink('')
      setLabel('')
      live.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const down = async () => {
    setBusy(true)
    try {
      await takeDownNotice()
      say('Taken down.', 'success')
      live.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        A line across the top of every page, under the bar. Anybody can close
        it, and it stays closed for them.
      </p>

      {live.loading ? <Skeleton className="h-16" /> : live.data ? (
        <Card className="flex flex-wrap items-center gap-3">
          <Badge tone="space">Up now</Badge>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{live.data.body}</span>
          {live.data.link && <span className="truncate text-xs text-muted">{live.data.link}</span>}
          <Button variant="danger" size="sm" loading={busy} onClick={() => void down()}>
            Take it down
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3">
          <Input
            label="What it says"
            value={words}
            maxLength={300}
            onChange={(e) => setWords(e.target.value)}
            placeholder="Halloween is on. Everything is 30% off."
          />
          <div className="flex flex-wrap gap-3">
            <Input
              label="Where it goes (optional)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/catalog"
              className="w-full sm:w-64"
              hint="A path here, or an https address."
            />
            <Input
              label="The link's words"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Open the Catalog"
              className="w-full sm:w-56"
            />
            <Input
              label="For how many days"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-36"
            />
          </div>
          <Button variant="yes" loading={busy} disabled={!words.trim()} onClick={() => void put()}>
            Put it up
          </Button>
        </Card>
      )}
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
      {section === 'Reports' && <ReportsSection />}
      {section === 'Screening' && <ScreeningSection />}
      {section === 'Map' && <MapSection />}
      {section === 'Sale' && <SaleSection />}
      {section === 'Notice' && <NoticeSection />}
      {section === 'Announce' && <AnnounceSection />}
      {section === 'Words' && <WordsSection />}
      {section === 'Record' && <RecordSection />}
    </Page>
  )
}
