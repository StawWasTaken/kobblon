/*
 * Your avatar: the body is the page, and the wardrobe stands beside it.
 *
 * Staw asked for a complete redesign - "i want it to look the best possible,
 * with the most useful features possible, and keep it as unique as possible
 * from roblox" - and the honest problem with what was here is that it was
 * Roblox's shape: a stamp of your avatar in the corner, tabs across the top
 * of a grid, and the grid doing all the talking.
 *
 * So it is turned inside out. The body is the biggest thing on the screen
 * and it stays that way; the drawers are a rail of icons down the side
 * rather than a row of words above a grid; and the things you own are a
 * panel beside the body rather than the page the body sits on. Under the
 * figure is the one row that was missing: what you have on, as pictures,
 * each with a cross - the list of names it replaces was the only place on
 * this page you had to read rather than look.
 *
 * The four buttons over the stage are the useful part, and none of them are
 * decoration:
 *
 *   Undress   everything off in one press, which took eleven before.
 *   Shuffle   one thing per socket, at random, out of what you own. It is
 *             the fastest way to find out you own something you forgot.
 *   Keep      save what you have on as an outfit, without leaving the body.
 *   Redraw    take the profile picture again, for when one did not draw.
 *
 * What is drawn is `AvatarStage`, the same component a profile and a profile
 * picture use. Not a preview of what everybody else will see - the thing
 * everybody else sees.
 */
import { useEffect, useMemo, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faShirt, faStore, faXmark, faFaceSmile, faHatCowboy, faPalette, faFolder,
  faCircleNotch, faCheck, faPlus, faShuffle, faCamera, faMagnifyingGlass,
  faEraser, faBookmark, faImage, faCube, faClock,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { Icon } from '@/components/brand/Icon'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { ViewSwitch } from '@/components/avatar/ViewSwitch'
import { useFlatPicture } from '@/components/avatar/useFlatPicture'
import type { PortraitLook } from '@/lib/portrait'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  wornBy, myAvatarItems, wearAvatarItem, takeOffItem, setBodyColours,
  catalogUrl, assetUrl, refreshPortrait, cardFor, saveOutfit,
} from '@/lib/api'
import { K6_PARTS } from '@/engine'
import type { AvatarItem, AvatarPiece, AvatarSlot } from '@/types/db'
import type { K6Part } from '@/engine'
import { forgetHeadshot } from '@/lib/headshots'
import { Outfits } from '@/components/avatar/Outfits'
import { Recommended } from '@/components/catalog/Recommended'
import { avatarKindLabels } from '@/lib/kinds'
import { cn } from '@/lib/cn'
import { BodyPicker, readsAsBare } from '@/components/avatar/BodyPicker'
import { Studio } from '@/components/avatar/Studio'

/** The drawers, in the order somebody opens them. */
const DRAWERS = [
  { id: 'clothing', label: 'Clothing', icon: faShirt },
  /*
   * "Accessories" does not fit a tile and truncating it mid-word is what
   * made the rail look cheap, so the tile says the short one and the
   * tooltip and the heading say the whole word.
   */
  { id: 'accessories', label: 'Accessories', short: 'Extras', icon: faHatCowboy },
  // Staw's own smiling face rather than Font Awesome's smiley.
  { id: 'face', label: 'Face', icon: faFaceSmile, ours: 'reaction-smile' as const },
  { id: 'body', label: 'Body', icon: faPalette },
  // Saved looks, which are not a kind of thing you own but a way of putting
  // the things you own back on.
  { id: 'outfits', label: 'Outfits', icon: faFolder },
] as const

type Drawer = (typeof DRAWERS)[number]['id']

/**
 * The sub-divisions inside a drawer.
 *
 * Staw: "id like multiple subdivisions for clothing: shirts, trousers,
 * tdecals / then later we'll separate acessories with hats, front
 * accessories, back accessories, etc (unless you can do it now properly)".
 *
 * It can be done now properly, because the wardrobe already stores a slot
 * on every item and the slots are exactly the divisions he is describing.
 * Nothing is guessed from a name; `Everything` is first so the drawer
 * opens the way it always did.
 *
 * A division with nothing in it is not drawn. A row of empty categories is
 * a wardrobe telling somebody about the shape of the database.
 */
const PARTS: Partial<Record<Drawer, { id: string; label: string; slots: AvatarSlot[] }[]>> = {
  clothing: [
    { id: 'shirt', label: 'Shirts', slots: ['shirt'] },
    { id: 'trousers', label: 'Trousers', slots: ['trousers'] },
    { id: 'tdecal', label: 'T-decals', slots: ['tdecal'] },
  ],
  accessories: [
    { id: 'hat', label: 'Hats', slots: ['hat'] },
    { id: 'hair', label: 'Hair', slots: ['hair'] },
    { id: 'front', label: 'Front', slots: ['front'] },
    { id: 'back', label: 'Back', slots: ['back'] },
    { id: 'neck', label: 'Neck', slots: ['neck'] },
    { id: 'waist', label: 'Waist', slots: ['waist'] },
    { id: 'hands', label: 'Hands', slots: ['leftHand', 'rightHand'] },
  ],
}

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
/*
 * Three shelves rather than one row of sixteen.
 *
 * Staw asked for "a bit more colours", and the answer to that is not a
 * longer row - a row of forty is a row nobody scans. Grouped by what they
 * are for, because somebody choosing a colour is usually choosing a mood
 * first and a hue second.
 */
const BRIGHT = [
  '#1b34e8', '#3a50ff', '#4f8cff', '#00c2d6', '#1cae71', '#25d68c',
  '#8ee34a', '#e8c91b', '#ffb020', '#ff8a1b', '#ff0033', '#ff4d7e',
  '#d74bd6', '#9b1be8', '#6b4bff',
]

const QUIET = [
  '#f4f6ff', '#dfe3ef', '#c9cedb', '#a7aec0', '#8d95a6', '#6b7488',
  '#c7b9a3', '#a8907a', '#8a5230', '#5e3620', '#7f8f6b', '#5c6e58',
]

/*
 * Deep, and not black. Staw: "dont put real black into the skin colours" -
 * and he is right about what it does, which is nothing: a part at #000000
 * takes no light at all, so it reads as a hole in the body rather than as
 * a dark leg. The darkest here still has a colour in it.
 */
const DARK = [
  '#4a5166', '#363c50', '#2a2f45', '#1c2033', '#171a26', '#0d1349',
  '#1a1420', '#241c16',
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
  const [term, setTerm] = useState('')
  /** Which sub-division of the open drawer, or null for all of it. */
  const [part, setPart] = useState<string | null>(null)
  const [keeping, setKeeping] = useState(false)
  /** Which way the body is being looked at: in three dimensions, or flat. */
  const [mode, setMode] = useState<'picture' | 'body'>('body')
  const [outfitName, setOutfitName] = useState('')
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

  /*
   * The flat version, drawn only when somebody asks for it, and drawn from
   * the same look the stage is showing rather than from a second one this
   * page assembles.
   */
  const flat = useFlatPicture(dressed as unknown as PortraitLook, mode === 'picture')

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

  const wearing = (worn.data ?? []).filter((p) => p.slot && p.item_id)

  /** Everything you own that belongs in the open drawer, narrowed by the box. */
  /** Everything in the open drawer, before the divisions narrow it. */
  const drawerItems = (owned.data ?? []).filter((item) => DRAWER_OF[item.kind] === drawer)

  /*
   * Only the divisions that have something in them, with their counts, so
   * the row says what is there rather than what could be.
   */
  const divisions = (PARTS[drawer] ?? [])
    .map((one) => ({
      ...one,
      how_many: drawerItems.filter((item) => one.slots.includes(item.slot)).length,
    }))
    .filter((one) => one.how_many > 0)

  const open_part = divisions.find((one) => one.id === part) ?? null

  const shelf = drawerItems
    .filter((item) => !open_part || open_part.slots.includes(item.slot))
    .filter((item) => !term.trim()
      || item.name.toLowerCase().includes(term.trim().toLowerCase()))

  /** How many things each drawer holds, for the number on the rail. */
  const counts = useMemo(() => {
    const all: Partial<Record<Drawer, number>> = {}
    for (const item of owned.data ?? []) {
      const which = DRAWER_OF[item.kind]
      if (which) all[which] = (all[which] ?? 0) + 1
    }
    return all
  }, [owned.data])

  /** Everything off, in one press. It was eleven. */
  const undress = () => void after('undress', async () => {
    for (const piece of wearing) await takeOffItem(piece.item_id!)
  })

  /**
   * One thing per socket, at random, out of what you own.
   *
   * Grouped by slot and one picked from each, rather than picking items at
   * random and hoping: picking at random gives three hats and no trousers,
   * which is not an outfit, it is a bag.
   */
  const shuffle = () => void after('shuffle', async () => {
    const bySlot = new Map<string, AvatarItem[]>()
    for (const item of owned.data ?? []) {
      if (!item.slot) continue
      bySlot.set(item.slot, [...(bySlot.get(item.slot) ?? []), item])
    }
    if (!bySlot.size) throw new Error('There is nothing in your wardrobe to shuffle.')

    for (const piece of wearing) await takeOffItem(piece.item_id!)
    for (const [, options] of bySlot) {
      const picked = options[Math.floor(Math.random() * options.length)]
      await wearAvatarItem(picked.id)
    }
  })

  const keep = async () => {
    setBusy('keep')
    try {
      await saveOutfit(outfitName.trim(), null)
      say('Kept. It is in your outfits.', 'success')
      setOutfitName('')
      setKeeping(false)
      setDrawer('outfits')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not save.', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!profile) return null

  const open = DRAWERS.find((one) => one.id === drawer)!

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

      {/*
        * Three columns and the body in the middle of them.
        *
        * Staw: "make it so the avatar thing is centered in the center but
        * slightly on the left", and then "i dont want stuff to be bigger
        * than everything else, i want good ratios".
        *
        * Both at once, which is the whole of the layout. The stage is
        * capped rather than taking every pixel left over - at full width it
        * was twice the wardrobe and the page was one enormous avatar with a
        * list beside it. Capped at forty rem it is about one and a bit times
        * the wardrobe, which reads as two panels in a composition rather
        * than a picture with a sidebar; and because the wardrobe takes the
        * slack instead, the figure still sits left of the page's centre.
        */}
      <div className="grid items-start justify-center gap-5 lg:grid-cols-[auto_minmax(22rem,38rem)_minmax(18rem,32rem)]">
        {/* ------------------------------------------------------- the rail */}
        {/*
          * Down the side rather than across the top. Five tabs over a grid
          * push the grid down; five down the side cost nothing, and it is
          * the one change that stops this reading as somebody else's page.
          */}
        <nav
          aria-label="What to change"
          className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-[5.5rem] lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {DRAWERS.map((one) => (
            <button
              key={one.id}
              type="button"
              onClick={() => { setDrawer(one.id); setTerm(''); setPart(null) }}
              aria-current={drawer === one.id}
              title={one.label}
              className={cn(
                'group relative flex h-[4.25rem] w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 transition-colors lg:h-[4.75rem] lg:w-[4.75rem]',
                drawer === one.id
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-ink-line bg-ink-card text-white/45 hover:border-brand/40 hover:text-white',
              )}
            >
              {/*
                * Icon over a word, with the count on the word's line.
                *
                * It was a pill pinned to the top right of each tile, which
                * sat over the icon and made every drawer look like it had
                * an unread notification on it. On the line it is a number
                * beside a label, which is what it is.
                */}
              <Glyph
                icon={one.icon}
                name={'ours' in one ? one.ours : undefined}
                className="text-[1.3rem]"
              />
              <span className="flex max-w-full items-baseline gap-1">
                <span className="font-display text-[9.5px] font-extrabold uppercase leading-none tracking-wide">
                  {'short' in one ? one.short : one.label}
                </span>
                {!!counts[one.id] && (
                  <span className={cn(
                    'text-[9px] font-bold leading-none',
                    drawer === one.id ? 'text-white/70' : 'text-white/30',
                  )}>
                    {counts[one.id]}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        {/* ------------------------------------------------------- the body */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-20">
          {/*
            * Things sitting over the stage rather than stacked under it.
            *
            * Staw: "i also want stuff that can be a slightly over the avatar
            * area - so its aesthetic yk". A card with a hard rule across it
            * and a band of thumbnails underneath is a form. The same two
            * pieces floating over the lower edge of the picture is a place -
            * and it is the difference he means by making it look like a
            * game rather than a settings page.
            *
            * So the card does **not** clip: `overflow-hidden` here would saw
            * off the half of the Wearing panel that hangs below it, which is
            * the half that makes it read as floating. The padding at the
            * bottom is what the panel hangs into.
            */}
          <div className="relative rounded-2xl border border-ink-line bg-ink-card pb-12">
            <div className="relative overflow-hidden rounded-2xl">
              {/*
                * The whole frame is the viewport.
                *
                * Staw: "the avatar viewport isnt of the full area we can
                * see it". It was a square stage centred inside a wider
                * backdrop, so two strips of the picture were not the stage
                * at all - a drag there did nothing and the figure was
                * smaller than the room it was standing in. `fill` lets the
                * stage take the box; its camera already fits the body to
                * whatever aspect it is handed.
                */}
              <Studio className="aspect-[4/3] w-full">
                {worn.loading
                  ? <Skeleton className="h-full w-full" />
                  : (
                    <AvatarStage
                      look={dressed}
                      handled
                      fill
                      turning={mode === 'body'}
                      className={cn('h-full w-full', mode === 'picture' && 'invisible')}
                    />
                  )}

                {/*
                  * Flat, when somebody asks for it: the same two-way switch
                  * the Catalog and the profile use. Drawn over the stage
                  * rather than instead of it, so turning 3D back on does
                  * not cost a second load of the body.
                  */}
                {/*
                  * The flat one is drawn into a square and the stage is
                  * 4:3, so `object-contain` on the frame fitted the picture
                  * to the frame's *height* - which made the flat body
                  * noticeably bigger than the live one and shifted it up.
                  * Pressing 2D should change how the body is drawn and
                  * nothing else about where it is. Contained in a square of
                  * the frame's height, it is the same body in the same
                  * place.
                  */}
                {mode === 'picture' && (
                  <div className="absolute inset-0 grid place-items-center">
                    {flat
                      ? (
                        <div className="aspect-square h-full">
                          <img src={flat} alt="" className="h-full w-full object-contain" />
                        </div>
                      )
                      : <p className="text-sm text-muted">Drawing…</p>}
                  </div>
                )}

                <ViewSwitch
                  ways={[
                    { value: 'picture' as const, icon: faImage, label: '2D' },
                    { value: 'body' as const, icon: faCube, label: '3D' },
                  ]}
                  value={mode}
                  onChange={setMode}
                />
              </Studio>
            </div>

            {/*
              * Up the right-hand side rather than across the bottom.
              *
              * Across the bottom they fought the Wearing panel for the same
              * strip of picture, and a control that overlaps another control
              * is a control somebody presses by accident. Up the side they
              * are clear of it, and they sit where a game puts its tools.
              */}
            <div className="absolute right-4 top-4 z-[3]">
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-ink-line bg-ink-card/85 p-1.5 shadow-pop backdrop-blur">
                <StageButton
                  label="Take everything off"
                  icon={faEraser}
                  busy={busy === 'undress'}
                  disabled={!wearing.length}
                  onClick={undress}
                />
                <StageButton
                  label="Shuffle what you own"
                  icon={faShuffle}
                  busy={busy === 'shuffle'}
                  disabled={!owned.data?.length}
                  onClick={shuffle}
                />
                <StageButton
                  label="Keep this as an outfit"
                  icon={faBookmark}
                  disabled={!wearing.length}
                  onClick={() => setKeeping(true)}
                />
                <StageButton
                  label="Take my picture again"
                  icon={faCamera}
                  busy={busy === 'portrait'}
                  onClick={() => void after('portrait', async () => {})}
                />
              </div>
            </div>

            {/*
              * What you have on, as pictures with a cross on each, floating
              * half over the picture and half below it.
              *
              * It was a column of names - the one place on this page
              * somebody had to read rather than look, and the place where
              * looking is the whole point.
              */}
            <div className="absolute bottom-3 left-4 z-[2] w-fit max-w-[calc(100%-2rem)] rounded-2xl border border-ink-line bg-ink-card/90 p-3 shadow-pop backdrop-blur sm:left-6 sm:max-w-[calc(100%-3rem)]">
              <div className="flex items-center gap-2">
                <p className="font-display text-[10px] font-extrabold uppercase tracking-wider text-muted">
                  Wearing
                </p>
                {!!wearing.length && (
                  <span className="rounded-full bg-ink-hover px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white/50">
                    {wearing.length}
                  </span>
                )}
              </div>

              {!wearing.length ? (
                <p className="mt-1.5 text-xs text-muted">
                  Nothing yet. Press something on the right to put it on.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {/* Keyed by the item, because two hats are two rows and a
                      key of "hat" would make them one. The cross takes that
                      one off rather than emptying the socket. */}
                  {wearing.map((piece) => (
                    <li key={piece.item_id}>
                      <Tooltip label={piece.item_name ?? 'Something'} side="top">
                        <button
                          type="button"
                          aria-label={`Take off ${piece.item_name ?? 'this'}`}
                          disabled={busy === `off:${piece.item_id}`}
                          onClick={() => void after(
                            `off:${piece.item_id}`,
                            () => takeOffItem(piece.item_id!),
                          )}
                          className="group relative grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-ink-line bg-media p-1 transition-colors hover:border-danger"
                        >
                          {cardFor(piece) ? (
                            <img
                              src={cardFor(piece)!}
                              alt=""
                              draggable={false}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Glyph icon={faHatCowboy} className="text-white/30" />
                          )}
                          <span className="absolute inset-0 grid place-items-center bg-ink/75 opacity-0 transition-opacity group-hover:opacity-100">
                            <Glyph icon={faXmark} className="text-danger" />
                          </span>
                        </button>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/*
            * Things to put on, under the body they would go on.
            *
            * Staw: "under that i want the catalog recommended items". The
            * same component the Catalog uses, so what is suggested here and
            * what is suggested there cannot disagree.
            */}
          <Recommended layout="row" howMany={14} />
        </div>

        {/* --------------------------------------------------- the wardrobe */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-extrabold">{open.label}</h2>
            {drawer !== 'body' && drawer !== 'outfits' && (
              <>
                <span className="text-xs text-muted">{shelf.length}</span>
                <div className="ml-auto w-full sm:w-44">
                  <Input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search"
                    icon={faMagnifyingGlass}
                  />
                </div>
              </>
            )}
          </div>

          {/*
            * The divisions, as chips under the heading. Only drawn when
            * there is more than one thing to choose between - a single
            * chip saying "Shirts" beside a heading saying "Clothing" is a
            * control with one setting, which is a label pretending to be
            * a control.
            */}
          {divisions.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip on={!part} onPick={() => setPart(null)} count={drawerItems.length}>
                Everything
              </Chip>
              {divisions.map((one) => (
                <Chip
                  key={one.id}
                  on={part === one.id}
                  onPick={() => setPart(part === one.id ? null : one.id)}
                  count={one.how_many}
                >
                  {one.label}
                </Chip>
              ))}
            </div>
          )}

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
            /*
             * The body, big, and the colours only after a part is chosen.
             *
             * Staw: "i thought the body thing would be bigger and you click
             * on one part or multiple parts and then you can select the
             * colour, with ANIMATIONS ONCE AGAIN". It was a thumbnail with
             * four shelves beside it, so the thing you point at was the
             * smallest thing on the panel and the order of the job was not
             * visible anywhere.
             *
             * Now the figure takes the width it needs, and the shelves are
             * dimmed and unreachable until something is chosen - the panel
             * says what to do by what is lit rather than by a sentence. The
             * swatches are dealt in again on every change of selection,
             * which is the keyed `row-in` below: pick an arm and the
             * colours arrive for that arm.
             */
            <Card className="animate-pop-in p-5">
              <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
                <div className="rounded-2xl border border-ink-line bg-ink-raised p-5">
                  <BodyPicker
                    colours={look.body ?? DEFAULT_BODY}
                    chosen={parts}
                    className="mx-auto max-w-[15rem]"
                    /*
                     * Pressing a chosen part lets go of it, including the
                     * last one.
                     *
                     * Staw: "one annoying thing is that you cannot
                     * unselect a body part". It refused to go below one,
                     * which was me stopping somebody reaching a state
                     * where a swatch does nothing - except that a swatch
                     * doing nothing is obvious, and a part that will not
                     * let go is a control fighting the person using it.
                     */
                    onChoose={(one) => setParts((had) => (
                      had.includes(one)
                        ? had.filter((x) => x !== one)
                        : [...had, one]
                    ))}
                  />

                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    <Quick onPick={() => setParts([...K6_PARTS])}>All of it</Quick>
                    <Quick onPick={() => setParts(['LeftArm', 'RightArm'])}>Both arms</Quick>
                    <Quick onPick={() => setParts(['LeftLeg', 'RightLeg'])}>Both legs</Quick>
                    <Quick onPick={() => setParts(['Head'])}>Head</Quick>
                    {!!parts.length && (
                      <Quick onPick={() => setParts([])}>Let go</Quick>
                    )}
                  </div>
                </div>

                <div className="min-w-0 space-y-4">
                  <div>
                    <p className="font-display text-lg font-extrabold">
                      {parts.length === 0
                        ? 'Press a part'
                        : parts.length === 1
                          ? PART_LABELS[parts[0]]
                          : `${parts.length} parts`}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {parts.length === 0
                        ? 'Press the body on the left, as many parts as you like, then pick a colour.'
                        : 'Press a part again to let go of it. Everything chosen changes at once.'}
                    </p>
                  </div>

                  {/*
                    * Keyed on what is chosen, so the shelves come back in
                    * on every change rather than sitting there. It is the
                    * one animation that carries information: the colours
                    * arriving is the panel saying it heard the press.
                    */}
                  <div
                    key={parts.join(',')}
                    className={cn(
                      'space-y-4 transition-opacity duration-200',
                      parts.length
                        ? 'animate-pop-in'
                        : 'pointer-events-none select-none opacity-30',
                    )}
                  >
                    <Shelf nth={0} label="Skin" colours={SKIN} parts={parts} look={look} busy={busy} onPick={paint} />
                    <Shelf nth={1} label="Bright" colours={BRIGHT} parts={parts} look={look} busy={busy} onPick={paint} />
                    <Shelf nth={2} label="Quiet" colours={QUIET} parts={parts} look={look} busy={busy} onPick={paint} />
                    <Shelf nth={3} label="Deep" colours={DARK} parts={parts} look={look} busy={busy} onPick={paint} />
                  </div>
                </div>
              </div>
            </Card>
          ) : owned.loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 [&>*]:max-w-[11rem]">
              {Array.from({ length: 9 }, (_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : !shelf.length ? (
            term.trim() ? (
              <p className="py-10 text-center text-sm text-muted">
                Nothing here called that.
              </p>
            ) : (
              <EmptyState
                mood="emptyBox"
                title="Nothing here yet"
                body="Everything you take from the Catalog turns up in this drawer."
                action={<Button to="/catalog" icon={faStore}>Open the Catalog</Button>}
              />
            )
          ) : (
            /*
             * Tiles of a size, however wide the panel is.
             *
             * Three columns stretched to fill gave 250 pixel tiles on a wide
             * screen, which made a shirt bigger than the person wearing it.
             * `auto-fill` adds columns instead of growing the ones there
             * are, and the cap stops the last row stretching when there are
             * only two of them.
             */
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 [&>*]:max-w-[11rem]">
              {shelf.map((item, i) => (
                <WornTile
                  key={item.id}
                  item={item}
                  nth={i}
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

      <Dialog
        open={keeping}
        onClose={() => setKeeping(false)}
        title="Keep this outfit"
        description="Whatever you have on right now, kept under a name. Your colours go with it."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setKeeping(false)}>Cancel</Button>
            <Button
              variant="yes"
              icon={faCheck}
              loading={busy === 'keep'}
              disabled={!outfitName.trim()}
              onClick={() => void keep()}
            >
              Keep it
            </Button>
          </>
        }
      >
        <Input
          label="Name"
          value={outfitName}
          maxLength={60}
          onChange={(e) => setOutfitName(e.target.value)}
          placeholder="Saturday"
        />
      </Dialog>
    </Page>
  )
}

/** One of the four over the stage. */
function StageButton({ label, icon, busy, disabled, onClick }: {
  label: string
  icon: typeof faShuffle
  busy?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        aria-label={label}
        disabled={busy || disabled}
        onClick={onClick}
        className="grid h-10 w-10 place-items-center rounded-xl border border-ink-line bg-ink-card/90 text-sm text-white/80 backdrop-blur transition-colors hover:text-white disabled:opacity-40"
      >
        <Glyph icon={busy ? faCircleNotch : icon} className={cn(busy && 'animate-spin')} />
      </button>
    </Tooltip>
  )
}

/** One of the division chips under a drawer's heading. */
function Chip({ on, count, onPick, children }: {
  on: boolean
  count: number
  onPick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
        'transition-colors duration-150',
        on
          ? 'border-brand bg-brand/15 text-white'
          : 'border-ink-line bg-ink-raised text-white/60 hover:text-white',
      )}
    >
      {children}
      <span className={on ? 'text-white/70' : 'text-white/30'}>{count}</span>
    </button>
  )
}

function Quick({ onPick, children }: { onPick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="rounded-lg bg-ink-hover px-2.5 py-1 text-[11px] font-bold text-white/70 transition-colors hover:text-white"
    >
      {children}
    </button>
  )
}

/** A labelled row of swatches. */
function Shelf({ label, colours, parts, look, busy, onPick, nth }: {
  label: string
  /** Where in the stack it sits, which is all the delay is worked out from. */
  nth: number
  colours: string[]
  parts: K6Part[]
  look: AvatarLook
  busy: string | null
  onPick: (colour: string) => void
}) {
  return (
    <div className="animate-row-in space-y-2" style={{ animationDelay: `${nth * 45}ms` }}>
      <p className="font-display text-[10px] font-extrabold uppercase tracking-wider text-muted">
        {label}
      </p>
      <Swatches
        colours={colours}
        current={parts.length === 1 ? look.body?.[parts[0]] : undefined}
        busy={busy === 'paint'}
        onPick={onPick}
      />
    </div>
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
            'grid h-10 w-10 place-items-center rounded-xl border-2',
            'transition-transform duration-150 hover:scale-110 active:scale-95 disabled:opacity-50',
            current?.toLowerCase() === colour.toLowerCase()
              ? 'border-white'
              : 'border-ink-line',
          )}
          style={{ background: colour }}
        >
          {current?.toLowerCase() === colour.toLowerCase() && (
            <Glyph
              icon={faCheck}
              className="text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
            />
          )}
        </button>
      ))}
    </div>
  )
}

function WornTile({ item, nth, on, busy, onToggle }: {
  item: AvatarItem
  nth: number
  on: boolean
  busy: boolean
  onToggle: () => void
}) {
  const picture = cardFor(item)
  /*
   * A limited, which the Catalog has always said and nowhere else did.
   * Staw: "we dont show the limited badge outside of the catalog". Both
   * states, because a limited that has closed is the rarer of the two and
   * saying nothing about it is the one case somebody actually cares about.
   */
  const limited = !!item.sells_until
  const closed = limited && new Date(item.sells_until!).getTime() <= Date.now()

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      title={item.name}
      className={cn(
        'group flex animate-row-in flex-col overflow-hidden rounded-2xl border bg-ink-card text-left',
        'transition-[border-color,transform] duration-150 active:scale-[0.97]',
        on ? 'border-brand' : 'border-ink-line hover:border-brand/60',
      )}
      style={{ animationDelay: `${Math.min(nth, 12) * 25}ms` }}
    >
      {/*
        * Inset rather than bleeding to the edge.
        *
        * Staw: "i hate it when your text is ugly and theres no spacing
        * between the cards edges & the text". The picture had no inset and
        * the name sat two pixels off the corner, which is what made a grid
        * of these read as cheap. The padding is the whole fix.
        */}
      <span className="relative block p-2">
        <span className="relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-media">
          {picture ? (
            <img src={picture} alt="" draggable={false} className="h-full w-full object-contain" />
          ) : (
            <Glyph icon={faHatCowboy} className="text-2xl text-white/25" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-ink/60">
              <Glyph icon={faCircleNotch} className="animate-spin text-white/70" />
            </span>
          )}
        </span>
        {on && !busy && (
          <span className="absolute right-3.5 top-3.5 grid h-6 w-6 animate-pop-in place-items-center rounded-lg bg-brand text-white shadow-pop">
            <Icon name="checkmark" tone="currentColor" className="h-3 w-3" />
          </span>
        )}
        {limited && (
          <span className={cn(
            'absolute bottom-3.5 left-3.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
            'text-[9px] font-extrabold uppercase tracking-wide backdrop-blur-sm',
            closed ? 'bg-ink/85 text-white/60' : 'bg-amber-400/90 text-ink',
          )}>
            <Glyph icon={faClock} />
            {closed ? 'Closed' : 'Limited'}
          </span>
        )}
      </span>
      <span className="block px-3 pb-3 pt-0.5">
        <span className="block truncate text-xs font-bold leading-snug">{item.name}</span>
        <span className="mt-0.5 block text-[10px] text-muted">
          {avatarKindLabels[item.kind] ?? item.kind}
        </span>
      </span>
    </button>
  )
}
