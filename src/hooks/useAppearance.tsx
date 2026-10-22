import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useMaybeAuth } from '@/hooks/useAuth'
import { claimAppearance, myAppearances, wearAppearance } from '@/lib/api'
import type { Appearance } from '@/lib/appearances'
import { APPEARANCES } from '@/lib/appearances'

/**
 * Which appearance this account is wearing, on the document.
 *
 * It is written to `data-appearance` on the html element and read from
 * there by CSS - the chrome colours, the marks and the backdrop all. Not by
 * a hook anywhere else, deliberately: the marks and the backdrop are
 * mounted by the Workspace too, and a hook in one of them is a hook that
 * throws where there is no provider. An attribute answers the same question
 * with nothing to supply, and a Workspace that never sets it gets the blue
 * one, which is the right answer there.
 *
 * It is on the account rather than this machine, because a claim is: Staw
 * wants the person who was here in October to still have halloween in
 * March, on whatever they sign in on. The dark/light mode stays in the
 * browser where it was, and the two apply at once.
 */
const KEY = 'kobblon.appearance'

type Value = {
  /** What is being worn now. */
  appearance: Appearance
  /** What may be worn, which is the default plus whatever was claimed. */
  owned: Appearance[]
  /** Whether the list above is the database's answer yet. */
  settled: boolean
  /** Put one on. Refused by the database if it was never claimed. */
  wear: (which: Appearance) => Promise<void>
  /** Take the one being given away. It is put on straight away. */
  claim: (which: Appearance) => Promise<void>
  reload: () => void
}

const AppearanceContext = createContext<Value>({
  appearance: 'default',
  owned: ['default'],
  settled: false,
  wear: async () => {},
  claim: async () => {},
  reload: () => {},
})

const known = (which: string | null | undefined): Appearance =>
  (APPEARANCES as string[]).includes(which ?? '') ? (which as Appearance) : 'default'

/*
 * The last one seen, kept on this device.
 *
 * Not the setting - the account owns that - but the answer to "what did
 * this person's bar look like last time", so a reload draws it at the first
 * paint instead of showing blue for the second it takes to read the
 * profile. A blue flash on every load of a site somebody has set to orange
 * is worse than the stale answer could ever be, and the profile corrects it
 * either way.
 */
function remembered(): Appearance {
  try {
    return known(localStorage.getItem(KEY))
  } catch {
    return 'default'
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const auth = useMaybeAuth()
  const profile = auth?.profile ?? null

  const [owned, setOwned] = useState<Appearance[]>(['default'])
  const [settled, setSettled] = useState(false)
  const [appearance, setAppearance] = useState<Appearance>(remembered)

  /*
   * Signed in, the profile decides; signed out, the blue one. The
   * remembered value is only ever the thing on screen before the first
   * answer arrives.
   */
  useEffect(() => {
    if (!auth) return
    setAppearance(profile ? known(profile.appearance) : 'default')
  }, [auth, profile])

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance
    try { localStorage.setItem(KEY, appearance) } catch { /* nothing to do */ }
  }, [appearance])

  const reload = useCallback(() => {
    if (!profile) {
      setOwned(['default'])
      setSettled(false)
      return
    }
    void myAppearances()
      .then((rows) => setOwned(rows.map((row) => known(row.appearance))))
      .catch(() => setOwned(['default']))
      .finally(() => setSettled(true))
  }, [profile])

  useEffect(reload, [reload])

  const value = useMemo<Value>(() => ({
    appearance,
    owned,
    settled,
    /*
     * Drawn straight away and then asked for. A switch that waits on a
     * round trip is a switch somebody presses twice; if the database
     * refuses - which it does for one that was never claimed - what was
     * being worn goes back on and the error is thrown on to the caller to
     * say out loud.
     */
    wear: async (which) => {
      const had = appearance
      setAppearance(which)
      try {
        await wearAppearance(which)
        await auth?.refreshProfile?.()
      } catch (error) {
        setAppearance(had)
        throw error
      }
    },
    claim: async (which) => {
      await claimAppearance(which)
      setAppearance(which)
      reload()
      await auth?.refreshProfile?.()
    },
    reload,
  }), [appearance, owned, settled, auth, reload])

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export const useAppearance = () => useContext(AppearanceContext)
