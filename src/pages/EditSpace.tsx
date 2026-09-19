import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card, SectionHeading } from '@/components/ui/Card'
import { Choices } from '@/components/ui/Choices'
import { Input, Textarea } from '@/components/ui/Input'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { ImageDrop } from '@/components/community/ImageDrop'
import { Collaborators } from '@/components/spaces/Collaborators'
import { categoryLabels } from '@/components/spaces/SpaceCard'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { getSpaceById, updateSpace, uploadSpaceImage } from '@/lib/api'
import type { SpaceCategory } from '@/types/db'
import { BackLink } from '@/components/ui/BackLink'
import { spaceLink } from '@/lib/links'

const genres = ['other', 'personal', 'community', 'game', 'art', 'music', 'story', 'tools', 'fan']
const categories = Object.keys(categoryLabels) as SpaceCategory[]

export default function EditSpace() {
  const { spaceId = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const space = useAsync(() => getSpaceById(spaceId), [spaceId])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SpaceCategory>('personal')
  const [genre, setGenre] = useState('other')
  const [published, setPublished] = useState(false)
  const [emblem, setEmblem] = useState<File | null>(null)
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [newShot, setNewShot] = useState<File | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const it = space.data
    if (!it) return
    setName(it.name)
    setDescription(it.description ?? '')
    setCategory(it.category)
    setGenre(it.genre)
    setPublished(it.is_published)
    setThumbnails(it.thumbnail_urls ?? [])
  }, [space.data])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!space.data || !profile) return
    setPending(true)
    try {
      const emblemUrl = emblem
        ? await uploadSpaceImage(profile.id, emblem, 'emblem')
        : space.data.emblem_url

      await updateSpace(space.data.id, {
        name: name.trim(),
        description: description.trim() || null,
        category,
        genre,
        is_published: published,
        emblem_url: emblemUrl,
        // The cover is the first picture of the Space, not a separate upload,
        // and the emblem is its badge rather than a picture of the place.
        cover_url: thumbnails[0] ?? null,
        thumbnail_urls: thumbnails,
      })
      toast('Saved.', 'success')
      space.reload()
      setEmblem(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setPending(false)
    }
  }

  const addShot = async () => {
    if (!newShot || !profile) return
    setPending(true)
    try {
      const url = await uploadSpaceImage(profile.id, newShot, 'cover')
      setThumbnails((all) => [...all, url])
      setNewShot(null)
    } finally {
      setPending(false)
    }
  }

  if (space.loading) return <Skeleton className="h-64 w-full" />
  if (space.error) return <ErrorState message={space.error} onRetry={space.reload} />
  if (!space.data || space.data.owner_id !== profile?.id) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted">This is not your Space to configure.</p>
      </Card>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <BackLink to={spaceLink(space.data)}>Back to {space.data.name}</BackLink>

      <div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Configure Space</h1>
        <p className="mt-1.5 text-muted">
          {space.data.name}{space.data.content_id ? ` · SPC-${space.data.content_id}` : ''}
        </p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <Card className="space-y-5 p-5 sm:p-6">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={48} required />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={400}
            hint={`${description.length}/400`}
          />

          <ImageDrop
            label="Emblem"
            file={emblem}
            existing={space.data.emblem_url}
            onChange={setEmblem}
            note="The badge for this World: the tab icon and the mark beside its name. It is never used as a picture of the World."
          />

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              Pictures of this Space
            </p>
            <p className="mb-3 text-xs text-muted">
              The first one is the cover: it is what people see in Discover and at the top of
              the page. Drag is not needed, the order is the order you add them.
            </p>
            {!!thumbnails.length && (
              <div className="mb-3 flex flex-wrap gap-2">
                {thumbnails.map((url) => (
                  <div key={url} className="relative">
                    <img src={url} alt="" className="h-16 w-28 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setThumbnails((all) => all.filter((x) => x !== url))}
                      aria-label="Remove this thumbnail"
                      className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink-card text-xs text-white/60 ring-1 ring-ink-line hover:text-white"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-3">
              <ImageDrop label="Add one" aspect="wide" file={newShot} onChange={setNewShot} />
            </div>
            {newShot && (
              <Button type="button" size="sm" icon={faPlus} className="mt-2" loading={pending} onClick={addShot}>
                Add thumbnail
              </Button>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Category</legend>
            <Choices
              label="Category"
              value={category}
              options={categories.map((c) => ({ value: c, label: categoryLabels[c] }))}
              onChange={setCategory}
            />
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Genre</legend>
            <Choices
              label="Genre"
              value={genre}
              options={genres.map((g) => ({ value: g, label: g }))}
              onChange={setGenre}
              className="capitalize"
            />
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-ink-raised p-4">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1B34E8]"
            />
            <span>
              <span className="block text-sm font-semibold">Published</span>
              <span className="mt-0.5 block text-xs text-muted">
                Unpublish and it disappears from Discover and nobody can enter.
              </span>
            </span>
          </label>
        </Card>

        <p className="text-xs text-muted">
          Chat, and everything else about how the Space itself looks, is set up in the builder.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" icon={faTrash} onClick={() => navigate(-1)}>Back</Button>
          <Button type="submit" size="lg" loading={pending}>Save changes</Button>
        </div>
      </form>

      <section className="mt-8">
        <SectionHeading title="Team" />
        <Collaborators
          spaceId={space.data.id}
          ownerId={space.data.owner_id}
          viewerId={profile?.id}
        />
      </section>
    </div>
  )
}
