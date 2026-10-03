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
import { useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faDownload, faImage, faCube, faLock, faPen,
  faTrash, faBoxArchive, faEllipsis, faPlus, faStore,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { Menu } from '@/components/ui/Menu'
import { Dialog } from '@/components/ui/Dialog'
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
  archiveAvatarItem, deleteAvatarItem,
} from '@/lib/api'
import type { AvatarKind, AvatarSlot, AvatarRule, AvatarItem } from '@/types/db'
import { cn } from '@/lib/cn'

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
  const [price, setPrice] = useState('')
  const [picture, setPicture] = useState<File | null>(null)
  const [making, setMaking] = useState(false)
  const picked = useRef<HTMLInputElement>(null)
  const [meshId, setMeshId] = useState('')
  const [busy, setBusy] = useState(false)

  const rules = useAsync(async () => avatarRules(), [])
  const made = useAsync(async () => (profile ? myMadeAvatarItems() : []), [profile?.id])
  const meshes = useAsync(
    async () => (profile ? (await listOwnAssets(profile.id)).filter((a) => a.kind === 'mesh') : []),
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

  const verified = !!profile && (profile.is_verified || profile.is_admin)
  const allowed = !rule || (!rule.needs_verified || verified) && !rule.kobblon_only
  const isModel = kind === 'accessory' || kind === 'hair'
  const chosen = KINDS.find((one) => one.kind === kind)

  const make = async () => {
    if (!profile || !rule) return
    const asked = Math.max(0, Math.round(Number(price) || 0))
    setBusy(true)
    try {
      let imagePath: string | null = null
      if (!isModel) {
        if (!picture) throw new Error('Choose a picture first.')
        imagePath = await uploadCatalogImage(profile.id, picture)
      } else if (!meshId) {
        throw new Error('Choose one of your models first.')
      }

      await createAvatarItem({
        kind,
        slot: isModel ? slot : (kind as AvatarSlot),
        name,
        description: about,
        price: asked,
        imagePath,
        meshId: isModel ? meshId : null,
      })

      say(
        rule.upload_cost > 0
          ? `Made. ${rule.upload_cost} Brix. It goes for screening before anybody sees it.`
          : 'Made. It goes for screening before anybody sees it.',
        'success',
      )
      setName(''); setAbout(''); setPrice(''); setPicture(null); setMeshId('')
      setMaking(false)
      made.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null

  const mine = made.data ?? []

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
            className={cn(
              'grid aspect-[3/4] place-items-center gap-2 rounded-xl border-2 border-dashed',
              'border-ink-line bg-ink-card text-white/60 transition-colors',
              'hover:border-brand hover:text-white',
            )}
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-hover">
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
              onChanged={() => made.reload()}
              onTrouble={(message) => say(message, 'error')}
              onDone={(message) => say(message, 'success')}
            />
          ))}
        </div>
      )}

      {!made.loading && mine.length === 0 && (
        <p className="text-sm text-muted">
          Nothing yet. What you make turns up here, with whether it has been screened.
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
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                Which of your models
              </p>
              {meshes.loading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : (meshes.data ?? []).length === 0 ? (
                <p className="text-xs text-muted">
                  You have not uploaded any models yet. Upload one in My Uploads
                  first and it turns up here.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(meshes.data ?? []).map((one) => (
                    <button
                      key={one.id}
                      type="button"
                      onClick={() => setMeshId(one.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-bold',
                        meshId === one.id
                          ? 'border-brand bg-brand/15 text-white'
                          : 'border-ink-line text-white/70 hover:text-white',
                      )}
                    >
                      <FontAwesomeIcon icon={faCube} className="mr-1.5 text-white/40" />
                      {one.name}
                    </button>
                  ))}
                </div>
              )}

              <p className="pt-2 font-display text-[10px] uppercase tracking-wider text-muted">
                Where it goes
              </p>
              <div className="flex flex-wrap gap-2">
                {PLACES.map((one) => (
                  <button
                    key={one.slot}
                    type="button"
                    onClick={() => setSlot(one.slot)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-bold',
                      slot === one.slot
                        ? 'border-brand bg-brand/15 text-white'
                        : 'border-ink-line text-white/70 hover:text-white',
                    )}
                  >
                    {one.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                The picture
              </p>
              <Button
                variant="subtle"
                icon={faImage}
                onClick={() => picked.current?.click()}
              >
                {picture ? 'Choose another' : 'Choose a picture'}
              </Button>
              <input
                ref={picked}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={(e) => { setPicture(e.target.files?.[0] ?? null); e.target.value = '' }}
              />
              {picture && <p className="text-xs text-muted">{picture.name}</p>}
            </div>
          )}

          <Input label="Name" value={name} maxLength={60}
            onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={about} maxLength={400}
            onChange={(e) => setAbout(e.target.value)} />
          <Input
            label="Price in Brix"
            type="number"
            min={rule?.least_price ?? 0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint={rule
              ? rule.least_price > 0 ? `At least ${rule.least_price}.` : 'Zero means free.'
              : undefined}
            className="max-w-[12rem]"
          />

          <div className="flex gap-2">
            <Button
              variant="yes"
              loading={busy}
              disabled={!allowed || !name.trim()}
              onClick={() => void make()}
            >
              Make it{rule && rule.upload_cost > 0 ? ` for ${rule.upload_cost} Brix` : ''}
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
function MadeCard({ item, onChanged, onTrouble, onDone }: {
  item: AvatarItem
  onChanged: () => void
  onTrouble: (message: string) => void
  onDone: (message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [about, setAbout] = useState(item.description ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [busy, setBusy] = useState<string | null>(null)
  const [sure, setSure] = useState(false)

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

  const picture = catalogUrl(item.image_path, item.image_bucket ?? undefined)
  const archived = item.status === 'approved' && !item.is_public && !editing

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
          {item.status === 'approved' && (
            <Button
              size="sm"
              className="flex-1"
              variant={item.is_public ? 'subtle' : 'yes'}
              loading={busy === 'list'}
              onClick={() => void run(
                'list',
                () => listAvatarItem(item.id, !item.is_public),
                item.is_public ? 'Taken off the Catalog.' : 'In the Catalog.',
              )}
            >
              {item.is_public ? 'Take down' : 'List it'}
            </Button>
          )}

          <Menu
            label="More"
            align="right"
            trigger={
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-line bg-ink-raised text-white/60 transition-colors hover:bg-ink-hover hover:text-white">
                <FontAwesomeIcon icon={faEllipsis} />
              </span>
            }
            items={[
              { label: editing ? 'Stop editing' : 'Edit', icon: faPen,
                onSelect: () => setEditing(!editing) },
              { label: archived ? 'Put it back' : 'Archive', icon: faBoxArchive,
                onSelect: () => void run(
                  'archive',
                  () => archiveAvatarItem(item.id, !archived),
                  archived
                    ? 'Back. List it when you are ready.'
                    : 'Archived. Anybody wearing it keeps it.',
                ) },
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

      {editing && (
        <div className="space-y-2 border-t border-ink-line p-3">
          <Input label="Name" value={name} maxLength={60}
            onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={about} maxLength={400}
            onChange={(e) => setAbout(e.target.value)} />
          <Input label="Price" type="number" min={0} className="max-w-[8rem]"
            value={price} onChange={(e) => setPrice(e.target.value)} />
          <p className="text-[11px] leading-snug text-muted">
            What it is and the picture on it stay as they are. Somebody who
            bought this bought this.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
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
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </article>
  )
}
