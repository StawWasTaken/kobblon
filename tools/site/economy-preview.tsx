/* The staff console's Economy panel, mounted on its own with made-up figures.
 *
 * The client is swapped for one that answers the four economy reads with
 * fixtures, because an empty panel proves it does not throw and nothing
 * about how it looks with numbers in it. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { setSupabaseClient } from '@/lib/supabase'
import { ToastProvider } from '@/components/ui/Toast'
import { EconomySection } from '@/pages/Admin'
import '@/index.css'

const days = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10)
  const minted = Math.round(42_000 + Math.sin(i / 3) * 14_000 + (i % 5) * 3_000)
  const burned = Math.round(31_000 + Math.sin((i + 2) / 3) * 11_000)
  return { day, minted, burned, net: minted - burned, held: 2_400_000 + i * 11_000 }
})

const answers: Record<string, unknown> = {
  economy_now: [{
    in_circulation: 2_719_000, holders: 1_284, richest: 94_200, average: 2_117,
    minted: 1_284_000, burned: 903_400, movements: 41_209, limiteds: 6, resold: 211_900,
  }],
  economy_flow: days,
  economy_by_kind: [
    { kind: 'daily', came: 410_000, went: 0, movements: 8_120 },
    { kind: 'purchase', came: 0, went: 520_000, movements: 4_310 },
    { kind: 'signup_grant', came: 230_000, went: 0, movements: 460 },
    { kind: 'sale', came: 120_400, went: 0, movements: 1_902 },
    { kind: 'quest', came: 86_000, went: 0, movements: 1_120 },
    { kind: 'ad_budget', came: 0, went: 90_000, movements: 54 },
    { kind: 'username_change', came: 0, went: 42_000, movements: 420 },
  ],
  limited_market: [
    {
      item_id: '1', content_id: 41, name: 'Midnight Crown', price: 1_200,
      sells_until: new Date(Date.now() + 86_400_000 * 3).toISOString(), closed: false,
      sold_total: 84, sold_window: 31, average_window: 2_410, average_before: 1_960,
      cheapest: 2_200, offers: 7,
    },
    {
      item_id: '2', content_id: 42, name: 'Pumpkin Head', price: 450,
      sells_until: new Date(Date.now() - 86_400_000 * 9).toISOString(), closed: true,
      sold_total: 310, sold_window: 44, average_window: 690, average_before: 880,
      cheapest: 640, offers: 22,
    },
    {
      item_id: '3', content_id: 43, name: 'First Ground Jacket', price: 300,
      sells_until: new Date(Date.now() - 86_400_000 * 60).toISOString(), closed: true,
      sold_total: 12, sold_window: 0, average_window: 0, average_before: 410,
      cheapest: null, offers: 0,
    },
  ],
  sale_now: null,
}

setSupabaseClient({
  rpc: async (name: string) => ({ data: answers[name] ?? null, error: null }),
  from: () => ({
    select: () => ({ or: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
} as never)

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <ToastProvider>
      <div className="min-h-screen bg-ink p-8 text-white">
        <EconomySection />
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
