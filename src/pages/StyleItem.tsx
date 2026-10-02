import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck, faFlag, faShirt, faUser, faEyeSlash, faArrowsUpDownLeftRight, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { BackLink } from '@/components/ui/BackLink'
import { Button } from '@/components/ui/Button'
import { BuyButton } from '@/components/money/BuyButton'
import { Card } from '@/components/ui/Card'
import { Choices } from '@/components/ui/Choices'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { useToast } from '@/components/ui/Toast'
import { Confirm } from '@/components/ui/Confirm'
import { Price } from '@/components/brand/Currency'
import { Verified } from '@/components/brand/Verified'
import { Avatar } from '@/components/ui/Avatar'
import { FaceStage } from '@/components/style/FaceStage'
import { ReportDialog } from '@/components/social/ReportDialog'
import { StyleRow } from '@/components/style/StyleRow'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, useSocialCard } from '@/hooks/useTitle'
import {
  asWorn, buyStyleItem, retireStyleItem, similarStyle, styleImage, styleItem, styleTag,
  wearStyleItem,
} from '@/lib/api'
import type { StyleItem as Item } from '@/lib/api'
import { avatarOf, defaultAvatars } from '@/lib/avatars'
import { formatCount } from '@/lib/format'

const slotWords: Record<Item['slot'], string> = {
  hat: 'Hat', hair: 'Hair', face: 'Face', accessory: 'Accessory', frame: 'Frame',
}

const stamp = (iso?: string) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  : '')

/** One line of the facts table, which is where a page like this earns trust. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-ink-line py-2.5 last:border-0">
      <dt className="w-28 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-semibold">{children}</dd>
    </div>
  )
}

export default function StyleItemPage() {
  const { tag = '' } = useParams()
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()

  const number = useMemo(() => Number(tag.replace(/^STY-/i, '')), [tag])

  const item = useAsync(
    async () => (Number.isFinite(number) ? styleItem(number) : null),
    [number],
  )
  const thing = item.data
  const more = useAsync(
    async () => (thing ? similarStyle(thing.id, 12) : []),
    [thing?.id],
  )

  const [onMe, setOnMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [retiring, setRetiring] = useState(false)

  useTitle(thing?.name ?? 'Style')
  useSocialCard({
    title: thing ? `${thing.name} - Kobblon Style` : null,
    description: thing
      ? `${slotWords[thing.slot]} by @${thing.creator_username} on Kobblon.`
        + (thing.description ? ` ${thing.description}` : '')
      : null,
    image: thing ? styleImage(thing.image_path) : null,
  })

  if (item.loading) {
    return (
      <Page className="space-y-4">
        <Skeleton className="h-[26rem] w-full rounded-3xl" />
      </Page>
    )
  }

  if (item.error) {
    return <Page><ErrorState message={item.error} onRetry={item.reload} /></Page>
  }

  if (!thing) {
    return (
      <Page>
        <Card>
          <EmptyState
            mood="noResults"
            title="Nothing to wear here"
            body={`There is no ${tag} in the shop.`}
            action={<Button to="/style">Open the shop</Button>}
          />
        </Card>
      </Page>
    )
  }

  const face = onMe ? avatarOf(profile) : defaultAvatars[(thing.content_id ?? 0) % 8]
  const worn = [asWorn(thing)]

  const get = async () => {
    setBusy(true)
    try {
      await buyStyleItem(thing.id)
      toast(thing.price > 0 ? `Bought ${thing.name}.` : `${thing.name} is yours.`, 'success')
      await refreshProfile()
      item.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const wear = async () => {
    setBusy(true)
    try {
      await wearStyleItem(thing.id, !thing.worn)
      await refreshProfile()
      item.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page className="space-y-6">
      <BackLink to="/style">Back to the shop</BackLink>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* --------------------------------------------------------- stage */}
        <div className="space-y-3">
          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-3xl border border-ink-line bg-ink-raised p-10">
            <FaceStage
              src={face}
              name={profile?.display_name ?? 'Kobblon'}
              items={worn}
              className="w-full max-w-[16rem]"
            />

            <Choices
              size="sm"
              className="absolute bottom-3 right-3 rounded-xl bg-ink-card/85 p-1 backdrop-blur"
              label="Whose face to try it on"
              value={onMe ? 'me' : 'face'}
              options={[
                { value: 'me', label: 'On you' },
                { value: 'face', label: 'On a face' },
              ]}
              onChange={(next) => setOnMe(next === 'me')}
            />
          </div>

          <div className="flex items-center gap-4 px-1">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <FontAwesomeIcon icon={faUser} />
              {formatCount(thing.owners ?? 0)} {thing.owners === 1 ? 'owner' : 'owners'}
            </span>
            {!thing.mine && (
              <button
                onClick={() => setReporting(true)}
                className="ml-auto flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
              >
                <FontAwesomeIcon icon={faFlag} />
                Report
              </button>
            )}
          </div>
        </div>

        {/* --------------------------------------------------------- facts */}
        <div className="min-w-0 space-y-5">
          <div>
            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              {thing.name}
            </h1>
            <Link
              to={`/u/${thing.creator_username}`}
              className="mt-2 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-white"
            >
              By
              <Avatar
                src={thing.creator_avatar ?? null}
                name={thing.creator_name ?? '?'}
                size="xs"
              />
              <span className="font-bold text-white">{thing.creator_name}</span>
              {thing.creator_is_verified && <Verified className="text-[11px]" />}
            </Link>
          </div>

          <div className="rounded-2xl border border-ink-line bg-ink-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Price
                amount={thing.price}
                className="font-display text-2xl font-extrabold"
                markClassName="h-5 w-5"
              />

              <div className="flex flex-wrap gap-2">
                {thing.owned ? (
                  <Button
                    icon={thing.worn ? faCheck : faShirt}
                    variant={thing.worn ? 'primary' : 'subtle'}
                    disabled={busy}
                    onClick={wear}
                  >
                    {thing.worn ? 'Worn' : 'Wear it'}
                  </Button>
                ) : (
                  <GuestGate action="buy things">
                    <BuyButton price={thing.price} disabled={busy} onClick={get} />
                  </GuestGate>
                )}

                {thing.mine && thing.is_public && (
                  <Button variant="ghost" icon={faEyeSlash} onClick={() => setRetiring(true)}>
                    Take down
                  </Button>
                )}
              </div>
            </div>

            {thing.owned && !thing.worn && (
              <p className="mt-3 text-xs text-muted">
                You have this. Putting it on replaces whatever {slotWords[thing.slot].toLowerCase()}
                {' '}you are wearing.
              </p>
            )}
          </div>

          <dl className="rounded-2xl border border-ink-line bg-ink-card px-4 py-1">
            <Fact label="Kind">{slotWords[thing.slot]}</Fact>
            <Fact label="Sits">
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faLayerGroup} className="text-muted" />
                {thing.layer === 0 ? 'Behind your picture' : 'In front of your picture'}
              </span>
            </Fact>
            <Fact label="Size">
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faArrowsUpDownLeftRight} className="text-muted" />
                {Math.round(thing.width * 100)}% of the picture
              </span>
            </Fact>
            <Fact label="Number">{styleTag(thing.content_id)}</Fact>
            <Fact label="Made">{stamp(thing.created_at)}</Fact>
            <Fact label="What it is">
              {thing.description || <span className="text-muted">Nothing written.</span>}
            </Fact>
          </dl>
        </div>
      </div>

      {/* --------------------------------------------------------- more */}
      {!!more.data?.length && (
        <section className="rounded-3xl border border-ink-line bg-ink-card p-4 sm:p-5">
          <h2 className="mb-3 font-display text-xl font-extrabold">More like this</h2>
          <StyleRow items={more.data} face={avatarOf(profile)} name={profile?.display_name ?? 'You'} />
        </section>
      )}

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="style"
        targetId={thing.id}
        targetName={thing.name}
      />

      <Confirm
        open={retiring}
        onClose={() => setRetiring(false)}
        onConfirm={async () => {
          try {
            await retireStyleItem(thing.id)
            toast(`${thing.name} is out of the shop.`, 'success')
            item.reload()
          } catch (err) {
            toast(err instanceof Error ? err.message : 'That did not work.', 'error')
          }
        }}
        title={`Take ${thing.name} down?`}
        lead="It leaves the shop, and nobody new can get it."
        points={[
          'Everybody who already has it keeps it, and keeps wearing it.',
          'You can put it back up later.',
        ]}
        confirmText="Take it down"
        icon={faEyeSlash}
      />
    </Page>
  )
}
