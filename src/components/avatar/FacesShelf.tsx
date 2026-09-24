import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFaceSmile, faPlus, faCheck, faLock } from '@fortawesome/free-solid-svg-icons'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { buyFace, faceCatalogue, faceUrl, publishFace } from '@/lib/api'
import { currency } from '@/lib/currency'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Face } from '@/types/db'

/*
 * Faces, in the Catalog.
 *
 * Flat pictures worn on K6's head, the way the first brick-toy avatars wore
 * theirs. Kobblon publishes them and nobody else does, which is enforced by
 * the database rather than by this component hiding a button.
 *
 * There is no avatar rig yet and no page to dress one on, so a face can be
 * bought and not yet worn. That is said plainly here rather than hidden
 * behind a button that does nothing.
 */
export function FacesShelf() {
  const { profile } = useAuth()
  const toast = useToast()
  const faces = useAsync(() => faceCatalogue(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  /* Kobblon publishes these. The database says so too. */
  const mine = profile?.username
    ? ['kobblon', 'kobbleston'].includes(profile.username.toLowerCase())
    : false

  const buy = async (face: Face) => {
    setBusy(face.id)
    try {
      await buyFace(face.id)
      await faces.reload()
      toast(`${face.name} is yours.`)
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <FontAwesomeIcon icon={faFaceSmile} className="text-lg text-brand-bright" />
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted">
          Faces are worn by your avatar in Worlds. You can take one now; wearing it
          waits on the avatar itself, which is being built.
        </p>
        {mine && (
          <Button size="sm" icon={faPlus} onClick={() => setAdding(true)}>
            Publish a face
          </Button>
        )}
      </Card>

      {faces.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      )}

      {faces.error && <ErrorState message={faces.error} onRetry={faces.reload} />}

      {!faces.loading && !faces.data?.length && (
        <Card>
          <EmptyState
            mood="emptyBox"
            title="No faces yet"
            body="Kobblon has not published any. They arrive before the avatar does."
          />
        </Card>
      )}

      {!!faces.data?.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {faces.data.map((face) => (
            <article
              key={face.id}
              className="flex flex-col overflow-hidden rounded-xl border border-ink-line bg-ink-card"
            >
              <span className="grid aspect-square place-items-center bg-media p-3">
                <img
                  src={faceUrl(face.image_path)}
                  alt={face.name}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                <p className="truncate text-sm font-bold">{face.name}</p>
                <p className="text-xs text-muted">
                  {face.price > 0 ? `${formatCount(face.price)} ${currency.plural}` : 'Free'}
                </p>

                {face.owned ? (
                  <span className="mt-auto flex items-center gap-1.5 text-xs font-bold text-space-bright">
                    <FontAwesomeIcon icon={faCheck} />
                    Yours
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="subtle"
                    className="mt-auto"
                    disabled={!profile || busy === face.id}
                    onClick={() => void buy(face)}
                  >
                    {profile ? (face.price > 0 ? 'Take it' : 'Get it') : 'Sign in'}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {mine && <PublishFace open={adding} onClose={() => setAdding(false)} onDone={faces.reload} />}
    </div>
  )
}

/** Kobblon putting a face in the Catalog. */
function PublishFace({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    if (!file || !name.trim()) return
    setBusy(true)
    try {
      await publishFace({ file, name, price: Number(price) || 0 })
      setFile(null)
      setName('')
      setPrice('0')
      onDone()
      onClose()
      toast('Published.')
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Publish a face">
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-xs text-muted">
          <FontAwesomeIcon icon={faLock} className="text-[10px]" />
          Only Kobblon can publish these, and the database is what enforces it.
        </p>

        <label
          className={cn(
            'flex h-28 cursor-pointer items-center justify-center rounded-xl border border-dashed',
            'border-ink-line text-sm text-muted transition-colors hover:border-white/30 hover:text-white',
          )}
        >
          {file ? file.name : 'Choose a picture'}
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <Input label="Name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <Input
          label={`Price in ${currency.plural}`}
          labelNote="Nought is free"
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void send()} disabled={busy || !file || !name.trim()}>
            Publish
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
