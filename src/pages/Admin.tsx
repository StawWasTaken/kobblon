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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserShield, faBell, faTrash, faCircleCheck, faBan, faShieldHalved,
  faMagnifyingGlass, faPlus, faScroll, faSpinner, faFilter, faUserSlash, faFileImage, faUserCheck,
  faFlag, faGlobe, faBullhorn, faRobot, faScaleBalanced, faLifeRing, faXmark,
  faStethoscope, faGavel, faCommentSlash, faDoorClosed, faDoorOpen,
  faUnlock, faCoins, faEnvelope, faEraser, faEye, faClipboardList,
  faGaugeHigh, faArrowRight, faBolt, faHeartPulse, faPeopleGroup,
  faChartLine, faArrowTrendUp, faArrowTrendDown, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { StaffMark } from '@/components/brand/Verified'
import { Icon } from '@/components/brand/Icon'
import { kobbyArt } from '@/components/brand/Kobby'
import type { KobIcon } from '@/components/brand/Icon'
import { Dialog } from '@/components/ui/Dialog'
import { Confirm } from '@/components/ui/Confirm'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { Note } from '@/components/ui/Note'
import { Switch } from '@/components/ui/Switch'
import { Choices } from '@/components/ui/Choices'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { CommandBar } from '@/components/staff/CommandBar'
import { AppealsQueue } from '@/components/staff/AppealsQueue'
import { SupportQueue } from '@/components/staff/SupportQueue'
import { CurrencyMark } from '@/components/brand/Currency'
import { avatarOf } from '@/lib/avatars'
import { formatCount, timeAgo } from '@/lib/format'
import { ruleWord } from '@/components/social/standing'
import { avatarKindLabels, kindLabels } from '@/lib/kinds'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'
import { noticeColours, noticeStripes } from '@/components/layout/NoticeBar'
import {
  deleteAccountAsStaff, deleteFlaggedTerm, findPeopleAsStaff,
  staffRecord, staffRecordKinds,
  listFlaggedTerms, moveBrixAsStaff, notifyAsStaff, notifyEveryone,
  saveFlaggedTerm, setStaffRank, setStanding, tryFlaggedTerm,
  avatarReviewQueue, reviewAvatarItem, screeningQueue, reviewAsset,
  cardFor, previewUrl, saleNow, startCatalogSale, endCatalogSale,
  reportQueue, settleReport, wherePeopleAre, noticesNow, putUpNotice, takeDownNotice,
  type NoticeColour, makeAccountReal,
  reportTicket, takeReport, myStaffRank,
  aiSettings, setAiSettings, aiRecent, aiWork, runModeration, groqModels,
  checkTheMachine, sanctionAccount, banAccount, liftAccountBan,
  machinePulse, staffOverview, askKobbyForWords,
  staffCommunities, flagCommunity, verifyCommunity, staffCloseCommunity,
  staffReopenCommunity, staffTransferCommunity, eraseCommunity,
  searchProfiles, type CommunityTab, reopenAccount, eraseAccount,
  economyNow, economyFlow, economyByKind, limitedMarket, addQuest,
} from '@/lib/api'
import { Glyph } from '@/components/brand/Glyph'
import { LineGraph, BarRows } from '@/components/ui/Graph'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { EmptyState } from '@/components/ui/States'
import type { StaffCommunity, Profile } from '@/types/db'
import type {
  MachineStep, FlaggedTerm, ReportRow, ReportTicket, StaffPerson, StaffRank,
  SanctionAction, MachinePulse, KobbyDraft, RecordEntry,
  PeopleFilter, PeopleOrder,
} from '@/lib/api'
import { ReportTriage } from '@/components/staff/ReportTriage'
import { PersonSheet } from '@/components/staff/PersonSheet'
import { CountryMap, sharesByCountry } from '@/components/staff/CountryMap'
import { placeOfZone } from '@/lib/places'

type Section = 'Overview' | 'People' | 'Communities' | 'Reports' | 'Appeals' | 'Support' | 'Screening' | 'Machine' | 'Economy' | 'Map' | 'Notice' | 'Announce' | 'Words' | 'Record'

/*
 * The rank, held once for the whole console.
 *
 * Every section used to ask for it separately, or not ask at all and read
 * `profile.is_admin` - which is how a moderator ended up locked out of the
 * one panel that is their job. It is asked of the database because since 0172
 * the three ranks imply one another and that order is decided there, and it
 * is held in a context so a section never has to ask twice.
 *
 * What it decides is which panels are worth drawing. Nothing more: every
 * function behind every button checks again, and that is the check that
 * counts.
 */
const RankContext = createContext<StaffRank>('moderator')
export const useStaffRank = () => useContext(RankContext)

const rankOrder: Record<StaffRank, number> = {
  none: 0, moderator: 1, admin: 2, superadmin: 3,
}

export const rankWord: Record<StaffRank, string> = {
  none: 'Not staff',
  moderator: 'Moderator',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

const rankLook: Record<StaffRank, string> = {
  none: 'border-ink-line bg-ink-raised text-muted',
  moderator: 'border-space/40 bg-space/10 text-space-bright',
  admin: 'border-brand-bright/50 bg-brand/20 text-white',
  superadmin: 'border-amber-400/50 bg-amber-400/10 text-amber-300',
}

/**
 * What each panel is for, and the lowest rank it is any use to.
 *
 * `needs` is the honest version of what the database already refuses. A
 * moderator shown the Brix box would press it once and be told no, which
 * teaches them the console lies to them.
 */
const sections: {
  name: Section
  icon: IconDefinition
  /*
   * Kobblon's own drawing of it, where there is one.
   *
   * Staw: "since we have our own icons we shall use them when possible".
   * Not every panel has one - there is no drawing of a globe or a ledger -
   * and a near-miss from the set would be worse than the plain glyph, so
   * those keep theirs and it is deliberate rather than unfinished.
   */
  art?: KobIcon
  blurb: string
  needs: StaffRank
}[] = [
  { name: 'Overview', icon: faGaugeHigh, art: 'admin', needs: 'moderator', blurb: 'What is waiting, and whether the machine is keeping up' },
  { name: 'Reports', icon: faFlag, art: 'report', needs: 'moderator', blurb: 'What people have reported, and what was done' },
  { name: 'Appeals', icon: faScaleBalanced, art: 'voice-user', needs: 'moderator', blurb: 'People disagreeing with a decision, and the answer' },
  { name: 'Support', icon: faLifeRing, art: 'chatbubble', needs: 'moderator', blurb: 'What people have written in about, urgent first' },
  { name: 'People', icon: faUserShield, art: 'people', needs: 'moderator', blurb: 'Behaviour, the record, and what each rank may change' },
  { name: 'Communities', icon: faPeopleGroup, art: 'people', needs: 'moderator', blurb: 'Flag one, verify one, close one, or hand it on' },
  { name: 'Screening', icon: faCircleCheck, art: 'checkmark', needs: 'moderator', blurb: 'What people have made, waiting on a decision' },
  { name: 'Words', icon: faFilter, art: 'mute-microphone', needs: 'moderator', blurb: 'What the moderation system catches' },
  { name: 'Machine', icon: faRobot, needs: 'admin', blurb: 'What Kobby screens, and what it is allowed to do' },
  { name: 'Notice', icon: faBullhorn, art: 'announcement', needs: 'admin', blurb: 'A line across the top of the site, which anybody can close' },
  { name: 'Announce', icon: faBell, art: 'notification', needs: 'admin', blurb: 'A word from Kobblon, to one person or everybody' },
  { name: 'Economy', icon: faChartLine, art: 'discount', needs: 'admin', blurb: 'The Brix in circulation, the limiteds, promotions and handouts' },
  { name: 'Map', icon: faGlobe, needs: 'admin', blurb: 'Roughly where people are, by the clock on their machine' },
  { name: 'Record', icon: faScroll, needs: 'admin', blurb: 'What staff have done' },
]

const allowed = (rank: StaffRank, needs: StaffRank) => rankOrder[rank] >= rankOrder[needs]


/* ------------------------------------------------------------ communities */

/*
 * Communities, and what each rank may do about one.
 *
 * Staw, 16 October: a moderator flags one for review and sanctions its
 * owner for what they do with it; an admin verifies one and closes one; a
 * superadmin hands one to somebody else and deletes one for real. None of
 * it needs the owner's consent.
 *
 * The buttons a rank cannot use are not drawn, which is a courtesy and not
 * the security - every one of these functions asks the database who is
 * calling and refuses on its own. A console that shows a moderator the
 * delete button teaches them the console lies to them.
 *
 * Closing is the thing to read the wording on: it is held for two months
 * and is revertable the whole time, and the card says the date rather than
 * "deleted", because those are different promises.
 */
/* Exported so `tools/site/communities-preview.html` can mount it with no
 * console, no session and no database behind it - which is the only way to
 * look at all three ranks' versions of it side by side. */
export function CommunityCard({ row, rank, onChanged }: {
  row: StaffCommunity
  rank: StaffRank
  onChanged: () => void
}) {
  const say = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<'flag' | 'close' | 'transfer' | 'erase' | null>(null)
  const [why, setWhy] = useState('')
  const [toWhom, setToWhom] = useState<Profile | null>(null)
  const [lookingFor, setLookingFor] = useState('')

  const people = useAsync(
    () => (asking === 'transfer' ? searchProfiles(lookingFor, row.owner_id ?? undefined, 8) : Promise.resolve([])),
    [asking, lookingFor, row.owner_id],
  )

  const isAdmin = rankOrder[rank] >= rankOrder['admin']
  const isSuper = rankOrder[rank] >= rankOrder['superadmin']
  const closed = !!row.closed_at

  const run = async (name: string, work: () => Promise<unknown>, done: string) => {
    setBusy(name)
    try {
      await work()
      say(done, 'success')
      setAsking(null)
      setWhy('')
      setToWhom(null)
      onChanged()
    } catch (err) {
      say(err instanceof Error ? err.message : 'That did not go through.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className={cn('space-y-3 p-4', closed && 'border-danger/40')}>
      <div className="flex items-start gap-3">
        {row.icon_url ? (
          <img src={row.icon_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-hover">
            <Glyph icon={faPeopleGroup} className="text-muted" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-display text-sm font-bold">
            {row.name}
            {row.is_verified && <Glyph icon={faCircleCheck} className="text-xs text-brand-bright" />}
          </p>
          <p className="truncate text-xs text-muted">
            /c/{row.slug} &middot; {formatCount(row.member_count)} member
            {row.member_count === 1 ? '' : 's'} &middot; {formatCount(row.funds)} in funds
          </p>
          <p className="truncate text-xs text-muted">
            Owned by{' '}
            <span className="font-bold text-white/80">
              @{row.owner_username ?? 'nobody'}
            </span>
            {row.owner_suspended && <span className="text-danger"> (suspended)</span>}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {closed && (
            <Badge tone="danger">
              {/* `timeAgo` reads a future date as "just now", which on this
                  badge said the data had already gone. A date is the right
                  answer anyway: somebody deciding whether to put it back
                  wants to know how long they have, not how long it is
                  been. */}
              Closed &middot; data goes {row.erase_after
                ? new Date(row.erase_after).toLocaleDateString(undefined,
                    { day: 'numeric', month: 'short', year: 'numeric' })
                : 'in two months'}
            </Badge>
          )}
          {!row.is_public && <Badge tone="neutral">Private</Badge>}
          {row.open_reports > 0 && (
            <Badge tone="warm">{row.open_reports} open report{row.open_reports === 1 ? '' : 's'}</Badge>
          )}
        </div>
      </div>

      {closed && row.closed_reason && (
        <p className="rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-xs leading-relaxed text-muted">
          <span className="font-bold text-white/80">Closed because:</span> {row.closed_reason}
        </p>
      )}

      {/* Everything a rank may actually press. */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="subtle" to={`/c/${row.slug}`}>Open it</Button>

        {row.owner_username && (
          <Button size="sm" variant="subtle" to={`/staff/people?look=${row.owner_username}`}>
            The owner
          </Button>
        )}

        <Button
          size="sm"
          variant="subtle"
          icon={faFlag}
          onClick={() => setAsking(asking === 'flag' ? null : 'flag')}
        >
          Flag for review
        </Button>

        {isAdmin && (
          <Button
            size="sm"
            variant="subtle"
            loading={busy === 'verify'}
            onClick={() => void run('verify',
              () => verifyCommunity(row.id, !row.is_verified),
              row.is_verified ? 'The tick is off.' : 'Verified.')}
          >
            {row.is_verified ? 'Take the tick off' : 'Verify it'}
          </Button>
        )}

        {isAdmin && !closed && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setAsking(asking === 'close' ? null : 'close')}
          >
            Close it
          </Button>
        )}

        {isAdmin && closed && (
          <Button
            size="sm"
            loading={busy === 'reopen'}
            onClick={() => void run('reopen', () => staffReopenCommunity(row.id), 'Open again.')}
          >
            Put it back
          </Button>
        )}

        {isSuper && (
          <Button
            size="sm"
            variant="subtle"
            onClick={() => setAsking(asking === 'transfer' ? null : 'transfer')}
          >
            Hand it over
          </Button>
        )}

        {isSuper && closed && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setAsking(asking === 'erase' ? null : 'erase')}
          >
            Delete for real
          </Button>
        )}
      </div>

      {asking === 'flag' && (
        <div className="space-y-2 rounded-xl border border-ink-line bg-ink-raised p-3">
          <Textarea
            label="What is wrong with it"
            rows={2}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            hint="This opens a report, so it lands where reports are read rather than only here."
          />
          <Button
            size="sm"
            loading={busy === 'flag'}
            disabled={!why.trim()}
            onClick={() => void run('flag', () => flagCommunity(row.id, why), 'Flagged. It is in Reports.')}
          >
            Flag it
          </Button>
        </div>
      )}

      {asking === 'close' && (
        <div className="space-y-2 rounded-xl border border-danger/40 bg-danger-soft p-3">
          <p className="text-xs leading-relaxed text-muted">
            It is marked closed and held for two months. The page stays and says so, nothing
            in it is lost, and any admin can put it back until the date runs out. The owner
            is told, with this reason.
          </p>
          <Textarea
            label="Why it is being closed"
            rows={2}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
          <Button
            size="sm"
            variant="danger"
            loading={busy === 'close'}
            disabled={!why.trim()}
            onClick={() => void run('close', () => staffCloseCommunity(row.id, why),
              'Closed, and held for two months.')}
          >
            Close it
          </Button>
        </div>
      )}

      {asking === 'transfer' && (
        <div className="space-y-2 rounded-xl border border-ink-line bg-ink-raised p-3">
          <Input
            label="Who gets it"
            placeholder="Search by name"
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
          />
          {toWhom ? (
            <p className="text-xs">
              Handing it to <span className="font-bold">@{toWhom.username}</span>.{' '}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setToWhom(null)}
              >
                pick somebody else
              </button>
            </p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {(people.data ?? []).map((one) => (
                <button
                  key={one.id}
                  type="button"
                  onClick={() => setToWhom(one)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-hover"
                >
                  <PersonAvatar person={one} size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    {one.display_name}{' '}
                    <span className="text-muted">@{one.username}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <Textarea
            label="Why"
            rows={2}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
          <Button
            size="sm"
            loading={busy === 'transfer'}
            disabled={!toWhom}
            onClick={() => void run('transfer',
              () => staffTransferCommunity(row.id, toWhom!.id, why),
              'Handed over. They have been told.')}
          >
            Hand it over
          </Button>
        </div>
      )}

      {asking === 'erase' && (
        <div className="space-y-2 rounded-xl border border-danger/40 bg-danger-soft p-3">
          <p className="text-xs font-bold leading-relaxed text-danger">
            This removes the data. Every post, every member, the funds and the audit go with
            it, and nothing here brings any of it back.
          </p>
          <Button
            size="sm"
            variant="danger"
            loading={busy === 'erase'}
            onClick={() => void run('erase', () => eraseCommunity(row.id), 'Gone.')}
          >
            Yes, delete {row.name} for real
          </Button>
        </div>
      )}
    </Card>
  )
}

function CommunitiesSection() {
  const rank = useStaffRank()
  const [which, setWhich] = useState<CommunityTab>('all')
  const [look, setLook] = useState('')
  const [round, setRound] = useState(0)

  const rows = useAsync(
    () => staffCommunities({ look: look.trim() || null, which }),
    [which, look, round],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Choices
          size="sm"
          tone="soft"
          label="Which"
          value={which}
          onChange={(picked) => setWhich(picked as CommunityTab)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'flagged', label: 'Reported' },
            { value: 'verified', label: 'Verified' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <Input
          className="min-w-[14rem] flex-1"
          placeholder="A name, a handle, or an owner"
          value={look}
          onChange={(e) => setLook(e.target.value)}
        />
      </div>

      {rows.error ? (
        <ErrorState message={rows.error} onRetry={rows.reload} />
      ) : rows.loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : (rows.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing here"
            body={look.trim() ? 'No community matches that.' : 'There are none in this list.'}
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(rows.data ?? []).map((row) => (
            <CommunityCard
              key={row.id}
              row={row}
              rank={rank}
              onChanged={() => setRound((n) => n + 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- overview */

/**
 * A queue, as a thing to walk into rather than a statistic.
 *
 * The first version of this was four identical cards with an icon chip, a
 * number and a line of grey text - the shape every dashboard has had since
 * about 2015, which is exactly why it reads as nobody's. This is the
 * Catalog's own card: the number in the display face at the size the number
 * deserves, the name under it, and the whole block pressable. A queue with
 * nothing in it says so in a word instead of showing a nought.
 */
/*
 * What `ai_work` calls a job, in the words a person reading the console
 * uses. The subject is the database's own word and it is handed through
 * rather than translated there, so this is where it gets a label.
 */
const QUEUE_WORDS: Record<string, string> = {
  avatar_item: 'catalog',
  asset: 'upload',
  report: 'report',
  ticket: 'support',
  appeal: 'appeal',
  message: 'chat',
  profile_text: 'name',
}

function Queue({ icon, art, name, count, aside, delay, onClick }: {
  icon: IconDefinition
  art?: KobIcon
  name: string
  count: number
  aside?: string
  delay: number
  onClick: () => void
}) {
  const heavy = count > 10
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'group relative flex animate-row-in flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left',
        'transition-[transform,border-color] duration-150 hover:-translate-y-0.5',
        count === 0
          ? 'border-ink-line bg-ink-card hover:border-white/20'
          : heavy
            ? 'border-danger/40 bg-danger-soft hover:border-danger'
            : 'border-brand/40 bg-brand/10 hover:border-brand-bright',
      )}
    >
      {art ? (
        <Icon
          name={art}
          tone="rgba(255,255,255,0.05)"
          className="pointer-events-none absolute -bottom-3 -right-2 h-16 w-16 transition-transform duration-200 group-hover:scale-110"
        />
      ) : (
        <FontAwesomeIcon
          icon={icon}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3 -right-2 text-6xl text-white/[0.04] transition-transform duration-200 group-hover:scale-110"
        />
      )}
      <span className={cn(
        'font-display text-4xl leading-none',
        count === 0 ? 'text-white/25' : heavy ? 'text-danger-bright' : 'text-white',
      )}>
        {count === 0 ? 'none' : count}
      </span>
      <span className="mt-3">
        <span className="block font-display text-sm uppercase tracking-wide">{name}</span>
        <span className="mt-0.5 block text-xs text-muted">{aside}</span>
      </span>
    </button>
  )
}

/** The machine's own heartbeat, as a line somebody can read at a glance. */
export function Heartbeat({ pulse, compact = false }: { pulse: MachinePulse | null; compact?: boolean }) {
  /*
   * Three states, not two. "On" is a setting somebody typed; "beating" is
   * whether anything is actually scheduled to run it; "wired" is whether a
   * knock can physically go out. The old panel showed the first one and
   * called it the answer, which is how it sat switched on and idle.
   */
  const live = !!pulse?.is_on && !!pulse.beating && pulse.wired && pulse.net_ready
  const word = !pulse?.is_on ? 'stopped'
    : live ? 'awake' : 'on, but nothing is running it'
  const tone = !pulse?.is_on ? 'text-white/50'
    : live ? 'text-space-bright' : 'text-amber-300'

  return (
    <span className={cn('inline-flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <span className="relative grid size-2.5 place-items-center">
        <span className={cn('size-2.5 rounded-full bg-current', tone)} />
        {live && (
          <span className={cn('absolute size-2.5 animate-pulse-ring rounded-full', tone)} aria-hidden="true" />
        )}
      </span>
      <span className={cn('font-bold', tone)}>{word}</span>
    </span>
  )
}

/**
 * What the console opens on.
 *
 * Staw asked for practical, and then for it not to feel like something a
 * machine laid out - which is the same note twice, because the generic
 * dashboard is generic precisely by not knowing what the work is. So: the
 * four queues as four doors, in the order they are actually worked; one
 * line of the house's own numbers rather than four more boxes of the same
 * shape; and Kobby underneath, because the queues only mean anything if you
 * know whether something is draining them.
 *
 * It keeps its own time - this sits open on a second monitor all day, and a
 * count from an hour ago is worse than no count.
 */
export function OverviewSection({ onGo }: { onGo: (to: Section) => void }) {
  const rank = useStaffRank()
  const counts = useAsync(async () => staffOverview(), [])
  const pulse = useAsync(async () => machinePulse().catch(() => null), [])
  const recent = useAsync(async () => aiRecent(8).catch(() => []), [])

  useEffect(() => {
    const again = window.setInterval(() => { counts.reload(); pulse.reload() }, 20_000)
    return () => window.clearInterval(again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const n = counts.data
  const queues = [
    { name: 'Reports', count: n?.reports_open ?? 0, icon: faFlag, art: 'report' as KobIcon, to: 'Reports' as Section,
      aside: 'somebody said something is wrong' },
    { name: 'Appeals', count: n?.appeals_open ?? 0, icon: faScaleBalanced, art: 'voice-user' as KobIcon, to: 'Appeals' as Section,
      aside: 'a decision being argued with' },
    { name: 'Support', count: n?.tickets_open ?? 0, icon: faLifeRing, art: 'chatbubble' as KobIcon, to: 'Support' as Section,
      aside: n?.tickets_urgent ? `${n.tickets_urgent} asked for a person` : 'written in to the house' },
    { name: 'Screening', count: n?.screening ?? 0, icon: faCircleCheck, art: 'checkmark' as KobIcon, to: 'Screening' as Section,
      aside: 'made, and waiting on a yes' },
  ]

  const waiting = queues.reduce((sum, one) => sum + one.count, 0)

  return (
    <div className="space-y-5">
      {counts.loading && !counts.data ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((one) => <Skeleton key={one} className="h-32" />)}
        </div>
      ) : counts.error ? (
        <ErrorState
          message={counts.error ?? 'The database did not answer.'}
          onRetry={() => { counts.reload() }}
        />
      ) : (
        <>
          <p className="font-display text-lg">
            {waiting === 0
              ? 'Nothing is waiting on anybody. Good morning.'
              : `${formatCount(waiting)} things are waiting on a person.`}
          </p>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {queues.map((one, i) => (
              <Queue
                key={one.name}
                icon={one.icon}
                art={one.art}
                name={one.name}
                count={one.count}
                aside={one.aside}
                delay={i * 45}
                onClick={() => onGo(one.to)}
              />
            ))}
          </div>

          {/* ------------------------------------------------ the machine */}
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={cn(
                'grid size-10 shrink-0 place-items-center rounded-2xl',
                pulse.data?.is_on ? 'bg-brand text-white' : 'bg-ink-raised text-white/30',
              )}>
                <FontAwesomeIcon icon={faRobot} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-display">
                  Kobby is <Heartbeat pulse={pulse.data ?? null} />
                </p>
                <p className="text-xs text-muted">
                  {!pulse.data?.is_on
                    ? 'Everything in those queues is waiting for a person.'
                    : pulse.data.beating
                      ? `Swept every minute${pulse.data.last_poke_at ? `, last knocked ${timeAgo(pulse.data.last_poke_at)}` : ''}. ${formatCount(pulse.data.decided_today)} decided in the last day, ${pulse.data.waiting} in front of it.`
                      : 'Nothing is scheduled to run it, so it only moves when work lands or somebody presses the button.'}
                </p>
              </div>
              {allowed(rank, 'admin') && (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onGo('Machine')}>
                  Machine
                </Button>
              )}
            </div>

            {!!recent.data?.length && (
              <div className="space-y-1.5 border-t border-ink-line pt-3">
                {recent.data.slice(0, 5).map((one, i) => (
                  <div
                    key={one.id}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className="flex animate-row-in items-baseline gap-2 text-xs"
                  >
                    <Badge tone={
                      one.decision === 'rejected' || one.decision === 'suspended' ? 'danger'
                        : one.decision === 'unsure' ? 'warm'
                          // Read, and deliberately not acted on: an account
                          // Kobby keeps its hands off. Green would read as
                          // "settled", which is the one thing it is not.
                          : one.decision === 'staff' ? 'neutral' : 'space'
                    }>
                      {one.decision}
                    </Badge>
                    <span className="text-muted">{one.subject}</span>
                    <span className="min-w-0 flex-1 truncate text-white/70">{one.reason}</span>
                    <span className="shrink-0 text-muted">{timeAgo(one.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/*
            * The house, as a sentence.
            *
            * These four were four more cards of exactly the shape above,
            * which is how a page starts looking like a template with the
            * numbers swapped in. They are facts somebody glances at, not
            * work, so they read as a line.
            */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <Icon name="people" className="w-4 text-white/30" />
            <button onClick={() => onGo('People')} className="font-bold text-white hover:underline">
              {formatCount(n?.people_total ?? 0)} accounts
            </button>
            <span>·</span>
            <span><span className="font-bold text-white">{formatCount(n?.joined_today ?? 0)}</span> joined today</span>
            <span>·</span>
            <span><span className="font-bold text-space-bright">{formatCount(n?.people_online ?? 0)}</span> here now</span>
            <span>·</span>
            <span><span className="font-bold text-white">{formatCount(n?.sanctions_week ?? 0)}</span> warnings and suspensions this week</span>
            {pulse.data?.oldest_minutes != null && (
              <>
                <span>·</span>
                <span>
                  oldest thing waiting{' '}
                  <span className={cn('font-bold', pulse.data.oldest_minutes > 180 ? 'text-danger-bright' : 'text-white')}>
                    {pulse.data.oldest_minutes > 90
                      ? `${Math.round(pulse.data.oldest_minutes / 60)} hours`
                      : `${pulse.data.oldest_minutes} minutes`}
                  </span>
                </span>
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ people */

/* ----------------------------------------------------------- a sanction */

/** The house rules a decision is filed under, in the ledger's own words. */
const RULES = [
  'harassment', 'spam', 'sexual', 'violence', 'impersonation',
  'illegal', 'hate', 'cheating', 'copyright', 'age', 'other',
] as const

const HOW_LONG = [
  { value: '1', label: 'A day' },
  { value: '3', label: 'Three days' },
  { value: '7', label: 'A week' },
  { value: '30', label: 'A month' },
  { value: '', label: 'Until somebody lifts it' },
]

/**
 * Acting on a person who has not been reported.
 *
 * The console had one control for this and it was a flag: `Suspend` wrote
 * `is_suspended` and nothing else, so the account was locked out while its
 * own standing page said nothing was wrong with it - felt, and unappealable,
 * because there was nothing on the record to appeal. This writes what a
 * report writes: the rule, the reason the person reads, the violation the
 * standing page counts, the mail, and the appeal that follows from it.
 *
 * Closing an account is not in here. It is its own button, its own
 * confirmation and a superadmin's, because it is the one decision nothing
 * undoes by waiting.
 */
function SanctionDialog({ person, open, onClose, onDone }: {
  person: StaffPerson
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const say = useToast()
  const [action, setAction] = useState<SanctionAction>('warning')
  const [rule, setRule] = useState('harassment')
  const [why, setWhy] = useState('')
  const [days, setDays] = useState('3')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    try {
      await sanctionAccount({
        target: person.id,
        action,
        why,
        rule,
        days: action === 'suspension' && days ? Number(days) : null,
      })
      say(
        action === 'warning' ? 'Warned. It is on their record and in their Inbox.'
          : action === 'chat_suspension' ? 'Chat suspended.'
            : 'Suspended.',
        'success',
      )
      setWhy('')
      onClose()
      onDone()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Act on @${person.username}`}
      description="They are told what this says, and can appeal it from their standing."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={action === 'warning' ? 'primary' : 'danger'}
            disabled={busy || why.trim().length < 10}
            onClick={send}
          >
            <FontAwesomeIcon icon={faGavel} />
            {action === 'warning' ? 'Warn them'
              : action === 'chat_suspension' ? 'Suspend chat' : 'Suspend the account'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Choices
          label="What this is"
          size="sm"
          value={action}
          onChange={(picked) => setAction(picked as SanctionAction)}
          options={[
            { value: 'warning', label: 'Warning', icon: faFlag },
            { value: 'chat_suspension', label: 'Chat', icon: faCommentSlash },
            { value: 'suspension', label: 'Account', icon: faUserSlash },
          ]}
        />

        <Select
          label="The rule"
          value={rule}
          onChange={setRule}
          options={RULES.map((one) => ({ value: one, label: ruleWord[one] ?? one }))}
        />

        {action === 'suspension' && (
          <Select
            label="How long"
            value={days}
            onChange={setDays}
            options={HOW_LONG}
          />
        )}

        <Textarea
          label="Why"
          labelNote="they read this"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="What they did, in a sentence. A sanction with no reason cannot be appealed."
          hint={why.trim().length < 10
            ? 'At least a sentence. This is the whole of what they are told.'
            : undefined}
        />

        {person.past_sanctions > 0 && (
          <Note>
            {person.past_sanctions === 1
              ? 'One thing already on their record.'
              : `${person.past_sanctions} things already on their record.`}
          </Note>
        )}
      </div>
    </Dialog>
  )
}


export function PersonRow({ person, onChanged }: {
  person: StaffPerson
  onChanged: () => void
}) {
  const say = useToast()
  const rank = useStaffRank()
  const [busy, setBusy] = useState(false)
  const [brix, setBrix] = useState('')
  const [note, setNote] = useState('')
  const [saying, setSaying] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [erasing, setErasing] = useState(false)
  const [acting, setActing] = useState(false)
  const [closing, setClosing] = useState(false)
  const [opening, setOpening] = useState(false)
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
            {/* A closed account is suspended as well, so without this it
                wore both badges and the heavier one read as the lesser. */}
            {person.is_banned
              ? <Badge tone="danger">Closed</Badge>
              : person.is_suspended && <Badge tone="danger">Suspended</Badge>}
            {person.is_guest && <Badge>Guest</Badge>}
            {person.must_set_password && <Badge tone="warm">Setting a password</Badge>}
            {!person.is_guest && !person.has_email && <Badge tone="neutral">No email</Badge>}
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

      {/*
        * What a rank may actually do, rather than what it may press.
        *
        * `admin_set_standing`, `admin_move_brix` and `admin_notify` all call
        * `require_admin`, and deleting calls `require_superadmin`. A
        * moderator shown these would press one and be told no, which teaches
        * them that the console lies to them - so a moderator gets the record
        * and the behaviour panel below, and acts through a report instead.
        */}
      {rank === 'moderator' && (
        <Note>Standing and Brix are an admin's. Warning, chat and suspending are yours.</Note>
      )}

      {/*
        * What is already true of them, before anybody decides anything else.
        * It was not on the card at all, so the decision about a fifth
        * warning was taken without knowing about the four.
        */}
      {(person.is_banned || person.is_suspended || person.closed_at
        || person.past_sanctions > 0) && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {person.is_banned && <Badge tone="danger">Closed</Badge>}
          {person.closed_at && (
            <Badge tone="danger">
              Deleting &middot; data goes {person.erase_after
                ? new Date(person.erase_after).toLocaleDateString(undefined,
                  { day: 'numeric', month: 'short', year: 'numeric' })
                : 'in two months'}
            </Badge>
          )}
          {person.is_suspended && !person.is_banned && (
            <Badge tone="danger">
              {person.suspended_until
                ? `Suspended until ${new Date(person.suspended_until).toLocaleDateString()}`
                : 'Suspended, no end'}
            </Badge>
          )}
          {person.past_sanctions > 0 && (
            <span>
              {person.past_sanctions === 1
                ? 'One thing on their record'
                : `${person.past_sanctions} things on their record`}
            </span>
          )}
        </p>
      )}

      {/*
        * The sanction door, drawn for a moderator as well: this is the one
        * thing on the card that is theirs, and it was the one thing they
        * could not reach.
        */}
      {!person.is_admin && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="subtle" disabled={busy} onClick={() => setActing(true)}>
            <FontAwesomeIcon icon={faGavel} />
            Warn or suspend
          </Button>

          {person.is_suspended && !person.is_banned && (
            <Button
              size="sm"
              variant="subtle"
              disabled={busy}
              onClick={() => run('Suspension lifted.',
                () => setStanding(person.id, { suspended: false }))}
            >
              <FontAwesomeIcon icon={faBan} />
              Lift the suspension
            </Button>
          )}

          {/*
            * Closing an account and opening it again. `ban_account` refuses
            * the moderation worker by name - Staw's line, and the reason it
            * is written into the database rather than into a page.
            */}
          {/*
            * A guest made into a real account.
            *
            * Staw: "make that superadmins can force guest accounts to
            * become normal accounts (the user when coming back to the
            * website will already be logged in but therell be a card to
            * ask them to put a password)". That is what happens: nothing
            * is signed out, nothing they made is touched, and the card is
            * what the site shows them next time rather than anything done
            * to their session now.
            */}
          {rank === 'superadmin' && person.is_guest && (
            <Button
              size="sm"
              variant="subtle"
              disabled={busy}
              onClick={() => run(
                'Done. They will be asked for a password when they come back.',
                () => makeAccountReal(person.id),
              )}
            >
              <FontAwesomeIcon icon={faUserCheck} />
              Make it a real account
            </Button>
          )}

          {rank === 'superadmin' && (
            person.is_banned ? (
              <Button size="sm" variant="subtle" disabled={busy} onClick={() => setOpening(true)}>
                <FontAwesomeIcon icon={faDoorOpen} />
                Open it again
              </Button>
            ) : (
              <Button size="sm" variant="danger" disabled={busy} onClick={() => setClosing(true)}>
                <FontAwesomeIcon icon={faDoorClosed} />
                Close the account
              </Button>
            )
          )}
        </div>
      )}

      {rank !== 'moderator' && (
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

        {/*
          * Appointing, for a superadmin, and the mod toggle for everybody
          * else who may be here.
          *
          * `set_staff_rank` is a superadmin's and refuses anybody else, so
          * an admin shown three choices would press one and be told no.
          * They keep the one switch they really do have, which is the
          * moderator bit through `admin_set_standing`.
          */}
        {rank === 'superadmin' ? (
          <Choices
            size="sm"
            tone="soft"
            label="Their rank"
            value={person.is_admin ? 'admin' : person.is_moderator ? 'moderator' : 'none'}
            onChange={(picked) => run(
              picked === 'none' ? 'Staff access removed.'
                : picked === 'admin' ? 'Now an admin.' : 'Now a moderator.',
              async () => { await setStaffRank(person.id, picked as 'none' | 'moderator' | 'admin') },
            )}
            options={[
              { value: 'none', label: 'No rank' },
              { value: 'moderator', label: 'Moderator' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        ) : (
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
        )}

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

        {/* Sanctions live in their own row above, which a moderator gets
            too. What is left here is an admin's: deleting, which is not a
            sanction - it is the end of the account and everything in it. */}
        {/*
          * Deleting is a date now, not a moment: migration 0268 gives an
          * account the same two months a Community gets, so this schedules
          * it and the two buttons beside it are what the wait is for.
          */}
        {!person.is_admin && rank === 'superadmin' && !person.closed_at && (
          <Button size="sm" variant="danger" disabled={busy} onClick={() => setRemoving(true)}>
            <FontAwesomeIcon icon={faTrash} />
            Delete
          </Button>
        )}

        {!person.is_admin && rank === 'superadmin' && person.closed_at && (
          <>
            <Button
              size="sm"
              variant="subtle"
              disabled={busy}
              onClick={() => run('Put back. It is staying.', () => reopenAccount(person.id))}
            >
              <FontAwesomeIcon icon={faDoorOpen} />
              Put it back
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setErasing(true)}>
              <FontAwesomeIcon icon={faTrash} />
              Delete for real
            </Button>
          </>
        )}
      </div>
      )}

      {rank !== 'moderator' && (
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
      )}

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

      <SanctionDialog
        person={person}
        open={acting}
        onClose={() => setActing(false)}
        onDone={onChanged}
      />

      <Confirm
        open={closing}
        onClose={() => { setClosing(false); setWhy('') }}
        onConfirm={() => run('Account closed.', async () => {
          await banAccount(person.id, why)
          setClosing(false)
          setWhy('')
        })}
        title={`Close @${person.username}?`}
        lead="They are locked out and told why. Nothing of theirs is deleted."
        points={[
          'It goes on their record as a termination, and they can appeal it.',
          'Opening it again later voids that decision rather than hiding it.',
          'The moderation worker cannot do this. Only a person can.',
        ]}
        confirmText="Close the account"
      >
        <Input
          label="Why"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="A sentence they are allowed to read."
        />
      </Confirm>

      <Confirm
        open={opening}
        onClose={() => { setOpening(false); setWhy('') }}
        onConfirm={() => run('Open again.', async () => {
          await liftAccountBan(person.id, why)
          setOpening(false)
          setWhy('')
        })}
        title={`Open @${person.username} again?`}
        lead="The decision to close it is voided and they are told."
        points={['The record of what was decided stays. It is marked as lifted.']}
        confirmText="Open it again"
      >
        <Input
          label="Why"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Shown to them."
        />
      </Confirm>

      <Confirm
        open={removing}
        onClose={() => { setRemoving(false); setWhy('') }}
        onConfirm={() => run('Deleting. Two months before the data goes.', async () => {
          await deleteAccountAsStaff(person.id, why)
          setRemoving(false)
          setWhy('')
        })}
        title={`Delete @${person.username}?`}
        lead="Two months, and then it is gone for good."
        points={[
          'They are locked out now and told why.',
          'Their profile reads "Account Deleted" to everybody else.',
          'Nothing is actually erased until the two months are up, so this can be called off.',
        ]}
        confirmText="Start deleting"
      >
        <Input
          label="Why"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Required. Kept in the record."
        />
      </Confirm>

      {/* The one that does not wait. Only after the account is already on
          its way out, which is the whole of what makes it recoverable. */}
      <Confirm
        open={erasing}
        onClose={() => setErasing(false)}
        onConfirm={() => run('Gone.', async () => {
          await eraseAccount(person.id)
          setErasing(false)
        })}
        title={`Erase @${person.username} now?`}
        lead="This cannot be undone."
        points={[
          'Their account, profile and everything hanging off it goes.',
          'Their uploads, Worlds and Communities go with it.',
          'The record keeps their name and the reason it was closed. Nothing else survives.',
        ]}
        confirmText="Delete for real"
      />
    </Card>
  )
}

/*
 * What the People panel can be asked, beyond a name.
 *
 * Staw: "for kobblon users make that we can filter by number of brix, or
 * when joined, or if you are a klub member (we'll add klub stuff later),
 * etc, put a lot of filters, verified, staff etc".
 *
 * Every one of these is a `where` in the database rather than a filter over
 * what was already fetched, because the list is the fifty the database
 * chose: narrowing fifty rows in the browser answers "who of these" and the
 * question is "who of everybody".
 */
/**
 * A label over a control, in the console's one label style.
 *
 * `Input` draws its own; `Select` does not, and the two have to read as the
 * same thing stacked in the same grid. The spacing is the point: Staw on
 * the first version of this card, which had none, "ADD SPACING OMFG YOU
 * DONT ADD SPACINGS THATS WHY ITS UGLY".
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </div>
  )
}

const WHO: { value: PeopleFilter | 'all'; label: string }[] = [
  { value: 'all', label: 'Everybody' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admins' },
  { value: 'moderator', label: 'Moderators' },
  { value: 'verified', label: 'Verified' },
  { value: 'klub', label: 'Klub' },
  { value: 'guest', label: 'Guests' },
  { value: 'real', label: 'Real accounts' },
  { value: 'no_email', label: 'No email' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Closed' },
  { value: 'closing', label: 'Being deleted' },
]

const ORDER: { value: PeopleOrder; label: string }[] = [
  { value: 'rank', label: 'Rank' },
  { value: 'new', label: 'Newest' },
  { value: 'old', label: 'Oldest' },
  { value: 'rich', label: 'Most Brix' },
  { value: 'poor', label: 'Least Brix' },
  { value: 'name', label: 'A to Z' },
]

const JOINED: { value: string; label: string; days: number | null }[] = [
  { value: 'any', label: 'Any time', days: null },
  { value: 'day', label: 'Today', days: 1 },
  { value: 'week', label: 'This week', days: 7 },
  { value: 'month', label: 'This month', days: 30 },
  { value: 'year', label: 'This year', days: 365 },
]

export function PeopleSection({ initial }: { initial?: string }) {
  const say = useToast()
  const [search, setSearch] = useState(initial ?? '')
  const [people, setPeople] = useState<StaffPerson[] | null>(null)
  const [looking, setLooking] = useState(false)
  const [who, setWho] = useState<PeopleFilter | 'all'>('all')
  const [order, setOrder] = useState<PeopleOrder>('rank')
  const [joined, setJoined] = useState('any')
  const [leastBrix, setLeastBrix] = useState('')
  const [mostBrix, setMostBrix] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  /** Whoever is open, which is how a list of names becomes a console. */
  const [open, setOpen] = useState<StaffPerson | null>(null)
  /** Whose record is being read, in a popup over the list. */
  const [reading, setReading] = useState<StaffPerson | null>(null)
  const rank = useStaffRank()

  const since = JOINED.find((one) => one.value === joined)?.days ?? null

  /* How many are actually narrowing anything, for the button's own label. */
  const narrowed = [
    who !== 'all', joined !== 'any', order !== 'rank',
    leastBrix.trim() !== '', mostBrix.trim() !== '',
  ].filter(Boolean).length

  const look = useCallback(async (term: string) => {
    setLooking(true)
    try {
      setPeople(await findPeopleAsStaff({
        search: term,
        kind: who === 'all' ? null : who,
        order,
        minPixels: leastBrix.trim() === '' ? null : Number(leastBrix),
        maxPixels: mostBrix.trim() === '' ? null : Number(mostBrix),
        joinedSince: since === null
          ? null
          : new Date(Date.now() - since * 86_400_000).toISOString(),
        limit: 100,
      }))
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not look.', 'error')
    } finally {
      setLooking(false)
    }
  }, [say, who, order, leastBrix, mostBrix, since])

  /*
   * The list is there when the panel opens.
   *
   * It used to be an empty box and a sentence explaining that pressing Look
   * with nothing typed would show the newest accounts - which is a console
   * asking somebody to read instructions to see the thing the panel is
   * named after. An empty search is what the database already answers with
   * the newest accounts, so it is simply asked.
   */
  useEffect(() => {
    void look(initial ?? '')
    if (initial) setSearch(initial)
    // `look` is rebuilt whenever a filter changes, which is what makes
    // picking one ask again rather than wait for the button.
  }, [initial, look])

  /*
   * Typing filters what is on screen at once, and Look asks the database.
   *
   * Both, because they answer different questions: the narrowing is
   * instant for the hundred names already here, and the search reaches the
   * ones that are not. Nothing is hidden by the filter that a search would
   * not also have to fetch.
   */
  const shown = (people ?? []).filter((person) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return person.username?.toLowerCase().includes(term)
      || person.display_name?.toLowerCase().includes(term)
      || person.id.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-5">
      <form
        className="sticky top-20 z-10 -mx-1 flex items-end gap-2 bg-ink/90 px-1 py-2 backdrop-blur-sm"
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
        <Button
          type="button"
          variant={showFilters ? 'primary' : 'ghost'}
          onClick={() => setShowFilters((was) => !was)}
        >
          <FontAwesomeIcon icon={faFilter} />
          Filters{narrowed > 0 ? ` (${narrowed})` : ''}
        </Button>
      </form>

      {showFilters && (
        /*
         * Dropdowns, in a grid, with room between them.
         *
         * This was eleven pills, then five, then six, wrapped across three
         * rows - Staw: "i HATE the filters design for the people, no
         * spacing, ugly, JUST MAKE IT A NORMAL DROPDOWN LIST". He is right
         * about why: a row of pills is for three or four choices somebody
         * compares at a glance, and eleven of them is a list that has been
         * pretending to be a toolbar. A dropdown says its current answer in
         * one word and keeps the other ten out of the way.
         */
        <Card className="animate-pop-in space-y-5 p-5">
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Who">
              <Select
                label="Who to show"
                value={who}
                options={WHO}
                onChange={(next) => setWho(next as PeopleFilter | 'all')}
              />
              {who === 'klub' && (
                <p className="mt-2 text-xs text-muted">
                  The Klub does not exist yet, so this one is empty on purpose
                  rather than showing everybody.
                </p>
              )}
            </Field>

            <Field label="Joined">
              <Select
                label="When they joined"
                value={joined}
                options={JOINED}
                onChange={setJoined}
              />
            </Field>

            <Field label="Order">
              <Select
                label="What order"
                value={order}
                options={ORDER}
                onChange={(next) => setOrder(next as PeopleOrder)}
              />
            </Field>

            <Field label="Brix, at least">
              <Input
                aria-label="Brix, at least"
                type="number"
                min={0}
                value={leastBrix}
                onChange={(e) => setLeastBrix(e.target.value)}
                placeholder="0"
              />
            </Field>

            <Field label="Brix, at most">
              <Input
                aria-label="Brix, at most"
                type="number"
                min={0}
                value={mostBrix}
                onChange={(e) => setMostBrix(e.target.value)}
                placeholder="any"
              />
            </Field>
          </div>

          {narrowed > 0 && (
            <div className="flex justify-end border-t border-ink-line pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setWho('all')
                  setOrder('rank')
                  setJoined('any')
                  setLeastBrix('')
                  setMostBrix('')
                }}
              >
                Clear them
              </Button>
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-muted">
        {looking ? 'Looking…'
          : people === null ? ''
          : search.trim()
            ? `${formatCount(shown.length)} of ${formatCount(people.length)} loaded accounts match. Press Look to search every account.`
            : `The ${formatCount(people.length)} newest accounts. Type to narrow them, or search for anybody.`}
      </p>

      {looking && people === null && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((one) => <Skeleton key={one} className="h-20" />)}
        </div>
      )}
      {people !== null && shown.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          Nobody here matches that. Press Look to ask the database.
        </p>
      )}
      {shown.map((person, i) => {
        const showing = open?.id === person.id
        return (
          <div
            key={person.id}
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            className="animate-row-in space-y-2"
          >
            {/*
              * A line each until somebody is opened.
              *
              * Every row used to carry the full set - six rank buttons, a
              * Brix box, Notify, Delete - so twenty accounts was a page of
              * three hundred controls, and the one person being looked for
              * was somewhere in it. The controls are the same ones; they
              * are behind the row rather than in front of every row.
              */}
            <button
              type="button"
              onClick={() => setOpen(showing ? null : person)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left',
                'transition-[background-color,border-color] duration-150',
                showing
                  ? 'border-brand-bright/60 bg-brand/10'
                  : 'border-ink-line bg-ink-card hover:bg-ink-hover',
              )}
            >
              <Avatar
                src={avatarOf(person)}
                name={person.display_name ?? person.username ?? '?'}
                personId={person.id}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-bold">
                    {person.display_name ?? person.username}
                  </span>
                  {person.is_banned && <Badge tone="danger">Closed</Badge>}
                  {!person.is_banned && person.is_suspended && <Badge tone="danger">Suspended</Badge>}
                  {person.is_admin && <Badge tone="brand">Admin</Badge>}
                  {!person.is_admin && person.is_moderator && <Badge tone="brand">Moderator</Badge>}
                  {person.is_guest && <Badge tone="neutral">Guest</Badge>}
                  {person.past_sanctions > 0 && (
                    <Badge tone="warm">{person.past_sanctions} on the record</Badge>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  @{person.username} · #{person.content_id} · here {timeAgo(person.created_at)}
                </span>
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-sm font-bold sm:flex">
                <CurrencyMark className="h-3.5" />
                {formatCount(person.pixels)}
              </span>
              <FontAwesomeIcon
                icon={faArrowRight}
                className={cn(
                  'shrink-0 text-xs text-white/25 transition-transform duration-150',
                  showing && 'rotate-90 text-brand-bright',
                )}
              />
            </button>

            {showing && (
              <div className="animate-pop-in space-y-2">
                <PersonRow person={person} onChanged={() => void look(search)} />
                <Button size="sm" variant="ghost" icon={faScroll} onClick={() => setReading(person)}>
                  Their record
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {/*
        * The record as a popup.
        *
        * Staw asked for it, and working the panel shows why: opened inline
        * it pushed the rest of the list off the screen, so comparing two
        * accounts meant scrolling past the whole of the first one. It is
        * one person's history, read and closed.
        */}
      <Dialog
        open={Boolean(reading)}
        onClose={() => setReading(null)}
        title={reading ? (reading.display_name ?? reading.username ?? 'Their record') : ''}
        description={reading ? `@${reading.username} · #${reading.content_id}` : undefined}
        size="lg"
      >
        {!!reading && <PersonSheet person={reading} rank={rank} />}
      </Dialog>
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
  const [open, setOpen] = useState<ReportTicket | null>(null)
  const reports = useAsync(async () => reportQueue(which, 200), [which])

  /* Held once for the whole console now, rather than asked for per section. */
  const rank = useStaffRank()

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

  const openTicket = async (id: number) => {
    setBusy(id)
    try {
      const ticket = await reportTicket(id)
      if (!ticket) { say('That report could not be read.', 'error'); return }
      setOpen(ticket)
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
    <div className="space-y-5">
      <p className="text-sm text-muted">
        What people have reported. Opening one shows the thing, who it is
        about and what has been decided about them before, and the action
        happens from there - a warning, chat suspended, the account
        suspended, or the thing taken down. Deleting an account is a
        superadmin's.
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
                  variant="primary"
                  loading={busy === row.id}
                  onClick={() => void openTicket(row.id)}
                >
                  Take it
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

      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title="What happens about this"
        size="lg"
      >
        {open && (
          <ReportTriage
            ticket={open}
            rank={rank}
            onTake={async (input) => {
              const done = await takeReport({ id: open.id, ...input })
              say(
                done.action === 'nothing'
                  ? 'Recorded as nothing in it.'
                  : done.until
                    ? `Done, until ${new Date(done.until).toLocaleString()}.`
                    : 'Done.',
                'success',
              )
              setOpen(null)
              reports.reload()
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------- map */

/** Roughly where people are, and what that does and does not mean. */
export function MapSection() {
  const [days, setDays] = useState(30)
  const dots = useAsync(async () => wherePeopleAre(days), [days])
  /** Whichever country the pointer is on, on the map or in the list. */
  const [over, setOver] = useState<string | null>(null)

  const zones = dots.data ?? []
  const countries = useMemo(() => sharesByCountry(zones), [zones])
  const total = countries.reduce((sum, one) => sum + one.how_many, 0)
  const lit = countries.find((one) => one.code === over) ?? null
  const zonesOf = (code: string) =>
    zones.filter((one) => (placeOfZone(one.zone)?.country ?? one.country) === code)

  return (
    <div className="space-y-5">
      {/* --------------------------------------------------- how far back */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          A country is shaded by its share of everybody seen in that time. The
          zone is a setting on somebody&rsquo;s machine, so it is a hint and
          never evidence.
        </p>
        <Choices
          value={String(days)}
          onChange={(next) => setDays(Number(next))}
          options={[
            { value: '1', label: 'Today' },
            { value: '7', label: 'This week' },
            { value: '30', label: 'This month' },
            { value: '365', label: 'This year' },
          ]}
        />
      </div>

      {/* ------------------------------------------------------- the world */}
      {dots.loading && !dots.data
        ? <Skeleton className="aspect-[2/1] w-full rounded-2xl" />
        : <CountryMap countries={countries} active={over} onHover={setOver} />}

      {/* ------------------------------------- what the pointer is telling */}
      <div className="flex min-h-[2.75rem] flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-ink-raised px-4 py-2.5">
        {lit ? (
          <>
            <span className="font-display text-sm">{lit.name}</span>
            <span className="text-xs text-muted">
              {zonesOf(lit.code).map((one) => one.zone).join(', ') || 'no zone'}
            </span>
            <span className="ml-auto text-sm font-bold tabular-nums">
              {formatCount(lit.how_many)}
              <span className="ml-2 font-normal text-muted">
                {(lit.share * 100).toFixed(lit.share < 0.1 ? 1 : 0)}% of everybody
              </span>
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">
            {total === 0
              ? 'Nobody has been seen anywhere in that time.'
              : `${formatCount(total)} accounts, ${countries.length} ${countries.length === 1 ? 'country' : 'countries'}, ${zones.length} zones. Point at one.`}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------- the table */}
      {!!countries.length && (
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {countries.map((one, i) => (
            <button
              key={one.code}
              type="button"
              style={{ animationDelay: `${Math.min(i, 16) * 25}ms` }}
              onMouseEnter={() => setOver(one.code)}
              onMouseLeave={() => setOver(null)}
              onFocus={() => setOver(one.code)}
              onBlur={() => setOver(null)}
              className={cn(
                'flex animate-row-in items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                over === one.code ? 'bg-ink-hover text-white' : 'text-muted hover:bg-ink-hover',
              )}
            >
              <span className="w-7 shrink-0 font-display text-[11px] uppercase tracking-wider">
                {one.code}
              </span>
              <span className="min-w-0 flex-1 truncate">{one.name}</span>
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-ink-line">
                <span
                  className="block h-full rounded-full bg-brand-bright"
                  style={{ width: `${Math.round((one.how_many / countries[0].how_many) * 100)}%` }}
                />
              </span>
              <span className="w-7 shrink-0 text-right font-bold tabular-nums text-white">
                {one.how_many}
              </span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                {(one.share * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
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
    <div className="space-y-5">
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
    <div className="space-y-5">
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
  { value: 'block', label: 'Block - refuse it outright' },
  { value: 'review', label: 'Review - let it through and flag it' },
  { value: 'ok', label: 'Allow - an exception to another pattern' },
] as const

/**
 * Plain words, turned into the pattern the filter actually wants.
 *
 * Adding a word meant writing `(^|[^a-z])(one|two)` by hand, which is a
 * thing three people on this planet enjoy and nobody should have to do to
 * block a slur. Typing the words is the normal way in now; the regular
 * expression is still there for the cases that need one.
 *
 * The guard at the front is the part that matters and the part somebody
 * typing in a hurry forgets: without it, "ass" catches "class" and "grass"
 * and a quarter of the chat is refused by a pattern that looked right.
 */
function patternFor(words: string): string {
  const parts = words
    .split(/[,\n]/)
    .map((one) => one.trim().toLowerCase())
    .filter(Boolean)
    // Anything with meaning in a regular expression is taken literally: a
    // word is a word here, not a pattern.
    .map((one) => one.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'))
  if (!parts.length) return ''
  return `(^|[^a-z])(${parts.join('|')})`
}

const scopeWords: Record<string, string> = {
  all: 'everywhere',
  say: 'chat only',
  identity: 'names and descriptions',
}

/**
 * What the filter catches, and the two ways of adding to it.
 *
 * The old panel was one long list of regular expressions with an Add button
 * that opened a dialog asking for another one. That is a page for whoever
 * wrote it. This one sorts the list into what it does, lets somebody type
 * the words rather than the pattern, and has Kobby draft a set from a
 * sentence - "censor everything about rape" - which is the thing Staw asked
 * for, with the one condition that it drafts and a person applies.
 */
export function WordsSection() {
  const say = useToast()
  const [terms, setTerms] = useState<FlaggedTerm[] | null>(null)
  const [editing, setEditing] = useState<Partial<FlaggedTerm> | null>(null)
  const [sample, setSample] = useState('')
  const [caught, setCaught] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  const [only, setOnly] = useState('')

  /* The quick way in: words, a reason, done. */
  const [quick, setQuick] = useState('')
  const [quickWhy, setQuickWhy] = useState('')

  /* Kobby's draft, and which lines of it are ticked. */
  const [asking, setAsking] = useState('')
  const [draft, setDraft] = useState<KobbyDraft | null>(null)
  const [taking, setTaking] = useState<Set<number>>(new Set())
  const [drafting, setDrafting] = useState(false)

  const load = useCallback(async () => {
    try {
      setTerms(await listFlaggedTerms())
    } catch (error) {
      say(error instanceof Error ? error.message : 'Could not read the list.', 'error')
      setTerms([])
    }
  }, [say])

  // Loaded when the section is opened rather than with the page. In an
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

  const addQuickly = async () => {
    const pattern = patternFor(quick)
    if (!pattern) return
    setBusy(true)
    try {
      await saveFlaggedTerm({
        pattern,
        decision: 'block',
        reason: quickWhy.trim() || 'Added from the console',
        scope: 'all',
      })
      say(`Blocked. ${quick.split(/[,\n]/).filter(Boolean).length} word(s) in one pattern.`, 'success')
      setQuick('')
      setQuickWhy('')
      await load()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const askKobby = async () => {
    if (!asking.trim()) return
    setDrafting(true)
    setDraft(null)
    try {
      const drafted = await askKobbyForWords(asking)
      setDraft(drafted)
      setTaking(new Set(drafted.words.map((_, i) => i)))
      if (!drafted.words.length && !drafted.settings) {
        say(drafted.note || 'Kobby had nothing to add for that.', 'info')
      }
    } catch (error) {
      say(error instanceof Error ? error.message : 'Kobby did not answer.', 'error')
    } finally {
      setDrafting(false)
    }
  }

  const applyDraft = async () => {
    if (!draft) return
    setBusy(true)
    let added = 0
    try {
      for (const [i, one] of draft.words.entries()) {
        if (!taking.has(i)) continue
        await saveFlaggedTerm({
          pattern: one.pattern,
          decision: one.decision,
          reason: one.reason || asking.slice(0, 80),
          scope: one.scope,
        })
        added += 1
      }
      if (draft.settings) await setAiSettings(draft.settings)
      say(
        added
          ? `${added} added to the list${draft.settings ? ', and the machine changed.' : '.'}`
          : 'The machine changed.',
        'success',
      )
      setDraft(null)
      setAsking('')
      await load()
    } catch (error) {
      say(error instanceof Error ? error.message : 'Some of that did not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const tone = (decision: string) =>
    decision === 'block' ? 'danger' : decision === 'review' ? 'warm' : 'space'

  const shown = (terms ?? []).filter((term) => {
    if (only && term.decision !== only) return false
    const needle = filter.trim().toLowerCase()
    if (!needle) return true
    return term.pattern.toLowerCase().includes(needle)
      || (term.reason ?? '').toLowerCase().includes(needle)
  })

  const howMany = (decision: string) =>
    (terms ?? []).filter((one) => one.decision === decision).length

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------- adding a word */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="mute-microphone" className="w-4 text-danger-bright" />
          <p className="font-display text-sm">Block some words</p>
          <span className="text-xs text-muted">
            Type them as words. The pattern is written for you, guarded so it cannot
            catch an ordinary one.
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Input
            label="Words"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="one word, another, a short phrase"
          />
          <Input
            label="Why"
            value={quickWhy}
            onChange={(e) => setQuickWhy(e.target.value)}
            placeholder="Slur, Scam, Sexual content…"
          />
          <Button variant="yes" disabled={busy || !quick.trim()} onClick={() => void addQuickly()}>
            <FontAwesomeIcon icon={faPlus} />
            Block
          </Button>
        </div>
        {!!quick.trim() && (
          <p className="truncate font-mono text-[11px] text-muted">{patternFor(quick)}</p>
        )}
        <button
          type="button"
          onClick={() => { setEditing({ decision: 'block', scope: 'all' }); setCaught(null) }}
          className="text-xs font-bold text-link hover:underline"
        >
          Write the pattern myself
        </button>
      </Card>

      {/* --------------------------------------------------- asking Kobby */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <img src={kobbyArt.default} alt="" className="h-7 w-auto" />
          <p className="font-display text-sm">Ask Kobby</p>
          <span className="text-xs text-muted">
            It drafts; you read it and decide. Nothing is saved until you press Apply.
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[14rem] flex-1">
            <Input
              label="What should it catch"
              value={asking}
              onChange={(e) => setAsking(e.target.value)}
              placeholder="Censor everything about rape"
              onKeyDown={(e) => { if (e.key === 'Enter') void askKobby() }}
            />
          </div>
          <Button
            variant="subtle"
            icon={faRobot}
            loading={drafting}
            disabled={!asking.trim()}
            onClick={() => void askKobby()}
          >
            Draft it
          </Button>
        </div>

        {!!draft && (
          <div className="animate-pop-in space-y-2 rounded-xl border border-ink-line bg-ink-sunken p-3">
            {!!draft.note && <p className="text-xs leading-relaxed text-muted">{draft.note}</p>}

            {draft.words.map((one, i) => (
              <label
                key={one.pattern}
                style={{ animationDelay: `${i * 40}ms` }}
                className="flex animate-row-in cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-hover"
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-brand"
                  checked={taking.has(i)}
                  onChange={(e) => {
                    const next = new Set(taking)
                    if (e.target.checked) next.add(i); else next.delete(i)
                    setTaking(next)
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone(one.decision)}>{one.decision}</Badge>
                    <code className="min-w-0 break-all font-mono text-[11px]">{one.pattern}</code>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {one.reason} · {scopeWords[one.scope] ?? one.scope}
                  </span>
                </span>
              </label>
            ))}

            {!!draft.settings && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
                It also wants to change the machine:{' '}
                {Object.entries(draft.settings)
                  .map(([key, value]) => `${key} → ${String(value)}`)
                  .join(', ')}
                . Applying takes that too.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="yes"
                size="sm"
                disabled={busy || (!taking.size && !draft.settings)}
                onClick={() => void applyDraft()}
              >
                Apply {taking.size ? `${taking.size} of ${draft.words.length}` : 'the change'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                Throw it away
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* -------------------------------------------------------- the list */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <Input
            label={`${formatCount((terms ?? []).length)} patterns`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find one"
          />
        </div>
        <Choices
          size="sm"
          tone="soft"
          label="Showing"
          value={only}
          onChange={setOnly}
          options={[
            { value: '', label: `All ${(terms ?? []).length}` },
            { value: 'block', label: `Blocked ${howMany('block')}` },
            { value: 'review', label: `Flagged ${howMany('review')}` },
            { value: 'ok', label: `Allowed ${howMany('ok')}` },
          ]}
        />
      </div>

      {terms === null && <Skeleton className="h-40" />}
      {terms?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          Nothing is being caught. Anything anybody types goes straight through.
        </p>
      )}
      {!!terms?.length && shown.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">Nothing matches that.</p>
      )}

      <div className="divide-y divide-ink-line overflow-hidden rounded-2xl border border-ink-line bg-ink-card">
        {shown.map((term, i) => (
          <div
            key={term.id}
            style={{ animationDelay: `${Math.min(i, 14) * 20}ms` }}
            className="group flex animate-row-in flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-ink-hover"
          >
            <Badge tone={tone(term.decision)}>{term.decision}</Badge>
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-white/80">
              {term.pattern}
            </code>
            <span className="text-xs text-muted">{term.reason}</span>
            <span className="text-[10px] uppercase tracking-wider text-white/25">
              {scopeWords[term.scope] ?? term.scope}
            </span>
            <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(term); setCaught(null) }}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Remove this pattern"
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
                <FontAwesomeIcon icon={faTrash} className="text-danger" />
              </Button>
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        Every pattern is a regular expression, matched without regard to case against
        names, descriptions and messages. A change here is live at once; it used to
        take a migration.
      </p>

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
          <Select
            label="Where it applies"
            value={editing?.scope ?? 'all'}
            onChange={(scope) => setEditing({ ...editing, scope })}
            options={[
              { value: 'all', label: 'Everywhere' },
              { value: 'say', label: 'Chat only' },
              { value: 'identity', label: 'Names and descriptions' },
            ]}
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

/** The day a line of the record belongs to, in the reader's own clock. */
const dayOf = (when: string) =>
  new Date(when).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

const recordWords: Record<string, string> = {
  sanction: 'Sanctioned somebody',
  ban: 'Closed an account',
  unban: 'Opened an account again',
  verify: 'Changed a tick',
  give_brix: 'Moved Brix',
  set_rank: 'Changed a rank',
  notify: 'Sent a word from Kobblon',
  delete_account: 'Deleted an account',
  clear_record: 'Cleared a behaviour record',
  take_report: 'Settled a report',
  screen: 'Screened something',
}

/*
 * A mark for each kind of thing staff do, and a colour that says how heavy
 * it is.
 *
 * Red is a decision against somebody's account, orange is one that leans
 * that way, green is one in their favour, and blue is everything else -
 * which is the same three-colour rule the rest of the site runs on, so a
 * row nobody has read yet still says something from across the room.
 */
const recordMarks: Record<string, { icon: IconDefinition; tone: 'red' | 'orange' | 'green' | 'blue' }> = {
  sanction: { icon: faGavel, tone: 'orange' },
  ban: { icon: faBan, tone: 'red' },
  unban: { icon: faUnlock, tone: 'green' },
  verify: { icon: faCircleCheck, tone: 'blue' },
  give_brix: { icon: faCoins, tone: 'blue' },
  set_rank: { icon: faUserShield, tone: 'blue' },
  notify: { icon: faEnvelope, tone: 'blue' },
  delete_account: { icon: faTrash, tone: 'red' },
  clear_record: { icon: faEraser, tone: 'green' },
  take_report: { icon: faFlag, tone: 'orange' },
  screen: { icon: faEye, tone: 'blue' },
}

const recordTones = {
  red:    { chip: 'bg-danger/15 text-danger', edge: 'bg-danger' },
  orange: { chip: 'bg-[#F08A24]/15 text-[#F6A858]', edge: 'bg-[#F08A24]' },
  green:  { chip: 'bg-space/15 text-space-bright', edge: 'bg-space' },
  blue:   { chip: 'bg-brand/20 text-brand-bright', edge: 'bg-brand' },
} as const

const markFor = (action: string) =>
  recordMarks[action] ?? { icon: faClipboardList, tone: 'blue' as const }

/**
 * The two or three things from an entry's detail worth reading without
 * opening it: the length of a sanction, the number of Brix, the rank
 * somebody was given. Whatever is left stays in the popup.
 */
function recordGist(entry: RecordEntry): string[] {
  const out: string[] = []
  const d = entry.detail
  const text = (key: string) => (typeof d[key] === 'string' ? d[key] as string : null)
  const number = (key: string) => (typeof d[key] === 'number' ? d[key] as number : null)

  const days = number('days')
  if (days !== null) out.push(days === 0 ? 'a warning' : `${days} ${days === 1 ? 'day' : 'days'}`)
  const amount = number('amount')
  if (amount !== null) out.push(`${formatCount(Math.abs(amount))} Brix`)
  for (const key of ['rule', 'rank', 'decision', 'why', 'reason']) {
    const said = text(key)
    if (said) out.push(said.replace(/_/g, ' '))
  }
  if (typeof d.verified === 'boolean') out.push(d.verified ? 'given' : 'taken away')

  return out.slice(0, 3)
}

/**
 * One thing somebody did, as a card you can read at a glance.
 *
 * Staw: "I WANT A NEW FREAKING DESIGN FOR THE RECORD CARDS SO IT LOOKS
 * COOL". What was there was a ledger line - a time, a sentence, an arrow -
 * which is dense and readable and says nothing until you have read it. This
 * says what kind of thing it was before you read anything: a coloured edge
 * down the left, a marked chip for the action, the sentence, and the two or
 * three numbers out of the detail that the line used to hide. The whole
 * detail is still a press away, because three of them is a summary and all
 * of them is a database row read out loud.
 */
function RecordCard({ entry, delay, onOpen }: {
  entry: RecordEntry
  delay: number
  onOpen: () => void
}) {
  const mark = markFor(entry.action)
  const tone = recordTones[mark.tone]
  const gist = recordGist(entry)
  const at = new Date(entry.created_at)

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${delay}ms` }}
      className="group relative flex w-full animate-row-in items-start gap-3.5 overflow-hidden rounded-2xl border border-ink-line bg-ink-card p-3.5 text-left transition-colors hover:border-white/15 hover:bg-ink-hover sm:gap-4 sm:p-4"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', tone.edge)} aria-hidden />

      <span className={cn(
        'ml-1 grid size-10 shrink-0 place-items-center rounded-xl text-base',
        tone.chip,
      )}>
        <FontAwesomeIcon icon={mark.icon} />
      </span>

      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="block font-display text-sm leading-tight">
          {recordWords[entry.action] ?? entry.action}
          {entry.subject_label && (
            <span className="text-muted"> · <span className="text-white">@{entry.subject_label}</span></span>
          )}
        </span>

        <span className="block text-xs text-muted">
          {entry.by_username ? `@${entry.by_username}` : 'somebody since deleted'}
          {' · '}
          {at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </span>

        {gist.length > 0 && (
          <span className="flex flex-wrap gap-1.5 pt-0.5">
            {gist.map((bit, i) => (
              <span
                key={`${bit}-${i}`}
                className="truncate rounded-lg border border-ink-line bg-ink-raised px-2 py-1 text-[11px] font-semibold text-white/70"
              >
                {bit}
              </span>
            ))}
          </span>
        )}
      </span>

      <FontAwesomeIcon
        icon={faArrowRight}
        className="mt-3 shrink-0 text-xs text-white/20 transition-transform group-hover:translate-x-0.5 group-hover:text-white/45"
      />
    </button>
  )
}

/**
 * What staff have done, as a ledger rather than a list of cards.
 *
 * The old one drew every entry as a Card with its detail flattened into
 * `key: value · key: value`, which is a database row read out loud. This is
 * the shape a ledger has: grouped by the day, one line each, the time in a
 * column you can run your eye down - and the whole detail in a popup when
 * somebody actually needs it, because nine times in ten the line is enough
 * and the tenth time you want all of it, not a truncated middle.
 */
export function RecordSection() {
  const [what, setWhat] = useState<string>('')
  const [term, setTerm] = useState('')
  const [asked, setAsked] = useState('')
  const [since, setSince] = useState<number | null>(null)
  const [open, setOpen] = useState<RecordEntry | null>(null)

  const kinds = useAsync(async () => staffRecordKinds(), [])
  const rows = useAsync(
    async () => staffRecord({ what, term: asked, sinceHours: since, limit: 200 }),
    [what, asked, since],
  )

  const when: { value: number | null; label: string }[] = [
    { value: null, label: 'Everything' },
    { value: 24, label: 'Today' },
    { value: 24 * 7, label: 'This week' },
    { value: 24 * 30, label: 'This month' },
  ]

  /* Grouped as it is read: by day, newest first, in the order the rows
     already arrive in. */
  const days: { day: string; entries: RecordEntry[] }[] = []
  for (const entry of rows.data ?? []) {
    const day = dayOf(entry.created_at)
    const last = days[days.length - 1]
    if (last?.day === day) last.entries.push(entry)
    else days.push({ day, entries: [entry] })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="flex min-w-[14rem] flex-1 items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); setAsked(term) }}
        >
          <div className="min-w-0 flex-1">
            <Input
              label="Find in the record"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="A handle, a staff name, or anything in the detail"
            />
          </div>
          <Button type="submit" variant="subtle" disabled={rows.loading}>
            <FontAwesomeIcon icon={rows.loading ? faSpinner : faMagnifyingGlass} spin={rows.loading} />
            Look
          </Button>
        </form>
        {(asked || what || since !== null) && (
          <Button
            variant="ghost"
            onClick={() => { setTerm(''); setAsked(''); setWhat(''); setSince(null) }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Two rows, each said out loud. They were one wrapping line, and
          both of them start with a chip called "Everything" - so the row
          read as one list with the same word twice in it. */}
      <div className="space-y-3.5">
        <Field label="Which kind">
          <Choices
            size="sm"
            tone="soft"
            label="Which kind"
            value={what}
            onChange={setWhat}
            options={[
              { value: '', label: 'Everything' },
              ...(kinds.data ?? []).map((one) => ({
                value: one.action,
                label: `${recordWords[one.action] ?? one.action} ${one.how_many}`,
              })),
            ]}
          />
        </Field>
        <Field label="How far back">
          <Choices
            size="sm"
            tone="soft"
            label="How far back"
            value={String(since)}
            onChange={(picked) => setSince(picked === 'null' ? null : Number(picked))}
            options={when.map((one) => ({ value: String(one.value), label: one.label }))}
          />
        </Field>
      </div>

      {rows.loading && <Skeleton className="h-40" />}
      {rows.error && <ErrorState message={rows.error} onRetry={rows.reload} />}
      {!rows.loading && !rows.data?.length && (
        <p className="py-8 text-center text-sm text-muted">
          {asked || what || since !== null ? 'Nothing matches that.' : 'Nothing yet.'}
        </p>
      )}

      {days.map(({ day, entries }) => (
        <div key={day} className="space-y-2 pt-1">
          <p className="sticky kob-under-bar z-10 -mx-1 bg-ink/90 px-1 py-1.5 font-display text-[11px] uppercase tracking-wider text-muted backdrop-blur-sm">
            {day}
            <span className="ml-2 font-sans normal-case tracking-normal text-white/25">
              {entries.length}
            </span>
          </p>
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <RecordCard
                key={entry.id}
                entry={entry}
                delay={Math.min(i, 14) * 20}
                onOpen={() => setOpen(entry)}
              />
            ))}
          </div>
        </div>
      ))}

      {!!rows.data?.length && (
        <p className="text-[11px] text-muted">
          {rows.data.length === 200 ? 'The newest two hundred.' : `${rows.data.length} of them.`}{' '}
          Kept where whoever did it cannot edit it, and a deleted account keeps its name here.
        </p>
      )}

      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? (recordWords[open.action] ?? open.action) : ''}
        description={open
          ? `${open.by_username ? `@${open.by_username}` : 'Somebody since deleted'}, ${timeAgo(open.created_at)}`
          : undefined}
      >
        {!!open && (
          <div className="space-y-3">
            {!!open.subject_label && (
              <div className="flex items-center justify-between rounded-xl bg-ink-sunken px-3 py-2 text-sm">
                <span className="text-muted">Who it was about</span>
                <span className="font-bold">@{open.subject_label}</span>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-ink-line">
              {Object.entries(open.detail)
                .filter(([, value]) => value !== null && value !== '')
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 border-b border-ink-line px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="shrink-0 text-muted">{key.replace(/_/g, ' ')}</span>
                    <span className="min-w-0 break-words text-right font-medium">
                      {String(value)}
                    </span>
                  </div>
                ))}
              {Object.values(open.detail).every((value) => value === null || value === '') && (
                <p className="px-3 py-3 text-sm text-muted">Nothing else was written down.</p>
              )}
            </div>
            <p className="text-[11px] text-muted">
              Written at {new Date(open.created_at).toLocaleString()}.
            </p>
          </div>
        )}
      </Dialog>
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
/** One key cap, for a line that tells somebody the shortcuts exist. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-ink-line bg-ink-raised px-1.5 py-0.5 text-[10px] font-bold text-white/70">
      {children}
    </kbd>
  )
}

export function ScreenRow({
  picture, name, kind, description, maker, makerLink, when, onDecide, focused, onReady,
}: {
  picture: string | null
  name: string
  kind: string
  description?: string | null
  maker: string
  makerLink: string
  when?: string | null
  onDecide: (decision: 'approved' | 'rejected', note?: string) => Promise<void>
  /** Whether the keyboard is on this one. Screening is a hundred of these. */
  focused?: boolean
  /**
   * Hands the row's two actions up so A and R can reach them.
   *
   * Approving is one keypress because approving is the usual answer and
   * it is reversible. **Rejecting is not**: R opens the box and the note
   * is still required, because the note is what the maker is told, and a
   * refusal with no reason is the thing this console exists to avoid.
   */
  onReady?: (api: { approve: () => void; askReject: () => void }) => void
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

  /*
   * Re-handed on every render rather than once: `decide` closes over
   * `onDecide`, which the section rebuilds each time its queue reloads,
   * and a callback captured once would be approving against a stale
   * queue. That is this project's oldest trap and it is cheap to avoid
   * here.
   */
  useEffect(() => {
    onReady?.({
      approve: () => void decide('approved'),
      askReject: () => setAsking(true),
    })
  })

  return (
    <Card
      className={cn(
        'flex flex-wrap items-start gap-4 p-3 sm:flex-nowrap',
        focused && 'ring-2 ring-brand-bright/70',
      )}
    >
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

  /*
   * The keyboard. Screening is the one panel somebody sits in front of
   * for an hour, and a hundred decisions at two clicks each is the reason
   * things sit in this queue for days.
   *
   * J and K move, A approves, R opens the refusal box. Held off while
   * somebody is typing in a field - otherwise writing "a reason" in the
   * note box approves three things behind it.
   */
  const howMany = (queue === 'Catalog' ? items.data?.length : uploads.data?.length) ?? 0
  const [at, setAt] = useState(0)
  const hands = useRef(new Map<number, { approve: () => void; askReject: () => void }>())

  useEffect(() => { setAt(0) }, [queue])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const on = document.activeElement
      const typing = on instanceof HTMLInputElement || on instanceof HTMLTextAreaElement
        || (on instanceof HTMLElement && on.isContentEditable)
      if (typing || e.metaKey || e.ctrlKey || e.altKey || !howMany) return

      const key = e.key.toLowerCase()
      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault(); setAt((n) => Math.min(n + 1, howMany - 1))
      } else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault(); setAt((n) => Math.max(n - 1, 0))
      } else if (key === 'a') {
        e.preventDefault(); hands.current.get(at)?.approve()
      } else if (key === 'r') {
        e.preventDefault(); hands.current.get(at)?.askReject()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [at, howMany])

  const keys = (i: number) => ({
    focused: i === at,
    onReady: (api: { approve: () => void; askReject: () => void }) => {
      hands.current.set(i, api)
    },
  })

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Everything a person has to look at. Most uploads never reach here -
        the screener approves or refuses them as they arrive - so what is
        waiting is what it could not decide.
      </p>

      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Key>J</Key><Key>K</Key> move ·
        <Key>A</Key> approve ·
        <Key>R</Key> turn down, which still asks you why
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
          ) : items.data.map((item, i) => (
            <ScreenRow
              key={item.id}
              {...keys(i)}
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
        ) : uploads.data.map((one, i) => (
          <ScreenRow
            key={one.id}
            {...keys(i)}
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


/* ----------------------------------------------------------------- economy */

/**
 * The Brix, in one page.
 *
 * Staw: "turn the sale category into economy page where we can regulate the
 * brix in circulation, get stats with graphics, evolution of the limited
 * items, we can stil put promotions on the whole catalog, we can also
 * create quests that is a brix claim".
 *
 * The console already had both levers - `admin_move_brix` on one account,
 * a sale across the Catalog - and no gauge beside either. So the reading
 * comes first and the levers sit under it: what exists, where it came from
 * this month, where it went, what the limiteds are doing, and then the two
 * ways of putting Brix into the world (a handout quest anybody may claim,
 * or a number onto one account) and the one way of taking the prices down.
 *
 * Every figure is the database's - four `security definer` reads, all
 * `require_admin()`, none of which can write. The ledger's own policy is
 * untouched: `pixel_transactions` is still only readable by the person it
 * belongs to.
 */

const WINDOWS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

/** The ledger's reasons, in words rather than in column values. */
const kindWords: Record<string, string> = {
  signup_grant: 'Signing up', daily: 'Daily', purchase: 'Bought something',
  sale: 'Sold something', refund: 'Refunds', admin: 'Staff handed out',
  username_change: 'Name changes', donation: 'Donations', ad_budget: 'Ad budgets',
  ad_refund: 'Ad refunds', ad_earning: 'Ad earnings', listing_fee: 'Listing fees',
  listing_refund: 'Listing refunds', platform_fee: 'Platform fees', burn: 'Burned',
  code: 'Codes', item_edit: 'Item edits', gift_sent: 'Gifts sent',
  gift_received: 'Gifts received', quest: 'Quests', quest_tag: 'Quest tags',
}

const dayLabel = (day: string) =>
  new Date(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/*
 * When a limited stops selling. `timeAgo` answers "just now" for anything
 * ahead of the clock, which on a column headed "Closes" reads as a limited
 * that has already gone - so a date ahead gets the date.
 */
const closesOn = (when: string) => {
  const left = new Date(when).getTime() - Date.now()
  if (left <= 0) return 'Closed'
  const days = Math.floor(left / 86_400_000)
  if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`
  const hours = Math.max(1, Math.floor(left / 3_600_000))
  return `in ${hours}h`
}

/** A figure with its name under it, for the row across the top. */
function Figure({ label, value, mark, tone, note }: {
  label: string
  value: number
  mark?: boolean
  tone?: string
  note?: string
}) {
  return (
    <div className="rounded-2xl border border-ink-line bg-ink-card px-5 py-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-2 flex items-center gap-1.5 font-display text-2xl font-extrabold leading-none', tone)}>
        {mark && <CurrencyMark className="h-4" />}
        {formatCount(value)}
      </p>
      {note && <p className="mt-1.5 truncate text-[11px] text-muted">{note}</p>}
    </div>
  )
}

/** Handing Brix out in the open: a quest with nothing to do but accept it. */
function HandOut({ onDone }: { onDone: () => void }) {
  const say = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [lead, setLead] = useState('')
  const [reward, setReward] = useState('100')
  const [days, setDays] = useState('7')
  const [busy, setBusy] = useState(false)

  const amount = Number(reward)
  const sane = !!title.trim() && Number.isFinite(amount) && amount >= 1 && amount <= 100000

  const write = async () => {
    setBusy(true)
    try {
      await addQuest({
        title: title.trim(),
        counted: 'claim',
        goal: 1,
        reward: amount,
        lead: lead.trim() || null,
        until: new Date(Date.now() + Number(days) * 86_400_000).toISOString(),
      })
      say(`${formatCount(amount)} Brix, there for anybody who wants them.`, 'success')
      setTitle(''); setLead('')
      setOpen(false)
      onDone()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="subtle" icon={faWandMagicSparkles} onClick={() => setOpen(true)}>
        Hand out Brix
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Brix for anybody"
        description={
          'A quest with nothing to do: it turns up on the board, anybody may '
          + 'accept it, and claiming it pays out. One each, and it stops when '
          + 'the window closes.'
        }
        footer={(
          <div className="flex items-center justify-end gap-2">
            <Button variant="subtle" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="yes" loading={busy} disabled={!sane} onClick={() => void write()}>
              Put it on the board
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <Input
            label="What it is called"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Happy Halloween"
          />
          <Textarea
            label="A line under it"
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            rows={2}
            placeholder="On us. Nothing to do."
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Input
                label="How much"
                type="number"
                min={1}
                max={100000}
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
            </div>
            <Choices
              size="sm"
              tone="soft"
              label="For how long"
              value={days}
              options={WINDOWS.map((one) => ({ value: one.value, label: one.label }))}
              onChange={setDays}
            />
          </div>

          {/*
            * What it costs if everybody takes it. A handout is the one thing
            * in this panel that can move the whole supply in a day, and the
            * number nobody works out beforehand is this one.
            */}
          {sane && (
            <Note tone="brand">
              Every account that claims it gets {formatCount(amount)}. A thousand
              claims is {formatCount(amount * 1000)} Brix into circulation.
            </Note>
          )}
        </div>
      </Dialog>
    </>
  )
}

/** Giving to, or taking from, one account. */
function OneAccount({ onDone }: { onDone: () => void }) {
  const say = useToast()
  const [term, setTerm] = useState('')
  const [picked, setPicked] = useState<Profile | null>(null)
  const [amount, setAmount] = useState('')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)

  const found = useAsync(async () => (term.trim().length > 1 ? searchProfiles(term) : []), [term])
  const moving = Number(amount)
  const sane = !!picked && Number.isFinite(moving) && moving !== 0

  const move = async () => {
    if (!picked) return
    setBusy(true)
    try {
      const left = await moveBrixAsStaff(picked.id, moving, why.trim() || undefined)
      say(`${picked.display_name} now holds ${formatCount(left)}.`, 'success')
      setAmount(''); setWhy('')
      onDone()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div>
        <h3 className="font-display text-lg font-extrabold">Give or take, one account</h3>
        <p className="mt-1 text-sm text-muted">
          A negative number takes. Taking more than somebody has takes what
          they have - there is no debt here. Every move is written to the
          staff record with whoever made it.
        </p>
      </div>

      {picked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-line bg-ink-raised px-3 py-2">
          <Avatar src={avatarOf(picked)} personId={picked.id} name={picked.display_name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{picked.display_name}</p>
            <p className="truncate text-xs text-muted">
              @{picked.username} · holds {formatCount(picked.pixels ?? 0)}
            </p>
          </div>
          <Button
            className="ml-auto"
            size="sm"
            variant="ghost"
            icon={faXmark}
            aria-label="Pick somebody else"
            onClick={() => setPicked(null)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            icon={faMagnifyingGlass}
            label="Who"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="A name or a handle"
          />
          {!!found.data?.length && (
            <div className="max-h-44 overflow-y-auto rounded-xl border border-ink-line">
              {found.data.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  onClick={() => { setPicked(one); setTerm('') }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-ink-hover"
                >
                  <Avatar src={avatarOf(one)} personId={one.id} name={one.display_name} size="xs" />
                  <span className="truncate text-sm font-semibold">{one.display_name}</span>
                  <span className="truncate text-xs text-muted">@{one.username}</span>
                  <span className="ml-auto text-xs font-bold tabular-nums">
                    {formatCount(one.pixels ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36">
          <Input
            label="How much"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Input
            label="Why (kept on the record)"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Competition prize"
          />
        </div>
        <Button loading={busy} disabled={!sane} onClick={() => void move()}>
          {moving < 0 ? 'Take it' : 'Give it'}
        </Button>
      </div>
    </Card>
  )
}

export function EconomySection() {
  const [days, setDays] = useState('30')
  const span = Number(days)

  const now = useAsync(async () => economyNow(), [])
  const flow = useAsync(async () => economyFlow(span), [span])
  const kinds = useAsync(async () => economyByKind(span), [span])
  const market = useAsync(async () => limitedMarket(span), [span])

  const reload = () => { now.reload(); flow.reload(); kinds.reload() }

  const rows = flow.data ?? []
  const labels = rows.map((row) => dayLabel(row.day))

  const figures = now.data

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-muted">
          What exists, where it came from and where it went. Nothing on this
          page is an estimate - it is the ledger, read back.
        </p>
        <Choices
          size="sm"
          tone="soft"
          label="Over"
          value={days}
          options={WINDOWS}
          onChange={setDays}
        />
      </div>

      {/* ----------------------------------------------------- the figures */}
      {now.loading || !figures ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Figure
            label="In circulation"
            value={figures.in_circulation}
            mark
            note={`${formatCount(figures.holders)} accounts holding any`}
          />
          <Figure
            label="Made, 30 days"
            value={figures.minted}
            mark
            tone="text-space-bright"
            note={`${formatCount(figures.movements)} movements`}
          />
          <Figure
            label="Spent, 30 days"
            value={figures.burned}
            mark
            tone="text-danger"
            note={`${formatCount(figures.resold)} of it on resales`}
          />
          <Figure
            label="Average held"
            value={figures.average}
            mark
            note={`biggest holder has ${formatCount(figures.richest)}`}
          />
        </div>
      )}

      {/* -------------------------------------------------------- the shape */}
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-extrabold">In and out</h3>
            <p className="mt-1 text-sm text-muted">
              What was written onto accounts each day, against what came off
              them. The two crossing is the month the supply turned around.
            </p>
          </div>
        </div>

        {flow.loading ? <Skeleton className="h-48" /> : rows.length ? (
          <LineGraph
            labels={labels}
            series={[
              { label: 'Made', values: rows.map((row) => row.minted), tone: 'text-space-bright' },
              { label: 'Spent', values: rows.map((row) => row.burned), tone: 'text-danger' },
            ]}
          />
        ) : (
          <p className="text-sm text-muted">Nothing has moved in this window.</p>
        )}
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="font-display text-lg font-extrabold">Everything anybody holds</h3>
          <p className="mt-1 text-sm text-muted">
            The total on every account at the end of each day, walked back off
            today's figure. A line that only goes up is a currency nothing
            takes out again.
          </p>
        </div>
        {flow.loading ? <Skeleton className="h-40" /> : rows.length ? (
          <LineGraph
            labels={labels}
            height={150}
            series={[{
              label: 'Held',
              values: rows.map((row) => row.held),
              tone: 'text-brand-bright',
              summary: 'last',
            }]}
          />
        ) : (
          <p className="text-sm text-muted">Nothing to draw yet.</p>
        )}
      </Card>

      {/* --------------------------------------------------- where it goes */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-5 p-5 sm:p-6">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Glyph icon={faArrowTrendUp} className="text-space-bright" />
              Where it comes from
            </h3>
          </div>
          {kinds.loading ? <Skeleton className="h-40" /> : (
            <BarRows
              rows={(kinds.data ?? [])
                .filter((one) => one.came > 0)
                .slice(0, 8)
                .map((one) => ({
                  label: kindWords[one.kind] ?? one.kind,
                  value: one.came,
                  tone: 'bg-space',
                  note: `· ${formatCount(one.movements)}`,
                }))}
            />
          )}
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <Glyph icon={faArrowTrendDown} className="text-danger" />
              Where it goes
            </h3>
          </div>
          {kinds.loading ? <Skeleton className="h-40" /> : (
            <BarRows
              rows={(kinds.data ?? [])
                .filter((one) => one.went > 0)
                .slice(0, 8)
                .map((one) => ({
                  label: kindWords[one.kind] ?? one.kind,
                  value: one.went,
                  tone: 'bg-danger',
                  note: `· ${formatCount(one.movements)}`,
                }))}
            />
          )}
        </Card>
      </div>

      {/* ----------------------------------------------------- the limiteds */}
      <Card className="space-y-5 overflow-hidden p-5 sm:p-6">
        <div>
          <h3 className="font-display text-lg font-extrabold">The limiteds</h3>
          <p className="mt-1 text-sm text-muted">
            What each one has been going for inside this window, against what
            it went for before it. Two numbers rather than a percentage: an
            item with one sale either side is not "up 300%".
          </p>
        </div>

        {market.loading ? <Skeleton className="h-40" /> : !market.data?.length ? (
          <p className="text-sm text-muted">Nothing is limited yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="pb-2.5 font-bold">Item</th>
                  <th className="pb-2.5 font-bold">Closes</th>
                  <th className="pb-2.5 text-right font-bold">Going for</th>
                  <th className="pb-2.5 text-right font-bold">Was</th>
                  <th className="pb-2.5 text-right font-bold">Sales</th>
                  <th className="pb-2.5 text-right font-bold">On offer</th>
                </tr>
              </thead>
              <tbody>
                {market.data.map((one) => {
                  const moved = one.average_before > 0 && one.average_window > 0
                    ? one.average_window - one.average_before
                    : 0
                  return (
                    <tr key={one.item_id} className="border-t border-ink-line">
                      <td className="py-2.5 pr-3">
                        <span className="font-bold">{one.name}</span>
                        <span className="ml-2 text-xs text-muted">
                          listed at {formatCount(one.price)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted">
                        {one.closed ? 'Closed' : closesOn(one.sells_until)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold tabular-nums">
                        {one.average_window ? formatCount(one.average_window) : '-'}
                        {moved !== 0 && (
                          <span className={cn('ml-1.5 text-xs', moved > 0 ? 'text-space-bright' : 'text-danger')}>
                            {moved > 0 ? '+' : ''}{formatCount(moved)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-muted">
                        {one.average_before ? formatCount(one.average_before) : '-'}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatCount(one.sold_window)}
                        <span className="ml-1 text-xs text-muted">/ {formatCount(one.sold_total)}</span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {one.offers
                          ? <>{formatCount(one.offers)} <span className="text-xs text-muted">from {formatCount(one.cheapest ?? 0)}</span></>
                          : <span className="text-muted">-</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- the levers */}
      <div className="space-y-5 border-t border-ink-line pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-extrabold">Putting it in, taking it out</h3>
            <p className="mt-1 text-sm text-muted">
              Two ways in - a handout anybody may claim, or a number onto one
              account - and one way of making everything cost less.
            </p>
          </div>
          <HandOut onDone={reload} />
        </div>

        <OneAccount onDone={reload} />

        <Card className="space-y-5 p-5 sm:p-6">
          <h3 className="font-display text-lg font-extrabold">A sale across the Catalog</h3>
          <SaleSection />
        </Card>
      </div>
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
 *
 * Rebuilt from a row of number boxes, which is the shape of the table and
 * not the shape of the decision. The decision is "how much off, for how
 * long", and both of those are picked from the handful anybody actually
 * picks, with a box beside them for the one time somebody wants 37. What a
 * sale does to a price is shown rather than left to be worked out, and
 * while one is on, the panel leads with when it ends, because that is the
 * only question anybody opens this panel to answer twice.
 */

const OFF = [10, 20, 30, 50]
const FOR_DAYS = [
  { value: '1', label: 'A day' },
  { value: '3', label: '3 days' },
  { value: '7', label: 'A week' },
  { value: '14', label: 'A fortnight' },
]

/** Long enough that a number is a sentence: "2 days, 4 hours". */
function howLongLeft(until: string) {
  const left = new Date(until).getTime() - Date.now()
  if (left <= 0) return 'any moment'
  const hours = Math.floor(left / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}, ${hours % 24}h left`
  const minutes = Math.floor(left / 60_000)
  return hours >= 1 ? `${hours}h ${minutes % 60}m left` : `${minutes}m left`
}

export function SaleSection() {
  const say = useToast()
  const [percent, setPercent] = useState('20')
  const [days, setDays] = useState('3')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)

  const sale = useAsync(async () => saleNow(), [])

  const off = Number(percent)
  const sane = Number.isFinite(off) && off >= 1 && off <= 75

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
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Everything in the Catalog comes down by the same percentage until it
        ends. Limiteds keep their price - somebody paid what a limited cost
        because it was closing - and nothing ever comes down to nothing.
      </p>

      {sale.loading ? <Skeleton className="h-28" /> : sale.data ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-ink-line bg-space/10 px-5 py-4">
            <div>
              <p className="font-display text-4xl font-extrabold leading-none text-space-bright">
                {sale.data.percent_off}% off
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">
                On right now
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">{howLongLeft(sale.data.ends_at)}</p>
              <p className="truncate text-xs text-muted">
                Ends {new Date(sale.data.ends_at).toLocaleString(undefined, {
                  weekday: 'long', day: 'numeric', month: 'long',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <Button
              className="ml-auto"
              variant="danger"
              loading={busy}
              onClick={() => void stop()}
            >
              End it now
            </Button>
          </div>
          {sale.data.note && (
            <p className="px-5 py-3 text-sm text-muted">
              Shown on the Catalog as <span className="font-bold text-white">{sale.data.note}</span>
            </p>
          )}
        </Card>
      ) : (
        <Card className="space-y-5">
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              How much off
            </span>
            <div className="flex flex-wrap items-end gap-3">
              <Choices
                size="sm"
                tone="soft"
                label="How much off"
                value={OFF.includes(off) ? String(off) : null}
                options={OFF.map((one) => ({ value: String(one), label: `${one}%` }))}
                onChange={setPercent}
              />
              <div className="w-28"><Input
                label="Or type one"
                type="number"
                min={1}
                max={75}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="w-28"
              /></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              For how long
            </span>
            <div className="flex flex-wrap items-end gap-3">
              <Choices
                size="sm"
                tone="soft"
                label="For how long"
                value={FOR_DAYS.some((one) => one.value === days) ? days : null}
                options={FOR_DAYS}
                onChange={setDays}
              />
              <div className="w-28"><Input
                label="Or days"
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-28"
              /></div>
            </div>
          </div>

          <div className="w-full sm:w-80">
            <Input
              label="Why (shown on the Catalog)"
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Halloween"
            />
          </div>

          {/*
            * What it does to a price, so the number above means something
            * before anybody presses the button. Three real prices from the
            * Catalog's own range rather than one, because 10% off reads as
            * nothing at 50 Brix and as a lot at 1,200.
            */}
          {sane && (
            <div className="rounded-xl border border-ink-line bg-ink-raised px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                What that looks like
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                {[50, 250, 1200].map((was) => (
                  <span key={was} className="flex items-center gap-2">
                    <span className="text-muted line-through">{formatCount(was)}</span>
                    <FontAwesomeIcon icon={faArrowRight} className="text-[10px] text-white/30" />
                    <span className="flex items-center gap-1 font-bold">
                      <CurrencyMark className="h-3.5" />
                      {formatCount(Math.max(1, Math.round(was * (1 - off / 100))))}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="yes"
            size="lg"
            loading={busy}
            disabled={!sane || !days}
            onClick={() => void start()}
          >
            Start it
          </Button>
        </Card>
      )}
    </div>
  )
}


/* ------------------------------------------------------------- the notice */

/*
 * The bar across the top of the site: what is up, and writing another.
 *
 * Kobblon only, and the database says so - not a moderator. A notice is the
 * platform speaking in its own voice to everybody at once, which is a
 * different job from moderating.
 *
 * Rebuilt because the panel was a form that turned into a row and back
 * again, and neither of them looked like the thing being made. Two are
 * allowed up at once now, so the panel is a list of what is live with the
 * colour each one is actually wearing, and under it the form, with the bar
 * drawn exactly as the site will draw it while the words are still being
 * typed. The link is its own field rather than something somebody writes
 * into the words, because then it can be checked: a path here or an https
 * address, and nothing else. The bar renders text and an anchor, never
 * markup.
 */

const NOTICE_COLOURS: { value: NoticeColour; label: string; swatch: string }[] = [
  { value: 'blue', label: 'Blue', swatch: 'bg-brand' },
  { value: 'green', label: 'Green', swatch: 'bg-space' },
  { value: 'red', label: 'Red', swatch: 'bg-danger' },
  { value: 'orange', label: 'Orange', swatch: 'bg-[#F08A24]' },
  { value: 'white', label: 'White', swatch: 'bg-[#F4F4F6]' },
]

const MOST_NOTICES = 2

/** The bar as the site draws it, for something that is not up yet. */
function NoticeLook({ colour, words, label }: {
  colour: NoticeColour
  words: string
  label?: string
}) {
  const look = noticeColours[colour]
  return (
    <div className={cn('relative overflow-hidden rounded-xl', look.panel, look.ink)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: noticeStripes(look.stripe) }}
      />
      <div className="relative flex items-center gap-3 px-4 py-2 text-sm">
        <FontAwesomeIcon icon={faBullhorn} className="shrink-0 text-xs opacity-80" />
        <p className="min-w-0 flex-1 truncate font-semibold">
          {words || 'What it says goes here.'}
          {label && <span className="ml-2 font-bold underline underline-offset-2">{label}</span>}
        </p>
        <FontAwesomeIcon icon={faXmark} className="shrink-0 opacity-70" />
      </div>
    </div>
  )
}

export function NoticeSection() {
  const say = useToast()
  const live = useAsync(async () => noticesNow(), [])
  const [words, setWords] = useState('')
  const [link, setLink] = useState('')
  const [label, setLabel] = useState('')
  const [days, setDays] = useState('7')
  const [colour, setColour] = useState<NoticeColour>('blue')
  const [busy, setBusy] = useState(false)

  const up = live.data ?? []
  const room = MOST_NOTICES - up.length

  const put = async () => {
    setBusy(true)
    try {
      await putUpNotice({
        words: words.trim(),
        link: link.trim() || null,
        linkWords: label.trim() || null,
        tone: colour,
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

  const down = async (which?: string) => {
    setBusy(true)
    try {
      await takeDownNotice(which)
      say('Taken down.', 'success')
      live.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        A line across the top of every page, under the bar. Anybody can close
        it, and it stays closed for them. Two can be up at once.
      </p>

      <section className="space-y-3.5">
        <header className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">
            Up now
          </h3>
          <span className="text-xs text-muted">{up.length} of {MOST_NOTICES}</span>
        </header>

        {live.loading ? <Skeleton className="h-14" /> : up.length === 0 ? (
          <Card className="p-4 text-sm text-muted">Nothing is up.</Card>
        ) : (
          <div className="space-y-2">
            {up.map((one) => (
              <div key={one.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <NoticeLook
                    colour={(NOTICE_COLOURS.find((c) => c.value === one.tone)?.value) ?? 'blue'}
                    words={one.body}
                    label={one.link ? one.link_words || 'Have a look' : undefined}
                  />
                </div>
                <Button variant="danger" size="sm" loading={busy} onClick={() => void down(one.id)}>
                  Take it down
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3.5">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">
          Write one
        </h3>

        {room <= 0 ? (
          <Card className="p-4 text-sm text-muted">
            Two is the most that can be up. Take one down and this comes back.
          </Card>
        ) : (
          <Card className="space-y-5 p-5">
            <NoticeLook
              colour={colour}
              words={words}
              label={link.trim() ? label.trim() || 'Have a look' : undefined}
            />

            <Input
              label="What it says"
              value={words}
              maxLength={300}
              onChange={(e) => setWords(e.target.value)}
              placeholder="Halloween is on. Everything is 30% off."
            />

            <div className="space-y-2">
              <span className="font-display text-xs font-bold uppercase tracking-wide text-muted">
                Colour
              </span>
              <div className="flex flex-wrap gap-2.5">
                {NOTICE_COLOURS.map((one) => (
                  <button
                    key={one.value}
                    type="button"
                    onClick={() => setColour(one.value)}
                    aria-pressed={colour === one.value}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                      colour === one.value
                        ? 'border-white/60 bg-white/10 text-white'
                        : 'border-ink-line text-muted hover:text-white',
                    )}
                  >
                    <span className={cn('h-3.5 w-3.5 rounded-full', one.swatch)} />
                    {one.label}
                  </button>
                ))}
              </div>
            </div>

            {/*
              * A grid rather than a wrapping row. `Input` draws a `w-full`
              * box around itself, so a width class on the field inside it
              * sizes the field and not the box - which is why these three
              * were each a full line of their own with nothing beside
              * them. The columns are the widths.
              */}
            <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem]">
              <Input
                label="Where it goes (optional)"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/catalog"
                hint="A path here, or an https address."
              />
              <Input
                label="The link's words"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Open the Catalog"
              />
              <Input
                label="For how many days"
                type="number"
                min={1}
                max={90}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>

            <Button variant="yes" loading={busy} disabled={!words.trim()} onClick={() => void put()}>
              Put it up
            </Button>
          </Card>
        )}
      </section>
    </div>
  )
}


/* -------------------------------------------------------------- the machine */

/**
 * The machine: whether it is actually running, what it is allowed to do,
 * and what it has been deciding.
 *
 * Rebuilt because the old panel could not answer the only question anybody
 * brings to it. It showed one switch called On, and On meant a boolean in a
 * table - not that anything was scheduled to run the worker, not that the
 * database knows its address, not that `pg_net` exists to knock with. All
 * three of those have been false on this project while the panel said On,
 * and the symptom each time was a queue quietly filling up.
 *
 * So the state is read as a pulse: on, beating, wired, net ready, when it
 * last knocked, when it last decided anything. Whatever is false is said in
 * a sentence with the fix in it, and the switches below are grouped by what
 * they actually change rather than by which table column they are.
 *
 * Every limit here is enforced in the database. The panel sets a row;
 * `apply_ai_verdict` is what refuses to suspend when suspending is off,
 * refuses to touch staff, and has no word at all for closing an account.
 */
export function MachineSection() {
  const say = useToast()
  const settings = useAsync(async () => aiSettings(), [])
  const pulse = useAsync(async () => machinePulse(), [])
  const recent = useAsync(async () => aiRecent(30), [])
  const waiting = useAsync(async () => aiWork(50), [])
  const [busy, setBusy] = useState<string | null>(null)
  /** The self-check's answers, once somebody has asked for them. */
  const [checked, setChecked] = useState<MachineStep[] | null>(null)

  /* A console left open on a second monitor is the normal way this is
     watched, so it keeps its own time rather than showing the state it
     had when somebody opened it. */
  useEffect(() => {
    const again = window.setInterval(() => { pulse.reload(); waiting.reload() }, 15_000)
    return () => window.clearInterval(again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * What the key can see. Asked once, on purpose: it is a call to Groq and
   * the answer does not change while somebody is looking at this page. A
   * failure is not shouted about - the two Selects fall back to whatever
   * is already set, which is still true and still saveable.
   */
  const [models, setModels] = useState<string[]>([])
  const [modelTrouble, setModelTrouble] = useState<string | null>(null)
  useEffect(() => {
    let wanted = true
    groqModels()
      .then((found) => { if (wanted) setModels(found) })
      .catch((error: unknown) => {
        if (wanted) setModelTrouble(error instanceof Error ? error.message : 'Groq did not answer.')
      })
    return () => { wanted = false }
  }, [])

  const change = async (what: string, input: Parameters<typeof setAiSettings>[0]) => {
    setBusy(what)
    try {
      await setAiSettings(input)
      settings.reload()
      pulse.reload()
      waiting.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const runIt = async () => {
    setBusy('run')
    try {
      const done = await runModeration()
      /*
       * A run where the machine never answered is not a success, and it
       * used to read like one: "looked at 12, decided 0" is what a retired
       * model name looks like from here, and it is also what twelve
       * genuinely unclear things look like.
       */
      if (done.trouble?.length) {
        /* A spent rate limit is not a failure: the work was not lost, it
           was not reached. Red for it teaches somebody to ignore red. */
        const paused = done.trouble.every((one) => one.includes('is spent for this minute'))
        say(
          `Looked at ${done.looked}, decided ${done.decided}. ${done.trouble.join(' ')}`,
          paused ? 'info' : 'error',
        )
      } else {
        say(
          done.looked === 0
            ? 'Nothing was waiting.'
            : `Looked at ${done.looked}, decided ${done.decided}, unsure about ${done.unsure}.`,
          'success',
        )
      }
      recent.reload()
      waiting.reload()
      pulse.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const check = async () => {
    setBusy('check')
    setChecked(null)
    try {
      setChecked(await checkTheMachine())
    } finally {
      setBusy(null)
    }
  }

  const on = settings.data?.is_on ?? false
  const beat = pulse.data

  /*
   * Switched on means working.
   *
   * Staw: "i want kobby to be when on 'running' IT REALLY RUNS, no need to
   * press 'Run now'". Three things are meant to set it going and two of
   * them are out of this page's hands: pg_net knocks on the worker the
   * moment something lands, and a schedule sweeps for whatever the knock
   * missed. The schedule is a pg_cron job that is not installed on this
   * project, so until it is, "Running" and "running" were two different
   * words on the same switch.
   *
   * So while somebody is standing in front of this panel and it is on with
   * work waiting, the panel runs it. Not a replacement for the sweep - a
   * console nobody has open does nothing, and the fault list below still
   * says so in as many words - but it does mean the button is no longer
   * the only thing in the building that actually starts it.
   *
   * `sweeping` rather than `busy`: an automatic run must not take the
   * buttons away under somebody's hand, and it must not start a second one
   * on top of its own.
   */
  const sweeping = useRef(false)
  useEffect(() => {
    if (!on) return
    let live = true

    const sweep = async () => {
      if (!live || sweeping.current) return
      /* Nothing waiting is not a run worth making: it is a call to Groq
         and a row in the log to say nothing happened. */
      if ((pulse.data?.waiting ?? 0) < 1) return
      sweeping.current = true
      try {
        await runModeration()
        if (!live) return
        recent.reload()
        waiting.reload()
        pulse.reload()
      } catch {
        /* Quietly: an automatic run that fails puts a red toast on a page
           somebody is reading something else on. The fault list and the
           self-check are where a failure is read. */
      } finally {
        sweeping.current = false
      }
    }

    void sweep()
    const again = window.setInterval(() => { void sweep() }, 60_000)
    return () => { live = false; window.clearInterval(again) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, pulse.data?.waiting])
  /** Whatever is standing between "switched on" and "actually working". */
  const faults = !on ? [] : [
    !beat?.beating && {
      what: 'Nothing is scheduled to run it',
      fix: 'The every-minute sweep lives in the database as the pg_cron job "kobblon-machine". Install pg_cron on the project and apply migration 0253 again. Until then it moves when something lands, every five minutes from the schedule on the repository, and every minute while this panel is open - but a console nobody has open sweeps nothing.',
    },
    !beat?.wired && {
      what: 'The database does not know where the worker is',
      fix: 'Its address and service key are set with one statement in the SQL editor, never from here - a key typed into a web page is a key that has been in a browser.',
    },
    beat && !beat.net_ready && {
      what: 'There is nothing to knock with',
      fix: 'pg_net is not installed, so the database cannot call the function at all.',
    },
  ].filter(Boolean) as { what: string; fix: string }[]

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------- is it running */}
      {settings.loading && !settings.data ? <Skeleton className="h-40" /> : !settings.data ? (
        /* Only staff may read the settings row, so an empty answer here is
           either "not staff" or "could not reach it" - and a card full of
           controls that do nothing is worse than a sentence saying so. */
        <Card>
          <p className="text-sm text-muted">
            The machine's settings could not be read. Either this account is
            not staff, or the database did not answer.
          </p>
        </Card>
      ) : (
        <>
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className={cn(
                'grid size-12 shrink-0 place-items-center rounded-2xl text-xl transition-colors duration-200',
                on ? 'bg-brand text-white' : 'bg-ink-raised text-white/30',
              )}>
                <FontAwesomeIcon icon={faRobot} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-display text-lg leading-tight">
                  Kobby <Heartbeat pulse={beat ?? null} />
                </p>
                <p className="text-xs text-muted">
                  {!on ? 'Nothing is being screened by the machine; every queue waits for a person.'
                    : beat?.beating
                      ? `Swept every minute${beat.last_poke_at ? `, last knocked ${timeAgo(beat.last_poke_at)}` : ''}.`
                      : 'Woken by new work only, because nothing is scheduled to sweep.'}
                </p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Switch
                  className="w-44"
                  on={on}
                  busy={busy === 'on'}
                  onChange={(next) => void change('on', { turn_on: next })}
                  label={on ? 'Running' : 'Stopped'}
                />
                <Button
                  size="sm"
                  variant="subtle"
                  icon={faBolt}
                  loading={busy === 'run'}
                  disabled={!on}
                  onClick={() => void runIt()}
                >
                  Run it now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={faStethoscope}
                  loading={busy === 'check'}
                  onClick={() => void check()}
                >
                  Check it
                </Button>
              </div>
            </div>

            {/* The four numbers that say whether it is keeping up. */}
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { value: beat?.waiting ?? 0, label: 'waiting for it' },
                { value: beat?.decided_today ?? 0, label: 'decided in a day' },
                {
                  value: beat?.last_decision_at ? timeAgo(beat.last_decision_at) : 'never',
                  label: 'last decision',
                },
                {
                  value: beat?.oldest_minutes == null ? 'nothing'
                    : beat.oldest_minutes > 90 ? `${Math.round(beat.oldest_minutes / 60)}h`
                    : `${beat.oldest_minutes}m`,
                  label: 'oldest wait',
                },
              ].map((one, i) => (
                <div
                  key={one.label}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-row-in rounded-xl bg-ink-raised px-3 py-2"
                >
                  <p className="font-display text-lg leading-none">{one.value}</p>
                  <p className="text-xs text-muted">{one.label}</p>
                </div>
              ))}
            </div>

            {/* Whatever is between "on" and "working", said plainly. */}
            {faults.map((fault) => (
              <div
                key={fault.what}
                className="flex animate-row-in items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3"
              >
                <FontAwesomeIcon icon={faHeartPulse} className="mt-0.5 shrink-0 text-amber-300" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-amber-300">{fault.what}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{fault.fix}</span>
                </span>
              </div>
            ))}
          </Card>

          {/* ---------------------------------- what it runs on its own */}
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <img src={kobbyArt.default} alt="" className="h-7 w-auto" />
              <p className="font-display text-sm">What it handles with nobody here</p>
              <span className="text-xs text-muted">
                Staw: Kobby is the auto-admin. None of this waits for staff to be online.
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { art: 'checkmark' as KobIcon, what: 'Screening', how: 'Avatar items and uploads: approved, rejected, or left for a person.' },
                { art: 'report' as KobIcon, what: 'Reports', how: 'Read against the house rules, settled or passed up.' },
                { art: 'chatbubble' as KobIcon, what: 'Support', how: 'Answered, unless somebody asked for a person.' },
                { art: 'voice-user' as KobIcon, what: 'Appeals', how: 'Only the ones no moderator decided; a person\u2019s decision is a person\u2019s to undo.' },
                { art: 'mute-microphone' as KobIcon, what: 'Chat', how: 'Lines nobody has read yet, against the words list and the rules.' },
                { art: 'circle-user' as KobIcon, what: 'Names', how: 'Handles, display names and bios. A name that breaks a rule is taken away and they are asked for another.' },
                { art: 'people' as KobIcon, what: 'Sanctions', how: on && settings.data?.may_suspend
                  ? 'Warnings and suspensions, inside the limits above.'
                  : on && settings.data?.may_warn
                    ? 'Warnings only - suspending is switched off above.'
                    : 'Nothing: it may neither warn nor suspend right now.' },
              ].map((one, i) => (
                <div
                  key={one.what}
                  style={{ animationDelay: `${i * 35}ms` }}
                  className="flex animate-row-in items-start gap-2.5 rounded-xl bg-ink-raised px-3 py-2"
                >
                  <Icon name={one.art} className="mt-0.5 w-4 shrink-0 text-brand-bright" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{one.what}</span>
                    <span className="block text-xs leading-relaxed text-muted">{one.how}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              Two things it will never do, and neither is a setting: close an account,
              and act against staff. Anything it is unsure about is left for a person
              rather than guessed at - which is the one case where an empty console
              means somebody has to be here.
            </p>
          </Card>

          {/* ------------------------------------------- when it looks */}
          <Card className="space-y-3 p-4">
            <p className="font-display text-[10px] uppercase tracking-wider text-muted">
              When it looks at things
            </p>
            <Choices
              size="sm"
              tone="soft"
              label="When it works"
              value={settings.data?.mode ?? 'always'}
              onChange={(picked) => void change('mode', { how: picked })}
              options={[
                { value: 'always', label: 'Whenever anything is waiting' },
                { value: 'slow', label: 'Only what has waited too long' },
                { value: 'busy', label: 'Only when the queue is long' },
              ]}
            />
            <p className="text-xs leading-relaxed text-muted">
              {settings.data?.mode === 'always' && (
                <>The database wakes it as each thing lands, and the sweep comes back every
                minute for anything a knock missed.</>
              )}
              {settings.data?.mode === 'slow' && (
                <>Anything waiting more than{' '}
                <span className="font-bold text-white">{settings.data.after_minutes} minutes</span>.
                It is never woken early; the sweep is the only thing that comes back for it,
                which is the whole point of this one.</>
              )}
              {settings.data?.mode === 'busy' && (
                <>Only once more than{' '}
                <span className="font-bold text-white">{settings.data.when_over}</span> things are
                waiting, and it is woken as soon as the queue gets there.</>
              )}
            </p>
          </Card>

          {/* ------------------------------------ what it may do to people */}
          <Card className="space-y-3 p-4">
            <p className="font-display text-[10px] uppercase tracking-wider text-muted">
              What it may do to people
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Switch
                on={!!settings.data?.may_warn}
                busy={busy === 'warn'}
                onChange={(next) => void change('warn', { warn: next })}
                label="Warn somebody"
              />
              <Switch
                on={!!settings.data?.may_suspend}
                busy={busy === 'suspend'}
                onChange={(next) => void change('suspend', { suspend: next })}
                label="Suspend a chat or an account"
              />
              <Switch
                on={false}
                disabled
                onChange={() => {}}
                label="Close an account"
                note="There is no door for this, here or in the database."
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              Kobby answers approved, rejected or unsure, and unsure leaves the thing for a
              person. It never touches staff, and a sanction against somebody nobody reported
              is refused to it by name.
            </p>
          </Card>

          {/* ------------------------------------------------ the models */}
          <Card className="space-y-3 p-4">
            <p className="font-display text-[10px] uppercase tracking-wider text-muted">
              Which models it uses
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {/* Whatever is set is always an option, even when Groq no
                  longer lists it. Otherwise the Select shows something else
                  as the current value and the first save changes a setting
                  nobody meant to change. */}
              <Select
                label="Reading"
                value={settings.data?.model ?? ''}
                disabled={busy === 'model'}
                onChange={(picked) => void change('model', { which_model: picked })}
                options={[...new Set([settings.data?.model, ...models].filter(Boolean))]
                  .map((one) => ({ value: one as string, label: one as string }))}
              />
              <Select
                label="Looking at pictures"
                value={settings.data?.vision_model ?? ''}
                disabled={busy === 'vision'}
                onChange={(picked) => void change('vision', { which_vision_model: picked })}
                options={[
                  { value: '', label: 'Nobody - a person looks at pictures' },
                  ...[...new Set([settings.data?.vision_model, ...models].filter(Boolean))]
                    .map((one) => ({ value: one as string, label: one as string })),
                ]}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              {modelTrouble
                ? `Groq's list could not be fetched, so only what is already set is offered. ${modelTrouble}`
                : models.length
                  ? `${models.length} models this key can use. Groq retires names on its own schedule, so this is asked rather than remembered.`
                  : 'Asking Groq what this key can use…'}
              {' '}The key lives in Supabase as <code>GROQ_API_KEY</code> and
              never reaches a browser.
            </p>
          </Card>
        </>
      )}

      {!!checked?.length && (
        <Card className="space-y-2 p-4">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">
            Why it has or has not run
          </p>
          {checked.map((one, i) => (
            <div
              key={one.step}
              style={{ animationDelay: `${i * 40}ms` }}
              className="flex animate-row-in items-start gap-3 text-sm"
            >
              <FontAwesomeIcon
                icon={one.ok ? faCircleCheck : faXmark}
                className={cn('mt-1 text-xs', one.ok ? 'text-space-bright' : 'text-danger')}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{one.step}</span>
                <span className="block text-xs leading-relaxed text-muted">{one.said}</span>
              </span>
            </div>
          ))}
          <p className="text-[11px] text-muted">
            The first cross is the one to fix; everything under it is waiting on that.
          </p>
        </Card>
      )}

      {/* ------------------------------------------------- what is queued */}
      {!!waiting.data?.length && (
        <Card className="space-y-2 p-4">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">
            In front of it right now
          </p>
          {waiting.data.slice(0, 12).map((one, i) => (
            <div
              key={`${one.subject}-${one.name}-${i}`}
              style={{ animationDelay: `${i * 30}ms` }}
              className="flex animate-row-in items-baseline gap-3 text-sm"
            >
              <Badge tone="neutral">{QUEUE_WORDS[one.subject] ?? one.subject}</Badge>
              <span className="min-w-0 flex-1 truncate text-white/75">{one.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {one.waiting_minutes > 90
                  ? `${Math.round(one.waiting_minutes / 60)}h`
                  : `${one.waiting_minutes}m`} waiting
              </span>
            </div>
          ))}
          {waiting.data.length > 12 && (
            <p className="text-[11px] text-muted">
              And {formatCount(waiting.data.length - 12)} more.
            </p>
          )}
        </Card>
      )}

      {/* --------------------------------------------- what it has decided */}
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">
          What it has been deciding
        </p>
        {recent.loading ? <Skeleton className="h-24" /> : !recent.data?.length ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : recent.data.map((one, i) => (
          <Card
            key={one.id}
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            className="flex animate-row-in flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm"
          >
            <Badge tone={
              one.decision === 'rejected' || one.decision === 'suspended' ? 'danger'
                : one.decision === 'unsure' ? 'warm'
                  : one.decision === 'staff' ? 'neutral' : 'space'
            }>
              {one.decision}
            </Badge>
            <span className="text-xs text-muted">{one.subject}</span>
            <span className="min-w-0 flex-1 truncate text-white/75">{one.reason}</span>
            <span className="shrink-0 text-xs text-muted">{timeAgo(one.created_at)}</span>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- page */

/**
 * The rail down the side of the console.
 *
 * Each panel says what it is for and which rank it wants, so somebody
 * opening this for the first time does not have to press all twelve to find
 * out, and a moderator is not shown the four they cannot use.
 *
 * `counts` is the addition that makes it a working rail rather than a menu:
 * a queue with eleven things in it says so from here, so nobody has to open
 * four panels to find the one that needs them. A queue at zero shows no
 * badge at all - a row of grey noughts is a rail that teaches you to stop
 * reading it.
 */
export function ConsoleRail({ rank, value, onChange, counts }: {
  rank: StaffRank
  value: Section
  onChange: (next: Section) => void
  counts?: Partial<Record<Section, number>>
}) {
  /*
   * A column beside the work on a monitor, a scrolling row above it on a
   * phone.
   *
   * Stacked, fourteen panels is six hundred pixels of navigation before the
   * first thing waiting to be done - so the console opened on a list of
   * places to go rather than on the work, which is most of what "the
   * dashboard fails on mobile" was. A row scrolls sideways inside its own
   * box and costs one line.
   */
  return (
    <nav
      className={cn(
        'flex gap-1.5 overflow-x-auto pb-1 kob-scroll',
        'lg:block lg:space-y-1 lg:overflow-visible lg:pb-0',
      )}
      aria-label="What to work on"
    >
      {sections.filter((one) => allowed(rank, one.needs)).map((one, i) => {
        const on = one.name === value
        const many = counts?.[one.name] ?? 0
        return (
          <button
            key={one.name}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onChange(one.name)}
            style={{ animationDelay: `${i * 25}ms` }}
            className={cn(
              'group relative flex shrink-0 animate-row-in items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left',
              'lg:w-full lg:gap-3',
              'transition-[background-color,border-color,transform] duration-150',
              on
                ? 'border-brand-bright/60 bg-brand/15'
                : 'border-ink-line lg:border-transparent lg:hover:translate-x-0.5 lg:hover:bg-ink-hover',
            )}
          >
            {/* The bar that says where you are. It is on the border rather
                than inside the padding so the rows keep one left edge. */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-0 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-bright lg:block',
                'transition-opacity duration-150',
                on ? 'opacity-100' : 'opacity-0',
              )}
            />
            {one.art ? (
              <Icon
                name={one.art}
                className={cn('w-4 shrink-0', on ? 'text-brand-bright' : 'text-white/35 group-hover:text-white/70')}
              />
            ) : (
              <FontAwesomeIcon
                icon={one.icon}
                className={cn('w-4 shrink-0 text-sm', on ? 'text-brand-bright' : 'text-white/35 group-hover:text-white/70')}
              />
            )}
            <span className="min-w-0 lg:flex-1">
              <span className="flex items-center gap-2">
                <span className={cn('whitespace-nowrap text-sm font-bold lg:truncate', !on && 'text-white/85')}>{one.name}</span>
                {one.needs !== 'moderator' && (
                  <span className="hidden rounded border border-ink-line px-1 text-[9px] font-extrabold uppercase tracking-wide text-muted lg:inline">
                    {one.needs === 'superadmin' ? 'Super' : 'Admin'}
                  </span>
                )}
              </span>
            </span>
            {many > 0 && (
              <span className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums',
                many > 10 ? 'bg-danger text-white' : 'bg-brand text-white',
              )}>
                {many > 99 ? '99+' : many}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

/**
 * The console as a page.
 *
 * It was a card over the site: Staw asked for a popup originally, and
 * working in it proved the opposite - "i want it to be a page directly
 * rather than a card". A card is right for one decision and wrong for a
 * shift. It capped the working area at 92vh on a monitor with room for
 * twice that, it could not be linked to, a reload lost which panel you were
 * in, and twelve panels inside a dialog meant two scrollbars fighting over
 * the same wheel.
 *
 * So: its own page, its own chrome, the site's header left behind - nothing
 * on this page wants a Catalog link across the top - and the rail sticky
 * beside a column that scrolls with the window like a page should.
 */
function ConsolePage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ink">{children}</div>
}

export default function Admin() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const { panel } = useParams()
  useTitle('Staff', 'Kobblon')

  /*
   * The rank from the database rather than `profile.is_admin`, which is what
   * this page used to gate on - and which sent every moderator away from the
   * one panel that is their job.
   *
   * The `??` is the part worth reading twice. A failed call is not a rank,
   * and the first version of this treated it as one: `asked.data ?? 'none'`
   * turned a database that had never been given `my_staff_rank` into a
   * superadmin standing outside their own console. A refusal and a failure
   * are told apart now. An answer is believed, whatever it says. A failure
   * falls back to the flags the profile already carries, which decides which
   * panels are drawn and nothing else, because every function behind every
   * button checks again and that is the check that counts.
   */
  const asked = useAsync(async () => myStaffRank(), [profile?.id])

  const fromProfile: StaffRank = profile?.is_admin
    ? 'admin' : profile?.is_moderator ? 'moderator' : 'none'

  const rank: StaffRank = asked.data ?? (asked.error ? fromProfile : 'none')

  /*
   * Which panel, from the address.
   *
   * `/staff/people` rather than a number in a component's head: a link to a
   * queue is a thing staff send each other, and a reload that drops you back
   * on the first panel is the console forgetting what you were doing.
   */
  const fromUrl = sections.find(
    (one) => one.name.toLowerCase() === (panel ?? '').toLowerCase(),
  )?.name
  const [section, setSection] = useState<Section>(fromUrl ?? 'Overview')
  useEffect(() => { if (fromUrl && fromUrl !== section) setSection(fromUrl) }, [fromUrl])

  const go = useCallback((next: Section) => {
    setSection(next)
    navigate(`/staff/${next.toLowerCase()}`, { replace: true })
  }, [navigate])

  /* What is waiting, for the badges on the rail. Same call the Overview
     makes, asked here so every panel's rail carries the numbers. */
  const counts = useAsync(async () => staffOverview().catch(() => null), [profile?.id])
  useEffect(() => {
    const again = window.setInterval(() => counts.reload(), 30_000)
    return () => window.clearInterval(again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* What the command bar asked People to look for, if anything. */
  const [lookFor, setLookFor] = useState<string | undefined>()

  if (loading || asked.loading) {
    return (
      <ConsolePage>
        <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-8 sm:px-6">
          <Skeleton className="h-16" />
          <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </ConsolePage>
    )
  }

  /*
   * Sent away rather than shown an empty page. This is not what keeps
   * anybody out - the functions do that - it is so a page that would refuse
   * every button is not drawn at all.
   */
  if (rank === 'none') return <Navigate to="/" replace />

  const mine = sections.filter((one) => allowed(rank, one.needs))
  const here = mine.find((one) => one.name === section) ?? mine[0]
  const open = here.name

  const badges: Partial<Record<Section, number>> = {
    Reports: counts.data?.reports_open ?? 0,
    Appeals: counts.data?.appeals_open ?? 0,
    Support: counts.data?.tickets_open ?? 0,
    Screening: counts.data?.screening ?? 0,
  }

  return (
    <ConsolePage>
      {/* --------------------------------------------------- who you are */}
      <header className="sticky top-0 z-30 border-b border-ink-line bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-white">
            <FontAwesomeIcon icon={faUserShield} />
          </span>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-lg leading-tight">
              Staff console
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
                  rankLook[rank],
                )}
              >
                {rankWord[rank]}
              </span>
            </h1>
            <p className="text-xs text-muted">
              {mine.length} of {sections.length} panels are yours.{' '}
              {/* Nothing on a phone has a Ctrl key, so nothing on a phone
                  should be told about one. */}
              <span className="hidden whitespace-nowrap lg:inline">
                <kbd className="rounded border border-ink-line bg-ink-raised px-1 py-0.5 text-[10px] font-bold">
                  Ctrl K
                </kbd>{' '}
                jumps anywhere.
              </span>
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button to="/" size="sm" variant="ghost" icon={faArrowRight}>
              Back to Kobblon
            </Button>
          </div>

          {!!asked.error && (
            <p className="w-full text-xs font-semibold text-amber-300">
              The database would not say what rank you hold, so this is read off your profile
              instead. Anything only a superadmin may do will refuse until that is fixed.
            </p>
          )}
        </div>
      </header>

      {/* Outside the grid: it is a portal when open and nothing when
          closed, and a grid is not the place for either. */}
      <CommandBar
        panels={mine}
        onGo={(name) => go(name as Section)}
        onFindPerson={(term) => { setLookFor(term); go('People') }}
      />

      {/* `grid-cols-[minmax(0,1fr)]` for the one-column case, not a bare
          grid: a single track is `auto`, so it sizes to its widest child,
          and the rail on a phone is a scrolling row that is wider than the
          screen on purpose. Without this the console scrolled sideways by
          twelve hundred pixels and every panel was clipped. */}
      <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/*
          * The rail sticks and the work scrolls. On a phone it is a plain
          * block above the panel rather than a sticky strip eating a third
          * of the screen.
          */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ConsoleRail rank={rank} value={open} onChange={go} counts={badges} />
          {rank !== 'superadmin' && (
            <p className="mt-3 px-3 text-[11px] leading-relaxed text-muted">
              Closing an account, and clearing a behaviour record, are a superadmin's.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-line pb-4">
            {here.art
              ? <Icon name={here.art} className="w-5 shrink-0 text-brand-bright" />
              : <FontAwesomeIcon icon={here.icon} className="text-brand-bright" />}
            <h2 className="font-display text-lg font-extrabold">{here.name}</h2>
            {/* It wraps on a phone. `truncate` on a line that only shares
                its row from `sm` up cut the console's one sentence of
                explanation mid-word - "whether the machine is keepin..." -
                on every panel. */}
            <p className="min-w-0 basis-full text-sm text-muted sm:basis-auto sm:truncate">
              {here.blurb}
            </p>
          </div>

          <RankContext.Provider value={rank}>
            {open === 'Overview' && <OverviewSection onGo={go} />}
            {open === 'People' && <PeopleSection initial={lookFor} />}
            {open === 'Communities' && <CommunitiesSection />}
            {open === 'Reports' && <ReportsSection />}
            {open === 'Appeals' && <AppealsQueue />}
            {open === 'Support' && <SupportQueue />}
            {open === 'Screening' && <ScreeningSection />}
            {open === 'Machine' && <MachineSection />}
            {open === 'Map' && <MapSection />}
            {open === 'Economy' && <EconomySection />}
            {open === 'Notice' && <NoticeSection />}
            {open === 'Announce' && <AnnounceSection />}
            {open === 'Words' && <WordsSection />}
            {open === 'Record' && <RecordSection />}
          </RankContext.Provider>
        </div>
      </div>
    </ConsolePage>
  )
}
