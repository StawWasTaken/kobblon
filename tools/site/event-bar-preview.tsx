/* The live event bar, under a site notice, with nothing else around them. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { LiveEventBar } from '@/components/community/LiveEventBar'
import { NoticeLine } from '@/components/layout/NoticeBar'
import '@/index.css'

const event = {
  id: 'preview',
  content_id: 1309,
  title: 'Kobblon Halloween Month',
  subtitle: 'very spooky!',
  attending_count: 14,
  starts_at: new Date().toISOString(),
  ends_at: null,
} as never

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen bg-ink">
      <NoticeLine
        notice={{
          id: 1,
          tone: 'orange',
          body: 'Halloween is on, and so is the whole catalog!',
          link: '/catalog',
          link_words: 'Have a look',
        } as never}
      />
      <LiveEventBar communityId="preview" showing={event} />
      <div className="h-40 bg-brand/20" />
    </div>
  </MemoryRouter>,
)
