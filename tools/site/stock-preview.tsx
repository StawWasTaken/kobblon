/* The Inner Stock page, with the table answered here. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import InnerStock from '@/pages/InnerStock'
import { AuthContext } from '@/hooks/useAuth'
import { TitleTips } from '@/components/ui/TitleTips'
import { ToastProvider } from '@/components/ui/Toast'
import '@/index.css'

/*
 * Two shapes are worth looking at and only one of them can be on screen
 * at a time, so `?marks=one` draws the day this ships - a single mark at
 * 10,00 € and no line - and the default draws a year of them, which is
 * what the page becomes. Neither is invented data in the shipped sense:
 * this file is under `tools/` and nothing the site serves can reach it.
 */
const asked = new URLSearchParams(location.search)
const only = asked.get('marks') === 'one'

/*
 * `?me=investor` and `?me=moderator` draw the share panel in the rail, which
 * is the half of this page only a signed-in staff member or an investor ever
 * sees. Nothing else here needs a session, so without the flag the page is
 * drawn exactly as a visitor gets it.
 */
const me = asked.get('me')
const standings: Record<string, { standing: string; share: number; can_leave: boolean }> = {
  investor: { standing: 'investor', share: 100, can_leave: true },
  moderator: { standing: 'moderator', share: 50, can_leave: false },
  house: { standing: 'house', share: 100, can_leave: false },
}
const mine = me ? standings[me] ?? standings.investor : null

const history = () => {
  const rows: { at: string; cents: number; note: string | null }[] = []
  let cents = 1000
  for (let day = 120; day >= 0; day -= 3) {
    cents = Math.max(600, Math.round(cents + (Math.sin(day / 7) * 22) + (day % 5) * 4 - 6))
    rows.push({
      at: new Date(Date.now() - day * 86_400_000).toISOString(),
      cents,
      note: day === 120 ? 'The first mark' : null,
    })
  }
  return rows
}

const rows = only
  ? [{ at: '2026-10-31T00:00:00Z', cents: 1000, note: 'The first mark' }]
  : history()

const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const where = typeof input === 'string' ? input : (input as Request).url ?? String(input)
  if (where.includes('/rpc/my_inner_stock')) {
    return Promise.resolve(new Response(JSON.stringify(mine ? [{
      ...mine, months: 3, earned: 3480, repaid: 120,
      last_month: '2026-09-01', last_brix: 1200, since: '2026-07-04T00:00:00Z',
    }] : []), { headers: { 'content-type': 'application/json' } }))
  }
  if (where.includes('/rpc/stock_months_list')) {
    return Promise.resolve(new Response(JSON.stringify([
      { month: '2026-10-01', opened: 1200, closed: 1000, paid_accounts: 2, paid_brix: 0, taken_brix: 320, run_at: '2026-10-31T09:00:00Z', run_by_name: 'stawrer' },
      { month: '2026-09-01', opened: 1000, closed: 1200, paid_accounts: 7, paid_brix: 7320, taken_brix: 0, run_at: '2026-10-01T09:00:00Z', run_by_name: 'stawrer' },
    ]), { headers: { 'content-type': 'application/json' } }))
  }
  if (where.includes('/rest/v1/inner_stock')) {
    // Newest first, which is what the page asks for and then turns round.
    return Promise.resolve(new Response(JSON.stringify([...rows].reverse()), {
      headers: { 'content-type': 'application/json' },
    }))
  }
  return realFetch(input as RequestInfo, init)
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <TitleTips />
    <ToastProvider>
      <AuthContext.Provider value={{
        session: mine ? ({ user: { id: 'me' } } as never) : null,
      } as never}>
        <InnerStock />
      </AuthContext.Provider>
    </ToastProvider>
  </MemoryRouter>,
)
