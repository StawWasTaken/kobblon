import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCopy, faLock, faLockOpen, faPen, faTrash, faShieldHalved,
  faTriangleExclamation, faClock, faEllipsis,
  faThumbsUp, faThumbsDown, faComment, faChevronRight, faTag, faBagShopping, faLink, faBoxOpen,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Input, Textarea } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { contentTag, kindIcons, kindLabels } from '@/components/create/AssetTile'
import { MediaPlayer } from '@/components/create/MediaPlayer'
import { FontPreview } from '@/components/create/FontPreview'
import { AssetTile } from '@/components/create/AssetTile'
import { Menu } from '@/components/ui/Menu'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import {
  assetAnalytics, deleteAsset, getAsset, listAssetReviews, listSimilarAssets, rateAsset,
  recordAssetEvent, removeAssetReview, updateAsset, writeAssetReview, buyAsset, priceCeilings,
  ensureAssetPreview,
  dropFromInventory, listForSale, unlistForSale, listingFee, PLATFORM_SHARE,
} from '@/lib/api'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { useTitle } from '@/hooks/useTitle'
import { avatarOf } from '@/lib/avatars'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AssetDay, AssetPageItem } from '@/types/db'
import { timeAgo } from '@/lib/format'
import { CurrencyMark } from '@/components/brand/Currency'
import { Verified } from '@/components/brand/Verified'
import { BackLink } from '@/components/ui/BackLink'

const prefixes: Record<string, string> = {
  IMG: 'image', SND: 'audio', VID: 'video', FNT: 'font', MSH: 'mesh', BLD: 'build',
  // What a Build was called before it had its own name.
  MDL: 'build',
}

const sizeLabel = (bytes: number) =>
  bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * The thing itself, on the left, shown the way that kind of thing wants to be
 * shown: a decal whole rather than cropped, a sound as its square cover with
 * the player beside it, a clip in its own shape, a font set in itself.
 */
function Stage({ asset, previewUrl, fileUrl }: {
  asset: AssetPageItem
  previewUrl: string | null
  fileUrl: string | null
}) {
  const [shape, setShape] = useState<{ w: number; h: number } | null>(null)

  if (asset.kind === 'video') {
    return <MediaPlayer src={fileUrl} kind="video" poster={previewUrl} />
  }

  if (asset.kind === 'font') {
    return <FontPreview src={fileUrl} name={asset.name} />
  }

  if (asset.kind === 'audio') {
    return (
      <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          // Sized against the square rather than against the text, so the
          // mark keeps its proportions whatever the cover is worth.
          <FontAwesomeIcon
            icon={kindIcons.audio}
            style={{ width: '38%', height: 'auto' }}
            className="text-white/25"
          />
        )}
      </div>
    )
  }

  // A decal, whole: the frame takes the picture's shape, and the picture is
  // never cropped to fit a frame that is not its own.
  return (
    <div
      className={cn(
        'grid w-full place-items-center overflow-hidden rounded-2xl border border-ink-line bg-ink-raised',
        shape ? '' : 'aspect-square',
      )}
      style={shape ? { aspectRatio: `${shape.w} / ${shape.h}` } : undefined}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={asset.name}
          draggable={false}
          onLoad={(e) => setShape({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          })}
          onContextMenu={(e) => e.preventDefault()}
          className="h-full w-full select-none object-contain"
        />
      ) : (
        <FontAwesomeIcon
          icon={kindIcons[asset.kind]}
          style={{ width: '34%', height: 'auto' }}
          className="text-white/25"
        />
      )}
    </div>
  )
}

/** Thirty days of use, drawn from the numbers themselves rather than invented. */
function UseChart({ days }: { days: AssetDay[] }) {
  const peak = Math.max(1, ...days.map((d) => d.views + d.uses))
  const total = days.reduce((sum, d) => sum + d.views + d.uses, 0)

  if (!total) {
    return <p className="py-6 text-center text-sm text-muted">Nothing yet in the last 30 days.</p>
  }

  return (
    <div className="flex h-32 items-end gap-[3px]" role="img" aria-label="Use over the last 30 days">
      {days.map((day) => {
        const height = ((day.views + day.uses) / peak) * 100
        return (
          <Tooltip
            key={day.day}
            side="top"
            label={`${new Date(day.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${day.views} views, ${day.uses} uses`}
          >
            <div className="flex h-32 flex-1 items-end">
              <div
                className="w-full rounded-t-sm bg-brand transition-colors hover:bg-brand-bright"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}


/**
 * How you come to own something: free or paid, you take it and it lands in
 * your inventory. After that the ID is yours to paste. The file is never
 * handed over either way.
 */
function UsePanel({ asset, onChanged }: { asset: AssetPageItem; onChanged: () => void }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [pending, setPending] = useState(false)

  const tag = contentTag(asset.kind, asset.content_id)
  const mine = profile?.id === asset.creator_id

  const copy = () => {
    void navigator.clipboard?.writeText(tag)
    void recordAssetEvent(asset.id, 'use')
    toast(`${tag} copied. Paste it into your World.`, 'success')
    onChanged()
  }

  if (asset.i_can_use) {
    return (
      <div className="space-y-2">
        <Button block icon={faCopy} onClick={copy}>Copy ID</Button>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          {asset.creator_is_admin ? (
            <Verified className="mt-0.5" />
          ) : (
            <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 shrink-0" />
          )}
          <span>
            {mine
              ? 'Yours, so you can use it anywhere.'
              : asset.creator_is_admin
                ? 'In your inventory, and verified by Kobblon.'
                : 'In your inventory.'}
          </span>
        </p>
      </div>
    )
  }

  const paid = asset.price > 0

  return (
    <div className="space-y-2">
      <Button
        block
        icon={paid ? undefined : faBagShopping}
        loading={pending}
        disabled={!profile || profile.is_guest}
        onClick={async () => {
          setPending(true)
          try {
            await buyAsset(asset.id)
            toast(
              paid ? `Bought. ${tag} is in your inventory.` : `${tag} is in your inventory.`,
              'success',
            )
            onChanged()
          } catch (err) {
            toast(err instanceof Error ? err.message : 'That did not go through.', 'error')
          } finally {
            setPending(false)
          }
        }}
      >
        {paid ? (
          <>Buy for <CurrencyMark className="mx-0.5" />{formatCount(asset.price)}</>
        ) : 'Get'}
      </Button>
      <p className="text-xs leading-relaxed text-muted">
        {paid
          ? `The ${currency.plural} go to ${asset.creator_display_name}. You get the right to use ${tag}, not the file.`
          : `Free to take. It lands in your inventory and ${tag} is yours to paste.`}
      </p>
    </div>
  )
}

export default function AssetPage() {
  const { tag = '' } = useParams()
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0')
  const [pending, setPending] = useState(false)
  const [panel, setPanel] = useState<'Description' | 'Reviews' | 'Numbers'>('Description')
  // The picture tells us its own proportions once it loads.
  const [dropping, setDropping] = useState(false)
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [erasing, setErasing] = useState(false)

  const [prefix, number] = useMemo(() => {
    const match = tag.toUpperCase().match(/^([A-Z]{3})-(\d+)$/)
    return match ? [match[1], Number(match[2])] : ['', NaN]
  }, [tag])

  const item = useAsync(
    async () => (Number.isFinite(number) ? getAsset(number) : null),
    [number],
  )
  const asset = item.data
  const mine = !!profile && asset?.creator_id === profile.id

  const stats = useAsync(
    async () => (mine && asset ? assetAnalytics(asset.id) : []),
    [mine, asset?.id],
  )

  const reviews = useAsync(
    async () => (asset ? listAssetReviews(asset.id) : []),
    [asset?.id],
  )
  const more = useAsync(
    async () => (asset ? listSimilarAssets(asset.id, 12) : []),
    [asset?.creator_id, asset?.id],
  )

  const preview = useSignedUrl(
    asset ? asset.thumbnail_path ?? (asset.kind === 'image' ? asset.file_path : null) : null,
  )
  // Sound and video play from a signed URL that expires; there is no link to
  // keep, and the player is told not to offer a download.
  const file = useSignedUrl(
    asset && (asset.kind === 'audio' || asset.kind === 'video' || asset.kind === 'font')
      ? asset.file_path
      : null,
  )

  useTitle(asset?.name, 'Kobblon Create')

  // A view is recorded once the page has actually opened the item.
  useEffect(() => {
    if (asset) void recordAssetEvent(asset.id, 'view')
  }, [asset?.id])

  /*
   * A card picture for work that has none: everything uploaded before
   * previews existed, and anything put back into Create. Only you can draw
   * one for your own content, because only you are given the file, so it
   * happens the next time you open your own page.
   */
  useEffect(() => {
    if (!asset || !mine || !profile || !asset.is_public) return
    void ensureAssetPreview(
      { id: asset.id, kind: asset.kind, file_path: asset.file_path },
      profile.id,
    ).catch(() => null)
  }, [asset?.id, mine, asset?.is_public, profile?.id])

  useEffect(() => {
    setName(asset?.name ?? '')
    setDescription(asset?.description ?? '')
    setPrice(String(asset?.price ?? 0))
  }, [asset?.id])

  if (item.loading) {
    return <div className="space-y-4"><Skeleton className="h-96 w-full" /></div>
  }
  if (item.error) {
    return <ErrorState message={item.error} onRetry={item.reload} />
  }
  if (!asset || (prefix && prefixes[prefix] !== asset.kind)) {
    return (
      <Card>
        <EmptyState
            mood="noResults"
            title="Nothing carries that number"
            body={`There is no item at ${tag}. It may have been taken down, or it may not be listed.`}
          action={<Button to="/create">Kobblon Create</Button>}
        />
      </Card>
    )
  }

  const previewUrl = preview
  const fileUrl = file

  const save = async () => {
    if (!name.trim()) { toast('It needs a name.', 'error'); return }
    setPending(true)
    try {
      const asked = Math.max(0, Math.round(Number(price) || 0))
      if (asked > priceCeilings[asset.kind]) {
        toast(`The most you can charge is ${currency.amount(priceCeilings[asset.kind])}.`, 'error')
        return
      }
      await updateAsset(asset.id, {
        name: name.trim(),
        description: description.trim() || null,
      })

      /*
       * The price is not an ordinary field: putting something up for sale
       * costs something and taking it down hands a quarter of that back, so it
       * goes through its own doors rather than being written to the row.
       */
      if (asked !== asset.price) {
        if (asked > 0) {
          const fee = await listForSale(asset.id, asked)
          toast(`Up for sale at ${asked}. Putting it up cost ${currency.amount(fee)}.`, 'success')
        } else {
          const back = await unlistForSale(asset.id)
          toast(
            back > 0 ? `Off sale. ${currency.amount(back)} came back.` : 'Off sale.',
            'success',
          )
        }
        refreshProfile()
      } else {
        toast('Saved.', 'success')
      }
      setEditing(false)
      item.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setPending(false)
    }
  }

  const setListed = async (listed: boolean) => {
    try {
      await updateAsset(asset.id, { is_public: listed })
      if (listed && profile) {
        await ensureAssetPreview(
          { id: asset.id, kind: asset.kind, file_path: asset.file_path },
          profile.id,
        ).catch(() => null)
      }
      toast(listed ? 'Back in Create.' : 'Taken out of Create.', 'success')
      item.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  const sizeText = sizeLabel(asset.byte_size)
  const stamp = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink to="/create/marketplace">Back to the marketplace</BackLink>

      {/* The head of an item: what it is, who made it, and what you may do
          with it. The file itself is never one of the options. */}
      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="max-w-md"
            />
          ) : (
            <h1 className="font-display text-3xl font-extrabold leading-tight">{asset.name}</h1>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <Link
              to={`/create/creator/${asset.creator_username}`}
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              By @{asset.creator_username}
              {asset.creator_is_admin && (
                <Verified className="text-xs" />
              )}
            </Link>
            <span className="h-3.5 w-px bg-ink-line" aria-hidden="true" />
            {asset.score === null ? (
              <span className="italic">Not enough ratings</span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <FontAwesomeIcon icon={faThumbsUp} className="text-space-bright" />
                <span className="font-bold text-white">{asset.score}%</span>
                <span>({formatCount(asset.votes)} {asset.votes === 1 ? 'vote' : 'votes'})</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <FontAwesomeIcon icon={faComment} />
              {formatCount(asset.review_count)} {asset.review_count === 1 ? 'review' : 'reviews'}
            </span>
            <span className="font-mono text-link">{contentTag(asset.kind, asset.content_id)}</span>
            <span>{formatCount(asset.download_count)} uses</span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="w-56">
            <UsePanel asset={asset} onChanged={item.reload} />
          </div>
          <Menu
            label="More"
            align="right"
            trigger={
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink-card text-white/70 transition-colors hover:bg-ink-hover hover:text-white">
                <FontAwesomeIcon icon={faEllipsis} />
              </span>
            }
            items={[
              {
                label: 'Copy link',
                icon: faLink,
                onSelect: () => {
                  void navigator.clipboard?.writeText(window.location.href)
                  toast('Link copied.', 'success')
                },
              },
              ...(asset.i_can_use && !mine
                ? [{
                    label: 'Remove from my inventory',
                    icon: faBoxOpen,
                    danger: true,
                    onSelect: () => setDropping(true),
                  }]
                : []),
              ...(mine
                ? [
                    { label: 'Edit details', icon: faPen, onSelect: () => setEditing(true) },
                    {
                      label: asset.is_public ? 'Take out of Create' : 'List in Create again',
                      icon: asset.is_public ? faLock : faLockOpen,
                      onSelect: () => setListed(!asset.is_public),
                    },
                    {
                      label: 'Delete',
                      icon: faTrash,
                      danger: true,
                      onSelect: () => setDeleting(true),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      </header>

      {/* Deleting is asked about, and when it cannot go the reason is shown
          here rather than disappearing into the console. */}
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${asset.name}?`}
        description="This takes the file away as well. Anything already using it stops working, and the number is not given out again."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>Keep it</Button>
            <Button
              variant="danger"
              loading={erasing}
              onClick={async () => {
                setErasing(true)
                try {
                  await deleteAsset(asset.id)
                  toast('Deleted.', 'success')
                  setDeleting(false)
                  navigate('/create/uploads')
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'That could not be deleted.', 'error')
                } finally {
                  setErasing(false)
                }
              }}
            >
              Delete it
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          If an ad of yours is using this, take that ad out of its campaign first: it would be
          left pointing at nothing otherwise.
        </p>
      </Dialog>

      <Dialog
        open={dropping}
        onClose={() => setDropping(false)}
        title="Remove this from your inventory?"
        description={
          asset.price > 0
            ? `You paid ${currency.amount(asset.price)} for this. Removing it does not refund them, and taking it again would cost the same.`
            : 'Any World already using it keeps working. You would have to take it again to use it somewhere new.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDropping(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await dropFromInventory(asset.id)
                  toast('Out of your inventory.', 'info')
                  setDropping(false)
                  item.reload()
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'That did not work.', 'error')
                }
              }}
            >
              Remove it
            </Button>
          </>
        }
      />

      {mine && asset.status !== 'approved' && (
        <p className={cn(
          'flex items-start gap-2 rounded-xl px-4 py-3 text-sm',
          asset.status === 'pending'
            ? 'bg-amber-400/10 text-amber-200'
            : 'bg-danger/10 text-danger',
        )}>
          <FontAwesomeIcon
            icon={asset.status === 'pending' ? faClock : faTriangleExclamation}
            className="mt-0.5"
          />
          {asset.status === 'pending'
            ? 'In review. Nobody else can see it until it passes.'
            : asset.review_note ?? 'This was turned down.'}
        </p>
      )}

      {/* The thing on the left, what there is to say about it on the right.
          A clip is given more of the width, because a player squeezed into a
          column is no use to anybody. */}
      <div className={cn(
        'grid gap-6 sm:items-start',
        asset.kind === 'video'
          ? 'lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'
          : asset.kind === 'audio'
            // A cover is a cover: big enough to see, not a wall.
            ? 'sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]'
            : 'sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]',
      )}>
        <div className="space-y-3">
          <Stage key={asset.id} asset={asset} previewUrl={previewUrl} fileUrl={fileUrl} />

          <Link
            to={`/create/creator/${asset.creator_username}`}
            className="flex items-center gap-2 text-sm font-bold hover:text-link"
          >
            <Avatar
              src={avatarOf({ avatar_url: asset.creator_avatar_url })}
              name={asset.creator_display_name}
              size="xs"
            />
            <span className="truncate">{asset.creator_display_name}</span>
          </Link>
        </div>

        <div className="min-w-0 space-y-5">
          {asset.kind === 'audio' && <MediaPlayer src={fileUrl} kind="audio" />}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Type', value: kindLabels[asset.kind] },
              { label: 'Created', value: stamp(asset.created_at) },
              { label: 'Updated', value: stamp(asset.updated_at) },
              { label: 'Size', value: sizeText },
              {
                label: 'Price',
                value: asset.price > 0
                  ? <span className="inline-flex items-center gap-1.5"><CurrencyMark />{formatCount(asset.price)}</span>
                  : 'Free',
              },
            ].map((fact) => (
              <div key={fact.label}>
                <p className="text-xs text-muted">{fact.label}</p>
                <p className="text-sm font-bold">{fact.value}</p>
              </div>
            ))}
          </div>

          <div>
            <Tabs
              look="line"
              label="What to read about this"
              value={panel}
              onChange={setPanel}
              options={[
                { value: 'Description' as const, label: 'Description' },
                { value: 'Reviews' as const, label: 'Reviews', count: asset.review_count || null },
                ...(mine ? [{ value: 'Numbers' as const, label: 'Numbers' }] : []),
              ]}
            />

            {panel === 'Description' && (
              <div className="pt-4">
                {editing ? (
                  <div className="space-y-3">
                    <Textarea
                      label="Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={400}
                    />
                    <Input
                      label={`Price ${currency.inWord}`}
                      type="number"
                      min={0}
                      max={priceCeilings[asset.kind]}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      icon={faTag}
                      hint={`0 means free. The most you can charge for ${kindLabels[asset.kind].toLowerCase()} is ${currency.amount(priceCeilings[asset.kind])}.`}
                      className="max-w-xs"
                    />

                    {/* What it costs to sell, said before it is agreed to. */}
                    {(() => {
                      const asked = Math.max(0, Math.round(Number(price) || 0))
                      if (asked === asset.price) return null

                      if (asked > 0) {
                        const fee = listingFee(asked)
                        const keeps = asked - Math.round((asked * PLATFORM_SHARE) / 100)
                        return (
                          <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-muted">
                            Putting this up for sale costs <span className="font-bold text-white">{fee}</span>{' '}
                            {currency.plural}, paid to Kobblon now. Taking it back off sale later hands a
                            quarter of that back. On each sale you keep{' '}
                            <span className="font-bold text-white">{keeps}</span> of the{' '}
                            {asked}; the other {PLATFORM_SHARE}% is Kobblon&rsquo;s share.
                          </p>
                        )
                      }

                      return (
                        <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-muted">
                          Taking it off sale hands back a quarter of what putting it up cost.
                          Anybody who has already bought it keeps it.
                        </p>
                      )
                    })()}
                    <div className="flex gap-2">
                      <Button variant="yes" loading={pending} onClick={save}>Save</Button>
                      <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                    <p className="text-xs text-muted">
                      A new name goes back through the same check the upload went through.
                    </p>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                    {asset.description || 'No description.'}
                  </p>
                )}
              </div>
            )}


            {panel === 'Reviews' && (
              <div className="space-y-5 pt-4">
                {!mine && (
                  <ReviewBox
                    asset={asset}
                    onDone={() => { item.reload(); reviews.reload() }}
                  />
                )}

                {reviews.loading && <Skeleton className="h-20" />}

                {!reviews.loading && !reviews.data?.length && (
                  <p className="text-sm text-muted">
                    No reviews yet.{mine ? '' : ' Say what you made with it.'}
                  </p>
                )}

                <ul className="space-y-4">
                  {reviews.data?.map((review) => (
                    <li key={review.id} className="flex gap-3">
                      <Avatar src={avatarOf(review)} name={review.display_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <Link to={`/u/${review.username}`} className="font-bold hover:underline">
                            {review.display_name}
                          </Link>
                          {review.up !== null && (
                            <FontAwesomeIcon
                              icon={review.up ? faThumbsUp : faThumbsDown}
                              className={cn('text-xs', review.up ? 'text-space-bright' : 'text-white/40')}
                            />
                          )}
                          <span className="text-xs text-muted">{timeAgo(review.created_at)}</span>
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                          {review.body}
                        </p>
                      </div>
                      {(mine || review.user_id === profile?.id) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={faTrash}
                          aria-label={`Remove the review by ${review.display_name}`}
                          onClick={async () => {
                            await removeAssetReview(review.id)
                            item.reload()
                            reviews.reload()
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {panel === 'Numbers' && (
              <div className="pt-4">
                {stats.loading ? <Skeleton className="h-32" /> : <UseChart days={stats.data ?? []} />}
                <p className="mt-3 text-xs text-muted">
                  Views and uses over the last 30 days, counted as they happen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {!!more.data?.length && (
        <section>
          {/* Their work first, then things like this one: the same kind,
              called something similar, put up around the same time. */}
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-extrabold">
            More from {asset.creator_display_name}, and more like this
            <Link
              to={`/create/creator/${asset.creator_username}`}
              aria-label={`Everything by ${asset.creator_display_name}`}
              className="text-sm text-white/40 transition-colors hover:text-white"
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </Link>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
            {more.data.map((other) => <AssetTile key={other.id} item={other} />)}
          </div>
        </section>
      )}
    </div>
  )
}

/** Your thumb and your words about somebody else's work. */
function ReviewBox({ asset, onDone }: { asset: AssetPageItem; onDone: () => void }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)

  const vote = async (up: boolean) => {
    try {
      await rateAsset(asset.id, asset.my_vote === up ? null : up)
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    }
  }

  if (!profile || profile.is_guest) {
    return <p className="text-sm text-muted">Sign in to rate this or leave a review.</p>
  }

  /*
   * A rating from somebody who has never had the thing says nothing about
   * it, so it has to be in your inventory first. Taking a free one costs
   * nothing but the press.
   */
  if (!asset.i_can_use) {
    return (
      <p className="rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm text-muted">
        {asset.price > 0
          ? 'Buy it to rate it or write a review.'
          : 'Take it to rate it or write a review. It is free.'}
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-ink-line bg-ink-raised p-4">
      <div className="flex items-center gap-2">
        {[true, false].map((up) => (
          <button
            key={String(up)}
            onClick={() => vote(up)}
            aria-pressed={asset.my_vote === up}
            aria-label={up ? 'Rate this up' : 'Rate this down'}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-bold transition-colors',
              asset.my_vote === up
                ? up ? 'bg-space text-white' : 'bg-ink-hover text-white'
                : 'bg-ink-card text-white/60 hover:bg-ink-hover hover:text-white',
            )}
          >
            <FontAwesomeIcon icon={up ? faThumbsUp : faThumbsDown} />
            {up ? 'Good' : 'Not for me'}
          </button>
        ))}
      </div>

      <Textarea
        label="Review"
        labelNote="optional"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={600}
        placeholder="What did you build with it?"
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          loading={pending}
          disabled={!body.trim()}
          onClick={async () => {
            setPending(true)
            try {
              await writeAssetReview(asset.id, body)
              setBody('')
              toast('Posted.', 'success')
              onDone()
            } catch (err) {
              toast(err instanceof Error ? err.message : 'That did not post.', 'error')
            } finally {
              setPending(false)
            }
          }}
        >
          Post review
        </Button>
      </div>
    </div>
  )
}
