/* The Inner Stock page, with the table answered here. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import InnerStock from '@/pages/InnerStock'
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
const only = new URLSearchParams(location.search).get('marks') === 'one'

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
      <InnerStock />
    </ToastProvider>
  </MemoryRouter>,
)
