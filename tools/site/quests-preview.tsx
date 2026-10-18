/* The quest card, in each state it can be in, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QuestCard } from '@/pages/Quests'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/hooks/useAuth'
import type { Quest } from '@/types/db'
import '@/index.css'

const base: Quest = {
  id: 'a', counted: 'world_time',
  title: 'Play First Ground for 15 minutes',
  lead: null, goal: 900, reward: 50,
  world_tag: 'First Ground', custom_tag: 'parkour', background_url: null,
  world_id: 'w', world_content_id: 1069, world_slug: 'first-ground',
  world_name: 'First Ground', world_emblem: null,
  author_name: null, ends_at: null,
  done: 0, started: null, claimed_at: null,
}

const states: [string, Quest][] = [
  ['Not started', base],
  ['Part way', { ...base, id: 'b', started: new Date().toISOString(), done: 420 }],
  ['Finished', { ...base, id: 'c', started: new Date().toISOString(), done: 900 }],
  ['Claimed', { ...base, id: 'd', started: new Date().toISOString(), done: 900, claimed_at: new Date().toISOString() }],
  ['One Staw wrote', {
    ...base, id: 'e', counted: 'friends_made', title: 'Make three friends',
    lead: 'Kobblon is better with somebody in it.', goal: 3, done: 1, reward: 75,
    world_id: null, world_content_id: null, world_slug: null, world_name: null,
    world_tag: 'Kobblon', custom_tag: null, author_name: 'Kobblon',
    started: new Date().toISOString(),
  }],
]

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <AuthProvider>
      <MemoryRouter>
        <div className="min-h-screen bg-ink p-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {states.map(([name, quest]) => (
              <div key={name} className="space-y-2">
                <p className="font-display text-xs uppercase tracking-wider text-muted">{name}</p>
                <QuestCard quest={quest} onChange={() => {}} />
              </div>
            ))}
          </div>
        </div>
      </MemoryRouter>
    </AuthProvider>
  </ToastProvider>,
)
