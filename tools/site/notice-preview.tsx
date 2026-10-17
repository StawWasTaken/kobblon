/*
 * The notice across the top, in each of the five colours it can be.
 *
 * Mounted on its own, with no shell around it, for the usual reason: the
 * Workspace mounts shared pieces with its own session and no router, and a
 * component that only renders inside the website is a component the other
 * side finds out about when a panel goes blank.
 *
 * What there is to look at here is the colour and the stripes - whether a
 * notice reads as a flat panel somebody chose rather than a tint of the
 * page, and whether white takes dark words while the other four take
 * light ones.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseClient } from '@/lib/supabase'
import { NoticeBar, NoticeLine } from '@/components/layout/NoticeBar'
import '@/index.css'

const colours = ['blue', 'green', 'red', 'orange', 'white'] as const

const two = [
  { id: 'n1', body: 'Halloween is on. Everything in the Catalog is 30% off.',
    link: '/catalog', link_words: 'Open the Catalog', tone: 'orange', ends_at: null },
  { id: 'n2', body: 'Worlds are back up after this morning.',
    link: null, link_words: null, tone: 'green', ends_at: null },
]

setSupabaseClient({
  rpc: async () => ({ data: two, error: null }),
} as unknown as SupabaseClient)

/* One of each, drawn straight, so the five can be seen together. */
function OneOfEach() {
  return (
    <div className="space-y-3 p-6 pt-36">
      <p className="text-sm text-white/55">
        The pair at the top is the bar itself, fixed under where the real
        top bar would be. Below is one of each colour, drawn in place.
      </p>
      {colours.map((tone) => (
        <div key={tone} className="overflow-hidden rounded-xl">
          <NoticeLine
            notice={{
              id: `one-${tone}`,
              tone,
              body: `A notice in ${tone}, with the stripes over it.`,
              link: '/catalog',
              link_words: 'Have a look',
              ends_at: null,
            }}
          />
        </div>
      ))}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink text-white">
      {/* Where the real bar would be, so the fixed stack has something to
          sit under rather than floating at the very top. */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center bg-chrome px-5 font-display font-extrabold">
        kobblon
      </div>
      <NoticeBar />
      <OneOfEach />
    </div>
  </MemoryRouter>,
)
