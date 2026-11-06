import { useEffect, useState } from 'react'
import { playingIn } from '@/lib/api'

/*
 * How many people are in a World right now, for a page full of Worlds.
 *
 * Staw wants the live number on every card, and a card that asks for its
 * own is a shelf of twelve cards making twelve round trips. So a card says
 * which World it is and nothing else: the asks made in the same tick are
 * collected and sent as one, and every card waiting on that answer is told
 * when it lands.
 *
 * It is also a number that goes stale while somebody reads the page, so
 * what is held here is thrown away after a while rather than kept for the
 * life of the tab - a count from four minutes ago is not "how many are
 * playing", it is how many were.
 */

/** How long an answer is worth reusing. */
const KEEP = 45_000

const known = new Map<string, { count: number; at: number }>()
const waiting = new Set<string>()
const listeners = new Set<() => void>()
let scheduled: ReturnType<typeof setTimeout> | null = null

function tellEverybody() {
  for (const listen of [...listeners]) listen()
}

async function flush() {
  scheduled = null
  const asked = [...waiting]
  waiting.clear()
  if (!asked.length) return

  try {
    const answer = await playingIn(asked)
    const at = Date.now()
    /*
     * Every World that was asked about is written down, not only the ones
     * that came back. The function answers with the Worlds that have
     * somebody in them, so a World missing from the answer is a World with
     * nobody in it - and writing that down is what stops it being asked
     * again on the next render.
     */
    for (const id of asked) known.set(id, { count: answer[id] ?? 0, at })
  } catch {
    /*
     * A count nobody could fetch is not zero, it is unknown, so nothing is
     * written down and the next render asks again. Drawing a confident 0
     * on a failed request is the page telling a lie it cannot see.
     */
  }
  tellEverybody()
}

function ask(id: string) {
  const had = known.get(id)
  if (had && Date.now() - had.at < KEEP) return
  waiting.add(id)
  /* Collected over a tick, so one shelf is one request. */
  if (!scheduled) scheduled = setTimeout(() => { void flush() }, 30)
}

/**
 * The live count for one World, or null while nobody knows yet.
 *
 * Null and zero are different answers and the difference is visible: null
 * draws nothing, zero draws nothing either, but a card that has been told
 * zero stops asking and a card that has been told nothing does not.
 */
export function usePlaying(id: string | null | undefined): number | null {
  const [, bump] = useState(0)

  useEffect(() => {
    if (!id) return
    const listen = () => bump((n) => n + 1)
    listeners.add(listen)
    ask(id)
    /* Asked again while the page is still open, because it moves. */
    const again = setInterval(() => { ask(id); void 0 }, KEEP)
    return () => {
      listeners.delete(listen)
      clearInterval(again)
    }
  }, [id])

  if (!id) return null
  const had = known.get(id)
  return had ? had.count : null
}
