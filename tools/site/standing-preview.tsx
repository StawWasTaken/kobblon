/* The account status card, in each state it can be in, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { AccountStatusCard } from '@/components/social/AccountStatusCard'
import type { AccountLock } from '@/types/db'
import '@/index.css'

const base: AccountLock = {
  level: 'warned',
  headline: 'You have been given a warning.',
  why: 'Saying things in a Community wall that two people reported, after '
    + 'being asked once to stop.',
  rule: 'Be decent to people',
  decided_at: new Date().toISOString(),
  until: null,
  violation_id: '42',
  appeal_status: null,
  can_appeal: true,
  can_return: false,
  can_acknowledge: true,
  acknowledged: false,
  is_banned: false,
}

const soon = new Date(Date.now() + 1000 * 60 * 60 * 52).toISOString()

const states: [string, AccountLock][] = [
  ['Warned', base],
  ['Suspended, still running', {
    ...base, level: 'suspended', headline: 'This account is suspended.',
    until: soon, can_acknowledge: false,
  }],
  ['Suspension spent', {
    ...base, level: 'suspended', headline: 'Your suspension has run out.',
    until: new Date(Date.now() - 1000 * 60).toISOString(),
    can_acknowledge: true, can_return: true,
  }],
  ['Closed', {
    ...base, level: 'banned', headline: 'This account has been closed.',
    until: null, can_acknowledge: false, is_banned: true,
  }],
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-dvh space-y-8 bg-ink p-8">
    {states.map(([name, one]) => (
      <div key={name} className="mx-auto max-w-2xl space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{name}</p>
        <AccountStatusCard
          standing={one}
          onAcknowledge={one.can_acknowledge ? () => {} : undefined}
        />
      </div>
    ))}

    {/*
      * The shape the Launcher asked for in round 56: narrow enough to sit
      * inside a World's canvas the way the Escape menu does, and with the
      * four doors handed over instead of followed, because an `<a href>`
      * in Electron takes the only window there is somewhere it cannot
      * come back from.
      *
      * Nothing is left out of it. Same reason the card is shared at all.
      */}
    <div className="mx-auto max-w-sm space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        Compact, with the doors handed over
      </p>
      <AccountStatusCard
        standing={states[1][1]}
        compact
        standingHref="https://kobblon.com/standing"
        supportHref="https://kobblon.com/support"
        rulesHref="https://kobblon.com/guidelines"
        onOpen={(href) => console.log('open externally', href)}
      />
    </div>
  </div>,
)
