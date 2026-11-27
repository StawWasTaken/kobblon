/*
 * The toy box over what we already have.
 *
 * The first drawing threw the shell away, which was not the ask. This one
 * mounts the real top bar, the real rail and the real Home components, on
 * the real dark theme, and adds the toy-box treatment as a layer: thicker
 * strokes, a lip in the section's colour instead of grey, a marker under
 * each shelf heading, a squish on press, one of our own faces stuck over
 * a corner. Press the switch to take the layer off and see that the page
 * underneath has not moved.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { setSupabaseClient } from '@/lib/supabase'
import { ToastProvider } from '@/components/ui/Toast'
import { AppTopbar } from '@/components/layout/AppTopbar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { TopNow } from '@/components/home/TopNow'
import { Shelf, WorldTile } from '@/components/worlds/Shelf'
import { Icon } from '@/components/brand/Icon'
import { FACE_COLOUR } from '@/components/social/Reactions'
import type { World } from '@/types/db'
import { me } from './pages-auth-stub'
import '@/index.css'
import './toybox-layer.css'

const chain = (rows: unknown[]) => {
  const result = { data: rows, error: null }
  const builder: Record<string, unknown> = {
    then: (done: (value: unknown) => unknown) => Promise.resolve(result).then(done),
  }
  for (const key of ['select', 'eq', 'order', 'limit', 'in', 'is', 'or', 'not']) builder[key] = () => builder
  builder.maybeSingle = async () => ({ data: rows[0] ?? null, error: null })
  builder.single = async () => ({ data: rows[0] ?? null, error: null })
  return builder
}

setSupabaseClient({
  rpc: async () => ({ data: null, error: null }),
  from: () => chain([]),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
  removeChannel: () => {},
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  auth: {
    getUser: async () => ({ data: { user: { id: me.id } }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
} as never)

const COVERS = ['/brand/landing-towers.webp', '/about/towers-sunset.webp', '/brand/landing-interior.png', '/brand/banner2.png', '/brand/banner3.png']

const make = (n: number): World => ({
  id: `w${n}`,
  content_id: 1000 + n,
  slug: `world-${n}`,
  name: ['Kobbleston Towers', 'Tower of Trials', 'Brixworks', 'The Long Drive Home', 'Sword Duels'][n % 5],
  description: null,
  creator_name: 'Staw',
  cover_url: COVERS[n % 5],
  emblem_url: ['/brand/world-emblem.png', '/brand/mark-tile.png', '/brand/favicon-creator.png', '/brand/brix.png', '/brand/logomark.png'][n % 5],
  runtime_version: 1,
  visit_count: [128_400, 41_200, 9_870, 3_140, 870][n % 5],
  like_count: [980, 410, 88, 31, 4][n % 5],
  dislike_count: [40, 25, 9, 11, 6][n % 5],
  published_at: '2026-11-01T00:00:00Z',
})

const five = [0, 1, 2, 3, 4].map(make)

/** One of our own faces, stuck over a corner. No plunk stickers. */
function Face({ face, className, turn }: { face: keyof typeof FACE_COLOUR; className: string; turn: number }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute z-20 ${className}`} style={{ transform: `rotate(${turn}deg)` }}>
      <Icon name={`reaction-${face}` as 'reaction-smile'} tone={FACE_COLOUR[face]} className="h-14 w-14 drop-shadow" />
    </span>
  )
}

function Page({ toy, light }: { toy: boolean; light: boolean }) {
  return (
    <div
      data-toy={toy ? '' : undefined}
      data-theme={light ? 'light' : 'dark'}
      className="min-h-screen bg-ink text-white"
      style={{ ['--accent' as string]: '#1B34E8' }}
    >
      <AppTopbar onOpenNav={() => {}} />
      <AppSidebar />
      <main className="pt-14 lg:pl-56">
        <div className="mx-auto max-w-[86rem] p-6">
          <div className="relative mb-6">
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
              {toy ? 'Welcome back, Staw!' : 'Welcome back, Staw'}
            </h1>
            {toy && <Face face="smile" className="-top-7 right-6 sm:right-24" turn={-12} />}
          </div>

          <div style={{ ['--accent' as string]: '#1B34E8' }}>
            <TopNow worlds={five} />
          </div>

          <div style={{ ['--accent' as string]: '#E33B2E' }}>
            <Shelf title={toy ? 'Worlds for you!' : 'Worlds for you'} more={{ to: '/discover' }}>
              {five.map((w, i) => (
                <div key={w.id} className={toy ? 'toy-tilt' : undefined} style={{ ['--toy-turn' as string]: `${i % 2 ? 1 : -1}deg` }}>
                  <WorldTile world={w} />
                </div>
              ))}
            </Shelf>
          </div>

          <div style={{ ['--accent' as string]: '#2ECC63' }}>
            <Shelf title={toy ? 'Your friends are in these!' : 'Your friends are in these'} more={{ to: '/friends' }}>
              {five.slice(0, 4).map((w, i) => (
                <div key={w.id} className={toy ? 'toy-tilt' : undefined} style={{ ['--toy-turn' as string]: `${i % 2 ? -1 : 1}deg` }}>
                  <WorldTile world={w} />
                </div>
              ))}
            </Shelf>
          </div>

          <div style={{ ['--accent' as string]: '#7B3FE4' }}>
            <Shelf title={toy ? 'Quiet ones!' : 'Quiet ones'} note="nobody in them yet">
              {five.slice(2).map((w) => <WorldTile key={w.id} world={w} />)}
            </Shelf>
          </div>
        </div>
      </main>
    </div>
  )
}

function Preview() {
  const [toy, setToy] = useState(true)
  const [light, setLight] = useState(false)
  /* The theme is read off the document, not off a wrapper, so a preview
     that sets it on a div recolours nothing. */
  useEffect(() => { document.documentElement.dataset.theme = light ? 'light' : 'dark' }, [light])
  return (
    <MemoryRouter>
      <ToastProvider>
        <div className="fixed bottom-4 right-4 z-[100] flex gap-2">
          <button className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-extrabold text-black" onClick={() => setToy(v => !v)}>
            {toy ? 'layer on' : 'layer off'}
          </button>
          <button className="rounded-full border-2 border-black bg-white px-4 py-2 text-sm font-extrabold text-black" onClick={() => setLight(v => !v)}>
            {light ? 'daylight' : 'dark'}
          </button>
        </div>
        <Page toy={toy} light={light} />
      </ToastProvider>
    </MemoryRouter>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)
