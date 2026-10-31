/*
 * The two halves of a profile's numbers, after Staw split them across the
 * tabs: "the catalog sales statistics goes into the shop tab".
 *
 * Here so the split can be looked at. `Places` reads `person_places`, and a
 * bare page has no session, so the one call it makes is answered below -
 * the row is then drawn from a real answer rather than from a fixture
 * standing in for the component.
 *
 * The creator-page row above Creations is drawn here too, because the
 * thing worth checking is not the button but where it sits once it is no
 * longer on the shop's heading row.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { faShapes } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Places } from '@/components/social/Places'
import '@/index.css'

const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const where = typeof input === 'string' ? input : (input as Request).url ?? String(input)
  if (where.includes('/rest/v1/rpc/person_places')) {
    return Promise.resolve(new Response(JSON.stringify([
      { board: 'visits', amount: 128_400, place: 12 },
      { board: 'sales', amount: 3_182, place: 4 },
      { board: 'assets', amount: 96, place: null },
    ]), { headers: { 'content-type': 'application/json' } }))
  }
  return realFetch(input as RequestInfo, init)
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen space-y-12 bg-ink p-10 text-white">
      <section className="mx-auto max-w-5xl space-y-10">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted">Creations</h2>
        <div className="flex items-center justify-end">
          <Button size="sm" variant="subtle" icon={faShapes} to="/create/creator/staw">
            Their creator page
          </Button>
        </div>
        <Places who="x" boards={['visits', 'assets']} />
      </section>

      <section className="mx-auto max-w-5xl space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted">Shop</h2>
        <Places who="x" boards={['sales']} />
      </section>
    </div>
  </MemoryRouter>,
)
