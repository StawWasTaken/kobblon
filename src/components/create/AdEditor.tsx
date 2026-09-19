import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCubes, faUsers, faCalendarDay, faShapes, faGlobe, faLock,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { UploadDialog } from '@/components/create/UploadDialog'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { addAd, editAd, listAdvertisable, listOwnAssets } from '@/lib/api'
import type { AdSize, AdTarget, Advertisable, CampaignAd } from '@/lib/api'
import { AD_SIZES, BUYABLE_AD_SIZES } from '@/lib/ads'
import { cn } from '@/lib/cn'
import type { OwnAsset } from '@/types/db'

/** What an ad may be for, and what each of those looks like in a list. */
export const targetLook: Record<AdTarget, { icon: IconDefinition; label: string }> = {
  space: { icon: faCubes, label: 'Spaces' },
  community: { icon: faUsers, label: 'Communities' },
  event: { icon: faCalendarDay, label: 'Events' },
  asset: { icon: faShapes, label: 'Marketplace' },
  link: { icon: faGlobe, label: 'Somewhere else' },
}

const targetOrder: AdTarget[] = ['space', 'community', 'event', 'asset']

/** A decal of somebody's own, small, for picking one. */
function Thumb({ path, on }: { path: string; on: boolean }) {
  const url = useSignedUrl(path)
  return (
    <span
      className={cn(
        'block aspect-video w-full overflow-hidden rounded-lg border bg-media',
        on ? 'border-brand-bright' : 'border-ink-line',
      )}
    >
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </span>
  )
}

/**
 * Making an ad, or changing one that already exists.
 *
 * The same three questions either way: what it looks like, what shape it is,
 * and what it is for. None of them involve money, because the campaign has
 * already been paid for.
 */
export function AdEditor({
  open, onClose, campaignId, existing, onDone,
}: {
  open: boolean
  onClose: () => void
  /** Which campaign this ad belongs to. Only read when making a new one. */
  campaignId: string
  /** The ad being changed, or nothing when making one. */
  existing?: CampaignAd | null
  onDone: () => void
}) {
  const { profile } = useAuth()
  const toast = useToast()

  const targets = useAsync(
    () => (profile ? listAdvertisable() : Promise.resolve([] as Advertisable[])),
    [profile?.id, open],
  )
  const decals = useAsync(
    async () => (profile
      ? (await listOwnAssets(profile.id)).filter((a) => a.kind === 'image' && a.status === 'approved')
      : []),
    [profile?.id, open],
  )

  const official = profile?.username?.toLowerCase() === 'kobblon'

  const [size, setSize] = useState<AdSize>('banner')
  const [picked, setPicked] = useState<OwnAsset | null>(null)
  const [forWhat, setForWhat] = useState<Advertisable | null>(null)
  const [outward, setOutward] = useState('')
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState(false)

  // What is being changed decides what the form starts as.
  useEffect(() => {
    if (!open) return
    setSize(existing?.size ?? 'banner')
    setOutward(existing?.target_kind === 'link' ? existing.target_path : '')
    setForWhat(null)
    setPicked(null)
  }, [open, existing?.id])

  // The decal and the thing being advertised are matched up once both lists
  // are here, so editing starts from what the ad already says.
  useEffect(() => {
    if (!open || !existing) return
    const decal = decals.data?.find((one) => one.id === existing.asset_id)
    if (decal) setPicked(decal)
    const target = targets.data?.find((one) => one.id === existing.target_id)
    if (target) setForWhat(target)
  }, [open, existing?.id, decals.data, targets.data])

  const save = async () => {
    if (!picked) { toast('Pick a decal for the ad.', 'error'); return }

    const away = official && outward.trim()
    if (!forWhat && !away) { toast('Say what the ad is for.', 'error'); return }

    const details = {
      size,
      assetId: picked.id,
      kind: (away ? 'link' : (forWhat as Advertisable).kind) as AdTarget,
      targetId: away ? null : (forWhat as Advertisable).id,
      outward: away ? outward.trim() : null,
    }

    setPending(true)
    try {
      if (existing) {
        await editAd(existing.id, details)
        toast('Changed.', 'success')
      } else {
        await addAd(campaignId, details)
        toast('Added to the campaign.', 'success')
      }
      onDone()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? 'Change this ad' : 'Add an ad'}
      description={
        existing
          ? 'What it has been shown and pressed stays with it.'
          : 'It runs on the campaign you already paid for.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={pending} onClick={save}>
            {existing ? 'Save the change' : 'Add it'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            Shape
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {BUYABLE_AD_SIZES.map((value) => AD_SIZES[value] && (
              <button
                key={value}
                onClick={() => setSize(value)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors',
                  size === value
                    ? 'border-brand-bright bg-brand/15'
                    : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
                )}
              >
                {AD_SIZES[value].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Decal</p>
            <button
              onClick={() => setUploading(true)}
              className="text-xs font-bold text-link hover:underline"
            >
              Upload one
            </button>
          </div>

          {decals.loading && <Skeleton className="h-24 rounded-xl" />}

          {!decals.loading && !decals.data?.length && (
            <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-sm text-muted">
              You have no approved decals in Create yet. Upload one and it can go in an ad once it
              has been looked at.
            </p>
          )}

          {!!decals.data?.length && (
            <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 kob-scroll">
              {decals.data.map((asset) => (
                <button key={asset.id} onClick={() => setPicked(asset)} className="text-left">
                  <Thumb path={asset.file_path} on={picked?.id === asset.id} />
                  <span className="mt-1 block truncate text-[11px] font-semibold text-muted">
                    {asset.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            What it is for
          </p>
          <p className="mb-2 text-xs text-muted">
            A Space, a community, an event or something in the Marketplace, and only one you made
            or have been given the run of.
          </p>

          {targets.loading && <Skeleton className="h-24 rounded-xl" />}

          {!targets.loading && !targets.data?.length && (
            <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-sm text-muted">
              There is nothing here to advertise yet. Build a Space, run a community, or put
              something in the Marketplace, and it turns up in this list.
            </p>
          )}

          {!!targets.data?.length && (
            <div className="max-h-56 space-y-3 overflow-y-auto pr-1 kob-scroll">
              {targetOrder.map((kind) => {
                const rows = (targets.data ?? []).filter((one) => one.kind === kind)
                if (!rows.length) return null

                return (
                  <div key={kind}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                      <FontAwesomeIcon icon={targetLook[kind].icon} />
                      {targetLook[kind].label}
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {rows.map((row) => (
                        <button
                          key={row.id}
                          onClick={() => { setForWhat(row); setOutward('') }}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-left transition-colors',
                            forWhat?.id === row.id
                              ? 'border-brand-bright bg-brand/15'
                              : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
                          )}
                        >
                          <span className="block truncate text-xs font-bold">{row.label}</span>
                          <span className="block truncate text-[11px] text-muted">
                            {row.note} · {row.path}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {official ? (
            <div className="mt-3">
              <Input
                label="Or somewhere else entirely"
                labelNote="Kobblon only"
                value={outward}
                onChange={(e) => { setOutward(e.target.value); if (e.target.value) setForWhat(null) }}
                placeholder="https://"
                hint="This account may point an ad at another website. No other account can."
              />
            </div>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
              <FontAwesomeIcon icon={faLock} />
              Ads cannot be pointed off Kobblon.
            </p>
          )}
        </div>
      </div>

      <UploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        only="image"
        onUploaded={(created) => {
          decals.reload()
          if (created?.status === 'approved') {
            toast('Uploaded and ready to advertise with.', 'success')
          } else if (created) {
            toast('Uploaded. It can go in an ad once it has been looked at.', 'info')
          }
        }}
      />
    </Dialog>
  )
}
