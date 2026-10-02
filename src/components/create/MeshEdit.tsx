/*
 * Changing a mesh after it was uploaded.
 *
 * Until now the only way to put a Decal on a mesh, or to fix a model that
 * came out wrong, was to upload the whole thing again - which gives it a new
 * number and loses the uses, the reviews, and every id anybody had already
 * pasted into a World. Staw asked for both, at ten Brix each.
 *
 * The price is shown before the press, not after, and the two sit apart
 * because they are two decisions: a picture can be swapped as often as
 * somebody likes, and a new model changes what every World already using
 * this id is drawing.
 */
import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faCube, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CurrencyMark } from '@/components/brand/Currency'
import { useToast } from '@/components/ui/Toast'
import { kindAccepts } from '@/lib/kinds'
import {
  MESH_EDIT_PRICE, decalBehind, redressMesh, replaceMeshFile, redrawMesh,
} from '@/lib/api'
import type { AssetPageItem } from '@/types/db'

export function MeshEdit({ asset, userId, onChanged }: {
  asset: AssetPageItem
  userId: string
  onChanged: () => void
}) {
  const say = useToast()
  const model = useRef<HTMLInputElement>(null)
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (what: string, doIt: () => Promise<number>) => {
    setBusy(what)
    try {
      const paid = await doIt()
      /*
       * The card is redrawn too, or the Marketplace keeps showing the model
       * as it was: the picture is taken once at upload, so changing the
       * Decal or the file afterwards used to leave a card that no longer
       * matched the thing on its own page.
       *
       * Best effort, and after the change rather than before. A card that
       * failed to redraw is worth far less than a change that failed to
       * save, so this never turns a successful edit into an error.
       */
      await redrawMesh(asset.id, userId).catch(() => null)
      say(paid > 0 ? `Done. ${paid} Brix.` : 'Done.', 'success')
      onChanged()
    } catch (error) {
      // The server's own words: it says why, and why is the useful part.
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const dress = async () => {
    const found = await decalBehind(tag.trim()).catch(() => null)
    if (!found) {
      say('No Decal with that id, or not one you can use.', 'error')
      return
    }
    await run('dress', () => redressMesh(asset.id, found.id))
    setTag('')
  }

  return (
    <div className="space-y-4 rounded-xl border border-ink-line bg-ink-raised p-4">
      <h2 className="font-display text-sm uppercase tracking-wider">Change this mesh</h2>

      {/* --------------------------------------------------- the picture */}
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          <FontAwesomeIcon icon={faImage} className="text-white/40" />
          {asset.texture_content_id ? 'Wearing a Decal' : 'No Decal on it'}
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <Input
              label="Decal id"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="IMG-1042"
            />
          </div>
          <Button
            size="sm"
            disabled={!!busy || !tag.trim()}
            onClick={() => void dress()}
          >
            <CurrencyMark />
            {MESH_EDIT_PRICE}
          </Button>
          {asset.texture_content_id && (
            <Button
              size="sm"
              variant="subtle"
              disabled={!!busy}
              onClick={() => run('undress', () => redressMesh(asset.id, null))}
            >
              <FontAwesomeIcon icon={faXmark} />
              Take it off
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">
          Any Decal of yours, or one that is listed. Taking one off is free.
        </p>
      </div>

      {/* ----------------------------------------------------- the model */}
      <div className="space-y-2 border-t border-ink-line pt-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <FontAwesomeIcon icon={faCube} className="text-white/40" />
          The model
        </p>

        <input
          ref={model}
          type="file"
          accept={kindAccepts.mesh}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void run('model', () => replaceMeshFile(asset.id, userId, file))
          }}
        />
        <Button size="sm" disabled={!!busy} onClick={() => model.current?.click()}>
          <CurrencyMark />
          {MESH_EDIT_PRICE}
        </Button>
        <p className="text-xs text-muted">
          Keeps {asset.content_id ? `MSH-${asset.content_id}` : 'the same id'}, so
          every World already using it gets the new model. It goes back for
          checking, like any new upload.
        </p>
      </div>
    </div>
  )
}
