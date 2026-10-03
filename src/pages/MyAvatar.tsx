/*
 * Your avatar, in three dimensions, which is the only kind there is now.
 *
 * It was a flat picture with things pasted onto it, and Staw asked for that
 * gone completely. The avatar is a body: it has a colour per part, it wears
 * clothes drawn into a template, and it hangs things off its head and back.
 * So the page is the body at full size and the drawers you open to change
 * it, rather than a stamp beside a grid.
 *
 * What is drawn here is `AvatarStage`, the same component a profile and a
 * profile picture use. Not a preview of what everybody else will see - the
 * thing everybody else sees.
 */
import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faStore, faXmark, faFaceSmile, faHatCowboy, faPalette,
  faCircleNotch, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  avatarOf, myAvatarItems, wearAvatarItem, takeOffSlot, setBodyColours,
  catalogUrl, assetUrl, refreshPortrait,
} from '@/lib/api'
import { K6_PARTS } from '@/engine'
import type { AvatarItem, AvatarPiece, AvatarSlot } from '@/types/db'
import type { K6Part } from '@/engine'
import { cn } from '@/lib/cn'

/** The drawers, in the order somebody opens them. */
const DRAWERS = [
  { id: 'body', label: 'Body', icon: faPalette },
  { id: 'clothing', label: 'Clothing', icon: faShirt },
  { id: 'accessories', label: 'Accessories', icon: faHatCowboy },
  { id: 'face', label: 'Face', icon: faFaceSmile },
] as const

type Drawer = (typeof DRAWERS)[number]['id']

/** Which drawer each kind of thing lives in. */
const DRAWER_OF: Record<string, Drawer> = {
  shirt: 'clothing', trousers: 'clothing', tdecal: 'clothing',
  accessory: 'accessories', hair: 'accessories', face: 'face',
}

/**
 * The colours a body starts with, and a shelf of ones to choose from.
 *
 * A short list rather than a colour wheel: every avatar on Kobblon being
 * one of thirty colours is a look, and every avatar being any of sixteen
 * million is a muddle. Staw can lengthen it; nobody has to maintain a
 * picker.
 */
const SKIN = ['#f2d08a', '#e8b878', '#d99a62', '#b9743f', '#8a5230', '#5e3620']
const CLOTH = [
  '#f4f6ff', '#c9cedb', '#8d95a6', '#4a5166', '#2a2f45', '#14161f',
  '#1b34e8', '#3a50ff', '#1cae71', '#25d68c', '#ff0033', '#ff8a1b',
  '#9b1be8', '#e8c91b', '#8a5230', '#0d1349',
]

const DEFAULT_BODY: Record<string, string> = {
  Head: '#f2d08a', Torso: '#1b34e8', LeftArm: '#f2d08a',
  RightArm: '#f2d08a', LeftLeg: '#2a2f45', RightLeg: '#2a2f45',
}

const PART_LABELS: Record<K6Part, string> = {
  Head: 'Head', Torso: 'Torso', LeftArm: 'Left arm',
  RightArm: 'Right arm', LeftLeg: 'Left leg', RightLeg: 'Right leg',
}

export default function MyAvatar() {
  useTitle('My Avatar')
  const { profile } = useAuth()
  const say = useToast()

  const [drawer, setDrawer] = useState<Drawer>('clothing')
  const [part, setPart] = useState<K6Part>('Torso')
  const [busy, setBusy] = useState<string | null>(null)

  const worn = useAsync(
    async () => (profile ? avatarOf(profile.id) : []),
    [profile?.id],
  )
  const owned = useAsync(
    async () => (profile ? myAvatarItems() : []),
    [profile?.id],
  )

  /*
   * What the stage is handed, built from what the server says rather than
   * from what this page thinks it just did. Every change reloads, so the
   * body on screen is the body in the database - which is the difference
   * between a page that shows your avatar and a page that shows its own
   * idea of it.
   */
  const look = useMemo<AvatarLook>(() => {
    const pieces = (worn.data ?? [])
      .filter((p): p is AvatarPiece & { slot: string } => !!p.slot)
      .map((p) => ({
        slot: p.slot,
        kind: p.kind ?? '',
        name: p.item_name,
        imageUrl: catalogUrl(p.image_path, p.image_bucket ?? undefined),
        meshUrl: null as string | null,
        meshFormat: p.mesh_format,
        textureUrl: null as string | null,
      }))
    return { body: worn.data?.[0]?.body ?? DEFAULT_BODY, pieces }
  }, [worn.data])

  /*
   * Models need signing for, which is a request each, so it happens after
   * the body is already on screen rather than holding it back. A person with
   * no accessories - most people - never waits for this at all.
   */
  const [models, setModels] = useState<Record<string, { mesh: string; skin: string | null }>>({})
  useMemo(() => {
    let live = true
    void (async () => {
      const wanted = (worn.data ?? []).filter((p) => p.mesh_path)
      for (const piece of wanted) {
        if (!live || !piece.slot || models[piece.slot]) continue
        const [mesh, skin] = await Promise.all([
          assetUrl(piece.mesh_path!).catch(() => null),
          piece.texture_path ? assetUrl(piece.texture_path).catch(() => null) : null,
        ])
        if (live && mesh) setModels((had) => ({ ...had, [piece.slot!]: { mesh, skin } }))
      }
    })()
    return () => { live = false }
  }, [worn.data])

  const dressed = useMemo<AvatarLook>(() => ({
    body: look.body,
    pieces: look.pieces.map((piece) => {
      const model = models[piece.slot]
      return model ? { ...piece, meshUrl: model.mesh, textureUrl: model.skin } : piece
    }),
  }), [look, models])

  const after = async (what: string, doIt: () => Promise<void>) => {
    setBusy(what)
    try {
      await doIt()
      worn.reload()
      owned.reload()
      /*
       * The profile picture is this avatar's head, so it is taken again
       * whenever the avatar changes. Deliberately not awaited: it is a
       * render and an upload, and nobody should watch a spinner for a
       * picture of themselves they are not currently looking at.
       *
       * Nothing fails because of it either. A portrait that did not draw
       * leaves the one they had, which is out of date for a moment rather
       * than broken.
       */
      void takePortrait()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  /*
   * Read fresh rather than from what is on screen: this runs right after a
   * change, and the look held above is the one from before it. Asking the
   * server is the difference between a portrait of what somebody just did
   * and a portrait of what they had done before that.
   */
  const takePortrait = async () => {
    if (!profile) return
    const now = await avatarOf(profile.id).catch(() => null)
    if (!now) return

    const pieces = await Promise.all(now.filter((p) => p.slot).map(async (p) => ({
      slot: p.slot!,
      imageUrl: catalogUrl(p.image_path, p.image_bucket ?? undefined),
      meshUrl: p.mesh_path ? await assetUrl(p.mesh_path).catch(() => null) : null,
      textureUrl: p.texture_path ? await assetUrl(p.texture_path).catch(() => null) : null,
    })))

    await refreshPortrait(profile.id, {
      body: now[0]?.body ?? DEFAULT_BODY,
      pieces,
    }).catch(() => null)
  }

  const paint = (which: K6Part, colour: string) => {
    const next = { ...(look.body ?? DEFAULT_BODY), [which]: colour }
    void after(`paint:${which}`, () => setBodyColours(next))
  }

  const onNow = useMemo(() => {
    const by = new Map<string, string>()
    for (const piece of worn.data ?? []) if (piece.slot && piece.item_id) by.set(piece.slot, piece.item_id)
    return by
  }, [worn.data])

  const shelf = (owned.data ?? []).filter((item) => DRAWER_OF[item.kind] === drawer)

  if (!profile) return null

  return (
    <Page className="space-y-5">
      <PageHeader
        title="My Avatar"
        lead="Your body, what it wears, and the face on it."
        icon={faShirt}
        actions={<Button to="/catalog" icon={faStore}>The Catalog</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* --------------------------------------------------- the person */}
        <div className="space-y-3">
          <Card className="overflow-hidden p-0">
            <div className="bg-gradient-to-b from-[#1a1f3a] to-[#0f1120]">
              {worn.loading
                ? <Skeleton className="aspect-square w-full" />
                : <AvatarStage look={dressed} handled />}
            </div>
          </Card>

          <Card className="space-y-2">
            <p className="font-display text-xs uppercase tracking-wider text-muted">
              Wearing
            </p>
            {onNow.size === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(worn.data ?? []).filter((p) => p.slot).map((piece) => (
                  <li key={piece.slot} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{piece.item_name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === `off:${piece.slot}`}
                      onClick={() => void after(
                        `off:${piece.slot}`,
                        () => takeOffSlot(piece.slot as AvatarSlot),
                      )}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* --------------------------------------------------- the drawers */}
        <div className="space-y-4">
          <Tabs
            value={drawer}
            onChange={(next) => setDrawer(next as Drawer)}
            options={DRAWERS.map((one) => ({ value: one.id, label: one.label }))}
          />

          {drawer === 'body' ? (
            <Card className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {K6_PARTS.map((one) => (
                  <button
                    key={one}
                    type="button"
                    onClick={() => setPart(one)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                      part === one
                        ? 'bg-brand text-white'
                        : 'bg-ink-hover text-white/70 hover:text-white',
                    )}
                  >
                    {PART_LABELS[one]}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                  Skin
                </p>
                <Swatches
                  colours={SKIN}
                  current={look.body?.[part]}
                  busy={busy === `paint:${part}`}
                  onPick={(colour) => paint(part, colour)}
                />
                <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                  Everything else
                </p>
                <Swatches
                  colours={CLOTH}
                  current={look.body?.[part]}
                  busy={busy === `paint:${part}`}
                  onPick={(colour) => paint(part, colour)}
                />
              </div>
            </Card>
          ) : owned.loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : shelf.length === 0 ? (
            <EmptyState
              mood="emptyBox"
              title="Nothing here yet"
              body="Everything you take from the Catalog turns up in this drawer."
              action={<Button to="/catalog" icon={faStore}>Open the Catalog</Button>}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {shelf.map((item) => (
                <WornTile
                  key={item.id}
                  item={item}
                  on={onNow.get(item.slot) === item.id}
                  busy={busy === `wear:${item.id}`}
                  onToggle={() => void after(
                    `wear:${item.id}`,
                    () => (onNow.get(item.slot) === item.id
                      ? takeOffSlot(item.slot)
                      : wearAvatarItem(item.id)),
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}

function Swatches({ colours, current, busy, onPick }: {
  colours: string[]
  current?: string
  busy?: boolean
  onPick: (colour: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colours.map((colour) => (
        <button
          key={colour}
          type="button"
          disabled={busy}
          onClick={() => onPick(colour)}
          title={colour}
          aria-label={colour}
          className={cn(
            'grid h-9 w-9 place-items-center rounded-lg border-2 transition-transform',
            'hover:scale-110 disabled:opacity-50',
            current?.toLowerCase() === colour.toLowerCase()
              ? 'border-white'
              : 'border-ink-line',
          )}
          style={{ background: colour }}
        >
          {current?.toLowerCase() === colour.toLowerCase() && (
            <FontAwesomeIcon
              icon={faCheck}
              className="text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            />
          )}
        </button>
      ))}
    </div>
  )
}

function WornTile({ item, on, busy, onToggle }: {
  item: AvatarItem
  on: boolean
  busy: boolean
  onToggle: () => void
}) {
  const picture = catalogUrl(item.image_path, item.image_bucket ?? undefined)
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className={cn(
        'group overflow-hidden rounded-xl border bg-ink-card text-left transition-colors',
        on ? 'border-brand' : 'border-ink-line hover:border-brand/60',
      )}
    >
      <div className="relative grid aspect-square place-items-center overflow-hidden bg-media">
        {picture ? (
          <img src={picture} alt="" draggable={false} className="h-full w-full object-contain" />
        ) : (
          <FontAwesomeIcon icon={faHatCowboy} className="text-2xl text-white/30" />
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-ink/60">
            <FontAwesomeIcon icon={faCircleNotch} className="animate-spin text-white/70" />
          </span>
        )}
        {on && !busy && (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md bg-brand text-[11px] text-white">
            <FontAwesomeIcon icon={faCheck} />
          </span>
        )}
      </div>
      <p className="truncate p-2.5 text-xs font-bold">{item.name}</p>
    </button>
  )
}
