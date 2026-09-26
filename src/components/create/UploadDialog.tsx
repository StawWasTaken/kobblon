import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faShieldHalved } from '@fortawesome/free-solid-svg-icons'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Choices } from '@/components/ui/Choices'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useMaybeAuth } from '@/hooks/useAuth'
import { useWorkingAs, WorkingAsNote } from '@/components/create/WorkingAs'
import { uploadAsset, decalBehind } from '@/lib/api'
import { kindLabels, kindIcons, kindAccepts, uploadableKinds } from '@/lib/kinds'
import type { AssetKind, OwnAsset } from '@/types/db'

const MAX_BYTES = 25 * 1024 * 1024

/*
 * The words, the icons, the codes and the accepted extensions all come from
 * one module, so the Workspace and the Create pages cannot drift into
 * calling the same thing two names or accepting two different sets of files.
 */
const accepts = kindAccepts
const kinds = uploadableKinds

export function UploadDialog({
  open,
  onClose,
  onUploaded,
  only,
  uploadAs,
}: {
  open: boolean
  onClose: () => void
  /** What was made, so a caller can use it straight away. */
  onUploaded: (created?: OwnAsset) => void
  /** Limits the upload to one kind, for pickers that only take one. */
  only?: AssetKind
  /**
   * Who is uploading, when this is mounted outside the website.
   *
   * The Workspace shows this dialog with its own session and none of the
   * site's providers above it. Given this, nothing here reads a context:
   * `useToast` and `useWorkingAs` already fall back to doing nothing and to
   * uploading for yourself, and `useMaybeAuth` returns null rather than
   * throwing. Left out, it behaves exactly as it always has.
   */
  uploadAs?: { profileId: string; communityId?: string | null }
}) {
  const auth = useMaybeAuth()
  const profile = uploadAs ? { id: uploadAs.profileId } : auth?.profile
  const { target } = useWorkingAs()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [kind, setKind] = useState<AssetKind>(only ?? 'image')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  /*
   * Uploading is not publishing. What somebody makes is theirs until they
   * say otherwise — a texture for their own World has no business appearing
   * in a shop because nobody found a switch. This is that switch, at the
   * moment it is easiest to mean it.
   */
  const [list, setList] = useState(false)
  /*
   * What a mesh arrives wearing: a picture uploaded with it, or the id of a
   * Decal that already exists. Held apart from the mesh's own file so that
   * switching kind does not quietly carry a texture onto an audio upload.
   */
  const [texture, setTexture] = useState<File | null>(null)
  const [decalId, setDecalId] = useState('')
  const [decal, setDecal] = useState<{ id: string; name: string } | null>(null)
  const textureInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setName('')
    setDescription('')
    setError(null)
    setList(false)
    setTexture(null)
    setDecalId('')
    setDecal(null)
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

  /*
   * A pasted id is looked up as it is typed, so somebody sees the name of
   * the Decal they are about to use rather than finding out after the
   * upload. Not finding one is said quietly: the difference between "no
   * such Decal" and "not one you may use" is whether somebody's private
   * upload exists, and an id box is not the place to answer that.
   */
  const lookUp = async (tag: string) => {
    setDecalId(tag)
    setDecal(null)
    if (!tag.trim()) return
    setDecal(await decalBehind(tag).catch(() => null))
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
        userId: profile.id,
        file,
        kind,
        name,
        description,
        // Whoever was named, or whoever the site says you are working as.
        communityId: uploadAs ? uploadAs.communityId ?? null : target?.id ?? null,
        listed: list,
        texture: kind === 'mesh'
          ? (texture ? { file: texture } : decal ? { id: decal.id } : undefined)
          : undefined,
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
      description="Decals, sounds, video, fonts and meshes. 25 MB per file."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="yes" loading={pending} disabled={!file} onClick={submit} icon={faUpload}>Upload</Button>
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

      {kind === 'mesh' && (
        <div className="mt-4 rounded-lg border border-ink-line bg-ink-raised p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Texture <span className="normal-case tracking-normal text-white/35">optional</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            What the mesh wears. Upload one and it becomes a Decal of yours, or use a
            Decal that already exists — one of yours, or anybody else&rsquo;s that is on
            the Marketplace.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="subtle"
              onClick={() => textureInput.current?.click()}
            >
              {texture ? 'Change picture' : 'Upload a picture'}
            </Button>
            {texture && (
              <span className="text-xs text-white/65">
                {texture.name}
                <button
                  type="button"
                  className="ml-2 text-white/45 underline"
                  onClick={() => setTexture(null)}
                >
                  remove
                </button>
              </span>
            )}
          </div>

          <input
            ref={textureInput}
            type="file"
            accept={kindAccepts.image}
            className="sr-only"
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null
              if (chosen) { setTexture(chosen); setDecalId(''); setDecal(null) }
            }}
          />

          {!texture && (
            <div className="mt-3">
              <Input
                label="Or a Decal id"
                labelNote="IMG-1042"
                value={decalId}
                onChange={(e) => void lookUp(e.target.value)}
                maxLength={20}
              />
              {decalId.trim() !== '' && (
                <p className="mt-1.5 text-xs text-white/55">
                  {decal
                    ? <>Wearing <span className="text-white/85">{decal.name}</span>.</>
                    : 'No Decal you can use with that id.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-ink-line bg-ink-raised p-3">
        <input
          type="checkbox"
          checked={list}
          onChange={(e) => setList(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-space-bright"
        />
        <span className="text-xs leading-relaxed text-white/70">
          <span className="font-semibold text-white/90">
            Also put it on the Creator Marketplace
          </span>
          <br />
          Off means it is yours: you can use it in your own Worlds, and list it later
          from My Uploads whenever you decide it is worth sharing.
        </span>
      </label>

      <p className="mt-3 flex items-start gap-2.5 rounded-lg border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-white/55">
        <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 shrink-0" />
        Uploads are checked automatically as soon as they arrive, so most go live straight
        away. Anything the check is unsure about waits for a person, and you will be told
        either way in My Uploads.
      </p>
    </Dialog>
  )
}
