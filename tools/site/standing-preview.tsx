/*
 * The three cards, in the chrome the gate puts them in.
 *
 * `StandingGate` itself needs a session, a router and the standing call, so
 * what is checked here is the thing that can be wrong without any of them:
 * the card at the width the overlay gives it, the log out row under it, and
 * that a warning, a suspension still running and a closure read as three
 * different decisions rather than three shades of the same panel.
 */
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { AccountStatusCard } from '@/components/social/AccountStatusCard'
import type { AccountLock } from '@/types/db'

const base: AccountLock = {
  level: 'warned',
  headline: 'You have been given a warning.',
  why: 'Telling another player to kill themselves in the chat of Nimbus Rooftops.',
  rule: 'Harassment',
  decided_at: new Date(Date.now() - 36e5).toISOString(),
  until: null,
  violation_id: '41',
  appeal_status: null,
  can_appeal: true,
  can_return: false,
  can_acknowledge: true,
  acknowledged: false,
  is_banned: false,
}

const states: AccountLock[] = [
  base,
  {
    ...base,
    level: 'limited',
    headline: 'Some things are switched off on this account.',
    until: new Date(Date.now() + 2 * 864e5).toISOString(),
    can_acknowledge: false,
  },
  {
    ...base,
    level: 'suspended',
    headline: 'This account is suspended.',
    until: new Date(Date.now() + 3 * 864e5).toISOString(),
    can_acknowledge: false,
  },
  {
    ...base,
    level: 'banned',
    headline: 'This account has been closed.',
    can_acknowledge: false,
    is_banned: true,
  },
]

function Over({ standing }: { standing: AccountLock }) {
  return (
    <div className="flex items-center justify-center bg-black/80 p-4 py-10">
      <AccountStatusCard
        className="flex w-full max-w-[27rem] flex-col sm:min-h-[26rem]"
        standing={standing}
        onAcknowledge={standing.can_acknowledge ? () => {} : undefined}
        onClose={standing.level === 'limited' ? () => {} : undefined}
        onSignOut={standing.level === 'banned' ? () => {} : undefined}
        onOpen={() => {}}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-dvh bg-ink text-white">
    {states.map((one) => <Over key={one.level} standing={one} />)}
  </div>,
)
