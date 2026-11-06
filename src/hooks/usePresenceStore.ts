import { useEffect, useRef, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { whereTheyAre, type Whereabouts } from '@/lib/api'
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
 * Where people actually are, which is a different question from whether
 * they have a tab open.
 *
 * The channel above knows about browsers. Somebody playing is in the
 * Launcher, which is not a browser and is not on that channel, so the
 * channel's honest answer about them is "not here" - and that is how a
 * friend in a World read as Offline on the site while five other people
 * were standing next to them in it. The roster behind `where_they_are` is
 * the other half, and it is the authoritative one: it is written by the
 * thing the person is actually in.
 *
 * So this map is consulted first and the channel second. One answer, out of
 * one function, for the dot, the word, the hover card, the profile line and
 * anything that sorts a list by who is around.
 */
const inWorld = new Map<string, { at: number; where: Whereabouts }>()

/**
 * How long a fetched whereabouts row is worth believing.
 *
 * The roster's own window is about a minute and a half, so holding one for
 * longer than that is keeping a photograph of exactly the kind this file
 * exists to stop keeping.
 */
const WHEREABOUTS_GOOD_FOR = 90 * 1000

/** What a screen learned about where some people are. */
export function learnWhereabouts(who: string[], rows: Whereabouts[]) {
  const at = Date.now()
  const found = new Set(rows.map((row) => row.user_id))
  for (const row of rows) inWorld.set(row.user_id, { at, where: row })
  /* Asked about and not in the answer means out, not unknown. Leaving this
     out is how somebody stays "in a World" for the rest of the session. */
  for (const id of who) if (!found.has(id)) inWorld.delete(id)
  changed()
}

/** Where one person is, or nothing if nobody has asked lately. */
export function whereIs(id?: string | null): Whereabouts | null {
  if (!id) return null
  const held = inWorld.get(id)
  if (!held) return null
  /* Read-only: a stale row is not believed, and is not deleted either.
     This is called during render, and a render that changes the store is a
     render that can tell React something different on its second go. The
     next answer overwrites it; nothing else needs to. */
  if (Date.now() - held.at > WHEREABOUTS_GOOD_FOR) return null
  return held.where
}

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

type Somebody = {
  id?: string
  is_online?: boolean
  in_space_id?: string | null
  activity?: string | null
  last_seen_at?: string | null
} | null | undefined

/**
 * The state of one person, read rather than subscribed to.
 *
 * The same answer `useLivePresence` gives, for the places that need it
 * outside a hook - sorting a list into who is here and who is not, which
 * cannot call a hook per person.
 *
 * It exists because a page that split its list on `is_online` and drew each
 * card with `useLivePresence` was asking two different questions and
 * putting the answers next to each other: okayCooki3's photograph of three
 * friends under "Around now", each of them saying Offline underneath. The
 * row said online, the row was stale, and the label knew and the heading
 * did not. Anything that groups by presence groups by this.
 */
export function presenceNow(person: Somebody): Presence {
  /*
   * The roster first, because it is the only one of the three that knows
   * about the Launcher. Somebody standing in a World is in a World whatever
   * a browser channel or a row fetched ten minutes ago has to say.
   */
  if (whereIs(person?.id)) return 'in-space'

  const live = person?.id ? here.get(person.id) : undefined
  if (live) {
    return live.in_space_id ? 'in-space' : live.activity === 'building' ? 'building' : 'online'
  }

  /* Never tell somebody they are offline to their own face. */
  if (person?.id && person.id === myId) return 'online'

  return presenceOf(person)
}

/**
 * Re-render when anybody's presence moves.
 *
 * For a component that calls `presenceNow` itself: without this the answer
 * is read once and never asked again, which is the photograph this whole
 * file exists to stop being taken.
 */
export const usePresenceVersion = useVersion

/**
 * The state of one person: what they are saying about themselves if they are
 * here, and what their row last said if they are not.
 */
export function useLivePresence(person?: Somebody): Presence {
  useVersion()
  return presenceNow(person)
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

/**
 * Ask where these people are, and keep asking while the screen is up.
 *
 * It takes the list a screen is already drawing: a friends list, a profile
 * which is a list of one, the faces on a shelf. One round trip for the lot.
 *
 * The guard here is the one this project keeps getting wrong. The effect
 * does not close over the ids it was given at mount - it keys on the
 * sorted ids, so a list that changes is a list that is asked about again -
 * and the answer is thrown away if the list moved on while it was in
 * flight, because the alternative is a slow answer about yesterday's list
 * overwriting a fast answer about today's.
 */
export function useWhereabouts(people: Array<{ id?: string | null } | null | undefined>) {
  const key = people
    .map((one) => one?.id)
    .filter((id): id is string => !!id)
    .sort()
    .join(',')

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (!ids.length) return

    let wanted = true

    const ask = async () => {
      try {
        const rows = await whereTheyAre(ids)
        /* The list this answer is about is the list that was asked, not
           whatever the screen is drawing now. */
        if (wanted) learnWhereabouts(ids, rows)
      } catch {
        /* A roster that cannot be read is not an error anybody can act on:
           the dot falls back to the channel, which is what it did before
           this existed. */
      }
    }

    void ask()
    /* Inside the window the rows are good for, so an answer is replaced
       before it goes stale rather than after. */
    const again = window.setInterval(() => void ask(), 60 * 1000)

    return () => {
      wanted = false
      window.clearInterval(again)
    }
  }, [key])
}

/**
 * Where one person is, kept live.
 *
 * Reading only - somebody has to have asked. A list calls `useWhereabouts`
 * and every face in it can read the answer, which is one round trip rather
 * than one per face.
 */
export function useWhereabout(id?: string | null): Whereabouts | null {
  useVersion()
  return whereIs(id)
}
