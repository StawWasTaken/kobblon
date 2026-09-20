import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useOutletContext, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUpload, faMagnifyingGlass, faCircleCheck,
  faEye, faHandPointUp, faBoxOpen, faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Choices } from '@/components/ui/Choices'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { AssetTile, contentTag, kindIcons, kindLabels } from '@/components/create/AssetTile'
import { UploadLine } from '@/components/create/UploadFace'
import { CreateRail } from '@/components/create/CreateRail'
import { WorkingAsProvider, useWorkingAs } from '@/components/create/WorkingAs'
import { UploadDialog } from '@/components/create/UploadDialog'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { CREATE_ICON, useFavicon, useTitle } from '@/hooks/useTitle'
import { worldIcon } from '@/lib/naming'

/** Everything under Create names itself inside Create, not inside the site. */
const CREATE = 'Kobblon Create'
import {
  communityAnalytics, creatorAnalytics, listAssets,
  listCommunityUploads, listInventory, listOwnAssets,
  myWorlds,
} from '@/lib/api'
import type { AssetSort } from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AssetKind } from '@/types/db'

type HubContext = {
  openUpload: () => void
  inventory: ReturnType<typeof useAsync<Awaited<ReturnType<typeof listInventory>>>>
}

export const useHub = () => useOutletContext<HubContext>()

/* ------------------------------------------------------------------ shell */

export default function CreateHub() {
  // The mark on the tab says which half of Kobblon you are in.
  useFavicon(CREATE_ICON)

  const { profile } = useAuth()
  const [uploading, setUploading] = useState(false)

  const inventory = useAsync(
    async () => (profile ? listInventory() : []),
    [profile?.id],
  )

  return (
    <WorkingAsProvider>
    <div className="flex items-start">
      <CreateRail ownedCount={inventory.data?.length ?? 0} />

      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6">
        <Outlet context={{ openUpload: () => setUploading(true), inventory } satisfies HubContext} />
      </div>

      <UploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        onUploaded={() => window.dispatchEvent(new CustomEvent('kobblon:uploaded'))}
      />
    </div>
    </WorkingAsProvider>
  )
}

/* --------------------------------------------------------------- overview */

function Tile({ icon, label, value, to }: {
  icon: IconDefinition
  label: string
  value: string
  to?: string
}) {
  const body = (
    <>
      <FontAwesomeIcon icon={icon} className="text-base text-link" />
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </>
  )
  return to
    ? <Link to={to} className="rounded-2xl border border-ink-line bg-ink-card p-4 transition-colors hover:border-brand/60">{body}</Link>
    : <div className="rounded-2xl border border-ink-line bg-ink-card p-4">{body}</div>
}

export function CreateOverview() {
  useTitle(null, CREATE)
  const { profile } = useAuth()
  const { openUpload, inventory } = useHub()

  const { target } = useWorkingAs()

  const mine = useAsync(
    async () => (target ? listCommunityUploads(target.id) : profile ? listOwnAssets(profile.id) : []),
    [profile?.id, target?.id],
  )
  const worlds = useAsync(
    async () => (profile && !target ? myWorlds() : []),
    [profile?.id, target?.id],
  )
  const rows = useAsync(
    async () => (target
      ? communityAnalytics(target.id)
      : profile ? creatorAnalytics(profile.id) : []),
    [profile?.id, target?.id],
  )

  useEffect(() => {
    const reload = () => mine.reload()
    window.addEventListener('kobblon:uploaded', reload)
    return () => window.removeEventListener('kobblon:uploaded', reload)
  }, [mine])

  const visits = (worlds.data ?? []).reduce((sum, world) => sum + (world.visit_count ?? 0), 0)
  const uses = (rows.data ?? []).reduce((sum, row) => sum + Number(row.uses ?? 0), 0)
  const views = (rows.data ?? []).reduce((sum, row) => sum + Number(row.views ?? 0), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            {target ? target.name : 'Kobblon Create'}
          </h1>
          <p className="mt-1.5 text-muted">
            {target
              ? 'Everything this Community has made. What it sells fills its funds.'
              : 'Everything you have made, and everything you are allowed to build with.'}
          </p>
        </div>
        <div className="flex gap-2">
          <GuestGate action="upload">
            <Button icon={faUpload} onClick={openUpload} disabled={!profile}>Upload</Button>
          </GuestGate>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile icon={worldIcon} label="Worlds" value={formatCount(worlds.data?.length ?? 0)} to="/create/worlds" />
        <Tile icon={faUpload} label="Uploads" value={formatCount(mine.data?.length ?? 0)} to="/create/uploads" />
        <Tile icon={faEye} label="Visits to your Worlds" value={formatCount(visits)} />
        <Tile icon={faHandPointUp} label="Uses of your content" value={formatCount(uses)} to="/create/analytics" />
        <Tile icon={faBoxOpen} label="In your inventory" value={formatCount(inventory.data?.length ?? 0)} to="/create/inventory" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-3.5">
            <h2 className="text-sm font-extrabold">Latest uploads</h2>
            <Link to="/create/uploads" className="text-xs font-bold text-link hover:underline">See all</Link>
          </div>
          {mine.loading && <div className="space-y-2 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
          {!mine.loading && !mine.data?.length && (
            <p className="px-4 py-8 text-center text-sm text-muted">Nothing uploaded yet.</p>
          )}
          <ul>
            {(mine.data ?? []).slice(0, 5).map((item) => <UploadLine key={item.id} item={item} />)}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-line px-4 py-3.5">
            <h2 className="text-sm font-extrabold">How your content is doing</h2>
            <Link to="/create/analytics" className="text-xs font-bold text-link hover:underline">See all</Link>
          </div>
          {!rows.data?.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Numbers show up once people find your work.
            </p>
          ) : (
            <div className="flex divide-x divide-ink-line">
              <div className="flex-1 p-4 text-center">
                <p className="font-display text-2xl font-extrabold tabular-nums">{formatCount(views)}</p>
                <p className="text-xs text-muted">Views</p>
              </div>
              <div className="flex-1 p-4 text-center">
                <p className="font-display text-2xl font-extrabold tabular-nums">{formatCount(uses)}</p>
                <p className="text-xs text-muted">Uses</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- spaces */

export function CreateWorlds() {
  useTitle('My Worlds', CREATE)
  const { profile } = useAuth()
  const { target } = useWorkingAs()

  const worlds = useAsync(
    async () => (profile && !target ? myWorlds() : []),
    [profile?.id, target?.id],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title={target ? `${target.name}'s Worlds` : 'My Worlds'}
        lead="Built in Creator, played in the Launcher, and set up here or there."
      />

      {worlds.loading && <Skeleton className="h-32" />}

      {!worlds.loading && !worlds.data?.length && (
        <Card>
          <EmptyState
            mood="emptyBox"
            title={target ? 'Nothing here yet' : 'No Worlds yet'}
            body={target
              ? 'A World belongs to the person who built it. Working as a Community does not show theirs.'
              : 'Worlds are built in Kobblon Creator on the desktop. Publish one there and it appears here, ready to be set up and put in front of people.'}
            action={target ? undefined : <Button variant="subtle" to="/download">Get Creator</Button>}
          />
        </Card>
      )}

      {!!worlds.data?.length && (
        <Card className="overflow-hidden">
          <ul>
            {worlds.data.map((world) => (
              <li
                key={world.id}
                className="flex items-center gap-3 border-b border-ink-line/70 px-4 py-3 last:border-0"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-ink">
                  {world.cover_url
                    ? <img src={world.cover_url} alt="" className="h-full w-full object-cover" />
                    : <FontAwesomeIcon icon={worldIcon} className="text-white/50" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{world.name}</span>
                  {/*
                    * The same six things Creator shows in its own list, in
                    * the same order, read from the same my_worlds(): a World
                    * that looks like one thing on the desktop and another
                    * here is two products.
                    */}
                  <span className="block truncate text-xs text-muted">
                    {world.content_id ? `WLD-${world.content_id}` : 'No number yet'}
                    {world.is_published ? '' : ' · not published'}
                    {' · '}
                    {formatCount(world.visit_count)} {world.visit_count === 1 ? 'visit' : 'visits'}
                    {world.updated_at ? ` · saved ${timeAgo(world.updated_at)}` : ''}
                  </span>
                </span>
                <Button size="sm" variant="ghost" to={`/create/worlds/${world.id}`}>Configure</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

const kinds: (AssetKind | 'all')[] = ['all', 'image', 'audio', 'video', 'font', 'model']

export function CreateMarketplace() {
  useTitle('Creator Marketplace', CREATE)
  const { profile } = useAuth()
  const { openUpload } = useHub()
  const [params, setParams] = useSearchParams()
  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const [sort, setSort] = useState<AssetSort>('new')
  const [term, setTerm] = useState(params.get('q') ?? '')
  const [debounced, setDebounced] = useState(term)
  // Who made it is a filter of its own: anybody by name, or Kobblon in
  // one click, because the official shelf is the one people want most.
  const [maker, setMaker] = useState(params.get('by') ?? '')
  const [makerDraft, setMakerDraft] = useState(params.get('by') ?? '')
  const field = useRef<HTMLInputElement>(null)

  // Searching from the bar at the top lands here with the words already in
  // the box, and from then on this search is the one you are using.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(term)
      const next: Record<string, string> = {}
      if (term.trim()) next.q = term.trim()
      if (maker.trim()) next.by = maker.trim()
      setParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [term, maker, setParams])

  // A slash puts the cursor in the box, the way search boxes work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        field.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const market = useAsync(
    () => listAssets({ kind, search: debounced, limit: 48, sort, creator: maker.trim() || undefined }),
    [kind, debounced, sort, maker],
  )
  // The official shelf leads the page when nothing has been asked for.
  const official = useAsync(
    async () => (!debounced && !maker && kind === 'all'
      ? listAssets({ creator: 'kobblon', limit: 12, sort: 'used' })
      : []),
    [debounced, maker, kind],
  )

  const filtering = !!debounced || !!maker || kind !== 'all'
  const clearAll = () => {
    setTerm('')
    setMaker('')
    setMakerDraft('')
    setKind('all')
  }

  return (
    <div className="space-y-6">
      {/* The search is the page, so it opens the page rather than sitting in
          a corner of it. */}
      <section className="relative overflow-hidden rounded-3xl border border-ink-line bg-ink-card px-5 py-7 sm:px-8 sm:py-9">

        <div className="relative">
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Creator Marketplace</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Pictures, sounds, video, fonts and models, made by people here. Take what you need and
            paste its id into a Space.
          </p>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                ref={field}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search by name, by what it is, or by who made it"
                aria-label="Search the marketplace"
                className="h-14 w-full rounded-2xl border border-ink-line bg-ink-raised pl-12 pr-24 text-base font-semibold shadow-card transition-colors placeholder:font-normal placeholder:text-white/30 focus:border-brand-bright focus:outline-none"
              />
              {term ? (
                <button
                  onClick={() => setTerm('')}
                  aria-label="Clear the search"
                  className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              ) : (
                <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-ink-line px-2 py-0.5 text-[11px] font-bold text-white/35 sm:block">
                  /
                </kbd>
              )}
            </div>

            <GuestGate action="upload">
              <Button size="lg" icon={faUpload} onClick={openUpload} disabled={!profile}>
                Upload
              </Button>
            </GuestGate>
          </div>

          {/* Who made it */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Made by</span>

            <button
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
        </div>
      </section>

      {/* What kind of thing, and in what order */}
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-2 bg-ink/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Choices
          label="What kind of content"
          value={kind}
          options={kinds.map((k) => ({
            value: k,
            label: k === 'all' ? 'Everything' : kindLabels[k],
            icon: k === 'all' ? undefined : kindIcons[k],
          }))}
          onChange={(next) => setKind(next)}
        />

        <div className="ml-auto flex items-center gap-2">
          <Select
            label="Sort the marketplace"
            value={sort}
            onChange={(next) => setSort(next as AssetSort)}
            className="w-40"
            align="right"
            options={[
              { value: 'new', label: 'Newest' },
              { value: 'used', label: 'Most used' },
              { value: 'rated', label: 'Best rated' },
              { value: 'cheap', label: 'Cheapest' },
            ]}
          />
        </div>
      </div>

      {/* What you asked for, and a way back out of it */}
      {filtering && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">
            {market.loading
              ? 'Looking'
              : `${formatCount(market.data?.length ?? 0)} ${market.data?.length === 1 ? 'result' : 'results'}`}
          </span>
          {debounced && <Chip onClear={() => setTerm('')}>&ldquo;{debounced}&rdquo;</Chip>}
          {maker && <Chip onClear={() => { setMaker(''); setMakerDraft('') }}>by @{maker}</Chip>}
          {kind !== 'all' && <Chip onClear={() => setKind('all')}>{kindLabels[kind]}</Chip>}
          <button onClick={clearAll} className="text-xs font-bold text-link hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* Kobblon's own shelf, when nothing has been asked for */}
      {!filtering && !!official.data?.length && (
        <section>
          <SectionHeader title="Made by Kobblon" icon={faCircleCheck}>
            <button
              onClick={() => { setMaker('kobblon'); setMakerDraft('kobblon') }}
              className="text-xs font-bold text-link hover:underline"
            >
              See all
            </button>
          </SectionHeader>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 kob-scroll">
            {official.data.map((item) => (
              <div key={item.id} className="w-40 shrink-0 sm:w-44">
                <AssetTile item={item} />
              </div>
            ))}
          </div>
        </section>
      )}

      {!filtering && (
        <h2 className="font-display text-xl font-extrabold">
          {sort === 'new' ? 'Just uploaded'
            : sort === 'used' ? 'Used the most'
              : sort === 'rated' ? 'Rated the best'
                : 'Cheapest first'}
        </h2>
      )}

      {market.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}
        </div>
      )}

      {market.error && <ErrorState message={market.error} onRetry={market.reload} />}

      {!market.loading && !market.error && !market.data?.length && (
        <Card>
          <EmptyState
            mood={filtering ? 'noResults' : 'emptyBox'}
            title={filtering ? 'Kobby could not find anything' : 'Nothing here yet'}
            body={
              filtering
                ? 'Nothing matches all of that. Try fewer words, or clear a filter.'
                : 'Be the first to upload something people can build with.'
            }
            action={filtering
              ? <Button variant="subtle" onClick={clearAll}>Clear the filters</Button>
              : undefined}
          />
        </Card>
      )}

      {!!market.data?.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {market.data.map((item) => <AssetTile key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

/** One thing you have asked for, with a way to take it back off. */
function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-ink-hover px-2.5 text-xs font-bold">
      {children}
      <button onClick={onClear} aria-label="Remove this filter" className="text-white/45 hover:text-white">
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </span>
  )
}

/* -------------------------------------------------------------- inventory */

export function CreateInventory() {
  useTitle('Inventory', CREATE)
  const { inventory } = useHub()
  const [kind, setKind] = useState<AssetKind | 'all'>('all')

  const shown = (inventory.data ?? []).filter((item) => kind === 'all' || item.kind === kind)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        lead={"Your own work and everything you have taken from the marketplace, Kobblon's "
          + 'included. Copy an id and paste it into a World.'}
      />

      <Choices
        label="What kind of content"
        value={kind}
        options={kinds.map((k) => ({
          value: k,
          label: k === 'all' ? 'Everything' : kindLabels[k],
        }))}
        onChange={(next) => setKind(next)}
      />

      {inventory.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}
        </div>
      )}

      {!inventory.loading && !shown.length && (
        <Card>
          <EmptyState
            mood="emptyBox"
            title="Nothing here yet"
            body="Take something from the marketplace and it lands here, free or paid."
            action={<Button to="/create/marketplace">Open the marketplace</Button>}
          />
        </Card>
      )}

      {!!shown.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {shown.map((item) => <AssetTile key={item.id} item={item} owned />)}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- analytics */

export function CreateAnalytics() {
  useTitle('Analytics', CREATE)
  const { profile } = useAuth()
  const { target } = useWorkingAs()
  const rows = useAsync(
    async () => (target
      ? communityAnalytics(target.id)
      : profile ? creatorAnalytics(profile.id) : []),
    [profile?.id, target?.id],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        lead="Counted as they happen, not as unique people. Open an item for its last thirty days."
      />

      {rows.loading && <Skeleton className="h-40" />}

      {!rows.loading && !rows.data?.length && (
        <Card>
          <EmptyState
            mood="emptyBox"
            title="Nothing to measure yet"
            body="Upload something and its numbers appear here."
          />
        </Card>
      )}

      {!!rows.data?.length && (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1fr_5rem_5rem_6rem] gap-3 border-b border-ink-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted sm:grid">
            <span>Item</span>
            <span className="text-right">Views</span>
            <span className="text-right">Uses</span>
            <span className="text-right">Requests</span>
          </div>
          <ul>
            {rows.data.map((row) => (
              <li
                key={row.asset_id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-ink-line/70 px-4 py-3 last:border-0 sm:grid-cols-[1fr_5rem_5rem_6rem]"
              >
                <span className="min-w-0">
                  <Link
                    to={`/create/${contentTag(row.kind, row.content_id)}`}
                    className="block truncate text-sm font-bold hover:text-link"
                  >
                    {row.name}
                  </Link>
                  <span className="font-mono text-xs text-muted">
                    {contentTag(row.kind, row.content_id)}
                  </span>
                </span>
                <span className="text-right text-sm tabular-nums">{formatCount(Number(row.views))}</span>
                <span className="hidden text-right text-sm tabular-nums sm:block">
                  {formatCount(Number(row.uses))}
                </span>
                <span className="hidden text-right text-sm tabular-nums sm:block">
                  {Number(row.pending_requests) > 0 ? (
                    <Link to="/create/requests" className="font-bold text-link hover:underline">
                      {row.pending_requests}
                    </Link>
                  ) : '0'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
