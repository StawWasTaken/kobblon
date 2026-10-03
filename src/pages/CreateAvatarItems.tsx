/*
 * Making things for the Catalog.
 *
 * Six kinds, one form, because the difference between them is data: what it
 * costs to make, the least it may be sold for, who is allowed to make one,
 * and whether it is a picture or a model. All four of those come from
 * `avatar_rules()` - the same answer the server charges from - so this page
 * cannot tell somebody a price the charge will not honour.
 *
 * It also cannot decide whether somebody may make a thing. It asks, shows
 * the answer, and lets the server refuse: a page is a suggestion.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faDownload, faImage, faCube, faLock, faPen,
  faTrash, faBoxArchive, faEllipsis, faPlus, faStore,
  faMagnifyingGlass, faClock, faUpload, faCircleCheck, faCircleExclamation,
  faCamera, faArrowUpRightFromSquare, faArrowsUpDownLeftRight,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { Choices } from '@/components/ui/Choices'
import { Menu } from '@/components/ui/Menu'
import { Dialog } from '@/components/ui/Dialog'
import { DateTimeField } from '@/components/ui/DateTimeField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { CurrencyMark } from '@/components/brand/Currency'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  avatarRules, createAvatarItem, listAvatarItem, myMadeAvatarItems,
  uploadCatalogImage, catalogUrl, listOwnAssets, editAvatarItem,
  archiveAvatarItem, deleteAvatarItem, drawAvatarCard, assetUrl, cardFor,
  setLimited, decalBehind, reviewAvatarItem, ensureAvatarCard, uploadAsset,
  redrawAvatarCard, setAvatarFit,
  mannequinFace,
} from '@/lib/api'
import type { AvatarKind, AvatarSlot, AvatarRule, AvatarItem } from '@/types/db'
import { cn } from '@/lib/cn'
import { kindAccepts, avatarTag } from '@/lib/kinds'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { FitEditor, PLAIN_FIT, fitIsPlain, asFit } from '@/components/avatar/FitEditor'
import { plainFace } from '@/lib/plainFace'
import { MANNEQUIN_BODY } from '@/lib/mannequin'
import type { WornFit } from '@/engine'
import { formatOf } from '@/engine'

const KINDS: { kind: AvatarKind; label: string; about: string; template?: string }[] = [
  {
    kind: 'shirt',
    label: 'Shirt',
    about: 'A picture drawn into the shirt template. It covers the torso and both arms.',
    template: '/templates/kobblon-shirt-template.png',
  },
  {
    kind: 'trousers',
    label: 'Trousers',
    about: 'A picture drawn into the trousers template. It covers the torso and both legs.',
    template: '/templates/kobblon-trousers-template.png',
  },
  {
    kind: 'tdecal',
    label: 'T-decal',
    about: 'Any picture at all, stuck straight onto the front of the torso. No template.',
  },
  {
    kind: 'accessory',
    label: 'Accessory',
    about: 'A model worn on the head, back, front or neck, with a picture on it.',
  },
  {
    kind: 'hair',
    label: 'Hair',
    about: 'A model worn on the head, the same as an accessory but counted as hair.',
  },
  {
    kind: 'face',
    label: 'Face',
    about: 'A picture on the front of the head. Kobblon only.',
  },
]

const PLACES: { slot: AvatarSlot; label: string }[] = [
  { slot: 'hat', label: 'On the head' },
  { slot: 'front', label: 'On the front' },
  { slot: 'back', label: 'On the back' },
  { slot: 'neck', label: 'Round the neck' },
  { slot: 'waist', label: 'Round the waist' },
  { slot: 'leftHand', label: 'Left hand' },
  { slot: 'rightHand', label: 'Right hand' },
]

export default function CreateAvatarItems() {
  useTitle('Make something to wear', 'Kobblon Create')
  const { profile } = useAuth()
  const say = useToast()

  const [kind, setKind] = useState<AvatarKind>('shirt')
  const [slot, setSlot] = useState<AvatarSlot>('hat')
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [picture, setPicture] = useState<File | null>(null)
  const [making, setMaking] = useState(false)
  const picked = useRef<HTMLInputElement>(null)
  const [meshId, setMeshId] = useState('')
  /*
   * What the model wears. An accessory with no texture renders grey, which
   * is what Staw saw: the form asked for a model and never for its picture,
   * so every accessory anybody made was untextured by construction. Either
   * one of your own Decals, or the id of any Decal on the Marketplace -
   * the same two ways an uploaded mesh gets its texture.
   */
  const [textureId, setTextureId] = useState('')
  /*
   * Uploading the model here rather than somewhere else first. `fresh` says
   * which of the two the form is on; the file goes through the same
   * `uploadAsset` the Create dialog uses, so what comes out is an ordinary
   * mesh of theirs with an ordinary Decal on it.
   */
  const [fresh, setFresh] = useState(true)
  /** How the thing is placed, while it is being made. */
  const [fit, setFit] = useState<Required<WornFit>>(PLAIN_FIT)
  const [meshFile, setMeshFile] = useState<File | null>(null)
  const [skinFile, setSkinFile] = useState<File | null>(null)
  const meshPicked = useRef<HTMLInputElement>(null)
  const skinPicked = useRef<HTMLInputElement>(null)
  const [decalTag, setDecalTag] = useState('')
  const [decal, setDecal] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [term, setTerm] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const rules = useAsync(async () => avatarRules(), [])
  const made = useAsync(async () => (profile ? myMadeAvatarItems() : []), [profile?.id])
  const meshes = useAsync(
    async () => (profile ? (await listOwnAssets(profile.id)).filter((a) => a.kind === 'mesh') : []),
    [profile?.id],
  )
  /*
   * Cards that are missing or were drawn by an older drawing, redrawn the
   * next time their owner opens this page.
   *
   * A card is drawn once and is then a file in a bucket for ever, so a fix
   * to the drawing reaches nothing already made unless something redraws it
   * - which is exactly why the trousers and the bicorne were showing a black
   * square and a shirt icon. One at a time rather than all at once: each one
   * builds a WebGL context, and a browser gives out a handful.
   */
  /*
   * A failure here used to be swallowed - `.catch(() => null)` - and the
   * only symptom was Staw saying "I still do not see previews" with nothing
   * to go on. A picture that will not draw is now said once, with what went
   * wrong, and every card keeps a button to try again. An invisible failure
   * is worse than a visible one, every time.
   */
  const [cardTrouble, setCardTrouble] = useState<string | null>(null)
  // The mannequin's face, so the rig here is the rig everywhere else.
  const [face, setFace] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void mannequinFace().then((picture) => { if (live) setFace(picture) })
    return () => { live = false }
  }, [])
  useEffect(() => {
    if (!profile || made.loading) return
    let live = true
    void (async () => {
      let drew = false
      let trouble: string | null = null
      for (const one of made.data ?? []) {
        if (!live) return
        try {
          if (await ensureAvatarCard(one, profile.id)) drew = true
        } catch (error) {
          trouble = error instanceof Error ? error.message : String(error)
        }
      }
      if (!live) return
      setCardTrouble(trouble)
      if (drew) made.reload()
    })()
    return () => { live = false }
  }, [profile?.id, made.loading, made.data])

  const decals = useAsync(
    async () => (profile ? (await listOwnAssets(profile.id)).filter((a) => a.kind === 'image') : []),
    [profile?.id],
  )

  const rule = useMemo<AvatarRule | undefined>(
    () => (rules.data ?? []).find((one) => one.kind === kind),
    [rules.data, kind],
  )

  /*
   * Faces are Kobblon's, so the tab is not offered to anybody else. The
   * server refuses either way - this only keeps a tab off the page that
   * would do nothing but refuse, which is the fake functionality this
   * project does not do.
   */
  const tabs = useMemo(
    () => KINDS.filter((one) => one.kind !== 'face' || profile?.is_admin),
    [profile?.is_admin],
  )

  /*
   * Where the thing is worn, which only an accessory gets a say in.
   *
   * Hair goes in the hair slot. The picker was shown for every model kind
   * and starts on "On the head", so a hair was sent as a hat and the server
   * refused it - "A hair is always worn as a hair" - every single time.
   * Publishing hair was impossible, and the message was about an answer
   * nobody had been asked to give. Staw: "seems like people may encounter
   * trouble trying to publish hair, accessories, etc".
   *
   * One line decides it now, and the picker is only drawn where it means
   * something.
   */
  const sendingSlot: AvatarSlot = kind === 'accessory' ? slot : (kind as AvatarSlot)

  const verified = !!profile && (profile.is_verified || profile.is_admin)
  /*
   * Kobblon's own kinds are Kobblon's to make, and Kobblon was being refused
   * by its own page: `!rule.kobblon_only` with nothing after it meant faces
   * were shut to everybody, the house included, so the form sat there
   * saying "Only Kobblon makes those" to Kobblon.
   *
   * The server has said `kobblon_only and not is_admin` since 0113 and was
   * right the whole time - this is the page disagreeing with it, which is
   * the same shape as the trousers rule last week. The server still has the
   * final say; a page is a suggestion.
   */
  const allowed = !rule
    || ((!rule.needs_verified || verified) && (!rule.kobblon_only || !!profile?.is_admin))
  const isModel = kind === 'accessory' || kind === 'hair'
  const chosen = KINDS.find((one) => one.kind === kind)

  /*
   * Addresses for the preview, held apart from the form's own state because
   * one of them is an object URL that has to be given back. A file the
   * browser already has needs no round trip to storage; a model picked from
   * what they own does, and that is one signing.
   */
  const [fitUrls, setFitUrls] = useState<{ mesh: string | null; skin: string | null }>(
    { mesh: null, skin: null },
  )

  useEffect(() => {
    if (!isModel) { setFitUrls({ mesh: null, skin: null }); return }

    const made: string[] = []
    let live = true

    void (async () => {
      let mesh: string | null = null
      let skin: string | null = null

      if (fresh && meshFile) {
        mesh = URL.createObjectURL(meshFile)
        made.push(mesh)
      } else if (!fresh && meshId) {
        const row = (meshes.data ?? []).find((one) => one.id === meshId)
        mesh = row ? await assetUrl(row.file_path).catch(() => null) : null
      }

      if (skinFile) {
        skin = URL.createObjectURL(skinFile)
        made.push(skin)
      } else if (textureId) {
        const row = (decals.data ?? []).find((one) => one.id === textureId)
        skin = row ? await assetUrl(row.file_path).catch(() => null) : null
      }

      if (live) setFitUrls({ mesh, skin })
      else for (const one of made) URL.revokeObjectURL(one)
    })()

    return () => {
      live = false
      for (const one of made) URL.revokeObjectURL(one)
    }
  }, [isModel, fresh, meshFile, meshId, skinFile, textureId, meshes.data, decals.data])

  /*
   * A plain body wearing the one thing being made. Null while there is no
   * model, so the panel says what it is waiting for rather than drawing an
   * empty mannequin that looks like a fault.
   */
  const fitting = useMemo<AvatarLook | null>(() => {
    if (!isModel || !fitUrls.mesh) return null
    return {
      body: MANNEQUIN_BODY,
      pieces: [
        // The one mannequin's face. A blank head is an unsettling thing to
        // put a hat on, and the point of this view is judging how something
        // looks on the same person it will be shown on everywhere else.
        { slot: 'face', kind: 'face', imageUrl: face ?? plainFace() },
        {
          slot: sendingSlot,
          kind,
          meshUrl: fitUrls.mesh,
          meshFormat: fresh && meshFile ? formatOf(meshFile.name) : undefined,
          textureUrl: fitUrls.skin,
          fit,
        },
      ],
    }
  }, [isModel, fitUrls, sendingSlot, kind, fresh, meshFile, fit, face])


  const make = async () => {
    if (!profile || !rule) return
    setBusy(true)
    try {
      let imagePath: string | null = null
      let usingMesh = meshId
      let usingTexture = textureId

      if (!isModel) {
        if (!picture) throw new Error('Choose a picture first.')
        imagePath = await uploadCatalogImage(profile.id, picture)
      } else if (fresh) {
        if (!meshFile) throw new Error('Choose a model file first.')
        /*
         * The same upload the Create dialog does, texture and all: it makes
         * the Decal, attaches it and hands back the mesh. Doing it here
         * rather than reaching into storage means an accessory's model is a
         * model of theirs, listed or not, like everything else they own.
         */
        const made = await uploadAsset({
          userId: profile.id,
          file: meshFile,
          kind: 'mesh',
          name: name.trim() || meshFile.name,
          description: about,
          texture: skinFile
            ? { file: skinFile }
            : textureId ? { id: textureId } : undefined,
        })
        usingMesh = made.id
        /*
         * Left alone when a picture was uploaded with the model: the mesh
         * row already wears that Decal, and 0130 makes `create_avatar_item`
         * fall back to it. Asking the same question twice is how an
         * accessory ended up grey while its own model was textured.
         */
        meshes.reload()
      } else if (!meshId) {
        throw new Error('Choose one of your models first.')
      }

      const newId = await createAvatarItem({
        kind,
        slot: sendingSlot,
        name,
        description: about,
        imagePath,
        meshId: isModel ? usingMesh : null,
        textureId: isModel ? (usingTexture || null) : null,
      })

      // The placement, before the card is drawn, so the card shows the
      // thing where its maker put it rather than where the measuring did.
      if (isModel && !fitIsPlain(fit)) {
        await setAvatarFit(newId, fit).catch(() => {
          say('It was made, but the placement did not save. Adjust it from its card.', 'info')
        })
      }

      /*
       * The card, drawn now while everything it needs is in hand. Clothes go
       * on a body, because a shirt laid out flat is its template and nobody
       * can tell what it is; an accessory is shown as the model; a face is
       * already a picture of itself.
       *
       * Best effort and after the item exists: a thing that failed to be
       * made should not leave a picture of itself behind, and an item whose
       * card did not draw shows its own picture instead.
       */
      const mesh = isModel
        ? (meshes.data ?? []).find((one) => one.id === usingMesh)
        : undefined
      /*
       * The card wears the texture too. Drawing the model bare gives a grey
       * card for an item that is not grey, and that card is then a file in a
       * bucket for ever - so the picture has to be in hand here, not later.
       */
      const skin = isModel
        ? (decals.data ?? []).find((one) => one.id === usingTexture)
        : undefined
      void drawAvatarCard(newId, profile.id, {
        kind,
        slot: sendingSlot,
        imageUrl: imagePath ? catalogUrl(imagePath) : null,
        meshUrl: mesh ? await assetUrl(mesh.file_path).catch(() => null) : null,
        meshFormat: mesh ? formatOf(mesh.file_path) : null,
        textureUrl: skin ? await assetUrl(skin.file_path).catch(() => null) : null,
      }).then(() => made.reload())

      say(
        rule.upload_cost > 0
          ? `Made. ${rule.upload_cost} Brix. It goes for screening before anybody sees it.`
          : 'Made. It goes for screening before anybody sees it.',
        'success',
      )
      setName(''); setAbout(''); setPicture(null); setMeshId('')
      setTextureId(''); setDecalTag(''); setDecal(null)
      setMeshFile(null); setSkinFile(null); setFit(PLAIN_FIT)
      setMaking(false)
      made.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null

  /*
   * What the shelf shows. Archived things are kept out of the ordinary view
   * and get a view of their own rather than a filter nobody finds: archiving
   * is "put this away", so a page that keeps showing it has not done it.
   *
   * Archived here means screened, not listed, and deliberately so - which is
   * the same state as "made it and never listed it", because the server has
   * one flag for both. So the archived view is honest about what it is: the
   * things that are not in the Catalog.
   */
  const everything = made.data ?? []
  const needle = term.trim().toLowerCase()
  const mine = everything.filter((one) => {
    const away = one.status === 'approved' && !one.is_public
    if (away !== showArchived) return false
    return !needle
      || one.name.toLowerCase().includes(needle)
      || one.kind.toLowerCase().includes(needle)
      || String(one.content_id).includes(needle)
  })
  const putAway = everything.filter(
    (one) => one.status === 'approved' && !one.is_public,
  ).length

  return (
    <Page className="space-y-5">
      <PageHeader
        title="Things to Wear"
        lead="Shirts, trousers, t-decals, accessories and hair, for the Catalog."
        icon={faShirt}
        actions={<Button to="/catalog" variant="subtle" icon={faStore}>The Catalog</Button>}
      />

      {/*
        * Everything you have made, laid out as cards rather than a column of
        * rows, with making a new one as the first tile. Staw's shape, and
        * the right one: the page is a shelf of your own work, and making
        * something is one more thing on that shelf rather than a form the
        * shelf has to live beside.
        */}
      {cardTrouble && (
        <p className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs leading-relaxed">
          <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 text-danger" />
          <span>
            A picture would not draw: <span className="text-white/90">{cardTrouble}</span>
            {' '}Everything else still works, and each card has a button to try again.
          </span>
        </p>
      )}

      {!!everything.length && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            icon={faMagnifyingGlass}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search what you have made"
            aria-label="Search what you have made"
            className="min-w-[14rem] flex-1"
          />
          <Choices
            label="Which of yours"
            tone="soft"
            value={showArchived ? 'away' : 'out'}
            onChange={(next) => setShowArchived(next === 'away')}
            options={[
              { value: 'out', label: 'In the Catalog', icon: faStore },
              { value: 'away', label: `Put away${putAway ? ` (${putAway})` : ''}`, icon: faBoxArchive },
            ]}
          />
        </div>
      )}

      {made.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => setMaking(true)}
            /*
              * The same feel as Create's own drop area, down to the hover:
              * these two tiles are the same act on two pages, and one of
              * them reading as flat was the whole of Staw's complaint.
              */
            className={cn(
              'group grid aspect-[3/4] place-items-center gap-2 rounded-xl border-2 border-dashed',
              'border-ink-line bg-ink-raised text-white/60 transition-colors',
              'hover:border-brand/60 hover:bg-ink-hover hover:text-white',
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-hover transition-transform duration-150 group-hover:scale-110">
              <FontAwesomeIcon icon={faPlus} className="text-lg" />
            </span>
            <span className="text-sm font-bold">Make something</span>
            <span className="px-4 text-center text-[11px] leading-snug text-muted">
              A shirt, trousers, a t-decal, an accessory or hair
            </span>
          </button>

          {mine.map((one) => (
            <MadeCard
              key={one.id}
              item={one}
              rule={(rules.data ?? []).find((r) => r.kind === one.kind)}
              canLimit={!!profile?.is_admin}
              canScreen={!!profile?.is_admin || !!profile?.is_moderator}
              me={profile.id}
              onChanged={() => made.reload()}
              onTrouble={(message) => say(message, 'error')}
              onDone={(message) => say(message, 'success')}
            />
          ))}
        </div>
      )}

      {!made.loading && mine.length === 0 && (
        <p className="text-sm text-muted">
          {needle
            ? `Nothing of yours matches "${term.trim()}".`
            : showArchived
              ? 'Nothing put away. Archiving something takes it off the Catalog and leaves it here.'
              : 'Nothing in the Catalog yet. What you make turns up here, with whether it has been screened.'}
        </p>
      )}

      {/* ------------------------------------------------ making one */}
      <Dialog
        open={making}
        onClose={() => setMaking(false)}
        title="Make something to wear"
        description="It goes through screening before anybody else can see it."
        size="lg"
      >
        <div className="space-y-4">
          <Tabs
            value={kind}
            onChange={(next) => setKind(next as AvatarKind)}
            options={tabs.map((one) => ({ value: one.kind, label: one.label }))}
          />

          <p className="text-sm text-muted">{chosen?.about}</p>

          {rules.loading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : rule && (
            <div className="grid gap-3 rounded-xl border border-ink-line bg-ink-raised p-3 sm:grid-cols-2">
              <p className="text-xs leading-relaxed text-muted">
                Making one costs{' '}
                <span className="font-bold text-white">
                  {rule.upload_cost > 0
                    ? <><CurrencyMark className="mx-0.5" />{rule.upload_cost}</>
                    : 'nothing'}
                </span>
                . Putting it up for sale and taking it down again are free.
              </p>
              <p className="text-xs leading-relaxed text-muted">
                It sells for at least{' '}
                <span className="font-bold text-white">
                  {rule.least_price > 0
                    ? <><CurrencyMark className="mx-0.5" />{rule.least_price}</>
                    : 'nothing, so it may be free'}
                </span>
                .
              </p>
            </div>
          )}

          {!allowed && (
            <p className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs leading-relaxed">
              <FontAwesomeIcon icon={faLock} className="mt-0.5 text-danger" />
              <span>
                {rule?.kobblon_only
                  ? 'Only Kobblon makes those.'
                  : 'Only verified accounts can make these. Everything else here is open to you.'}
              </span>
            </p>
          )}

          {chosen?.template && (
            <a
              href={chosen.template}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-2.5 text-sm font-bold hover:border-brand"
            >
              <FontAwesomeIcon icon={faDownload} className="text-white/50" />
              Download the {chosen.label.toLowerCase()} template
            </a>
          )}

          {isModel ? (
            <div className="space-y-2">
              {/*
                * A model comes from one of two places, and uploading one here
                * was the missing half: making somebody leave, upload in My
                * Uploads, and come back is three steps for one thought, and
                * it is the same `uploadAsset` either way - so the model and
                * its texture become ordinary Decals and meshes of theirs,
                * rather than something only the Catalog can see.
                */}
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                The model
              </p>
              <Choices
                label="Where the model comes from"
                size="sm"
                value={fresh ? 'new' : 'had'}
                onChange={(next) => {
                  setFresh(next === 'new')
                  if (next === 'new') setMeshId('')
                  else setMeshFile(null)
                }}
                options={[
                  { value: 'new', label: 'Upload one', icon: faUpload },
                  { value: 'had', label: 'One of mine', icon: faCube },
                ]}
              />

              {fresh ? (
                <>
                  <button
                    type="button"
                    onClick={() => meshPicked.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-line bg-ink-raised px-4 py-8 text-center transition-colors hover:border-brand/60 hover:bg-ink-hover"
                  >
                    <FontAwesomeIcon icon={meshFile ? faCube : faUpload} className="text-xl text-white/40" />
                    <span className="text-sm font-semibold">
                      {meshFile ? meshFile.name : 'Choose a model file'}
                    </span>
                    <span className="text-xs text-muted">
                      {meshFile
                        ? `${(meshFile.size / 1024 / 1024).toFixed(1)} MB`
                        : '.obj, .glb or .gltf, 25 MB at most'}
                    </span>
                  </button>
                  <input
                    ref={meshPicked}
                    type="file"
                    accept={kindAccepts.mesh}
                    className="hidden"
                    onChange={(e) => { setMeshFile(e.target.files?.[0] ?? null); e.target.value = '' }}
                  />
                </>
              ) : meshes.loading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (meshes.data ?? []).length === 0 ? (
                <p className="text-xs text-muted">
                  You have not uploaded any models yet. Upload one above and it
                  becomes one of yours.
                </p>
              ) : (
                <Choices
                  label="Which of your models"
                  size="sm"
                  tone="soft"
                  value={meshId || null}
                  onChange={setMeshId}
                  options={(meshes.data ?? []).map((one) => ({
                    value: one.id, label: one.name, icon: faCube,
                  }))}
                />
              )}

              {/* Only an accessory has somewhere to choose. Hair goes where
                  hair goes, and asking was what broke it. */}
              {kind === 'accessory' && (
                <>
                  <p className="pt-2 font-display text-[10px] uppercase tracking-wider text-muted">
                    Where it goes
                  </p>
                  <Choices
                    label="Where it goes"
                    size="sm"
                    tone="soft"
                    value={slot}
                    onChange={setSlot}
                    options={PLACES.map((one) => ({ value: one.slot, label: one.label }))}
                  />
                </>
              )}

              {/*
                * Its texture, which is not optional in practice: a model with
                * none renders in flat grey and reads as broken rather than as
                * undressed. One of your own Decals, or anybody's by id.
                */}
              <p className="pt-2 font-display text-[10px] uppercase tracking-wider text-muted">
                What it wears
              </p>
              {fresh && (
                <>
                  <button
                    type="button"
                    onClick={() => skinPicked.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-line bg-ink-raised px-4 py-6 text-center transition-colors hover:border-brand/60 hover:bg-ink-hover"
                  >
                    <FontAwesomeIcon icon={faImage} className="text-lg text-white/40" />
                    <span className="text-sm font-semibold">
                      {skinFile ? skinFile.name : 'Upload a picture for it'}
                    </span>
                  </button>
                  <input
                    ref={skinPicked}
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0] ?? null
                      setSkinFile(chosen)
                      if (chosen) { setTextureId(''); setDecalTag(''); setDecal(null) }
                      e.target.value = ''
                    }}
                  />
                </>
              )}

              {!skinFile && (
                <Choices
                  label="What it wears"
                  size="sm"
                  tone="soft"
                  value={textureId || null}
                  onChange={(next) => { setTextureId(next); setDecalTag(''); setDecal(null) }}
                  options={(decals.data ?? []).map((one) => ({
                    value: one.id, label: one.name, icon: faImage,
                  }))}
                />
              )}
              {!textureId && !skinFile && (
                <Input
                  label="Or a Decal id"
                  labelNote="IMG-1042"
                  value={decalTag}
                  maxLength={20}
                  className="max-w-[16rem]"
                  onChange={(e) => {
                    const tag = e.target.value
                    setDecalTag(tag)
                    setDecal(null)
                    if (!tag.trim()) return
                    void decalBehind(tag)
                      .then((found) => { setDecal(found); setTextureId('') })
                      .catch(() => setDecal(null))
                  }}
                  hint={decalTag.trim() === ''
                    ? undefined
                    : decal ? `Wearing ${decal.name}.` : 'No Decal you can use with that id.'}
                />
              )}
              {!textureId && !decal && !skinFile && (
                <p className="text-[11px] leading-snug text-muted">
                  Without one it is flat grey, which reads as broken rather than
                  as plain.
                </p>
              )}

              {/*
                * The thing itself, on a body, while it is being made.
                *
                * Staw asked to see it rather than find out after paying to
                * make it, and he is right: an accessory is a model somebody
                * drew at whatever size around whatever origin, and the only
                * way to know it reads as a hat is to look at it on a head.
                * It follows the slot, so changing where it goes moves it.
                */}
              <div className="space-y-2 pt-2">
                <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                  On a body
                </p>
                <div className="overflow-hidden rounded-xl border border-ink-line bg-ink-raised">
                  {fitting ? (
                    <>
                      <AvatarStage
                        look={fitting}
                        turning={false}
                        handled
                        className="aspect-square w-full"
                      />
                      <div className="border-t border-ink-line p-2">
                        <FitEditor
                          value={fit}
                          onChange={setFit}
                          onReset={fitIsPlain(fit) ? undefined : () => setFit(PLAIN_FIT)}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="px-4 py-10 text-center text-xs text-muted">
                      Choose a model and it is drawn here, worn, so you can turn
                      it and see how it sits before you make it.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                The picture
              </p>
              {/*
                * The upload dialog's own drop area, not a button beside a
                * filename: choosing a file should feel the same wherever you
                * are choosing one, and Staw noticed when it did not.
                */}
              <button
                type="button"
                onClick={() => picked.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-line bg-ink-raised px-4 py-8 text-center transition-colors hover:border-brand/60 hover:bg-ink-hover"
              >
                <FontAwesomeIcon icon={picture ? faImage : faUpload} className="text-xl text-white/40" />
                <span className="text-sm font-semibold">
                  {picture ? picture.name : `Choose a picture for the ${chosen?.label.toLowerCase()}`}
                </span>
                {picture && (
                  <span className="text-xs text-muted">{(picture.size / 1024 / 1024).toFixed(1)} MB</span>
                )}
              </button>
              <input
                ref={picked}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={(e) => { setPicture(e.target.files?.[0] ?? null); e.target.value = '' }}
              />
            </div>
          )}

          <Input label="Name" value={name} maxLength={60}
            onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={about} maxLength={400}
            onChange={(e) => setAbout(e.target.value)} />
          {/*
            * No price here on purpose. Staw's rule: making something costs
            * what the kind costs, and the price is something you decide when
            * you put it in the Catalog - which is also where the server
            * checks it against the kind's floor.
            */}
          <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-muted">
            You set what it sells for when you list it, not now.
            {rule && rule.least_price > 0 && (
              <> The least a {chosen?.label.toLowerCase()} may go for is{' '}
                <span className="font-bold text-white">
                  <CurrencyMark className="mx-0.5" />{rule.least_price}
                </span>.
              </>
            )}
          </p>

          <div className="flex gap-2">
            <Button
              variant="yes"
              loading={busy}
              disabled={!allowed || !name.trim()}
              onClick={() => void make()}
            >
              {/* The mark rather than the word, everywhere a button names a price. */}
              {rule && rule.upload_cost > 0
                ? <>Make it for <CurrencyMark className="mx-0.5" />{rule.upload_cost}</>
                : 'Make it'}
            </Button>
            <Button variant="ghost" onClick={() => setMaking(false)}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </Page>
  )
}

/**
 * One thing somebody made, and everything they may do to it.
 *
 * Four actions and they are not the same weight, so they do not look the
 * same. Listing and taking down are one press. Editing opens in place.
 * Archiving says what it does to the people wearing it. Deleting is the only
 * one that cannot be undone, and the server refuses it the moment anybody
 * else owns one - so the button is there and the refusal explains itself,
 * rather than this page hiding a rule it would have to keep in step.
 */
function MadeCard({ item, onChanged, onTrouble, onDone, rule, canLimit, canScreen, me }: {
  item: AvatarItem
  onChanged: () => void
  onTrouble: (message: string) => void
  onDone: (message: string) => void
  /** This kind's floor, so the card can refuse a price the server would. */
  rule?: AvatarRule
  /** Only Kobblon closes a sale, and the server is the one that says so. */
  canLimit: boolean
  /** Whether this person may screen things. The database decides for real. */
  canScreen: boolean
  /** Whose folder a redrawn card is written into. */
  me: string
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [about, setAbout] = useState(item.description ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [busy, setBusy] = useState<string | null>(null)
  const [sure, setSure] = useState(false)
  /*
   * Listing asks for a price, because making something no longer does: Staw's
   * rule is that a price is what you decide when you put it on sale. Opened
   * in place rather than as a dialog - it is one number.
   */
  const [listing, setListing] = useState(false)
  const [asking, setAsking] = useState(String(item.price || rule?.least_price || 0))
  const [limiting, setLimiting] = useState(false)
  /*
   * Placing it again, after it exists. The same editor the create dialog
   * uses, on the same live rig - because "it floats" is something somebody
   * usually notices a day later, and making a second item to fix it is not
   * an answer.
   */
  const isModel = item.kind === 'accessory' || item.kind === 'hair'
  const [placing, setPlacing] = useState(false)
  const [fit, setFit] = useState<Required<WornFit>>(asFit(item.fit))
  const [worn, setWorn] = useState<{ mesh: string; skin: string | null } | null>(null)
  /*
   * Its own fetch rather than a prop threaded down through every card:
   * `mannequinFace` remembers its answer, so twenty cards asking is one
   * request and the second card onwards resolves immediately.
   */
  const [face, setFace] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void mannequinFace().then((picture) => { if (live) setFace(picture) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!placing || worn || !item.mesh_path) return
    let live = true
    void (async () => {
      const [mesh, skin] = await Promise.all([
        assetUrl(item.mesh_path!).catch(() => null),
        item.texture_path ? assetUrl(item.texture_path).catch(() => null) : null,
      ])
      if (live && mesh) setWorn({ mesh, skin })
    })()
    return () => { live = false }
  }, [placing, worn, item.mesh_path, item.texture_path])
  const [closes, setCloses] = useState(
    item.sells_until ? item.sells_until.slice(0, 16) : '',
  )
  const closed = !!item.sells_until && new Date(item.sells_until).getTime() <= Date.now()

  const run = async (what: string, doIt: () => Promise<void>, said: string) => {
    setBusy(what)
    try {
      await doIt()
      onDone(said)
      onChanged()
    } catch (error) {
      onTrouble(error instanceof Error ? error.message : 'That did not work.')
    } finally {
      setBusy(null)
    }
  }

  const picture = cardFor(item)
  const archived = item.status === 'approved' && !item.is_public

  const state = item.status === 'approved'
    ? item.is_public ? 'In the Catalog' : 'Not listed'
    : item.status === 'rejected' ? (item.review_note ?? 'Turned down')
      : 'Waiting to be screened'

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-ink-line bg-ink-card">
      <div className="relative grid aspect-square place-items-center overflow-hidden bg-media">
        {picture
          ? <img src={picture} alt="" loading="lazy" className="h-full w-full object-contain" />
          : <FontAwesomeIcon icon={faShirt} className="text-3xl text-white/25" />}
        <span className="absolute left-2 top-2 rounded-md bg-ink/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70 backdrop-blur-sm">
          {item.kind}
        </span>
        {item.sells_until && (
          /*
           * Down in the corner, Staw's word for it. A limited never stops
           * existing and nobody loses theirs - only buying closes - so the
           * mark says which of those two it is rather than just "limited".
           */
          <span className={cn(
            'absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5',
            'text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm',
            closed ? 'bg-ink/85 text-white/60' : 'bg-amber-400/90 text-ink',
          )}>
            <FontAwesomeIcon icon={faClock} />
            {closed ? 'Closed' : 'Limited'}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{item.name}</h3>
          <p className="truncate text-[11px] text-muted">
            {state}
            {typeof item.taken === 'number' && item.taken > 0
              && ` · ${item.taken} ${item.taken === 1 ? 'has it' : 'have it'}`}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2">
          {item.status === 'approved' ? (
            <Button
              size="sm"
              className="flex-1"
              icon={item.is_public ? undefined : faStore}
              variant={item.is_public ? 'subtle' : 'yes'}
              loading={busy === 'list'}
              onClick={() => {
                if (item.is_public) {
                  void run('list', () => listAvatarItem(item.id, false), 'Taken off the Catalog.')
                  return
                }
                setAsking(String(item.price || rule?.least_price || 0))
                setListing(true)
              }}
            >
              {item.is_public ? 'Take down' : 'Publish'}
            </Button>
          ) : item.status === 'pending' && canScreen ? (
            /*
             * Offered on what the page can see; the server decides. It
             * refuses the person who made it, so this is only ever here for
             * somebody screening somebody else's work.
             */
            <Button
              size="sm"
              className="flex-1"
              variant="subtle"
              icon={faCircleCheck}
              loading={busy === 'screen'}
              onClick={() => void run(
                'screen',
                () => reviewAvatarItem(item.id, 'approved'),
                'Screened. It can go in the Catalog now.',
              )}
            >
              Let it through
            </Button>
          ) : null}

          <Menu
            label="More"
            align="right"
            trigger={
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-line bg-ink-raised text-white/60 transition-colors hover:bg-ink-hover hover:text-white">
                <FontAwesomeIcon icon={faEllipsis} />
              </span>
            }
            items={[
              { label: 'Edit', icon: faPen, onSelect: () => setEditing(true) },
              { label: archived ? 'Put it back' : 'Archive', icon: faBoxArchive,
                onSelect: () => void run(
                  'archive',
                  () => archiveAvatarItem(item.id, !archived),
                  archived
                    ? 'Back. List it when you are ready.'
                    : 'Archived. Anybody wearing it keeps it.',
                ) },
              /*
                * Two things somebody wants from a card they made and could
                * not get: see the thing where everybody else sees it, and
                * make the picture appear when it did not.
                */
              ...(item.status === 'approved' && item.is_public ? [{
                label: 'See it on the Catalog',
                icon: faArrowUpRightFromSquare,
                to: `/catalog/${avatarTag(item.kind, item.content_id)}`,
              }] : []),
              ...(isModel ? [{
                label: 'Where it sits',
                icon: faArrowsUpDownLeftRight,
                onSelect: () => { setFit(asFit(item.fit)); setPlacing(true) },
              }] : []),
              { label: 'Draw its picture again', icon: faCamera,
                onSelect: () => void run(
                  'card',
                  async () => {
                    const drawn = await redrawAvatarCard(item, me)
                    if (!drawn) throw new Error('Nothing came out of the drawing.')
                  },
                  'Drawn.',
                ) },
              ...(canLimit ? [{
                label: item.sells_until ? 'Change when it closes' : 'Make it a limited',
                icon: faClock,
                onSelect: () => setLimiting(!limiting),
              }] : []),
              { label: sure ? 'Really delete it' : 'Delete', icon: faTrash, danger: true,
                onSelect: () => {
                  if (!sure) { setSure(true); return }
                  setSure(false)
                  void run('delete', () => deleteAvatarItem(item.id), 'Deleted.')
                } },
            ]}
          />
        </div>
      </div>

      {/*
        * Publishing is a card of its own, because it is a decision with a
        * number in it rather than a toggle: Staw's "you click on it, a card
        * appears and u set the price and publish it onto the catalog".
        */}
      <Dialog
        open={listing}
        onClose={() => setListing(false)}
        title={`Publish ${item.name}`}
        description="It goes into the Catalog at this price. You can take it down again whenever you like, for nothing."
        footer={
          <>
            <Button variant="ghost" onClick={() => setListing(false)}>Cancel</Button>
            <Button
              variant="yes"
              icon={faStore}
              loading={busy === 'list'}
              onClick={() => void run(
                'list',
                async () => {
                  await listAvatarItem(
                    item.id, true, Math.max(0, Math.round(Number(asking) || 0)),
                  )
                  setListing(false)
                },
                'In the Catalog.',
              )}
            >
              Publish it
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-media">
              {picture
                ? <img src={picture} alt="" className="h-full w-full object-contain" />
                : <FontAwesomeIcon icon={faShirt} className="text-2xl text-white/25" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{item.name}</p>
              <p className="text-xs capitalize text-muted">{item.kind}</p>
            </div>
          </div>

          <Input
            label="What it sells for"
            type="number"
            min={rule?.least_price ?? 0}
            className="max-w-[12rem]"
            value={asking}
            onChange={(e) => setAsking(e.target.value)}
            hint={rule && rule.least_price > 0
              ? `At least ${rule.least_price}.`
              : 'Zero means free.'}
          />
        </div>
      </Dialog>

      <Dialog
        open={placing}
        onClose={() => setPlacing(false)}
        title={`Where ${item.name} sits`}
        description="Adjusted on top of where the measuring puts it, so nothing is where it was before you touched it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPlacing(false)}>Cancel</Button>
            <Button
              variant="yes"
              loading={busy === 'fit'}
              onClick={() => void run(
                'fit',
                async () => {
                  await setAvatarFit(item.id, fitIsPlain(fit) ? null : fit)
                  // The card is a picture of where it sits, so it is drawn
                  // again - otherwise the shelf shows the old placement for
                  // ever and the change looks like it did nothing.
                  await redrawAvatarCard({ ...item, fit }, me).catch(() => null)
                  setPlacing(false)
                },
                'Placed.',
              )}
            >
              Save where it sits
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-ink-line bg-ink-raised">
            {worn ? (
              <AvatarStage
                look={{
                  body: MANNEQUIN_BODY,
                  pieces: [
                    { slot: 'face', kind: 'face', imageUrl: face ?? plainFace() },
                    {
                      slot: item.slot,
                      kind: item.kind,
                      meshUrl: worn.mesh,
                      meshFormat: item.mesh_format ?? formatOf(item.mesh_path ?? ''),
                      textureUrl: worn.skin,
                      fit,
                    },
                  ],
                }}
                turning={false}
                handled
                className="aspect-square w-full"
              />
            ) : (
              <Skeleton className="aspect-square w-full" />
            )}
          </div>
          <FitEditor
            value={fit}
            onChange={setFit}
            onReset={fitIsPlain(fit) ? undefined : () => setFit(PLAIN_FIT)}
          />
        </div>
      </Dialog>

      <Dialog
        open={limiting}
        onClose={() => setLimiting(false)}
        title={item.sells_until ? `When ${item.name} closes` : `Make ${item.name} a limited`}
        description="After the moment you pick, nobody can buy it. It still exists and everybody who has one keeps it."
        footer={
          <>
            {item.sells_until && (
              <Button
                variant="subtle"
                loading={busy === 'unlimit'}
                onClick={() => void run(
                  'unlimit',
                  async () => {
                    await setLimited(item.id, null)
                    setCloses('')
                    setLimiting(false)
                  },
                  'No longer a limited.',
                )}
              >
                Not a limited
              </Button>
            )}
            <Button variant="ghost" onClick={() => setLimiting(false)}>Cancel</Button>
            <Button
              variant="yes"
              loading={busy === 'limit'}
              disabled={!closes}
              onClick={() => void run(
                'limit',
                async () => {
                  await setLimited(item.id, closes ? new Date(closes).toISOString() : null)
                  setLimiting(false)
                },
                'It closes then.',
              )}
            >
              Save
            </Button>
          </>
        }
      >
        {/* The Events calendar, which is the one we already have. */}
        <DateTimeField
          label="Sells until"
          value={closes}
          onChange={setCloses}
          min={new Date()}
          clearable
        />
      </Dialog>

      {/*
        * Editing opens a card of its own. It was a panel that unfolded
        * underneath, which reflowed the whole shelf and put the fields in a
        * column three inches wide - Staw's "it should be opening up a card".
        * Every other edit on Kobblon is a Dialog, so this is one too.
        */}
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${item.name}`}
        description="What it is and the picture on it stay as they are. Somebody who bought this bought this."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              variant="yes"
              loading={busy === 'save'}
              onClick={() => void run(
                'save',
                async () => {
                  await editAvatarItem(
                    item.id, name, about, Math.max(0, Math.round(Number(price) || 0)),
                  )
                  setEditing(false)
                },
                'Saved.',
              )}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-line bg-media">
              {picture
                ? <img src={picture} alt="" className="h-full w-full object-contain" />
                : <FontAwesomeIcon icon={faShirt} className="text-xl text-white/25" />}
            </span>
            <p className="text-xs leading-relaxed text-muted">
              {state}
              {item.sells_until && (
                <> · {closed ? 'Closed' : 'Limited'}</>
              )}
            </p>
          </div>

          <Input label="Name" value={name} maxLength={60}
            onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={about} maxLength={400}
            onChange={(e) => setAbout(e.target.value)} />
          <Input
            label="What it sells for"
            type="number"
            min={rule?.least_price ?? 0}
            className="max-w-[12rem]"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint={rule && rule.least_price > 0
              ? `At least ${rule.least_price}.`
              : 'Zero means free.'}
          />
        </div>
      </Dialog>

    </article>
  )
}
