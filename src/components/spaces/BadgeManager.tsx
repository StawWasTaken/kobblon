import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { faPlus, faTrash, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ImageDrop } from '@/components/community/ImageDrop'
import { createSpaceBadge, deleteSpaceBadge, updateSpaceBadge, uploadCommunityImage } from '@/lib/api'
import { formatCount } from '@/lib/format'
import type { SpaceBadge } from '@/types/db'

/** What the owner of a Space sees: the badges they hand out, and their state. */
export function BadgeManager({
  spaceId, badges, onChanged,
}: {
  spaceId: string
  badges: SpaceBadge[]
  onChanged: () => void
}) {
  const toast = useToast()
  const { profile } = useAuth()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim()) {
      setError('Give the badge a name.')
      return
    }
    if (!icon) {
      setError('A badge needs a picture. That is what people see on a profile.')
      return
    }
    setPending(true)
    try {
      const iconUrl = profile ? await uploadCommunityImage(profile.id, icon, 'emblem') : null
      await createSpaceBadge({ spaceId, name, description, iconUrl })
      setName('')
      setDescription('')
      setIcon(null)
      setAdding(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save.')
    } finally {
      setPending(false)
    }
  }

  const toggle = async (badge: SpaceBadge) => {
    try {
      await updateSpaceBadge(badge.id, { is_enabled: !badge.is_enabled })
      onChanged()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    }
  }

  const remove = async (badge: SpaceBadge) => {
    try {
      await deleteSpaceBadge(badge.id)
      onChanged()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not delete.', 'error')
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-line px-4 py-3">
          <h3 className="text-sm font-extrabold">Badges you hand out</h3>
          <Button size="sm" icon={faPlus} onClick={() => setAdding(true)}>New badge</Button>
        </div>

        {!badges.length && (
          <p className="px-4 py-6 text-center text-sm text-muted">
            No badges yet. Make one and people can earn it in your Space.
          </p>
        )}

        <ul>
          {badges.map((badge) => (
            <li
              key={badge.id}
              className="flex items-center gap-3 border-b border-ink-line/70 px-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{badge.name}</p>
                <p className="text-xs text-muted">
                  {formatCount(badge.awarded_count)} earned
                  {!badge.is_enabled && ' · turned off'}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={badge.is_enabled ? faEye : faEyeSlash}
                aria-label={badge.is_enabled ? `Turn off ${badge.name}` : `Turn on ${badge.name}`}
                onClick={() => toggle(badge)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={faTrash}
                aria-label={`Delete ${badge.name}`}
                onClick={() => remove(badge)}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="New badge"
        description="Badges are yours to design. People earn them for doing things in your World."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button loading={pending} onClick={create}>Create badge</Button>
          </>
        }
      >
        <div className="space-y-4">
          <ImageDrop
            label="Picture"
            required
            file={icon}
            onChange={setIcon}
            note="Shown as a circle on profiles, so something simple reads best."
          />
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            error={error}
            placeholder="Found the secret room"
          />
          <Textarea
            label="Description"
            labelNote="optional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
        </div>
      </Dialog>
    </>
  )
}
