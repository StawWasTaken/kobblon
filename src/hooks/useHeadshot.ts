/*
 * The face to show for somebody: what is stored, or what they look like.
 *
 * The second half is the part Staw asked for. An account that has never
 * opened My Avatar - every new one, and every guest - has nothing stored,
 * and showing initials there is showing a placeholder for a person whose
 * avatar is sitting in the database fully dressed. So it is drawn, in the
 * browser that needs it, and appears as soon as it is ready.
 */
import { useEffect, useState } from 'react'
import {
  askForHeadshot, headshotFor, headshotKnown, watchHeadshots,
} from '@/lib/headshots'

export function useHeadshot(
  personId: string | null | undefined,
  stored: string | null | undefined,
): string | null {
  const [, nudge] = useState(0)

  useEffect(() => {
    // Nothing to draw, or nothing to draw it for.
    if (stored || !personId) return

    /*
     * The trap, in its usual clothes: the person being drawn can change
     * while this is in flight. The listener is what makes that safe - it is
     * removed on the way out, so a draw that lands after this picture has
     * moved on tells nobody, and the answer it stored is simply there for
     * whoever asks next.
     */
    const stop = watchHeadshots(() => nudge((n) => n + 1))
    if (!headshotKnown(personId)) void askForHeadshot(personId)
    return stop
  }, [personId, stored])

  if (stored) return stored
  return personId ? headshotFor(personId) : null
}
