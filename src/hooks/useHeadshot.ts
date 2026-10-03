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
  askForHeadshot, headshotFor, headshotKnown, portraitIsCurrent, watchHeadshots,
} from '@/lib/headshots'

export function useHeadshot(
  personId: string | null | undefined,
  stored: string | null | undefined,
  /**
   * When they last changed their avatar. With it, a stored picture taken
   * before that is ignored and a current one drawn - which is the whole of
   * Staw's "everytime you change avatars, it updates", for everybody looking
   * rather than only for the account that happened to be on its own avatar
   * page when it changed.
   */
  changedAt?: string | null,
): string | null {
  const [, nudge] = useState(0)
  const current = portraitIsCurrent({ avatar_url: stored, avatar_changed_at: changedAt })
  const usable = current ? stored : null

  useEffect(() => {
    // Nothing to draw, or nothing to draw it for.
    if (usable || !personId) return

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
  }, [personId, usable])

  if (usable) return usable
  return personId ? headshotFor(personId) : null
}
