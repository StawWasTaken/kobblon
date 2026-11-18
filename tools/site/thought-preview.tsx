/* The line over somebody's head: the bubble over a profile picture, the line in a list. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ThoughtOver, ThoughtDialog, ThoughtLine } from '@/components/profile/Thought'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { StatusDot } from '@/components/ui/StatusDot'
import type { Profile } from '@/types/db'
import '@/index.css'

const person = {
  id: 'a', username: 'stawrer', display_name: 'Staw', avatar_url: null,
  content_id: 1, is_guest: false,
} as unknown as Profile

const Face = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="flex flex-col items-center">
    {children}
    <p className="mt-3 text-tiny uppercase tracking-wide text-muted">{label}</p>
  </div>
)

function Stage() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh bg-ink p-10">
      {/* The profile header, as it really is: a card with a cover behind it. */}
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border-2 border-ink-line bg-ink-card">
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand/30 to-transparent" />
          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:p-7">
            <ThoughtOver thought="i love him so much" face="heart-eyes" className="shrink-0 self-center sm:self-start">
              <PersonAvatar person={person} size="3xl" className="h-24 w-24 sm:h-28 sm:w-28" square />
            </ThoughtOver>
            <div className="min-w-0 flex-1 sm:pt-7">
              <h1 className="font-display text-3xl font-extrabold">Staw</h1>
              <p className="mt-1.5 text-sm text-muted">@stawrer</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-end gap-14">
        <Face label="Yours, empty">
          <ThoughtOver thought={null} mine onEdit={() => setOpen(true)}>
            <PersonAvatar person={person} size="3xl" className="h-24 w-24" square />
          </ThoughtOver>
        </Face>

        <Face label="Yours, written">
          <ThoughtOver thought="back on tuesday, taking a week off the catalog" face="fire" mine onEdit={() => setOpen(true)}>
            <PersonAvatar person={person} size="3xl" className="h-24 w-24" square />
          </ThoughtOver>
        </Face>

        <Face label="Round picture">
          <ThoughtOver thought="grinding for the pass" face="sunglasses">
            <PersonAvatar person={person} size="3xl" className="h-24 w-24" />
          </ThoughtOver>
        </Face>

        <Face label="Mid picture, in a list">
          <ThoughtOver thought="to pee, is to be. to shit, is to exist." face="skull" small>
            <PersonAvatar person={person} size="lg" className="h-14 w-14" square />
          </ThoughtOver>
        </Face>

        <div className="w-60 rounded-2xl border-2 border-ink-line bg-ink-card p-4">
          <p className="font-display text-base font-extrabold">Staw</p>
          <p className="text-xs text-muted">@stawrer</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
            <StatusDot presence="online" size="md" />
            <ThoughtLine thought="making a racing world today" face="fire" className="min-w-0" />
          </p>
        </div>
      </div>

      <ThoughtDialog open={open} onClose={() => setOpen(false)} thought="back on tuesday" face="fire" onSave={async () => {}} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><Stage /></MemoryRouter>,
)
