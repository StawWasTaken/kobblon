/*
 * The Catalog: everything you can put on an avatar.
 *
 * Kept apart from the Creator Marketplace on purpose, and the difference is
 * not cosmetic. A thing in the Marketplace is a file somebody uses to build
 * a World; a thing here is a thing you wear. They have different makers,
 * different prices and different rules about who may make one, and a single
 * shop selling both would be a filter nobody can name.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faMagnifyingGlass, faUser, faPlus, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { Select } from '@/components/ui/Select'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BuyButton } from '@/components/money/BuyButton'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { Verified, isVerified } from '@/components/brand/Verified'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { avatarShelf, buyAvatarItem, wearAvatarItem, cardFor } from '@/lib/api'
import type { ShelfOrder } from '@/lib/api'
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

  /*
   * The term comes from the address, so the search box in the top bar lands
   * here with something already in it - and so a Catalog search is a link
   * somebody can send. Typing in the box on this page writes the address
   * back, which is what makes the back button work through a search.
   */
  const [params, setParams] = useSearchParams()
  const [shelf, setShelf] = useState<string>('all')
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [maker, setMaker] = useState('')
  const [makerDraft, setMakerDraft] = useState('')
  const [order, setOrder] = useState<ShelfOrder>('newest')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { setTerm(params.get('q') ?? '') }, [params])

  const settle = (next: string) => {
    setTerm(next)
    const now = new URLSearchParams(params)
    if (next.trim()) now.set('q', next.trim())
    else now.delete('q')
    setParams(now, { replace: true })
  }

  const by = maker.trim() || null

  const things = useAsync(
    async () => avatarShelf(
      shelf === 'all' ? null : (shelf as AvatarKind), term, 60, by, order,
    ),
    [shelf, term, by, order],
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
      <PageHeader
        title="Catalog"
        lead="Everything you can put on an avatar."
        icon={faShirt}
        actions={profile ? (
          <>
            <Button to="/avatar" variant="subtle" icon={faUser}>My Avatar</Button>
            <Button to="/create/avatar" icon={faPlus}>Make one</Button>
          </>
        ) : undefined}
      />

      {/* ------------------------------------------- who made it, and in what order */}
      <div className="space-y-3 rounded-2xl border border-ink-line bg-ink-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Made by</span>

          <button
            type="button"
            onClick={() => { setMaker(''); setMakerDraft('') }}
            aria-pressed={!maker}
            className={cn(
              'h-8 rounded-lg px-3 text-xs font-bold transition-colors',
              !maker ? 'bg-brand text-onbrand' : 'bg-ink-hover text-white/65 hover:text-white',
            )}
          >
            Anybody
          </button>

          <button
            type="button"
            onClick={() => { setMaker('kobblon'); setMakerDraft('kobblon') }}
            aria-pressed={maker.toLowerCase() === 'kobblon'}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors',
              maker.toLowerCase() === 'kobblon'
                ? 'bg-brand text-onbrand'
                : 'bg-ink-hover text-white/65 hover:text-white',
            )}
          >
            <FontAwesomeIcon icon={faCircleCheck} className="text-[#4d68ff]" />
            Kobblon
          </button>

          <form
            onSubmit={(e) => { e.preventDefault(); setMaker(makerDraft.trim()) }}
            className="flex items-center gap-1.5"
          >
            <span className="text-xs text-muted">@</span>
            <input
              value={makerDraft}
              onChange={(e) => setMakerDraft(e.target.value)}
              onBlur={() => setMaker(makerDraft.trim())}
              placeholder="somebody"
              aria-label="Made by which person"
              className="h-8 w-32 rounded-lg border border-ink-line bg-ink-raised px-2.5 text-xs font-semibold placeholder:text-white/30 focus:border-brand-bright focus:outline-none"
            />
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs flex-1"
            placeholder="Name"
            icon={faMagnifyingGlass}
            value={term}
            onChange={(e) => settle(e.target.value)}
          />
          {/*
            * The site's own Select, not a bare one. There is a dropdown in
            * `@/components/ui` that every other shelf on Kobblon uses, and a
            * browser's own select next to it is the thing that makes a page
            * look like it was built by somebody else.
            *
            * No "best rated" in it: nothing rates an avatar item yet, and a
            * sort that quietly falls back to something else is worse than
            * one that is not offered, because it looks like it worked.
            */}
          <Select
            label="Order"
            value={order}
            onChange={(next) => setOrder(next as ShelfOrder)}
            className="w-40"
            align="right"
            options={[
              { value: 'newest', label: 'Newest' },
              { value: 'oldest', label: 'Oldest' },
              { value: 'taken', label: 'Most taken' },
              { value: 'cheapest', label: 'Cheapest' },
              { value: 'dearest', label: 'Dearest' },
            ]}
          />
        </div>
      </div>

      <Tabs
        value={shelf}
        onChange={setShelf}
        options={SHELVES.map((one) => ({ value: one.value, label: one.label }))}
      />

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
  const picture = cardFor(item)
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
