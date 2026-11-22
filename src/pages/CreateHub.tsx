import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useOutletContext, useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faUpload, faMagnifyingGlass, faCircleCheck, faBoxArchive, faTrash, faEllipsis,
  faBoxOpen, faXmark, faShapes, faGaugeHigh, faEye, faHandPointer, faGear,
  faPen, faClock, faThumbsUp, faArrowUpRightFromSquare, faChartSimple,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { worldIcon } from '@/lib/naming'
import { worldTag } from '@/lib/kinds'
import {
  HubTop, Stat, Head, Sheet, HubRow, Chip, Flag, LiveFlag, HubTile,
} from '@/components/create/HubShapes'
import { Button } from '@/components/ui/Button'
import { worldEmblem } from '@/lib/worldart'
import { Select } from '@/components/ui/Select'
import { Menu } from '@/components/ui/Menu'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { AssetTile, contentTag, kindIcons, kindLabels } from '@/components/create/AssetTile'
import { UploadLine } from '@/components/create/UploadFace'
import { CreateRail } from '@/components/create/CreateRail'
import { WorldWork } from '@/components/create/WorldWork'
import { WorkingAsProvider, useWorkingAs } from '@/components/create/WorkingAs'
import { UploadDialog } from '@/components/create/UploadDialog'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { CREATE_ICON, useFavicon, useTitle } from '@/hooks/useTitle'

/** Everything under Create names itself inside Create, not inside the site. */
const CREATE = 'Creator Hub'
import {
  communityAnalytics, creatorAnalytics, listAssets,
  archiveWorld, deleteWorld, listCommunityUploads, listInventory, listOwnAssets,
  myWorlds,
} from '@/lib/api'
import type { AssetSort, WorldShelf } from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import type { AssetKind, World } from '@/types/db'

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

/*
 * The front of the Creator Hub.
 *
 * It was five small number tiles across the top and two half-width cards
 * under them, which is a dashboard: it opens on how you are doing rather
 * than on what you are doing, and the Worlds you are actually building were
 * a figure in a box rather than a thing you could open.
 *
 * So it is the same shape as a World page and a Community page now - the
 * work down the middle, the standing numbers down the side. The numbers
 * have not gone; they have stopped being the first thing and the biggest.
 */

export function CreateOverview() {
  useTitle(null, CREATE)
  const { profile } = useAuth()
  const { openUpload, inventory } = useHub()
  const toast = useToast()

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
  const unpublished = (worlds.data ?? []).filter((world) => !world.is_published).length
  const waiting = (mine.data ?? []).filter((one) => one.status === 'pending').length
  const uses = (rows.data ?? []).reduce((sum, row) => sum + Number(row.uses ?? 0), 0)
  const views = (rows.data ?? []).reduce((sum, row) => sum + Number(row.views ?? 0), 0)

  const noWorkspace = () => toast(
    'Kobblon Workspace is not installed on this machine. The download page has it.',
    'info',
  )

  return (
    <div className="space-y-7">
      <HubTop
        icon={faGaugeHigh}
        title={target ? target.name : 'Creator Hub'}
        lead={target
          ? 'Everything this Community has made. What it sells fills its funds.'
          : 'Everything you have made, and everything you are allowed to build with.'}
        action={(
          <GuestGate action="upload">
            <Button icon={faUpload} onClick={openUpload} disabled={!profile}>Upload</Button>
          </GuestGate>
        )}
      />

      {/*
        * The numbers were a panel down the side you had to look for. They
        * are a strip now - read in one pass, above the work rather than
        * instead of it, and still not the biggest thing on the page.
        */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {!target && (
          <Stat
            icon={worldIcon}
            label="Worlds"
            value={formatCount(worlds.data?.length ?? 0)}
            note={unpublished > 0 ? `${formatCount(unpublished)} not published` : undefined}
          />
        )}
        {!target && <Stat icon={faEye} label="Visits" value={formatCount(visits)} />}
        <Stat
          icon={faUpload}
          label="Uploads"
          value={formatCount(mine.data?.length ?? 0)}
          note={waiting > 0 ? `${formatCount(waiting)} in review` : undefined}
        />
        <Stat icon={faEye} label="Views" value={formatCount(views)} />
        <Stat icon={faHandPointer} label="Uses" value={formatCount(uses)} />
        {!target && (
          <Stat
            icon={faBoxOpen}
            label="Owned"
            value={formatCount(inventory.data?.length ?? 0)}
            note="Yours to build with"
          />
        )}
      </div>

      {/*
        * A Community cannot own a World yet, so working as one this
        * section would be an empty shelf that looks broken. It is left
        * out rather than drawn empty, and My Worlds says why.
        */}
      {!target && (
        <section>
          <Head all="All my Worlds" to="/create/worlds">What you are building</Head>

          {worlds.loading && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}
            </div>
          )}

          {!worlds.loading && !worlds.data?.length && (
            <Sheet>
              <EmptyState
                mood="noResults"
                title="No Worlds yet"
                body="Worlds are built in Kobblon Workspace on the desktop. Publish one there and it turns up here, ready to be set up and put in front of people."
                action={<Button variant="subtle" to="/download">Get Workspace</Button>}
              />
            </Sheet>
          )}

          {!!worlds.data?.length && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {worlds.data.slice(0, 3).map((world) => (
                <WorldWork key={world.id} world={world} onMissing={noWorkspace} />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <Head all="All uploads" to="/create/uploads">Latest uploads</Head>

        <Sheet>
          {mine.loading && (
            <div className="space-y-2 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          )}
          {!mine.loading && !mine.data?.length && (
            <EmptyState
              mood="noResults"
              title="Nothing uploaded yet"
              body="Pictures, sounds, meshes and fonts you put in here are what you build with, and what you can sell."
              action={
                <GuestGate action="upload">
                  <Button icon={faUpload} onClick={openUpload} disabled={!profile}>Upload something</Button>
                </GuestGate>
              }
            />
          )}
          {!!mine.data?.length && (
            <ul>
              {mine.data.slice(0, 6).map((item) => <UploadLine key={item.id} item={item} />)}
            </ul>
          )}
        </Sheet>
      </section>

      {/* The two shelves that are not your own work: what you can take, and
          what you have taken. A row each, because neither is a number. */}
      <section>
        <Head>Where to get more</Head>
        <div className="grid gap-3 sm:grid-cols-2">
          <Shortcut
            icon={faShapes}
            title="Marketplace"
            note="Everything anybody on Kobblon has put up to be built with, free and paid."
            to="/create/marketplace"
          />
          <Shortcut
            icon={faBoxOpen}
            title="Inventory"
            note={`${formatCount(inventory.data?.length ?? 0)} things you own, from the Marketplace and your own uploads.`}
            to="/create/inventory"
          />
        </div>
      </section>
    </div>
  )
}

/** One of the two places to get more, on the front page. */
function Shortcut({ icon, title, note, to }: {
  icon: IconDefinition
  title: string
  note: string
  to: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-ink-line bg-ink-raised text-brand-bright">
        <Glyph icon={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-extrabold">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted">{note}</p>
      </div>
      <Button size="sm" variant="subtle" to={to}>Open it</Button>
    </div>
  )
}

/* ----------------------------------------------------------------- spaces */

const shelves: { value: WorldShelf; label: string }[] = [
  { value: 'active', label: 'In use' },
  { value: 'published', label: 'Published' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
]

export function CreateWorlds() {
  useTitle('My Worlds', CREATE)
  const { profile } = useAuth()
  const { target } = useWorkingAs()
  const toast = useToast()
  const [shelf, setShelf] = useState<WorldShelf>('active')
  const [removing, setRemoving] = useState<World | null>(null)

  const worlds = useAsync(
    async () => (profile && !target ? myWorlds(shelf) : []),
    [profile?.id, target?.id, shelf],
  )

  const run = async (what: () => Promise<unknown>, said: string) => {
    try {
      await what()
      await worlds.reload()
      toast(said)
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <HubTop
        icon={worldIcon}
        title={target ? `${target.name}'s Worlds` : 'My Worlds'}
        lead="Built in Kobblon Workspace, played in the Launcher, and set up here or there."
        action={<Button variant="subtle" icon={faArrowUpRightFromSquare} to="/download">Get Workspace</Button>}
      />

      {/*
        * A World belongs to the person who built it. Until a World can be
        * handed to a Community, working as one has nothing to show, and
        * saying so beats an empty list that looks broken.
        */}
      {target ? (
        <Sheet>
          <EmptyState
            mood="noResults"
            title="Worlds are not handed to Communities yet"
            body="A World belongs to whoever built it. Switch back to yourself to see yours."
          />
        </Sheet>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {shelves.map((one) => (
              <Chip key={one.value} on={shelf === one.value} onClick={() => setShelf(one.value)}>
                {one.label}
              </Chip>
            ))}
          </div>

          {worlds.loading && <Skeleton className="h-32 rounded-2xl" />}

          {!worlds.loading && !worlds.data?.length && (
            <Sheet>
              <EmptyState
                mood="noResults"
                title={shelf === 'archived' ? 'Nothing put away' : 'No Worlds yet'}
                body={shelf === 'archived'
                  ? 'A World you archive waits here. It still opens for anybody holding its link.'
                  : 'Worlds are built in Kobblon Workspace on the desktop. Publish one there and it appears here, ready to be set up and put in front of people.'}
                action={shelf === 'archived'
                  ? undefined
                  : <Button variant="subtle" to="/download">Get Workspace</Button>}
              />
            </Sheet>
          )}

          {!!worlds.data?.length && (
            <Sheet>
              {worlds.data.map((world) => (
                <HubRow key={world.id} className="py-3.5">
                  <HubTile src={worldEmblem(world)} />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <Link
                        to={`/create/worlds/${worldTag(world.content_id) || world.id}`}
                        className="truncate text-sm font-extrabold hover:text-link"
                      >
                        {world.name}
                      </Link>
                      {world.is_published
                        ? <LiveFlag />
                        : <Flag tone="bg-ink-raised text-white/55" icon={faPen}>Draft</Flag>}
                      {world.archived_at && (
                        <Flag tone="bg-ink-raised text-white/55" icon={faBoxArchive}>Archived</Flag>
                      )}
                    </span>

                    <span className="mt-0.5 block truncate font-mono text-mini text-muted">
                      {world.content_id ? `WLD-${world.content_id}` : 'No number yet'}
                    </span>

                    {/*
                      * The same facts Workspace shows in its own list, in
                      * the same order, read from the same my_worlds(): a
                      * World that looks like one thing on the desktop and
                      * another here is two products.
                      */}
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-mini font-bold text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Glyph icon={faEye} />
                        {formatCount(world.visit_count)} {world.visit_count === 1 ? 'visit' : 'visits'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Glyph icon={faThumbsUp} on />
                        {formatCount(world.like_count ?? 0)} {world.like_count === 1 ? 'like' : 'likes'}
                      </span>
                      {world.updated_at && (
                        <span className="inline-flex items-center gap-1">
                          <Glyph icon={faClock} />
                          saved {timeAgo(world.updated_at)}
                        </span>
                      )}
                    </span>
                  </span>

                  <Button size="sm" variant="subtle" icon={faGear} to={`/create/worlds/${worldTag(world.content_id) || world.id}`}>
                    Set it up
                  </Button>

                  <Menu
                    label={`More for ${world.name}`}
                    trigger={<Glyph icon={faEllipsis} />}
                    items={[
                      {
                        label: world.archived_at ? 'Take out of the archive' : 'Archive',
                        icon: faBoxArchive,
                        onSelect: () => void run(
                          () => archiveWorld(world.id, !world.archived_at),
                          world.archived_at ? 'Back in use.' : 'Put away.',
                        ),
                      },
                      {
                        label: 'Delete',
                        icon: faTrash,
                        danger: true,
                        onSelect: () => setRemoving(world),
                      },
                    ]}
                  />
                </HubRow>
              ))}
            </Sheet>
          )}
        </>
      )}

      <Confirm
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? `Delete ${removing.name}?` : ''}
        lead="Its pictures and its manifest go too, and that cannot be undone. Archiving puts it away instead."
        confirmText="Delete it"
        icon={faTrash}
        tone="danger"
        onConfirm={() => {
          const world = removing
          setRemoving(null)
          if (world) void run(() => deleteWorld(world.id), `${world.name} is gone.`)
        }}
      />
    </div>
  )
}

const kinds: (AssetKind | 'all')[] = ['all', 'image', 'audio', 'video', 'font', 'mesh', 'build']

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
      <HubTop
        icon={faShapes}
        title="Creator Marketplace"
        lead="Pictures, sounds, video, fonts and models, made by people here."
        action={(
          <GuestGate action="upload">
            <Button icon={faUpload} onClick={openUpload} disabled={!profile}>Upload</Button>
          </GuestGate>
        )}
      />

      {/* The search is the page, so it opens the page rather than sitting in
          a corner of it - in the Hub's own card now rather than a hero of
          its own, because every other page here wears this one. */}
      <section className="rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-4 sm:p-5">
        <div className="relative">
          <Glyph
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            ref={field}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by name, by what it is, or by who made it"
            aria-label="Search the marketplace"
            className="h-14 w-full rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised pl-12 pr-24 text-base font-semibold transition-colors placeholder:font-normal placeholder:text-white/30 focus:border-brand-bright focus:outline-none"
          />
          {term ? (
            <button
              onClick={() => setTerm('')}
              aria-label="Clear the search"
              className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/45 transition-colors hover:bg-ink-hover hover:text-white"
            >
              <Glyph icon={faXmark} />
            </button>
          ) : (
            <kbd className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-lg border-2 border-ink-line px-2 py-0.5 text-mini font-bold text-white/35 sm:block">
              /
            </kbd>
          )}
        </div>

        {/* Who made it */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-mini font-extrabold uppercase tracking-wide text-muted">Made by</span>

          <Chip on={!maker} onClick={() => { setMaker(''); setMakerDraft('') }}>Anybody</Chip>
          <Chip
            on={maker.toLowerCase() === 'kobblon'}
            icon={faCircleCheck}
            onClick={() => { setMaker('kobblon'); setMakerDraft('kobblon') }}
          >
            Kobblon
          </Chip>

          <form
            onSubmit={(e) => { e.preventDefault(); setMaker(makerDraft.trim()) }}
            className="inline-flex h-9 items-center gap-1 rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-2.5"
          >
            <span className="text-xs text-muted">@</span>
            <input
              value={makerDraft}
              onChange={(e) => setMakerDraft(e.target.value)}
              onBlur={() => setMaker(makerDraft.trim())}
              placeholder="somebody"
              aria-label="Made by which person"
              className="w-28 bg-transparent text-xs font-semibold placeholder:text-white/30 focus:outline-none"
            />
          </form>
        </div>
      </section>

      {/* What kind of thing, and in what order */}
      <div className="sticky kob-under-bar z-20 -mx-4 flex flex-wrap items-center gap-2 bg-ink/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {kinds.map((one) => (
          <Chip
            key={one}
            on={kind === one}
            icon={one === 'all' ? undefined : kindIcons[one]}
            onClick={() => setKind(one)}
          >
            {one === 'all' ? 'Everything' : kindLabels[one]}
          </Chip>
        ))}

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
          {debounced && <Crumb onClear={() => setTerm('')}>&ldquo;{debounced}&rdquo;</Crumb>}
          {maker && <Crumb onClear={() => { setMaker(''); setMakerDraft('') }}>by @{maker}</Crumb>}
          {kind !== 'all' && <Crumb onClear={() => setKind('all')}>{kindLabels[kind]}</Crumb>}
          <button onClick={clearAll} className="text-xs font-bold text-link hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* Kobblon's own shelf, when nothing has been asked for */}
      {!filtering && !!official.data?.length && (
        <section>
          <Head all="See all" onAll={() => { setMaker('kobblon'); setMakerDraft('kobblon') }}>
            Made by Kobblon
          </Head>
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
        <Head>
          {sort === 'new' ? 'Just uploaded'
            : sort === 'used' ? 'Used the most'
              : sort === 'rated' ? 'Rated the best'
                : 'Cheapest first'}
        </Head>
      )}

      {market.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}
        </div>
      )}

      {market.error && <ErrorState message={market.error} onRetry={market.reload} />}

      {!market.loading && !market.error && !market.data?.length && (
        <Sheet>
          <EmptyState
            mood="noResults"
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
        </Sheet>
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
function Crumb({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-ink-hover px-2.5 text-xs font-bold">
      {children}
      <button onClick={onClear} aria-label="Remove this filter" className="text-white/45 hover:text-white">
        <Glyph icon={faXmark} />
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
      <HubTop
        icon={faBoxOpen}
        title="Inventory"
        lead={"Your own work and everything you have taken from the marketplace, Kobblon's "
          + 'included. Copy an id and paste it into a World.'}
        action={<Button variant="subtle" icon={faShapes} to="/create/marketplace">Marketplace</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        {kinds.map((one) => (
          <Chip
            key={one}
            on={kind === one}
            icon={one === 'all' ? undefined : kindIcons[one]}
            onClick={() => setKind(one)}
          >
            {one === 'all' ? 'Everything' : kindLabels[one]}
          </Chip>
        ))}
        <span className="ml-auto text-xs font-bold text-muted">
          {formatCount(shown.length)} {shown.length === 1 ? 'thing' : 'things'}
        </span>
      </div>

      {inventory.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[4/5]" />)}
        </div>
      )}

      {!inventory.loading && !shown.length && (
        <Sheet>
          <EmptyState
            mood="noResults"
            title="Nothing here yet"
            body="Take something from the marketplace and it lands here, free or paid."
            action={<Button to="/create/marketplace">Open the marketplace</Button>}
          />
        </Sheet>
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

  const views = (rows.data ?? []).reduce((sum, row) => sum + Number(row.views ?? 0), 0)
  const uses = (rows.data ?? []).reduce((sum, row) => sum + Number(row.uses ?? 0), 0)
  const asking = (rows.data ?? []).reduce((sum, row) => sum + Number(row.pending_requests ?? 0), 0)
  const askedOn = (rows.data ?? []).filter((row) => Number(row.pending_requests ?? 0) > 0).length

  return (
    <div className="space-y-5">
      <HubTop
        icon={faChartSimple}
        title="Analytics"
        lead="Counted as they happen, not as unique people. Open an item for its last thirty days."
        action={<Button variant="subtle" icon={faUpload} to="/create/uploads">My Uploads</Button>}
      />

      {!!rows.data?.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={faEye} label="Views" value={formatCount(views)} />
          <Stat icon={faHandPointer} label="Uses" value={formatCount(uses)} />
          <Stat icon={faUpload} label="Items counted" value={formatCount(rows.data.length)} />
          <Stat
            icon={faClock}
            tone={asking > 0 ? 'text-warn-bright' : undefined}
            label="Asking to use"
            value={formatCount(asking)}
            note={askedOn > 0 ? `Across ${askedOn} ${askedOn === 1 ? 'item' : 'items'}` : undefined}
          />
        </div>
      )}

      {rows.loading && <Skeleton className="h-40 rounded-2xl" />}

      {!rows.loading && !rows.data?.length && (
        <Sheet>
          <EmptyState
            mood="noResults"
            title="Nothing to measure yet"
            body="Upload something and its numbers appear here."
          />
        </Sheet>
      )}

      {!!rows.data?.length && (
        <Sheet>
          <div className="hidden grid-cols-[1fr_6rem_6rem_7rem] gap-3 border-b-2 border-ink-line bg-ink-raised/60 px-4 py-2.5 text-mini font-extrabold uppercase tracking-wide text-muted sm:grid">
            <span>Item</span>
            <span className="text-right">Views</span>
            <span className="text-right">Uses</span>
            <span className="text-right">Asking to use</span>
          </div>
          <ul>
            {rows.data.map((row) => (
              <li
                key={row.asset_id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-ink-line px-4 py-3 transition-colors last:border-0 hover:bg-ink-hover sm:grid-cols-[1fr_6rem_6rem_7rem]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <HubTile size="sm">
                    <Glyph icon={kindIcons[row.kind]} className="text-brand-bright" />
                  </HubTile>
                  <span className="min-w-0">
                    <Link
                      to={`/create/${contentTag(row.kind, row.content_id)}`}
                      className="block truncate text-sm font-bold hover:text-link"
                    >
                      {row.name}
                    </Link>
                    <span className="block font-mono text-mini text-muted">
                      {contentTag(row.kind, row.content_id)}
                    </span>
                  </span>
                </span>
                <span className="text-right text-sm font-bold tabular-nums">
                  {formatCount(Number(row.views))}
                </span>
                <span className="hidden text-right text-sm font-bold tabular-nums sm:block">
                  {formatCount(Number(row.uses))}
                </span>
                <span className="hidden text-right text-sm font-bold tabular-nums sm:block">
                  {/* A number, not a link. There is no requests page and no
                      function behind one, and a link to a page nobody built
                      lands on the content route below it and reads as a
                      broken asset. When requests get a screen, this becomes
                      a link again. */}
                  {Number(row.pending_requests) > 0
                    ? <span className="text-warn-bright">{formatCount(Number(row.pending_requests))}</span>
                    : <span className="text-muted">0</span>}
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  )
}
