import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  faArrowUpRightFromSquare, faBell, faCheck, faCopy, faImage, faLink, faPlus,
  faTrash, faUpload, faVideo, faCircleCheck, faCircleXmark, faPen,
  faEye, faBookmark, faThumbsUp, faCircleExclamation,
  faArrowLeft, faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { worldIcon } from '@/lib/naming'
import {
  HubTop, Stat, Head, Sheet, Chip, Flag, LiveFlag,
} from '@/components/create/HubShapes'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { MakeThings } from '@/components/worlds/MakeThings'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { Cropper } from '@/components/ui/Cropper'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle, CREATE_ICON, useFavicon } from '@/hooks/useTitle'
import {
  addWorldMedium, announceWorldUpdate, configureWorld, myWorlds, publishWorld,
  removeWorldMedium, setWorldMediaOrder, uploadWorldFile, worldFileUrl,
  worldGenres, worldMedia,
} from '@/lib/api'
import { worldLink } from '@/lib/links'
import { deviceIcons, deviceLabels, everyDevice, worldTag, worldNumber } from '@/lib/kinds'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { WorldDevice, WorldMaturity } from '@/types/db'

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

/**
 * One of the two pictures a World wears, with the shape it is cut to and
 * where it turns up.
 *
 * Saying where each one shows is the point: the page had one uploader
 * called "emblem" that saved into the wide slot, and nobody could have
 * known from looking at it.
 */
function ArtSlot({ title, note, shape, art, where, busy, onPick, onClear }: {
  title: string
  note: string
  shape: 'square' | 'wide'
  art: string | null
  where: string
  busy: boolean
  onPick: () => void
  onClear?: () => void
}) {
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-ink-line p-4 last:border-0">
      <span className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-b-4 border-ink-line bg-media',
        shape === 'square' ? 'h-24 w-24' : 'h-24 w-[10.65rem]',
      )}>
        {art
          ? <img src={art} alt="" className="h-full w-full object-cover" />
          : <Glyph icon={faImage} className="text-xl text-white/25" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-display text-base font-extrabold">
          {title}
          {art
            ? <Flag tone="bg-space/15 text-space-bright" icon={faCircleCheck}>Set</Flag>
            : <Flag tone="bg-warn/15 text-warn-bright" icon={faCircleExclamation}>Missing</Flag>}
        </p>
        <p className="mt-1 text-xs leading-snug text-muted">{note}</p>
        <p className="mt-1 text-mini font-bold uppercase tracking-wide text-white/35">{where}</p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button size="sm" variant="subtle" icon={faUpload} disabled={busy} onClick={onPick}>
            {art ? 'Change it' : 'Choose a picture'}
          </Button>
          {onClear && (
            <Button size="sm" variant="ghost" icon={faTrash} disabled={busy} onClick={onClear}>
              Take it off
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CreateWorld() {
  /*
   * `WLD-1069`, a bare `1069`, or the row's uuid. The uuid is what this
   * page was addressed by for its whole life, so links already sent still
   * land; everything the site writes now says the number, which is what
   * the rest of the product calls a World.
   */
  const { id = '' } = useParams()
  const navigate = useNavigate()
  /*
   * The add tile on the World page comes here with `?make=badge` or
   * `?make=pass`, so a plus pressed over there opens the right form rather
   * than dropping somebody on a settings page to go looking for it.
   */
  const [asked] = useSearchParams()
  const make = asked.get('make')
  const { profile } = useAuth()
  const toast = useToast()
  useFavicon(CREATE_ICON)

  const worlds = useAsync(async () => (profile ? myWorlds() : []), [profile?.id])
  const wanted = worldNumber(id)
  const world = worlds.data?.find(
    (one) => one.id === id || (wanted !== null && one.content_id === wanted),
  ) ?? null
  const genres = useAsync(worldGenres, [])
  const media = useAsync(async () => (world ? worldMedia(world.id) : []), [world?.id])

  useTitle(world?.name ?? 'World', 'Creator Hub')

  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [genre, setGenre] = useState('')
  const [maturity, setMaturity] = useState<WorldMaturity>('everyone')
  /*
   * What it runs on. Everything published before the column existed says
   * all four, so a World that has never been asked the question starts here
   * saying yes to everything rather than being quietly unfindable.
   */
  const [devices, setDevices] = useState<WorldDevice[]>(everyDevice)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  /*
   * An emblem is drawn square everywhere it appears, so something has to
   * cut it. Better the person who chose the picture decides which part
   * survives than the browser deciding for them.
   */
  const [cropping, setCropping] = useState<{ file: File; slot: 'emblem' | 'cover' } | null>(null)

  const emblemInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const shotInput = useRef<HTMLInputElement>(null)

  // The form starts as what the World already says, not as blanks that would
  // wipe it the moment somebody pressed Save.
  useEffect(() => {
    if (!world) return
    setName(world.name)
    setAbout(world.description ?? '')
    setGenre(world.genre ?? '')
    setMaturity((world.maturity as WorldMaturity) ?? 'everyone')
    setDevices(world.devices?.length ? world.devices : everyDevice)
  }, [world?.id])

  if (worlds.loading) return <Skeleton className="h-64" />
  if (worlds.error) return <ErrorState message={worlds.error} onRetry={worlds.reload} />

  if (!world) {
    return (
      <Card className="p-8 text-center">
        <Glyph icon={worldIcon} className="text-2xl text-white/25" />
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
      devices,
    }),
    'Saved.',
  )

  /*
   * Two pictures, two shapes, two columns.
   *
   * This page used to cut one picture square and save it to `cover_url`,
   * the wide slot, while `emblem_url` - which every reader coalesces to
   * first - was never written by anything. So a square was being stretched
   * across every 16/9 cover on Kobblon. 0367 gave `configure_world` the
   * second argument; this gives the page the second uploader.
   */
  const setArt = (file: File, slot: 'emblem' | 'cover') => run(async () => {
    const path = await uploadWorldFile(world.id, file, slot)
    await configureWorld(world.id, slot === 'emblem' ? { emblem: path } : { cover: path })
  }, slot === 'emblem' ? 'Emblem set.' : 'Thumbnail set.')

  const clearArt = (slot: 'emblem' | 'cover') => run(
    () => configureWorld(world.id, slot === 'emblem' ? { emblem: '' } : { cover: '' }),
    'Taken off.',
  )

  /** Moving one picture along the row it is shown in. */
  const shift = (at: number, by: number) => {
    const order = (media.data ?? []).map((one) => one.id)
    const to = at + by
    if (to < 0 || to >= order.length) return
    const moved = [...order]
    const [one] = moved.splice(at, 1)
    moved.splice(to, 0, one)
    void run(() => setWorldMediaOrder(moved), 'Moved.')
  }

  const addShot = (file: File) => run(async () => {
    const kind = file.type.startsWith('video/') ? 'video' : 'image'
    const path = await uploadWorldFile(world.id, file, 'shot')
    await addWorldMedium(world.id, kind, path, (media.data?.length ?? 0))
  }, 'Added.')

  const art = {
    emblem: world.emblem_url,
    // Worlds set up before 0367 have their one picture in the cover.
    cover: world.cover_url,
  }

  const needs = [
    { done: !!world.name.trim(), what: 'A name' },
    { done: (world.description ?? '').trim().length >= 20, what: 'A description people can read before deciding' },
    { done: !!world.genre, what: 'A genre, so Discover knows where to put it' },
    { done: !!art.emblem, what: 'An emblem, for lists and tiles' },
    { done: !!art.cover, what: 'A thumbnail, for its own page and Discover' },
    /* Null, not empty, is what a World published before the column says,
       and that means all four - so it is not a thing anybody has to fix. */
    { done: (world.devices?.length ?? everyDevice.length) > 0, what: 'At least one thing it runs on' },
  ]
  const left = needs.filter((one) => !one.done).length

  return (
    <div className="space-y-7">
      <HubTop
        icon={worldIcon}
        title={world.name}
        lead="Workspace writes the scene; this is everything else about it - what it is called, what it looks like, who it is for, and whether it is out."
        action={(
          <Button variant="subtle" icon={faArrowUpRightFromSquare} onClick={() => navigate(here)}>
            Open its page
          </Button>
        )}
      />

      {/* Where it stands, and the thing people come to this page for. */}
      <div className="flex flex-wrap items-center gap-2">
        {world.is_published
          ? <LiveFlag />
          : <Flag tone="bg-ink-raised text-white/60" icon={faPen}>Not published</Flag>}
        {world.content_id
          ? <Flag tone="bg-ink-raised text-white/60" icon={worldIcon}>{worldTag(world.content_id)}</Flag>
          : null}

        <span className="ml-auto flex min-w-0 items-center gap-2">
          <Glyph icon={faLink} className="text-muted" />
          <code className="min-w-0 truncate rounded-lg border-2 border-ink-line bg-ink-raised px-3 py-1.5 text-xs text-white/80">
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
        </span>
        {!world.is_published && (
          <p className="w-full text-xs text-muted">
            That address only answers for you until the World is published.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={faEye} label="Visits" value={formatCount(world.visit_count ?? 0)} />
        <Stat
          mark={<Glyph icon={faThumbsUp} on className="text-brand-bright" />}
          label="Likes"
          value={formatCount(world.like_count ?? 0)}
        />
        <Stat icon={faBookmark} label="Saved" value={formatCount(world.favourite_count ?? 0)} />
        <Stat
          icon={faCircleCheck}
          label="Runs on"
          value={String((world.devices?.length ? world.devices : everyDevice).length)}
          note={(world.devices?.length ? world.devices : everyDevice)
            .map((one) => deviceLabels[one]).join(', ')}
        />
      </div>

      {/* ----------------------------------------------------------- what */}
      <section>
        <Head>What it is</Head>
        <Sheet className="space-y-4 p-4">
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

          <div>
            <p className="mb-1.5 text-mini font-extrabold uppercase tracking-wide text-muted">Genre</p>
            {genres.loading
              ? <Skeleton className="h-9 w-64" />
              : (
                <div className="flex flex-wrap gap-2">
                  {(genres.data ?? []).map((one) => (
                    <Chip key={one.id} on={genre === one.id} onClick={() => setGenre(one.id)}>
                      {one.label}
                    </Chip>
                  ))}
                </div>
              )}
          </div>

          <div>
            <p className="mb-1.5 text-mini font-extrabold uppercase tracking-wide text-muted">
              Who it is for
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {maturities.map((one) => (
                <button
                  key={one.value}
                  type="button"
                  onClick={() => setMaturity(one.value)}
                  aria-pressed={maturity === one.value}
                  className={cn(
                    'kob-press rounded-xl border-2 px-3 py-2 text-left transition-colors',
                    maturity === one.value
                      ? 'border-brand-deep border-b-[6px] bg-brand text-on-art'
                      : 'border-ink-line border-b-4 bg-ink-card hover:border-brand/50',
                  )}
                >
                  <span className="block font-display text-sm font-extrabold">{one.label}</span>
                  <span className={cn(
                    'mt-0.5 block text-mini leading-snug',
                    maturity === one.value ? 'text-on-art/75' : 'text-muted',
                  )}>
                    {one.note}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="yes" onClick={save} disabled={busy || !name.trim()}>Save</Button>
          </div>
        </Sheet>
      </section>

      {/* ------------------------------------------------------------ art */}
      <section>
        <Head>How it looks</Head>
        <Sheet>
          <ArtSlot
            title="Emblem"
            shape="square"
            art={art.emblem}
            note="A square picture. Cut to a square here, so nothing is squashed later."
            where="Lists · tiles · the Launcher · your Worlds"
            busy={busy}
            onPick={() => emblemInput.current?.click()}
            onClear={art.emblem ? () => void clearArt('emblem') : undefined}
          />
          <ArtSlot
            title="Thumbnail"
            shape="wide"
            art={art.cover}
            note="A wide picture, 16 by 9. This is the big one at the top of its page."
            where="Its own page · Discover · what gets shared"
            busy={busy}
            onPick={() => coverInput.current?.click()}
            onClear={art.cover ? () => void clearArt('cover') : undefined}
          />
        </Sheet>

        <input
          ref={emblemInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) setCropping({ file, slot: 'emblem' })
          }}
        />
        <input
          ref={coverInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) setCropping({ file, slot: 'cover' })
          }}
        />
      </section>

      {/* -------------------------------------------------------- gallery */}
      <section>
        <Head>What its page shows</Head>
        <Sheet className="p-4">
          <p className="mb-3 text-xs text-muted">
            Up to twelve pictures and videos, in this order. The arrows move one along.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(media.data ?? []).map((one, at) => (
              <div
                key={one.id}
                className="group relative aspect-video overflow-hidden rounded-xl border-2 border-ink-line bg-media"
              >
                {one.kind === 'video' ? (
                  <span className="grid h-full w-full place-items-center text-white/50">
                    <Glyph icon={faVideo} />
                  </span>
                ) : (
                  <img src={worldFileUrl(one.path)} alt="" className="h-full w-full object-cover" />
                )}

                <span className="absolute bottom-1.5 left-1.5 rounded-lg bg-ink/80 px-1.5 text-mini font-bold tabular-nums">
                  {at + 1}
                </span>

                <div className="absolute inset-x-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    onClick={() => shift(at, -1)}
                    disabled={busy || at === 0}
                    aria-label="Move this one earlier"
                    className="grid h-7 w-7 place-items-center rounded-lg bg-ink/80 text-tiny text-white/70 hover:text-white disabled:opacity-30"
                  >
                    <Glyph icon={faArrowLeft} />
                  </button>
                  <button
                    onClick={() => shift(at, 1)}
                    disabled={busy || at === (media.data?.length ?? 0) - 1}
                    aria-label="Move this one later"
                    className="grid h-7 w-7 place-items-center rounded-lg bg-ink/80 text-tiny text-white/70 hover:text-white disabled:opacity-30"
                  >
                    <Glyph icon={faArrowRight} />
                  </button>
                  <button
                    onClick={() => void run(() => removeWorldMedium(one), 'Taken off.')}
                    disabled={busy}
                    aria-label="Take this off the page"
                    className="ml-auto grid h-7 w-7 place-items-center rounded-lg bg-ink/80 text-tiny text-white/70 hover:bg-danger hover:text-white"
                  >
                    <Glyph icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => shotInput.current?.click()}
              disabled={busy || (media.data?.length ?? 0) >= 12}
              className="grid aspect-video place-items-center rounded-xl border-2 border-b-4 border-dashed border-ink-line bg-ink-raised text-sm text-muted transition-colors hover:border-brand/60 hover:text-white disabled:opacity-40"
            >
              <span className="flex flex-col items-center gap-1">
                <Glyph icon={faPlus} />
                Add
              </span>
            </button>
          </div>

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
        </Sheet>
      </section>

      {/* ----------------------------------------------------------- runs */}
      <section>
        <Head>What it runs on</Head>
        <Sheet className="p-4">
          {/*
            * Four yes-or-nos rather than a dropdown, and the last one
            * cannot be turned off: a World that runs on nothing is a World
            * nobody can find, and the database refuses it anyway (0343).
            */}
          <div className="flex flex-wrap gap-2">
            {everyDevice.map((one) => {
              const on = devices.includes(one)
              const last = on && devices.length === 1
              return (
                <Tooltip key={one} label={last ? 'It has to run on something' : deviceLabels[one]}>
                  <Chip
                    on={on}
                    icon={deviceIcons[one]}
                    onClick={() => {
                      if (last) return
                      setDevices((was) => (
                        was.includes(one) ? was.filter((x) => x !== one) : [...was, one]
                      ))
                    }}
                  >
                    {deviceLabels[one]}
                  </Chip>
                </Tooltip>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            Discover lets people keep the Worlds that run on what they are holding. Save when you
            have changed it.
          </p>
        </Sheet>
      </section>

      {/* --------------------------------------------------------- things */}
      <section>
        <Head>Badges and gamepasses</Head>
        <MakeThings worldId={world.id} kind="badge" opened={make === 'badge'} />
        <MakeThings worldId={world.id} kind="pass" opened={make === 'pass'} />
      </section>

      {/* ------------------------------------------------------------ out */}
      <section>
        <Head>Putting it out</Head>
        <Sheet>
          <div className="flex flex-wrap items-center gap-4 border-b-2 border-ink-line p-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-extrabold">
                {world.is_published ? 'This World is out' : 'This World is not out yet'}
              </p>
              <p className="mt-0.5 text-sm text-muted">
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
          </div>

          {/*
            * The checklist, which the page did not have: publishing was one
            * press that said nothing about what a World needs first, and
            * Worlds went out with no description, no genre and no picture.
            * It does not block the button - a World can go out half-dressed
            * if somebody means it to - it just stops that being a surprise.
            */}
          <div className="border-b-2 border-ink-line">
            <p className="flex items-center gap-2 px-4 pb-1 pt-3 font-display text-tiny font-extrabold uppercase tracking-[0.18em] text-white/40">
              Before it goes out
              {left > 0 && (
                <Flag tone="bg-warn/15 text-warn-bright" icon={faCircleExclamation}>
                  {left} left
                </Flag>
              )}
            </p>
            <ul>
              {needs.map((one) => (
                <li
                  key={one.what}
                  className="flex items-center gap-2.5 border-b border-ink-line px-4 py-2.5 text-sm last:border-0"
                >
                  <span className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2',
                    one.done
                      ? 'border-space/40 bg-space/15 text-space-bright'
                      : 'border-ink-line bg-ink-raised text-white/30',
                  )}>
                    <Glyph icon={one.done ? faCircleCheck : faCircleXmark} className="text-tiny" />
                  </span>
                  <span className={one.done ? 'text-white/70' : 'font-bold text-white'}>
                    {one.what}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {world.is_published && (
            <div className="space-y-3 p-4">
              <p className="font-display text-sm font-extrabold">Tell people it changed</p>
              <p className="text-xs leading-relaxed text-muted">
                Everybody who pressed Notify on this World gets one notification, and it takes
                them here. Once every six hours, because a World that announces itself all day is
                a World people switch off.
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
            </div>
          )}
        </Sheet>
      </section>

      {/* Square for the emblem, 16/9 for the thumbnail: the cut belongs to
          the slot, so neither picture is squashed where it is shown. */}
      <Cropper
        file={cropping?.file ?? null}
        open={Boolean(cropping)}
        aspect={cropping?.slot === 'cover' ? 16 / 9 : 1}
        onCancel={() => setCropping(null)}
        onDone={(cut) => {
          const slot = cropping?.slot ?? 'emblem'
          setCropping(null)
          void setArt(cut, slot)
        }}
      />

    </div>
  )
}
