import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { myParty, partyInvitesForMe, type Party, type PartyInvite } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

/*
 * The party, for the whole tab.
 *
 * One answer about who you are with, shared by the panel in the corner, the
 * menu on a person's face and anything else that asks - and kept live,
 * because a party where somebody joined four minutes ago and your screen
 * does not know is not a party.
 *
 * Changes arrive rather than being polled: `parties`, `party_members` and
 * `party_invites` are in the realtime publication, and row-level security
 * decides what is sent, so a channel can be opened by anybody without
 * anybody hearing about a party they are not in or asked to.
 */
type PartyBox = {
  party: Party | null
  invites: PartyInvite[]
  loading: boolean
  /** Ask again now, for the moment straight after you changed something. */
  reload: () => Promise<void>
}

const Box = createContext<PartyBox>({
  party: null,
  invites: [],
  loading: false,
  reload: async () => {},
})

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const me = profile?.id
  const [party, setParty] = useState<Party | null>(null)
  const [invites, setInvites] = useState<PartyInvite[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!me) {
      setParty(null)
      setInvites([])
      return
    }
    setLoading(true)
    try {
      const [mine, asked] = await Promise.all([myParty(), partyInvitesForMe()])
      setParty(mine)
      setInvites(asked)
    } catch {
      /* A party that cannot be read is nothing to show, not an error to
         push at somebody in the corner of the screen. */
    } finally {
      setLoading(false)
    }
  }, [me])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (!me) return

    const again = () => { void reload() }

    const channel = supabase
      .channel('party')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_members' }, again)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, again)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_invites' }, again)
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [me, reload])

  const value = useMemo<PartyBox>(
    () => ({ party, invites, loading, reload }),
    [party, invites, loading, reload],
  )

  return <Box.Provider value={value}>{children}</Box.Provider>
}

export function useParty() {
  return useContext(Box)
}

/** Whether somebody is in your party right now. */
export function useInMyParty(id?: string | null) {
  const { party } = useParty()
  if (!id || !party) return false
  return party.members.some((one) => one.user_id === id)
}
