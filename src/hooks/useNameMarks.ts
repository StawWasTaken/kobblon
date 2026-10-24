import { useEffect, useState } from 'react'
import { nameMarksFor, nameMarksByName } from '@/lib/api'

/**
 * Who wears what beside their name, asked once for a whole page.
 *
 * Staw: "i want you to put the badges next to the displayname ... and
 * EVERYWHERE, cuz rn its not everywhere, sometimes its just the staff
 * badge, sometimes just the verified badge, sometimes NEITHER".
 *
 * All three of those were true, and none of them were a bug in the drawing.
 * They were twenty-odd lists each deciding the question out of whichever
 * columns its own RPC happened to return: one had `creator_is_verified` and
 * no staff column at all, so a moderator wore nothing; another had
 * `is_admin` and read it as the tick; the forum had three flags and not
 * `has_staff_badge`, so somebody given the k by hand did not wear it.
 *
 * So the question is not answered from the row any more. `name_marks_for`
 * is the database's own answer, and `nameMarksFor` has been wrapping it
 * since 0180 for the applications' chat lines. The website never called it
 * once. This is the thing that finally does.
 *
 * Batched: a list of forty names asks once, not forty times. The wait is a
 * timeout of zero rather than a frame, because everything that mounts in
 * the same tick should land in the same question.
 *
 * Two ways to name somebody, because the lists do not agree on what they
 * carry: a forum post has the author's id, a Catalog card has only their
 * username. Asking by username is not the second-best answer - it is the
 * same `name_marks` behind it - it just needs its own lookup, which is why
 * there are two functions and one cache. A key here is the id, or the
 * username with an `@` in front of it, so the two can never collide: a `@`
 * is not allowed in a username, which 0277 is what makes true.
 */

/** Answered, and the answer. An empty array means "wears nothing". */
const answered = new Map<string, string[]>()
/** Asked for, not yet sent. */
const wanted = new Set<string>()
const listeners = new Set<() => void>()
let scheduled = false

function flush() {
  scheduled = false
  const ask = [...wanted]
  wanted.clear()
  if (!ask.length) return

  const ids = ask.filter((key) => !key.startsWith('@'))
  const names = ask.filter((key) => key.startsWith('@')).map((key) => key.slice(1))

  Promise.all([
    ids.length ? nameMarksFor(ids) : Promise.resolve(new Map<string, string[]>()),
    names.length ? nameMarksByName(names) : Promise.resolve(new Map<string, string[]>()),
  ])
    .then(([byId, byName]) => {
      const got = new Map([...byId, ...[...byName].map(
        ([name, marks]) => [`@${name}`, marks] as [string, string[]],
      )])
      /*
       * Every id asked for is now answered, including the ones that came
       * back absent - absence is the answer "wears nothing", and recording
       * only the people who wear something would mean asking for everybody
       * else again on the next render for ever.
       */
      for (const key of ask) answered.set(key, got.get(key) ?? [])
      listeners.forEach((tell) => tell())
    })
    .catch(() => {
      /*
       * Left unanswered on purpose. The row's own flags are what is on
       * screen until this lands, so a failed question shows the old guess
       * rather than stripping somebody's marks off.
       */
    })
}

function want(key: string) {
  if (answered.has(key) || wanted.has(key)) return
  wanted.add(key)
  if (scheduled) return
  scheduled = true
  setTimeout(flush, 0)
}

/**
 * The marks for one person, or `undefined` while nobody has asked yet.
 *
 * `undefined` and `[]` are different answers and the caller needs both:
 * one means "draw your best guess", the other means "this person wears
 * nothing".
 */
export function useNameMarks(
  id?: string | null, username?: string | null,
): string[] | undefined {
  /*
   * The id wins where both are in hand. A username is a thing somebody can
   * change - and since 0277 a name they changed away from is still theirs,
   * so a stale one in a cached list still resolves, to the right person,
   * which is the whole point of that migration.
   */
  const key = id ? id : (username ? `@${username}` : null)
  const [, bump] = useState(0)

  useEffect(() => {
    if (!key) return
    want(key)
    const tell = () => bump((n) => n + 1)
    listeners.add(tell)
    return () => { listeners.delete(tell) }
  }, [key])

  return key ? answered.get(key) : undefined
}

/** For a test or a bare page: forget everything asked so far. */
export function forgetNameMarks() {
  answered.clear()
  wanted.clear()
}
