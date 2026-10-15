import { useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import {
  faPlus, faPen, faTrash, faBan, faCalendarDay, faUserGroup, faRotateLeft,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { DateTimeField, toLocalValue } from '@/components/ui/DateTimeField'
import { Skeleton } from '@/components/ui/States'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { ImageDrop } from '@/components/community/ImageDrop'
import { eventWhen } from '@/components/community/EventCard'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import {
  cancelEvent, deleteEvent, listCommunityEvents, saveEvent, uploadCommunityImage,
} from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { CommunityEvent } from '@/types/db'

/** A local datetime the input understands, from an ISO string. */
const forInput = (iso?: string | null) => (iso ? toLocalValue(new Date(iso)) : '')

export function EventsEditor({ communityId }: { communityId: string }) {
  const { profile } = useAuth()
  const toast = useToast()
  const events = useAsync(() => listCommunityEvents(communityId), [communityId])

  const [editing, setEditing] = useState<CommunityEvent | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [pending, setPending] = useState(false)

  const begin = (event: CommunityEvent | null) => {
    setEditing(event)
    setTitle(event?.title ?? '')
    setSubtitle(event?.subtitle ?? '')
    setDescription(event?.description ?? '')
    setStarts(forInput(event?.starts_at) || forInput(new Date(Date.now() + 86_400_000).toISOString()))
    setEnds(forInput(event?.ends_at))
    setCover(null)
    setOpen(true)
  }

  const save = async () => {
    if (title.trim().length < 3) { toast('Give it a name.', 'error'); return }
    if (!starts) { toast('Say when it starts.', 'error'); return }

    setPending(true)
    try {
      const coverUrl = cover && profile
        ? await uploadCommunityImage(profile.id, cover, 'cover')
        : editing?.cover_url ?? null

      await saveEvent({
        id: editing?.id,
        community_id: communityId,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        cover_url: coverUrl,
        starts_at: new Date(starts).toISOString(),
        ends_at: ends ? new Date(ends).toISOString() : null,
      })
      toast(editing ? 'Saved.' : 'It is in the calendar.', 'success')
      setOpen(false)
      events.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setPending(false)
    }
  }

  const guard = async (run: () => Promise<void>) => {
    try {
      await run()
      events.reload()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Events show on the Community page and carry their own number, so an event can be linked
          to like anything else here.
        </p>
        <Button icon={faPlus} onClick={() => begin(null)}>New event</Button>
      </div>

      {events.loading && <Skeleton className="h-24" />}

      {!events.loading && !events.data?.length && (
        <Card className="p-8 text-center">
          <Glyph icon={faCalendarDay} className="text-3xl text-white/20" />
          <p className="mt-3 text-sm font-bold">Nothing in the calendar</p>
          <p className="mt-1 text-sm text-muted">
            A meet-up, a build night, the day something launches.
          </p>
        </Card>
      )}

      {!!events.data?.length && (
        <Card className="overflow-hidden">
          <ul>
            {events.data.map((event) => {
              const over = new Date(event.ends_at ?? event.starts_at) < new Date()
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3 border-b border-ink-line/70 p-3 last:border-0"
                >
                  <span className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-media">
                    {event.cover_url ? (
                      <img src={event.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-white/25">
                        <Glyph icon={faCalendarDay} />
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-bold', event.is_cancelled && 'line-through opacity-60')}>
                      {event.title}
                    </p>
                    <p className="text-xs text-muted">
                      {eventWhen(event.starts_at)}
                      {over && ' · finished'}
                      {event.is_cancelled && ' · cancelled'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <Glyph icon={faUserGroup} />
                      {formatCount(event.attending_count)} going
                      <span className="font-mono">EVT-{event.content_id}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Tooltip label="Edit" side="top">
                      <Button size="sm" variant="ghost" icon={faPen} aria-label={`Edit ${event.title}`}
                        onClick={() => begin(event)} />
                    </Tooltip>
                    <Tooltip label={event.is_cancelled ? 'Put it back on' : 'Call it off'} side="top">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={event.is_cancelled ? faRotateLeft : faBan}
                        aria-label={event.is_cancelled ? `Restore ${event.title}` : `Cancel ${event.title}`}
                        onClick={() => guard(() => cancelEvent(event.id, !event.is_cancelled))}
                      />
                    </Tooltip>
                    <Tooltip label="Delete" side="top">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={faTrash}
                        aria-label={`Delete ${event.title}`}
                        onClick={() => guard(() => deleteEvent(event.id))}
                      />
                    </Tooltip>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit this event' : 'New event'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} onClick={save}>{editing ? 'Save' : 'Put it on'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <ImageDrop
            label="Cover"
            aspect="wide"
            file={cover}
            existing={editing?.cover_url ?? undefined}
            onChange={setCover}
            note="Wide, the picture people see on the card."
          />

          <Input
            label="Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Build night"
          />

          <Input
            label="One line under it"
            labelNote="optional"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={120}
            placeholder="Bring something you are working on"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <DateTimeField label="Starts" value={starts} onChange={setStarts} />
            <DateTimeField
              label="Ends"
              labelNote="optional"
              value={ends}
              onChange={setEnds}
              min={starts ? new Date(starts) : undefined}
              clearable
            />
          </div>

          <Textarea
            label="Description"
            labelNote="optional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            className="min-h-[8rem]"
          />
        </div>
      </Dialog>
    </div>
  )
}
