/*
 * The shop, as a thing that can be mounted anywhere.
 *
 * It was a page. Staw's call, after looking at how the Roblox app does it:
 * buying something and putting it on are the same activity, and having them
 * on two pages means each one shows you half of it - you choose a shirt
 * without seeing yourself, then go somewhere else to find out how it looks.
 *
 * So the shelf is a component and the avatar page mounts it beside the body.
 * `/catalog` still exists and still works; it lands on the same shelf with
 * the Marketplace half showing.
 */
/*
 * The Catalog: everything you can put on an avatar.
 *
 * Kept apart from the Creator Marketplace on purpose, and the difference is
 * not cosmetic. A thing in the Marketplace is a file somebody uses to build
 * a World; a thing here is a thing you wear. They have different makers,
 * different prices and different rules about who may make one, and a single
 * shop selling both would be a filter nobody can name.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faMagnifyingGlass, faPlus, faCircleCheck, faClock,
  faBasketShopping, faCheck, faStar, faSliders,
  faTag,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { Choices } from '@/components/ui/Choices'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BuyButton } from '@/components/money/BuyButton'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { Verified, isVerified } from '@/components/brand/Verified'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import {
  avatarShelf, buyAvatarItem, buyAvatarItems, wearAvatarItem, cardFor,
  myFavouriteAvatarItems,
  saleNow, priceNow, type CatalogSale,
} from '@/lib/api'
import { useBasket, putInBasket, takeOutOfBasket, emptyBasket } from '@/hooks/useBasket'
import { BasketDialog } from '@/components/catalog/BasketDialog'
import type { ShelfOrder } from '@/lib/api'
import { avatarTag } from '@/lib/kinds'
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

export function CatalogShelf({ onTook, compact }: {
  /** Told when something is bought or worn, so a page beside it can refresh. */
  onTook?: () => void
  /** Fewer columns, for the narrow half of the avatar page. */
  compact?: boolean
}) {
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
  /*
   * The narrowing beyond a name, folded away until somebody asks for it.
   * Four controls on a shelf that most people scroll is four controls in
   * the way; behind a press they are there for the person who came looking
   * for a hat under forty Brix.
   */
  const [showFilters, setShowFilters] = useState(false)
  const [least, setLeast] = useState('')
  const [most, setMost] = useState('')
  const [onlyLimited, setOnlyLimited] = useState(false)
  const [onlyFree, setOnlyFree] = useState(false)
  /** The favourites shelf is a different question, so it is a different read. */
  const [starredOnly, setStarredOnly] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const basket = useBasket()
  const [showBasket, setShowBasket] = useState(false)
  const [paying, setPaying] = useState(false)

  useEffect(() => { setTerm(params.get('q') ?? '') }, [params])

  const settle = (next: string) => {
    setTerm(next)
    const now = new URLSearchParams(params)
    if (next.trim()) now.set('q', next.trim())
    else now.delete('q')
    setParams(now, { replace: true })
  }

  const by = maker.trim() || null

  const filters = useMemo(() => ({
    least: least.trim() === '' ? null : Math.max(0, Number(least) || 0),
    most: most.trim() === '' ? null : Math.max(0, Number(most) || 0),
    onlyLimited,
    onlyFree,
  }), [least, most, onlyLimited, onlyFree])

  const narrowed = !!filters.least || !!filters.most || onlyLimited || onlyFree

  /*
   * Whatever sale is on, asked once for the whole shelf rather than per card.
   * Every card shows what it will actually charge, which is the only thing a
   * price on a shelf is for.
   */
  const sale = useAsync(async () => saleNow(), [])

  const things = useAsync(
    async () => (starredOnly
      ? myFavouriteAvatarItems()
      : avatarShelf(
        shelf === 'all' ? null : (shelf as AvatarKind), term, 60, by, order, filters,
      )),
    [shelf, term, by, order, filters, starredOnly],
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
      onTook?.()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      {/*
        * A sale says so, at the top, with when it ends.
        *
        * Said once here rather than on every card: a card shows the price it
        * will charge, and this says why that price is what it is. Without a
        * line like this a sale is a shop whose prices quietly changed.
        */}
      {sale.data && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-space/40 bg-space/10 px-3.5 py-2.5 text-sm">
          <FontAwesomeIcon icon={faTag} className="text-space-bright" />
          <span className="font-bold text-space-bright">
            {sale.data.percent_off}% off the Catalog
          </span>
          <span className="text-muted">
            until {new Date(sale.data.ends_at).toLocaleString(undefined, {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
            . Limiteds keep their price.
          </span>
          {sale.data.note && <span className="text-white/70">{sale.data.note}</span>}
        </p>
      )}

      {/*
        * The basket and the favourites, where somebody looks for them:
        * beside the shop rather than behind a page header, because both are
        * things you collect while shopping and want back without leaving.
        */}
      {profile && !profile.is_guest && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={starredOnly ? 'primary' : 'subtle'}
            icon={faStar}
            onClick={() => setStarredOnly(!starredOnly)}
            aria-pressed={starredOnly}
          >
            Favourites
          </Button>
          <Button
            variant="subtle"
            icon={faBasketShopping}
            onClick={() => setShowBasket(true)}
          >
            Basket{basket.length ? ` (${basket.length})` : ''}
          </Button>
          {starredOnly && (
            <span className="text-xs text-muted">
              Showing what you have starred.
            </span>
          )}
        </div>
      )}

      {/* ------------------------------------------- who made it, and in what order */}
      <div className={cn(
        'space-y-3 rounded-2xl border border-ink-line bg-ink-card p-4',
        starredOnly && 'pointer-events-none opacity-40',
      )}>
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

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors',
              narrowed || showFilters
                ? 'border-brand bg-brand/15 text-white'
                : 'border-ink-line text-white/65 hover:text-white',
            )}
          >
            <FontAwesomeIcon icon={faSliders} />
            More
            {narrowed && <span className="text-brand-bright">•</span>}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 border-t border-ink-line pt-3">
            {/*
              * Sized by a wrapper, not by a class on the Input.
              *
              * `cn` joins and does not merge, so `w-28` next to the field's
              * own `w-full` is decided by which lands later in the
              * stylesheet - and `w-full` won, which is why these two were
              * the width of the card. The same trap that is written down in
              * CLAUDE.md, in code written after reading it.
              */}
            <div className="w-28">
              <Input
                label="At least"
                labelNote="Brix"
                type="number"
                min={0}
                value={least}
                onChange={(e) => setLeast(e.target.value)}
              />
            </div>
            <div className="w-28">
              <Input
                label="At most"
                labelNote="Brix"
                type="number"
                min={0}
                value={most}
                onChange={(e) => setMost(e.target.value)}
              />
            </div>
            <Choices
              label="Narrow it"
              size="sm"
              tone="soft"
              value={onlyFree ? 'free' : onlyLimited ? 'limited' : 'any'}
              onChange={(next) => {
                setOnlyFree(next === 'free')
                setOnlyLimited(next === 'limited')
              }}
              options={[
                { value: 'any', label: 'Anything' },
                { value: 'free', label: 'Free only' },
                { value: 'limited', label: 'Limiteds only', icon: faClock },
              ]}
            />
            {narrowed && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLeast(''); setMost(''); setOnlyFree(false); setOnlyLimited(false)
                }}
              >
                Clear
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs
        value={shelf}
        onChange={setShelf}
        options={SHELVES.map((one) => ({ value: one.value, label: one.label }))}
      />

      {things.loading ? (
        <div className={cn("grid gap-4", compact
            ? "grid-cols-2 xl:grid-cols-3"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
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
        <div className={cn("grid gap-4", compact
            ? "grid-cols-2 xl:grid-cols-3"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
          {(things.data ?? []).map((item) => (
            <ShelfCard
              key={item.id}
              item={item}
              busy={busy === item.id}
              canTake={!!profile && !profile.is_guest}
              inBasket={basket.some((one) => one.id === item.id)}
              onTake={() => void take(item)}
              sale={sale.data ?? null}
            />
          ))}
        </div>
      )}

      <BasketDialog
        open={showBasket}
        onClose={() => setShowBasket(false)}
        lines={basket}
        paying={paying}
        onBuy={() => void (async () => {
          setPaying(true)
          try {
            const got = await buyAvatarItems(basket.map((one) => one.id))
            emptyBasket()
            setShowBasket(false)
            say(got === 1 ? 'Bought. It is yours.' : `Bought all ${got}.`, 'success')
            things.reload()
            onTook?.()
          } catch (error) {
            say(error instanceof Error ? error.message : 'That did not work.', 'error')
          } finally {
            setPaying(false)
          }
        })()}
      />
    </div>
  )
}

function ShelfCard({ item, busy, canTake, inBasket, onTake, sale }: {
  item: AvatarItem
  busy: boolean
  canTake: boolean
  /** Already put aside, so the control says "in your basket" and undoes it. */
  inBasket: boolean
  onTake: () => void
  /** Whatever sale is on, so a card says the price it will charge. */
  sale: CatalogSale | null
}) {
  const picture = cardFor(item)
  const costs = priceNow(item, sale)
  const closed = !!item.sells_until
    && new Date(item.sells_until).getTime() <= Date.now()

  return (
    <div className="relative">
      {!item.price && <FreeCorner />}
      <div className={cn(
        'overflow-hidden rounded-xl border border-ink-line bg-ink-card',
        'transition-colors hover:border-brand/60',
      )}>
        {/*
          * The picture and the name open the item's page; the buy button
          * stays a button. A card where everything is a link is a card where
          * buying something is one slip away.
          */}
        <Link
          to={`/catalog/${avatarTag(item.kind, item.content_id)}`}
          draggable={false}
          className="relative grid aspect-square place-items-center overflow-hidden bg-media">
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

          {/* Down in the corner, which is where Staw asked for it. */}
          {item.sells_until && (
            <span className={cn(
              'absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5',
              'text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm',
              closed ? 'bg-ink/85 text-white/60' : 'bg-amber-400/90 text-ink',
            )}>
              <FontAwesomeIcon icon={faClock} />
              {closed ? 'Closed' : 'Limited'}
            </span>
          )}
        </Link>
        <div className="space-y-2 p-3">
          <h3 className="truncate text-sm font-bold">
            <Link
              to={`/catalog/${avatarTag(item.kind, item.content_id)}`}
              className="transition-colors hover:text-link"
            >
              {item.name}
            </Link>
          </h3>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="truncate">{item.creator_display_name}</span>
            {isVerified({ is_verified: item.creator_is_verified }) && (
              <Verified className="text-[10px]" />
            )}
          </span>
          {closed && !item.owned ? (
            <Button block size="sm" disabled>Closed</Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <BuyButton
                className="flex-1"
                size="sm"
                price={costs}
                owned={item.owned}
                ownedLabel="Wear it"
                freeLabel="Take it"
                loading={busy}
                disabled={!canTake}
                onClick={onTake}
              />
              {/*
                * Putting something aside is not buying it, so it is its own
                * small control beside the one that spends Brix rather than a
                * second full-width button next to it.
                */}
              {!item.owned && (
                <button
                  type="button"
                  aria-label={inBasket ? `Take ${item.name} out of your basket` : `Put ${item.name} in your basket`}
                  aria-pressed={inBasket}
                  disabled={!canTake}
                  onClick={() => (inBasket
                    ? takeOutOfBasket(item.id)
                    : putInBasket({
                      id: item.id,
                      name: item.name,
                      kind: item.kind,
                      price: costs,
                      picture,
                    }))}
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    inBasket
                      ? 'border-brand bg-brand/15 text-white'
                      : 'border-ink-line text-white/55 hover:border-brand/60 hover:text-white',
                  )}
                >
                  <FontAwesomeIcon icon={inBasket ? faCheck : faBasketShopping} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
