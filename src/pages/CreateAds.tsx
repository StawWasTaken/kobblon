import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRectangleAd, faPlus, faStop, faEye, faHandPointer, faCircleCheck, faGlobe,
  faRotateRight, faHourglassHalf, faTrash, faPen, faPause, faPlay, faPenToSquare,
  faClock,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { CurrencyMark } from '@/components/brand/Currency'
import { AdEditor, targetLook } from '@/components/create/AdEditor'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import {
  AD_MAX_KUBES, adDays, adKubesFor, createCampaign, endCampaign, listCampaignAds, listCampaigns,
  pauseAd, removeAd, removeCampaign, renameCampaign, renewCampaign, setCampaignDays,
} from '@/lib/api'
import type { Campaign, CampaignAd } from '@/lib/api'
import { currency } from '@/lib/currency'
import { AD_SIZES } from '@/lib/ads'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

const CREATE = 'Kobblon Create'

/** How much longer a campaign has, said the way a person would say it. */
function timeLeft(ends: string | null) {
  if (!ends) return null
  const hours = (new Date(ends).getTime() - Date.now()) / 3600000
  if (hours <= 0) return null
  if (hours < 1) return 'Less than an hour left'
  if (hours < 24) return `${Math.round(hours)} ${Math.round(hours) === 1 ? 'hour' : 'hours'} left`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

/** What a budget buys, in both of the ways it runs out. */
const runsFor = (amount: number) => {
  const days = adDays(amount)
  return `${amount} views, or ${days} ${days === 1 ? 'day' : 'days'}, whichever goes first`
}

/* -------------------------------------------------------------- one ad */

function AdRow({ ad, onEdit, onChanged }: {
  ad: CampaignAd
  onEdit: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const picture = useSignedUrl(ad.file_path)
  const look = targetLook[ad.target_kind] ?? targetLook.link

  const act = async (what: () => Promise<void>, said: string) => {
    try {
      await what()
      toast(said, 'info')
      onChanged()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
    }
  }

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-ink-line bg-ink-raised p-3',
        !ad.is_active && 'opacity-60',
      )}
    >
      <span className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-media">
        {picture && <img src={picture} alt="" className="h-full w-full object-cover" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full border border-ink-line px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted">
            {AD_SIZES[ad.size]?.label ?? ad.size}
          </span>
          {!ad.is_active && (
            <span className="rounded-full bg-ink-hover px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted">
              Resting
            </span>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-muted">
          <FontAwesomeIcon icon={ad.target_kind === 'link' ? faGlobe : look.icon} />
          {ad.target_path}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] font-bold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <FontAwesomeIcon icon={faEye} />
            {formatCount(ad.views)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FontAwesomeIcon icon={faHandPointer} />
            {formatCount(ad.clicks)}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="subtle" icon={faPenToSquare} onClick={onEdit}>Change</Button>
        <Button
          size="sm"
          variant="ghost"
          icon={ad.is_active ? faPause : faPlay}
          onClick={() => act(
            () => pauseAd(ad.id, ad.is_active),
            ad.is_active ? 'Resting. It is not shown until you wake it.' : 'Back in the rotation.',
          )}
        >
          {ad.is_active ? 'Rest' : 'Wake'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={faTrash}
          onClick={() => act(() => removeAd(ad.id), 'Taken out of the campaign.')}
        >
          Remove
        </Button>
      </div>
    </li>
  )
}

/* -------------------------------------------------------- one campaign */

function CampaignCard({ campaign, onChanged, onRenew, onRemove, onRename, onClock }: {
  campaign: Campaign
  onChanged: () => void
  onRenew: () => void
  onRemove: () => void
  onRename: () => void
  onClock: () => void
}) {
  const toast = useToast()
  const ads = useAsync(() => listCampaignAds(campaign.id), [campaign.id])
  const [adding, setAdding] = useState(false)
  const [changing, setChanging] = useState<CampaignAd | null>(null)

  const left = campaign.budget - campaign.spent - campaign.refunded
  const remaining = campaign.is_running ? timeLeft(campaign.ends_at) : null

  const stop = async () => {
    try {
      const back = await endCampaign(campaign.id)
      toast(back > 0 ? `Stopped. ${currency.amount(back)} came back.` : 'Stopped.', 'info')
      onChanged()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not stop.', 'error')
    }
  }

  return (
    <article className="rounded-2xl border border-ink-line bg-ink-card">
      <header className="flex flex-wrap items-start gap-4 border-b border-ink-line p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-lg font-extrabold">
            <span className="truncate">{campaign.name}</span>
            <button
              onClick={onRename}
              aria-label="Rename this campaign"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/40 hover:bg-ink-hover hover:text-white"
            >
              <FontAwesomeIcon icon={faPen} className="text-[10px]" />
            </button>
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5">
              <CurrencyMark />
              {formatCount(left)} left of {formatCount(campaign.budget - campaign.refunded)}
            </span>
            {remaining && (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <FontAwesomeIcon icon={faHourglassHalf} />
                {remaining}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-muted">
              <FontAwesomeIcon icon={faEye} />
              {formatCount(campaign.views)} views
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <FontAwesomeIcon icon={faHandPointer} />
              {formatCount(campaign.clicks)} presses
            </span>
            {campaign.renewed_count > 0 && (
              <span className="text-muted">
                Renewed {campaign.renewed_count} {campaign.renewed_count === 1 ? 'time' : 'times'}
              </span>
            )}
          </div>

          <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-ink-raised">
            <span
              style={{
                width: `${Math.min(100, (campaign.spent / Math.max(1, campaign.budget - campaign.refunded)) * 100)}%`,
              }}
              className="block h-full bg-brand"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button size="sm" variant="subtle" icon={faPlus} onClick={() => setAdding(true)}>
            Add an ad
          </Button>
          {campaign.is_running ? (
            <>
              <Button size="sm" variant="ghost" icon={faClock} onClick={onClock}>
                How long
              </Button>
              <Button size="sm" variant="ghost" icon={faStop} onClick={stop}>Stop</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="subtle" icon={faRotateRight} onClick={onRenew}>
                Put it back up
              </Button>
              <Button size="sm" variant="ghost" icon={faTrash} onClick={onRemove}>Remove</Button>
            </>
          )}
        </div>
      </header>

      <div className="p-4">
        {!campaign.is_running && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted">
            <FontAwesomeIcon icon={faCircleCheck} />
            Finished. Nothing in it is being shown.
          </p>
        )}

        {ads.loading && <Skeleton className="h-16 rounded-xl" />}

        {!ads.loading && !ads.data?.length && (
          <p className="rounded-xl border border-dashed border-ink-line p-4 text-center text-sm text-muted">
            Nothing in this campaign yet. Add an ad and it starts being shown.
          </p>
        )}

        {!!ads.data?.length && (
          <ul className="space-y-2">
            {ads.data.map((ad) => (
              <AdRow
                key={ad.id}
                ad={ad}
                onEdit={() => setChanging(ad)}
                onChanged={() => { ads.reload(); onChanged() }}
              />
            ))}
          </ul>
        )}
      </div>

      <AdEditor
        open={adding}
        onClose={() => setAdding(false)}
        campaignId={campaign.id}
        onDone={() => { ads.reload(); onChanged() }}
      />

      <AdEditor
        open={!!changing}
        onClose={() => setChanging(null)}
        campaignId={campaign.id}
        existing={changing}
        onDone={() => { ads.reload(); onChanged() }}
      />
    </article>
  )
}

/* ------------------------------------------------------------------ page */

export default function CreateAds() {
  useTitle('Ads', CREATE)
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()

  const campaigns = useAsync(
    () => (profile ? listCampaigns() : Promise.resolve([] as Campaign[])),
    [profile?.id],
  )

  const [starting, setStarting] = useState(false)
  const [name, setName] = useState('')
  const [budget, setBudget] = useState(50)
  const [pending, setPending] = useState(false)

  const [renewing, setRenewing] = useState<Campaign | null>(null)
  const [again, setAgain] = useState(50)
  const [removing, setRemoving] = useState<Campaign | null>(null)
  const [renaming, setRenaming] = useState<Campaign | null>(null)
  const [newName, setNewName] = useState('')
  const [clocking, setClocking] = useState<Campaign | null>(null)
  const [days, setDays] = useState(14)

  const most = Math.max(10, Math.min(AD_MAX_KUBES, profile?.pixels ?? 10))

  const start = async () => {
    if (name.trim().length < 3) {
      toast('Give the campaign a name of at least three letters.', 'error')
      return
    }
    setPending(true)
    try {
      await createCampaign(name.trim(), budget)
      toast('Campaign started. Add an ad to it and it begins showing.', 'success')
      setStarting(false)
      setName('')
      campaigns.reload()
      refreshProfile()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
    } finally {
      setPending(false)
    }
  }

  const renew = async () => {
    if (!renewing) return
    setPending(true)
    try {
      const until = await renewCampaign(renewing.id, again)
      const days = Math.max(1, Math.round((new Date(until).getTime() - Date.now()) / 86400000))
      toast(`Back up for ${days} ${days === 1 ? 'day' : 'days'}.`, 'success')
      setRenewing(null)
      campaigns.reload()
      refreshProfile()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
    } finally {
      setPending(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setPending(true)
    try {
      const back = await removeCampaign(removing.id)
      toast(back > 0 ? `Removed. ${currency.amount(back)} came back.` : 'Removed.', 'success')
      setRemoving(null)
      campaigns.reload()
      refreshProfile()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That could not be removed.', 'error')
    } finally {
      setPending(false)
    }
  }

  const setClock = async () => {
    if (!clocking) return
    setPending(true)
    try {
      await setCampaignDays(clocking.id, days)
      toast(
        `Running for ${days} ${days === 1 ? 'day' : 'days'} from now.`,
        'success',
      )
      setClocking(null)
      campaigns.reload()
      refreshProfile()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
    } finally {
      setPending(false)
    }
  }

  const rename = async () => {
    if (!renaming) return
    setPending(true)
    try {
      await renameCampaign(renaming.id, newName.trim())
      toast('Renamed.', 'success')
      setRenaming(null)
      campaigns.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Ads</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            A campaign holds the name, the {currency.plural} and the clock, up to a month of it. The ads
            inside it are the work:
            as many as you like, each with its own decal, shape and destination, changed or
            rested without touching what you paid.
          </p>
        </div>

        <Button icon={faPlus} onClick={() => setStarting(true)} disabled={!profile}>
          Start a campaign
        </Button>
      </header>

      {campaigns.loading && <Skeleton className="h-40 rounded-2xl" />}
      {campaigns.error && <ErrorState message={campaigns.error} onRetry={campaigns.reload} />}

      {!campaigns.loading && !campaigns.data?.length && (
        <Card>
          <EmptyState
            mood="emptyBox"
            title="No campaigns yet"
            body={`A campaign is some ${currency.plural} and a month at most. Put ads in it, point them at your Worlds, communities, events or Marketplace work, and they are shown across Kobblon.`}
            action={<Button icon={faRectangleAd} onClick={() => setStarting(true)}>Start one</Button>}
          />
        </Card>
      )}

      {!!campaigns.data?.length && (
        <div className="space-y-4">
          {campaigns.data.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onChanged={() => { campaigns.reload(); refreshProfile() }}
              onRenew={() => { setRenewing(campaign); setAgain(Math.min(50, most)) }}
              onRemove={() => setRemoving(campaign)}
              onRename={() => { setRenaming(campaign); setNewName(campaign.name) }}
              onClock={() => {
                setClocking(campaign)
                setDays(adDays(campaign.budget - campaign.refunded))
              }}
            />
          ))}
        </div>
      )}

      {/* ---------------------------------------------------- starting one */}
      <Dialog
        open={starting}
        onClose={() => setStarting(false)}
        title="Start a campaign"
        description={`The ${currency.plural} are paid now, and they decide how long it runs.`}
        size="md"
        footer={
          <>
            <span className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted">
              You have <CurrencyMark /> {formatCount(profile?.pixels ?? 0)}
            </span>
            <Button variant="ghost" onClick={() => setStarting(false)}>Cancel</Button>
            <Button loading={pending} onClick={start}>
              <CurrencyMark />
              {budget}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="What to call it"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            hint={
              name.trim() && name.trim().length < 3
                ? 'A name needs at least three letters.'
                : 'Only you see this. Three letters at least.'
            }
          />

          <div>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              {currency.plural} behind it
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={most}
                step={10}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="h-2 w-full accent-[#1B34E8]"
                aria-label={`${currency.plural} behind this campaign`}
              />
              <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-lg font-extrabold tabular-nums">
                <CurrencyMark />
                {budget}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              That is {runsFor(budget)}, shared by every ad in it. The more {currency.plural} behind it, the
              longer it stays up, to a limit of a month at {AD_MAX_KUBES}. A Space that shows one
              of your ads keeps 15% of what that view costs.
            </p>
          </div>
        </div>
      </Dialog>

      {/* ------------------------------------------------------- renaming */}
      <Dialog
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename this campaign"
        description="The name is yours alone: nobody being shown an ad sees it."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button loading={pending} onClick={rename}>Save</Button>
          </>
        }
      >
        <Input
          label="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={60}
          hint="Between 3 and 60 letters."
        />
      </Dialog>

      {/* ------------------------------------------------------- the clock */}
      <Dialog
        open={!!clocking}
        onClose={() => setClocking(null)}
        title="How long it runs"
        description={clocking ? `${clocking.name}, counted from now.` : ''}
        size="sm"
        footer={
          <>
            <span className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted">
              You have <CurrencyMark /> {formatCount(profile?.pixels ?? 0)}
            </span>
            <Button variant="ghost" onClick={() => setClocking(null)}>Cancel</Button>
            <Button loading={pending} onClick={setClock}>
              {(() => {
                const owed = Math.max(
                  0,
                  adKubesFor(days) - ((clocking?.budget ?? 0) - (clocking?.refunded ?? 0)),
                )
                return owed > 0 ? <><CurrencyMark />{owed}</> : 'Set it'
              })()}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-2 w-full accent-[#1B34E8]"
              aria-label="How many days it runs"
            />
            <span className="w-20 shrink-0 text-right font-display text-lg font-extrabold tabular-nums">
              {days} {days === 1 ? 'day' : 'days'}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Longer costs the difference between what is behind it and what that many days is
            worth, paid now. Shorter costs nothing and gives nothing back: the {currency.plural} stay behind
            the campaign as views. Nobody gets {currency.plural} back by moving the clock, which is the whole
            point of saying so.
          </p>
        </div>
      </Dialog>

      {/* -------------------------------------------------------- renewing */}
      <Dialog
        open={!!renewing}
        onClose={() => setRenewing(null)}
        title="Put it back up"
        description={renewing ? `${renewing.name}, running again from today.` : ''}
        size="sm"
        footer={
          <>
            <span className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted">
              You have <CurrencyMark /> {formatCount(profile?.pixels ?? 0)}
            </span>
            <Button variant="ghost" onClick={() => setRenewing(null)}>Cancel</Button>
            <Button loading={pending} onClick={renew}>
              <CurrencyMark />
              {again}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={most}
              step={10}
              value={again}
              onChange={(e) => setAgain(Number(e.target.value))}
              className="h-2 w-full accent-[#1B34E8]"
              aria-label={`${currency.plural} behind this renewal`}
            />
            <span className="inline-flex shrink-0 items-center gap-1.5 font-display text-lg font-extrabold tabular-nums">
              <CurrencyMark />
              {again}
            </span>
          </div>
          <p className="text-xs text-muted">
            That is {runsFor(again)}. Every ad still in the campaign starts being shown again.
          </p>
        </div>
      </Dialog>

      {/* -------------------------------------------------------- removing */}
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove this campaign?"
        description={removing ? `${removing.name}, and every ad in it.` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button variant="danger" loading={pending} onClick={remove}>Remove it</Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Anything it never spent comes back to you. The decals its ads were using are free again
          afterwards, so they can be deleted if you want them gone as well. What was shown and
          pressed is not kept.
        </p>
      </Dialog>
    </div>
  )
}
