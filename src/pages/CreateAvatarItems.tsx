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
import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faDownload, faImage, faCube, faLock, faCircleCheck, faPen,
  faTrash, faBoxArchive, faEllipsis,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { Menu } from '@/components/ui/Menu'
import { EmptyState, Skeleton } from '@/components/ui/States'
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
      made.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null

  return (
    <Page className="space-y-5">
      <header>
        <h1 className="font-display text-2xl">Make something to wear</h1>
        <p className="text-sm text-muted">
          Shirts, trousers, t-decals, accessories and hair, for the Catalog.
        </p>
      </header>

      <Tabs
        value={kind}
        onChange={(next) => setKind(next as AvatarKind)}
        options={tabs.map((one) => ({ value: one.kind, label: one.label }))}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card className="space-y-4">
          <p className="text-sm text-muted">{chosen?.about}</p>

          {/*
            * What it costs, said before anybody commits to it, and read from
            * the same function the charge is made from.
            */}
          {rules.loading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : rule && (
            <div className="grid gap-3 rounded-xl border border-ink-line bg-ink-raised p-3 sm:grid-cols-2">
              <p className="text-xs leading-relaxed text-muted">
                Making one costs{' '}
                <span className="font-bold text-white">
                  {rule.upload_cost > 0 ? <><CurrencyMark className="mx-0.5" />{rule.upload_cost}</> : 'nothing'}
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
                  : 'Only verified accounts can make these. Everything else on this page is open to you.'}
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
                  You have not uploaded any models yet. Upload one in Create first,
                  then it turns up here.
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
              <input
                type="file"
                accept="image/png,image/webp,image/jpeg"
                onChange={(e) => setPicture(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-hover file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
              />
              {picture && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <FontAwesomeIcon icon={faImage} />
                  {picture.name}
                </p>
              )}
            </div>
          )}

          <Input label="Name" value={name} maxLength={60}
            onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={about} maxLength={400}
            onChange={(e) => setAbout(e.target.value)} />
          <Input
            label={`Price in Brix`}
            type="number"
            min={rule?.least_price ?? 0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint={rule
              ? rule.least_price > 0
                ? `At least ${rule.least_price}.`
                : 'Zero means free.'
              : undefined}
            className="max-w-xs"
          />

          <Button
            variant="yes"
            loading={busy}
            disabled={!allowed || !name.trim()}
            onClick={() => void make()}
          >
            Make it{rule && rule.upload_cost > 0 ? ` for ${rule.upload_cost} Brix` : ''}
          </Button>
          <p className="text-xs text-muted">
            Everything goes through screening before anybody else can see it.
          </p>
        </Card>

        {/* ------------------------------------------------ what you made */}
        <div className="space-y-3">
          <p className="font-display text-xs uppercase tracking-wider text-muted">
            What you have made
          </p>
          {made.loading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (made.data ?? []).length === 0 ? (
            <EmptyState mood="emptyBox" title="Nothing yet"
              body="What you make turns up here, with whether it has been screened." />
          ) : (
            <ul className="space-y-2">
              {(made.data ?? []).map((one) => (
                <MadeRow
                  key={one.id}
                  item={one}
                  onChanged={() => made.reload()}
                  onTrouble={(message) => say(message, 'error')}
                  onDone={(message) => say(message, 'success')}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
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
function MadeRow({ item, onChanged, onTrouble, onDone }: {
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

  return (
    <li className="rounded-xl border border-ink-line bg-ink-card p-2.5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-media">
          {picture
            ? <img src={picture} alt="" className="h-full w-full object-contain" />
            : <FontAwesomeIcon icon={faShirt} className="text-white/30" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{item.name}</span>
          <span className="block text-[11px] text-muted">
            {item.status === 'approved'
              ? item.is_public ? 'In the Catalog' : 'Approved, not listed'
              : item.status === 'rejected' ? (item.review_note ?? 'Turned down')
                : 'Waiting to be screened'}
            {typeof item.taken === 'number' && item.taken > 0
              && ` · ${item.taken} ${item.taken === 1 ? 'person has it' : 'people have it'}`}
          </span>
        </span>

        {item.status === 'approved' && (
          <Button
            size="sm"
            variant={item.is_public ? 'subtle' : 'yes'}
            loading={busy === 'list'}
            onClick={() => void run(
              'list',
              () => listAvatarItem(item.id, !item.is_public),
              item.is_public ? 'Taken off the Catalog.' : 'In the Catalog.',
            )}
          >
            {item.is_public
              ? 'Take down'
              : <><FontAwesomeIcon icon={faCircleCheck} />List it</>}
          </Button>
        )}

        <Menu
          label="More"
          trigger={
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-line bg-ink-card text-white/60 transition-colors hover:bg-ink-hover hover:text-white">
              <FontAwesomeIcon icon={faEllipsis} />
            </span>
          }
          items={[
            { label: editing ? 'Stop editing' : 'Edit', icon: faPen,
              onSelect: () => setEditing(!editing) },
            { label: archived ? 'Put it back' : 'Archive',
              icon: faBoxArchive,
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

      {editing && (
        <div className="mt-3 space-y-2 border-t border-ink-line pt-3">
          <Input label="Name" value={name} maxLength={60}
            onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" value={about} maxLength={400}
            onChange={(e) => setAbout(e.target.value)} />
          <Input label="Price in Brix" type="number" min={0} className="max-w-[10rem]"
            value={price} onChange={(e) => setPrice(e.target.value)} />
          <p className="text-xs text-muted">
            What it is and the picture on it stay as they are. Somebody who bought
            this bought this.
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
    </li>
  )
}
