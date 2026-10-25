/* The five drawings, at the sizes pages actually ask for. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { EmptyState } from '@/components/ui/States'
import { kobbyArt, type KobbyMood } from '@/components/brand/Kobby'
import { Card } from '@/components/ui/Card'
import '@/index.css'

const what: Record<KobbyMood, string> = {
  emptyBox: 'Nothing here yet',
  noResults: 'Looked and found nothing',
  construction: 'Not built yet',
  notification: 'Nothing has come in',
  style: 'The Catalog',
  building: 'Beside what is being advertised',
  default: 'Ask Kobby (a label, 28px)',
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen space-y-6 bg-ink p-8 text-white">
      <div className="flex flex-wrap items-end gap-8">
        {(Object.keys(kobbyArt) as KobbyMood[]).map((mood) => (
          <div key={mood} className="text-center">
            <img src={kobbyArt[mood]} alt="" className="h-32 w-auto object-contain" />
            <p className="mt-2 text-xs font-bold">{mood}</p>
            <p className="text-[11px] text-muted">{what[mood]}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['emptyBox', 'noResults', 'construction', 'style'] as KobbyMood[]).map((mood) => (
          <Card key={mood}>
            <EmptyState mood={mood} title={what[mood]} body="The body sits under it, two lines at most." />
          </Card>
        ))}
      </div>
    </div>
  </MemoryRouter>,
)
