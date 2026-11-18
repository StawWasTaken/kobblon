/* The line over somebody's head: the bubble on a profile, the line in a list. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ThoughtBubble, ThoughtDialog, ThoughtLine } from '@/components/profile/Thought'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import type { Profile } from '@/types/db'
import '@/index.css'

const person = {
  id: 'a', username: 'stawrer', display_name: 'Staw', avatar_url: null,
  content_id: 1, is_guest: false,
} as unknown as Profile

function Stage() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh bg-ink p-10">
      <div className="mx-auto flex max-w-3xl flex-wrap items-start gap-12">
        <div className="flex flex-col items-center">
          <ThoughtBubble thought="making a racing world today" className="mb-1" />
          <PersonAvatar person={person} size="3xl" className="h-28 w-28" square />
          <p className="mt-2 text-tiny uppercase tracking-wide text-muted">Somebody else</p>
        </div>

        <div className="flex flex-col items-center">
          <ThoughtBubble thought={null} mine onEdit={() => setOpen(true)} className="mb-1" />
          <PersonAvatar person={person} size="3xl" className="h-28 w-28" square />
          <p className="mt-2 text-tiny uppercase tracking-wide text-muted">Yours, empty</p>
        </div>

        <div className="flex flex-col items-center">
          <ThoughtBubble thought="back on tuesday, taking a week off the catalog" mine onEdit={() => setOpen(true)} className="mb-1" />
          <PersonAvatar person={person} size="3xl" className="h-28 w-28" square />
          <p className="mt-2 text-tiny uppercase tracking-wide text-muted">Yours, written</p>
        </div>

        <div className="w-60 rounded-2xl border-2 border-ink-line bg-ink-card p-4">
          <p className="font-display text-base font-extrabold">Staw</p>
          <p className="text-xs text-muted">@stawrer</p>
          <ThoughtLine thought="making a racing world today" className="mt-2" />
        </div>
      </div>

      <ThoughtDialog open={open} onClose={() => setOpen(false)} thought="back on tuesday" onSave={async () => {}} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Stage /></MemoryRouter>,
)
