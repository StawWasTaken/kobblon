import { useEffect, useState } from 'react'
import { questBoard } from '@/lib/api'

/**
 * How many quests have gone up since this person last looked at the board.
 *
 * Staw: "put a blue notification dot on the quest thing when theres new
 * quests so u see them". Two things that had to be true for the dot to be
 * worth anything:
 *
 * - **It has to be about this person.** "New" is per account and per
 *   browser, so the mark sits in `localStorage` under the account's id.
 *   A shared computer does not hand you somebody else's dot.
 * - **It must not cost a request on every page.** The board is one call and
 *   a handful of rows, so it is asked for once per page load and kept in
 *   the module below. Every component that wants the dot reads the same
 *   answer; opening Quests clears it without asking again.
 *
 * Somebody who has never looked gets a dot for whatever is running, which is
 * the right answer for a new account: there is something there and they have
 * not seen it.
 */
const KEY = (who: string) => `kob.quests.seen.${who}`

let asked: Promise<number[]> | null = null
const listeners = new Set<() => void>()

/** The times the live quests went up, newest first. Asked for once. */
function questTimes(): Promise<number[]> {
  asked ??= questBoard()
    .then((rows) => rows.map((one) => new Date(one.created_at).getTime()))
    .catch(() => [])
  return asked
}

function seenAt(who: string) {
  try {
    return Number(localStorage.getItem(KEY(who)) ?? 0)
  } catch {
    /* A browser with storage switched off still gets a working page: it
       simply never remembers, so the dot comes back each load. */
    return 0
  }
}

/** Called when the board has been looked at. The dot goes out everywhere. */
export function questsSeen(who: string | null | undefined) {
  if (!who) return
  try {
    localStorage.setItem(KEY(who), String(Date.now()))
  } catch { /* nothing to do about it, and nothing breaks */ }
  for (const tell of listeners) tell()
}

/** Forgets the cached board, so the next read asks again. */
export function forgetQuests() {
  asked = null
  for (const tell of listeners) tell()
}

export function useNewQuests(who: string | null | undefined) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!who) {
      setCount(0)
      return
    }
    let live = true
    const measure = () => {
      void questTimes().then((times) => {
        if (!live) return
        const since = seenAt(who)
        setCount(times.filter((at) => at > since).length)
      })
    }
    measure()
    listeners.add(measure)
    return () => {
      live = false
      listeners.delete(measure)
    }
  }, [who])

  return count
}
