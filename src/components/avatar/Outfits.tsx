/*
 * Outfits: what you have on, kept, named, put in a folder, and sold.
 *
 * Staw: "create outfits (create folders too) ... also for the outfits, every
 * player can create outfits and sell them onto the catalog ... theres the
 * kobblon tax on it ofc, but the person who made the outfit also taxes on
 * the each purchase."
 *
 * The money and the rules are the database's - `save_outfit` reads what
 * somebody is wearing rather than taking a list from here, `wear_outfit`
 * puts it on, `buy_outfit` buys every piece and splits the proceeds. This
 * panel is the hands: it names things, puts them in folders, and says what
 * they sell for.
 *
 * Its own component because My Avatar is already a long page, and because
 * the Workspace will want it: no provider of its own, no router.
 */
import { useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faFolder, faFolderPlus, faPlus, faShirt, faTrash, faTag, faCheck,
  faGear, faPenToSquare, faArrowsRotate, faStore,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/States'
import { Menu } from '@/components/ui/Menu'
import { Tooltip } from '@/components/ui/Tooltip'
import { Confirm } from '@/components/ui/Confirm'
import { OutfitStage } from '@/components/avatar/OutfitStage'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { CurrencyMark } from '@/components/brand/Currency'
import {
  myOutfits, myOutfitFolders, saveOutfit, wearOutfit, removeOutfit,
  makeOutfitFolder, listOutfit, renameOutfit, restyleOutfit, type Outfit,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { avatarKindLabels, outfitTag } from '@/lib/kinds'

/** One saved look. */
function OutfitCard({ outfit, onChanged, onWear }: {
  outfit: Outfit
  onChanged: () => void
  onWear: () => void
}) {
  const say = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [selling, setSelling] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [binning, setBinning] = useState(false)
  const [name, setName] = useState(outfit.name)
  const [price, setPrice] = useState(String(outfit.price || 0))
  /*
   * Bumped whenever the pieces change, and handed to the stage as a key so
   * it draws the new outfit rather than keeping the one it loaded. Without
   * it, Update changes what is saved and the card goes on showing what was
   * saved before - a picture that disagrees with the thing it is of.
   */
  const [drawn, setDrawn] = useState(0)

  const run = async (what: string, doIt: () => Promise<unknown>, said: string) => {
    setBusy(what)
    try {
      await doIt()
      say(said, 'success')
      onChanged()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const pieces = Array.isArray(outfit.pieces) ? outfit.pieces : []

  return (
    <Card className="animate-row-in overflow-hidden p-0 transition-colors hover:border-brand/40">
      {/*
        * The outfit itself, standing up, which is what Staw asked for: "i
        * want to see each outfit in 3d". A grid of names and counts is a
        * list of files; a grid of bodies is a wardrobe.
        */}
      <div className="relative">
        {/*
          * Bigger, and the figure turns slowly so a wardrobe of them reads
          * as a rack rather than a sheet of stamps. Not draggable here:
          * in a grid a drag is the page being scrolled, and the outfit's
          * own page is where you turn it.
          */}
        <OutfitStage
          key={`${outfit.id}:${drawn}`}
          outfitId={outfit.id}
          turning
          className="aspect-square w-full"
        />

        {/* The gear, top right, exactly where Staw's picture has it. */}
        <div className="absolute right-2 top-2">
          <Menu
            label={`What to do with ${outfit.name}`}
            trigger={
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-card/90 text-sm text-white/80 backdrop-blur transition-colors hover:text-white">
                <Glyph icon={faGear} />
              </span>
            }
            items={[
              {
                label: 'Update to what I am wearing',
                icon: faArrowsRotate,
                onSelect: () => void run('restyle', async () => {
                  await restyleOutfit(outfit.id)
                  setDrawn((n) => n + 1)
                }, `${outfit.name} is what you have on now.`),
              },
              { label: 'Rename', icon: faPenToSquare, onSelect: () => setRenaming(true) },
              {
                label: outfit.is_public ? 'Change the price' : 'Sell it',
                icon: faTag,
                onSelect: () => setSelling(true),
              },
              { label: 'Delete', icon: faTrash, danger: true, onSelect: () => setBinning(true) },
            ]}
          />
        </div>

        {outfit.is_public && (
          <span className="absolute left-2 top-2">
            <Badge tone="space">
              {outfit.price > 0
                ? <><CurrencyMark className="mr-0.5" />{formatCount(outfit.price)}</>
                : 'Free'}
            </Badge>
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-extrabold">{outfit.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
            <span>{pieces.length} {pieces.length === 1 ? 'thing' : 'things'}</span>
            {outfit.folder_name && <span>· {outfit.folder_name}</span>}
            {outfit.is_public && <span>· in the Catalog</span>}
          </p>
        </div>

        {/*
          * What is in it, as a line of the pieces' own pictures. A name
          * and a count says how many; this says which, which is the thing
          * somebody is actually choosing between when two outfits have
          * the same number of things in them.
          */}
        {!!pieces.length && (
          <ul className="flex flex-wrap gap-1.5">
            {pieces.slice(0, 6).map((piece) => (
              <li
                key={piece.content_id}
                title={piece.name}
                className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-raised text-[9px] font-bold uppercase text-white/40"
              >
                {(avatarKindLabels[piece.kind] ?? piece.kind).slice(0, 2)}
              </li>
            ))}
            {pieces.length > 6 && (
              <li className="grid h-8 min-w-8 place-items-center rounded-lg border border-ink-line bg-ink-raised px-1.5 text-[10px] font-bold text-white/40">
                +{pieces.length - 6}
              </li>
            )}
          </ul>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="yes"
            icon={faShirt}
            className="flex-1"
            loading={busy === 'wear'}
            onClick={() => void run('wear', async () => {
              await wearOutfit(outfit.id)
              onWear()
            }, `${outfit.name} is on.`)}
          >
            Wear it
          </Button>

          {/*
            * Staw: "with the view on the catalog thing to see the asset
            * page of your outfit". Only when it is listed, because an
            * outfit that is not in the Catalog has a page nobody else can
            * open and sending somebody to it is a door into an empty room.
            */}
          {outfit.is_public && (
            <Tooltip label="See its Catalog page" side="top">
              <Button
                size="sm"
                variant="subtle"
                to={`/catalog/outfit/${outfitTag(outfit.content_id)}`}
                aria-label="See it on the Catalog"
              >
                <Glyph icon={faStore} />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      <Dialog
        open={renaming}
        onClose={() => { setRenaming(false); setName(outfit.name) }}
        title="Rename this outfit"
        description="Only the name moves. What is in it, where it sits and what it sells for all stay as they are."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRenaming(false); setName(outfit.name) }}>
              Cancel
            </Button>
            <Button
              variant="yes"
              icon={faCheck}
              loading={busy === 'rename'}
              disabled={!name.trim() || name.trim() === outfit.name}
              onClick={() => void run('rename', async () => {
                await renameOutfit(outfit.id, name.trim())
                setRenaming(false)
              }, 'Renamed.')}
            >
              Save
            </Button>
          </>
        }
      >
        <Input
          label="Name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </Dialog>

      <Confirm
        open={binning}
        onClose={() => setBinning(false)}
        onConfirm={() => void run('remove', async () => {
          await removeOutfit(outfit.id)
          setBinning(false)
        }, 'Gone.')}
        title={`Delete ${outfit.name}?`}
        lead="The look goes. Everything in it is still yours."
        points={[
          'Nothing you own is deleted; only this saved arrangement of it.',
          outfit.is_public
            ? 'It comes out of the Catalog. Anybody who already bought it keeps what they bought.'
            : 'It was never listed, so nobody else is affected.',
        ]}
        confirmText="Delete it"
      />

      <Dialog
        open={selling}
        onClose={() => setSelling(false)}
        title={`Sell ${outfit.name}`}
        description="Anybody who buys it buys every piece they do not already own. Kobblon takes its cut and you take yours on every sale."
        size="sm"
        footer={
          <>
            {outfit.is_public && (
              <Button
                variant="ghost"
                loading={busy === 'unlist'}
                onClick={() => void run('unlist', async () => {
                  await listOutfit(outfit.id, false)
                  setSelling(false)
                }, 'Taken down.')}
              >
                Take it down
              </Button>
            )}
            <Button
              variant="yes"
              icon={faCheck}
              loading={busy === 'list'}
              onClick={() => void run('list', async () => {
                await listOutfit(outfit.id, true, Math.max(0, Math.round(Number(price) || 0)))
                setSelling(false)
              }, 'It is in the Catalog.')}
            >
              {outfit.is_public ? 'Save' : 'Put it up'}
            </Button>
          </>
        }
      >
        <Input
          label="What it sells for"
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint="Zero is free, which is allowed: an outfit of free things costs nothing to put on."
          className="max-w-[12rem]"
        />
      </Dialog>
    </Card>
  )
}

export function Outfits({ onWear }: { onWear: () => void }) {
  const say = useToast()
  const outfits = useAsync(async () => myOutfits(), [])
  const folders = useAsync(async () => myOutfitFolders(), [])

  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [folder, setFolder] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [newFolder, setNewFolder] = useState('')

  const save = async () => {
    setBusy(true)
    try {
      await saveOutfit(name.trim(), folder || null)
      say('Saved.', 'success')
      setName('')
      setSaving(false)
      outfits.reload()
      folders.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const addFolder = async () => {
    if (!newFolder.trim()) return
    setBusy(true)
    try {
      await makeOutfitFolder(newFolder.trim())
      setNewFolder('')
      folders.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /*
   * Grouped by folder, with the loose ones last. The grouping is here rather
   * than in the reader because it is a way of looking at a list, not a fact
   * about it - and the reader already hands back the folder each one is in.
   */
  const grouped = (folders.data ?? []).map((one) => ({
    id: one.id,
    name: one.name,
    outfits: (outfits.data ?? []).filter((o) => o.folder_id === one.id),
  }))
  const loose = (outfits.data ?? []).filter((o) => !o.folder_id)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={faPlus} onClick={() => setSaving(true)}>
          Save what I am wearing
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="New folder"
            className="w-40"
          />
          <Button
            variant="subtle"
            icon={faFolderPlus}
            loading={busy}
            disabled={!newFolder.trim()}
            onClick={() => void addFolder()}
          >
            Add
          </Button>
        </div>
      </div>

      {outfits.loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : !outfits.data?.length ? (
        <p className="text-sm text-muted">
          Nothing saved yet. Put something together and keep it here; you can
          wear it again in one press, or sell it in the Catalog.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.filter((one) => one.outfits.length).map((one) => (
            <section key={one.id}>
              <p className="mb-2 flex items-center gap-2 font-display text-xs uppercase tracking-wider text-muted">
                <Glyph icon={faFolder} />
                {one.name}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {one.outfits.map((outfit) => (
                  <OutfitCard
                    key={outfit.id}
                    outfit={outfit}
                    onChanged={outfits.reload}
                    onWear={onWear}
                  />
                ))}
              </div>
            </section>
          ))}

          {!!loose.length && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {loose.map((outfit) => (
                <OutfitCard
                  key={outfit.id}
                  outfit={outfit}
                  onChanged={outfits.reload}
                  onWear={onWear}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={saving}
        onClose={() => setSaving(false)}
        title="Save this outfit"
        description="Whatever you have on right now, kept under a name. Your colours go with it."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaving(false)}>Cancel</Button>
            <Button variant="yes" loading={busy} disabled={!name.trim()} onClick={() => void save()}>
              Save it
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Saturday"
          />
          {!!folders.data?.length && (
            <label className="block space-y-1.5">
              <span className="font-display text-[10px] uppercase tracking-wider text-muted">
                Folder
              </span>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm"
              >
                <option value="">No folder</option>
                {folders.data.map((one) => (
                  <option key={one.id} value={one.id}>{one.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Dialog>
    </div>
  )
}
