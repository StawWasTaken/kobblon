import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUpload, faMagnifyingGlass, faTableCellsLarge, faList,
  faCircleCheck, faCircleXmark, faClock, faHardDrive, faFileArrowDown,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Choices } from '@/components/ui/Choices'
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
import { listCommunityUploads, listOwnAssets } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AssetKind, ModerationStatus } from '@/types/db'

const CREATE = 'Kobblon Create'

const kinds: (AssetKind | 'all')[] = ['all', 'image', 'audio', 'video', 'font', 'mesh', 'build']
const states: (ModerationStatus | 'all')[] = ['all', 'approved', 'pending', 'rejected']

/* ------------------------------------------------------------------ page */

function Tally({ icon, label, value, tone }: {
  icon: IconDefinition
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="rounded-2xl border border-ink-line bg-ink-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted">
        <FontAwesomeIcon icon={icon} className={tone} />
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  )
}

export default function CreateUploads() {
  useTitle('My Uploads', CREATE)
  const { profile } = useAuth()
  const { openUpload } = useHub()
  const { target } = useWorkingAs()

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            {target ? `${target.name}'s uploads` : 'My Uploads'}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Everything you have put into Create, with its number and where it stands. Open one to
            rename it, unlist it, or see who is asking to use it.
          </p>
        </div>
        <GuestGate action="upload">
          <Button icon={faUpload} onClick={openUpload} disabled={!profile}>Upload</Button>
        </GuestGate>
      </header>

      {!!all.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tally icon={faCircleCheck} tone="text-space-bright" label="Live" value={formatCount(sums.live)} />
          <Tally icon={faClock} tone="text-amber-300" label="In review" value={formatCount(sums.waiting)} />
          <Tally icon={faCircleXmark} tone="text-danger" label="Turned down" value={formatCount(sums.refused)} />
          <Tally icon={faHardDrive} label="Room used" value={size(sums.bytes)} />
          <Tally icon={faFileArrowDown} label="Taken" value={formatCount(sums.taken)} />
        </div>
      )}

      {!!all.length && (
        <div className="sticky top-14 z-20 -mx-4 space-y-3 bg-ink/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-2">
            <Input
              icon={faMagnifyingGlass}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name or number"
              aria-label="Search your uploads"
              className="flex-1"
            />
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-ink-line p-0.5">
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
                    'grid h-8 w-8 place-items-center rounded-md text-xs transition-colors',
                    one.on ? 'bg-brand text-onbrand' : 'text-white/50 hover:text-white',
                  )}
                >
                  <FontAwesomeIcon icon={one.icon} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Choices
              size="sm"
              label="What kind of content"
              value={kind}
              options={kinds.map((one) => ({
                value: one,
                label: one === 'all' ? 'Everything' : `${kindLabels[one]}s`,
              }))}
              onChange={(next) => setKind(next)}
            />
            <span className="mx-1 hidden h-5 w-px bg-ink-line sm:block" />
            <Choices
              size="sm"
              tone="soft"
              label="Which state"
              value={state}
              options={states.map((one) => ({
                value: one,
                label: one === 'all' ? 'Any state' : statusLook[one].label,
              }))}
              onChange={(next) => setState(next)}
            />
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
        <Card>
          <EmptyState
            mood="emptyBox"
            title="Nothing uploaded yet"
            body="Decals, sounds, video, fonts and models. Everything you upload gets its own number, and that number is how it is used everywhere else."
            action={<Button icon={faUpload} onClick={openUpload}>Upload something</Button>}
          />
        </Card>
      )}

      {!mine.loading && !!all.length && !shown.length && (
        <Card>
          <EmptyState
            mood="noResults"
            title="Nothing here"
            body="No upload of yours matches that. Try a shorter word, or put the filters back to everything."
            action={
              <Button
                variant="subtle"
                onClick={() => { setTerm(''); setKind('all'); setState('all') }}
              >
                Show everything
              </Button>
            }
          />
        </Card>
      )}

      {!!shown.length && (asGrid ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => <UploadCard key={item.id} item={item} />)}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <ul>{shown.map((item) => <UploadLine key={item.id} item={item} />)}</ul>
        </Card>
      ))}

      {!!shown.length && shown.length !== all.length && (
        <p className="text-xs text-muted">
          Showing {shown.length} of {all.length}.
        </p>
      )}
    </div>
  )
}
