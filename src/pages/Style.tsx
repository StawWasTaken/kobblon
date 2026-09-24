import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass, faPlus, faCheck, faShirt, faUpload, faXmark, faEyeSlash,
  faStore, faWandMagicSparkles, faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { FacesShelf } from '@/components/avatar/FacesShelf'
import { Choices } from '@/components/ui/Choices'
import { Toolbar } from '@/components/ui/Toolbar'
import { Dialog } from '@/components/ui/Dialog'
import { Confirm } from '@/components/ui/Confirm'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { GuestGate } from '@/components/ui/GuestGate'
import { Price } from '@/components/brand/Currency'
import { Balance } from '@/components/money/Balance'
import { Kobby } from '@/components/brand/Kobby'
import { Verified } from '@/components/brand/Verified'
import { FaceStage } from '@/components/style/FaceStage'
import { StyleStudio, StyleDetails, startingPlace } from '@/components/style/StyleStudio'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  asWorn, buyStyleItem, myStyle, publishStyleItem, retireStyleItem,
  styleShop, styleTag, uploadStyleImage, wearStyleItem,
} from '@/lib/api'
import type { Placement, StyleItem } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'

const slotNames: Record<StyleItem['slot'], string> = {
  hat: 'Hat', hair: 'Hair', face: 'Face', accessory: 'Accessory', frame: 'Frame',
}

const filters: { value: StyleItem['slot'] | null; label: string }[] = [
  { value: null, label: 'Everything' },
  { value: 'hat', label: 'Hats' },
  { value: 'hair', label: 'Hair' },
  { value: 'face', label: 'Faces' },
  { value: 'accessory', label: 'Accessories' },
  { value: 'frame', label: 'Frames' },
]

/**
 * One thing in the shop.
 *
 * The whole tile is the way in to its page, and the only preview worth
 * showing is the thing already on a face: yours, so what you are looking at
 * is what you would get. The buttons sit over the tile rather than in it, so
 * the picture is the card and nothing competes with it.
 */
function ItemTile({
  item, face, name, busy, onGet, onWear,
}: {
  item: StyleItem
  face: string | null
  name: string
  busy: boolean
  onGet: () => void
  onWear: () => void
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-ink-line bg-ink-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/70 hover:shadow-pop">
      <Link to={`/style/${styleTag(item.content_id)}`} className="block">
        <span className="relative grid aspect-square place-items-center bg-ink-raised p-7">
          <FaceStage
            src={face}
            name={name}
            items={[asWorn(item)]}
            className="w-full max-w-[9rem] transition-transform duration-200 group-hover:scale-[1.05]"
          />

          <span className="absolute left-2.5 top-2.5 max-w-[60%] truncate rounded-md bg-ink-card/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted ring-1 ring-ink-line backdrop-blur">
            {slotNames[item.slot]}
          </span>

          {item.worn && (
            <span className="absolute right-2.5 top-2.5 rounded-md bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-onbrand">
              Worn
            </span>
          )}
        </span>

        <span className="block border-t border-ink-line px-3 pb-2 pt-2.5">
          <span className="block truncate text-sm font-bold">{item.name}</span>
          <span className="flex items-center gap-1 truncate text-xs text-muted">
            @{item.creator_username}
            <Verified className="text-[9px]" />
          </span>
        </span>
      </Link>

      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <Price amount={item.price} className="text-sm font-extrabold" />

        {item.owned ? (
          <Button
            size="sm"
            variant={item.worn ? 'primary' : 'subtle'}
            icon={item.worn ? faCheck : faShirt}
            disabled={busy}
            onClick={onWear}
          >
            {item.worn ? 'Worn' : 'Wear'}
          </Button>
        ) : (
          <GuestGate action="buy things">
            <Button size="sm" disabled={busy} onClick={onGet}>
              {item.price > 0 ? 'Get' : 'Take'}
            </Button>
          </GuestGate>
        )}
      </div>
    </article>
  )
}

export default function Style() {
  useTitle('Style')
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()

  /*
   * The words can arrive in the address, because the bar at the top of the
   * site hands its search straight to this page, and because a search worth
   * making is a search worth sending somebody.
   */
  const [params, setParams] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [slot, setSlot] = useState<StyleItem['slot'] | null>(null)
  const [tab, setTab] = useState<'shop' | 'mine' | 'faces'>('shop')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const words = term.trim()
      setSearch(words)
      setParams(words ? { q: words } : {}, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, setParams])

  const shop = useAsync(() => styleShop({ search, slot }), [search, slot])
  const mine = useAsync(async () => (profile ? myStyle() : []), [profile?.id])

  const canMake = Boolean(profile?.is_verified || profile?.is_admin)
  const face = avatarOf(profile)
  const wearing = profile?.style ?? []

  /* ------------------------------------------------------------ making one */

  const [making, setMaking] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [place, setPlace] = useState<Placement>({ ...startingPlace })
  const [details, setDetails] = useState({
    name: '', description: '', slot: 'hat' as StyleItem['slot'], price: '0',
  })
  const [publishing, setPublishing] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const [retiring, setRetiring] = useState<StyleItem | null>(null)

  const pickFile = async (chosen: File | null) => {
    if (!chosen || !profile) return
    if (chosen.size > 4 * 1024 * 1024) {
      toast('That picture is over 4MB.', 'error')
      return
    }
    setUploading(true)
    try {
      setImage(await uploadStyleImage(profile.id, chosen))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not upload.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const publish = async () => {
    if (!image || !details.name.trim()) {
      toast('It needs a picture and a name.', 'error')
      return
    }
    setPublishing(true)
    try {
      await publishStyleItem({
        name: details.name,
        description: details.description,
        slot: details.slot,
        image,
        place,
        price: Number(details.price || 0),
      })
      toast(`${details.name} is in the shop.`, 'success')
      setMaking(false)
      setImage(null)
      setPlace({ ...startingPlace })
      setDetails({ name: '', description: '', slot: 'hat', price: '0' })
      shop.reload()
      mine.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not go up.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  /* ------------------------------------------------------- getting, wearing */

  const get = async (item: StyleItem) => {
    setBusy(item.id)
    try {
      await buyStyleItem(item.id)
      toast(item.price > 0 ? `Bought ${item.name}.` : `${item.name} is yours.`, 'success')
      await refreshProfile()
      shop.reload()
      mine.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const wear = async (item: StyleItem, on = !item.worn) => {
    setBusy(item.id)
    try {
      await wearStyleItem(item.id, on)
      await refreshProfile()
      shop.reload()
      mine.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const source = tab === 'shop' ? shop : mine
  const shown = source.data ?? []

  return (
    <Page className="space-y-6">
      {/* ----------------------------------------------------------- hero */}
      <header className="relative overflow-hidden rounded-3xl border border-ink-line bg-ink-card">

        <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-[0.3em] text-white/40">
              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-brand-bright" />
              Kobblon Style
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-[0.95] sm:text-5xl">
              Wear it
              <span className="block text-brand-bright">everywhere</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Hats, hair and whatever else people make, worn on your own picture and shown
              wherever you turn up on Kobblon.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {canMake && (
                <Button icon={faPlus} onClick={() => setMaking(true)}>Make something</Button>
              )}
              {!!wearing.length && (
                <Button variant="subtle" icon={faShirt} onClick={() => setTab('mine')}>
                  {wearing.length} on your picture
                </Button>
              )}
              <span className="inline-flex items-center rounded-xl border border-ink-line bg-ink-raised px-3 py-2">
                <Balance amount={profile?.pixels ?? 0} size="sm" label={false} />
              </span>
            </div>
          </div>

          {/* Your own face, wearing what you have on right now, big enough to
              judge by. Taking something off is done from here. */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative grid h-48 w-48 place-items-center rounded-3xl border border-ink-line bg-ink-raised p-6 sm:h-56 sm:w-56">
              <FaceStage
                src={face}
                name={profile?.display_name ?? 'You'}
                items={wearing}
                className="w-full"
              />
            </div>

            {!!wearing.length && (
              <div className="flex max-w-[16rem] flex-wrap justify-center gap-1.5">
                {wearing.map((one) => (
                  <button
                    key={one.id}
                    onClick={() => wear({ id: one.id } as StyleItem, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-ink-card px-2 py-1 text-xs font-bold text-white/70 transition-colors hover:border-danger/50 hover:text-white"
                  >
                    {one.name ?? 'Worn'}
                    <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- filters */}
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            label="The shop, or what you own"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'shop', label: 'The shop' },
              { value: 'mine', label: 'Yours', count: mine.data?.length ?? null },
              { value: 'faces', label: 'Faces' },
            ]}
          />

          {tab === 'shop' && (
            <Input
              icon={faMagnifyingGlass}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search the shop"
              aria-label="Search the shop"
              className="min-w-[10rem] flex-1"
            />
          )}
        </div>

        {tab === 'shop' && (
          <Choices
            label="What kind of thing"
            size="sm"
            tone="soft"
            value={slot ?? 'all'}
            options={filters.map((one) => ({ value: one.value ?? 'all', label: one.label }))}
            onChange={(next) => setSlot(next === 'all' ? null : next as StyleItem['slot'])}
          />
        )}
      </Toolbar>

      {/*
        * Faces are their own thing: worn by an avatar in a World rather than
        * drawn on the picture at the top of this page, and published by
        * Kobblon rather than by anybody.
        */}
      {tab === 'faces' && <FacesShelf />}

      {tab !== 'faces' && source.error && <ErrorState message={source.error} onRetry={source.reload} />}

      {tab !== 'faces' && source.loading && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
        </div>
      )}

      {tab !== 'faces' && !shown.length && !source.loading && !source.error && (
        <Card>
          <EmptyState
            mood={search ? 'noResults' : 'emptyBox'}
            title={tab === 'mine' ? 'Nothing yet' : search ? 'Nothing matches' : 'The shop is empty'}
            body={
              tab === 'mine'
                ? 'Anything you take from the shop turns up here, ready to wear.'
                : search
                  ? 'Try fewer letters.'
                  : 'Verified accounts put things here. There will be more soon.'
            }
            action={
              tab === 'mine'
                ? <Button icon={faStore} onClick={() => setTab('shop')}>Open the shop</Button>
                : search
                  ? <Button variant="subtle" onClick={() => setTerm('')}>Clear the search</Button>
                  : undefined
            }
          />
        </Card>
      )}

      {tab !== 'faces' && !!shown.length && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <ItemTile
                item={item}
                face={face}
                name={profile?.display_name ?? 'You'}
                busy={busy === item.id}
                onGet={() => get(item)}
                onWear={() => wear(item)}
              />

              {tab === 'mine' && item.mine && item.is_public && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={faEyeSlash}
                  className="w-full"
                  onClick={() => setRetiring(item)}
                >
                  Take it down
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Somewhere to go on from, rather than a page that simply stops. */}
      {tab === 'shop' && !!shown.length && (
        <Link
          to="/create/marketplace"
          className="flex items-center gap-4 rounded-2xl border border-ink-line bg-ink-card p-4 transition-colors hover:border-brand/60"
        >
          <Kobby mood="style" size="sm" bob={false} />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-extrabold">
              Make things people use
            </span>
            <span className="block text-sm text-muted">
              Decals, sounds, video and fonts live in the Creator Marketplace.
            </span>
          </span>
          <FontAwesomeIcon icon={faArrowRight} className="text-muted" />
        </Link>
      )}

      {/* ------------------------------------------------------ the studio */}

      <Dialog
        open={making}
        onClose={() => setMaking(false)}
        title="Make something to wear"
        description="Upload the picture, put it where it belongs, and set what it costs."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMaking(false)} disabled={publishing}>
              Never mind
            </Button>
            <Button onClick={publish} disabled={publishing || !image || !details.name.trim()}>
              Put it in the shop
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={file}
              type="file"
              accept="image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="subtle"
              icon={faUpload}
              onClick={() => file.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading' : image ? 'Change the picture' : 'Upload a picture'}
            </Button>
            {image && (
              <Button variant="ghost" icon={faXmark} onClick={() => setImage(null)}>
                Clear
              </Button>
            )}
            <p className="text-xs text-muted">
              A PNG with a see through background sits best.
            </p>
          </div>

          <StyleStudio image={image} place={place} onPlace={setPlace} face={face} />

          <StyleDetails
            name={details.name}
            description={details.description}
            slot={details.slot}
            price={details.price}
            onChange={(patch) => setDetails((all) => ({ ...all, ...patch }))}
          />
        </div>
      </Dialog>

      <Confirm
        open={!!retiring}
        onClose={() => setRetiring(null)}
        onConfirm={async () => {
          if (!retiring) return
          try {
            await retireStyleItem(retiring.id)
            toast(`${retiring.name} is out of the shop.`, 'success')
            shop.reload()
            mine.reload()
          } catch (err) {
            toast(err instanceof Error ? err.message : 'That did not work.', 'error')
          }
        }}
        title={`Take ${retiring?.name ?? 'it'} down?`}
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
