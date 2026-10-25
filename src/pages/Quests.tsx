import { useEffect, useMemo, useState } from 'react'
import {
  faCircleCheck, faHandshake, faPlus, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Note } from '@/components/ui/Note'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { BrixShell } from '@/components/money/BrixShell'
import { CurrencyMark } from '@/components/brand/Currency'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { forgetQuests, questsSeen } from '@/hooks/useNewQuests'
import {
  addQuest, claimDaily, claimQuest, dailyWaiting, myQuestRequests, myWorlds,
  questBoard, requestWorldQuest, startQuest,
} from '@/lib/api'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { worldLink } from '@/lib/links'
import { cn } from '@/lib/cn'
import { NameMarks } from '@/components/brand/Verified'
import type { Quest, QuestCounted } from '@/types/db'

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

/**
 * The daily, written as a quest.
 *
 * Staw: "make that the everyday claim is a viewed as a normal quest too
 * (just that it reappears everyday)". It had its own strip above the board
 * - its own layout, its own button, its own idea of what claimed looks like
 * - which made the one thing everybody comes here for the one thing that did
 * not look like the rest of the page.
 *
 * It is a row the server does not have, so it is built here rather than
 * read: `claim` is the kind for a quest with nothing to do, the goal is one,
 * and whether it is done is `daily_waiting()` saying so. Claiming still goes
 * through `claim_daily`, which is the only thing that can give it, and the
 * reset is the server's midnight rather than anything this page counts.
 */
export const DAILY_ID = 'daily'

function dailyQuest(waiting: boolean): Quest {
  const now = new Date().toISOString()
  return {
    id: DAILY_ID,
    counted: 'claim',
    title: `Today's ${currency.plural}`,
    lead: 'For turning up. It comes back tomorrow, and it does not stack.',
    goal: 1,
    done: 1,
    reward: DAILY,
    world_tag: null,
    custom_tag: 'Daily',
    background_url: null,
    world_id: null,
    world_content_id: null,
    world_slug: null,
    world_name: null,
    world_emblem: null,
    author_name: 'Kobblon',
    /* Nobody promoted it; the house did, and the house has no account. */
    author_id: null,
    ends_at: null,
    started: now,
    claimed_at: waiting ? null : now,
    author_verified: true,
    created_at: now,
  }
}

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
          part >= 1 ? 'bg-space' : 'bg-brand-bright',
        )}
        style={{ width: `${part * 100}%` }}
      />
    </div>
  )
}

/** One quest. The button is whatever this person's next move actually is. */
/** The day a quest stops, written the short way the card has room for. */
function endsOn(when: string) {
  const day = new Date(when)
  return `${day.getDate()}/${day.getMonth() + 1}`
}

/**
 * One quest, as Staw drew it.
 *
 * The picture leads, because a quest about a World is really an invitation
 * to the World and the picture is the only part of the card that says which
 * one. Under it the promoter and the day it stops, then the reward and what
 * has to be done for it in a panel of its own, then the two doors: the one
 * that takes you to the thing, and the one that takes the quest on.
 *
 * Everything with a number in it comes from the database. The bar is `done`
 * against `goal` as the server counted it, and the claim is refused there
 * rather than here - this page cannot tell anybody it played for fifteen
 * minutes, which is the point of counting it in the heartbeat.
 */
export function QuestCard({ quest, onChange }: { quest: Quest; onChange: () => void }) {
  const say = useToast()
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)

  const bits = howFar(quest)
  const finished = quest.done >= quest.goal
  const claimed = !!quest.claimed_at

  const where = quest.world_content_id
    ? worldLink({
      content_id: quest.world_content_id,
      slug: quest.world_slug,
      name: quest.world_name ?? quest.world_tag ?? 'World',
    })
    : null

  const press = async () => {
    setBusy(true)
    try {
      if (quest.id === DAILY_ID) {
        const left = await claimDaily()
        await refreshProfile()
        say(`${currency.amount(DAILY)} yours. ${currency.amount(left)} in all.`, 'success')
      } else if (!quest.started) {
        await startQuest(quest.id)
        say('Taken on. It counts from now.', 'success')
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

  const cover = quest.background_url ?? quest.world_emblem

  return (
    <Card className={cn('flex flex-col overflow-hidden p-0', claimed && 'opacity-70')}>
      {/* The picture, and what it is of. A quest with no picture gets the
          mark rather than a stock photograph of somebody else's game. */}
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-media">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-brand-ink">
            <Icon name="laurel-quest" className="h-14 w-14 text-brand-bright/60" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        {quest.world_emblem && quest.background_url && (
          <img
            src={quest.world_emblem}
            alt=""
            className="absolute bottom-2 left-2 h-9 w-9 rounded-lg border border-white/15 object-cover"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]">
        <span className="flex min-w-0 items-center gap-1 text-muted">
          Promoted by
          <span className="truncate font-bold text-white/85">
            {quest.author_name ?? 'Kobblon'}
          </span>
          <NameMarks
            id={quest.author_id}
            person={{ is_verified: quest.author_verified }}
            className="shrink-0 text-[11px]"
          />
        </span>
        {quest.ends_at && (
          <span className="shrink-0 text-muted">Ends {endsOn(quest.ends_at)}</span>
        )}
      </div>

      {/* What it pays and what for, in a panel of its own so the two never
          read as one sentence running on. */}
      <div className="mx-3 flex-1 rounded-xl border border-ink-line bg-ink-raised p-3">
        <div className="flex gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink">
            <Icon name="laurel-quest" className="h-8 w-8 text-brand-bright" />
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-display text-[10px] font-bold uppercase tracking-wider text-brand-bright">
              {(quest.custom_tag ?? quest.world_tag ?? 'Kobblon')} quest
            </p>
            <p className="flex items-center gap-1.5 font-display text-sm font-extrabold">
              Claim
              <span className="inline-flex items-center gap-1 tabular-nums text-space-bright">
                <CurrencyMark className="h-[0.85em] w-[0.85em]" />
                {formatCount(quest.reward)}
              </span>
            </p>
            <p className="text-xs leading-relaxed text-muted">
              {quest.lead ?? quest.title}
            </p>
          </div>
        </div>

        {/* The bar only once there is something on it. Before that it is a
            row of zeroes saying nothing anybody needs. */}
        {quest.started && !claimed && (
          <div className="mt-3 space-y-1.5">
            <Bar done={quest.done} goal={quest.goal} />
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span className="tabular-nums">{bits.done} of {bits.goal}</span>
              <span className={cn(finished && 'font-bold text-space-bright')}>{bits.left}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3">
        {where && (
          <Button variant="subtle" className="flex-1" to={where}>
            Play now
          </Button>
        )}

        {claimed ? (
          <span className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink-raised py-2 text-xs font-bold text-space-bright">
            <Glyph icon={faCircleCheck} className="w-3.5" />
            Claimed
          </span>
        ) : (
          <GuestGate action="do quests">
            <Button
              className={cn(where ? 'flex-1' : 'w-full')}
              variant={finished && quest.started ? 'primary' : quest.started ? 'subtle' : 'primary'}
              loading={busy}
              disabled={!!quest.started && !finished}
              onClick={() => void press()}
            >
              {!quest.started
                ? 'Accept quest'
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

/**
 * Staw writing one, which goes straight on the board.
 *
 * Separate from the dialog above and deliberately so: that one is a
 * creator asking for a quest about their own World, with a fee and an
 * approval behind it. This is the board's owner, so there is no fee, no
 * approval and no restriction on what is counted - including time in a
 * World, which `add_quest` refused outright until migration 0269.
 */
function WriteOne({ open, onClose, onDone }: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const say = useToast()
  const [title, setTitle] = useState('')
  const [lead, setLead] = useState('')
  const [counted, setCounted] = useState<QuestCounted>('worlds_played')
  const [goal, setGoal] = useState('3')
  const [reward, setReward] = useState('100')
  const [tag, setTag] = useState('')
  const [background, setBackground] = useState('')
  const [world, setWorld] = useState('')
  const [until, setUntil] = useState('')
  const [busy, setBusy] = useState(false)

  const worlds = useAsync(async () => (open ? myWorlds() : []), [open])
  const needsWorld = counted === 'world_time'

  const send = async () => {
    setBusy(true)
    try {
      await addQuest({
        title,
        counted,
        /* Minutes read better than seconds and the server counts seconds. */
        goal: needsWorld ? Number(goal) * 60 : Number(goal),
        reward: Number(reward),
        lead,
        tag,
        background,
        until: until ? new Date(until).toISOString() : null,
        world: needsWorld ? world : null,
      })
      say('It is on the board.', 'success')
      setTitle(''); setLead(''); setTag(''); setBackground(''); setUntil('')
      onDone()
      onClose()
    } catch (err) {
      say(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Write a quest"
      description="It goes live the moment you send it."
      size="lg"
      footer={
        <Button
          loading={busy}
          disabled={!title.trim() || (needsWorld && !world)}
          onClick={() => void send()}
        >
          Put it on the board
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="Play three Worlds you have never played"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Input
          label="The line under it"
          placeholder="Anything you like, as long as it is three of them."
          maxLength={140}
          value={lead}
          onChange={(e) => setLead(e.target.value)}
        />

        <Select
          label="What is counted"
          value={counted}
          onChange={(value) => setCounted(value as QuestCounted)}
          options={[
            { value: 'worlds_played', label: 'Worlds played' },
            { value: 'friends_made', label: 'Friends made' },
            { value: 'world_time', label: 'Time in one World' },
            { value: 'by_hand', label: 'By hand, credited by staff' },
          ]}
        />

        {needsWorld && (
          <Select
            label="Which World"
            value={world}
            onChange={setWorld}
            options={[
              { value: '', label: 'Pick one' },
              ...(worlds.data ?? []).map((one) => ({ value: one.id, label: one.name })),
            ]}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={needsWorld ? 'Minutes of play' : 'How many'}
            type="number"
            min={1}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <Input
            label={`${currency.plural} won`}
            type="number"
            min={1}
            value={reward}
            onChange={(e) => setReward(e.target.value)}
          />
        </div>

        <Input
          label="A tag"
          placeholder="seasonal"
          maxLength={24}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />

        <Input
          label="A picture for the card"
          placeholder="https://"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          hint="Left empty, the card shows the mark. Nothing stock is ever put there."
        />

        <Input
          label="Ends"
          type="datetime-local"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          hint="Left empty, it runs until you end it."
        />
      </div>
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
  const today = useAsync(() => dailyWaiting(), [profile?.id])
  const [asking, setAsking] = useState(false)
  const [writing, setWriting] = useState(false)
  const [round, setRound] = useState(0)
  const [order, setOrder] = useState<'suggested' | 'ending' | 'reward'>('suggested')

  const board = useAsync(() => questBoard(), [profile?.id, round])
  const again = () => {
    forgetQuests()
    today.reload()
    setRound((n) => n + 1)
  }

  /* Looking at the board is what puts the dot out, so it goes out here
     rather than on a button somebody has to find. */
  useEffect(() => {
    if (profile?.id && board.data) questsSeen(profile.id)
  }, [profile?.id, board.data])

  /*
   * Sorted here rather than asked for again, because the board is one call
   * and a handful of rows: three round trips to reorder what is already in
   * the page would be three round trips for nothing.
   *
   * "Suggested" is the order the server sent, which is what is running and
   * newest first. The other two are what somebody actually wants when they
   * reach for the control: the one about to stop, and the one worth most.
   */
  const { waiting, done } = useMemo(() => {
    const all = [...(board.data ?? [])]
    /* The daily is a quest like the others now, so it is sorted with them -
       except that it leads the board while it is unclaimed, because it is
       the one thing on this page that is gone by tomorrow. */
    const daily = profile && today.data !== null ? dailyQuest(today.data === true) : null
    if (order === 'ending') {
      all.sort((a, b) => {
        if (!a.ends_at) return 1
        if (!b.ends_at) return -1
        return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime()
      })
    }
    if (order === 'reward') all.sort((a, b) => b.reward - a.reward)
    if (daily) all.unshift(daily)
    return {
      waiting: all.filter((one) => !one.claimed_at),
      done: all.filter((one) => !!one.claimed_at),
    }
  }, [board.data, order, profile, today.data])

  return (
    <BrixShell
      icon={faWandMagicSparkles}
      ours="laurel-quest"
      title="Things to go and do"
      actions={
        <>
          {profile?.is_superadmin && (
            <Button icon={faPlus} onClick={() => setWriting(true)}>
              Write a quest
            </Button>
          )}
          {profile?.is_verified && !profile?.is_superadmin && (
            <Button icon={faPlus} onClick={() => setAsking(true)}>
              Ask for a quest
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
      {board.error ? (
        <ErrorState message={board.error} onRetry={board.reload} />
      ) : board.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : waiting.length === 0 && done.length === 0 ? (
        <Card>
          <EmptyState
            mood="brix"
            title="Nothing to do just yet"
            body="Quests come from Worlds and from Kobblon, and there are none running just now."
            action={<Button variant="subtle" to="/discover">Go and find a World</Button>}
          />
        </Card>
      ) : (
        <>
          {waiting.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-extrabold">Available quests</h2>
                <div className="w-44 shrink-0">
                  <Select
                    label="Order"
                    value={order}
                    onChange={(value) => setOrder(value as typeof order)}
                    options={[
                      { value: 'suggested', label: 'Suggested' },
                      { value: 'ending', label: 'Ending soonest' },
                      { value: 'reward', label: `Most ${currency.plural}` },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {waiting.map((one) => (
                  <QuestCard key={one.id} quest={one} onChange={again} />
                ))}
              </div>
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


      {profile?.is_superadmin && (
        <WriteOne open={writing} onClose={() => setWriting(false)} onDone={again} />
      )}

      {profile?.is_verified && !profile?.is_superadmin && (
        <>
          <MyRequests reloadKey={round} />
          <AskForOne open={asking} onClose={() => setAsking(false)} onDone={again} />
        </>
      )}

      {!profile?.is_verified && (
        <Note tone="brand" icon={faHandshake}>
          Verified creators can ask for a World to be on this board.
        </Note>
      )}
      </div>
    </BrixShell>
  )
}
