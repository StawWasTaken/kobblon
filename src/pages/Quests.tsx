import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  faCalendarDay, faCircleCheck, faClock, faHandshake, faPlus, faTag, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Page } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Note } from '@/components/ui/Note'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { Balance } from '@/components/money/Balance'
import { CurrencyMark } from '@/components/brand/Currency'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  claimDaily, claimQuest, dailyWaiting, myQuestRequests, myWorlds,
  questBoard, requestWorldQuest, startQuest,
} from '@/lib/api'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import type { Quest } from '@/types/db'

/*
 * Quests: the reason to come back.
 *
 * Brix has only ever come from buying, selling and the grant you get for
 * signing up. This is where it is earned, and it holds three sorts of
 * thing: the daily, which has to be claimed here rather than handed out for
 * turning up; quests a creator asked for about their own World; and the
 * ones Staw writes himself.
 *
 * Every number on this page is read from the database rather than worked
 * out here. `done` against `goal` is the bar, the claim is refused unless
 * the database agrees it is finished, and the time in a World behind a
 * `world_time` quest is added up by the heartbeat the Launcher already
 * sends - this page has no way of telling anybody it played for fifteen
 * minutes, which is the point.
 */

const DAILY = 30

/** The goal and what has been done, in words that suit what is counted. */
function howFar(quest: Quest) {
  if (quest.counted === 'world_time') {
    const left = Math.max(0, quest.goal - quest.done)
    const mins = (seconds: number) => {
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`
    }
    return {
      goal: mins(quest.goal),
      done: mins(quest.done),
      left: left === 0 ? 'Finished' : `${mins(left)} to go`,
    }
  }
  const unit = quest.counted === 'friends_made' ? 'friends'
    : quest.counted === 'worlds_played' ? 'Worlds'
    : 'done'
  return {
    goal: `${quest.goal} ${unit}`,
    done: `${quest.done}`,
    left: quest.done >= quest.goal ? 'Finished' : `${quest.goal - quest.done} to go`,
  }
}

function Bar({ done, goal }: { done: number; goal: number }) {
  const part = Math.max(0, Math.min(1, goal > 0 ? done / goal : 0))
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-ink-hover"
      role="progressbar"
      aria-valuenow={Math.round(part * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className={cn(
          'block h-full rounded-full transition-[width] duration-500',
          part >= 1 ? 'bg-ok' : 'bg-brand-bright',
        )}
        style={{ width: `${part * 100}%` }}
      />
    </div>
  )
}

/** One quest. The button is whatever this person's next move actually is. */
function QuestCard({ quest, onChange }: { quest: Quest; onChange: () => void }) {
  const say = useToast()
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)

  const bits = howFar(quest)
  const finished = quest.done >= quest.goal
  const claimed = !!quest.claimed_at

  const press = async () => {
    setBusy(true)
    try {
      if (!quest.started) {
        await startQuest(quest.id)
        say('Started. It counts from now.', 'success')
      } else {
        const left = await claimQuest(quest.id)
        await refreshProfile()
        say(`${currency.amount(quest.reward)} yours. ${currency.amount(left)} in all.`, 'success')
      }
      onChange()
    } catch (err) {
      say(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={cn('overflow-hidden', claimed && 'opacity-70')}>
      {quest.background_url && (
        <div
          className="h-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${quest.background_url})` }}
          aria-hidden
        />
      )}

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          {quest.world_emblem ? (
            <img
              src={quest.world_emblem}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-hover">
              <Icon name="laurel-quest" className="w-5 text-brand-bright" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold">{quest.title}</p>
            {quest.lead && <p className="mt-0.5 text-xs leading-relaxed text-muted">{quest.lead}</p>}
            {quest.author_name && !quest.world_id && (
              <p className="mt-0.5 text-xs text-muted">From {quest.author_name}</p>
            )}
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 font-display text-sm font-extrabold tabular-nums text-ok">
            <CurrencyMark className="h-[0.85em] w-[0.85em]" />
            {formatCount(quest.reward)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {quest.world_tag && quest.world_content_id ? (
            <Link
              to={worldLink({
                content_id: quest.world_content_id,
                slug: quest.world_slug,
                name: quest.world_name ?? quest.world_tag,
              })}
            >
              <Badge tone="brand" icon={faTag}>{quest.world_tag}</Badge>
            </Link>
          ) : quest.world_tag ? (
            <Badge tone="brand" icon={faTag}>{quest.world_tag}</Badge>
          ) : null}
          {quest.custom_tag && <Badge tone="space" icon={faTag}>{quest.custom_tag}</Badge>}
        </div>

        <div className="space-y-1.5">
          <Bar done={quest.done} goal={quest.goal} />
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="tabular-nums">{bits.done} of {bits.goal}</span>
            <span className={cn(finished && 'font-bold text-ok')}>
              {claimed ? 'Claimed' : quest.started ? bits.left : 'Not started'}
            </span>
          </div>
        </div>

        {claimed ? (
          <p className="flex items-center gap-2 text-xs font-bold text-ok">
            <Glyph icon={faCircleCheck} className="w-3.5" />
            Done and paid.
          </p>
        ) : (
          <GuestGate action="do quests">
            <Button
              className="w-full"
              variant={finished && quest.started ? 'primary' : 'subtle'}
              loading={busy}
              disabled={!!quest.started && !finished}
              onClick={() => void press()}
            >
              {!quest.started
                ? 'Start it'
                : finished
                  ? `Claim ${formatCount(quest.reward)}`
                  : 'In progress'}
            </Button>
          </GuestGate>
        )}
      </div>
    </Card>
  )
}

/** The daily, which is a claim rather than a gift. */
function Daily({ onChange }: { onChange: () => void }) {
  const say = useToast()
  const { refreshProfile } = useAuth()
  const waiting = useAsync(() => dailyWaiting(), [])
  const [busy, setBusy] = useState(false)

  const press = async () => {
    setBusy(true)
    try {
      const left = await claimDaily()
      await refreshProfile()
      say(`${currency.amount(DAILY)} yours. ${currency.amount(left)} in all.`, 'success')
      waiting.reload()
      onChange()
    } catch (err) {
      say(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const there = waiting.data === true

  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/15">
        <Glyph icon={faCalendarDay} className="w-5 text-brand-bright" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold">Today&rsquo;s {currency.plural}</p>
        <p className="text-xs leading-relaxed text-muted">
          {there
            ? `${DAILY} for coming to look. It resets at midnight, and it does not stack.`
            : 'Claimed. Another one tomorrow.'}
        </p>
      </div>
      <GuestGate action="claim the daily">
        <Button
          variant={there ? 'primary' : 'subtle'}
          loading={busy || waiting.loading}
          disabled={!there}
          onClick={() => void press()}
        >
          {there ? `Claim ${DAILY}` : 'Claimed'}
        </Button>
      </GuestGate>
    </Card>
  )
}

/* -------------------------------------------- a creator asking for one */

const TAG_FEE = 100

function AskForOne({ open, onClose, onDone }: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const say = useToast()
  const { profile, refreshProfile } = useAuth()
  const mine = useAsync(() => (open ? myWorlds('active') : Promise.resolve([])), [open])

  const [world, setWorld] = useState('')
  const [minutes, setMinutes] = useState('15')
  const [reward, setReward] = useState('50')
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)

  const published = (mine.data ?? []).filter((one) => one.is_published)
  const wants = tag.trim().length > 0
  const canAfford = (profile?.pixels ?? 0) >= TAG_FEE

  const send = async () => {
    setBusy(true)
    try {
      await requestWorldQuest({
        world: world || published[0]?.id || '',
        minutes: Number(minutes),
        reward: Number(reward),
        tag: wants ? tag : null,
      })
      if (wants) await refreshProfile()
      say('Sent. An admin decides, and you will see it here either way.', 'success')
      onDone()
      onClose()
    } catch (err) {
      say(err instanceof Error ? err.message : 'That did not send.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ask for a quest"
      description="One of your published Worlds, on the quest tab, for whoever plays it long enough."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button
            loading={busy}
            disabled={published.length === 0 || (wants && !canAfford)}
            onClick={() => void send()}
          >
            {wants ? `Send, and pay ${TAG_FEE}` : 'Send it'}
          </Button>
        </>
      }
    >
      {mine.loading ? (
        <Skeleton className="h-24" />
      ) : published.length === 0 ? (
        <Note tone="brand">
          A quest points at a published World, and you have none published yet.
        </Note>
      ) : (
        <div className="space-y-4">
          <Select
            label="Which World"
            value={world || published[0].id}
            onChange={setWorld}
            options={published.map((one) => ({ value: one.id, label: one.name }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Minutes of play"
              type="number"
              min={1}
              max={240}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <Input
              label={`${currency.plural} won`}
              type="number"
              min={1}
              max={500}
              value={reward}
              onChange={(e) => setReward(e.target.value)}
            />
          </div>

          <Input
            label="A tag of your own, if you want one"
            placeholder="parkour"
            maxLength={24}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            hint={
              wants
                ? `${TAG_FEE} ${currency.plural}, paid when you send it, whether or not it is approved. Your World's own tag is free and is added for you.`
                : `Your World's name is added as a tag for free. A tag of your own costs ${TAG_FEE} ${currency.plural} and needs approving.`
            }
          />

          {wants && !canAfford && (
            <Note tone="brand">
              A tag of your own costs {TAG_FEE} and you have {formatCount(profile?.pixels ?? 0)}.
            </Note>
          )}
        </div>
      )}
    </Dialog>
  )
}

/** What a creator has asked for, and what became of it. */
function MyRequests({ reloadKey }: { reloadKey: number }) {
  const rows = useAsync(() => myQuestRequests(), [reloadKey])
  if (!rows.data || rows.data.length === 0) return null

  const words = {
    pending: 'Waiting on an admin',
    live: 'On the tab',
    refused: 'Refused',
    ended: 'Over',
  } as const

  return (
    <Card className="space-y-2 p-4">
      <p className="font-display text-[10px] uppercase tracking-wider text-muted">
        What you have asked for
      </p>
      {rows.data.map((one) => (
        <div
          key={one.id}
          className="flex flex-wrap items-center gap-3 border-b border-ink-line/70 py-2.5 last:border-0"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{one.title}</span>
            {one.refusal && <span className="block text-xs text-danger">{one.refusal}</span>}
            {one.custom_tag && (
              <span className="block text-xs text-muted">
                Your tag &ldquo;{one.custom_tag}&rdquo;
                {one.custom_tag_approved ? ' was approved' : one.status === 'live'
                  ? ' was not approved; the quest was'
                  : ' is waiting too'}
              </span>
            )}
          </span>
          <Badge tone={one.status === 'live' ? 'brand' : one.status === 'refused' ? 'danger' : 'neutral'}>
            {words[one.status]}
          </Badge>
        </div>
      ))}
    </Card>
  )
}

export default function Quests() {
  useTitle('Quests')
  const { profile } = useAuth()
  const [asking, setAsking] = useState(false)
  const [round, setRound] = useState(0)

  const board = useAsync(() => questBoard(), [profile?.id, round])
  const again = () => setRound((n) => n + 1)

  const { waiting, done } = useMemo(() => {
    const all = board.data ?? []
    return {
      waiting: all.filter((one) => !one.claimed_at),
      done: all.filter((one) => !!one.claimed_at),
    }
  }, [board.data])

  return (
    <Page className="space-y-5">
      <PageHeader
        kicker="Quests"
        icon={faWandMagicSparkles}
        title="Things to go and do"
        lead={`Play, turn up, and come back for what it is worth. Every one of these pays in ${currency.plural}.`}
        actions={
          profile?.is_verified && (
            <Button icon={faPlus} onClick={() => setAsking(true)}>
              Ask for a quest
            </Button>
          )
        }
        aside={
          profile && (
            <div className="rounded-2xl border border-ink-line bg-ink-raised px-5 py-4 text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Your balance</p>
              <Balance amount={profile.pixels ?? 0} size="lg" className="mt-1 justify-end" />
            </div>
          )
        }
      />

      <Daily onChange={again} />

      {board.error ? (
        <ErrorState message={board.error} onRetry={board.reload} />
      ) : board.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : waiting.length === 0 && done.length === 0 ? (
        <Card>
          <EmptyState
            mood="emptyBox"
            title="Nothing to do just yet"
            body="Quests come from Worlds and from Kobblon, and there are none running. The daily above is still yours."
            action={<Button variant="subtle" to="/discover">Go and find a World</Button>}
          />
        </Card>
      ) : (
        <>
          {waiting.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {waiting.map((one) => (
                <QuestCard key={one.id} quest={one} onChange={again} />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-3">
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                Already claimed
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {done.map((one) => (
                  <QuestCard key={one.id} quest={one} onChange={again} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Note tone="brand" icon={faClock}>
        Time in a World is counted by Kobblon while you play, from the session the
        Launcher keeps open. Nothing you or the Launcher can say adds to it, which is
        what keeps the number worth something.
      </Note>

      {profile?.is_verified && (
        <>
          <MyRequests reloadKey={round} />
          <AskForOne open={asking} onClose={() => setAsking(false)} onDone={again} />
        </>
      )}

      {!profile?.is_verified && (
        <Note tone="brand" icon={faHandshake}>
          Worlds get onto this tab when a verified creator asks and an admin agrees.
        </Note>
      )}
    </Page>
  )
}
