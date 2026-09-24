import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare, faBell, faCheck, faCopy, faImage, faLink, faPlus,
  faTrash, faUpload, faVideo,
} from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { Cropper } from '@/components/ui/Cropper'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, CREATE_ICON, useFavicon } from '@/hooks/useTitle'
import {
  addWorldMedium, announceWorldUpdate, configureWorld, myWorlds, publishWorld,
  removeWorldMedium, uploadWorldFile, worldFileUrl, worldGenres, worldMedia,
} from '@/lib/api'
import { worldLink } from '@/lib/links'
import type { WorldMaturity } from '@/types/db'

/*
 * Setting a World up, on the website.
 *
 * The same job Creator does on the desktop, through the same function, so
 * that a World is not one thing here and another thing there. What Creator
 * writes is the scene; what this writes is everything else about it.
 */

const maturities: { value: WorldMaturity; label: string; note: string }[] = [
  { value: 'everyone', label: 'Everyone', note: 'Nothing anybody needs warning about' },
  { value: 'mild', label: 'Mild', note: 'A little cartoon violence, mild fright' },
  { value: 'moderate', label: 'Moderate', note: 'Repeated violence, or frightening scenes' },
  { value: 'strong', label: 'Strong', note: 'Strong violence or themes for older players' },
]

/** A Select carries its label for a screen reader, not on the page. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  )
}

export default function CreateWorld() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  useFavicon(CREATE_ICON)

  const worlds = useAsync(async () => (profile ? myWorlds() : []), [profile?.id])
  const world = worlds.data?.find((one) => one.id === id) ?? null
  const genres = useAsync(worldGenres, [])
  const media = useAsync(async () => (world ? worldMedia(world.id) : []), [world?.id])

  useTitle(world?.name ?? 'World', 'Kobblon Create')

  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [genre, setGenre] = useState('')
  const [maturity, setMaturity] = useState<WorldMaturity>('everyone')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  /*
   * An emblem is drawn square everywhere it appears, so something has to
   * cut it. Better the person who chose the picture decides which part
   * survives than the browser deciding for them.
   */
  const [cropping, setCropping] = useState<File | null>(null)

  const emblemInput = useRef<HTMLInputElement>(null)
  const shotInput = useRef<HTMLInputElement>(null)

  // The form starts as what the World already says, not as blanks that would
  // wipe it the moment somebody pressed Save.
  useEffect(() => {
    if (!world) return
    setName(world.name)
    setAbout(world.description ?? '')
    setGenre(world.genre ?? '')
    setMaturity((world.maturity as WorldMaturity) ?? 'everyone')
  }, [world?.id])

  if (worlds.loading) return <Skeleton className="h-64" />
  if (worlds.error) return <ErrorState message={worlds.error} onRetry={worlds.reload} />

  if (!world) {
    return (
      <Card className="p-8 text-center">
        <FontAwesomeIcon icon={worldIcon} className="text-2xl text-white/25" />
        <h1 className="mt-3 font-display text-xl font-extrabold">No World of yours here</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Either that number is not one of yours, or it has been taken down.
        </p>
        <Button className="mt-5" variant="subtle" to="/create/worlds">Back to my Worlds</Button>
      </Card>
    )
  }

  const here = worldLink(world)
  const address = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${here}`

  /** Copying is offered, and told plainly when the browser refuses it. */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Your browser would not let Kobblon copy that. Select it and copy it yourself.')
    }
  }

  const run = async (what: () => Promise<unknown>, said: string) => {
    setBusy(true)
    try {
      await what()
      await Promise.all([worlds.reload(), media.reload()])
      toast(said)
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(
    () => configureWorld(world.id, {
      name: name.trim(),
      description: about,
      genre: genre || null,
      maturity,
    }),
    'Saved.',
  )

  const pickEmblem = (file: File) => run(async () => {
    const path = await uploadWorldFile(world.id, file, 'emblem')
    await configureWorld(world.id, { cover: path })
  }, 'Emblem set.')

  const addShot = (file: File) => run(async () => {
    const kind = file.type.startsWith('video/') ? 'video' : 'image'
    const path = await uploadWorldFile(world.id, file, 'shot')
    await addWorldMedium(world.id, kind, path, (media.data?.length ?? 0))
  }, 'Added.')

  return (
    <div className="space-y-6">
      <PageHeader
        title={world.name}
        lead="What this World says about itself. Creator writes the scene; this is everything else."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={world.is_published ? 'brand' : 'warm'}>
          {world.is_published ? 'Published' : 'Not published'}
        </Badge>
        {world.content_id ? <Badge tone="neutral">WLD-{world.content_id}</Badge> : null}
      </div>

      {/*
        * Where this World lives, in full, because the thing somebody wants
        * from this page more than anything else is the link to send people.
        */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <FontAwesomeIcon icon={faLink} className="text-muted" />
        <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-raised px-3 py-2 text-xs text-white/80">
          {address}
        </code>
        <Button
          size="sm"
          variant="subtle"
          icon={copied ? faCheck : faCopy}
          onClick={() => void copy()}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant="ghost" icon={faArrowUpRightFromSquare} onClick={() => navigate(here)}>
          Open
        </Button>
        {!world.is_published && (
          <p className="w-full text-xs text-muted">
            This address only answers for you until the World is published.
          </p>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <SectionHeader title="What it is" />

        <Input
          label="Name"
          value={name}
          maxLength={48}
          onChange={(e) => setName(e.target.value)}
        />

        <Textarea
          label="Description"
          labelNote="What somebody reads before deciding"
          rows={5}
          maxLength={600}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Genre">
            <Select
              label="Genre"
              value={genre}
              onChange={setGenre}
              options={[
                { value: '', label: 'Not set' },
                ...(genres.data ?? []).map((one) => ({ value: one.id, label: one.label })),
              ]}
            />
          </Field>
          <Field label="Maturity">
            <Select
              label="Maturity"
              value={maturity}
              onChange={(value) => setMaturity(value as WorldMaturity)}
              options={maturities.map((one) => ({
                value: one.value, label: one.label, note: one.note,
              }))}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy || !name.trim()}>Save</Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <SectionHeader title="How it looks" />
        <p className="text-sm text-muted">
          The emblem is what this World is known by, everywhere it appears. The rest is what
          somebody sees on its page, in the order they are added here.
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-media">
            {world.cover_url
              ? <img src={world.cover_url} alt="" className="h-full w-full object-cover" />
              : <FontAwesomeIcon icon={faImage} className="text-white/30" />}
          </span>
          <div>
            <Button
              size="sm"
              variant="subtle"
              icon={faUpload}
              disabled={busy}
              onClick={() => emblemInput.current?.click()}
            >
              {world.cover_url ? 'Change the emblem' : 'Set an emblem'}
            </Button>
            <p className="mt-1.5 text-xs text-muted">A square picture works best.</p>
          </div>
          <input
            ref={emblemInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) setCropping(file)
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(media.data ?? []).map((one) => (
            <div
              key={one.id}
              className="group relative aspect-video overflow-hidden rounded-lg border border-ink-line bg-media"
            >
              {one.kind === 'video' ? (
                <span className="grid h-full w-full place-items-center text-white/50">
                  <FontAwesomeIcon icon={faVideo} />
                </span>
              ) : (
                <img src={worldFileUrl(one.path)} alt="" className="h-full w-full object-cover" />
              )}
              <button
                onClick={() => void run(() => removeWorldMedium(one), 'Taken off.')}
                disabled={busy}
                aria-label="Take this off the page"
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}

          <button
            onClick={() => shotInput.current?.click()}
            disabled={busy || (media.data?.length ?? 0) >= 12}
            className="grid aspect-video place-items-center rounded-lg border border-dashed border-ink-line text-sm text-muted transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
          >
            <span className="flex flex-col items-center gap-1">
              <FontAwesomeIcon icon={faPlus} />
              Add
            </span>
          </button>
          <input
            ref={shotInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void addShot(file)
            }}
          />
        </div>
      </Card>

      {world.is_published && (
        <Card className="space-y-4 p-5">
          <SectionHeader title="Tell people it changed" />
          <p className="text-sm text-muted">
            Everybody who pressed Notify on this World gets one notification, and it
            takes them here. Once every six hours, because a World that announces
            itself all day is a World people switch off.
          </p>
          <Input
            label="What changed"
            labelNote="Left empty, it just says the World was updated"
            value={announcement}
            maxLength={200}
            onChange={(e) => setAnnouncement(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              icon={faBell}
              variant="subtle"
              disabled={busy}
              onClick={() => void run(async () => {
                const told = await announceWorldUpdate(world.id, announcement)
                setAnnouncement('')
                return told
              }, 'Everybody watching has been told.')}
            >
              Announce an update
            </Button>
          </div>
        </Card>
      )}

      <Cropper
        file={cropping}
        open={Boolean(cropping)}
        aspect={1}
        onCancel={() => setCropping(null)}
        onDone={(cut) => {
          setCropping(null)
          void pickEmblem(cut)
        }}
      />

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">
            {world.is_published ? 'This World is out' : 'This World is not out yet'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {world.is_published
              ? 'Anybody can find it and play it. Taking it back in hides the page and stops the Launcher opening it.'
              : 'Nobody but you can see it. Publishing puts it on Kobblon and lets the Launcher open it.'}
          </p>
        </div>
        <Button
          variant={world.is_published ? 'ghost' : 'primary'}
          disabled={busy}
          onClick={() => void run(
            () => publishWorld(world.id, !world.is_published),
            world.is_published ? 'Taken back in.' : 'Published.',
          )}
        >
          {world.is_published ? 'Take it back in' : 'Publish'}
        </Button>
      </Card>
    </div>
  )
}
