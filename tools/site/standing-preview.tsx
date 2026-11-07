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
import { Glyph } from '@/components/brand/Glyph'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
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
    <div className="flex items-start justify-center bg-black/80 p-4 py-10">
      <div className="w-full max-w-xl space-y-3">
        <AccountStatusCard
          standing={standing}
          onAcknowledge={standing.can_acknowledge ? () => {} : undefined}
          onOpen={() => {}}
        />
        <div className="flex items-center justify-between gap-3 px-1">
          {standing.level === 'limited' ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-space px-4 py-2 text-sm font-bold text-white"
            >
              Got it
            </button>
          ) : (
          <span className="text-xs text-muted">
            {standing.level === 'banned'
              ? 'Signing out is safe. Your record and the appeal on it stay where they are.'
              : 'You are still signed in, so support and your record stay open to you.'}
          </span>
          )}
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-1.5 text-xs font-bold text-white hover:border-white/25"
          >
            <Glyph icon={faRightFromBracket} />
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-dvh bg-ink text-white">
    {states.map((one) => <Over key={one.level} standing={one} />)}
  </div>,
)
