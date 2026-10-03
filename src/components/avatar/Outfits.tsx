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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFolder, faFolderPlus, faPlus, faShirt, faTrash, faTag, faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { CurrencyMark } from '@/components/brand/Currency'
import {
  myOutfits, myOutfitFolders, saveOutfit, wearOutfit, removeOutfit,
  makeOutfitFolder, listOutfit, type Outfit,
} from '@/lib/api'
import { formatCount } from '@/lib/format'

/** One saved look. */
function OutfitCard({ outfit, onChanged, onWear }: {
  outfit: Outfit
  onChanged: () => void
  onWear: () => void
}) {
  const say = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [selling, setSelling] = useState(false)
  const [price, setPrice] = useState(String(outfit.price || 0))

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
    <Card className="space-y-2.5 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{outfit.name}</p>
          <p className="text-[11px] text-muted">
            {pieces.length} {pieces.length === 1 ? 'thing' : 'things'}
            {outfit.folder_name && <> · {outfit.folder_name}</>}
          </p>
        </div>
        {outfit.is_public && (
          <Badge tone="space">
            {outfit.price > 0
              ? <><CurrencyMark className="mr-0.5" />{formatCount(outfit.price)}</>
              : 'Free'}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="yes"
          icon={faShirt}
          loading={busy === 'wear'}
          onClick={() => void run('wear', async () => {
            await wearOutfit(outfit.id)
            onWear()
          }, `${outfit.name} is on.`)}
        >
          Wear it
        </Button>
        <Button
          size="sm"
          variant="subtle"
          icon={faTag}
          onClick={() => setSelling(true)}
        >
          {outfit.is_public ? 'Listed' : 'Sell it'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={faTrash}
          loading={busy === 'remove'}
          onClick={() => void run('remove', () => removeOutfit(outfit.id), 'Gone.')}
        />
      </div>

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                <FontAwesomeIcon icon={faFolder} />
                {one.name}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
