/*
 * The Catalog: everything you can put on an avatar.
 *
 * Kept apart from the Creator Marketplace on purpose, and the difference is
 * not cosmetic. A thing in the Marketplace is a file somebody uses to build
 * a World; a thing here is a thing you wear. They have different makers,
 * different prices and different rules about who may make one, and a single
 * shop selling both would be a filter nobody can name.
 */
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShirt, faMagnifyingGlass, faUser, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BuyButton } from '@/components/money/BuyButton'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { Verified, isVerified } from '@/components/brand/Verified'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { avatarShelf, buyAvatarItem, wearAvatarItem, catalogUrl } from '@/lib/api'
import type { AvatarItem, AvatarKind } from '@/types/db'
import { cn } from '@/lib/cn'

const SHELVES = [
  { value: 'all', label: 'Everything' },
  { value: 'shirt', label: 'Shirts' },
  { value: 'trousers', label: 'Trousers' },
  { value: 'tdecal', label: 'T-decals' },
  { value: 'accessory', label: 'Accessories' },
  { value: 'hair', label: 'Hair' },
  { value: 'face', label: 'Faces' },
] as const

export default function Catalog() {
  useTitle('Catalog')
  const { profile } = useAuth()
  const say = useToast()

  const [shelf, setShelf] = useState<string>('all')
  const [term, setTerm] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const things = useAsync(
    async () => avatarShelf(shelf === 'all' ? null : (shelf as AvatarKind), term),
    [shelf, term],
  )

  /*
   * Taking something puts it on straight away. Buying a hat and then being
   * sent somewhere else to wear it is two steps for one thought - and the
   * avatar page is where it goes if somebody changes their mind.
   */
  const take = async (item: AvatarItem) => {
    setBusy(item.id)
    try {
      if (!item.owned) await buyAvatarItem(item.id)
      await wearAvatarItem(item.id)
      say(item.price > 0 && !item.owned ? `Bought. ${item.name} is on.` : `${item.name} is on.`, 'success')
      things.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Page className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Catalog</h1>
          <p className="text-sm text-muted">Everything you can put on an avatar.</p>
        </div>
        <div className="flex gap-2">
          {profile && <Button to="/avatar" variant="subtle" icon={faUser}>My Avatar</Button>}
          {profile && <Button to="/create/avatar" icon={faPlus}>Make one</Button>}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={shelf}
          onChange={setShelf}
          options={SHELVES.map((one) => ({ value: one.value, label: one.label }))}
        />
        <Input
          className="max-w-xs"
          placeholder="Name"
          icon={faMagnifyingGlass}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {things.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : things.error ? (
        <ErrorState message={things.error} onRetry={things.reload} />
      ) : (things.data ?? []).length === 0 ? (
        <EmptyState
          mood="noResults"
          title="Nothing on this shelf yet"
          body={term ? 'Nothing by that name.' : 'Be the first to put something here.'}
          action={profile ? <Button to="/create/avatar" icon={faPlus}>Make one</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(things.data ?? []).map((item) => (
            <ShelfCard
              key={item.id}
              item={item}
              busy={busy === item.id}
              canTake={!!profile && !profile.is_guest}
              onTake={() => void take(item)}
            />
          ))}
        </div>
      )}
    </Page>
  )
}

function ShelfCard({ item, busy, canTake, onTake }: {
  item: AvatarItem
  busy: boolean
  canTake: boolean
  onTake: () => void
}) {
  const picture = catalogUrl(item.image_path)
  return (
    <div className="relative">
      {!item.price && <FreeCorner />}
      <div className={cn(
        'overflow-hidden rounded-xl border border-ink-line bg-ink-card',
        'transition-colors hover:border-brand/60',
      )}>
        <div className="grid aspect-square place-items-center overflow-hidden bg-media">
          {picture ? (
            <img
              src={picture}
              alt=""
              loading="lazy"
              draggable={false}
              className="h-full w-full select-none object-contain"
            />
          ) : (
            <FontAwesomeIcon icon={faShirt} className="text-3xl text-white/30" />
          )}
        </div>
        <div className="space-y-2 p-3">
          <h3 className="truncate text-sm font-bold">{item.name}</h3>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="truncate">{item.creator_display_name}</span>
            {isVerified({ is_verified: item.creator_is_verified }) && (
              <Verified className="text-[10px]" />
            )}
          </span>
          <BuyButton
            block
            size="sm"
            price={item.price}
            owned={item.owned}
            ownedLabel="Wear it"
            freeLabel="Take it"
            loading={busy}
            disabled={!canTake}
            onClick={onTake}
          />
        </div>
      </div>
    </div>
  )
}
