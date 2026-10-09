import { useEffect, useRef, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import type { Presence } from '@/components/ui/StatusDot'
import { presenceOf } from '@/components/ui/StatusDot'

/*
 * Who is here, right now, kept in one place for the whole tab.
 *
 * A row fetched by a page is a photograph: it says what somebody was doing
 * when that page happened to ask, and it never changes afterwards, which is
 * why the same person could be Building in the sidebar and Online on their
 * profile and neither would move.
 *
 * So presence stops coming from rows. Everybody with Kobblon open joins one
 * channel and says what they are doing; everybody subscribed hears it the
 * moment it changes. A row is only the fallback, for people who are not here
 * to speak for themselves.
 */
export type Here = {
  id: string
  activity: 'around' | 'building'
  in_space_id: string | null
  at: number
}

const here = new Map<string, Here>()

/*
 * Whose tab this is.
 *
 * The hole left by the version above: a row is the fallback for people who
 * are not here to speak for themselves, and you are always here. But your
 * own entry only arrives once the channel has synced, and until it does you
 * fall back to a row fetched when the page loaded - so your profile said
 * Offline while the chat dock, holding a fresher row, said Online. Same
 * logic, differently-aged photographs.
 *
 * You are demonstrably present: you are looking at the page.
 */
let myId: string | undefined
const watchers = new Set<() => void>()
let version = 0

function changed() {
  version += 1
  for (const tell of watchers) tell()
}

function subscribe(tell: () => void) {
  watchers.add(tell)
  return () => { watchers.delete(tell) }
}

/** Anything that reads presence re-reads it when this moves. */
const useVersion = () => useSyncExternalStore(subscribe, () => version, () => version)

/**
 * The state of one person: what they are saying about themselves if they are
 * here, and what their row last said if they are not.
 */
export function useLivePresence(person?: {
  id?: string
  is_online?: boolean
  in_space_id?: string | null
  activity?: string | null
  last_seen_at?: string | null
} | null): Presence {
  useVersion()

  const live = person?.id ? here.get(person.id) : undefined
  if (live) {
    return live.in_space_id ? 'in-space' : live.activity === 'building' ? 'building' : 'online'
  }

  /* Never tell somebody they are offline to their own face. */
  if (person?.id && person.id === myId) return 'online'

  return presenceOf(person)
}

/*
 * The one channel, joined once by the page frame.
 *
 * Presence here is Supabase's own: no table, no rows, no writes. It is a list
 * of who is connected and what each of them last said, and it empties itself
 * when somebody closes the tab, which is the one thing a heartbeat into a
 * table can never do properly.
 */
export function usePresenceChannel(
  me: string | undefined,
  doing: 'around' | 'building',
  inSpace: string | null | undefined,
) {
  /*
   * The channel is held onto rather than looked up again later. Looking it up
   * by its name is how the last version of this failed: saying what you are
   * doing only worked if that search happened to find it, so walking into
   * Create changed nothing and your dot stayed blue.
   */
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const joined = useRef(false)

  useEffect(() => {
    if (!me) return
    myId = me

    const mine = supabase.channel('kobblon:here', {
      config: { presence: { key: me } },
    })
    channel.current = mine
    joined.current = false

    const read = () => {
      const state = mine.presenceState<Here>()
      here.clear()
      for (const list of Object.values(state)) {
        for (const one of list) {
          if (one?.id) here.set(one.id, one)
        }
      }
      changed()
    }

    mine
      .on('presence', { event: 'sync' }, read)
      .on('presence', { event: 'join' }, read)
      .on('presence', { event: 'leave' }, read)
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        joined.current = true
        void mine.track({ id: me, activity: doing, in_space_id: inSpace ?? null, at: Date.now() })
      })

    return () => {
      joined.current = false
      channel.current = null
      void supabase.removeChannel(mine)
      here.clear()
      /* Signed out, or signed in as somebody else. Whoever this was is no
         longer the person looking at the page. */
      myId = undefined
      changed()
    }
    // Only the account matters here: what you are doing is said again below
    // rather than by joining all over again.
  }, [me])

  useEffect(() => {
    if (!me) return

    /*
     * Your own dot moves the instant you do, without waiting for the channel
     * to answer: you are the one source that cannot be out of date about
     * yourself.
     */
    here.set(me, { id: me, activity: doing, in_space_id: inSpace ?? null, at: Date.now() })
    changed()

    if (joined.current && channel.current) {
      void channel.current.track({
        id: me, activity: doing, in_space_id: inSpace ?? null, at: Date.now(),
      })
    }
  }, [me, doing, inSpace])

  /*
   * Nobody sends a message to say they have gone quiet, so the clock has to
   * be looked at now and then: somebody whose row went stale becomes grey
   * without anything arriving to tell us.
   */
  useEffect(() => {
    const timer = window.setInterval(changed, 30_000)
    return () => window.clearInterval(timer)
  }, [])
}
