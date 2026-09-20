import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faShieldHalved } from '@fortawesome/free-solid-svg-icons'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Choices } from '@/components/ui/Choices'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useWorkingAs, WorkingAsNote } from '@/components/create/WorkingAs'
import { uploadAsset } from '@/lib/api'
import { kindLabels, kindIcons } from './AssetTile'
import type { AssetKind, OwnAsset } from '@/types/db'

const MAX_BYTES = 25 * 1024 * 1024

const accepts: Record<AssetKind, string> = {
  image: 'image/png,image/jpeg,image/gif,image/webp,image/avif',
  audio: 'audio/mpeg,audio/ogg,application/ogg,audio/wav,audio/aac,audio/flac,.mp3,.ogg,.wav,.flac,.aac',
  video: 'video/mp4,video/webm,video/ogg,.mp4,.webm',
  font: 'font/woff2,font/woff,font/ttf,font/otf,.woff2,.woff,.ttf,.otf',
  // Kobblon's own part file is JSON with a .kbfl name, which no browser has
  // a type for, so the extension has to be offered explicitly.
  model: '.kbfl,application/json,model/gltf-binary,model/gltf+json,.glb,.gltf',
}

const kinds = Object.keys(kindLabels) as AssetKind[]

export function UploadDialog({
  open,
  onClose,
  onUploaded,
  only,
}: {
  open: boolean
  onClose: () => void
  /** What was made, so a caller can use it straight away. */
  onUploaded: (created?: OwnAsset) => void
  /** Limits the upload to one kind, for pickers that only take one. */
  only?: AssetKind
}) {
  const { profile } = useAuth()
  const { target } = useWorkingAs()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [kind, setKind] = useState<AssetKind>(only ?? 'image')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const reset = () => {
    setFile(null)
    setName('')
    setDescription('')
    setError(null)
  }

  const pick = (chosen: File | null) => {
    if (!chosen) return
    if (chosen.size > MAX_BYTES) {
      setError('That file is over 25 MB.')
      return
    }
    setError(null)
    setFile(chosen)
    if (!name) setName(chosen.name.replace(/\.[^.]+$/, '').slice(0, 60))
  }

  const submit = async () => {
    if (!profile || !file) return
    if (!name.trim()) {
      setError('Give it a name.')
      return
    }
    setPending(true)
    try {
      const created = await uploadAsset({
        userId: profile.id, file, kind, name, description, communityId: target?.id ?? null,
      })
      toast(
        created.status === 'approved'
          ? 'Uploaded and live.'
          : created.status === 'rejected'
            ? `Turned down: ${created.review_note ?? 'it did not pass review.'}`
            : 'Uploaded. A moderator will take a look before it goes live.',
        created.status === 'rejected' ? 'error' : 'success',
      )
      reset()
      onUploaded(created)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That upload did not go through.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Upload to Create"
      description="Decals, sounds, video, fonts and models. 25 MB per file."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={pending} disabled={!file} onClick={submit} icon={faUpload}>Upload</Button>
        </>
      }
    >
      <div className="mb-4">
        <WorkingAsNote />
      </div>

      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Type</legend>
        <Choices
          label="Type"
          value={kind}
          options={(only ? [only] : kinds).map((k) => ({
            value: k,
            label: kindLabels[k],
            icon: kindIcons[k],
          }))}
          onChange={(next) => { setKind(next); setFile(null) }}
        />
      </fieldset>

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-line bg-ink-raised px-4 py-8 text-center transition-colors hover:border-brand/60 hover:bg-ink-hover"
      >
        <FontAwesomeIcon icon={faUpload} className="text-xl text-white/40" />
        <span className="text-sm font-semibold">
          {file ? file.name : `Choose a ${kindLabels[kind].toLowerCase()} file`}
        </span>
        {file && (
          <span className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
        )}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={accepts[kind]}
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      <div className="mt-4 space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          error={error}
        />
        <Textarea
          label="Description"
          labelNote="optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={400}
        />
      </div>

      <p className="mt-4 flex items-start gap-2.5 rounded-lg border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-white/55">
        <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 shrink-0" />
        Uploads are checked automatically as soon as they arrive, so most go live straight
        away. Anything the check is unsure about waits for a person, and you will be told
        either way in My Uploads.
      </p>
    </Dialog>
  )
}
