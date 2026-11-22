import { useEffect, useMemo, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faUpload, faMagnifyingGlass, faTableCellsLarge, faList,
  faCircleCheck, faCircleXmark, faClock, faHardDrive, faFileArrowDown,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { HubTop, Stat, Sheet, Chip } from '@/components/create/HubShapes'
import { Input } from '@/components/ui/Input'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { GuestGate } from '@/components/ui/GuestGate'
import { contentTag, kindLabels } from '@/components/create/AssetTile'
import { UploadCard, UploadLine, size, statusLook } from '@/components/create/UploadFace'
import { useWorkingAs } from '@/components/create/WorkingAs'
import { useHub } from '@/pages/CreateHub'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { listCommunityUploads, listOwnAssets, ensureAssetPreview } from '@/lib/api'
import { cardIsCurrent } from '@/lib/preview'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AssetKind, ModerationStatus } from '@/types/db'

const CREATE = 'Creator Hub'

const kinds: (AssetKind | 'all')[] = ['all', 'image', 'audio', 'video', 'font', 'mesh', 'build']
const states: (ModerationStatus | 'all')[] = ['all', 'approved', 'pending', 'rejected']

/* ------------------------------------------------------------------ page */

export default function CreateUploads() {
  useTitle('My Uploads', CREATE)
  const { profile } = useAuth()
  const { openUpload } = useHub()
  const { target, setTarget } = useWorkingAs()

  const mine = useAsync(
    async () => (target ? listCommunityUploads(target.id) : profile ? listOwnAssets(profile.id) : []),
    [profile?.id, target?.id],
  )

  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const [state, setState] = useState<ModerationStatus | 'all'>('all')
  const [term, setTerm] = useState('')
  const [asGrid, setAsGrid] = useState(true)

  useEffect(() => {
    const reload = () => mine.reload()
    window.addEventListener('kobblon:uploaded', reload)
    return () => window.removeEventListener('kobblon:uploaded', reload)
  }, [mine])

  /*
   * Cards drawn before previews could hold transparency, redrawn here.
   *
   * Decals only, and that is on purpose: a Decal is a resize, where a mesh is
   * a WebGL context, a download and a parse. Doing twenty of those because
   * somebody opened a list would make the page crawl, and a mesh gets the
   * same treatment on its own page where exactly one is being drawn.
   *
   * One at a time rather than all at once, for the same reason the browser
   * has a limit on anything: a dozen uploads and a dozen draws in parallel
   * is a page that stops answering. Stops the moment the list changes, so
   * leaving the page does not leave work running against it.
   */
  useEffect(() => {
    if (target || !profile || !mine.data) return
    const old = mine.data.filter(
      (one) => one.kind === 'image' && one.is_public && one.preview_path
        && !cardIsCurrent(one.preview_path),
    )
    if (old.length === 0) return

    let live = true
    void (async () => {
      let drew = 0
      for (const one of old) {
        if (!live) return
        const done = await ensureAssetPreview(
          { id: one.id, kind: one.kind, file_path: one.file_path }, profile.id,
        ).catch(() => null)
        if (done) drew += 1
      }
      if (live && drew > 0) mine.reload()
    })()
    return () => { live = false }
  }, [mine.data, profile?.id, target?.id])

  const all = mine.data ?? []

  const sums = useMemo(() => ({
    live: all.filter((one) => one.status === 'approved').length,
    waiting: all.filter((one) => one.status === 'pending').length,
    refused: all.filter((one) => one.status === 'rejected').length,
    bytes: all.reduce((total, one) => total + (one.byte_size ?? 0), 0),
    taken: all.reduce((total, one) => total + (one.download_count ?? 0), 0),
  }), [all])

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return all.filter((one) => (
      (kind === 'all' || one.kind === kind)
      && (state === 'all' || one.status === state)
      && (!needle
          || one.name.toLowerCase().includes(needle)
          || contentTag(one.kind, one.content_id).toLowerCase().includes(needle))
    ))
  }, [all, kind, state, term])

  return (
    <div className="space-y-6">
      <HubTop
        icon={faUpload}
        title={target ? `${target.name}'s uploads` : 'My Uploads'}
        lead={target
          ? `Everything uploaded for ${target.name}, by anybody who builds for it. Open one to rename it, list it, or see who is asking to use it.`
          : 'Everything you have put into the Creator Hub, with its number and where it stands. Open one to rename it, list it, or see who is asking to use it.'}
        action={(
          <GuestGate action="upload">
            <Button icon={faUpload} onClick={openUpload} disabled={!profile}>Upload</Button>
          </GuestGate>
        )}
      />

      {target && (
        /*
         * Said out loud because it is the thing that confused somebody: the
         * list follows who you are working as, not who you are signed in as.
         * A Community's uploads are the Community's, whoever put them there,
         * and your own are somewhere else entirely.
         */
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-4 py-3 text-sm text-white/65">
          <span>
            You are working as <span className="font-semibold text-white/90">{target.name}</span>,
            so this is what belongs to it rather than to you.
          </span>
          <button
            type="button"
            onClick={() => setTarget(null)}
            className="font-semibold text-link underline-offset-2 hover:underline"
          >
            See your own uploads
          </button>
        </p>
      )}

      {!!all.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon={faCircleCheck} tone="text-space-bright" label="Live" value={formatCount(sums.live)} />
          <Stat icon={faClock} tone="text-warn-bright" label="In review" value={formatCount(sums.waiting)} />
          <Stat icon={faCircleXmark} tone="text-danger" label="Turned down" value={formatCount(sums.refused)} />
          <Stat icon={faHardDrive} label="Room used" value={size(sums.bytes)} />
          <Stat icon={faFileArrowDown} label="Taken" value={formatCount(sums.taken)} />
        </div>
      )}

      {!!all.length && (
        <div className="sticky kob-under-bar z-20 -mx-4 space-y-3 bg-ink/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-2">
            <Input
              icon={faMagnifyingGlass}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name or number"
              aria-label="Search your uploads"
              className="flex-1"
            />
            <div className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-b-4 border-ink-line bg-ink-card p-1">
              {([
                { on: asGrid, icon: faTableCellsLarge, label: 'As cards', act: () => setAsGrid(true) },
                { on: !asGrid, icon: faList, label: 'As a list', act: () => setAsGrid(false) },
              ]).map((one) => (
                <button
                  key={one.label}
                  onClick={one.act}
                  aria-label={one.label}
                  aria-pressed={one.on}
                  className={cn(
                    'grid h-8 w-9 place-items-center rounded-lg text-xs transition-colors',
                    one.on ? 'bg-brand text-on-art' : 'text-white/45 hover:text-white',
                  )}
                >
                  <Glyph icon={one.icon} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {kinds.map((one) => (
              <Chip key={one} on={kind === one} onClick={() => setKind(one)}>
                {one === 'all' ? 'Everything' : `${kindLabels[one]}s`}
              </Chip>
            ))}
            <span className="mx-1 hidden h-6 w-px bg-ink-line sm:block" />
            {states.map((one) => (
              <Chip key={one} on={state === one} onClick={() => setState(one)}>
                {one === 'all' ? 'Any state' : statusLook[one].label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {mine.loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      )}
      {mine.error && <ErrorState message={mine.error} onRetry={mine.reload} />}

      {!mine.loading && !all.length && (
        <Sheet>
          <EmptyState
            mood="noResults"
            title="Nothing uploaded yet"
            body="Decals, sounds, video, fonts and models. Each one gets a number, and that is how it is used."
            action={<Button icon={faUpload} onClick={openUpload}>Upload something</Button>}
          />
        </Sheet>
      )}

      {!mine.loading && !!all.length && !shown.length && (
        <Sheet>
          <EmptyState
            mood="noResults"
            title="Nothing here"
            body="Nothing of yours matches that."
            action={
              <Button
                variant="subtle"
                onClick={() => { setTerm(''); setKind('all'); setState('all') }}
              >
                Show everything
              </Button>
            }
          />
        </Sheet>
      )}

      {!!shown.length && (asGrid ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => <UploadCard key={item.id} item={item} />)}
        </div>
      ) : (
        <Sheet>
          <ul>{shown.map((item) => <UploadLine key={item.id} item={item} />)}</ul>
        </Sheet>
      ))}

      {!!shown.length && shown.length !== all.length && (
        <p className="text-xs text-muted">
          Showing {shown.length} of {all.length}.
        </p>
      )}
    </div>
  )
}
