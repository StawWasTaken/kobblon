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
import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faStore, faXmark, faFaceSmile, faHatCowboy, faPalette, faFolder,
  faCircleNotch, faCheck, faPlus,
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
  wornBy, myAvatarItems, wearAvatarItem, takeOffItem, setBodyColours,
  catalogUrl, assetUrl, refreshPortrait, cardFor,
} from '@/lib/api'
import { K6_PARTS } from '@/engine'
import type { AvatarItem, AvatarPiece } from '@/types/db'
import type { K6Part } from '@/engine'
import { forgetHeadshot } from '@/lib/headshots'
import { Outfits } from '@/components/avatar/Outfits'
import { cn } from '@/lib/cn'
import { BodyPicker, readsAsBare } from '@/components/avatar/BodyPicker'
import { Studio } from '@/components/avatar/Studio'

/** The drawers, in the order somebody opens them. */
const DRAWERS = [
  { id: 'body', label: 'Body', icon: faPalette },
  { id: 'clothing', label: 'Clothing', icon: faShirt },
  { id: 'accessories', label: 'Accessories', icon: faHatCowboy },
  { id: 'face', label: 'Face', icon: faFaceSmile },
  // Saved looks, which are not a kind of thing you own but a way of putting
  // the things you own back on.
  { id: 'outfits', label: 'Outfits', icon: faFolder },
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
  const { profile, refreshProfile } = useAuth()
  const say = useToast()

  const [drawer, setDrawer] = useState<Drawer>('clothing')
  /*
   * Which parts a swatch would paint. More than one, because "both arms"
   * is one thought and used to be two trips through the colours.
   */
  const [parts, setParts] = useState<K6Part[]>(['Torso'])
  const [busy, setBusy] = useState<string | null>(null)

  const worn = useAsync(
    async () => (profile ? wornBy(profile.id) : []),
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
        itemId: p.item_id,
        kind: p.kind ?? '',
        name: p.item_name,
        imageUrl: catalogUrl(p.image_path, p.image_bucket ?? undefined),
        meshUrl: null as string | null,
        meshFormat: p.mesh_format,
        textureUrl: null as string | null,
        fit: p.fit ?? null,
      }))
    return { body: worn.data?.[0]?.body ?? DEFAULT_BODY, pieces }
  }, [worn.data])

  /*
   * Models need signing for, which is a request each, so it happens after
   * the body is already on screen rather than holding it back. A person with
   * no accessories - most people - never waits for this at all.
   */
  const [models, setModels] = useState<Record<string, { mesh: string; skin: string | null }>>({})
  /*
   * `useEffect`, and it was `useMemo`. A memo runs for its value, so the
   * cleanup it returned was simply the memo's value and was never called:
   * `live` stayed true for ever and a signing that finished after this page
   * was gone still called `setModels`. The same family as everything else in
   * CLAUDE.md - a guard that exists, is checked, and is never turned off.
   */
  useEffect(() => {
    let live = true
    void (async () => {
      const wanted = (worn.data ?? []).filter((p) => p.mesh_path)
      for (const piece of wanted) {
        // Kept by item and not by slot. Two hats are two models, and a
        // record keyed by "hat" holds one of them - so the second hat was
        // drawn wearing the first one's mesh.
        if (!live || !piece.item_id || models[piece.item_id]) continue
        const [mesh, skin] = await Promise.all([
          assetUrl(piece.mesh_path!).catch(() => null),
          piece.texture_path ? assetUrl(piece.texture_path).catch(() => null) : null,
        ])
        if (live && mesh) setModels((had) => ({ ...had, [piece.item_id!]: { mesh, skin } }))
      }
    })()
    return () => { live = false }
  }, [worn.data])

  const dressed = useMemo<AvatarLook>(() => ({
    body: look.body,
    pieces: look.pieces.map((piece) => {
      const model = piece.itemId ? models[piece.itemId] : undefined
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

    /*
     * Whatever was drawn for them in this browser is wrong from this moment
     * on - it is the face from before they put the hat on. Forgotten here so
     * the next picture of them draws again, which matters most for the
     * account that has nothing stored at all and is being drawn on sight.
     */
    forgetHeadshot(profile.id)

    /*
     * The picture is taken from what the database says they are wearing, not
     * from a look this page builds. This page used to build one - leaving
     * out the mesh format and the placement - so the picture was a different
     * avatar from the one above it.
     */
    const drawn = await refreshPortrait(profile.id).catch(() => null)

    /*
     * Telling the rest of the site. The picture was being saved and nothing
     * on screen was being told, so every avatar - the top bar, the sidebar,
     * every comment - kept the old one until the page was reloaded. Which
     * read as "the picture does not update", and was really "the picture
     * updated and nobody said".
     */
    if (drawn) {
      await refreshProfile().catch(() => null)
      return
    }

    /*
     * And when it genuinely did not draw, that is said rather than
     * swallowed. It is cosmetic and nothing else fails because of it, but a
     * silent failure here is exactly what sent somebody looking for a bug in
     * the avatar.
     */
    say('Your picture could not be redrawn. Your avatar is saved.', 'info')
  }

  /*
   * Paints everything chosen in one go, and refuses the one body that reads
   * as nobody wearing anything.
   *
   * The refusal is said here so somebody hears it in the moment, and it is
   * said again in `set_body_colours`, where it is actually a rule. A page
   * that is the only thing stopping something is not stopping it.
   */
  const paint = (colour: string) => {
    if (!parts.length) return
    const next = { ...(look.body ?? DEFAULT_BODY) }
    for (const which of parts) next[which] = colour
    /*
     * Trousers on means any colour scheme, including one colour everywhere.
     *
     * 0127 made that the rule in the database and this page went on refusing
     * it anyway - the server had been corrected and the page in front of it
     * had not, so the feature was fixed and nobody could use it. A client
     * check that is stricter than the server is a client check that is
     * wrong; this one now matches the rule exactly, and the server still has
     * the final say because a page is a suggestion.
     */
    if (readsAsBare(next) && !slotsOn.has('trousers')) {
      say('One colour from head to foot reads as wearing nothing. Put trousers on first, or keep a part different.', 'error')
      return
    }
    void after('paint', () => setBodyColours(next))
  }

  /*
   * What is on, by item rather than by slot.
   *
   * It was a map of slot to item, which said what one slot held - and a
   * socket holds as many as somebody likes now, so that map answered the
   * wrong question and would have shown one of two hats as off while it was
   * on. The slots are kept separately for the one thing that is still about
   * slots: whether trousers are on.
   */
  const onNow = useMemo(
    () => new Set((worn.data ?? []).map((piece) => piece.item_id).filter(Boolean) as string[]),
    [worn.data],
  )
  const slotsOn = useMemo(
    () => new Set((worn.data ?? []).map((piece) => piece.slot).filter(Boolean) as string[]),
    [worn.data],
  )

  const shelf = (owned.data ?? []).filter((item) => DRAWER_OF[item.kind] === drawer)

  if (!profile) return null

  return (
    <Page width="wide" className="space-y-5">
      <PageHeader
        title="My Avatar"
        lead="Your body, what it wears, and the face on it."
        icon={faShirt}
        actions={
          <>
            <Button to="/catalog" variant="subtle" icon={faStore}>The Catalog</Button>
            {!profile?.is_guest && (
              <Button to="/create/avatar" icon={faPlus}>Make something</Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/*
          * The body stays put while the shelf scrolls past it. That is the
          * whole point of putting them on one page: a shirt you are
          * considering is worth nothing if you have to scroll away from
          * yourself to look at it.
          */}
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden p-0">
            {/* Standing in a studio rather than on a flat gradient. */}
            <Studio>
              {worn.loading
                ? <Skeleton className="aspect-square w-full" />
                : <AvatarStage look={dressed} handled />}
            </Studio>
          </Card>

          <Card className="space-y-2">
            <p className="font-display text-xs uppercase tracking-wider text-muted">
              Wearing
            </p>
            {onNow.size === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {/* Keyed by the item, because two hats are two rows and a
                    key of "hat" would make them one. The cross takes that
                    one off rather than emptying the socket. */}
                {(worn.data ?? []).filter((p) => p.slot && p.item_id).map((piece) => (
                  <li key={piece.item_id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{piece.item_name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === `off:${piece.item_id}`}
                      onClick={() => void after(
                        `off:${piece.item_id}`,
                        () => takeOffItem(piece.item_id!),
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

        {/* ------------------------------------- the shop, and what you own */}
        <div className="space-y-4">
          <Tabs
            value={drawer}
            onChange={(next) => setDrawer(next as Drawer)}
            options={DRAWERS.map((one) => ({ value: one.id, label: one.label }))}
          />

          {drawer === 'outfits' ? (
            /*
             * Wearing one reloads what is on, draws the portrait again and
             * leaves the person looking at themselves in it - the same
             * `after` every other change on this page goes through, so an
             * outfit cannot end up on the body without the picture catching
             * up.
             */
            <Outfits onWear={() => void after('outfit', async () => {})} />
          ) : drawer === 'body' ? (
            <Card className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="mx-auto w-40 shrink-0 rounded-xl border border-ink-line bg-ink-raised p-3">
                  <BodyPicker
                    colours={look.body ?? DEFAULT_BODY}
                    chosen={parts}
                    onChoose={(one) => setParts((had) => (
                      had.includes(one)
                        ? had.length > 1 ? had.filter((x) => x !== one) : had
                        : [...had, one]
                    ))}
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-bold">
                    {parts.length === 1
                      ? PART_LABELS[parts[0]]
                      : `${parts.length} parts`}
                  </p>
                  <p className="text-xs leading-relaxed text-muted">
                    Press a part to add it, press it again to drop it, then pick
                    a colour. Everything chosen changes at once.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setParts([...K6_PARTS])}
                      className="rounded-lg bg-ink-hover px-2.5 py-1 text-[11px] font-bold text-white/70 transition-colors hover:text-white"
                    >
                      All of it
                    </button>
                    <button
                      type="button"
                      onClick={() => setParts(['LeftArm', 'RightArm'])}
                      className="rounded-lg bg-ink-hover px-2.5 py-1 text-[11px] font-bold text-white/70 transition-colors hover:text-white"
                    >
                      Both arms
                    </button>
                    <button
                      type="button"
                      onClick={() => setParts(['LeftLeg', 'RightLeg'])}
                      className="rounded-lg bg-ink-hover px-2.5 py-1 text-[11px] font-bold text-white/70 transition-colors hover:text-white"
                    >
                      Both legs
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                  Skin
                </p>
                <Swatches
                  colours={SKIN}
                  current={parts.length === 1 ? look.body?.[parts[0]] : undefined}
                  busy={busy === 'paint'}
                  onPick={paint}
                />
                <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                  Everything else
                </p>
                <Swatches
                  colours={CLOTH}
                  current={parts.length === 1 ? look.body?.[parts[0]] : undefined}
                  busy={busy === 'paint'}
                  onPick={paint}
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
                  on={onNow.has(item.id)}
                  busy={busy === `wear:${item.id}`}
                  onToggle={() => void after(
                    `wear:${item.id}`,
                    () => (onNow.has(item.id)
                      ? takeOffItem(item.id)
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
  const picture = cardFor(item)
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
