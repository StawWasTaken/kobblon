/*
 * The Inner Stock panel of the staff console, against stubbed answers.
 *
 * It imports the console's own section rather than drawing a copy of it:
 * the whole point is to see the month a superadmin is about to press
 * without a superadmin account and without a database. `?month=fell`
 * draws the other half of the design - the month the price dropped, which
 * pays nobody and takes Brix back off the investors.
 */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { InnerStockSection } from '@/pages/Admin'
import '@/index.css'

const fell = new URLSearchParams(location.search).get('month') === 'fell'

const price = fell ? 900 : 1200

const payroll = [
  { user_id: '1', username: 'kobblon', display_name: 'Kobblon', standing: 'house', share: 100, held: 412_000 },
  { user_id: '2', username: 'stawrer', display_name: 'Staw', standing: 'house', share: 100, held: 128_400 },
  { user_id: '3', username: 'noor', display_name: 'Noor', standing: 'investor', share: 100, held: 9_200 },
  { user_id: '4', username: 'imogen', display_name: 'Imogen', standing: 'investor', share: 100, held: 310 },
  { user_id: '5', username: 'sadie', display_name: 'Sadie', standing: 'superadmin', share: 90, held: 14_800 },
  { user_id: '6', username: 'adam', display_name: 'Adam', standing: 'admin', share: 70, held: 6_050 },
  { user_id: '7', username: 'morgan', display_name: 'Morgan', standing: 'moderator', share: 50, held: 2_400 },
].map((one) => ({
  ...one,
  brix: fell
    ? one.standing === 'investor'
      ? -Math.min(Math.round((300 * one.share) / 100), one.held)
      : 0
    : Math.round((price * one.share) / 100),
}))

const investors = [
  { user_id: '3', username: 'noor', display_name: 'Noor', is_staff: false,
    note: 'First deal, July', added_at: '2026-07-04T00:00:00Z', added_by_name: 'stawrer',
    left_at: null, left_reason: null, earned: 3480, months: 3 },
  { user_id: '4', username: 'imogen', display_name: 'Imogen', is_staff: true,
    note: 'A moderator who also put money in', added_at: '2026-08-19T00:00:00Z',
    added_by_name: 'stawrer', left_at: null, left_reason: null, earned: 2200, months: 2 },
  { user_id: '9', username: 'ivy', display_name: 'Ivy', is_staff: false,
    note: null, added_at: '2026-06-01T00:00:00Z', added_by_name: 'stawrer',
    left_at: '2026-10-20T00:00:00Z', left_reason: 'themself', earned: 1080, months: 2 },
]

const months = [
  { month: '2026-09-01', opened: 1000, closed: 1200, paid_accounts: 7, paid_brix: 7320, taken_brix: 0, run_at: '2026-10-01T09:12:00Z', run_by_name: 'stawrer' },
  { month: '2026-08-01', opened: 1050, closed: 1000, paid_accounts: 2, paid_brix: 0, taken_brix: 100, run_at: '2026-09-01T08:40:00Z', run_by_name: 'sadie' },
]

const marks = [
  { at: '2026-10-01T00:00:00Z', cents: 1200, note: 'October opens' },
  { at: '2026-10-29T00:00:00Z', cents: price, note: null },
]

const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const where = typeof input === 'string' ? input : (input as Request).url ?? String(input)
  const answer = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  }))
  if (where.includes('/rpc/stock_payroll')) return answer(payroll)
  if (where.includes('/rpc/stock_investors_list')) return answer(investors)
  if (where.includes('/rpc/stock_months_list')) return answer(months)
  if (where.includes('/rest/v1/inner_stock')) return answer([...marks].reverse())
  if (where.includes('/rest/v1/profiles')) return answer([])
  return realFetch(input as RequestInfo, init)
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <InnerStockSection />
        </div>
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
